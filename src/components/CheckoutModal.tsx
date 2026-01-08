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
    phone_verification_id?: string
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
    console.log('[CheckoutModal] useEffect - isOpen:', isOpen, 'hasFetchedSecret:', hasFetchedSecret.current, 'clientSecret:', !!clientSecret)
    if (isOpen && !hasFetchedSecret.current && !clientSecret) {
      console.log('[CheckoutModal] Modal ouvert, appel de fetchCheckoutSession')
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
    if (hasFetchedSecret.current) {
      console.log('[CheckoutModal] fetchCheckoutSession déjà appelé, skip')
      return
    }
    
    console.log('[CheckoutModal] 🚀 fetchCheckoutSession appelé')
    console.log('[CheckoutModal] Données envoyées:', {
      priceType: planType,
      isUpgrade: isUpgrade,
      pendingRegistration: pendingRegistration ? {
        email: pendingRegistration.email,
        phone: pendingRegistration.phone_number,
        verificationId: pendingRegistration.phone_verification_id
      } : null
    })
    
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
      
      console.log('[CheckoutModal] Réponse API:', {
        status: res.status,
        ok: res.ok
      })
      
      if (!res.ok) {
        // Lire le message d'erreur du serveur
        const errorData = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        console.error('[CheckoutModal] ❌ Erreur API:', errorData)
        throw new Error(errorData.error || `Erreur ${res.status}: ${res.statusText}`)
      }
      
      const data = await res.json()
      console.log('[CheckoutModal] ✅ Données reçues:', {
        hasClientSecret: !!data.clientSecret,
        error: data.error
      })
      
      if (!data.clientSecret) {
        console.error('[CheckoutModal] ❌ Aucun clientSecret reçu')
        throw new Error('Aucun clientSecret reçu')
      }
      
      setClientSecret(data.clientSecret)
      console.log('[CheckoutModal] ✅ clientSecret défini')
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
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-red-400 font-bold mb-2">Erreur lors de la création de la session</h4>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  hasFetchedSecret.current = false
                  fetchCheckoutSession()
                }}
                className="w-full bg-richy-gold text-richy-black font-bold py-3 px-6 rounded-lg hover:bg-richy-gold-light transition-colors"
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