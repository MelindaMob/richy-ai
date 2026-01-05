'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CheckoutModal from '@/components/CheckoutModal'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function PricingPage() {
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'direct' | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [needsSync, setNeedsSync] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Vérifier si l'utilisateur a déjà une subscription active
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      // Si déjà abonné avec status valide, rediriger vers dashboard
      if (subscription && 
          (subscription.status === 'active' || subscription.status === 'trialing')) {
        router.push('/dashboard')
        return
      }
      
      // Si subscription existe mais status est 'pending' ou stripe_subscription_id est NULL,
      // proposer de synchroniser depuis Stripe
      if (subscription && 
          (subscription.status === 'pending' || !subscription.stripe_subscription_id)) {
        console.log('[pricing] Subscription exists but not fully synced, user can sync manually')
        setNeedsSync(true)
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPlan = (plan: 'trial' | 'direct') => {
    setSelectedPlan(plan)
    setShowCheckout(true)
  }

  const handleSyncSubscription = async () => {
    setSyncing(true)
    setSyncError(null)
    
    try {
      const response = await fetch('/api/stripe/sync-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log('[pricing] Sync response status:', response.status, response.statusText)
      
      // Vérifier si la réponse est JSON
      let data: any = {}
      const contentType = response.headers.get('content-type')
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const text = await response.text()
          console.log('[pricing] Sync response body:', text)
          data = text ? JSON.parse(text) : {}
        } catch (e) {
          console.error('[pricing] Error parsing JSON:', e)
          throw new Error(`Erreur de parsing de la réponse (${response.status})`)
        }
      } else {
        const text = await response.text()
        console.log('[pricing] Sync response (non-JSON):', text)
        throw new Error(`Réponse invalide du serveur (${response.status}): ${text || 'Réponse vide'}`)
      }
      
      if (!response.ok) {
        console.error('[pricing] Sync error response:', {
          status: response.status,
          statusText: response.statusText,
          data
        })
        
        const errorMessage = data.error || data.details || data.message || 
          `Erreur ${response.status}: ${response.statusText || 'Erreur inconnue'}`
        throw new Error(errorMessage)
      }
      
      console.log('[pricing] Sync successful:', data)
      
      // Rediriger vers le dashboard après synchronisation réussie
      router.push('/dashboard')
    } catch (error: any) {
      console.error('[pricing] Sync error:', error)
      setSyncError(error.message || 'Erreur lors de la synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-richy-black via-richy-black to-richy-black-soft flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-richy-gold"></span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-richy-black via-richy-black to-richy-black-soft">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-richy-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-richy-gold/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-richy-gold/20 bg-richy-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 font-display text-2xl text-richy-gold hover:text-richy-gold-light transition-colors">
            <img src="/logo-richy.png" alt="Richy.ai" className="h-8 w-8" />
            RICHY.AI
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-block bg-gradient-to-r from-richy-gold/20 to-richy-gold-dark/20 border border-richy-gold/30 rounded-full px-4 py-2 mb-6">
            <span className="text-richy-gold text-sm font-semibold">🎯 Choisis ton plan</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Commence à construire ton SaaS
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            Essai gratuit 3 jours ou accès Premium immédiat. Tous les outils pour valider et lancer ton projet.
          </p>
        </div>

        {/* Bouton de synchronisation si nécessaire */}
        {needsSync && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-6 text-center">
              <p className="text-yellow-400 mb-4">
                ⚠️ Il semble que tu aies déjà payé mais que ta subscription ne soit pas synchronisée.
              </p>
              <button
                onClick={handleSyncSubscription}
                disabled={syncing}
                className="bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? 'Synchronisation...' : '🔄 Synchroniser depuis Stripe'}
              </button>
              {syncError && (
                <p className="text-red-400 mt-4 text-sm">{syncError}</p>
              )}
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 mb-12">
          {/* Trial Plan */}
          <div className="bg-richy-black-soft border border-gray-700 rounded-xl p-8 hover:border-richy-gold/50 transition-all">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Essai Gratuit</h3>
              <div className="text-4xl font-bold text-richy-gold mb-2">
                0€
                <span className="text-lg text-gray-400">/3 jours</span>
              </div>
              <p className="text-gray-400 text-sm">Puis 49€/mois</p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <span>5 messages Chat IA</span>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <span>1 validation d'idée</span>
              </li>
              <li className="flex items-center text-gray-400 line-through">
                <span className="mr-2">✗</span>
                <span>Prompt Generator</span>
              </li>
              <li className="flex items-center text-gray-400 line-through">
                <span className="mr-2">✗</span>
                <span>Builder</span>
              </li>
            </ul>

            <button 
              onClick={() => handleSelectPlan('trial')}
              className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg"
            >
              Essayer gratuitement →
            </button>
          </div>

          {/* Premium Plan */}
          <div className="bg-richy-black-soft border-2 border-richy-gold rounded-xl p-8 relative scale-105 hover:scale-110 transition-all">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-richy-gold text-richy-black px-4 py-1 rounded-full text-sm font-bold">
                POPULAIRE
              </span>
            </div>

            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Accès Premium</h3>
              <div className="text-4xl font-bold text-richy-gold mb-2">
                49€
                <span className="text-lg text-gray-400">/mois</span>
              </div>
              <p className="text-gray-400 text-sm">Engagement 1 an</p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <span>Messages Chat IA <strong className="text-richy-gold">ILLIMITÉS</strong></span>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <span>Validations <strong className="text-richy-gold">ILLIMITÉES</strong></span>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <span>Prompt Generator illimité</span>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <span>Builder illimité</span>
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-richy-gold mr-2">✓</span>
                <span>Support prioritaire</span>
              </li>
            </ul>

            <button 
              onClick={() => handleSelectPlan('direct')}
              className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg"
            >
              Accès complet immédiat →
            </button>
          </div>
        </div>

        {/* Informations importantes */}
        <div className="max-w-2xl mx-auto bg-richy-black-soft/50 border border-gray-700 rounded-lg p-6">
          <h4 className="text-white font-bold mb-4">Informations importantes</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>• Paiement sécurisé via Stripe</li>
            <li>• L'essai gratuit dure 3 jours, puis facturation automatique</li>
            <li>• Engagement d'1 an pour le plan Premium</li>
            <li>• Annulation possible après la période d'engagement</li>
          </ul>
        </div>
      </main>

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

