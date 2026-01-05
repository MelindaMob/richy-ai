// lib/check-limits.ts

import { createClient } from '@/lib/supabase/server'

export async function checkUsageLimits(
  userId: string,
  agentType: 'chat' | 'validator' | 'prompt' | 'builder'
) {
  const supabase = await createClient()
  
  // 1. Récupérer subscription depuis subscriptions table
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle() // Utiliser maybeSingle() au lieu de single() pour éviter les erreurs

  // Debug log
  console.log(`[checkUsageLimits] User: ${userId}, Agent: ${agentType}`)
  console.log(`[checkUsageLimits] Subscription:`, JSON.stringify(subscription, null, 2))
  console.log(`[checkUsageLimits] Error:`, subError)

  // Pas de subscription
  if (!subscription || subError) {
    console.log(`[checkUsageLimits] No subscription found or error:`, subError?.message)
    return {
      allowed: false,
      reason: 'NO_SUBSCRIPTION',
      message: 'Commence ton essai gratuit ! 🚀'
    }
  }

  // Vérifier le status
  if (subscription.status === 'canceled' || subscription.status === 'past_due') {
    return {
      allowed: false,
      reason: 'SUBSCRIPTION_INVALID',
      message: 'Ton abonnement a expiré. Renouvelle-le ! 💳'
    }
  }

  // 2. Si plan_type === 'trial', forcer les limitations même si trial_limitations est NULL
  const isTrialPlan = subscription.plan_type === 'trial'
  
  console.log(`[checkUsageLimits] plan_type: ${subscription.plan_type}, isTrialPlan: ${isTrialPlan}`)
  console.log(`[checkUsageLimits] trial_limitations:`, subscription.trial_limitations)
  
  // Si pas de trial_limitations ET que ce n'est PAS un trial → accès illimité
  if (!subscription.trial_limitations && !isTrialPlan) {
    console.log(`[checkUsageLimits] No limitations, returning unlimited`)
    return { 
      allowed: true, 
      unlimited: true 
    }
  }
  
  let limits: {
    chat_messages: number;
    validator_uses: number;
    prompt_uses: number;
    builder_uses: number;
  };

  // Si c'est un trial mais que trial_limitations est NULL, utiliser les limitations par défaut
  if (isTrialPlan && !subscription.trial_limitations) {
    console.log(`[checkUsageLimits] Trial plan without limitations, using defaults`)
    limits = {
      chat_messages: 5,
      validator_uses: 1,
      prompt_uses: 0,
      builder_uses: 0
    };
  } else if (subscription.trial_limitations) {
    // Si trial_limitations existe, utiliser celles-ci
    limits = subscription.trial_limitations as typeof limits;
  } else {
    // Cas inattendu, devrait être géré par le "unlimited" ou "no subscription"
    console.error(`[checkUsageLimits] Unexpected state: subscription exists but no limitations and not a trial plan.`)
    return {
      allowed: false,
      reason: 'UNKNOWN_LIMIT_STATE',
      message: 'Erreur de configuration des limites. Contacte le support.'
    }
  }

  const limitKey: keyof typeof limits = agentType === 'chat' ? 'chat_messages' : `${agentType}_uses` as keyof typeof limits
  const maxAllowed = limits[limitKey] || 0

  console.log(`[checkUsageLimits] Max allowed for ${agentType}: ${maxAllowed}`)

  // Agent bloqué (limite à 0)
  if (maxAllowed === 0) {
    console.log(`[checkUsageLimits] Feature locked (maxAllowed = 0)`)
    return {
      allowed: false,
      reason: 'FEATURE_LOCKED',
      message: `${agentType} est réservé aux membres Premium ! 👑`
    }
  }

  // Récupérer usage_count depuis usage_tracking pour aujourd'hui
  const today = new Date().toISOString().split('T')[0]
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('usage_count')
    .eq('user_id', userId)
    .eq('agent_type', agentType)
    .eq('usage_date', today)
    .maybeSingle() // Changer de .single() à .maybeSingle()

  const currentCount = usage?.usage_count || 0
  console.log(`[checkUsageLimits] Current usage: ${currentCount}/${maxAllowed}`)

  // Vérifier si la limite est atteinte
  if (currentCount >= maxAllowed) {
    console.log(`[checkUsageLimits] Limit reached!`)
    return {
      allowed: false,
      reason: 'LIMIT_REACHED',
      remaining: 0,
      message: `Limite atteinte ! Passe au Premium pour continuer 🚀`
    }
  }

  // 4. Si allowed, incrémenter usage_tracking (update ou insert)
  const newCount = currentCount + 1
  
  // Essayer d'abord un update, puis insert si ça échoue
  const { data: existingUsage } = await supabase
    .from('usage_tracking')
    .select('id')
    .eq('user_id', userId)
    .eq('agent_type', agentType)
    .eq('usage_date', today)
    .maybeSingle()
  
  if (existingUsage) {
    // Update existant
    const { error: updateError, data: updatedData } = await supabase
      .from('usage_tracking')
      .update({ usage_count: newCount })
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .eq('usage_date', today)
      .select()
    
    if (updateError) {
      console.error(`[checkUsageLimits] Error updating usage:`, updateError)
      console.error(`[checkUsageLimits] Details: userId=${userId}, agentType=${agentType}, date=${today}, newCount=${newCount}`)
      // Retry une fois
      const { error: retryError } = await supabase
        .from('usage_tracking')
        .update({ usage_count: newCount })
        .eq('user_id', userId)
        .eq('agent_type', agentType)
        .eq('usage_date', today)
      
      if (retryError) {
        console.error(`[checkUsageLimits] Retry failed:`, retryError)
        // Ne pas throw, on continue quand même
      } else {
        console.log(`[checkUsageLimits] Usage updated on retry: ${currentCount} -> ${newCount}`)
      }
    } else {
      console.log(`[checkUsageLimits] Usage updated: ${currentCount} -> ${newCount}`)
    }
  } else {
    // Insert nouveau
    const { error: insertError, data: insertedData } = await supabase
      .from('usage_tracking')
      .insert({
        user_id: userId,
        agent_type: agentType,
        usage_date: today,
        usage_count: newCount
      })
      .select()
    
    if (insertError) {
      console.error(`[checkUsageLimits] Error inserting usage:`, insertError)
      console.error(`[checkUsageLimits] Details: userId=${userId}, agentType=${agentType}, date=${today}, newCount=${newCount}`)
      // Retry une fois
      const { error: retryError } = await supabase
        .from('usage_tracking')
        .insert({
          user_id: userId,
          agent_type: agentType,
          usage_date: today,
          usage_count: newCount
        })
      
      if (retryError) {
        console.error(`[checkUsageLimits] Retry failed:`, retryError)
        // Ne pas throw, on continue quand même
      } else {
        console.log(`[checkUsageLimits] Usage inserted on retry: ${newCount}`)
      }
    } else {
      console.log(`[checkUsageLimits] Usage inserted: ${newCount}`)
    }
  }

  return {
    allowed: true,
    remaining: maxAllowed - newCount,
    isLimited: true
  }
}
