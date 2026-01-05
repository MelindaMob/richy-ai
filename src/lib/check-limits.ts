// lib/check-limits.ts

import { createClient } from '@/lib/supabase/server'

export async function checkUsageLimits(
  userId: string,
  agentType: 'chat' | 'validator' | 'prompt' | 'builder'
) {
  const supabase = createClient()
  
  // Get subscription
  const { data: sub } = await supabase
    .
    from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  // No subscription
  if (!sub) {
    return {
      allowed: false,
      reason: 'NO_SUBSCRIPTION',
      message: 'Commence ton essai gratuit ! 🚀'
    }
  }

  // Active (no limits)
  if (sub.status === 'active' && !sub.trial_limitations) {
    return { allowed: true, unlimited: true }
  }

  // Trial with limits
  if (sub.trial_limitations) {
    const limits = sub.trial_limitations as any
    const limitKey = agentType === 'chat' ? 'chat_messages' : `${agentType}_uses`
    const maxAllowed = limits[limitKey] || 0

    // Blocked agents
    if (maxAllowed === 0) {
      return {
        allowed: false,
        reason: 'FEATURE_LOCKED',
        message: `${agentType} est réservé aux membres Premium ! 👑`
      }
    }

    // Check current usage
    const today = new Date().toISOString().split('T')[0]
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('usage_count')
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .eq('usage_date', today)
      .single()

    const currentCount = usage?.usage_count || 0

    if (currentCount >= maxAllowed) {
      return {
        allowed: false,
        reason: 'LIMIT_REACHED',
        remaining: 0,
        message: `Limite atteinte ! Passe au Premium pour continuer 🚀`
      }
    }

    // Increment usage
    await supabase.from('usage_tracking').upsert({
      user_id: userId,
      agent_type: agentType,
      usage_date: today,
      usage_count: currentCount + 1
    })

    return {
      allowed: true,
      remaining: maxAllowed - currentCount - 1,
      isLimited: true
    }
  }

  return {
    allowed: false,
    reason: 'UNKNOWN'
  }
}