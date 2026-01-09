'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardDebugLogsProps {
  subscription: any
  profile?: any
  user?: any
  hasTrialLimitations: boolean
  subscriptionStatus: string
  trialDaysLeft: number
  isTrialPlan: boolean
}

export function DashboardDebugLogs({
  subscription,
  profile,
  user,
  hasTrialLimitations,
  subscriptionStatus,
  trialDaysLeft,
  isTrialPlan
}: DashboardDebugLogsProps) {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [checkAttempts, setCheckAttempts] = useState(0)

  // Vérifier et synchroniser la subscription si elle n'est pas trouvée
  useEffect(() => {
    // Si pas de subscription mais qu'on a un stripe_customer_id, essayer de synchroniser
    if (!subscription && profile?.stripe_customer_id && !isChecking && checkAttempts < 3) {
      setIsChecking(true)
      setCheckAttempts(prev => prev + 1)
      
      console.log(`[DashboardDebugLogs] ⚠️ Pas de subscription trouvée, tentative de synchronisation ${checkAttempts + 1}/3`)
      
      const syncAndCheck = async () => {
        try {
          // Appeler sync-subscription
          const response = await fetch('/api/stripe/sync-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.id })
          })
          
          const data = await response.json()
          console.log('[DashboardDebugLogs] Réponse sync-subscription:', data)
          
          if (data.success || data.subscription) {
            // Attendre un peu puis recharger la page
            console.log('[DashboardDebugLogs] ✅ Subscription synchronisée, rechargement de la page...')
            await new Promise(resolve => setTimeout(resolve, 1000))
            router.refresh()
          } else {
            // Réessayer après un délai
            console.log('[DashboardDebugLogs] ⏳ Subscription pas encore disponible, nouvelle tentative dans 2 secondes...')
            await new Promise(resolve => setTimeout(resolve, 2000))
            setIsChecking(false)
          }
        } catch (error) {
          console.error('[DashboardDebugLogs] Erreur lors de la synchronisation:', error)
          setIsChecking(false)
        }
      }
      
      syncAndCheck()
    }
  }, [subscription, profile?.stripe_customer_id, isChecking, checkAttempts, user?.id, router])

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

