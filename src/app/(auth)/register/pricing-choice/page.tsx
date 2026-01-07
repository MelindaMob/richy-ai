'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import CheckoutModal from '@/components/CheckoutModal'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function PricingChoice() {
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
    // Vérifier s'il y a un paramètre plan dans l'URL
    const planParam = searchParams.get('plan')
    if (planParam === 'trial' || planParam === 'direct') {
      // Ouvrir automatiquement le checkout avec le plan sélectionné
      setSelectedPlan(planParam as 'trial' | 'direct')
      setShowCheckout(true)
    }

    // Vérifier s'il y a des infos d'inscription en attente
    const pendingDataStr = sessionStorage.getItem('pending_registration')
    if (pendingDataStr) {
      try {
        const data = JSON.parse(pendingDataStr)
        setPendingRegistration(data)
        console.log('[pricing-choice] Infos d\'inscription en attente trouvées')
      } catch (e) {
        console.error('[pricing-choice] Erreur parsing pending registration:', e)
      }
    }

    // Vérifier que l'utilisateur est connecté OU qu'il y a des infos en attente
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Si pas connecté ET pas d'infos en attente, rediriger vers register
      if (!user && !pendingDataStr) {
        router.push('/register')
        return
      }

      // Si connecté, vérifier si l'utilisateur a déjà une subscription
      if (user) {
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
      }

      // Sinon, on reste sur cette page pour choisir le plan
    }

    checkAuth()
  }, [router, supabase, searchParams])

  const handleSelectPlan = (plan: 'trial' | 'direct') => {
    setSelectedPlan(plan)
    setShowCheckout(true)
  }

  // Touch handlers for carousel
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    
    const distance = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50

    if (distance > minSwipeDistance && currentSlide < 1) {
      // Swipe left - next slide
      setCurrentSlide(currentSlide + 1)
    } else if (distance < -minSwipeDistance && currentSlide > 0) {
      // Swipe right - previous slide
      setCurrentSlide(currentSlide - 1)
    }

    touchStartX.current = null
    touchEndX.current = null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-richy-black via-richy-black to-richy-black-soft flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-richy-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-richy-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choisis ton plan Richy.ai
          </h1>
          <p className="text-xl text-gray-400">
            Essai limité ou accès complet immédiat
          </p>
        </div>

        {/* Cards - Carousel on mobile, grid on desktop */}
        <div className="md:grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Mobile Carousel */}
          <div 
            ref={carouselRef}
            className="md:hidden relative overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {/* Trial Card - Mobile */}
              <div className="min-w-full px-2">
                <div className="group relative bg-gradient-to-br from-richy-black-soft via-richy-black-soft to-richy-black/80 border border-gray-700/50 rounded-2xl p-6 hover:border-richy-gold/60 transition-all duration-300 hover:shadow-2xl hover:shadow-richy-gold/10 backdrop-blur-sm">
            {/* Badge */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider shadow-lg">
                DÉCOUVERTE
              </div>
            </div>

            <div className="text-center mb-6 pt-4">
              <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
                Essai Gratuit
              </h2>
              
              <div className="mb-3">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-4xl font-bold bg-gradient-to-r from-richy-gold to-richy-gold-light bg-clip-text text-transparent">
                    0€
                  </span>
                  <span className="text-base text-gray-400 font-medium">/ 3 jours</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Puis <span className="text-richy-gold font-semibold">49€/mois</span></p>
                <p className="text-[10px] text-gray-600 mt-1">Engagement <span className="text-gray-500">1 an</span></p>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-5"></div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/20 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-gray-300 font-medium">Chat IA</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    5 messages
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/20 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-gray-300 font-medium">Validator</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    1 analyse
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3 opacity-50">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700/50 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-500 line-through">Prompt Generator</span>
              </li>
              <li className="flex items-start gap-3 opacity-50">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700/50 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-500 line-through">Builder</span>
              </li>
            </ul>

            <div className="bg-gradient-to-r from-yellow-900/20 to-amber-900/20 border border-yellow-500/30 rounded-lg p-3 mb-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-yellow-400 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Limites strictes • Carte requise</span>
              </div>
            </div>

            <button 
              onClick={() => handleSelectPlan('trial')}
              className="w-full bg-gradient-to-r from-richy-gold via-richy-gold-light to-richy-gold text-richy-black font-bold py-3 px-4 rounded-xl hover:scale-[1.02] hover:shadow-xl hover:shadow-richy-gold/30 transition-all duration-300 shadow-lg relative overflow-hidden group text-sm"
            >
              <span className="relative z-10">Essayer gratuitement</span>
              <div className="absolute inset-0 bg-gradient-to-r from-richy-gold-light to-richy-gold opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
                </div>
              </div>

              {/* Premium Card - Mobile */}
              <div className="min-w-full px-2">
                <div className="group relative bg-gradient-to-br from-richy-black-soft via-richy-black-soft to-richy-black/80 border-2 border-richy-gold/60 rounded-2xl p-6 hover:border-richy-gold hover:shadow-2xl hover:shadow-richy-gold/20 transition-all duration-300 backdrop-blur-sm">
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-richy-gold/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Badge */}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black px-5 py-2 rounded-full text-xs font-bold tracking-wider shadow-lg animate-pulse">
                      ⭐ RECOMMANDÉ
                    </div>
                  </div>
                  
                  <div className="text-center mb-6 pt-6 relative z-10">
                    <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
                      Accès Premium
                    </h2>
                    
                    <div className="mb-3">
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-4xl font-bold bg-gradient-to-r from-richy-gold via-richy-gold-light to-richy-gold bg-clip-text text-transparent">
                          49€
                        </span>
                        <span className="text-base text-gray-400 font-medium">/ mois</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Engagement <span className="text-richy-gold font-semibold">1 an</span></p>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-richy-gold/50 to-transparent mb-5 relative z-10"></div>

                  <ul className="space-y-3 mb-6 relative z-10">
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                        <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <span className="text-white font-semibold">Chat IA</span>
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/40">
                          ILLIMITÉ
                        </span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                        <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <span className="text-white font-semibold">Validator</span>
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/40">
                          ILLIMITÉ
                        </span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                        <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-white font-semibold">Prompt Generator</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                        <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-white font-semibold">Builder</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                        <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-white font-semibold">Support prioritaire</span>
                    </li>
                  </ul>

                  <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/40 rounded-lg p-3 mb-5 backdrop-blur-sm relative z-10">
                    <div className="flex items-center gap-2 text-green-400 text-xs font-semibold">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>Accès immédiat • Sans limite</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSelectPlan('direct')}
                    className="w-full bg-gradient-to-r from-richy-gold via-richy-gold-light to-richy-gold text-richy-black font-bold py-3 px-4 rounded-xl hover:scale-[1.02] hover:shadow-2xl hover:shadow-richy-gold/40 transition-all duration-300 shadow-xl shadow-richy-gold/20 relative overflow-hidden group relative z-10 text-sm"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Accès complet immédiat
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-richy-gold-light via-richy-gold to-richy-gold-light opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </div>
              </div>
            </div>

            {/* Carousel Indicators */}
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setCurrentSlide(0)}
                className={`h-2 rounded-full transition-all ${
                  currentSlide === 0 ? 'w-8 bg-richy-gold' : 'w-2 bg-gray-600'
                }`}
                aria-label="Slide 1"
              />
              <button
                onClick={() => setCurrentSlide(1)}
                className={`h-2 rounded-full transition-all ${
                  currentSlide === 1 ? 'w-8 bg-richy-gold' : 'w-2 bg-gray-600'
                }`}
                aria-label="Slide 2"
              />
            </div>
          </div>

          {/* Desktop Grid */}
          {/* Trial Card */}
          <div className="hidden md:block group relative bg-gradient-to-br from-richy-black-soft via-richy-black-soft to-richy-black/80 border border-gray-700/50 rounded-2xl p-6 hover:border-richy-gold/60 transition-all duration-300 hover:shadow-2xl hover:shadow-richy-gold/10 backdrop-blur-sm">
            {/* Badge */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider shadow-lg">
                DÉCOUVERTE
              </div>
              </div>
              
            <div className="text-center mb-6 pt-4">
              <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
                Essai Gratuit
              </h2>
              
              <div className="mb-3">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-4xl font-bold bg-gradient-to-r from-richy-gold to-richy-gold-light bg-clip-text text-transparent">
                    0€
                  </span>
                  <span className="text-base text-gray-400 font-medium">/ 3 jours</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Puis <span className="text-richy-gold font-semibold">49€/mois</span></p>
                <p className="text-[10px] text-gray-600 mt-1">Engagement <span className="text-gray-500">1 an</span></p>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-5"></div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/20 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-gray-300 font-medium">Chat IA</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    5 messages
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/20 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-gray-300 font-medium">Validator</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    1 analyse
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3 opacity-50">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700/50 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-500 line-through">Prompt Generator</span>
              </li>
              <li className="flex items-start gap-3 opacity-50">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700/50 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-500 line-through">Builder</span>
              </li>
            </ul>

            <div className="bg-gradient-to-r from-yellow-900/20 to-amber-900/20 border border-yellow-500/30 rounded-lg p-3 mb-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-yellow-400 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Limites strictes • Carte requise</span>
              </div>
            </div>

            <button 
              onClick={() => handleSelectPlan('trial')}
              className="w-full bg-gradient-to-r from-richy-gold via-richy-gold-light to-richy-gold text-richy-black font-bold py-3 px-4 rounded-xl hover:scale-[1.02] hover:shadow-xl hover:shadow-richy-gold/30 transition-all duration-300 shadow-lg relative overflow-hidden group text-sm"
            >
              <span className="relative z-10">Essayer gratuitement</span>
              <div className="absolute inset-0 bg-gradient-to-r from-richy-gold-light to-richy-gold opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>

          {/* Premium Card - Featured */}
          <div className="hidden md:block group relative bg-gradient-to-br from-richy-black-soft via-richy-black-soft to-richy-black/80 border-2 border-richy-gold/60 rounded-2xl p-6 hover:border-richy-gold hover:shadow-2xl hover:shadow-richy-gold/20 transition-all duration-300 backdrop-blur-sm scale-105 md:scale-110">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-richy-gold/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black px-5 py-2 rounded-full text-xs font-bold tracking-wider shadow-lg animate-pulse">
                ⭐ RECOMMANDÉ
              </div>
            </div>
            
            <div className="text-center mb-6 pt-6 relative z-10">
              <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
                Accès Premium
              </h2>
              
              <div className="mb-3">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-4xl font-bold bg-gradient-to-r from-richy-gold via-richy-gold-light to-richy-gold bg-clip-text text-transparent">
                49€
                  </span>
                  <span className="text-base text-gray-400 font-medium">/ mois</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Engagement <span className="text-richy-gold font-semibold">1 an</span></p>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-richy-gold/50 to-transparent mb-5 relative z-10"></div>

            <ul className="space-y-3 mb-6 relative z-10">
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-white font-semibold">Chat IA</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/40">
                    ILLIMITÉ
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-white font-semibold">Validator</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/40">
                    ILLIMITÉ
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white font-semibold">Prompt Generator</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white font-semibold">Builder</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-richy-gold/30 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-richy-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white font-semibold">Support prioritaire</span>
              </li>
            </ul>

            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/40 rounded-lg p-3 mb-5 backdrop-blur-sm relative z-10">
              <div className="flex items-center gap-2 text-green-400 text-xs font-semibold">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>Accès immédiat • Sans limite</span>
              </div>
            </div>

            <button 
              onClick={() => handleSelectPlan('direct')}
              className="w-full bg-gradient-to-r from-richy-gold via-richy-gold-light to-richy-gold text-richy-black font-bold py-3 px-4 rounded-xl hover:scale-[1.02] hover:shadow-2xl hover:shadow-richy-gold/40 transition-all duration-300 shadow-xl shadow-richy-gold/20 relative overflow-hidden group relative z-10 text-sm"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Accès complet immédiat
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-richy-gold-light via-richy-gold to-richy-gold-light opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
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
          pendingRegistration={pendingRegistration}
        />
      )}
    </div>
  )
}

