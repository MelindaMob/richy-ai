'use client'

import { useEffect } from 'react'

interface DashboardDebugLogsProps {
  subscription: any
  hasTrialLimitations: boolean
  subscriptionStatus: string
  trialDaysLeft: number
  isTrialPlan: boolean
}

export function DashboardDebugLogs({
  subscription,
  hasTrialLimitations,
  subscriptionStatus,
  trialDaysLeft,
  isTrialPlan
}: DashboardDebugLogsProps) {
  useEffect(() => {
    // Log principal avec style
    console.log(
      '%c═══════════════════════════════════════════════════════════',
      'color: #ff6b6b; font-size: 14px; font-weight: bold;'
    )
    console.log(
      '%c🔴 DASHBOARD - SUBSCRIPTION DEBUG INFO',
      'color: #ff6b6b; font-size: 16px; font-weight: bold; background: #1a1a1a; padding: 4px 8px;'
    )
    console.log(
      '%c═══════════════════════════════════════════════════════════',
      'color: #ff6b6b; font-size: 14px; font-weight: bold;'
    )
    
    // Données brutes de la subscription
    console.group('%c📦 Subscription Data (from DB)', 'color: #4ecdc4; font-weight: bold;')
    console.log('Full subscription object:', subscription)
    if (subscription) {
      console.table({
        'ID': subscription.id || 'N/A',
        'Plan Type': subscription.plan_type || '❌ NULL',
        'Status': subscription.status || '❌ NULL',
        'Trial Ends At': subscription.trial_ends_at || '❌ NULL',
        'Stripe Subscription ID': subscription.stripe_subscription_id || '❌ NULL',
        'Stripe Customer ID': subscription.stripe_customer_id || '❌ NULL',
        'Created At': subscription.created_at || '❌ NULL'
      })
    } else {
      console.log('%c❌ NO SUBSCRIPTION FOUND IN DB', 'color: red; font-weight: bold;')
    }
    console.groupEnd()
    
    // Valeurs calculées
    console.group('%c🧮 Computed Values', 'color: #ffe66d; font-weight: bold;')
    console.table({
      'Is Trial Plan': isTrialPlan ? '✅ YES' : '❌ NO',
      'Has Trial Limitations': hasTrialLimitations ? '✅ YES' : '❌ NO',
      'Subscription Status': subscriptionStatus,
      'Trial Days Left': trialDaysLeft
    })
    console.groupEnd()
    
    // Diagnostic
    console.group('%c🔍 Diagnostic', 'color: #95e1d3; font-weight: bold;')
    if (!subscription) {
      console.log('%c⚠️ PROBLÈME: Aucune subscription trouvée dans la DB', 'color: orange; font-weight: bold;')
    } else if (!subscription.plan_type) {
      console.log('%c⚠️ PROBLÈME: plan_type est NULL dans la DB', 'color: orange; font-weight: bold;')
    } else if (subscription.plan_type === 'trial' && !hasTrialLimitations) {
      console.log('%c⚠️ PROBLÈME: plan_type=trial mais hasTrialLimitations=false', 'color: orange; font-weight: bold;')
    } else if (subscription.plan_type === 'direct' && hasTrialLimitations) {
      console.log('%c⚠️ PROBLÈME: plan_type=direct mais hasTrialLimitations=true', 'color: orange; font-weight: bold;')
    } else {
      console.log('%c✅ OK: Les valeurs sont cohérentes', 'color: green; font-weight: bold;')
    }
    console.groupEnd()
    
    // Trial Limitations
    if (subscription?.trial_limitations) {
      console.group('%c🔒 Trial Limitations', 'color: #ff6b6b; font-weight: bold;')
      console.log(subscription.trial_limitations)
      console.groupEnd()
    }
    
    console.log(
      '%c═══════════════════════════════════════════════════════════',
      'color: #ff6b6b; font-size: 14px; font-weight: bold;'
    )
  }, [subscription, hasTrialLimitations, subscriptionStatus, trialDaysLeft, isTrialPlan])

  return null
}

