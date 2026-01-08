'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import UpgradeModal from '@/components/UpgradeModal'
import { DashboardHeader } from '../dashboard/dashboard-header'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// 1. On déplace toute la logique dans un composant enfant
function ChatContent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(undefined)
  const [headerData, setHeaderData] = useState<{
    trialDaysLeft: number
    userEmail: string
    subscriptionStatus: string
    hasTrialLimitations: boolean
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Récupérer les données pour le header
  useEffect(() => {
    const fetchHeaderData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.error('Error getting user:', userError)
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
        if (error?.message?.includes('Failed to fetch') || error instanceof TypeError) {
          console.warn('Network error fetching header data (non-blocking):', error)
          return
        }
        console.error('Error fetching header data:', error)
      }
    }

    fetchHeaderData()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const conversationId = searchParams.get('conversation')
    if (conversationId) {
      loadConversationHistory(conversationId)
    } else {
      // Message initial de Richy
      const initialMessage: Message = {
        role: 'assistant',
        content: "Wee ca dit quoi ? C'est Richy. Qu'est-ce que tu veux construire aujourd'hui ? Envoie ton idée pour voir ce qu'on peut en faire.",
        timestamp: new Date()
      }
      setMessages([initialMessage])
      setLoadingHistory(false)
      console.log('✅ Message initial défini')
    }
  }, [searchParams])

  const loadConversationHistory = async (conversationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .eq('agent_type', 'chat')
        .single()

      if (error || !conversation) {
        console.error('Error loading conversation:', error)
        setLoadingHistory(false)
        return
      }

      const threadId = conversation.input_data?.thread_id || conversation.output_data?.thread_id || conversationId
      setCurrentThreadId(threadId) // Sauvegarder le thread_id pour les prochains messages

      const { data: allChatConversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('agent_type', 'chat')
        .order('created_at', { ascending: true })

      const threadConversations = (allChatConversations || []).filter(conv => {
        const convThreadId = conv.input_data?.thread_id || conv.output_data?.thread_id || conv.id
        return convThreadId === threadId
      })

      const conversationsToLoad = threadConversations.length > 0 ? threadConversations : [conversation]
      const historyMessages: Message[] = []
      
      conversationsToLoad.forEach((conv) => {
        if (conv.input_data?.message) {
          historyMessages.push({
            role: 'user',
            content: conv.input_data.message,
            timestamp: new Date(conv.created_at)
          })
        }
        if (conv.output_data?.response) {
          historyMessages.push({
            role: 'assistant',
            content: conv.output_data.response,
            timestamp: new Date(conv.created_at)
          })
        }
      })

      if (historyMessages.length > 0) {
        setMessages(historyMessages)
      } else {
        setMessages([{
          role: 'assistant',
          content: "Wee ca dit quoi ? C'est Richy. Qu'est-ce que tu veux construire aujourd'hui ? Envoie ton idée pout voir ce qu'on peut en faire.",
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Error loading conversation history:', error)
      setMessages([{
        role: 'assistant',
        content: "Wee ca dit quoi ? C'est Richy. Qu'est-ce que tu veux construire aujourd'hui ? Envoie ton idée pout voir ce qu'on peut en faire.",
        timestamp: new Date()
      }])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Utiliser le thread_id sauvegardé ou en créer un nouveau
      const threadId = currentThreadId

      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          history: messages.slice(-10),
          thread_id: threadId 
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        const errorMsg = data.error || 'Erreur lors de la réponse'
        console.error('❌ Erreur API chat:', errorMsg)
        console.error('Response status:', response.status)
        console.error('Full response:', data)
        
        // Si c'est une erreur de limite, ouvrir le modal d'upgrade
        if (data.showUpgrade || data.reason === 'LIMIT_REACHED' || data.reason === 'FEATURE_LOCKED') {
          setShowUpgradeModal(true)
        }
        
        // Si c'est une erreur de clé API manquante, afficher un message clair
        if (data.missing_api_key) {
          throw new Error('Configuration API manquante. Contactez le support pour configurer GROQ_API_KEY.')
        }
        
        throw new Error(errorMsg)
      }

      if (!data.response || typeof data.response !== 'string') {
        console.error('❌ Réponse invalide reçue:', data)
        throw new Error('Réponse invalide du serveur. Vérifiez les logs serveur.')
      }

      console.log('✅ Réponse reçue:', data.response.substring(0, 100) + '...')

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response.trim(),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      
      // Sauvegarder le thread_id si on l'a reçu et qu'on n'en avait pas encore
      if (data.thread_id && !currentThreadId) {
        setCurrentThreadId(data.thread_id)
      }

    } catch (error: any) {
      console.error('❌ Chat error:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      })
      
      // Vérifier si c'est une erreur de limite
      const isLimitError = error.message?.includes('limite') || 
                          error.message?.includes('limit') || 
                          error.message?.includes('Premium') ||
                          error.message?.includes('upgrade')
      
      const errorMessage: Message = {
        role: 'assistant',
        content: error.message?.includes('Non autorisé') 
          ? "Tu n'es pas connecté. Reconnecte-toi et réessaye."
          : isLimitError
          ? "Tu as atteint ta limite de messages. Upgrade ton plan pour continuer ! 💎"
          : "Putain, y'a un bug ! 🤬 Réessaye dans quelques secondes. Si ça continue, refresh la page et reviens me voir.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      
      // Ouvrir le modal d'upgrade si c'est une erreur de limite
      if (isLimitError) {
        setShowUpgradeModal(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft flex flex-col">
      {/* Header */}
      {headerData && (
        <DashboardHeader 
          trialDaysLeft={headerData.trialDaysLeft}
          userEmail={headerData.userEmail}
          subscriptionStatus={headerData.subscriptionStatus}
          hasTrialLimitations={headerData.hasTrialLimitations}
        />
      )}

      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-6 h-[600px] overflow-y-auto mb-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-pulse flex space-x-1 justify-center mb-4">
                  <div className="w-2 h-2 bg-richy-gold rounded-full"></div>
                  <div className="w-2 h-2 bg-richy-gold rounded-full animation-delay-200"></div>
                  <div className="w-2 h-2 bg-richy-gold rounded-full animation-delay-400"></div>
                </div>
                <p className="text-gray-400 text-sm">Chargement de la conversation...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Aucun message pour le moment</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  // Ne pas afficher les messages vides
                  if (!message.content || message.content.trim().length === 0) {
                    return null
                  }
                  
                  return (
                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg p-4 ${message.role === 'user' ? 'bg-gradient-to-r from-richy-gold/20 to-richy-gold-dark/20 border border-richy-gold/30 text-white' : 'bg-richy-black border border-gray-700 text-gray-200'}`}>
                        {message.role === 'assistant' && (
                          <div className="flex items-center mb-2">
                            <span className="text-richy-gold font-bold">RICHY</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <span className="text-xs text-gray-500 mt-2 block">
                          {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-richy-black border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <div className="animate-pulse flex space-x-1">
                        <div className="w-2 h-2 bg-richy-gold rounded-full"></div>
                        <div className="w-2 h-2 bg-richy-gold rounded-full animation-delay-200"></div>
                        <div className="w-2 h-2 bg-richy-gold rounded-full animation-delay-400"></div>
                      </div>
                      <span className="text-gray-400 text-sm">Richy réfléchit...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="relative">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Demande-moi ce que tu veux..."
              className="flex-1 px-4 py-4 bg-richy-black-soft border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-8 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold rounded-lg hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50"
            >
              {loading ? '...' : 'Envoyer'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-gray-500 text-sm">
          💡 Exemples : "Comment valider mon idée ?", "Donne-moi une stratégie d'acquisition"
        </div>
      </main>

      {showUpgradeModal && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          reason="LIMIT_REACHED"
        />
      )}

      <style jsx>{`
        .animation-delay-200 { animation-delay: 200ms; }
        .animation-delay-400 { animation-delay: 400ms; }
      `}</style>
    </div>
  )
}

// 2. Le composant exporté par défaut qui utilise Suspense
export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-richy-black flex items-center justify-center">
        <div className="text-richy-gold animate-pulse">Initialisation du chat...</div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}