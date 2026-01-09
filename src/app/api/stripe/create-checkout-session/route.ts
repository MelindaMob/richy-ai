// app/api/stripe/create-checkout-session/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover'
})

const ENCRYPTION_KEY = process.env.REGISTRATION_ENCRYPTION_KEY || ''
const IV_LENGTH = 16

function encryptPassword(password: string) {
  // Si la clé est manquante ou invalide, on retourne le mot de passe en clair (fallback)
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    return { encrypted: password, usedFallback: true }
  }

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv)
  let encrypted = cipher.update(password, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return { encrypted: `${iv.toString('hex')}:${encrypted}`, usedFallback: false }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    const { 
      priceType, // 'trial' ou 'direct'
      isUpgrade = false, // Si c'est un upgrade depuis trial
      pendingRegistration // Infos d'inscription si le compte n'existe pas encore
    } = await req.json()

    const { data: { user: existingUser } } = await supabase.auth.getUser()
    
    // Si pendingRegistration est présent, c'est une nouvelle inscription
    // Même si un utilisateur est connecté, on permet la création d'un nouveau compte
    // (l'utilisateur peut être connecté avec un autre compte)
    const isNewRegistration = !!pendingRegistration

    // Vérifier NEXT_PUBLIC_APP_URL
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ 
        error: 'Configuration serveur manquante. Veuillez contacter le support.' 
      }, { status: 500 })
    }

    let user = existingUser
    let customerId: string | undefined
    let existingSub: any = null
    let finalPriceType = isUpgrade ? 'direct' : (priceType || 'trial') // Fallback à 'trial' si priceType est undefined
    let registrationToken: string | null = null

    if (isNewRegistration) {
      const registration = pendingRegistration || {}

      // Validations de base
      const email = (registration.email || '').trim().toLowerCase()
      const password = registration.password
      const phoneNumber = registration.phone_number
      const phoneVerificationId = registration.phone_verification_id

      if (!email || !password || !phoneNumber || !phoneVerificationId) {
        return NextResponse.json({ 
          error: 'Données incomplètes. Merci de recommencer l\'inscription.' 
        }, { status: 400 })
      }

      // Vérifier email dans profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle()
      
      if (existingProfile) {
        return NextResponse.json({ 
          error: 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.',
          emailAlreadyUsed: true
        }, { status: 400 })
      }

      // Vérifier email dans auth.users via admin
      const { data: usersList } = await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      })

      const emailExistsInAuth = usersList?.users?.some(u => u.email?.toLowerCase() === email)
      if (emailExistsInAuth) {
        return NextResponse.json({ 
          error: 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.',
          emailAlreadyUsed: true
        }, { status: 400 })
      }

      // Vérifier phone_verifications (utiliser adminSupabase pour contourner RLS)
      const { data: verification } = await adminSupabase
        .from('phone_verifications')
        .select('id, verified, account_created')
        .eq('id', phoneVerificationId)
        .maybeSingle()

      if (!verification || verification.verified !== true) {
        return NextResponse.json({ 
          error: 'La vérification du numéro a expiré. Merci de recommencer.' 
        }, { status: 400 })
      }

      const hasAccountCreatedField = verification && Object.prototype.hasOwnProperty.call(verification, 'account_created')
      if (hasAccountCreatedField && verification.account_created === true) {
        return NextResponse.json({
          error: 'Ce numéro est déjà lié à un compte. Connecte-toi avec ce numéro ou utilise un autre numéro.',
          alreadyUsed: true
        }, { status: 400 })
      }

      // Chiffrer le mot de passe (ou fallback clair)
      const { encrypted: encryptedPassword } = encryptPassword(password)

      // S'assurer que encrypted n'est jamais null/undefined
      const encrypted = encryptedPassword || password
      if (!encrypted) {
        return NextResponse.json({
          error: 'Erreur lors du traitement du mot de passe. Réessaie.'
        }, { status: 500 })
      }

      // Créer un token de registration et insérer dans pending_registrations
      registrationToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      
      // Préparer les données d'insertion
      const insertData: any = {
        token: registrationToken,
        email,
        full_name: registration.full_name || null,
        company_name: registration.company_name || null,
        phone_number: phoneNumber,
        phone_verification_id: phoneVerificationId,
        plan_type: finalPriceType || 'trial',
        expires_at: expiresAt
      }
      
      // Essayer d'abord avec password_hash (nouveau nom)
      // Si ça échoue, on essaiera avec password_encrypted (ancien nom)
      insertData.password_hash = encrypted
      // Aussi remplir password_encrypted au cas où les deux colonnes existent
      insertData.password_encrypted = encrypted
      
      const { error: pendingError, data: pendingData } = await adminSupabase
        .from('pending_registrations')
        .insert(insertData)
        .select()

      if (pendingError) {
        return NextResponse.json({
          error: 'Erreur lors de la préparation de l\'inscription. Réessaie.',
          details: process.env.NODE_ENV === 'development' ? pendingError.message : undefined
        }, { status: 500 })
      }

      if (!pendingData || pendingData.length === 0) {
        return NextResponse.json({
          error: 'Erreur lors de l\'enregistrement. Réessaie.'
        }, { status: 500 })
      }

      // Vérifier si un customer avec cet email existe déjà dans Stripe
      await stripe.customers.list({
        email: email,
        limit: 5
      })

      // Créer un customer Stripe avec uniquement l'email
      const customer = await stripe.customers.create({
        email,
        metadata: {
          registration_token: registrationToken
        },
        balance: 0
      })
      customerId = customer.id
    } else {
      if (!existingUser) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
      user = existingUser

      // Check si déjà abonné (utiliser adminSupabase pour contourner RLS)
      const { data: existingSubData } = await adminSupabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()
      existingSub = existingSubData

      // Si upgrade, annuler l'ancien (si elle existe encore dans Stripe)
      if (isUpgrade && existingSub?.stripe_subscription_id) {
        try {
          // Vérifier d'abord si la subscription existe encore dans Stripe
          const stripeSub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id)
          
          // Si elle existe et n'est pas déjà annulée, l'annuler
          if (stripeSub && stripeSub.status !== 'canceled' && !stripeSub.canceled_at) {
            await stripe.subscriptions.cancel(existingSub.stripe_subscription_id, {
              prorate: false,
              invoice_now: false
            })
          }
        } catch (cancelError: any) {
          // Si la subscription n'existe plus dans Stripe (404), c'est OK, on continue
          // Ne pas bloquer, on continue quand même
        }
      }

      // Créer ou récupérer le customer Stripe
      customerId = existingSub?.stripe_customer_id
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            user_id: user.id
          },
          balance: 0
        })
        customerId = customer.id

        await adminSupabase.from('subscriptions').upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: 'pending'
        }, {
          onConflict: 'user_id'
        })
        
        // IMPORTANT: Mettre à jour le profil avec stripe_customer_id pour que le middleware laisse passer
        await supabase.from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)
      } else {
        try {
          const customer = await stripe.customers.retrieve(customerId)
          if ((customer as Stripe.Customer).deleted) {
            throw new Error('Customer deleted')
          }

          if ((customer as any).balance !== 0) {
            await stripe.customers.update(customerId, { balance: 0 })
          }
          
          // IMPORTANT: S'assurer que le profil a bien stripe_customer_id
          const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .maybeSingle()
          
          if (!profile?.stripe_customer_id) {
            await supabase.from('profiles')
              .update({ stripe_customer_id: customerId })
              .eq('id', user.id)
          }
        } catch (error: any) {
          const customer = await stripe.customers.create({
            email: user.email!,
            metadata: {
              user_id: user.id
            },
            balance: 0
          })
          customerId = customer.id

          await adminSupabase.from('subscriptions').upsert({
            user_id: user.id,
            stripe_customer_id: customerId,
            status: existingSub?.status || 'pending'
          })
          
          // IMPORTANT: Mettre à jour le profil avec le nouveau stripe_customer_id
          await supabase.from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', user.id)
        }
      }
    }

    // Utiliser le même Price ID pour les deux (49€/mois)
    // La différence sera dans subscription_data.trial_period_days
    const priceId = process.env.STRIPE_PRICE_DIRECT_ID

    if (!priceId) {
      return NextResponse.json({ 
        error: 'Configuration Stripe manquante. Veuillez contacter le support.' 
      }, { status: 500 })
    }

    // Pour les nouvelles inscriptions, s'assurer que le customer a le bon email
    // On ne peut pas utiliser customer_email si customer est déjà fourni
    if (isNewRegistration && pendingRegistration?.email && customerId) {
      const correctEmail = pendingRegistration.email.trim().toLowerCase()
      try {
        // Récupérer le customer actuel pour vérifier son email
        const currentCustomer = await stripe.customers.retrieve(customerId) as Stripe.Customer
        if (currentCustomer.email?.toLowerCase() !== correctEmail) {
          // Mettre à jour l'email du customer
          await stripe.customers.update(customerId, {
            email: correctEmail
          })
        }
      } catch (updateError: any) {
        // Ne pas bloquer, on continue quand même
      }
    }
    
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded', // IMPORTANT pour embedded
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      
      // Désactiver les taxes automatiques pour éviter les frais supplémentaires
      automatic_tax: {
        enabled: false
      },
      
      subscription_data: {
        // Si c'est un trial (et pas un upgrade), ajouter la période d'essai de 3 jours
        ...(finalPriceType === 'trial' && !isUpgrade && {
          trial_period_days: 3,
        }),
        metadata: {
          ...(user?.id ? { user_id: user.id } : {}),
          plan_type: finalPriceType,
          is_upgrade: isUpgrade.toString(),
          ...(registrationToken ? { registration_token: registrationToken } : {})
        }
      },
      metadata: {
        ...(registrationToken ? { registration_token: registrationToken } : {}),
        plan_type: finalPriceType
      }
    })

    return NextResponse.json({
      clientSecret: session.client_secret
    })

  } catch (error: any) {
    // Retourner un message d'erreur plus détaillé en développement, générique en production
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Erreur création checkout: ${error?.message || 'Erreur inconnue'}`
      : 'Erreur lors de la création de la session de paiement. Veuillez réessayer.'
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          code: error?.code,
          type: error?.type,
          statusCode: error?.statusCode
        } : undefined
      },
      { status: 500 }
    )
  }
}