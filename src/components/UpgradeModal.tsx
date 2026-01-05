// components/UpgradeModal.tsx

'use client'

import { useState } from 'react'
import { Crown } from 'lucide-react'
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

  if (!isOpen) return null

  return (
    <>
      <dialog className="modal modal-open">
        <div className="modal-box">
          <h3 className="font-bold text-2xl text-center mb-6">
            Passe au Premium ! 👑
          </h3>
          
          <Crown className="w-20 h-20 text-primary mx-auto mb-6" />
          
          {reason === 'LIMIT_REACHED' ? (
            <p className="text-center mb-6">
              Tu as atteint la limite gratuite.<br/>
              <strong>Débloques l'accès illimité maintenant !</strong>
            </p>
          ) : (
            <p className="text-center mb-6">
              Pourquoi attendre ?<br/>
              <strong>Accède à tout immédiatement !</strong>
            </p>
          )}

          <div className="bg-base-200 rounded-lg p-4 mb-6">
            <ul className="space-y-2 text-sm">
              <li>✅ Messages illimités</li>
              <li>✅ Toutes les analyses</li>
              <li>✅ Prompt Generator</li>
              <li>✅ Builder de roadmaps</li>
              <li>✅ Support prioritaire</li>
            </ul>
          </div>

          <div className="alert alert-info mb-6">
            <span className="text-sm">
              💳 Paiement immédiat • Annule automatiquement ton trial
            </span>
          </div>

          <div className="modal-action">
            <button onClick={onClose} className="btn btn-ghost">
              Plus tard
            </button>
            <button 
              onClick={() => setShowCheckout(true)}
              className="btn btn-primary"
            >
              Upgrade maintenant →
            </button>
          </div>
        </div>
        
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClose}>close</button>
        </form>
      </dialog>

      {showCheckout && (
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => {
            setShowCheckout(false)
            onClose()
          }}
          planType="direct"
          stripe={stripePromise}
        />
      )}
    </>
  )
}