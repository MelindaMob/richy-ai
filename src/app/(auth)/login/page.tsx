'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Pré-remplir l'email depuis l'URL si présent
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
  
    try {
      // Vérifier d'abord si l'email existe
      const emailToCheck = email.trim().toLowerCase()
      if (!emailToCheck) {
        setError('Veuillez entrer votre email')
        setLoading(false)
        return
      }

      // Vérifier si l'email existe dans la base de données
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', emailToCheck)
        .maybeSingle()

      // Si l'email n'existe pas dans profiles, vérifier aussi dans auth.users
      let emailExists = !!profile
      if (!emailExists) {
        try {
          const checkResponse = await fetch('/api/auth/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailToCheck })
          })
          const checkData = await checkResponse.json()
          emailExists = checkData.alreadyUsed === true
        } catch (checkError) {
          // Si la vérification échoue, on continue quand même avec la tentative de connexion
        }
      }

      // Tentative de connexion
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToCheck,
        password,
      })
  
      if (error) {
        // Messages d'erreur en français avec distinction email/mot de passe
        if (error.message === 'Email not confirmed') {
          throw new Error('Email non confirmé. Vérifie tes emails.')
        } else if (error.message === 'Invalid login credentials') {
          // Si l'email existe, c'est le mot de passe qui est incorrect
          if (emailExists) {
            throw new Error('Mot de passe incorrect')
          } else {
            // Si l'email n'existe pas, c'est l'email qui est incorrect
            throw new Error('Aucun compte trouvé avec cet email')
          }
        }
        throw error
      }
  

      // Vérifier si l'utilisateur a une subscription active
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, stripe_subscription_id, plan_type')
        .eq('user_id', data.user.id)
        .maybeSingle()

      // Si pas de subscription, vérifier si un compte vient d'être créé (webhook en cours)
      // Dans ce cas, attendre un peu et synchroniser la subscription
      if (!subscription) {
        console.log('[login] Aucune subscription trouvée, tentative de synchronisation')
        try {
          const syncResponse = await fetch('/api/stripe/sync-subscription', {
            method: 'POST'
          })
          const syncData = await syncResponse.json()
          console.log('[login] Résultat synchronisation:', syncData)
          
          // Si la synchronisation a réussi, rediriger vers dashboard
          if (syncData.success || syncData.subscription) {
            router.push('/dashboard')
            return
          }
        } catch (syncError) {
          console.error('[login] Erreur synchronisation:', syncError)
        }
        
        // Si toujours pas de subscription après sync, rediriger vers pricing
        router.push('/register/pricing-choice')
        return
      }

      // Si subscription existe mais status invalide, rediriger vers pricing
      // MAIS: si stripe_subscription_id existe, c'est qu'un paiement a été fait, on accepte même si status est 'pending'
      if (subscription.status === 'canceled' || 
          subscription.status === 'past_due' ||
          (subscription.status === 'pending' && !subscription.stripe_subscription_id)) {
        router.push('/register/pricing-choice')
      } else {
        // Subscription active ou trialing → dashboard
        router.push('/dashboard')
      }
    } catch (error: any) {
      setError(error.message || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-richy-black via-richy-black to-richy-black-soft flex items-center justify-center px-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-richy-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-richy-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-6xl text-richy-gold mb-2">
            RICHY.AI
          </h1>
          <p className="text-gray-400">
            Ton assistant IA pour dominer le game SaaS
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-richy-black-soft/80 backdrop-blur-sm border border-richy-gold/20 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">
            Connexion
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                placeholder="ton@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Pas encore de compte ?{' '}
              <Link 
                href="/register" 
                className="text-richy-gold hover:text-richy-gold-light transition-colors font-medium"
              >
                Commencer l'essai gratuit
              </Link>
            </p>
          </div>

          {/* Trial info */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
              <span className="text-richy-gold">✓</span>
              <span>3 jours d'essai gratuit</span>
              <span className="text-richy-gold">✓</span>
              <span>Puis 49€/mois</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-8">
          En te connectant, tu acceptes nos conditions d'utilisation
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-richy-black via-richy-black to-richy-black-soft flex items-center justify-center px-4">
        <div className="text-richy-gold animate-pulse">Chargement...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}