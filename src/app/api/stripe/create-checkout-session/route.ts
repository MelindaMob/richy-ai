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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a9e4b4-cd70-4c3a-a316-bdd5da8b9474',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'create-checkout-session:39',message:'H1: priceType reçu',data:{priceType,isUpgrade,hasPendingReg:!!pendingRegistration},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // LOGS DE DÉBOGAGE
    console.log('[create-checkout-session] === DÉBUT ===')
    console.log('[create-checkout-session] pendingRegistration:', pendingRegistration ? 'présent' : 'absent', pendingRegistration)
    console.log('[create-checkout-session] priceType:', priceType)

    const { data: { user: existingUser } } = await supabase.auth.getUser()
    console.log('[create-checkout-session] existingUser:', existingUser ? `présent (${existingUser.id}, ${existingUser.email})` : 'absent')
    
    // Si pendingRegistration est présent, c'est une nouvelle inscription
    // Même si un utilisateur est connecté, on permet la création d'un nouveau compte
    // (l'utilisateur peut être connecté avec un autre compte)
    const isNewRegistration = !!pendingRegistration
    console.log('[create-checkout-session] isNewRegistration:', isNewRegistration, '(pendingRegistration présent:', !!pendingRegistration, ')')
    console.log('[create-checkout-session] pendingRegistration complet:', JSON.stringify(pendingRegistration, null, 2))
    
    // Si c'est une nouvelle inscription mais qu'un utilisateur est connecté, on log un avertissement
    if (isNewRegistration && existingUser) {
      console.warn('[create-checkout-session] ⚠️ Nouvelle inscription détectée mais utilisateur connecté:', existingUser.email)
      console.warn('[create-checkout-session] ⚠️ Email de la nouvelle inscription:', pendingRegistration?.email)
    }
    
    // Si ce n'est PAS une nouvelle inscription, on ne doit PAS insérer dans pending_registrations
    if (!isNewRegistration) {
      console.log('[create-checkout-session] ⚠️ Ce n\'est PAS une nouvelle inscription, on ne va PAS insérer dans pending_registrations')
    }

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
    let finalPriceType = isUpgrade ? 'direct' : (priceType || 'trial') // Fallback à 'trial' si priceType est undefined
    let registrationToken: string | null = null
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a9e4b4-cd70-4c3a-a316-bdd5da8b9474',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'create-checkout-session:78',message:'H2: finalPriceType calculé',data:{finalPriceType,priceType,isUpgrade},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    
    console.log('[create-checkout-session] finalPriceType déterminé:', finalPriceType, '(priceType:', priceType, ', isUpgrade:', isUpgrade, ')')

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
      
      console.log('[create-checkout-session] 📦 Données à insérer dans pending_registrations:', {
        token: registrationToken,
        email: email,
        hasPasswordHash: !!insertData.password_hash,
        passwordHashLength: insertData.password_hash?.length || 0,
        phone_number: phoneNumber,
        phone_verification_id: phoneVerificationId,
        plan_type: insertData.plan_type,
        expires_at: insertData.expires_at
      })
      
      const { error: pendingError, data: pendingData } = await supabase
        .from('pending_registrations')
        .insert(insertData)
        .select()

      if (pendingError) {
        console.error('[create-checkout-session] ❌ Erreur insert pending_registrations:', pendingError)
        console.error('[create-checkout-session] Détails erreur complète:', JSON.stringify({
          message: pendingError.message,
          details: pendingError.details,
          hint: pendingError.hint,
          code: pendingError.code
        }, null, 2))
        console.error('[create-checkout-session] Données qui ont causé l\'erreur:', JSON.stringify(insertData, null, 2))
        return NextResponse.json({
          error: 'Erreur lors de la préparation de l\'inscription. Réessaie.',
          details: process.env.NODE_ENV === 'development' ? pendingError.message : undefined
        }, { status: 500 })
      }

      if (!pendingData || pendingData.length === 0) {
        console.error('[create-checkout-session] ❌ Insertion réussie mais aucune donnée retournée')
        return NextResponse.json({
          error: 'Erreur lors de l\'enregistrement. Réessaie.'
        }, { status: 500 })
      }

      console.log('[create-checkout-session] ✅ Insertion réussie dans pending_registrations:', pendingData)
      console.log('[create-checkout-session] ✅ ID de l\'entrée créée:', pendingData[0]?.id)

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
        
        // IMPORTANT: Mettre à jour le profil avec stripe_customer_id pour que le middleware laisse passer
        console.log('[create-checkout-session] Mise à jour profil avec stripe_customer_id pour upgrade:', customerId)
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
          console.log('[create-checkout-session] Vérification profil avec stripe_customer_id pour upgrade:', customerId)
          const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .maybeSingle()
          
          if (!profile?.stripe_customer_id) {
            console.log('[create-checkout-session] Mise à jour profil avec stripe_customer_id (manquant):', customerId)
            await supabase.from('profiles')
              .update({ stripe_customer_id: customerId })
              .eq('id', user.id)
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
          
          // IMPORTANT: Mettre à jour le profil avec le nouveau stripe_customer_id
          console.log('[create-checkout-session] Mise à jour profil avec nouveau stripe_customer_id pour upgrade:', customerId)
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
    
    // Pour les nouvelles inscriptions, s'assurer que le customer a le bon email
    // On ne peut pas utiliser customer_email si customer est déjà fourni
    if (isNewRegistration && pendingRegistration?.email && customerId) {
      const correctEmail = pendingRegistration.email.trim().toLowerCase()
      try {
        // Récupérer le customer actuel pour vérifier son email
        const currentCustomer = await stripe.customers.retrieve(customerId) as Stripe.Customer
        if (currentCustomer.email?.toLowerCase() !== correctEmail) {
          console.log('[create-checkout-session] 📧 Mise à jour email du customer:', {
            ancien: currentCustomer.email,
            nouveau: correctEmail
          })
          // Mettre à jour l'email du customer
          await stripe.customers.update(customerId, {
            email: correctEmail
          })
          console.log('[create-checkout-session] ✅ Email du customer mis à jour')
        } else {
          console.log('[create-checkout-session] ✅ Email du customer déjà correct')
        }
      } catch (updateError: any) {
        console.error('[create-checkout-session] ❌ Erreur mise à jour email customer:', updateError)
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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a9e4b4-cd70-4c3a-a316-bdd5da8b9474',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'create-checkout-session:492',message:'H3: Metadata Stripe définies',data:{subscription_metadata_plan_type:finalPriceType,session_metadata_plan_type:finalPriceType,trial_period_days:finalPriceType==='trial'&&!isUpgrade?3:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    
    console.log('[create-checkout-session] 📋 Metadata Stripe définies:', {
      subscription_metadata: {
        plan_type: finalPriceType,
        is_upgrade: isUpgrade.toString(),
        has_user_id: !!user?.id,
        has_registration_token: !!registrationToken
      },
      session_metadata: {
        plan_type: finalPriceType,
        has_registration_token: !!registrationToken
      },
      trial_period_days: finalPriceType === 'trial' && !isUpgrade ? 3 : undefined
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
    console.error('[create-checkout-session] ❌ ERREUR COMPLÈTE:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
      statusCode: error?.statusCode,
      type: error?.type,
      raw: error
    })
    
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