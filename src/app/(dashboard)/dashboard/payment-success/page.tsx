'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [syncing, setSyncing] = useState(true)

  useEffect(() => {
    // Nettoyer le sessionStorage si des infos d'inscription étaient en attente
    sessionStorage.removeItem('pending_registration')
    
    // Synchroniser la subscription avec Stripe
    const syncSubscription = async () => {
      try {
        const response = await fetch('/api/stripe/sync-subscription', {
          method: 'POST'
        })
        const data = await response.json()
        console.log('Subscription synced:', data)
      } catch (error) {
        console.error('Error syncing subscription:', error)
      } finally {
        setSyncing(false)
        // Rediriger vers le dashboard après 2 secondes
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      }
    }

    syncSubscription()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-richy-black-soft/80 backdrop-blur-sm border border-richy-gold/20 rounded-2xl p-8 text-center">
        <svg className="w-20 h-20 text-green-400 mx-auto mb-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        
        <h1 className="text-3xl font-bold text-white mb-4">
          Paiement réussi ! 🎉
        </h1>
        
        <p className="text-gray-400 mb-6">
          {syncing ? 'Synchronisation de votre abonnement...' : 'Ton abonnement est maintenant actif. Redirection vers le dashboard...'}
        </p>

        <Link 
          href="/dashboard"
          className="btn btn-primary"
        >
          Aller au dashboard →
        </Link>
      </div>
    </div>
  )
}

