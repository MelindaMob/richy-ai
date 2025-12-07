'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface PromptResult {
  title: string
  prompt: string
  usage_instructions: string
  compatible_with: string[]
}

export default function PromptPage() {
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaDescription, setIdeaDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [features, setFeatures] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PromptResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleGenerate = async (e: React.FormEvent) => {
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

      const response = await fetch('/api/agents/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: ideaTitle,
          description: ideaDescription,
          target_audience: targetAudience,
          features
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

  const copyPrompt = () => {
    if (result?.prompt) {
      navigator.clipboard.writeText(result.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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
            <span className="text-white font-semibold">✨ Prompt</span>
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
            <Link href="/builder" className="text-gray-400 hover:text-white transition-colors text-sm">
              Builder
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-3 flex items-center">
            <span className="text-richy-gold mr-3">✨</span>
            Richy.prompt
          </h1>
          <p className="text-xl text-gray-400">
            Transforme ton idée en prompt ultra-précis pour créer ton SaaS avec l'IA.
          </p>
        </div>

        {/* Form */}
        {!result && (
          <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom de ton SaaS *
                </label>
                <input
                  type="text"
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                  placeholder="Ex: TaskMaster AI"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description de l'idée *
                </label>
                <textarea
                  value={ideaDescription}
                  onChange={(e) => setIdeaDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors min-h-[120px]"
                  placeholder="Décris ton SaaS en détail : problème résolu, solution proposée..."
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cible principale *
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
                  placeholder="Ex: Freelances, startups tech, e-commerces..."
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fonctionnalités clés
                </label>
                <textarea
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                  className="w-full px-4 py-3 bg-richy-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors min-h-[100px]"
                  placeholder="Liste les principales fonctionnalités (une par ligne)"
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
                    Génération en cours...
                  </span>
                ) : (
                  'Générer le prompt →'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Results - Suite du code... */}
        {result && (
          <div className="space-y-6 animate-slide-up">
            {/* Title */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-richy-gold mb-2">
                {result.title}
              </h2>
              <div className="flex flex-wrap gap-2 mt-4">
                {result.compatible_with.map((platform, i) => (
                  <span key={i} className="px-3 py-1 bg-richy-gold/20 border border-richy-gold/30 rounded-full text-sm text-richy-gold">
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-white">📝 Prompt généré</h3>
                <button
                  onClick={copyPrompt}
                  className="px-4 py-2 bg-richy-gold/20 hover:bg-richy-gold/30 border border-richy-gold/30 rounded-lg text-richy-gold font-medium transition-colors"
                >
                  {copied ? '✓ Copié!' : 'Copier'}
                </button>
              </div>
              <pre className="bg-richy-black p-4 rounded-lg overflow-x-auto">
                <code className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
                  {result.prompt}
                </code>
              </pre>
            </div>

            {/* Instructions */}
            <div className="bg-gradient-to-r from-richy-gold/10 to-richy-gold-dark/10 border border-richy-gold/30 rounded-xl p-6">
              <h3 className="text-xl font-bold text-richy-gold mb-4">
                💡 Instructions d'utilisation
              </h3>
              <p className="text-gray-300 whitespace-pre-wrap">
                {result.usage_instructions}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setResult(null)
                  setIdeaTitle('')
                  setIdeaDescription('')
                  setTargetAudience('')
                  setFeatures('')
                }}
                className="flex-1 bg-richy-black-soft border border-richy-gold/20 text-white font-bold py-3 px-6 rounded-lg hover:border-richy-gold/40 transition-all"
              >
                Générer un autre prompt
              </button>
              <Link
                href="/validator"
                className="flex-1 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg text-center hover:scale-105 transition-all duration-200 shadow-lg"
              >
                Valider mon SaaS →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}