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

interface GroupedChatConversation {
  thread_id: string
  first_conversation_id: string
  first_message: string
  message_count: number
  created_at: string
  last_updated: string
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [groupedChatConversations, setGroupedChatConversations] = useState<GroupedChatConversation[]>([])
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
      // Pour 'all', on affiche les conversations groupées de chat + les autres
      const otherConversations = conversations.filter(c => c.agent_type !== 'chat')
      setFilteredConversations(otherConversations)
    } else if (selectedAgent === 'chat') {
      // Pour 'chat', on n'affiche rien dans filteredConversations car on utilise groupedChatConversations
      setFilteredConversations([])
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

      const allConversations = data || []
      setConversations(allConversations)

      // Regrouper les conversations de chat par thread_id
      const chatConversations = allConversations.filter(c => c.agent_type === 'chat')
      const otherConversations = allConversations.filter(c => c.agent_type !== 'chat')

      // Grouper par thread_id
      const threadMap = new Map<string, Conversation[]>()
      chatConversations.forEach(conv => {
        const threadId = conv.input_data?.thread_id || conv.output_data?.thread_id || conv.id
        if (!threadMap.has(threadId)) {
          threadMap.set(threadId, [])
        }
        threadMap.get(threadId)!.push(conv)
      })

      // Créer les conversations groupées
      const grouped: GroupedChatConversation[] = Array.from(threadMap.entries()).map(([threadId, convs]) => {
        // Trier par date de création (plus ancien en premier)
        const sorted = [...convs].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        const firstMessage = first.input_data?.message || first.title || 'Message'

        return {
          thread_id: threadId,
          first_conversation_id: first.id,
          first_message: firstMessage,
          message_count: sorted.length,
          created_at: first.created_at,
          last_updated: last.created_at
        }
      })

      // Trier par date de dernière mise à jour (plus récent en premier)
      grouped.sort((a, b) => 
        new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
      )

      setGroupedChatConversations(grouped)

      // Pour les autres types, on garde l'affichage normal
      setFilteredConversations(otherConversations)
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
            Tous ({groupedChatConversations.length + conversations.filter(c => c.agent_type !== 'chat').length})
          </button>
          <button
            onClick={() => setSelectedAgent('chat')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedAgent === 'chat' 
                ? 'bg-richy-gold text-richy-black' 
                : 'bg-richy-black-soft text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            💬 Chat ({groupedChatConversations.length})
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
            ) : (
              <>
                {/* Conversations de chat groupées */}
                {selectedAgent === 'all' || selectedAgent === 'chat' ? (
                  groupedChatConversations.map((grouped) => (
                    <Link
                      key={grouped.thread_id}
                      href={`/chat?conversation=${grouped.first_conversation_id}`}
                      className="block"
                    >
                      <div className="bg-richy-black-soft border border-gray-800 rounded-xl p-4 cursor-pointer transition-all hover:border-richy-gold/40 hover:bg-richy-black/50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">💬</span>
                            <span className="font-semibold text-blue-400">
                              Chat
                            </span>
                            {grouped.message_count > 1 && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                {grouped.message_count} messages
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(grouped.last_updated)}
                          </span>
                        </div>
                        <h3 className="text-white font-medium line-clamp-2">
                          {grouped.first_message}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Clique pour continuer la conversation →
                        </p>
                      </div>
                    </Link>
                  ))
                ) : null}

                {/* Autres conversations (validator, prompt, builder) */}
                {filteredConversations.length === 0 && (selectedAgent !== 'all' && selectedAgent !== 'chat') ? (
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

                {/* Message si aucune conversation */}
                {groupedChatConversations.length === 0 && filteredConversations.length === 0 && !loading && (
                  <div className="bg-richy-black-soft rounded-xl p-8 text-center">
                    <p className="text-gray-400">Aucune conversation trouvée</p>
                    <Link href="/dashboard" className="text-richy-gold hover:text-richy-gold-light mt-4 inline-block">
                      → Commencer une conversation
                    </Link>
                  </div>
                )}
              </>
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