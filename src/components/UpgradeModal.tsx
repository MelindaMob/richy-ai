'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import CheckoutModal from './CheckoutModal'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function UpgradeModal({ 
  isOpen, 
  onClose,
  reason 
}: { 
  isOpen: boolean
  onClose: () => void
  reason?: string 
}) {
  const [showCheckout, setShowCheckout] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative z-10 bg-richy-black-soft border border-richy-gold/20 rounded-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto pointer-events-auto m-4"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xl text-richy-gold">
              Passe au Premium ! 👑
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
          
          <svg className="w-12 h-12 text-richy-gold mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          
          {reason === 'LIMIT_REACHED' ? (
            <p className="text-center mb-4 text-sm text-white">
              Tu as atteint la limite gratuite.<br/>
              <strong className="text-richy-gold">Débloques l'accès illimité maintenant !</strong>
            </p>
          ) : (
            <p className="text-center mb-4 text-sm text-white">
              Pourquoi attendre ?<br/>
              <strong className="text-richy-gold">Accède à tout immédiatement !</strong>
            </p>
          )}

          <div className="bg-richy-black rounded-lg p-3 mb-4 border border-gray-700">
            <ul className="space-y-1.5 text-xs text-gray-300">
              <li>✅ Messages illimités</li>
              <li>✅ Toutes les analyses</li>
              <li>✅ Prompt Generator illimités</li>
              <li>✅ Builder de roadmaps illimités</li>
              <li>✅ Support prioritaire</li>
            </ul>
          </div>

          <div className="bg-richy-gold/10 border border-richy-gold/30 rounded-lg p-3 mb-4">
            <span className="text-xs text-gray-300">
              💳 Paiement immédiat • Annule automatiquement ton trial
            </span>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={onClose} 
              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
            >
              Plus tard
            </button>
            <button 
              onClick={() => setShowCheckout(true)}
              className="flex-1 px-3 py-2 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold text-sm rounded-lg hover:scale-105 transition-all duration-200 shadow-lg"
            >
              Upgrade →
            </button>
          </div>
        </div>

      {showCheckout && (
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => {
            setShowCheckout(false)
            onClose()
          }}
          planType="direct"
          stripe={stripePromise}
          isUpgrade={true}
        />
      )}
    </div>,
    document.body
  )
}
