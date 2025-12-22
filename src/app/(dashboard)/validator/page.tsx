'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ValidatorResult {
  score: number
  verdict: 'Gagnant 🏆' | 'À retravailler ⚠️' | 'Non rentable ❌'
  potential: 'Faible' | 'Moyen' | 'Élevé' | 'Exceptionnel'
  market_analysis: string
  target_audience: string
  strengths: string[]
  weaknesses: string[]
  critical_points: string[]
  missing_features: string[]
  technical_complexity: 'Simple' | 'Modéré' | 'Complexe' | 'Très complexe'
  recommendations: string[]
}

export default function ValidatorPage() {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidatorResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    setLoading(true)

    try {
      // Vérifier l'auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Appeler l'API
      const response = await fetch('/api/agents/validator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, description }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la validation')
      }

      setResult(data.result)
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case 'Exceptionnel': return 'text-richy-gold'
      case 'Élevé': return 'text-green-400'
      case 'Moyen': return 'text-yellow-400'
      default: return 'text-red-400'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft">
      {/* Header */}
      <header className="relative z-50">
        <div className="border-b border-richy-gold/20 bg-richy-black/50 backdrop-blur-sm sticky top-0">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 font-display text-3xl text-richy-gold hover:text-richy-gold-light transition-colors">
              <img src="/logo-richy.png" alt="Richy.ai" className="h-8 w-8" />
              RICHY.AI
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                ← Dashboard
              </Link>
              <Link href="/chat" className="text-gray-400 hover:text-white transition-colors">
                Chat
              </Link>
              <Link href="/prompt" className="text-gray-400 hover:text-white transition-colors">
                Prompt
              </Link>
              <Link href="/builder" className="text-gray-400 hover:text-white transition-colors">
                Builder
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-richy-gold hover:text-richy-gold-light transition-colors z-50 relative"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu - Overlay from right */}
        <div 
          className={`md:hidden fixed top-0 right-0 bottom-0 w-64 bg-richy-black/95 backdrop-blur-sm border-l border-richy-gold/20 py-6 px-4 space-y-4 z-40 transition-all duration-300 ease-in-out ${
            isMenuOpen 
              ? 'translate-x-0 opacity-100' 
              : 'translate-x-full opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-semibold text-lg">Menu</h2>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="text-richy-gold hover:text-richy-gold-light transition-colors"
              aria-label="Close menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <Link 
            href="/dashboard"
            onClick={() => setIsMenuOpen(false)}
            className="block w-full px-4 py-3 border border-richy-gold/30 text-white rounded-lg hover:bg-richy-gold/10 transition-colors text-sm text-center"
          >
            ← Dashboard
          </Link>
          <Link 
            href="/chat"
            onClick={() => setIsMenuOpen(false)}
            className="block w-full px-4 py-3 border border-richy-gold/30 text-white rounded-lg hover:bg-richy-gold/10 transition-colors text-sm text-center"
          >
            Chat
          </Link>
          <Link 
            href="/prompt"
            onClick={() => setIsMenuOpen(false)}
            className="block w-full px-4 py-3 border border-richy-gold/30 text-white rounded-lg hover:bg-richy-gold/10 transition-colors text-sm text-center"
          >
            Prompt
          </Link>
          <Link 
            href="/builder"
            onClick={() => setIsMenuOpen(false)}
            className="block w-full px-4 py-3 border border-richy-gold/30 text-white rounded-lg hover:bg-richy-gold/10 transition-colors text-sm text-center"
          >
            Builder
          </Link>
        </div>
        
        {/* Backdrop overlay */}
        {isMenuOpen && (
          <div
            onClick={() => setIsMenuOpen(false)}
            className="md:hidden fixed inset-0 bg-black/50 z-30"
          />
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-3 flex items-center">
            <span className="text-richy-gold mr-3">🎯</span>
            Richy.validator
          </h1>
          <p className="text-xl text-gray-400">
            Entre l'URL de ton SaaS et je te dis cash si ça vaut le coup ou pas.
          </p>
        </div>

        {/* Form */}
        {!result && (
          <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8">
            <form onSubmit={handleValidate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL du SaaS à valider *
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                  placeholder="https://ton-saas.com"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors min-h-[120px]"
                  placeholder="Décris ton SaaS, ta cible, ton business model..."
                  disabled={loading}
                />
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
                    Analyse en cours... (30-60 secondes)
                  </span>
                ) : (
                  'Analyser ce SaaS →'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-slide-up">
            {/* Score et Verdict */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-gray-400 mb-2">Score Global</p>
                  <p className={`text-6xl font-bold ${getScoreColor(result.score)}`}>
                    {result.score}/100
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-2">Verdict</p>
                  <p className="text-3xl font-bold text-white">
                    {result.verdict}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-2">Potentiel</p>
                  <p className={`text-3xl font-bold ${getPotentialColor(result.potential)}`}>
                    {result.potential}
                  </p>
                </div>
              </div>
            </div>

            {/* Analyse Marché */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-richy-gold mb-4">📊 Analyse du marché</h3>
              <p className="text-gray-300 mb-4">{result.market_analysis}</p>
              <div className="border-t border-gray-800 pt-4">
                <p className="text-sm text-gray-400">Cible identifiée :</p>
                <p className="text-white mt-1">{result.target_audience}</p>
              </div>
            </div>

            {/* Forces et Faiblesses */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-richy-black-soft border border-green-500/20 rounded-xl p-6">
                <h3 className="text-xl font-bold text-green-400 mb-4">✅ Forces</h3>
                <ul className="space-y-2">
                  {result.strengths.map((strength, i) => (
                    <li key={i} className="text-gray-300 flex items-start">
                      <span className="text-green-400 mr-2">•</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-richy-black-soft border border-red-500/20 rounded-xl p-6">
                <h3 className="text-xl font-bold text-red-400 mb-4">❌ Faiblesses</h3>
                <ul className="space-y-2">
                  {result.weaknesses.map((weakness, i) => (
                    <li key={i} className="text-gray-300 flex items-start">
                      <span className="text-red-400 mr-2">•</span>
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Points Critiques */}
            <div className="bg-richy-black-soft border border-orange-500/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-orange-400 mb-4">⚠️ Points critiques à corriger</h3>
              <ul className="space-y-2">
                {result.critical_points.map((point, i) => (
                  <li key={i} className="text-gray-300 flex items-start">
                    <span className="text-orange-400 mr-2">→</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Fonctionnalités Manquantes */}
            <div className="bg-richy-black-soft border border-yellow-500/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-yellow-400 mb-4">🔧 Fonctionnalités manquantes</h3>
              <ul className="space-y-2">
                {result.missing_features.map((feature, i) => (
                  <li key={i} className="text-gray-300 flex items-start">
                    <span className="text-yellow-400 mr-2">+</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommandations */}
            <div className="bg-gradient-to-r from-richy-gold/10 to-richy-gold-dark/10 border border-richy-gold/30 rounded-xl p-6">
              <h3 className="text-xl font-bold text-richy-gold mb-4">💡 Mes recommandations</h3>
              <ul className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-gray-300 flex items-start">
                    <span className="text-richy-gold font-bold mr-2">{i + 1}.</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Complexité Technique */}
            <div className="bg-richy-black-soft border border-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Complexité technique :</span>
                <span className="text-xl font-bold text-white">{result.technical_complexity}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setResult(null)
                  setUrl('')
                  setDescription('')
                }}
                className="flex-1 bg-richy-black-soft border border-richy-gold/20 text-white font-bold py-3 px-6 rounded-lg hover:border-richy-gold/40 transition-all"
              >
                Analyser un autre SaaS
              </button>
              <Link
                href="/builder"
                className="flex-1 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg text-center hover:scale-105 transition-all duration-200 shadow-lg"
              >
                Créer la roadmap →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}