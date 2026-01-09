// app/api/stripe/sync-subscription/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover'
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    // Essayer de récupérer le userId depuis le body (pour les nouvelles inscriptions)
    const body = await req.json().catch(() => ({}))
    const userIdFromBody = body.userId
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Si pas d'utilisateur connecté mais userId fourni dans le body, utiliser celui-ci
    let finalUserId: string | null = null
    if (user) {
      finalUserId = user.id
    } else if (userIdFromBody) {
      finalUserId = userIdFromBody
    } else {
      return NextResponse.json({ error: 'Non autorisé - aucune session et aucun userId fourni' }, { status: 401 })
    }
    
    if (!finalUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer la subscription depuis la DB (pour avoir le customer_id)
    // Utiliser adminSupabase pour contourner RLS
    let { data: subscription } = await adminSupabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', finalUserId)
      .maybeSingle()

    let stripeSubscription: Stripe.Subscription | null = null
    let customerId: string | null = null

    // Récupérer le customer_id depuis la DB
    if (subscription?.stripe_customer_id) {
      customerId = subscription.stripe_customer_id
    }

    // Si pas de customer_id, chercher dans Stripe
    if (!customerId) {
      // Récupérer l'email depuis le profil si user n'est pas disponible
      let userEmail: string | null = null
      if (user?.email) {
        userEmail = user.email
      } else {
        // Récupérer l'email depuis le profil
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', finalUserId)
          .maybeSingle()
        userEmail = profile?.email || null
      }
      
      let customer: Stripe.Customer | null = null
      
      // Méthode 1: Chercher le customer Stripe par email (normalisé) si email disponible
      if (userEmail) {
        const normalizedEmail = userEmail.trim().toLowerCase()
        
        const customersByEmail = await stripe.customers.list({
          email: normalizedEmail,
          limit: 100
        })

        if (customersByEmail.data.length > 0) {
          // Prendre le customer le plus récent
          customer = customersByEmail.data.sort((a, b) => b.created - a.created)[0]
        }
      }

      // Méthode 2: Si pas trouvé par email, chercher par metadata user_id
      if (!customer) {
        const allCustomers = await stripe.customers.list({
          limit: 100
        })
        
        for (const c of allCustomers.data) {
          if (c.metadata?.user_id === finalUserId) {
            customer = c
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
        } else {
          // Sinon, prendre la plus récente active/trialing
          const activeSub = sortedSubs.find(sub => 
            sub.status === 'active' || sub.status === 'trialing' || sub.status === 'incomplete'
          )
          
          if (activeSub) {
            stripeSubscription = activeSub
          } else {
            // En dernier recours, prendre la plus récente même si canceled (peut être un upgrade récent)
            stripeSubscription = sortedSubs[0]
          }
        }
      }
    }

    // Si pas trouvé et qu'on a une subscription dans la DB, essayer de la récupérer
    if (!stripeSubscription && subscription?.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
      } catch (error: any) {
        // Ignorer l'erreur
      }
    }

    if (!stripeSubscription) {
      // IMPORTANT: Même si on ne trouve pas de subscription, mettre à jour le profil avec stripe_customer_id
      // pour que le middleware laisse passer (le webhook créera la subscription plus tard)
      if (customerId) {
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', finalUserId)
      }
      
      return NextResponse.json({ 
        error: 'Aucune subscription trouvée dans Stripe. Vérifie que tu as bien complété le paiement.',
        userId: finalUserId,
        email: user?.email || 'N/A',
        customerFound: !!customerId,
        profileUpdated: !!customerId // Indique que le profil a été mis à jour
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

    // Déterminer le plan_type depuis les metadata Stripe (priorité absolue)
    // IMPORTANT: Si plan_type n'est pas dans les metadata, on doit le déduire depuis trial_end
    // et NON depuis isPremium (qui peut être incorrect)
    let finalPlanType: 'trial' | 'direct'
    
    if (planTypeFromMetadata === 'trial' || planTypeFromMetadata === 'direct') {
      // Si plan_type est explicitement défini dans les metadata, l'utiliser
      finalPlanType = planTypeFromMetadata
    } else if (subscription?.plan_type === 'trial' || subscription?.plan_type === 'direct') {
      // Si plan_type n'est pas dans les metadata mais existe dans la DB, le conserver
      // (le webhook l'a probablement déjà défini correctement)
      finalPlanType = subscription.plan_type
    } else if (hasTrialEnd) {
      // Si il y a un trial_end dans le futur, c'est un trial
      finalPlanType = 'trial'
    } else {
      // Dernier recours: déduire depuis isPremium (mais ce n'est pas fiable)
      finalPlanType = isPremium ? 'direct' : 'trial'
    }

    // Créer ou mettre à jour la subscription dans la DB
    const subscriptionData = {
      user_id: finalUserId,
      stripe_customer_id: typeof stripeSubscription.customer === 'string' 
        ? stripeSubscription.customer 
        : stripeSubscription.customer.id,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: stripeSubscription.items.data[0]?.price.id,
      status: stripeSubscription.status,
      plan_type: finalPlanType, // Utiliser le plan_type déterminé
      trial_limitations: finalPlanType === 'direct' ? null : {
        chat_messages: 5,
        validator_uses: 1,
        prompt_uses: 0,
        builder_uses: 0
      },
      trial_ends_at: finalPlanType === 'direct' ? null : (stripeSubscription.trial_end 
        ? new Date(stripeSubscription.trial_end * 1000).toISOString() 
        : null),
      current_period_end: (stripeSubscription as any).current_period_end
        ? new Date((stripeSubscription as any).current_period_end * 1000).toISOString()
        : null
    }

    // Supprimer les anciennes subscriptions pour cet utilisateur (garder seulement la plus récente)
    // Utiliser adminSupabase pour contourner RLS
    await adminSupabase.from('subscriptions')
      .delete()
      .eq('user_id', finalUserId)
      .neq('stripe_subscription_id', stripeSubscription.id)
    
    // Utiliser adminSupabase pour contourner RLS lors de l'upsert
    const { error: upsertError } = await adminSupabase
      .from('subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id'
      })
      .select()

    if (upsertError) {
      throw upsertError
    }
    
    // IMPORTANT: Mettre à jour le profil avec stripe_customer_id pour que le middleware laisse passer
    const stripeCustomerId = typeof stripeSubscription.customer === 'string' 
      ? stripeSubscription.customer 
      : stripeSubscription.customer.id
    
    if (stripeCustomerId) {
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', finalUserId)
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

