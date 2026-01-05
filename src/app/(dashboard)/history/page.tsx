'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Conversation {
  id: string
  agent_type: 'chat' | 'validator' | 'prompt' | 'builder'
  title: string
  input_data: any
  output_data: any
  created_at: string
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (selectedAgent === 'all') {
      setFilteredConversations(conversations)
    } else {
      setFilteredConversations(conversations.filter(c => c.agent_type === selectedAgent))
    }
  }, [selectedAgent, conversations])

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setConversations(data || [])
      setFilteredConversations(data || [])
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'chat': return '💬'
      case 'validator': return '🎯'
      case 'prompt': return '✨'
      case 'builder': return '🚀'
      default: return '📝'
    }
  }

  const getAgentColor = (type: string) => {
    switch (type) {
      case 'chat': return 'text-blue-400'
      case 'validator': return 'text-green-400'
      case 'prompt': return 'text-purple-400'
      case 'builder': return 'text-orange-400'
      default: return 'text-gray-400'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Il y a moins d\'une heure'
    if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`
    
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
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
            <span className="text-white font-semibold">📚 Historique</span>
          </div>
          
          <nav className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">
            Historique des conversations
          </h1>
          <p className="text-xl text-gray-400">
            Retrouve toutes tes interactions avec les agents Richy.ai
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedAgent('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedAgent === 'all' 
                ? 'bg-richy-gold text-richy-black' 
                : 'bg-richy-black-soft text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            Tous ({conversations.length})
          </button>
          <button
            onClick={() => setSelectedAgent('chat')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedAgent === 'chat' 
                ? 'bg-richy-gold text-richy-black' 
                : 'bg-richy-black-soft text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            💬 Chat ({conversations.filter(c => c.agent_type === 'chat').length})
          </button>
          <button
            onClick={() => setSelectedAgent('validator')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedAgent === 'validator' 
                ? 'bg-richy-gold text-richy-black' 
                : 'bg-richy-black-soft text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            🎯 Validator ({conversations.filter(c => c.agent_type === 'validator').length})
          </button>
          <button
            onClick={() => setSelectedAgent('prompt')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedAgent === 'prompt' 
                ? 'bg-richy-gold text-richy-black' 
                : 'bg-richy-black-soft text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            ✨ Prompt ({conversations.filter(c => c.agent_type === 'prompt').length})
          </button>
          <button
            onClick={() => setSelectedAgent('builder')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedAgent === 'builder' 
                ? 'bg-richy-gold text-richy-black' 
                : 'bg-richy-black-soft text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            🚀 Builder ({conversations.filter(c => c.agent_type === 'builder').length})
          </button>
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Conversations List */}
          <div className="space-y-4 max-h-[700px] overflow-y-auto">
            {loading ? (
              <div className="bg-richy-black-soft rounded-xl p-8 text-center">
                <p className="text-gray-400">Chargement...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="bg-richy-black-soft rounded-xl p-8 text-center">
                <p className="text-gray-400">Aucune conversation trouvée</p>
                <Link href="/dashboard" className="text-richy-gold hover:text-richy-gold-light mt-4 inline-block">
                  → Commencer une conversation
                </Link>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`bg-richy-black-soft border rounded-xl p-4 cursor-pointer transition-all hover:border-richy-gold/40 ${
                    selectedConversation?.id === conv.id 
                      ? 'border-richy-gold/60' 
                      : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{getAgentIcon(conv.agent_type)}</span>
                      <span className={`font-semibold ${getAgentColor(conv.agent_type)}`}>
                        {conv.agent_type.charAt(0).toUpperCase() + conv.agent_type.slice(1)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(conv.created_at)}
                    </span>
                  </div>
                  <h3 className="text-white font-medium line-clamp-2">
                    {conv.title || 'Sans titre'}
                  </h3>
                </div>
              ))
            )}
          </div>

          {/* Conversation Detail */}
          <div className="bg-richy-black-soft border border-gray-800 rounded-xl p-6 h-[700px] overflow-y-auto">
            {selectedConversation ? (
              <div className="space-y-6">
                <div className="border-b border-gray-800 pb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl">{getAgentIcon(selectedConversation.agent_type)}</span>
                    <h2 className={`text-xl font-bold ${getAgentColor(selectedConversation.agent_type)}`}>
                      {selectedConversation.agent_type.charAt(0).toUpperCase() + selectedConversation.agent_type.slice(1)}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedConversation.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>

                {/* Input */}
                <div>
                  <h3 className="text-richy-gold font-semibold mb-2">📥 Entrée :</h3>
                  <div className="bg-richy-black rounded-lg p-4">
                    <pre className="text-gray-300 whitespace-pre-wrap text-sm">
                      {JSON.stringify(selectedConversation.input_data, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Output */}
                <div>
                  <h3 className="text-richy-gold font-semibold mb-2">📤 Résultat :</h3>
                  <div className="bg-richy-black rounded-lg p-4">
                    <pre className="text-gray-300 whitespace-pre-wrap text-sm">
                      {JSON.stringify(selectedConversation.output_data, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Link
                    href={`/${selectedConversation.agent_type}`}
                    className="flex-1 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-2 px-4 rounded-lg text-center hover:scale-105 transition-all duration-200 shadow-lg"
                  >
                    Relancer cet agent →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">
                  Sélectionne une conversation pour voir les détails
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}