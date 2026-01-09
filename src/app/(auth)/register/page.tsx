'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PhoneVerification from '@/components/PhoneVerification'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
    phone_number: '+33'
  })
  const [error, setError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'register' | 'phone-verify'>('register')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Validation du numéro de téléphone
  const validatePhoneNumber = (phone: string): { valid: boolean; error: string | null } => {
    // Enlever tous les espaces et caractères non numériques sauf +33
    const cleaned = phone.replace(/\s/g, '').replace(/[^\d+]/g, '')
    
    // Vérifier qu'il commence par +33
    if (!cleaned.startsWith('+33')) {
      return { valid: false, error: 'Le numéro doit commencer par +33' }
    }
    
    // Extraire les chiffres après +33
    const digits = cleaned.substring(3)
    
    // Vérifier qu'il n'y a que des chiffres
    if (!/^\d+$/.test(digits)) {
      return { valid: false, error: 'Le numéro ne doit contenir que des chiffres' }
    }
    
    // Vérifier la longueur (9 chiffres après +33 pour un numéro mobile français)
    if (digits.length < 9) {
      return { valid: false, error: `Il manque ${9 - digits.length} chiffre(s)` }
    }
    
    if (digits.length > 9) {
      return { valid: false, error: 'Le numéro contient trop de chiffres' }
    }
    
    // Vérifier que ça commence par 6 ou 7 (pas 0 ou 1)
    const firstDigit = digits.substring(0, 1)
    if (firstDigit === '0' || firstDigit === '1') {
      return { valid: false, error: 'Les numéros commençant par 0 ou 1 ne sont pas acceptés. Utilisez +336 ou +337' }
    }
    
    if (firstDigit !== '6' && firstDigit !== '7') {
      return { valid: false, error: 'Le numéro doit commencer par +336 ou +337' }
    }
    
    return { valid: true, error: null }
  }

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    
    setError(null)
    setEmailError(null)
    setPhoneError(null)
    setLoading(true)
    
    try {
      // 1. Vérifier d'abord si l'email existe déjà
      if (!formData.email || !formData.email.trim()) {
        setEmailError('L\'email est requis')
        setLoading(false)
        return
      }

      const emailToCheck = formData.email.trim().toLowerCase()
      console.log('[register] Vérification de l\'email:', emailToCheck)
      
      try {
        const emailCheckResponse = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailToCheck })
        })

        const emailCheckData = await emailCheckResponse.json()
        console.log('[register] Réponse vérification email:', {
          status: emailCheckResponse.status,
          ok: emailCheckResponse.ok,
          data: emailCheckData
        })

        if (!emailCheckResponse.ok) {
          const errorMsg = emailCheckData.error || 'Erreur lors de la vérification de l\'email'
          console.error('[register] Erreur vérification email:', errorMsg)
          setEmailError(errorMsg)
          setLoading(false)
          return
        }

        if (emailCheckData.alreadyUsed) {
          const errorMsg = emailCheckData.error || 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.'
          console.log('[register] Email déjà utilisé:', errorMsg)
          setEmailError(errorMsg)
          setLoading(false)
          return
        }

        console.log('[register] Email valide, continuation...')
      } catch (fetchError: any) {
        console.error('[register] Erreur fetch vérification email:', fetchError)
        setEmailError('Erreur lors de la vérification de l\'email. Veuillez réessayer.')
        setLoading(false)
        return
      }

      // 2. Valider le numéro de téléphone
      const phoneValidation = validatePhoneNumber(formData.phone_number)
      if (!phoneValidation.valid) {
        setPhoneError(phoneValidation.error)
        setLoading(false)
        return
      }
      
      setPhoneError(null)
      
      // 3. Si toutes les validations passent, passer à l'étape de vérification du téléphone
      if (step === 'register' && formData.phone_number && !phoneVerified) {
        setStep('phone-verify')
        setLoading(false)
        return
      }
      
      // Si on arrive ici, c'est qu'on a déjà vérifié le téléphone
      // Dans ce cas, on devrait déjà avoir été redirigé vers pricing-choice
      setError('Veuillez vérifier votre numéro de téléphone d\'abord')
    } catch (err: any) {
      console.error('Erreur lors de la vérification:', err)
      setError(err.message || 'Erreur lors de la vérification. Veuillez réessayer.')
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
          {step === 'register' ? (
            <>
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
                onChange={(e) => {
                  setFormData({...formData, email: e.target.value})
                  setEmailError(null) // Réinitialiser l'erreur quand l'utilisateur tape
                }}
                className={`w-full px-4 py-3 bg-richy-black border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  emailError ? 'border-red-500' : 'border-gray-700 focus:border-richy-gold'
                }`}
                placeholder="ton@email.com"
                required
              />
              {emailError && (
                <p className="text-xs text-red-400 mt-1">
                  {emailError}
                </p>
              )}
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
                Nom complet (facultatif)
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
                Entreprise (facultatif)
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
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => {
                  let value = e.target.value
                  // Enlever tous les espaces
                  value = value.replace(/\s/g, '')
                  
                  // Forcer +33 au début
                  if (!value.startsWith('+33')) {
                    value = '+33' + value.replace(/^\+33/, '').replace(/[^\d]/g, '')
                  } else {
                    // Garder seulement +33 et les chiffres après
                    value = '+33' + value.substring(3).replace(/[^\d]/g, '')
                  }
                  
                  // Limiter à 13 caractères (+33 + 10 chiffres)
                  if (value.length <= 13) {
                    setFormData({...formData, phone_number: value})
                    setPhoneError(null) // Réinitialiser l'erreur quand l'utilisateur tape
                  }
                }}
                onBlur={(e) => {
                  // Valider le numéro au blur
                  const validation = validatePhoneNumber(formData.phone_number)
                  if (!validation.valid) {
                    setPhoneError(validation.error)
                  } else {
                    setPhoneError(null)
                  }
                }}
                className={`w-full px-4 py-3 bg-richy-black border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  phoneError ? 'border-red-500' : 'border-gray-700 focus:border-richy-gold'
                }`}
                placeholder="+33612345678"
                required
              />
              {phoneError ? (
                <p className="text-xs text-red-400 mt-1">
                  {phoneError}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Format: +33612345678 (+336 ou +337 uniquement, 9 chiffres après +33)
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
              disabled={loading || !!phoneError || !!emailError || !validatePhoneNumber(formData.phone_number).valid || !formData.email.trim()}
              className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? 'Vérification...' : 'Suivant →'}
            </button>
          </form>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('register')}
                className="text-richy-gold hover:text-richy-gold-light mb-4 text-sm"
              >
                ← Retour
              </button>
              <PhoneVerification
                initialPhone={formData.phone_number}
                onVerified={async ({ phone, verificationId }) => {
                  setPhoneVerified(true)
                  
                  // IMPORTANT: Ne PAS créer le compte ici
                  // Stocker les infos d'inscription dans sessionStorage
                  // Le compte sera créé uniquement après le choix du plan et le checkout Stripe
                  try {
                    const registrationData = {
                      email: formData.email.trim().toLowerCase(),
                      password: formData.password,
                      full_name: formData.full_name,
                      company_name: formData.company_name,
                      phone_number: phone || formData.phone_number,
                      phone_verification_id: verificationId,
                      phone_verified: true
                    }
                    
                    // Stocker dans sessionStorage pour la page pricing-choice
                    sessionStorage.setItem('pending_registration', JSON.stringify(registrationData))
                    
                    console.log('[register] Infos d\'inscription stockées:', {
                      email: registrationData.email,
                      emailFromForm: formData.email,
                      phone: registrationData.phone_number,
                      verificationId: registrationData.phone_verification_id
                    })
                    console.log('[register] Redirection vers pricing-choice')
                    
                    // Rediriger vers la page de choix de plan
                    // Le compte sera créé lors du checkout Stripe
                    window.location.href = '/register/pricing-choice'
                  } catch (err: any) {
                    setError(err.message || 'Erreur lors de la préparation de l\'inscription')
                    setStep('register')
                  }
                }}
              />
            </>
          )}

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