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

export default function BuilderPage() {
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [technicalLevel, setTechnicalLevel] = useState('intermediate')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BuilderResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)
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
          technical_level: technicalLevel
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la génération')
      }

      setResult(data.result)
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
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
                  Description détaillée *
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors min-h-[120px]"
                  placeholder="Décris ton projet, ses fonctionnalités principales, ta vision..."
                  required
                  disabled={loading}
                />
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
                    Création de la roadmap...
                  </span>
                ) : (
                  'Créer ma roadmap →'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Results - je vais continuer dans le prochain message */}
        {/* Results */}
        {result && (
          <div className="space-y-6 animate-slide-up">
            {/* MVP Definition */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-richy-gold mb-4">🎯 Définition du MVP</h2>
              
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">Fonctionnalités incluses :</h3>
                <ul className="space-y-2">
                  {result.mvp_definition.features.map((feature, i) => (
                    <li key={i} className="text-gray-300 flex items-start">
                      <span className="text-green-400 mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">À exclure du MVP :</h3>
                <ul className="space-y-2">
                  {result.mvp_definition.excluded.map((item, i) => (
                    <li key={i} className="text-gray-400 flex items-start">
                      <span className="text-red-400 mr-2">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-richy-gold/10 border border-richy-gold/30 rounded-lg p-3 mt-4">
                <p className="text-richy-gold font-semibold">
                  ⏱️ Durée estimée : {result.mvp_definition.duration}
                </p>
              </div>
            </div>

            {/* Tech Stack */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-richy-gold mb-4">⚙️ Stack Technique</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-richy-black rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Frontend</p>
                  <p className="text-white font-semibold">{result.tech_stack.frontend}</p>
                </div>
                <div className="bg-richy-black rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Backend</p>
                  <p className="text-white font-semibold">{result.tech_stack.backend}</p>
                </div>
                <div className="bg-richy-black rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Database</p>
                  <p className="text-white font-semibold">{result.tech_stack.database}</p>
                </div>
                <div className="bg-richy-black rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Hosting</p>
                  <p className="text-white font-semibold">{result.tech_stack.hosting}</p>
                </div>
              </div>

              {result.tech_stack.third_party.length > 0 && (
                <div className="mt-4">
                  <p className="text-gray-400 text-sm mb-2">Services tiers :</p>
                  <div className="flex flex-wrap gap-2">
                    {result.tech_stack.third_party.map((service, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Roadmap Sprints */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-richy-gold mb-4">📅 Roadmap - Sprints</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Sprint 1 (Semaines 1-2)</h3>
                  <ul className="space-y-2">
                    {result.roadmap.sprint_1.map((task, i) => (
                      <li key={i} className="text-gray-300 flex items-start">
                        <span className="text-richy-gold mr-2">{i+1}.</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Sprint 2 (Semaines 3-4)</h3>
                  <ul className="space-y-2">
                    {result.roadmap.sprint_2.map((task, i) => (
                      <li key={i} className="text-gray-300 flex items-start">
                        <span className="text-richy-gold mr-2">{i+1}.</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Sprint 3 (Semaines 5-6)</h3>
                  <ul className="space-y-2">
                    {result.roadmap.sprint_3.map((task, i) => (
                      <li key={i} className="text-gray-300 flex items-start">
                        <span className="text-richy-gold mr-2">{i+1}.</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Sprint 4 (Semaines 7-8)</h3>
                  <ul className="space-y-2">
                    {result.roadmap.sprint_4.map((task, i) => (
                      <li key={i} className="text-gray-300 flex items-start">
                        <span className="text-richy-gold mr-2">{i+1}.</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Launch Plan */}
            <div className="bg-gradient-to-r from-richy-gold/10 to-richy-gold-dark/10 border border-richy-gold/30 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-richy-gold mb-4">🚀 Plan de lancement</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Pré-lancement</h3>
                  <ul className="space-y-1">
                    {result.launch_plan.pre_launch.map((task, i) => (
                      <li key={i} className="text-gray-300">• {task}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Jour J</h3>
                  <ul className="space-y-1">
                    {result.launch_plan.launch_day.map((task, i) => (
                      <li key={i} className="text-gray-300">• {task}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Post-lancement</h3>
                  <ul className="space-y-1">
                    {result.launch_plan.post_launch.map((task, i) => (
                      <li key={i} className="text-gray-300">• {task}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-richy-black rounded-lg p-4 mt-4">
                  <h3 className="text-lg font-semibold text-richy-gold mb-2">📊 KPIs à tracker</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {result.launch_plan.kpis.map((kpi, i) => (
                      <span key={i} className="text-gray-300">• {kpi}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setResult(null)
                  setProjectName('')
                  setProjectDescription('')
                }}
                className="flex-1 bg-richy-black-soft border border-richy-gold/20 text-white font-bold py-3 px-6 rounded-lg hover:border-richy-gold/40 transition-all"
              >
                Créer une autre roadmap
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg"
              >
                Exporter en PDF 📄
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

