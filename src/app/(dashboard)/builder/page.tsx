'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import UpgradeModal from '@/components/UpgradeModal'

export default function BuilderPage() {
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [technicalLevel, setTechnicalLevel] = useState('')
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
          🚀 Richy.builder
        </h1>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white mb-2">Nom du projet *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-richy-black-soft border border-richy-gold/20 rounded-lg p-3 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-white mb-2">Description du projet *</label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="w-full bg-richy-black-soft border border-richy-gold/20 rounded-lg p-3 text-white"
                rows={4}
                required
              />
            </div>

            <div>
              <label className="block text-white mb-2">Budget (optionnel)</label>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-richy-black-soft border border-richy-gold/20 rounded-lg p-3 text-white"
                placeholder="Ex: 5000€, 10k€, etc."
              />
            </div>

            <div>
              <label className="block text-white mb-2">Timeline (optionnel)</label>
              <input
                type="text"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="w-full bg-richy-black-soft border border-richy-gold/20 rounded-lg p-3 text-white"
                placeholder="Ex: 2 mois, 6 semaines, etc."
              />
            </div>

            <div>
              <label className="block text-white mb-2">Niveau technique (optionnel)</label>
              <select
                value={technicalLevel}
                onChange={(e) => setTechnicalLevel(e.target.value)}
                className="w-full bg-richy-black-soft border border-richy-gold/20 rounded-lg p-3 text-white"
              >
                <option value="">Sélectionner...</option>
                <option value="débutant">Débutant</option>
                <option value="intermédiaire">Intermédiaire</option>
                <option value="avancé">Avancé</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-8 rounded-lg hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? 'Génération de la roadmap...' : 'Générer la roadmap'}
            </button>
          </form>
        ) : (
          <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8 space-y-6">
            {/* MVP Definition */}
            {result.mvp_definition && (
              <div>
                <h2 className="text-2xl font-bold text-richy-gold mb-4">🎯 MVP Definition</h2>
                <div className="bg-richy-black p-4 rounded-lg">
                  <h3 className="text-white font-semibold mb-2">Features core:</h3>
                  <ul className="list-disc list-inside text-gray-300 space-y-1">
                    {result.mvp_definition.features?.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                  {result.mvp_definition.excluded && (
                    <>
                      <h3 className="text-white font-semibold mt-4 mb-2">Exclu du MVP:</h3>
                      <ul className="list-disc list-inside text-gray-400 space-y-1">
                        {result.mvp_definition.excluded.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {result.mvp_definition.duration && (
                    <p className="text-gray-300 mt-4">
                      <strong>Durée estimée:</strong> {result.mvp_definition.duration}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Stack Technique */}
            {result.technical_stack && (
              <div>
                <h2 className="text-2xl font-bold text-richy-gold mb-4">⚙️ Stack Technique</h2>
                <div className="bg-richy-black p-4 rounded-lg space-y-3">
                  {result.technical_stack.frontend && (
                    <div>
                      <strong className="text-white">Frontend:</strong>
                      <p className="text-gray-300">{result.technical_stack.frontend}</p>
                    </div>
                  )}
                  {result.technical_stack.backend && (
                    <div>
                      <strong className="text-white">Backend:</strong>
                      <p className="text-gray-300">{result.technical_stack.backend}</p>
                    </div>
                  )}
                  {result.technical_stack.database && (
                    <div>
                      <strong className="text-white">Database:</strong>
                      <p className="text-gray-300">{result.technical_stack.database}</p>
                    </div>
                  )}
                  {result.technical_stack.hosting && (
                    <div>
                      <strong className="text-white">Hébergement:</strong>
                      <p className="text-gray-300">{result.technical_stack.hosting}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Roadmap */}
            {result.roadmap && (
              <div>
                <h2 className="text-2xl font-bold text-richy-gold mb-4">🗺️ Roadmap</h2>
                <div className="space-y-4">
                  {result.roadmap.sprints?.map((sprint: any, i: number) => (
                    <div key={i} className="bg-richy-black p-4 rounded-lg">
                      <h3 className="text-white font-semibold mb-2">
                        Sprint {i + 1}: {sprint.name || sprint.title}
                      </h3>
                      <p className="text-gray-300">{sprint.description || sprint.tasks}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Launch Plan */}
            {result.launch_plan && (
              <div>
                <h2 className="text-2xl font-bold text-richy-gold mb-4">🚀 Plan de Lancement</h2>
                <div className="bg-richy-black p-4 rounded-lg space-y-3">
                  {result.launch_plan.pre_launch && (
                    <div>
                      <strong className="text-white">Pré-lancement:</strong>
                      <p className="text-gray-300">{result.launch_plan.pre_launch}</p>
                    </div>
                  )}
                  {result.launch_plan.launch_day && (
                    <div>
                      <strong className="text-white">Jour J:</strong>
                      <p className="text-gray-300">{result.launch_plan.launch_day}</p>
                    </div>
                  )}
                  {result.launch_plan.post_launch && (
                    <div>
                      <strong className="text-white">Post-lancement (7 jours):</strong>
                      <p className="text-gray-300">{result.launch_plan.post_launch}</p>
                    </div>
                  )}
                  {result.launch_plan.kpis && (
                    <div>
                      <strong className="text-white">KPIs à tracker:</strong>
                      <p className="text-gray-300">{result.launch_plan.kpis}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => setResult(null)}
              className="mt-6 bg-richy-gold text-richy-black font-bold py-2 px-6 rounded-lg hover:scale-105 transition-all"
            >
              Nouvelle roadmap
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
