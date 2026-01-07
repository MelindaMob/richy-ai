'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import UpgradeModal from '@/components/UpgradeModal'
import { DashboardHeader } from '../dashboard/dashboard-header'

export default function PromptPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [features, setFeatures] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [headerData, setHeaderData] = useState<{
    trialDaysLeft: number
    userEmail: string
    subscriptionStatus: string
    hasTrialLimitations: boolean
  } | null>(null)
  const supabase = createClient()

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