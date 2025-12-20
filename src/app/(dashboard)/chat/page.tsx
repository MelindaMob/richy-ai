'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

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
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(undefined)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

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
      setMessages([{
        role: 'assistant',
        content: "Wee ca dit quoi ? C'est Richy. Qu'est-ce que tu veux construire aujourd'hui ? Envoie ton idée pout voir ce qu'on peut en faire.",
        timestamp: new Date()
      }])
      setLoadingHistory(false)
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

      // Récupérer toutes les conversations de chat de l'utilisateur
      const { data: allChatConversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('agent_type', 'chat')
        .order('created_at', { ascending: true })

      if (!allChatConversations) {
        setLoadingHistory(false)
        return
      }

      // Créer un map pour trouver rapidement les conversations par ID
      const conversationsById = new Map<string, typeof conversation>()
      
      // Créer le map
      allChatConversations.forEach((conv: typeof conversation) => conversationsById.set(conv.id, conv))

      // Fonction pour normaliser le thread_id (identique à celle de l'historique)
      const normalizeThreadId = (conv: typeof conversation): string => {
        let threadId = conv.input_data?.thread_id || conv.output_data?.thread_id
        
        // Si pas de thread_id explicite, cette conversation est la première du thread
        if (!threadId) {
          return conv.id
        }
        
        // Si le thread_id correspond à l'ID d'une conversation existante,
        // utiliser cet ID comme thread_id normalisé
        if (conversationsById.has(threadId)) {
          return threadId
        }
        
        // Sinon, utiliser le thread_id tel quel
        return threadId
      }

      // Normaliser le thread_id de la conversation cliquée
      const normalizedThreadId = normalizeThreadId(conversation)

      // Filtrer pour ne garder que celles du même thread
      const threadConversations = allChatConversations.filter((conv: typeof conversation) => {
        const convNormalizedThreadId = normalizeThreadId(conv)
        return convNormalizedThreadId === normalizedThreadId
      })

      const conversationsToLoad = threadConversations.length > 0 ? threadConversations : [conversation]
      const historyMessages: Message[] = []
      
      conversationsToLoad.forEach((conv: typeof conversation) => {
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
        // Mettre à jour le thread_id pour les messages suivants
        setCurrentThreadId(normalizedThreadId)
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

      // Utiliser le thread_id depuis l'URL ou depuis le state
      const conversationId = searchParams.get('conversation')
      const threadId = conversationId || currentThreadId

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
      if (!response.ok) throw new Error(data.error || 'Erreur lors de la réponse')

      // Si c'est le premier message d'une nouvelle conversation, récupérer le thread_id depuis la réponse
      // Ou si on a un conversation_id dans la réponse, l'utiliser comme thread_id pour les messages suivants
      if (data.conversation_id && !currentThreadId) {
        setCurrentThreadId(data.conversation_id)
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

    } catch (error: any) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: "Putain, y'a un bug ! 🤬 Réessaye dans quelques secondes. Si ça continue, refresh la page et reviens me voir.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft flex flex-col">
      <header className="border-b border-richy-gold/20 bg-richy-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="font-display text-3xl text-richy-gold hover:text-richy-gold-light transition-colors">
              RICHY.AI
            </Link>
            <span className="text-gray-400">•</span>
            <span className="text-white font-semibold">💬 Chat</span>
          </div>
          <nav className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
            <Link href="/validator" className="text-gray-400 hover:text-white transition-colors text-sm">Validator</Link>
            <Link href="/prompt" className="text-gray-400 hover:text-white transition-colors text-sm">Prompt</Link>
            <Link href="/builder" className="text-gray-400 hover:text-white transition-colors text-sm">Builder</Link>
          </nav>
        </div>
      </header>

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
              {messages.map((message, index) => (
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
              ))}
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