'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import CheckoutModal from '@/components/CheckoutModal'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// 1. On isole la logique qui utilise useSearchParams dans un composant enfant
function PricingChoiceContent() {
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'direct' | null>(null)
  const [pendingRegistration, setPendingRegistration] = useState<any>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const planParam = searchParams.get('plan')
    if (planParam === 'trial' || planParam === 'direct') {
      setSelectedPlan(planParam as 'trial' | 'direct')
      setShowCheckout(true)
    }

    const pendingDataStr = sessionStorage.getItem('pending_registration')
    if (pendingDataStr) {
      try {
        const data = JSON.parse(pendingDataStr)
        setPendingRegistration(data)
      } catch (e) {
        console.error('Erreur parsing pending registration:', e)
      }
    }

    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user && !pendingDataStr) {
        router.push('/register')
        return
      }

      if (user) {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
          router.push('/dashboard')
          return
        }
      }
    }
    checkAuth()
  }, [router, supabase, searchParams])

  const handleSelectPlan = (plan: 'trial' | 'direct') => {
    setSelectedPlan(plan)
    setShowCheckout(true)
  }

  // Carousel handlers
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX }
  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    const distance = touchStartX.current - touchEndX.current
    if (distance > 50 && currentSlide < 1) setCurrentSlide(currentSlide + 1)
    else if (distance < -50 && currentSlide > 0) setCurrentSlide(currentSlide - 1)
    touchStartX.current = null
    touchEndX.current = null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-richy-black via-richy-black to-richy-black-soft flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-richy-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-richy-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Choisis ton plan Richy.ai</h1>
          <p className="text-xl text-gray-400">Essai limité ou accès complet immédiat</p>
        </div>

        <div className="md:grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Mobile Carousel */}
          <div ref={carouselRef} className="md:hidden relative overflow-hidden" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
              {/* Trial Card Mobile */}
              <div className="min-w-full px-2">
                <div className="bg-gradient-to-br from-richy-black-soft to-richy-black border border-gray-700 rounded-2xl p-6 text-center">
                  <h2 className="text-2xl font-bold text-white mb-4">Essai Gratuit</h2>
                  <p className="text-4xl font-bold text-richy-gold mb-2">0€ <span className="text-sm text-gray-400">/ 3 jours</span></p>
                  <button onClick={() => handleSelectPlan('trial')} className="w-full bg-richy-gold text-black font-bold py-3 rounded-xl mt-6">Essayer gratuitement</button>
                </div>
              </div>
              {/* Premium Card Mobile */}
              <div className="min-w-full px-2">
                <div className="bg-gradient-to-br from-richy-black-soft to-richy-black border-2 border-richy-gold rounded-2xl p-6 text-center">
                  <h2 className="text-2xl font-bold text-white mb-4">Accès Premium</h2>
                  <p className="text-4xl font-bold text-richy-gold mb-2">49€ <span className="text-sm text-gray-400">/ mois</span></p>
                  <button onClick={() => handleSelectPlan('direct')} className="w-full bg-richy-gold text-black font-bold py-3 rounded-xl mt-6">Accès complet immédiat</button>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-2 mt-4">
                <div className={`h-1.5 rounded-full transition-all ${currentSlide === 0 ? 'w-6 bg-richy-gold' : 'w-2 bg-gray-600'}`} />
                <div className={`h-1.5 rounded-full transition-all ${currentSlide === 1 ? 'w-6 bg-richy-gold' : 'w-2 bg-gray-600'}`} />
            </div>
          </div>

          {/* Desktop Cards */}
          <div className="hidden md:block bg-richy-black-soft border border-gray-700 rounded-2xl p-8 text-center hover:border-richy-gold/50 transition-all">
            <h2 className="text-2xl font-bold text-white mb-4">Essai Gratuit</h2>
            <p className="text-4xl font-bold text-richy-gold">0€</p>
            <p className="text-gray-400 mb-6">3 jours d'essai</p>
            <button onClick={() => handleSelectPlan('trial')} className="w-full bg-richy-gold text-black font-bold py-3 rounded-xl">Essayer</button>
          </div>

          <div className="hidden md:block bg-richy-black-soft border-2 border-richy-gold rounded-2xl p-8 text-center scale-105 shadow-xl shadow-richy-gold/10">
            <h2 className="text-2xl font-bold text-white mb-4">Accès Premium</h2>
            <p className="text-4xl font-bold text-richy-gold">49€</p>
            <p className="text-gray-400 mb-6">Engagement 1 an</p>
            <button onClick={() => handleSelectPlan('direct')} className="w-full bg-richy-gold text-black font-bold py-3 rounded-xl">Prendre le plan</button>
          </div>
        </div>
      </div>

      {showCheckout && selectedPlan && (
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => { setShowCheckout(false); setSelectedPlan(null); }}
          planType={selectedPlan}
          stripe={stripePromise}
          pendingRegistration={pendingRegistration}
        />
      )}
    </div>
  )
}

// 2. Le composant exporté par défaut qui enveloppe tout dans Suspense
export default function PricingChoice() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-richy-black flex items-center justify-center text-richy-gold">Chargement des offres...</div>}>
      <PricingChoiceContent />
    </Suspense>
  )
}