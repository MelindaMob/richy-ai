'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import CheckoutModal from '@/components/CheckoutModal'
import Link from 'next/link'

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
        console.log('[pricing-choice] Données pending_registration récupérées:', {
          email: data.email,
          phone: data.phone_number,
          verificationId: data.phone_verification_id
        })
        setPendingRegistration(data)
      } catch (e) {
        console.error('Erreur parsing pending registration:', e)
      }
    } else {
      console.warn('[pricing-choice] Aucune donnée pending_registration trouvée dans sessionStorage')
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

        {/* Pricing Cards */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 mb-12">
          {/* Mobile Carousel */}
          <div ref={carouselRef} className="md:hidden relative overflow-hidden" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
              {/* Trial Card Mobile */}
              <div className="min-w-full px-2">
                <div className="relative bg-gradient-to-br from-richy-black-soft via-richy-black-soft to-richy-black border border-gray-700/50 rounded-3xl p-8 shadow-2xl hover:shadow-richy-gold/10 transition-all duration-300 overflow-hidden group">
                  {/* Effet de brillance au hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-richy-gold/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  
                  <div className="relative z-10">
                    <div className="text-center mb-6">
                      <div className="inline-block bg-richy-gold/10 px-3 py-1 rounded-full mb-4">
                        <span className="text-richy-gold text-xs font-semibold">ESSAI GRATUIT</span>
                      </div>
                      <h2 className="text-3xl font-bold text-white mb-3">Essai Gratuit</h2>
                      <div className="flex items-baseline justify-center gap-2 mb-2">
                        <span className="text-5xl font-bold text-richy-gold">0€</span>
                        <span className="text-gray-400 text-sm">/ 3 jours</span>
                      </div>
                      <p className="text-gray-500 text-xs">Engagement 1 an</p>
                    </div>
                    
                    <ul className="space-y-3 mb-8 text-left">
                      <li className="flex items-start gap-3 text-gray-300">
                        <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">5 messages Chat IA</span>
                      </li>
                      <li className="flex items-start gap-3 text-gray-300">
                        <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">1 validation d'idée</span>
                      </li>
                      <li className="flex items-start gap-3 text-gray-400 line-through">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Prompt Generator</span>
                      </li>
                      <li className="flex items-start gap-3 text-gray-400 line-through">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Builder</span>
                      </li>
                    </ul>
                    
                    <button 
                      onClick={() => handleSelectPlan('trial')} 
                      className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-4 rounded-xl hover:scale-105 hover:shadow-lg hover:shadow-richy-gold/50 transition-all duration-300"
                    >
                      Essayer gratuitement
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Premium Card Mobile */}
              <div className="min-w-full px-2">
                <div className="relative bg-gradient-to-br from-richy-black-soft via-richy-black-soft to-richy-black border-2 border-richy-gold rounded-3xl p-8 shadow-2xl shadow-richy-gold/20 hover:shadow-richy-gold/30 transition-all duration-300 overflow-hidden group scale-105">
                  {/* Badge POPULAIRE */}
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20">
                    <span className="bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">
                      POPULAIRE
                    </span>
                  </div>
                  
                  {/* Effet de brillance au hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-richy-gold/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  
                  {/* Particules dorées animées */}
                  <div className="absolute top-4 right-4 w-2 h-2 bg-richy-gold rounded-full opacity-60 animate-ping" style={{ animationDelay: '0s' }} />
                  <div className="absolute top-8 right-8 w-1.5 h-1.5 bg-richy-gold rounded-full opacity-40 animate-ping" style={{ animationDelay: '0.5s' }} />
                  
                  <div className="relative z-10">
                    <div className="text-center mb-6 mt-4">
                      <h2 className="text-3xl font-bold text-white mb-3">Accès Premium</h2>
                      <div className="flex items-baseline justify-center gap-2 mb-2">
                        <span className="text-5xl font-bold text-richy-gold">49€</span>
                        <span className="text-gray-400 text-sm">/ mois</span>
                      </div>
                      <p className="text-gray-500 text-xs">Engagement 1 an</p>
                    </div>
                    
                    <ul className="space-y-3 mb-8 text-left">
                      <li className="flex items-start gap-3 text-gray-300">
                        <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Messages Chat IA <strong className="text-richy-gold">ILLIMITÉS</strong></span>
                      </li>
                      <li className="flex items-start gap-3 text-gray-300">
                        <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Validations <strong className="text-richy-gold">ILLIMITÉES</strong></span>
                      </li>
                      <li className="flex items-start gap-3 text-gray-300">
                        <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Prompt Generator illimité</span>
                      </li>
                      <li className="flex items-start gap-3 text-gray-300">
                        <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Builder illimité</span>
                      </li>
                      <li className="flex items-start gap-3 text-gray-300">
                        <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Support prioritaire</span>
                      </li>
                    </ul>
                    
                    <button 
                      onClick={() => handleSelectPlan('direct')} 
                      className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-4 rounded-xl hover:scale-105 hover:shadow-lg hover:shadow-richy-gold/50 transition-all duration-300"
                    >
                      Accès complet immédiat
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-2 mt-6">
              <div className={`h-2 rounded-full transition-all ${currentSlide === 0 ? 'w-8 bg-richy-gold' : 'w-2 bg-gray-600'}`} />
              <div className={`h-2 rounded-full transition-all ${currentSlide === 1 ? 'w-8 bg-richy-gold' : 'w-2 bg-gray-600'}`} />
            </div>
          </div>

          {/* Desktop Cards */}
          <div className="hidden md:block relative bg-gradient-to-br from-richy-black-soft via-richy-black-soft to-richy-black border border-gray-700/50 rounded-3xl p-8 shadow-2xl hover:border-richy-gold/50 hover:shadow-richy-gold/10 transition-all duration-300 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-richy-gold/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            
            <div className="relative z-10">
              <div className="text-center mb-6">
                <div className="inline-block bg-richy-gold/10 px-3 py-1 rounded-full mb-4">
                  <span className="text-richy-gold text-xs font-semibold">ESSAI GRATUIT</span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Essai Gratuit</h2>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-5xl font-bold text-richy-gold">0€</span>
                </div>
                <p className="text-gray-400 text-sm mb-2">Puis 49€/mois</p>
                <p className="text-gray-500 text-xs">Engagement 1 an</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-gray-300">
                  <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">5 messages Chat IA</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">1 validation d'idée</span>
                </li>
                <li className="flex items-start gap-3 text-gray-400 line-through">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Prompt Generator</span>
                </li>
                <li className="flex items-start gap-3 text-gray-400 line-through">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Builder</span>
                </li>
              </ul>
              
              <button 
                onClick={() => handleSelectPlan('trial')} 
                className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-4 rounded-xl hover:scale-105 hover:shadow-lg hover:shadow-richy-gold/50 transition-all duration-300"
              >
                Essayer gratuitement →
              </button>
            </div>
          </div>

          <div className="hidden md:block relative bg-gradient-to-br from-richy-black-soft via-richy-black-soft to-richy-black border-2 border-richy-gold rounded-3xl p-8 shadow-2xl shadow-richy-gold/20 hover:shadow-richy-gold/30 transition-all duration-300 overflow-hidden group scale-105">
            {/* Badge POPULAIRE */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
              <span className="bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black px-5 py-2 rounded-full text-sm font-bold shadow-lg">
                POPULAIRE
              </span>
            </div>
            
            {/* Effet de brillance au hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-richy-gold/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            
            {/* Particules dorées animées */}
            <div className="absolute top-4 right-4 w-2 h-2 bg-richy-gold rounded-full opacity-60 animate-ping" style={{ animationDelay: '0s' }} />
            <div className="absolute top-8 right-8 w-1.5 h-1.5 bg-richy-gold rounded-full opacity-40 animate-ping" style={{ animationDelay: '0.5s' }} />
            
            <div className="relative z-10">
              <div className="text-center mb-6 mt-4">
                <h2 className="text-3xl font-bold text-white mb-3">Accès Premium</h2>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-5xl font-bold text-richy-gold">49€</span>
                  <span className="text-gray-400 text-sm">/ mois</span>
                </div>
                <p className="text-gray-500 text-xs">Engagement 1 an</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-gray-300">
                  <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Messages Chat IA <strong className="text-richy-gold">ILLIMITÉS</strong></span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Validations <strong className="text-richy-gold">ILLIMITÉES</strong></span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Prompt Generator illimité</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Builder illimité</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <svg className="w-5 h-5 text-richy-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Support prioritaire</span>
                </li>
              </ul>
              
              <button 
                onClick={() => handleSelectPlan('direct')} 
                className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-4 rounded-xl hover:scale-105 hover:shadow-lg hover:shadow-richy-gold/50 transition-all duration-300"
              >
                Accès complet immédiat →
              </button>
            </div>
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