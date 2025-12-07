'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Salut champion ! 🔥 C'est Richy. Qu'est-ce que tu veux construire aujourd'hui ? Balance-moi ton idée et on va la transformer en machine à cash !",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Ajouter le message de l'user
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      // Vérifier l'auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Appeler l'API
      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage,
          history: messages.slice(-10) // Envoyer les 10 derniers messages pour le contexte
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la réponse')
      }

      // Ajouter la réponse de l'assistant
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

    } catch (error: any) {
      console.error('Chat error:', error)
      
      // Message d'erreur stylé Richy
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
      {/* Header */}
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
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← Dashboard
            </Link>
            <Link href="/validator" className="text-gray-400 hover:text-white transition-colors text-sm">
              Validator
            </Link>
            <Link href="/prompt" className="text-gray-400 hover:text-white transition-colors text-sm">
              Prompt
            </Link>
            <Link href="/builder" className="text-gray-400 hover:text-white transition-colors text-sm">
              Builder
            </Link>
          </nav>
        </div>
      </header>

      {/* Chat Container */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        {/* Messages */}
        <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-6 h-[600px] overflow-y-auto mb-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-richy-gold/20 to-richy-gold-dark/20 border border-richy-gold/30 text-white'
                      : 'bg-richy-black border border-gray-700 text-gray-200'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center mb-2">
                      <span className="text-richy-gold font-bold">RICHY</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <span className="text-xs text-gray-500 mt-2 block">
                    {message.timestamp.toLocaleTimeString('fr-FR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
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
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="relative">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Demande-moi ce que tu veux... Stratégie, conseils, mindset..."
              className="flex-1 px-4 py-4 bg-richy-black-soft border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-richy-gold transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-8 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold rounded-lg hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? '...' : 'Envoyer'}
            </button>
          </div>
        </form>

        {/* Tips */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            💡 Exemples : "Comment valider mon idée ?", "Donne-moi une stratégie d'acquisition", "Comment pitcher à des investisseurs ?"
          </p>
        </div>
      </main>

      <style jsx>{`
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
      `}</style>
    </div>
  )
}