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
    
    // Essayer de récupérer le userId depuis le body (pour les nouvelles inscriptions)
    const body = await req.json().catch(() => ({}))
    const userIdFromBody = body.userId
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Si pas d'utilisateur connecté mais userId fourni dans le body, utiliser celui-ci
    let finalUserId: string | null = null
    if (user) {
      finalUserId = user.id
      console.log('[sync-subscription] 🔴 User authenticated:', {
        user_id: user.id,
        email: user.email,
        session_active: true
      })
    } else if (userIdFromBody) {
      finalUserId = userIdFromBody
      console.log('[sync-subscription] ⚠️ Pas de session active, utilisation userId depuis body:', userIdFromBody)
    } else {
      console.error('[sync-subscription] ❌ No user found and no userId in body')
      return NextResponse.json({ error: 'Non autorisé - aucune session et aucun userId fourni' }, { status: 401 })
    }
    
    if (!finalUserId) {
      console.error('[sync-subscription] No user found')
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer la subscription depuis la DB (pour avoir le customer_id)
    let { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', finalUserId)
      .maybeSingle()
    
    // #region agent log
    console.log('[sync-subscription] 🔴 Subscription existante dans DB:', subscription ? {
      plan_type: subscription.plan_type,
      status: subscription.status,
      stripe_subscription_id: subscription.stripe_subscription_id
    } : 'aucune')
    // #endregion

    let stripeSubscription: Stripe.Subscription | null = null
    let customerId: string | null = null

    // Récupérer le customer_id depuis la DB
    if (subscription?.stripe_customer_id) {
      customerId = subscription.stripe_customer_id
      console.log(`[sync-subscription] Using customer_id from DB: ${customerId}`)
    }

    // Si pas de customer_id, chercher dans Stripe
    if (!customerId) {
      console.log(`[sync-subscription] No customer_id in DB, searching in Stripe for user ${finalUserId}`)
      
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
      }

      // Méthode 2: Si pas trouvé par email, chercher par metadata user_id
      if (!customer) {
        console.log(`[sync-subscription] Customer not found by email, searching by metadata user_id`)
        const allCustomers = await stripe.customers.list({
          limit: 100
        })
        
        for (const c of allCustomers.data) {
          if (c.metadata?.user_id === finalUserId) {
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
      console.error(`[sync-subscription] No subscription found in Stripe for user ${finalUserId}`)
      
      // IMPORTANT: Même si on ne trouve pas de subscription, mettre à jour le profil avec stripe_customer_id
      // pour que le middleware laisse passer (le webhook créera la subscription plus tard)
      if (customerId) {
        console.log('[sync-subscription] Subscription non trouvée mais customerId existe, mise à jour profil:', customerId)
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', finalUserId)
        
        if (profileUpdateError) {
          console.error('[sync-subscription] Erreur mise à jour profil avec stripe_customer_id:', profileUpdateError)
        } else {
          console.log('[sync-subscription] ✅ Profil mis à jour avec stripe_customer_id (subscription pas encore disponible)')
        }
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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a9e4b4-cd70-4c3a-a316-bdd5da8b9474',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync-subscription:174',message:'H5/H6: Metadata sync-subscription',data:{planTypeFromMetadata,isUpgradeFromMetadata,hasTrialEnd,subscription_status:stripeSubscription.status,trial_end:stripeSubscription.trial_end},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    
    // C'est Premium si :
    // 1. C'est un upgrade explicite (is_upgrade === 'true')
    // 2. OU plan_type === 'direct' dans les metadata
    // 3. OU status === 'active' ET pas de trial_end
    const isPremium = isUpgradeFromMetadata || 
                     planTypeFromMetadata === 'direct' ||
                     (!hasTrialEnd && stripeSubscription.status === 'active' && planTypeFromMetadata !== 'trial')

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a9e4b4-cd70-4c3a-a316-bdd5da8b9474',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync-subscription:183',message:'H5/H6: isPremium calculé',data:{isPremium,isUpgradeFromMetadata,planTypeIsDirect:planTypeFromMetadata==='direct',condition3:!hasTrialEnd&&stripeSubscription.status==='active'&&planTypeFromMetadata!=='trial'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion

    console.log(`[sync-subscription] User: ${finalUserId}, Status: ${stripeSubscription.status}, Trial end: ${stripeSubscription.trial_end}`)
    console.log(`[sync-subscription] Metadata - plan_type: ${planTypeFromMetadata}, is_upgrade: ${isUpgradeFromMetadata}`)
    console.log(`[sync-subscription] Is Premium: ${isPremium}`)

    // Déterminer le plan_type depuis les metadata Stripe (priorité absolue)
    // IMPORTANT: Si plan_type n'est pas dans les metadata, on doit le déduire depuis trial_end
    // et NON depuis isPremium (qui peut être incorrect)
    let finalPlanType: 'trial' | 'direct'
    
    if (planTypeFromMetadata === 'trial' || planTypeFromMetadata === 'direct') {
      // Si plan_type est explicitement défini dans les metadata, l'utiliser
      finalPlanType = planTypeFromMetadata
      console.log(`[sync-subscription] ✅ Plan type depuis metadata: ${finalPlanType}`)
    } else if (subscription?.plan_type === 'trial' || subscription?.plan_type === 'direct') {
      // Si plan_type n'est pas dans les metadata mais existe dans la DB, le conserver
      // (le webhook l'a probablement déjà défini correctement)
      finalPlanType = subscription.plan_type
      console.log(`[sync-subscription] ⚠️ plan_type manquant dans metadata, conservation du plan_type existant dans DB: ${finalPlanType}`)
    } else if (hasTrialEnd) {
      // Si il y a un trial_end dans le futur, c'est un trial
      finalPlanType = 'trial'
      console.log(`[sync-subscription] ⚠️ plan_type manquant dans metadata, déduit depuis trial_end (futur): ${finalPlanType}`)
    } else {
      // Dernier recours: déduire depuis isPremium (mais ce n'est pas fiable)
      finalPlanType = isPremium ? 'direct' : 'trial'
      console.log(`[sync-subscription] ⚠️ plan_type déduit depuis isPremium (dernier recours): ${finalPlanType}`)
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a9e4b4-cd70-4c3a-a316-bdd5da8b9474',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync-subscription:203',message:'H5/H6: finalPlanType déterminé',data:{finalPlanType,planTypeFromMetadata,isPremium},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    
    console.log(`[sync-subscription] Plan type final: ${finalPlanType} (metadata: ${planTypeFromMetadata}, isPremium: ${isPremium})`)

    // Créer ou mettre à jour la subscription dans la DB
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a9e4b4-cd70-4c3a-a316-bdd5da8b9474',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync-subscription:217',message:'H5: subscriptionData avant insertion',data:{plan_type:finalPlanType,status:stripeSubscription.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    
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
    await supabase.from('subscriptions')
      .delete()
      .eq('user_id', finalUserId)
      .neq('stripe_subscription_id', stripeSubscription.id)
    
    // #region agent log
    console.log('[sync-subscription] 🔴 AVANT UPSERT - subscriptionData:', JSON.stringify(subscriptionData, null, 2))
    console.log('[sync-subscription] 🔴 plan_type qui sera inséré:', subscriptionData.plan_type)
    // #endregion
    
    const { error: upsertError, data: upsertedData } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id'
      })
      .select()

    // #region agent log
    console.log('[sync-subscription] 🔴 APRÈS UPSERT - Données retournées:', JSON.stringify(upsertedData, null, 2))
    if (upsertedData && upsertedData.length > 0) {
      console.log('[sync-subscription] 🔴 plan_type dans la DB après upsert:', upsertedData[0]?.plan_type)
      console.log('[sync-subscription] 🔴 user_id dans la DB après upsert:', upsertedData[0]?.user_id)
    } else {
      console.log('[sync-subscription] ⚠️ Aucune donnée retournée par l\'upsert !')
    }
    // #endregion

    if (upsertError) {
      console.error('[sync-subscription] ❌ Error upserting subscription:', upsertError)
      throw upsertError
    }
    
    // Vérifier que la subscription a bien été insérée en la relisant
    const { data: verifySubscription, error: verifyError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', finalUserId)
      .maybeSingle()
    
    // #region agent log
    console.log('[sync-subscription] 🔴 VÉRIFICATION POST-UPSERT:', {
      subscription_found: !!verifySubscription,
      plan_type: verifySubscription?.plan_type,
      user_id: verifySubscription?.user_id,
      verify_error: verifyError?.message
    })
    // #endregion

    // IMPORTANT: Mettre à jour le profil avec stripe_customer_id pour que le middleware laisse passer
    const stripeCustomerId = typeof stripeSubscription.customer === 'string' 
      ? stripeSubscription.customer 
      : stripeSubscription.customer.id
    
    if (stripeCustomerId) {
      console.log('[sync-subscription] Mise à jour profil avec stripe_customer_id:', stripeCustomerId)
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', finalUserId)
      
      if (profileUpdateError) {
        console.error('[sync-subscription] Erreur mise à jour profil avec stripe_customer_id:', profileUpdateError)
        // Ne pas bloquer, on continue
      } else {
        console.log('[sync-subscription] ✅ Profil mis à jour avec stripe_customer_id')
      }
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

