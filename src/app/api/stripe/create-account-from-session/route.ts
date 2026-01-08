// app/api/stripe/create-account-from-session/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'
import crypto from 'crypto'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover'
})

const ENCRYPTION_KEY = process.env.REGISTRATION_ENCRYPTION_KEY || ''
const IV_LENGTH = 16

function decryptPassword(encrypted: string) {
  if (!encrypted) return ''
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    console.warn('[create-account-from-session] REGISTRATION_ENCRYPTION_KEY manquante ou trop courte, on retourne le mot de passe tel quel')
    return encrypted
  }
  const parts = encrypted.split(':')
  if (parts.length !== 2) {
    return encrypted
  }
  try {
    const iv = Buffer.from(parts[0], 'hex')
    const encryptedText = parts[1]
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('[create-account-from-session] Erreur de déchiffrement du mot de passe, fallback en clair:', err)
    return encrypted
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id requis' }, { status: 400 })
    }

    console.log('[create-account-from-session] === DÉBUT ===')
    console.log('[create-account-from-session] sessionId:', sessionId)

    const supabase = createClient()

    // Récupérer la session Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    })

    console.log('[create-account-from-session] Session récupérée:', {
      id: session.id,
      customer: session.customer,
      subscription: session.subscription
    })

    // Récupérer le registration_token depuis les metadata
    const registrationToken = session.metadata?.registration_token || 
                             (typeof session.subscription === 'object' && session.subscription?.metadata?.registration_token) ||
                             (typeof session.subscription === 'string' ? null : null)

    if (!registrationToken) {
      console.log('[create-account-from-session] Aucun registration_token trouvé, peut-être que le compte existe déjà')
      
      // Vérifier si un utilisateur existe déjà avec l'email du customer
      if (session.customer && typeof session.customer === 'string') {
        const customer = await stripe.customers.retrieve(session.customer)
        const email = (customer as Stripe.Customer).email
        
        if (email) {
          const { data: usersList } = await supabase.auth.admin.listUsers()
          const existingUser = usersList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
          
          if (existingUser) {
            console.log('[create-account-from-session] Utilisateur existe déjà:', existingUser.id)
            return NextResponse.json({ 
              success: true, 
              userExists: true,
              userId: existingUser.id 
            })
          }
        }
      }
      
      return NextResponse.json({ 
        error: 'Aucun registration_token trouvé dans la session' 
      }, { status: 400 })
    }

    console.log('[create-account-from-session] registration_token trouvé:', registrationToken)

    // Récupérer les données depuis pending_registrations
    const { data: pendingReg, error: pendingError } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('token', registrationToken)
      .maybeSingle()

    if (pendingError) {
      console.error('[create-account-from-session] Erreur récupération pending_registrations:', pendingError)
      return NextResponse.json({ 
        error: 'Erreur lors de la récupération des données d\'inscription' 
      }, { status: 500 })
    }

    if (!pendingReg) {
      console.warn('[create-account-from-session] Aucun pending_registration trouvé pour registration_token:', registrationToken)
      return NextResponse.json({ 
        error: 'Données d\'inscription introuvables ou expirées' 
      }, { status: 404 })
    }

    // Vérifier l'expiration
    if (pendingReg.expires_at && new Date(pendingReg.expires_at) < new Date()) {
      console.warn('[create-account-from-session] pending_registration expiré')
      return NextResponse.json({ 
        error: 'Les données d\'inscription ont expiré. Merci de recommencer.' 
      }, { status: 400 })
    }

    console.log('[create-account-from-session] pending_registration trouvé:', {
      email: pendingReg.email,
      phone: pendingReg.phone_number,
      phone_verification_id: pendingReg.phone_verification_id
    })

    // Vérifier si l'utilisateur existe déjà
    const { data: usersList } = await supabase.auth.admin.listUsers()
    const existingUser = usersList?.users?.find(u => u.email?.toLowerCase() === pendingReg.email.toLowerCase())

    if (existingUser) {
      console.log('[create-account-from-session] Utilisateur existe déjà:', existingUser.id)
      
      // Marquer account_created dans phone_verifications
      if (pendingReg.phone_verification_id) {
        console.log('[create-account-from-session] 🚀 Mise à jour phone_verifications.account_created (userExists) pour:', pendingReg.phone_verification_id)
        const { data: updateData, error: phoneUpdateError } = await supabase
          .from('phone_verifications')
          .update({ account_created: true })
          .eq('id', pendingReg.phone_verification_id)
          .select()
        
        if (phoneUpdateError) {
          console.error('[create-account-from-session] ❌ Erreur update phone_verifications.account_created (userExists):', phoneUpdateError)
        } else {
          console.log('[create-account-from-session] ✅ phone_verifications.account_created mis à jour (userExists):', updateData)
        }
      } else {
        console.warn('[create-account-from-session] ⚠️ Aucun phone_verification_id dans pending_registration (userExists)')
      }

      // Nettoyer pending_registrations
      await supabase
        .from('pending_registrations')
        .delete()
        .eq('token', registrationToken)

      return NextResponse.json({ 
        success: true, 
        userExists: true,
        userId: existingUser.id 
      })
    }

    // Déchiffrer le mot de passe
    const passwordToDecrypt = pendingReg.password_hash || pendingReg.password_encrypted || pendingReg.password
    if (!passwordToDecrypt) {
      console.error('[create-account-from-session] ❌ Aucun password trouvé dans pending_registration')
      return NextResponse.json({ 
        error: 'Mot de passe manquant dans les données d\'inscription' 
      }, { status: 500 })
    }

    const decryptedPassword = decryptPassword(passwordToDecrypt)

    // Créer l'utilisateur
    console.log('[create-account-from-session] 🚀 Création de l\'utilisateur')
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: pendingReg.email,
      password: decryptedPassword,
      email_confirm: true
    })

    if (createUserError) {
      console.error('[create-account-from-session] Erreur création user:', createUserError)
      return NextResponse.json({ 
        error: 'Erreur lors de la création du compte',
        details: createUserError.message
      }, { status: 500 })
    }

    if (!createdUser?.user) {
      console.error('[create-account-from-session] ❌ Utilisateur non créé')
      return NextResponse.json({ 
        error: 'Impossible de créer le compte' 
      }, { status: 500 })
    }

    const userId = createdUser.user.id
    console.log('[create-account-from-session] ✅ Utilisateur créé:', userId)

    // Créer le profil (sans phone_number car cette colonne n'existe pas dans profiles)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: pendingReg.email,
        full_name: pendingReg.full_name || null,
        company_name: pendingReg.company_name || null
        // Note: phone_number n'existe pas dans la table profiles
      })

    if (profileError) {
      console.error('[create-account-from-session] Erreur insertion profil:', profileError)
      // Ne pas bloquer, on continue
    } else {
      console.log('[create-account-from-session] ✅ Profil créé')
    }

    // Marquer account_created dans phone_verifications
    if (pendingReg.phone_verification_id) {
      console.log('[create-account-from-session] 🚀 Mise à jour phone_verifications.account_created pour:', pendingReg.phone_verification_id)
      const { data: updateData, error: phoneUpdateError } = await supabase
        .from('phone_verifications')
        .update({ account_created: true })
        .eq('id', pendingReg.phone_verification_id)
        .select()
      
      if (phoneUpdateError) {
        console.error('[create-account-from-session] ❌ Erreur update phone_verifications.account_created:', phoneUpdateError)
      } else {
        console.log('[create-account-from-session] ✅ phone_verifications.account_created mis à jour:', updateData)
      }
    } else {
      console.warn('[create-account-from-session] ⚠️ Aucun phone_verification_id dans pending_registration')
    }

    // Nettoyer l'entrée temporaire
    const { error: deletePendingError } = await supabase
      .from('pending_registrations')
      .delete()
      .eq('token', registrationToken)
    
    if (deletePendingError) {
      console.warn('[create-account-from-session] Erreur suppression pending_registrations:', deletePendingError)
    } else {
      console.log('[create-account-from-session] ✅ pending_registrations nettoyé')
    }

    // Mettre à jour la subscription Stripe avec le user_id si possible
    if (session.subscription && typeof session.subscription === 'string') {
      try {
        await stripe.subscriptions.update(session.subscription, {
          metadata: {
            user_id: userId
          }
        })
        console.log('[create-account-from-session] ✅ Metadata user_id mise à jour sur Stripe')
      } catch (stripeUpdateError) {
        console.warn('[create-account-from-session] Impossible de mettre à jour la metadata user_id sur Stripe:', stripeUpdateError)
      }
    }

    // Générer un lien de connexion magique pour connecter automatiquement l'utilisateur
    let magicLink: string | null = null
    try {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: pendingReg.email
      })
      
      if (!linkError && linkData?.properties?.action_link) {
        magicLink = linkData.properties.action_link
        console.log('[create-account-from-session] ✅ Lien magique généré')
      } else {
        console.warn('[create-account-from-session] Impossible de générer le lien magique:', linkError)
      }
    } catch (linkErr) {
      console.warn('[create-account-from-session] Erreur génération lien magique:', linkErr)
    }

    console.log('[create-account-from-session] ✅ === COMPTE CRÉÉ AVEC SUCCÈS ===')

    return NextResponse.json({ 
      success: true,
      userId,
      email: pendingReg.email,
      magicLink // Lien pour connecter automatiquement l'utilisateur
    })

  } catch (error: any) {
    console.error('[create-account-from-session] Erreur:', error)
    return NextResponse.json({ 
      error: 'Erreur lors de la création du compte',
      details: error.message
    }, { status: 500 })
  }
}

