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
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'register' | 'phone-verify'>('register')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    
    // Si pas encore vérifié le téléphone, passer à l'étape de vérification
    if (step === 'register' && formData.phone_number && !phoneVerified) {
      setStep('phone-verify')
      return
    }
    
    setError(null)
    setLoading(true)

    try {
      // 1. Créer le compte
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(), // Nettoyer l'email
        password: formData.password,
        options: {
          // Ne pas rediriger vers dashboard - l'utilisateur doit choisir son plan
          emailRedirectTo: `${window.location.origin}/register/pricing-choice`,
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
            company_name: formData.company_name,
            phone_number: formData.phone_number
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
          // En production : choix du plan
          router.push('/register/pricing-choice')
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
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => {
                  let value = e.target.value
                  // Forcer +33 au début
                  if (!value.startsWith('+33')) {
                    value = '+33' + value.replace(/^\+33/, '')
                  }
                  // Limiter à 17 caractères max
                  if (value.length <= 17) {
                    setFormData({...formData, phone_number: value})
                  }
                }}
                onBlur={(e) => {
                  // Formater automatiquement avec espaces
                  let value = e.target.value.replace(/\s/g, '')
                  if (value.startsWith('+33') && value.length > 3) {
                    const number = value.substring(3)
                    if (number.length >= 1) {
                      const formatted = '+33 ' + number.match(/.{1,2}/g)?.join(' ') || number
                      setFormData({...formData, phone_number: formatted})
                    }
                  }
                }}
                className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                placeholder="+33 6 12 34 56 78"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: +33 6 12 34 56 78 (numéro français uniquement)
              </p>
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
              {loading ? 'Création...' : 'Suivant →'}
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
                onVerified={async () => {
                  setPhoneVerified(true)
                  // Continuer avec l'inscription après vérification
                  setLoading(true)
                  try {
                    const { data, error } = await supabase.auth.signUp({
                      email: formData.email.trim().toLowerCase(),
                      password: formData.password,
                      options: {
                        // Ne pas rediriger vers dashboard - l'utilisateur doit choisir son plan
                        emailRedirectTo: `${window.location.origin}/register/pricing-choice`,
                        data: {
                          full_name: formData.full_name,
                          company_name: formData.company_name
                        }
                      }
                    })

                    if (error) throw error

                    if (data.user) {
                      // Mettre à jour le profil avec les infos
                      await supabase
                        .from('profiles')
                        .update({
                          full_name: formData.full_name,
                          company_name: formData.company_name,
                          phone_number: formData.phone_number
                        })
                        .eq('id', data.user.id)

                      // IMPORTANT: Ne PAS créer de subscription ici
                      // L'utilisateur DOIT choisir son plan sur pricing-choice
                      // C'est cette page qui créera la subscription via Stripe
                      
                      // IMPORTANT: Ne JAMAIS créer de subscription ici
                      // L'utilisateur DOIT choisir son plan sur pricing-choice
                      // Aucune subscription dans la table subscriptions ne doit exister
                      
                      if (process.env.NEXT_PUBLIC_SKIP_STRIPE === 'true') {
                        // Mode dev uniquement - créer une subscription trial pour les tests
                        await supabase
                          .from('subscriptions')
                          .insert({
                            user_id: data.user.id,
                            stripe_customer_id: 'cus_dev_' + data.user.id.substring(0, 8),
                            status: 'trialing',
                            plan_type: 'trial',
                            trial_limitations: {
                              chat_messages: 5,
                              validator_uses: 1,
                              prompt_uses: 0,
                              builder_uses: 0
                            },
                            trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
                          })
                        
                        await supabase
                          .from('profiles')
                          .update({
                            stripe_customer_id: 'cus_dev_' + data.user.id.substring(0, 8),
                            subscription_status: 'trialing'
                          })
                          .eq('id', data.user.id)
                        
                        router.push('/dashboard')
                      } else {
                        // PRODUCTION: Rediriger OBLIGATOIREMENT vers le choix de plan
                        // AUCUNE subscription créée - l'utilisateur DOIT choisir son plan
                        // Utiliser window.location.href pour forcer la redirection (pas router.push)
                        console.log('[register] Redirection vers pricing-choice - aucune subscription créée')
                        setTimeout(() => {
                          window.location.href = '/register/pricing-choice'
                        }, 500)
                      }
                    }
                  } catch (err: any) {
                    setError(err.message || 'Erreur lors de l\'inscription')
                    setStep('register')
                  } finally {
                    setLoading(false)
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