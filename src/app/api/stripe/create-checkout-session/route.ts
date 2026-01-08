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
  // Si la clé est manquante ou invalide, on retourne le mot de passe en clair (fallback) mais on loggue
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    console.warn('[create-checkout-session] REGISTRATION_ENCRYPTION_KEY manquante ou trop courte, fallback en clair')
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

    // LOGS DE DÉBOGAGE
    console.log('[create-checkout-session] === DÉBUT ===')
    console.log('[create-checkout-session] pendingRegistration:', pendingRegistration ? 'présent' : 'absent', pendingRegistration)
    console.log('[create-checkout-session] priceType:', priceType)

    const { data: { user: existingUser } } = await supabase.auth.getUser()
    console.log('[create-checkout-session] existingUser:', existingUser ? `présent (${existingUser.id})` : 'absent')
    
    const isNewRegistration = !!pendingRegistration && !existingUser
    console.log('[create-checkout-session] isNewRegistration:', isNewRegistration)

    // Vérifier NEXT_PUBLIC_APP_URL
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error('[create-checkout-session] NEXT_PUBLIC_APP_URL non défini')
      return NextResponse.json({ 
        error: 'Configuration serveur manquante. Veuillez contacter le support.' 
      }, { status: 500 })
    }

    let user = existingUser
    let customerId: string | undefined
    let existingSub: any = null
    let finalPriceType = isUpgrade ? 'direct' : priceType
    let registrationToken: string | null = null

    if (isNewRegistration) {
      console.log('[create-checkout-session] ✅ Entrée dans le bloc isNewRegistration')
      const registration = pendingRegistration || {}

      // Validations de base
      const email = (registration.email || '').trim().toLowerCase()
      const password = registration.password
      const phoneNumber = registration.phone_number
      const phoneVerificationId = registration.phone_verification_id

      console.log('[create-checkout-session] Données extraites:', {
        email: email || 'VIDE',
        emailLength: email?.length || 0,
        emailFromRegistration: registration.email || 'VIDE',
        password: password ? 'présent' : 'absent',
        phoneNumber: phoneNumber ? 'présent' : 'absent',
        phoneVerificationId: phoneVerificationId ? 'présent' : 'absent'
      })

      if (!email || !password || !phoneNumber || !phoneVerificationId) {
        console.error('[create-checkout-session] ❌ Données incomplètes:', {
          email: !!email,
          password: !!password,
          phoneNumber: !!phoneNumber,
          phoneVerificationId: !!phoneVerificationId
        })
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
        console.log('[create-checkout-session] Email déjà utilisé dans profiles:', email)
        return NextResponse.json({ 
          error: 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.',
          emailAlreadyUsed: true
        }, { status: 400 })
      }

      // Vérifier email dans auth.users via admin
      const { data: usersList, error: listError } = await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      })

      if (listError) {
        console.error('[create-checkout-session] Erreur vérif email admin:', listError)
      }

      const emailExistsInAuth = usersList?.users?.some(u => u.email?.toLowerCase() === email)
      if (emailExistsInAuth) {
        console.log('[create-checkout-session] Email déjà utilisé dans auth.users:', email)
        return NextResponse.json({ 
          error: 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.',
          emailAlreadyUsed: true
        }, { status: 400 })
      }

      // Vérifier phone_verifications
      const { data: verification } = await supabase
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
      const { encrypted: encryptedPassword, usedFallback } = encryptPassword(password)
      if (usedFallback) {
        console.warn('[create-checkout-session] Password stocké en clair temporairement (clé manquante)')
      }

      // S'assurer que encrypted n'est jamais null/undefined
      const encrypted = encryptedPassword || password
      if (!encrypted) {
        console.error('[create-checkout-session] ❌ encrypted est null/undefined après fallback')
        return NextResponse.json({
          error: 'Erreur lors du traitement du mot de passe. Réessaie.'
        }, { status: 500 })
      }

      // Créer un token de registration et insérer dans pending_registrations
      registrationToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      console.log('[create-checkout-session] 🚀 Tentative d\'insertion dans pending_registrations')
      console.log('[create-checkout-session] password_hash à insérer:', encrypted ? 'présent (' + encrypted.length + ' chars)' : 'VIDE')
      
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
      
      const { error: pendingError, data: pendingData } = await supabase
        .from('pending_registrations')
        .insert(insertData)
        .select()

      if (pendingError) {
        console.error('[create-checkout-session] ❌ Erreur insert pending_registrations:', pendingError)
        console.error('[create-checkout-session] Détails erreur:', {
          message: pendingError.message,
          details: pendingError.details,
          hint: pendingError.hint,
          code: pendingError.code
        })
        return NextResponse.json({
          error: 'Erreur lors de la préparation de l\'inscription. Réessaie.'
        }, { status: 500 })
      }

      console.log('[create-checkout-session] ✅ Insertion réussie dans pending_registrations:', pendingData)

      // Vérifier si un customer avec cet email existe déjà dans Stripe
      console.log('[create-checkout-session] 🔍 Vérification customer Stripe existant pour:', email)
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 5
      })

      console.log('[create-checkout-session] Customers Stripe trouvés avec cet email:', existingCustomers.data.length)
      if (existingCustomers.data.length > 0) {
        existingCustomers.data.forEach((c, idx) => {
          console.log(`[create-checkout-session] Customer ${idx + 1}:`, {
            id: c.id,
            email: c.email,
            created: new Date(c.created * 1000).toISOString(),
            metadata: c.metadata
          })
        })
      }

      // Créer un customer Stripe avec uniquement l'email
      console.log('[create-checkout-session] 🚀 Création client Stripe pour pending_registration')
      console.log('[create-checkout-session] Email utilisé pour customer Stripe:', email)
      const customer = await stripe.customers.create({
        email,
        metadata: {
          registration_token: registrationToken
        },
        balance: 0
      })
      customerId = customer.id
      console.log('[create-checkout-session] ✅ Client Stripe créé:', {
        customerId,
        email: customer.email,
        emailMatch: customer.email === email ? '✅ MATCH' : '❌ DIFFÉRENT',
        created: new Date(customer.created * 1000).toISOString()
      })
    } else {
      console.log('[create-checkout-session] ⚠️ isNewRegistration est false, utilisation du flux utilisateur existant')
      if (!existingUser) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
      user = existingUser

      // Check si déjà abonné
      const { data: existingSubData } = await supabase
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
            console.log('[create-checkout-session] Annulation de l\'ancienne subscription:', existingSub.stripe_subscription_id)
            await stripe.subscriptions.cancel(existingSub.stripe_subscription_id, {
              prorate: false,
              invoice_now: false
            })
            console.log('[create-checkout-session] ✅ Ancienne subscription annulée')
          } else {
            console.log('[create-checkout-session] ⚠️ Ancienne subscription déjà annulée ou inexistante, on continue')
          }
        } catch (cancelError: any) {
          // Si la subscription n'existe plus dans Stripe (404), c'est OK, on continue
          if (cancelError?.code === 'resource_missing' || cancelError?.statusCode === 404) {
            console.log('[create-checkout-session] ⚠️ Ancienne subscription n\'existe plus dans Stripe, on continue:', existingSub.stripe_subscription_id)
          } else {
            console.error('[create-checkout-session] ❌ Erreur lors de l\'annulation de l\'ancienne subscription:', cancelError)
            // Ne pas bloquer, on continue quand même
          }
        }
      }

      // Créer ou récupérer le customer Stripe
      customerId = existingSub?.stripe_customer_id
      if (!customerId) {
        console.log('[create-checkout-session] Création du client Stripe pour user:', user.id)
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            user_id: user.id
          },
          balance: 0
        })
        customerId = customer.id

        await supabase.from('subscriptions').upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: 'pending'
        }, {
          onConflict: 'user_id'
        })
      } else {
        try {
          const customer = await stripe.customers.retrieve(customerId)
          if ((customer as Stripe.Customer).deleted) {
            throw new Error('Customer deleted')
          }

          if ((customer as any).balance !== 0) {
            await stripe.customers.update(customerId, { balance: 0 })
          }
        } catch (error: any) {
          console.log(`[create-checkout-session] Customer ${customerId} not found in Stripe, creating new one`)
          const customer = await stripe.customers.create({
            email: user.email!,
            metadata: {
              user_id: user.id
            },
            balance: 0
          })
          customerId = customer.id

          await supabase.from('subscriptions').upsert({
            user_id: user.id,
            stripe_customer_id: customerId,
            status: existingSub?.status || 'pending'
          })
        }
      }
    }

    // Utiliser le même Price ID pour les deux (49€/mois)
    // La différence sera dans subscription_data.trial_period_days
    const priceId = process.env.STRIPE_PRICE_DIRECT_ID

    if (!priceId) {
      console.error('[create-checkout-session] STRIPE_PRICE_DIRECT_ID non défini')
      return NextResponse.json({ 
        error: 'Configuration Stripe manquante. Veuillez contacter le support.' 
      }, { status: 500 })
    }

    // Vérifier le customer avant de créer la session
    if (customerId) {
      try {
        const customerCheck = await stripe.customers.retrieve(customerId)
        console.log('[create-checkout-session] 🔍 Customer vérifié avant session:', {
          id: customerCheck.id,
          email: (customerCheck as Stripe.Customer).email,
          deleted: (customerCheck as Stripe.Customer).deleted || false
        })
      } catch (err) {
        console.error('[create-checkout-session] Erreur vérification customer:', err)
      }
    }

    // Créer la session (pour embedded checkout)
    console.log('[create-checkout-session] 🚀 Création session checkout avec customerId:', customerId)
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
    
    // Récupérer le customer depuis la session pour vérifier l'email
    let sessionCustomerEmail = 'N/A'
    if (session.customer && typeof session.customer === 'string') {
      try {
        const sessionCustomer = await stripe.customers.retrieve(session.customer)
        sessionCustomerEmail = (sessionCustomer as Stripe.Customer).email || 'N/A'
      } catch (err) {
        console.error('[create-checkout-session] Erreur récupération customer depuis session:', err)
      }
    }

    console.log(`[create-checkout-session] Session created: ${session.id}, plan_type: ${finalPriceType}, is_upgrade: ${isUpgrade}, registration_token: ${registrationToken}`)
    console.log(`[create-checkout-session] Email dans session customer: ${sessionCustomerEmail}`)

    return NextResponse.json({
      clientSecret: session.client_secret
    })

  } catch (error: any) {
    console.error('Create checkout error:', error)
    return NextResponse.json(
      { error: 'Erreur création checkout' },
      { status: 500 }
    )
  }
}