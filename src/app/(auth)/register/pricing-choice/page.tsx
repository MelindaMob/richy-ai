'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import CheckoutModal from '@/components/CheckoutModal'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function PricingChoice() {
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'direct' | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Vérifier que l'utilisateur est connecté
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Si pas connecté, rediriger vers register
        router.push('/register')
        return
      }

      // Vérifier si l'utilisateur a déjà une subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      // Si déjà une subscription active, rediriger vers dashboard
      if (subscription && 
          (subscription.status === 'active' || subscription.status === 'trialing')) {
        router.push('/dashboard')
        return
      }

      // Sinon, on reste sur cette page pour choisir le plan
    }

    checkAuth()
  }, [router, supabase])

  const handleSelectPlan = (plan: 'trial' | 'direct') => {
    setSelectedPlan(plan)
    setShowCheckout(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-richy-black via-richy-black to-richy-black-soft flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-richy-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-richy-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choisis ton plan Richy.ai
          </h1>
          <p className="text-xl text-gray-400">
            Essai limité ou accès complet immédiat
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Trial Card */}
          <div className="bg-richy-black-soft border border-gray-700 rounded-xl p-8 hover:border-richy-gold/50 transition-all">
            <div className="text-center mb-6">
              <div className="inline-block bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-semibold mb-4">
                DÉCOUVERTE
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-4">
                Essai Gratuit
              </h2>
              
              <div className="text-4xl font-bold text-richy-gold mb-2">
                0€
                <span className="text-lg text-gray-400"> / 3 jours</span>
              </div>
              <p className="text-sm text-gray-400">Puis 49€/mois</p>
            </div>

            <div className="divider"></div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                Chat IA <span className="badge badge-warning badge-sm ml-2">5 messages</span>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                Validator <span className="badge badge-warning badge-sm ml-2">1 analyse</span>
              </li>
              <li className="flex items-center text-gray-400 line-through">
                <span className="mr-2">✗</span>
                <s>Prompt Generator</s>
              </li>
              <li className="flex items-center text-gray-400 line-through">
                <span className="mr-2">✗</span>
                <s>Builder</s>
              </li>
            </ul>

            <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
              <span className="text-xs text-yellow-400">⚠️ Limites strictes • Carte requise</span>
            </div>

            <button 
              onClick={() => handleSelectPlan('trial')}
              className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg"
            >
              Essayer gratuitement
            </button>
          </div>

          {/* Premium Card */}
          <div className="bg-richy-black-soft border-2 border-richy-gold rounded-xl p-8 relative scale-105 hover:scale-110 transition-all">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-richy-gold text-richy-black px-4 py-1 rounded-full text-sm font-bold">
                RECOMMANDÉ
              </span>
            </div>
            
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white mb-4">
                Accès Premium
              </h2>
              
              <div className="text-4xl font-bold text-richy-gold mb-2">
                49€
                <span className="text-lg text-gray-400"> / mois</span>
              </div>
              <p className="text-sm text-gray-400">Engagement 1 an</p>
            </div>

            <div className="divider"></div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <strong>Chat IA</strong> <span className="badge badge-success badge-sm ml-2">ILLIMITÉ</span>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <strong>Validator</strong> <span className="badge badge-success badge-sm ml-2">ILLIMITÉ</span>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <strong>Prompt Generator</strong>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <strong>Builder</strong>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                Support prioritaire
              </li>
            </ul>

            <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-3 mb-4">
              <span className="text-xs text-green-400">🎁 Accès immédiat • Sans limite</span>
            </div>

            <button 
              onClick={() => handleSelectPlan('direct')}
              className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg"
            >
              Accès complet immédiat →
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && selectedPlan && (
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => {
            setShowCheckout(false)
            setSelectedPlan(null)
          }}
          planType={selectedPlan}
          stripe={stripePromise}
        />
      )}
    </div>
  )
}

