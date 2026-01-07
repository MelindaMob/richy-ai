'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import UpgradeModal from '@/components/UpgradeModal'
import { DashboardHeader } from '../dashboard/dashboard-header'

export default function BuilderPage() {
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [technicalLevel, setTechnicalLevel] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [missingInfo, setMissingInfo] = useState<any>(null)
  const [headerData, setHeaderData] = useState<{
    trialDaysLeft: number
    userEmail: string
    subscriptionStatus: string
    hasTrialLimitations: boolean
  } | null>(null)
  const supabase = createClient()

  const descriptionLength = projectDescription.length

  // Récupérer les données pour le header
  useEffect(() => {
    const fetchHeaderData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.error('Error getting user:', userError)
          // Si erreur de réseau, ne pas bloquer l'interface
          if (userError.message?.includes('Failed to fetch')) {
            return
          }
        }
        
        if (!user) return

        // Récupérer le profil
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError && !profileError.message?.includes('Failed to fetch')) {
          console.error('Error fetching profile:', profileError)
        }

        // Récupérer la subscription
        const { data: subscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (subscriptionError && !subscriptionError.message?.includes('Failed to fetch')) {
          console.error('Error fetching subscription:', subscriptionError)
        }

        // Calculer les jours restants d'essai
        let trialDaysLeft = 0
        let subscriptionStatus = subscription?.status || 'pending'
        let hasTrialLimitations = !!subscription?.trial_limitations
        
        const isTrialPlan = subscription?.plan_type === 'trial'
        const isCurrentlyTrial = subscription?.trial_ends_at && new Date(subscription.trial_ends_at) > new Date()
        
        if (isTrialPlan) {
          hasTrialLimitations = true
          if (subscription?.trial_ends_at) {
            const trialEnd = new Date(subscription.trial_ends_at)
            const now = new Date()
            trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          } else if (subscription?.created_at) {
            const createdAt = new Date(subscription.created_at)
            const trialEnd = new Date(createdAt)
            trialEnd.setDate(trialEnd.getDate() + 3)
            const now = new Date()
            trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          } else {
            trialDaysLeft = 3
          }
          if (subscriptionStatus !== 'trialing') {
            subscriptionStatus = 'trialing'
          }
        } else if (isCurrentlyTrial) {
          hasTrialLimitations = true
          const trialEnd = new Date(subscription.trial_ends_at)
          const now = new Date()
          trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        }

        setHeaderData({
          trialDaysLeft,
          userEmail: profile?.email || user.email || '',
          subscriptionStatus,
          hasTrialLimitations
        })
      } catch (error: any) {
        // Ne pas bloquer l'interface en cas d'erreur réseau
        if (error?.message?.includes('Failed to fetch') || error instanceof TypeError) {
          console.warn('Network error fetching header data (non-blocking):', error)
          return
        }
        console.error('Error fetching header data:', error)
      }
    }

    fetchHeaderData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setShowUpgradeModal(false)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        if (authError.message?.includes('Failed to fetch')) {
          alert('Erreur de connexion. Veuillez vérifier votre connexion internet et réessayer.')
          setLoading(false)
          return
        }
      }
      
      if (!user) {
        alert('Non autorisé')
        setLoading(false)
        return
      }

      const res = await fetch('/api/agents/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                project_name: projectName, 
                                project_description: projectDescription, 
                                budget, 
                                timeline, 
                                technical_level: technicalLevel
                              })
      })

      const data = await res.json()
      
      console.log('📥 Réponse API reçue:', data)
      
      if (res.status === 403 && data.showUpgrade) {
        setShowUpgradeModal(true)
        return
      }
      
      // Si la description n'est pas assez détaillée, afficher ce qui manque
      if (data.needsMoreInfo) {
        setMissingInfo(data)
        setLoading(false)
        return
      }
      
      if (data.success) {
        console.log('✅ Résultat reçu:', data.result)
        setResult(data.result)
        setMissingInfo(null)
      } else {
        console.error('❌ Erreur:', data.error)
        alert(data.error || 'Erreur lors de la génération')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Erreur lors de la génération')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft">
      {/* Header */}
      {headerData && (
        <DashboardHeader 
          trialDaysLeft={headerData.trialDaysLeft}
          userEmail={headerData.userEmail}
          subscriptionStatus={headerData.subscriptionStatus}
          hasTrialLimitations={headerData.hasTrialLimitations}
        />
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold text-richy-gold mb-8">
          🚀 Richy.builder
        </h1>

        {!result ? (
          <>
            {/* Page complète d'information manquante */}
            {missingInfo ? (
              <div className="bg-gradient-to-br from-richy-black-soft to-richy-black border border-gray-800 rounded-2xl p-8 md:p-12 shadow-2xl">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-richy-black" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-richy-gold mb-3">
                      Il me faut plus d'informations
                    </h2>
                    <p className="text-gray-300 text-lg mb-2">
                      Ta description est trop vague pour créer une roadmap précise et adaptée à ton projet. J'ai besoin de détails concrets sur le problème résolu, les fonctionnalités, et la cible pour t'aider efficacement.
                    </p>
                    {missingInfo.suggestions && (
                      <p className="text-yellow-400 font-semibold mb-6">
                        💡 {missingInfo.suggestions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Questions sur ce qui manque */}
                {missingInfo.missingElements && missingInfo.missingElements.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <span className="text-richy-gold">❓</span>
                      Questions à clarifier :
                    </h3>
                    <div className="space-y-3">
                      {missingInfo.missingElements.map((element: string, i: number) => (
                        <div key={i} className="bg-richy-black/50 border-l-4 border-richy-gold rounded-lg p-4">
                          <p className="text-white flex items-start gap-3">
                            <span className="text-richy-gold font-bold text-lg mt-0.5">{i + 1}.</span>
                            <span className="flex-1">{element}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exemples */}
                {missingInfo.examples && missingInfo.examples.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <span className="text-richy-gold">📝</span>
                      Exemples de descriptions complètes :
                    </h3>
                    <div className="space-y-4">
                      {missingInfo.examples.map((example: string, i: number) => (
                        <div key={i} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border border-gray-700 rounded-lg p-5">
                          <p className="text-gray-300 leading-relaxed whitespace-pre-line">{example}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Boutons d'action */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setMissingInfo(null)
                      // Scroll vers le champ description
                      setTimeout(() => {
                        const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement
                        if (textarea) {
                          textarea.focus()
                          textarea.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }, 100)
                    }}
                    className="flex-1 px-8 py-4 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold rounded-lg hover:scale-105 transition-all shadow-lg hover:shadow-xl hover:shadow-richy-gold/30 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Compléter la description
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true)
                      setMissingInfo(null)
                      
                      try {
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) {
                          alert('Non autorisé')
                          return
                        }

                        const res = await fetch('/api/agents/builder', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            project_name: projectName, 
                            project_description: projectDescription, 
                            budget, 
                            timeline, 
                            technical_level: technicalLevel,
                            skip_validation: true
                          })
                        })

                        const data = await res.json()
                        
                        if (res.status === 403 && data.showUpgrade) {
                          setShowUpgradeModal(true)
                          setLoading(false)
                          return
                        }
                        
                        if (data.success) {
                          setResult(data.result)
                        } else {
                          alert(data.error || 'Erreur lors de la génération')
                        }
                      } catch (error) {
                        console.error('Error:', error)
                        alert('Erreur lors de la génération')
                      } finally {
                        setLoading(false)
                      }
                    }}
                    className="flex-1 px-8 py-4 bg-richy-black-soft border-2 border-gray-600 text-white font-bold rounded-lg hover:border-richy-gold hover:text-richy-gold transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Générer quand même
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom du projet *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-richy-black border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                  placeholder="Ex: TaskMaster"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description détaillée *
                </label>
                <textarea
                  name="description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full bg-richy-black border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors min-h-[120px]"
                  placeholder="Décris ton projet en détail : problème résolu, solution proposée, cible, fonctionnalités principales, modèle économique"
                  required
                />
                <div className="mt-2 flex items-start gap-2 text-yellow-400 text-sm">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                  <p>Plus ta description est détaillée, plus la roadmap sera précise et adaptée</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Budget disponible *
                </label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-richy-black border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-richy-gold transition-colors"
                  required
                >
                  <option value="">Sélectionner...</option>
                  <option value="0-5k">0 - 5k€</option>
                  <option value="5k-10k">5k - 10k€</option>
                  <option value="10k-25k">10k - 25k€</option>
                  <option value="25k+">25k€+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Timeline souhaitée *
                </label>
                <select
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  className="w-full bg-richy-black border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-richy-gold transition-colors"
                  required
                >
                  <option value="">Sélectionner...</option>
                  <option value="1-month">1 mois</option>
                  <option value="2-months">2 mois</option>
                  <option value="3-months">3 mois</option>
                  <option value="6-months">6 mois</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Niveau technique *
                </label>
                <div className="flex gap-3">
                  {['débutant', 'intermédiaire', 'expert'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setTechnicalLevel(level)}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                        technicalLevel === level
                          ? 'bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black border-2 border-richy-gold'
                          : 'bg-richy-black border border-gray-700 text-white hover:border-richy-gold/50'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
                {!technicalLevel && (
                  <p className="text-red-400 text-xs mt-2">⚠️ Veuillez sélectionner un niveau technique</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !budget || !timeline || !technicalLevel}
                className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-4 px-6 rounded-lg hover:scale-[1.02] hover:shadow-xl hover:shadow-richy-gold/30 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Création de la roadmap... (30-60 secondes)
                  </span>
                ) : (
                  'Générer la roadmap →'
                )}
              </button>
              </form>
            )}
          </>
        ) : (
          <div className="space-y-8">
            {/* Debug: Afficher la structure reçue */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mb-4 p-4 bg-richy-black/50 border border-yellow-500/20 rounded-lg">
                <summary className="text-yellow-400 cursor-pointer font-semibold">🔍 Debug: Structure reçue</summary>
                <pre className="mt-2 text-xs text-gray-400 overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            )}
            
            {/* MVP Definition */}
            {result.mvp_definition && (
              <div className="bg-gradient-to-br from-richy-black-soft to-richy-black border border-richy-gold/30 rounded-2xl p-8 shadow-2xl shadow-richy-gold/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center text-2xl">
                    🎯
                  </div>
                  <h2 className="text-3xl font-bold text-richy-gold">Définition du MVP</h2>
                </div>
                
                <div className="space-y-6">
                  {/* Durée estimée */}
                  {result.mvp_definition.duration && (
                    <div className="flex items-center gap-3 p-4 bg-richy-black/50 rounded-xl border border-gray-700">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-400">Durée estimée</p>
                        <p className="text-lg font-semibold text-white">{result.mvp_definition.duration}</p>
                      </div>
                    </div>
                  )}

                  {/* Features incluses */}
                  {result.mvp_definition.features && result.mvp_definition.features.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <h3 className="text-xl font-bold text-green-400">Features incluses</h3>
                      </div>
                      <div className="bg-richy-black/50 rounded-xl p-6 border border-green-500/20">
                        <ul className="space-y-3">
                          {result.mvp_definition.features.map((f: string, i: number) => (
                            <li key={i} className="flex items-start gap-3 text-white">
                              <span className="text-green-400 mt-1">→</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Features exclues */}
                  {result.mvp_definition.excluded && result.mvp_definition.excluded.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <h3 className="text-xl font-bold text-red-400">Features exclues</h3>
                      </div>
                      <div className="bg-richy-black/50 rounded-xl p-6 border border-red-500/20">
                        <ul className="space-y-3">
                          {result.mvp_definition.excluded.map((e: string, i: number) => (
                            <li key={i} className="flex items-start gap-3 text-gray-300">
                              <span className="text-red-400 mt-1">→</span>
                              <span>{e}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stack Technique */}
            {result.technical_stack && (
              <div className="bg-gradient-to-br from-richy-black-soft to-richy-black border border-richy-gold/30 rounded-2xl p-8 shadow-2xl shadow-richy-gold/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center text-2xl">
                    ⚙️
                  </div>
                  <h2 className="text-3xl font-bold text-richy-gold">Stack Technique</h2>
                </div>
                
                <div className="space-y-4">
                  {/* Frontend */}
                  {result.technical_stack.frontend && (
                    <div className="bg-richy-black/50 rounded-xl p-6 border border-blue-500/20">
                      <h3 className="text-blue-400 font-bold text-lg mb-3 flex items-center gap-2">
                        <span>Frontend</span>
                      </h3>
                      <p className="text-gray-300 leading-relaxed">{result.technical_stack.frontend}</p>
                    </div>
                  )}
                  
                  {/* Backend */}
                  {result.technical_stack.backend && (
                    <div className="bg-richy-black/50 rounded-xl p-6 border border-green-500/20">
                      <h3 className="text-green-400 font-bold text-lg mb-3 flex items-center gap-2">
                        <span>Backend</span>
                      </h3>
                      <p className="text-gray-300 leading-relaxed">{result.technical_stack.backend}</p>
                    </div>
                  )}
                  
                  {/* Database */}
                  {result.technical_stack.database && (
                    <div className="bg-richy-black/50 rounded-xl p-6 border border-purple-500/20">
                      <h3 className="text-purple-400 font-bold text-lg mb-3 flex items-center gap-2">
                        <span>Database</span>
                      </h3>
                      <p className="text-gray-300 leading-relaxed">{result.technical_stack.database}</p>
                    </div>
                  )}
                  
                  {/* Hosting */}
                  {result.technical_stack.hosting && (
                    <div className="bg-richy-black/50 rounded-xl p-6 border border-cyan-500/20">
                      <h3 className="text-cyan-400 font-bold text-lg mb-3 flex items-center gap-2">
                        <span>Hébergement</span>
                      </h3>
                      <p className="text-gray-300 leading-relaxed">{result.technical_stack.hosting}</p>
                    </div>
                  )}
                  
                  {/* Services tiers */}
                  {result.technical_stack.third_party_services && result.technical_stack.third_party_services.length > 0 && (
                    <div className="bg-richy-black/50 rounded-xl p-6 border border-pink-500/20">
                      <h3 className="text-pink-400 font-bold text-lg mb-4 flex items-center gap-2">
                        <span>Services tiers</span>
                      </h3>
                      <ul className="space-y-2">
                        {result.technical_stack.third_party_services.map((service: string, i: number) => (
                          <li key={i} className="flex items-start gap-3 text-gray-300">
                            <span className="text-pink-400 mt-1">→</span>
                            <span>{service}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Difficulté */}
            {result.difficulty && (
              <div className="bg-gradient-to-br from-richy-black-soft to-richy-black border border-richy-gold/30 rounded-2xl p-8 shadow-2xl shadow-richy-gold/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl">
                    📊
                  </div>
                  <h2 className="text-3xl font-bold text-richy-gold">Difficulté du Projet</h2>
                </div>
                
                <div className="bg-richy-black/50 rounded-xl p-6 border border-indigo-500/20">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Score de difficulté</span>
                        <span className="text-3xl font-bold text-indigo-400">{result.difficulty.score || 0}/10</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all"
                          style={{ width: `${((result.difficulty.score || 0) / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  {result.difficulty.explanation && (
                    <p className="text-gray-300 leading-relaxed mt-4">{result.difficulty.explanation}</p>
                  )}
                </div>
              </div>
            )}

            {/* Roadmap */}
            {result.roadmap && result.roadmap.sprints && result.roadmap.sprints.length > 0 && (
              <div className="bg-gradient-to-br from-richy-black-soft to-richy-black border border-richy-gold/30 rounded-2xl p-8 shadow-2xl shadow-richy-gold/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center text-2xl">
                    🗺️
                  </div>
                  <h2 className="text-3xl font-bold text-richy-gold">Roadmap Sprint par Sprint</h2>
                </div>
                
                <div className="space-y-6">
                  {result.roadmap.sprints.map((sprint: any, i: number) => (
                    <div key={i} className="bg-richy-black/50 rounded-xl p-6 border border-blue-500/20 hover:border-blue-400/40 transition-all">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="bg-blue-500/20 px-4 py-2 rounded-lg text-sm font-bold text-blue-400">Sprint {i + 1}</span>
                        <h3 className="text-xl font-bold text-blue-400">
                          {sprint.name || sprint.title}
                        </h3>
                      </div>
                      
                      {/* Description du sprint */}
                      {sprint.description && (
                        <div className="mb-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                          <p className="text-white leading-relaxed">{sprint.description}</p>
                        </div>
                      )}
                      
                      {/* Tâches du sprint */}
                      {Array.isArray(sprint.tasks) && sprint.tasks.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-400 mb-3">Tâches à réaliser :</h4>
                          <ul className="space-y-2">
                            {sprint.tasks.map((task: string, taskIndex: number) => (
                              <li key={taskIndex} className="flex items-start gap-3 text-gray-300">
                                <span className="text-blue-400 mt-1">→</span>
                                <span>{task}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Launch Plan */}
            {result.launch_plan && (
              <div className="bg-gradient-to-br from-richy-black-soft to-richy-black border border-richy-gold/30 rounded-2xl p-8 shadow-2xl shadow-richy-gold/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-600 rounded-xl flex items-center justify-center text-2xl">
                    🚀
                  </div>
                  <h2 className="text-3xl font-bold text-richy-gold">Plan de Lancement</h2>
                </div>
                
                <div className="space-y-6">
                  {result.launch_plan.pre_lancement && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <h3 className="text-xl font-bold text-yellow-400">Pré-lancement</h3>
                      </div>
                      <div className="bg-richy-black/50 rounded-xl p-6 border border-yellow-500/20">
                        {Array.isArray(result.launch_plan.pre_lancement) ? (
                          <ul className="space-y-2">
                            {result.launch_plan.pre_lancement.map((item: string, i: number) => (
                              <li key={i} className="flex items-start gap-3 text-white">
                                <span className="text-yellow-400 mt-1">→</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-300">{result.launch_plan.pre_lancement}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {result.launch_plan.jour_j && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <h3 className="text-xl font-bold text-green-400">Jour J</h3>
                      </div>
                      <div className="bg-richy-black/50 rounded-xl p-6 border border-green-500/20">
                        {Array.isArray(result.launch_plan.jour_j) ? (
                          <ul className="space-y-2">
                            {result.launch_plan.jour_j.map((item: string, i: number) => (
                              <li key={i} className="flex items-start gap-3 text-white">
                                <span className="text-green-400 mt-1">→</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-300">{result.launch_plan.jour_j}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {result.launch_plan.post_lancement && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="text-xl font-bold text-blue-400">Post-lancement</h3>
                      </div>
                      <div className="bg-richy-black/50 rounded-xl p-6 border border-blue-500/20">
                        {Array.isArray(result.launch_plan.post_lancement) ? (
                          <ul className="space-y-2">
                            {result.launch_plan.post_lancement.map((item: string, i: number) => (
                              <li key={i} className="flex items-start gap-3 text-white">
                                <span className="text-blue-400 mt-1">→</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-300">{result.launch_plan.post_lancement}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {result.launch_plan.kpis && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="text-xl font-bold text-purple-400">KPIs à tracker</h3>
                      </div>
                      <div className="bg-richy-black/50 rounded-xl p-6 border border-purple-500/20">
                        {Array.isArray(result.launch_plan.kpis) ? (
                          <ul className="space-y-3">
                            {result.launch_plan.kpis.map((kpi: string, i: number) => (
                              <li key={i} className="flex items-start gap-3 text-white">
                                <span className="text-purple-400 mt-1">→</span>
                                <span>{kpi}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-300">{result.launch_plan.kpis}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <button
                onClick={() => setResult(null)}
                className="bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-4 px-8 rounded-xl hover:scale-105 transition-all shadow-lg hover:shadow-xl hover:shadow-richy-gold/30"
              >
                Nouvelle roadmap
              </button>
            </div>
          </div>
        )}
      </main>

      {showUpgradeModal && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  )
}
