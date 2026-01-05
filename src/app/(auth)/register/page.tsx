'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. Créer le compte
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(), // Nettoyer l'email
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: formData.full_name,
            company_name: formData.company_name
          }
        }
      })

      if (error) throw error

      if (data.user) {
        // 2. Update le profil avec les infos supplémentaires
        await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            company_name: formData.company_name
          })
          .eq('id', data.user.id)

        // 3. MODE DEV : Skip Stripe pour l'instant
        if (process.env.NEXT_PUBLIC_SKIP_STRIPE === 'true') {
          // En dev, on simule un customer Stripe
          await supabase
            .from('profiles')
            .update({
              stripe_customer_id: 'cus_dev_' + data.user.id.substring(0, 8),
              subscription_status: 'trialing'
            })
            .eq('id', data.user.id)
          
          router.push('/dashboard')
        } else {
          // En production : onboarding avec vraie CB
          router.push('/onboarding')
        }
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-richy-black via-richy-black to-richy-black-soft flex items-center justify-center px-4 py-12">
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
            Valide et construis ton SaaS comme un boss
          </p>
        </div>

        {/* Value Props */}
        <div className="bg-gradient-to-r from-richy-gold/20 to-richy-gold-dark/20 border border-richy-gold/30 rounded-xl p-4 mb-6">
          <h3 className="text-richy-gold font-bold mb-2">
            🎯 Essai gratuit 3 jours
          </h3>
          <ul className="space-y-1 text-sm text-gray-300">
            <li className="flex items-center">
              <span className="text-richy-gold mr-2">✓</span>
              Accès illimité aux 4 agents IA
            </li>
            <li className="flex items-center">
              <span className="text-richy-gold mr-2">✓</span>
              Validation instantanée de ton idée
            </li>
            <li className="flex items-center">
              <span className="text-richy-gold mr-2">✓</span>
              Roadmap personnalisée en 2 minutes
            </li>
            <li className="flex items-center">
              <span className="text-richy-gold mr-2">✓</span>
              Annulation à tout moment
            </li>
          </ul>
        </div>

        {/* Form Card */}
        <div className="bg-richy-black-soft/80 backdrop-blur-sm border border-richy-gold/20 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">
            Créer ton compte
          </h2>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                placeholder="ton@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mot de passe *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                placeholder="Minimum 6 caractères"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom complet
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Entreprise
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                placeholder="Ma Startup"
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
              {loading ? 'Création...' : 'Commencer l\'essai gratuit →'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Déjà un compte ?{' '}
              <Link 
                href="/login" 
                className="text-richy-gold hover:text-richy-gold-light transition-colors font-medium"
              >
                Se connecter
              </Link>
            </p>
          </div>

          {/* Payment info */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              💳 Carte bancaire requise • Pas de frais pendant 3 jours
              <br />
              Puis 49€/mois • Annulation instantanée
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}