'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface BuilderResult {
  mvp_definition: {
    features: string[]
    excluded: string[]
    duration: string
  }
  tech_stack: {
    frontend: string
    backend: string
    database: string
    hosting: string
    third_party: string[]
  }
  roadmap: {
    sprint_1: string[]
    sprint_2: string[]
    sprint_3: string[]
    sprint_4: string[]
  }
  launch_plan: {
    pre_launch: string[]
    launch_day: string[]
    post_launch: string[]
    kpis: string[]
  }
}

interface ValidationFeedback {
  message: string
  missing_elements: string[]
  questions: string[]
  suggestions: string[]
  example_format?: string
}

export default function BuilderPage() {
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [technicalLevel, setTechnicalLevel] = useState('intermediate')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BuilderResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validationFeedback, setValidationFeedback] = useState<ValidationFeedback | null>(null)
  const [skipValidation, setSkipValidation] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleBuild = async (e: React.FormEvent, forceGeneration = false) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    setValidationFeedback(null)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/agents/builder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          project_name: projectName,
          project_description: projectDescription,
          budget,
          timeline,
          technical_level: technicalLevel,
          skip_validation: forceGeneration || skipValidation
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la génération')
      }

      // Si l'IA demande plus d'infos
      if (data.needs_more_info) {
        setValidationFeedback(data.feedback)
      } else {
        // Sinon, on a la roadmap
        setResult(data.result)
        setValidationFeedback(null)
      }
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrichDescription = () => {
    // Pré-remplir avec l'exemple donné par l'IA
    if (validationFeedback?.example_format) {
      setProjectDescription(projectDescription + '\n\n' + validationFeedback.example_format)
      setValidationFeedback(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft">
      {/* Header */}
      <header className="border-b border-richy-gold/20 bg-richy-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="font-display text-3xl text-richy-gold hover:text-richy-gold-light transition-colors">
              RICHY.AI
            </Link>
            <span className="text-gray-400">•</span>
            <span className="text-white font-semibold">🚀 Builder</span>
          </div>
          
          <nav className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← Dashboard
            </Link>
            <Link href="/chat" className="text-gray-400 hover:text-white transition-colors text-sm">
              Chat
            </Link>
            <Link href="/validator" className="text-gray-400 hover:text-white transition-colors text-sm">
              Validator
            </Link>
            <Link href="/prompt" className="text-gray-400 hover:text-white transition-colors text-sm">
              Prompt
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-3 flex items-center">
            <span className="text-richy-gold mr-3">🚀</span>
            Richy.builder
          </h1>
          <p className="text-xl text-gray-400">
            Génère ta roadmap complète : MVP, stack technique, planning sprint par sprint.
          </p>
        </div>

        {/* Validation Feedback */}
        {validationFeedback && (
          <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-600/40 rounded-xl p-6 mb-6 animate-slide-up">
            <div className="flex items-start space-x-3">
              <span className="text-3xl">💡</span>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-yellow-400 mb-3">
                  {validationFeedback.message}
                </h3>
                
                {/* Questions à répondre */}
                <div className="mb-4">
                  <h4 className="text-richy-gold font-semibold mb-2">Questions à clarifier :</h4>
                  <ul className="space-y-2">
                    {validationFeedback.questions.map((question, i) => (
                      <li key={i} className="text-gray-300 flex items-start">
                        <span className="text-yellow-400 mr-2">→</span>
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Éléments manquants */}
                {validationFeedback.missing_elements.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-richy-gold font-semibold mb-2">Éléments manquants :</h4>
                    <div className="flex flex-wrap gap-2">
                      {validationFeedback.missing_elements.map((element, i) => (
                        <span key={i} className="px-3 py-1 bg-yellow-900/30 border border-yellow-600/30 rounded-full text-sm text-yellow-300">
                          {element}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {validationFeedback.suggestions.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-richy-gold font-semibold mb-2">Conseils :</h4>
                    <ul className="space-y-1">
                      {validationFeedback.suggestions.map((suggestion, i) => (
                        <li key={i} className="text-gray-400 text-sm">
                          • {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleEnrichDescription}
                    className="px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/40 rounded-lg text-yellow-400 font-medium transition-colors"
                  >
                    Utiliser l'exemple
                  </button>
                  <button
                    onClick={(e) => handleBuild(e, true)}
                    className="px-4 py-2 bg-richy-gold/20 hover:bg-richy-gold/30 border border-richy-gold/40 rounded-lg text-richy-gold font-medium transition-colors"
                  >
                    Générer quand même →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {!result && (
          <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8">
            <form onSubmit={handleBuild} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom du projet *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                  placeholder="Ex: MarketPlace AI"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description détaillée * {projectDescription.length < 100 && (
                    <span className="text-yellow-400 text-xs ml-2">
                      (Min. 100 caractères pour une roadmap précise - actuellement: {projectDescription.length})
                    </span>
                  )}
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className={`w-full px-4 py-3 bg-richy-black border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors min-h-[160px] ${
                    projectDescription.length < 100 ? 'border-yellow-600/50 focus:border-yellow-600' : 'border-gray-700 focus:border-richy-gold'
                  }`}
                  placeholder="Décris ton projet en détail : problème résolu, solution proposée, cible, fonctionnalités principales, modèle économique..."
                  required
                  disabled={loading}
                />
                {projectDescription.length > 0 && projectDescription.length < 100 && (
                  <p className="text-yellow-400 text-xs mt-1">
                    💡 Plus ta description est détaillée, plus la roadmap sera précise et adaptée
                  </p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Budget disponible
                  </label>
                  <select
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white focus:outline-none focus:border-richy-gold transition-colors"
                    disabled={loading}
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
                    Timeline souhaitée
                  </label>
                  <select
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white focus:outline-none focus:border-richy-gold transition-colors"
                    disabled={loading}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="1-month">1 mois</option>
                    <option value="2-months">2 mois</option>
                    <option value="3-months">3 mois</option>
                    <option value="6-months">6 mois</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Niveau technique
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      value="beginner"
                      checked={technicalLevel === 'beginner'}
                      onChange={(e) => setTechnicalLevel(e.target.value)}
                      className="sr-only"
                      disabled={loading}
                    />
                    <div className={`p-3 rounded-lg border text-center transition-all ${
                      technicalLevel === 'beginner' 
                        ? 'border-richy-gold bg-richy-gold/20 text-richy-gold' 
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    }`}>
                      Débutant
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      value="intermediate"
                      checked={technicalLevel === 'intermediate'}
                      onChange={(e) => setTechnicalLevel(e.target.value)}
                      className="sr-only"
                      disabled={loading}
                    />
                    <div className={`p-3 rounded-lg border text-center transition-all ${
                      technicalLevel === 'intermediate' 
                        ? 'border-richy-gold bg-richy-gold/20 text-richy-gold' 
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    }`}>
                      Intermédiaire
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      value="expert"
                      checked={technicalLevel === 'expert'}
                      onChange={(e) => setTechnicalLevel(e.target.value)}
                      className="sr-only"
                      disabled={loading}
                    />
                    <div className={`p-3 rounded-lg border text-center transition-all ${
                      technicalLevel === 'expert' 
                        ? 'border-richy-gold bg-richy-gold/20 text-richy-gold' 
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    }`}>
                      Expert
                    </div>
                  </label>
                </div>
              </div>

              {/* Option pour forcer la génération */}
              {projectDescription.length < 100 && projectDescription.length > 0 && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="skipValidation"
                    checked={skipValidation}
                    onChange={(e) => setSkipValidation(e.target.checked)}
                    className="rounded border-gray-700 bg-richy-black text-richy-gold focus:ring-richy-gold"
                  />
                  <label htmlFor="skipValidation" className="text-sm text-gray-400">
                    Générer directement sans validation (moins précis)
                  </label>
                </div>
              )}

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-4 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {validationFeedback ? 'Génération forcée...' : 'Création de la roadmap...'}
                  </span>
                ) : (
                  'Créer ma roadmap →'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-slide-up">
            {/* MVP Definition */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-richy-gold mb-6 flex items-center">
                <span className="mr-3">🎯</span>
                Définition du MVP
              </h2>
              
              <div className="mb-6">
                <p className="text-richy-gold font-semibold mb-2">⏱️ Durée estimée:</p>
                <p className="text-white text-lg">{result.mvp_definition.duration}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-green-400 font-semibold mb-3">✅ Features incluses</h3>
                  <ul className="space-y-2">
                    {result.mvp_definition.features.map((feature, i) => (
                      <li key={i} className="text-gray-300 flex items-start">
                        <span className="text-green-400 mr-2">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-red-400 font-semibold mb-3">❌ Features exclues</h3>
                  <ul className="space-y-2">
                    {result.mvp_definition.excluded.map((excluded, i) => (
                      <li key={i} className="text-gray-400 flex items-start">
                        <span className="text-red-400 mr-2">•</span>
                        {excluded}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Tech Stack */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-richy-gold mb-6 flex items-center">
                <span className="mr-3">🛠️</span>
                Stack Technique
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="mb-4">
                    <p className="text-blue-400 font-semibold mb-2">Frontend</p>
                    <p className="text-white bg-richy-black rounded-lg p-3">{result.tech_stack.frontend}</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-green-400 font-semibold mb-2">Backend</p>
                    <p className="text-white bg-richy-black rounded-lg p-3">{result.tech_stack.backend}</p>
                  </div>
                  <div>
                    <p className="text-purple-400 font-semibold mb-2">Database</p>
                    <p className="text-white bg-richy-black rounded-lg p-3">{result.tech_stack.database}</p>
                  </div>
                </div>
                <div>
                  <div className="mb-4">
                    <p className="text-orange-400 font-semibold mb-2">Hosting</p>
                    <p className="text-white bg-richy-black rounded-lg p-3">{result.tech_stack.hosting}</p>
                  </div>
                  <div>
                    <p className="text-yellow-400 font-semibold mb-2">Services tiers</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {result.tech_stack.third_party.map((service, i) => (
                        <span key={i} className="px-3 py-1 bg-richy-black rounded-full text-sm text-gray-300 border border-gray-700">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Roadmap */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-richy-gold mb-6 flex items-center">
                <span className="mr-3">📅</span>
                Roadmap Sprint par Sprint
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-900/10">
                  <h3 className="text-blue-400 font-bold mb-3">Sprint 1 - Fondations</h3>
                  <ul className="space-y-2">
                    {result.roadmap.sprint_1.map((task, i) => (
                      <li key={i} className="text-gray-300 text-sm flex items-start">
                        <span className="text-blue-400 mr-2">→</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="border border-green-500/30 rounded-lg p-4 bg-green-900/10">
                  <h3 className="text-green-400 font-bold mb-3">Sprint 2 - Core Features</h3>
                  <ul className="space-y-2">
                    {result.roadmap.sprint_2.map((task, i) => (
                      <li key={i} className="text-gray-300 text-sm flex items-start">
                        <span className="text-green-400 mr-2">→</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-900/10">
                  <h3 className="text-purple-400 font-bold mb-3">Sprint 3 - Polish</h3>
                  <ul className="space-y-2">
                    {result.roadmap.sprint_3.map((task, i) => (
                      <li key={i} className="text-gray-300 text-sm flex items-start">
                        <span className="text-purple-400 mr-2">→</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="border border-orange-500/30 rounded-lg p-4 bg-orange-900/10">
                  <h3 className="text-orange-400 font-bold mb-3">Sprint 4 - Launch Prep</h3>
                  <ul className="space-y-2">
                    {result.roadmap.sprint_4.map((task, i) => (
                      <li key={i} className="text-gray-300 text-sm flex items-start">
                        <span className="text-orange-400 mr-2">→</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Launch Plan */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-richy-gold mb-6 flex items-center">
                <span className="mr-3">🚀</span>
                Plan de Lancement
              </h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-yellow-400 font-bold mb-3">📢 Pré-lancement</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {result.launch_plan.pre_launch.map((action, i) => (
                      <div key={i} className="flex items-start">
                        <span className="text-yellow-400 mr-2">•</span>
                        <span className="text-gray-300 text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-green-400 font-bold mb-3">🎉 Jour J</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {result.launch_plan.launch_day.map((action, i) => (
                      <div key={i} className="flex items-start">
                        <span className="text-green-400 mr-2">•</span>
                        <span className="text-gray-300 text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-blue-400 font-bold mb-3">📈 Post-lancement</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {result.launch_plan.post_launch.map((action, i) => (
                      <div key={i} className="flex items-start">
                        <span className="text-blue-400 mr-2">•</span>
                        <span className="text-gray-300 text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-purple-400 font-bold mb-3">📊 KPIs à suivre</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {result.launch_plan.kpis.map((kpi, i) => (
                      <div key={i} className="bg-richy-black rounded-lg p-3 border border-purple-500/30">
                        <span className="text-purple-300 text-sm font-medium">{kpi}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                <span>📄</span>
                <span>Exporter en PDF</span>
              </button>
              
              <button
                onClick={() => {
                  setResult(null)
                  setProjectName('')
                  setProjectDescription('')
                  setBudget('')
                  setTimeline('')
                  setTechnicalLevel('intermediate')
                }}
                className="px-6 py-3 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold rounded-lg hover:scale-105 transition-all duration-200"
              >
                Créer une nouvelle roadmap →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
