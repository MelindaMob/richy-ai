// components/CheckoutModal.tsx

'use client'

import { useEffect, useState, useRef } from 'react'
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js'
import { Stripe } from '@stripe/stripe-js'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  planType: 'trial' | 'direct'
  stripe: Promise<Stripe | null>
  pendingRegistration?: {
    email: string
    password: string
    full_name: string
    company_name: string
    phone_number: string
    phone_verified: boolean
  }
}

export default function CheckoutModal({ 
  isOpen, 
  onClose, 
  planType,
  stripe,
  pendingRegistration,
  isUpgrade = false
}: CheckoutModalProps & { isUpgrade?: boolean }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetchedSecret = useRef(false)
  const stripeInstance = useRef<Stripe | null>(null)

  // Charger l'instance Stripe
  useEffect(() => {
    stripe.then((s) => {
      stripeInstance.current = s
    })
  }, [stripe])

  useEffect(() => {
    if (isOpen && !hasFetchedSecret.current && !clientSecret) {
      fetchCheckoutSession()
    }
    
    if (!isOpen) {
      // Reset quand le modal se ferme
      setClientSecret(null)
      hasFetchedSecret.current = false
      setError(null)
    }
  }, [isOpen])

  const fetchCheckoutSession = async () => {
    if (hasFetchedSecret.current) return
    
    setLoading(true)
    setError(null)
    hasFetchedSecret.current = true
    
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceType: planType,
          isUpgrade: isUpgrade,
          pendingRegistration: pendingRegistration // Passer les infos d'inscription
        })
      })
      
      if (!res.ok) {
        // Lire le message d'erreur du serveur
        const errorData = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        throw new Error(errorData.error || `Erreur ${res.status}: ${res.statusText}`)
      }
      
      const data = await res.json()
      
      if (!data.clientSecret) {
        throw new Error('Aucun clientSecret reçu')
      }
      
      setClientSecret(data.clientSecret)
    } catch (error: any) {
      console.error('Error fetching checkout session:', error)
      setError(error.message || 'Erreur de chargement')
      hasFetchedSecret.current = false
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative z-10 bg-richy-black-soft border border-richy-gold/20 rounded-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto m-4"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-xl text-richy-gold">
            {planType === 'trial' ? 'Essai gratuit 3 jours' : 'Accès Premium'}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[500px]">
              <span className="loading loading-spinner loading-lg text-richy-gold"></span>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchCheckoutSession}
                className="mt-4 btn btn-primary btn-sm"
              >
                Réessayer
              </button>
            </div>
          ) : clientSecret ? (
            <EmbeddedCheckoutProvider
              stripe={stripe}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
              <p className="text-yellow-400">Erreur de chargement. Réessaye.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}