'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PhoneVerification from '@/components/PhoneVerification'

export default function RegisterPage() {
  const [step, setStep] = useState<'email' | 'phone' | 'complete'>('email')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
    phone: '+33'
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Fonction pour valider et formater le numéro
  const validateAndFormatPhone = (value: string): { isValid: boolean; formatted: string; error: string } => {
    // Enlever tous les espaces, tirets, points
    let cleaned = value.replace(/[\s\-\.]/g, '')
    
    // Si l'utilisateur commence par 0, remplacer par +33
    if (cleaned.startsWith('0')) {
      cleaned = '+33' + cleaned.substring(1)
    }
    
    // S'assurer qu'on commence par +33
    if (!cleaned.startsWith('+33')) {
      if (cleaned.startsWith('33')) {
        cleaned = '+' + cleaned
      } else {
        cleaned = '+33' + cleaned
      }
    }
    
    // Vérifier le format : +33 suivi de 9 chiffres (numéro français)
    const phoneRegex = /^\+33[1-9]\d{8}$/
    
    if (!phoneRegex.test(cleaned)) {
      // Messages d'erreur spécifiques
      if (cleaned.length < 12) {
        return { isValid: false, formatted: cleaned, error: 'Numéro trop court. Format attendu : +33 6 12 34 56 78' }
      }
      if (cleaned.length > 12) {
        return { isValid: false, formatted: cleaned, error: 'Numéro trop long. Format attendu : +33 6 12 34 56 78' }
      }
      if (cleaned.startsWith('+330')) {
        return { isValid: false, formatted: cleaned, error: 'Ne commencez pas par 0 après +33. Utilisez directement le chiffre (ex: +33 6...)' }
      }
      return { isValid: false, formatted: cleaned, error: 'Format invalide. Format attendu : +33 6 12 34 56 78' }
    }
    
    return { isValid: true, formatted: cleaned, error: '' }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const validation = validateAndFormatPhone(value)
    
    setFormData({...formData, phone: validation.formatted})
    setPhoneError(validation.error)
    setError(null) // Clear l'erreur générale si on modifie
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPhoneError('')
    setLoading(true)

    // Valider le numéro avant de continuer
    const phoneValidation = validateAndFormatPhone(formData.phone)
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error)
      setLoading(false)
      return
    }

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

        // 3. Sauvegarder l'ID utilisateur et passer à l'étape de vérification téléphone
        setUserId(data.user.id)
        setStep('phone')
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  // Après vérification téléphone
  const handlePhoneVerified = async () => {
    // Initialiser le trial dans le profil
    const trialEndDate = new Date()
    trialEndDate.setDate(trialEndDate.getDate() + 3)

    if (userId) {
      await supabase
        .from('profiles')
        .update({
          trial_ends_at: trialEndDate.toISOString(),
          subscription_status: 'trialing'
        })
        .eq('id', userId)
    }

    // MODE DEV : Skip Stripe pour l'instant
    if (process.env.NEXT_PUBLIC_SKIP_STRIPE === 'true') {
      // En dev, on simule un customer Stripe
      if (userId) {
        await supabase
          .from('profiles')
          .update({
            stripe_customer_id: 'cus_dev_' + userId.substring(0, 8),
            subscription_status: 'trialing'
          })
          .eq('id', userId)
      }
      router.push('/dashboard')
    } else {
      // En production : rediriger vers Stripe checkout
      router.push('/onboarding')
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

        {/* Step 1: Email Signup Form */}
        {step === 'email' && (
          <>
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
                  Engagement 1 an (12 paiements de 49€)
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

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Numéro de téléphone *
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3 top-3 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      className={`w-full pl-10 pr-4 py-3 bg-richy-black border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                        phoneError ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-richy-gold'
                      }`}
                      placeholder="+33 6 12 34 56 78"
                      required
                    />
                  </div>
                  {phoneError ? (
                    <p className="text-xs text-red-400 mt-2">
                      {phoneError}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-2">
                      Format : +33 suivi de 9 chiffres (ex: +33 6 12 34 56 78)
                    </p>
                  )}
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
                  Puis 49€/mois • Engagement 1 an (12 paiements)
                </p>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Phone Verification */}
        {step === 'phone' && (
          <PhoneVerification 
            onVerified={handlePhoneVerified} 
            userId={userId}
            initialPhone={formData.phone}
          />
        )}
      </div>
    </div>
  )
}