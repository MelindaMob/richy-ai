// app/api/stripe/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/admin' // Admin client

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover'
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Vérifier les variables d'environnement au démarrage
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[webhook] ERROR: SUPABASE_SERVICE_ROLE_KEY is not set!')
}
if (!webhookSecret) {
  console.error('[webhook] ERROR: STRIPE_WEBHOOK_SECRET is not set!')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      console.error('[webhook] Missing stripe-signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('[webhook] Signature verification failed:', err.message)
      return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
    }

    const supabase = createClient() // Client admin (service role)

    console.log(`[webhook] Received event: ${event.type}, id: ${event.id}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        console.log(`[webhook] checkout.session.completed - Session: ${session.id}`)
        
        if (session.subscription && typeof session.subscription === 'string') {
          const subscription = await stripe.subscriptions.retrieve(session.subscription)
          
          const userId = subscription.metadata?.user_id
          const planType = subscription.metadata?.plan_type || 'direct'
          const isUpgrade = subscription.metadata?.is_upgrade === 'true'
          
          console.log(`[webhook] Subscription metadata - userId: ${userId}, planType: ${planType}, isUpgrade: ${isUpgrade}`)
          console.log(`[webhook] Subscription status: ${subscription.status}, trial_end: ${subscription.trial_end}`)
          
          const hasTrialEnd = subscription.trial_end && subscription.trial_end > Math.floor(Date.now() / 1000)
          // C'est un trial si planType === 'trial' OU si il y a un trial_end dans le futur
          const isTrial = planType === 'trial' || (hasTrialEnd && planType !== 'direct')
          
          // C'est Premium seulement si :
          // 1. C'est un upgrade explicite
          // 2. OU planType === 'direct' ET pas de trial_end ET status === 'active'
          const isPremium = isUpgrade || (planType === 'direct' && !hasTrialEnd && subscription.status === 'active')
          
          console.log(`[webhook] planType: ${planType}, hasTrialEnd: ${hasTrialEnd}, isTrial: ${isTrial}, isPremium: ${isPremium}`)
          
          // Si c'est un upgrade ou Premium DIRECT (pas de trial), enlever les limitations
          if (isPremium && !isTrial) {
            // D'abord, supprimer les anciennes subscriptions pour cet utilisateur (garder seulement la plus récente)
            await supabase.from('subscriptions')
              .delete()
              .eq('user_id', userId)
              .neq('stripe_subscription_id', subscription.id)
            
            const { error: upsertError } = await supabase.from('subscriptions').upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              stripe_price_id: subscription.items.data[0]?.price.id,
              status: subscription.status,
              plan_type: 'direct',
              trial_limitations: null, // Enlever les limitations pour Premium
              trial_ends_at: null,
              current_period_end: (subscription as any).current_period_end
                ? new Date((subscription as any).current_period_end * 1000).toISOString()
                : null
            }, {
              onConflict: 'user_id'
            })
            
            if (upsertError) {
              console.error(`[webhook] Error upserting Premium subscription for user ${userId}:`, upsertError)
              throw upsertError
            }
            
            // Mettre à jour aussi la table profiles pour cohérence
            if (userId) {
              const { error: profileError } = await supabase.from('profiles')
                .update({
                  subscription_status: 'premium',
                  stripe_customer_id: session.customer as string,
                  stripe_subscription_id: subscription.id,
                  trial_ends_at: null
                })
                .eq('id', userId)
              
              if (profileError) {
                console.warn(`[webhook] Error updating profile for user ${userId}:`, profileError)
                // Ne pas throw, ce n'est pas critique
              }
            }
            
            console.log(`✅ ${isUpgrade ? 'Upgrade' : 'Premium subscription'} completed for user ${userId}`)
            break
          }
          
          // IMPORTANT: Le plan_type vient du metadata de la subscription
          // C'est ce que l'utilisateur a choisi sur pricing-choice
          // Si planType n'est pas défini, utiliser isTrial pour déterminer
          const finalPlanType = planType || (isTrial ? 'trial' : 'direct')
          
          // Déterminer les limitations selon le plan choisi
          // Si plan_type === 'trial', appliquer les limitations
          // Si plan_type === 'direct', pas de limitations (premium)
          const limitations = finalPlanType === 'trial' ? {
            chat_messages: 5,
            validator_uses: 1,
            prompt_uses: 0,
            builder_uses: 0
          } : null
          
          // Le status du profile dépend du plan_type choisi
          const profileStatus = finalPlanType === 'trial' ? 'trialing' : 'premium'
          
          console.log(`[webhook] Final plan_type: ${finalPlanType}, limitations:`, limitations, `profileStatus: ${profileStatus}`)
          
          // Mettre à jour la DB
          // D'abord, supprimer les anciennes subscriptions pour cet utilisateur (garder seulement la plus récente)
          await supabase.from('subscriptions')
            .delete()
            .eq('user_id', userId)
            .neq('stripe_subscription_id', subscription.id)
          
          const { error: upsertError } = await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price.id,
            status: subscription.status, // 'trialing' si trial, 'active' sinon
            plan_type: finalPlanType, // Utiliser le plan_type du metadata (choix de l'utilisateur)
            trial_limitations: limitations, // NULL si direct, limitations si trial
            trial_ends_at: subscription.trial_end 
              ? new Date(subscription.trial_end * 1000).toISOString() 
              : null,
            current_period_end: (subscription as any).current_period_end
              ? new Date((subscription as any).current_period_end * 1000).toISOString()
              : null
          }, {
            onConflict: 'user_id'
          })
          
          if (upsertError) {
            console.error(`[webhook] Error upserting subscription for user ${userId}:`, upsertError)
            throw upsertError
          }
          
          // Mettre à jour aussi la table profiles pour cohérence
          const profileUpdatePromise = userId ? supabase.from('profiles')
            .update({
              subscription_status: profileStatus,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              trial_ends_at: subscription.trial_end 
                ? new Date(subscription.trial_end * 1000).toISOString() 
                : null
            })
            .eq('id', userId) : Promise.resolve({ error: null })

          // Logger l'événement dans subscription_events
          const eventLogPromise = userId ? supabase.from('subscription_events').insert({
            user_id: userId,
            event_type: 'checkout.session.completed',
            metadata: {
              subscription_id: subscription.id,
              plan_type: finalPlanType, // Utiliser le plan_type choisi par l'utilisateur
              status: subscription.status,
              trial_ends_at: subscription.trial_end 
                ? new Date(subscription.trial_end * 1000).toISOString() 
                : null
            }
          }) : Promise.resolve({ error: null })

          // Exécuter les deux en parallèle
          const [profileResult, eventResult] = await Promise.allSettled([
            profileUpdatePromise,
            eventLogPromise
          ])

          if (profileResult.status === 'rejected' || (profileResult.status === 'fulfilled' && profileResult.value.error)) {
            const error = profileResult.status === 'rejected' ? profileResult.reason : profileResult.value.error
            console.warn(`[webhook] Error updating profile for user ${userId}:`, error)
            // Retry une fois
            if (userId) {
              await supabase.from('profiles')
                .update({
                  subscription_status: profileStatus,
                  stripe_customer_id: session.customer as string,
                  stripe_subscription_id: subscription.id,
                  trial_ends_at: subscription.trial_end 
                    ? new Date(subscription.trial_end * 1000).toISOString() 
                    : null
                })
                .eq('id', userId)
            }
          }

          if (eventResult.status === 'rejected' || (eventResult.status === 'fulfilled' && eventResult.value.error)) {
            const error = eventResult.status === 'rejected' ? eventResult.reason : eventResult.value.error
            console.warn(`[webhook] Error logging subscription event for user ${userId}:`, error)
          }
          
          console.log(`✅ Subscription ${finalPlanType} created for user ${userId} with limitations:`, limitations)
        } else {
          console.warn(`[webhook] No subscription found in session ${session.id}`)
        }
        
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        
        const userId = subscription.metadata?.user_id
        const planType = subscription.metadata?.plan_type
        const isUpgrade = subscription.metadata?.is_upgrade === 'true'
        const hasTrialEnd = subscription.trial_end && subscription.trial_end > Math.floor(Date.now() / 1000)
        
        // C'est un upgrade si :
        // 1. is_upgrade === 'true' dans les metadata
        // 2. OU plan_type === 'direct' ET pas de trial_end
        const isPremium = isUpgrade || (planType === 'direct' && !hasTrialEnd)
        
        console.log(`[webhook] subscription.updated - userId: ${userId}, planType: ${planType}, isUpgrade: ${isUpgrade}, isPremium: ${isPremium}, status: ${subscription.status}`)
        
        const subscriptionData: any = {
          status: subscription.status,
          current_period_end: (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toISOString()
            : null,
        }
        
        // Si upgrade/Premium, enlever les limitations et mettre plan_type à 'direct'
        if (isPremium) {
          subscriptionData.plan_type = 'direct'
          subscriptionData.trial_limitations = null
          subscriptionData.trial_ends_at = null
        } else if (planType === 'trial') {
          subscriptionData.plan_type = 'trial'
          subscriptionData.trial_limitations = {
            chat_messages: 5,
            validator_uses: 1,
            prompt_uses: 0,
            builder_uses: 0
          }
          subscriptionData.trial_ends_at = subscription.trial_end 
            ? new Date(subscription.trial_end * 1000).toISOString() 
            : null
        }

        const { error: updateError } = await supabase.from('subscriptions')
          .update(subscriptionData)
          .eq('stripe_subscription_id', subscription.id)
        
        if (updateError) {
          console.error(`[webhook] Error updating subscription ${subscription.id}:`, updateError)
          throw updateError
        }
        
        // Mettre à jour aussi la table profiles si upgrade
        const profileUpdatePromise = (isPremium && userId) ? supabase.from('profiles')
          .update({
            subscription_status: 'premium',
            trial_ends_at: null
          })
          .eq('id', userId) : Promise.resolve({ error: null })

        // Logger l'événement
        const eventLogPromise = userId ? supabase.from('subscription_events').insert({
          user_id: userId,
          event_type: 'customer.subscription.updated',
          metadata: {
            subscription_id: subscription.id,
            status: subscription.status,
            is_upgrade: isUpgrade,
            plan_type: isUpgrade ? 'direct' : subscriptionData.plan_type
          }
        }) : Promise.resolve({ error: null })

        const [profileResult, eventResult] = await Promise.allSettled([
          profileUpdatePromise,
          eventLogPromise
        ])

        if (profileResult.status === 'rejected' || (profileResult.status === 'fulfilled' && profileResult.value.error)) {
          const error = profileResult.status === 'rejected' ? profileResult.reason : profileResult.value.error
          console.warn(`[webhook] Error updating profile after upgrade:`, error)
        }

        if (eventResult.status === 'rejected' || (eventResult.status === 'fulfilled' && eventResult.value.error)) {
          const error = eventResult.status === 'rejected' ? eventResult.reason : eventResult.value.error
          console.warn(`[webhook] Error logging subscription event:`, error)
        }

        if (isUpgrade) {
          console.log(`✅ Subscription upgraded to Premium for subscription ${subscription.id}`)
        }
        
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id
        
        const { error: updateError } = await supabase.from('subscriptions')
          .update({ 
            status: 'canceled',
            trial_limitations: null
          })
          .eq('stripe_subscription_id', subscription.id)
        
        if (updateError) {
          console.error(`[webhook] Error canceling subscription ${subscription.id}:`, updateError)
          throw updateError
        }

        // Mettre à jour le profil de l'utilisateur
        const profileUpdatePromise = subscription.customer && typeof subscription.customer === 'string'
          ? supabase.from('profiles').update({
              subscription_status: 'canceled',
              trial_ends_at: null
            }).eq('stripe_customer_id', subscription.customer)
          : Promise.resolve({ error: null })

        // Logger l'événement
        const eventLogPromise = userId ? supabase.from('subscription_events').insert({
          user_id: userId,
          event_type: 'customer.subscription.deleted',
          metadata: {
            subscription_id: subscription.id,
            status: 'canceled'
          }
        }) : Promise.resolve({ error: null })

        const [profileResult, eventResult] = await Promise.allSettled([
          profileUpdatePromise,
          eventLogPromise
        ])

        if (profileResult.status === 'rejected' || (profileResult.status === 'fulfilled' && profileResult.value.error)) {
          const error = profileResult.status === 'rejected' ? profileResult.reason : profileResult.value.error
          console.error(`[webhook] Error updating profile for customer ${subscription.customer}:`, error)
        }

        if (eventResult.status === 'rejected' || (eventResult.status === 'fulfilled' && eventResult.value.error)) {
          const error = eventResult.status === 'rejected' ? eventResult.reason : eventResult.value.error
          console.warn(`[webhook] Error logging subscription deletion event:`, error)
        }
        
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        
        // Si c'est un paiement pour une subscription (cycle normal ou upgrade)
        const subscriptionId = (invoice as any).subscription
        let subscriptionIdStr: string | null = null
        let paymentUserId = invoice.metadata?.user_id
        
        if (subscriptionId && (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'subscription_update')) {
          // Récupérer la subscription pour vérifier si c'est un upgrade
          subscriptionIdStr = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id || null
          if (subscriptionIdStr) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionIdStr)
            
            // Récupérer user_id depuis la subscription si pas dans metadata
            if (!paymentUserId) {
              paymentUserId = subscription.metadata?.user_id
            }
            
            const isUpgrade = subscription.metadata?.is_upgrade === 'true' || 
                             (!subscription.trial_end && subscription.status === 'active')
            
            // Si c'est un upgrade ou si le trial est terminé, enlever les limitations
            if (isUpgrade || invoice.billing_reason === 'subscription_cycle') {
              const { error: updateError } = await supabase.from('subscriptions')
                .update({ 
                  trial_limitations: null,
                  plan_type: 'direct',
                  status: 'active',
                  trial_ends_at: null
                })
                .eq('stripe_customer_id', invoice.customer)
              
              if (updateError) {
                console.error(`[webhook] Error updating subscription after payment:`, updateError)
                throw updateError
              }
              
              // Mettre à jour aussi la table profiles
              if (paymentUserId) {
                const { error: profileError } = await supabase.from('profiles')
                  .update({
                    subscription_status: 'premium',
                    trial_ends_at: null
                  })
                  .eq('id', paymentUserId)
                
                if (profileError) {
                  console.warn(`[webhook] Error updating profile after payment:`, profileError)
                }
              }
              
              console.log(`✅ Payment succeeded - ${isUpgrade ? 'Upgrade' : 'Subscription cycle'} - Removed trial limitations`)
            }
          }
        }
        
        // Logger le paiement (utiliser invoice.id si payment_intent n'existe pas)
        const paymentIntentId = typeof (invoice as any).payment_intent === 'string' 
          ? (invoice as any).payment_intent 
          : (invoice as any).payment_intent?.id || null
        
        // Insérer le paiement (même pour 0€ pour avoir un historique complet)
        if (paymentUserId) {
          const paymentData = {
            user_id: paymentUserId,
            stripe_payment_intent_id: paymentIntentId || `invoice_${invoice.id}`,
            amount: invoice.amount_paid / 100, // Peut être 0 pour les trials
            currency: invoice.currency,
            status: invoice.amount_paid > 0 ? 'succeeded' : 'trial'
          }

          const paymentInsertPromise = supabase.from('payments').insert(paymentData)
          
          // Logger aussi l'événement
          const eventLogPromise = supabase.from('subscription_events').insert({
            user_id: paymentUserId,
            event_type: 'invoice.payment_succeeded',
            metadata: {
              invoice_id: invoice.id,
              amount: invoice.amount_paid / 100,
              currency: invoice.currency,
              billing_reason: invoice.billing_reason,
              subscription_id: subscriptionIdStr
            }
          })

          const [paymentResult, eventResult] = await Promise.allSettled([
            paymentInsertPromise,
            eventLogPromise
          ])

          if (paymentResult.status === 'rejected' || (paymentResult.status === 'fulfilled' && paymentResult.value.error)) {
            const error = paymentResult.status === 'rejected' ? paymentResult.reason : paymentResult.value.error
            console.error(`[webhook] Error inserting payment:`, error)
            // Retry une fois
            try {
              await supabase.from('payments').insert(paymentData)
            } catch (retryError) {
              console.error(`[webhook] Retry failed for payment:`, retryError)
            }
          } else {
            console.log(`✅ Payment logged for user ${paymentUserId}: ${invoice.amount_paid / 100} ${invoice.currency} (${paymentData.status})`)
          }

          if (eventResult.status === 'rejected' || (eventResult.status === 'fulfilled' && eventResult.value.error)) {
            const error = eventResult.status === 'rejected' ? eventResult.reason : eventResult.value.error
            console.warn(`[webhook] Error logging payment event:`, error)
          }
        } else {
          console.warn(`[webhook] No user_id found for invoice ${invoice.id}, cannot log payment`)
        }
        
        break
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
    
  } catch (error: any) {
    console.error('[webhook] Unhandled error:', error)
    // Retourner 200 pour éviter que Stripe réessaie indéfiniment
    // Mais logger l'erreur pour debugging
    return NextResponse.json({ 
      received: true, 
      error: error.message 
    }, { status: 200 })
  }
}
