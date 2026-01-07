// app/api/stripe/sync-subscription/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover'
})

export async function POST(req: NextRequest) {
  console.log('[sync-subscription] POST request received')
  
  try {
    const supabase = await createClient()
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('[sync-subscription] Auth error:', authError)
      return NextResponse.json({ error: 'Erreur d\'authentification', details: authError.message }, { status: 401 })
    }
    
    if (!user) {
      console.error('[sync-subscription] No user found')
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    
    console.log('[sync-subscription] User authenticated:', user.id, user.email)

    // Récupérer la subscription depuis la DB (pour avoir le customer_id)
    let { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    let stripeSubscription: Stripe.Subscription | null = null
    let customerId: string | null = null

    // Récupérer le customer_id depuis la DB
    if (subscription?.stripe_customer_id) {
      customerId = subscription.stripe_customer_id
      console.log(`[sync-subscription] Using customer_id from DB: ${customerId}`)
    }

    // Si pas de customer_id, chercher dans Stripe
    if (!customerId) {
      console.log(`[sync-subscription] No customer_id in DB, searching in Stripe for user ${user.id}, email: ${user.email}`)
      
      let customer: Stripe.Customer | null = null
      
      // Méthode 1: Chercher le customer Stripe par email (normalisé)
      const normalizedEmail = user.email!.trim().toLowerCase()
      console.log(`[sync-subscription] Searching for customer with email: ${normalizedEmail}`)
      
      const customersByEmail = await stripe.customers.list({
        email: normalizedEmail,
        limit: 100
      })

      console.log(`[sync-subscription] Found ${customersByEmail.data.length} customer(s) by email`)

      if (customersByEmail.data.length > 0) {
        // Prendre le customer le plus récent
        customer = customersByEmail.data.sort((a, b) => b.created - a.created)[0]
        console.log(`[sync-subscription] Found customer by email: ${customer.id}, created: ${new Date(customer.created * 1000).toISOString()}`)
      }

      // Méthode 2: Si pas trouvé par email, chercher par metadata user_id
      if (!customer) {
        console.log(`[sync-subscription] Customer not found by email, searching by metadata user_id`)
        const allCustomers = await stripe.customers.list({
          limit: 100
        })
        
        for (const c of allCustomers.data) {
          if (c.metadata?.user_id === user.id) {
            customer = c
            console.log(`[sync-subscription] Found customer by metadata user_id: ${customer.id}`)
            break
          }
        }
      }

      if (customer) {
        customerId = customer.id
      }
    }

    // Si on a un customer_id, chercher TOUTES les subscriptions (même canceled)
    // et prendre la plus récente qui correspond à un upgrade ou qui est active
    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100
      })

      console.log(`[sync-subscription] Found ${subscriptions.data.length} subscription(s) for customer ${customerId}`)

      if (subscriptions.data.length > 0) {
        // Trier toutes les subscriptions par created (plus récent en premier)
        const sortedSubs = subscriptions.data.sort((a, b) => b.created - a.created)
        
        // Chercher d'abord une subscription active/trialing avec upgrade ou plan_type direct
        const activeUpgrade = sortedSubs.find(sub => 
          (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'incomplete') &&
          (sub.metadata?.is_upgrade === 'true' || sub.metadata?.plan_type === 'direct')
        )
        
        if (activeUpgrade) {
          stripeSubscription = activeUpgrade
          console.log(`[sync-subscription] Using active upgrade subscription: ${stripeSubscription.id}, status: ${stripeSubscription.status}`)
        } else {
          // Sinon, prendre la plus récente active/trialing
          const activeSub = sortedSubs.find(sub => 
            sub.status === 'active' || sub.status === 'trialing' || sub.status === 'incomplete'
          )
          
          if (activeSub) {
            stripeSubscription = activeSub
            console.log(`[sync-subscription] Using most recent active subscription: ${stripeSubscription.id}, status: ${stripeSubscription.status}`)
          } else {
            // En dernier recours, prendre la plus récente même si canceled (peut être un upgrade récent)
            stripeSubscription = sortedSubs[0]
            console.log(`[sync-subscription] Using most recent subscription (may be canceled): ${stripeSubscription.id}, status: ${stripeSubscription.status}`)
          }
        }
      }
    }

    // Si pas trouvé et qu'on a une subscription dans la DB, essayer de la récupérer
    if (!stripeSubscription && subscription?.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
        console.log(`[sync-subscription] Retrieved subscription from DB: ${stripeSubscription.id}, status: ${stripeSubscription.status}`)
      } catch (error: any) {
        console.error(`[sync-subscription] Error retrieving subscription ${subscription.stripe_subscription_id}:`, error)
      }
    }

    if (!stripeSubscription) {
      console.error(`[sync-subscription] No subscription found in Stripe for user ${user.id}, email: ${user.email}`)
      return NextResponse.json({ 
        error: 'Aucune subscription trouvée dans Stripe. Vérifie que tu as bien complété le paiement.',
        userId: user.id,
        email: user.email,
        customerFound: !!customerId
      }, { status: 404 })
    }

    // Vérifier si c'est Premium
    const hasTrialEnd = stripeSubscription.trial_end && stripeSubscription.trial_end > Math.floor(Date.now() / 1000)
    const planTypeFromMetadata = stripeSubscription.metadata?.plan_type
    const isUpgradeFromMetadata = stripeSubscription.metadata?.is_upgrade === 'true'
    
    // C'est Premium si :
    // 1. C'est un upgrade explicite (is_upgrade === 'true')
    // 2. OU plan_type === 'direct' dans les metadata
    // 3. OU status === 'active' ET pas de trial_end
    const isPremium = isUpgradeFromMetadata || 
                     planTypeFromMetadata === 'direct' ||
                     (!hasTrialEnd && stripeSubscription.status === 'active' && planTypeFromMetadata !== 'trial')

    console.log(`[sync-subscription] User: ${user.id}, Status: ${stripeSubscription.status}, Trial end: ${stripeSubscription.trial_end}`)
    console.log(`[sync-subscription] Metadata - plan_type: ${planTypeFromMetadata}, is_upgrade: ${isUpgradeFromMetadata}`)
    console.log(`[sync-subscription] Is Premium: ${isPremium}`)

    // Créer ou mettre à jour la subscription dans la DB
    const subscriptionData = {
      user_id: user.id,
      stripe_customer_id: typeof stripeSubscription.customer === 'string' 
        ? stripeSubscription.customer 
        : stripeSubscription.customer.id,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: stripeSubscription.items.data[0]?.price.id,
      status: stripeSubscription.status,
      plan_type: isPremium ? 'direct' : 'trial',
      trial_limitations: isPremium ? null : {
        chat_messages: 5,
        validator_uses: 1,
        prompt_uses: 0,
        builder_uses: 0
      },
      trial_ends_at: stripeSubscription.trial_end 
        ? new Date(stripeSubscription.trial_end * 1000).toISOString() 
        : null,
      current_period_end: (stripeSubscription as any).current_period_end
        ? new Date((stripeSubscription as any).current_period_end * 1000).toISOString()
        : null
    }

    // Supprimer les anciennes subscriptions pour cet utilisateur (garder seulement la plus récente)
    await supabase.from('subscriptions')
      .delete()
      .eq('user_id', user.id)
      .neq('stripe_subscription_id', stripeSubscription.id)
    
    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id'
      })

    if (upsertError) {
      console.error('[sync-subscription] Error upserting subscription:', upsertError)
      throw upsertError
    }

    return NextResponse.json({ 
      success: true,
      isPremium,
      status: stripeSubscription.status,
      plan_type: isPremium ? 'direct' : 'trial',
      trial_ends_at: stripeSubscription.trial_end 
        ? new Date(stripeSubscription.trial_end * 1000).toISOString() 
        : null,
      message: subscription ? 'Subscription updated' : 'Subscription created from Stripe'
    })

  } catch (error: any) {
    console.error('[sync-subscription] Unhandled error:', error)
    console.error('[sync-subscription] Error stack:', error.stack)
    
    return NextResponse.json(
      { 
        error: 'Erreur lors de la synchronisation', 
        details: error.message || 'Erreur inconnue',
        type: error.name || 'UnknownError'
      },
      { status: 500 }
    )
  }
}

