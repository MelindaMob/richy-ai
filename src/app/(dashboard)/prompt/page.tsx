'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import UpgradeModal from '@/components/UpgradeModal'

export default function PromptPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [features, setFeatures] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setShowUpgradeModal(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Non autorisé')
        return
      }

      const res = await fetch('/api/agents/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, target_audience: targetAudience, features })
      })

      const data = await res.json()
      
      if (res.status === 403 && data.showUpgrade) {
        setShowUpgradeModal(true)
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
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="text-richy-gold hover:text-richy-gold-light mb-6 inline-block">
          ← Retour au dashboard
        </Link>

        <h1 className="text-4xl font-bold text-richy-gold mb-8">
          ✨ Richy.prompt
        </h1>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white mb-2">Titre du projet *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-richy-black-soft border border-richy-gold/20 rounded-lg p-3 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-white mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-richy-black-soft border border-richy-gold/20 rounded-lg p-3 text-white"
                rows={4}
                required
              />
            </div>

            <div>
              <label className="block text-white mb-2">Cible principale *</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-richy-black-soft border border-richy-gold/20 rounded-lg p-3 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-white mb-2">Features (optionnel)</label>
              <textarea
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                className="w-full bg-richy-black-soft border border-richy-gold/20 rounded-lg p-3 text-white"
                rows={3}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-8 rounded-lg hover:scale-105 transition-all"
            >
              {loading ? 'Génération...' : 'Générer le prompt'}
            </button>
          </form>
        ) : (
          <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-richy-gold mb-4">{result.title}</h2>
            <pre className="bg-richy-black p-4 rounded-lg text-white whitespace-pre-wrap overflow-auto">
              {result.prompt}
            </pre>
            <button
              onClick={() => setResult(null)}
              className="mt-6 bg-richy-gold text-richy-black font-bold py-2 px-6 rounded-lg"
            >
              Nouveau prompt
            </button>
          </div>
        )}
      </div>

      {showUpgradeModal && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  )
}