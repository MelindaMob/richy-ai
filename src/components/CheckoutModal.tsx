// components/CheckoutModal.tsx

'use client'

import { useEffect, useState } from 'react'
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js'
import { Stripe } from '@stripe/stripe-js'
import { X } from 'lucide-react'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  planType: 'trial' | 'direct'
  stripe: Promise<Stripe | null>
}

export default function CheckoutModal({ 
  isOpen, 
  onClose, 
  planType, 
  stripe 
}: CheckoutModalProps) {
  const [clientSecret, setClientSecret] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchCheckoutSession()
    }
  }, [isOpen, planType])

  const fetchCheckoutSession = async () => {
    setLoading(true)
    
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceType: planType })
      })
      
      const data = await res.json()
      setClientSecret(data.clientSecret)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-4xl h-[80vh] relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">
            {planType === 'trial' ? 'Essai gratuit 3 jours' : 'Accès Premium'}
          </h3>
          <button 
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-4rem)] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          ) : clientSecret ? (
            <EmbeddedCheckoutProvider
              stripe={stripe}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <div className="alert alert-error">
              <span>Erreur de chargement. Réessaye.</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Backdrop */}
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}