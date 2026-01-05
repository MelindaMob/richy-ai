// app/(auth)/signup/pricing-choice/page.tsx

'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import CheckoutModal from '@/components/CheckoutModal'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function PricingChoice() {
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'direct' | null>(null)

  const handleSelectPlan = (plan: 'trial' | 'direct') => {
    setSelectedPlan(plan)
    setShowCheckout(true)
  }

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-primary mb-4">
            Choisis ton plan Richy.ai
          </h1>
          <p className="text-xl text-base-content/70">
            Essai limité ou accès complet immédiat
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Trial Card */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <div className="badge badge-info badge-lg mb-4">DÉCOUVERTE</div>
              
              <Zap className="w-16 h-16 text-info mx-auto mb-4" />
              
              <h2 className="card-title text-3xl justify-center mb-4">
                Essai Gratuit
              </h2>
              
              <div className="text-center mb-6">
                <span className="text-4xl font-bold">0€</span>
                <span className="text-base-content/60"> / 3 jours</span>
                <p className="text-sm text-warning mt-2">Puis 49€/mois</p>
              </div>

              <div className="divider"></div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <span className="text-success mr-2">✓</span>
                  Chat IA <span className="badge badge-warning badge-sm ml-2">5 messages</span>
                </li>
                <li className="flex items-center">
                  <span className="text-success mr-2">✓</span>
                  Validator <span className="badge badge-warning badge-sm ml-2">1 analyse</span>
                </li>
                <li className="flex items-center text-base-content/40">
                  <span className="text-error mr-2">✗</span>
                  <s>Prompt Generator</s>
                </li>
                <li className="flex items-center text-base-content/40">
                  <span className="text-error mr-2">✗</span>
                  <s>Builder</s>
                </li>
              </ul>

              <div className="alert alert-warning">
                <span className="text-xs">⚠️ Limites strictes • Carte requise</span>
              </div>

              <button 
                onClick={() => handleSelectPlan('trial')}
                className="btn btn-outline btn-primary mt-4"
              >
                Essayer gratuitement
              </button>
            </div>
          </div>

          {/* Premium Card */}
          <div className="card bg-gradient-to-br from-base-200 to-primary/10 shadow-2xl border-2 border-primary">
            <div className="card-body">
              <div className="badge badge-primary badge-lg mb-4">RECOMMANDÉ</div>
              
              <Crown className="w-16 h-16 text-primary mx-auto mb-4" />
              
              <h2 className="card-title text-3xl justify-center mb-4 text-primary">
                Accès Premium
              </h2>
              
              <div className="text-center mb-6">
                <span className="text-4xl font-bold">49€</span>
                <span className="text-base-content/60"> / mois</span>
                <p className="text-sm text-success mt-2">Accès immédiat • Sans limite</p>
              </div>

              <div className="divider"></div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <span className="text-success mr-2">✓</span>
                  <strong>Chat IA</strong> <span className="badge badge-success badge-sm ml-2">ILLIMITÉ</span>
                </li>
                <li className="flex items-center">
                  <span className="text-success mr-2">✓</span>
                  <strong>Validator</strong> <span className="badge badge-success badge-sm ml-2">ILLIMITÉ</span>
                </li>
                <li className="flex items-center">
                  <span className="text-success mr-2">✓</span>
                  <strong>Prompt Generator</strong>
                </li>
                <li className="flex items-center">
                  <span className="text-success mr-2">✓</span>
                  <strong>Builder</strong>
                </li>
                <li className="flex items-center">
                  <span className="text-success mr-2">✓</span>
                  Support prioritaire
                </li>
              </ul>

              <div className="alert alert-success">
                <span className="text-xs">🎁 Bonus : 1 mois offert après 12 mois</span>
              </div>

              <button 
                onClick={() => handleSelectPlan('direct')}
                className="btn btn-primary mt-4"
              >
                Accès complet immédiat →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && selectedPlan && (
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          planType={selectedPlan}
          stripe={stripePromise}
        />
      )}
    </div>
  )
}