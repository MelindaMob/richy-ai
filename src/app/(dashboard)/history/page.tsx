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

      // Grouper les conversations par thread_id pour le chat
      // Pour les autres agents, chaque conversation est indépendante
      const chatConversations: Conversation[] = []
      const otherConversations: Conversation[] = []

      // Séparer les conversations de chat des autres
      ;(data || []).forEach((conv) => {
        if (conv.agent_type === 'chat') {
          chatConversations.push(conv)
        } else {
          otherConversations.push(conv)
        }
      })

      // Pour le chat, trier par date croissante pour identifier la première de chaque thread
      chatConversations.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )

      // Grouper par thread_id et ne garder que la première conversation de chaque thread
      const groupedChatConversations: Conversation[] = []
      
      // Créer un map pour trouver rapidement les conversations par ID
      const conversationsById = new Map<string, Conversation>()
      chatConversations.forEach(conv => conversationsById.set(conv.id, conv))

      // Map pour stocker toutes les conversations par thread_id normalisé
      const threadIdToConversations = new Map<string, Conversation[]>()
      
      // Fonction pour normaliser le thread_id
      const normalizeThreadId = (conv: Conversation): string => {
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
      
      // Étape 1 : Grouper toutes les conversations par leur thread_id normalisé
      chatConversations.forEach((conv) => {
        const normalizedThreadId = normalizeThreadId(conv)
        
        if (!threadIdToConversations.has(normalizedThreadId)) {
          threadIdToConversations.set(normalizedThreadId, [])
        }
        threadIdToConversations.get(normalizedThreadId)!.push(conv)
      })

      // Étape 2 : Pour chaque thread, trouver la conversation la plus ancienne
      threadIdToConversations.forEach((convs, normalizedThreadId) => {
        // Trier par date croissante pour trouver la plus ancienne
        const sortedConvs = [...convs].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        const firstConv = sortedConvs[0]
        groupedChatConversations.push(firstConv)
      })

      // Retrier les conversations de chat par date décroissante pour l'affichage
      groupedChatConversations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      // Combiner les conversations de chat groupées avec les autres
      const groupedConversations = [...groupedChatConversations, ...otherConversations]
      
      // Retrier le tout par date décroissante
      groupedConversations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setConversations(groupedConversations)
      setFilteredConversations(groupedConversations)
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
            <Link href="/dashboard" className="flex items-center gap-2 font-display text-3xl text-richy-gold hover:text-richy-gold-light transition-colors">
              <img src="/logo-richy.png" alt="Richy.ai" className="h-8 w-8" />
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
          <div className={`space-y-4 ${selectedConversation ? 'hidden md:block' : ''} max-h-[700px] overflow-y-auto`}>
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

          {/* Conversation Detail - Desktop */}
          <div className="hidden md:block bg-richy-black-soft border border-gray-800 rounded-xl p-6 h-[700px] overflow-y-auto">
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
                    {selectedConversation.agent_type === 'chat' ? (
                      <p className="text-gray-300 whitespace-pre-wrap text-sm">
                        {selectedConversation.input_data?.message || JSON.stringify(selectedConversation.input_data, null, 2)}
                      </p>
                    ) : selectedConversation.agent_type === 'validator' ? (
                      <div className="space-y-2 text-sm text-gray-300">
                        {selectedConversation.input_data?.url && (
                          <p><span className="text-richy-gold">URL :</span> {selectedConversation.input_data.url}</p>
                        )}
                        {selectedConversation.input_data?.description && (
                          <p><span className="text-richy-gold">Description :</span> {selectedConversation.input_data.description}</p>
                        )}
                        {!selectedConversation.input_data?.url && !selectedConversation.input_data?.description && (
                          <pre className="whitespace-pre-wrap">{JSON.stringify(selectedConversation.input_data, null, 2)}</pre>
                        )}
                      </div>
                    ) : selectedConversation.agent_type === 'prompt' ? (
                      <div className="space-y-2 text-sm text-gray-300">
                        {selectedConversation.input_data?.description && (
                          <p><span className="text-richy-gold">Description :</span> {selectedConversation.input_data.description}</p>
                        )}
                        {!selectedConversation.input_data?.description && (
                          <pre className="whitespace-pre-wrap">{JSON.stringify(selectedConversation.input_data, null, 2)}</pre>
                        )}
                      </div>
                    ) : selectedConversation.agent_type === 'builder' ? (
                      <div className="space-y-2 text-sm text-gray-300">
                        {selectedConversation.input_data?.description && (
                          <p><span className="text-richy-gold">Description :</span> {selectedConversation.input_data.description}</p>
                        )}
                        {!selectedConversation.input_data?.description && (
                          <pre className="whitespace-pre-wrap">{JSON.stringify(selectedConversation.input_data, null, 2)}</pre>
                        )}
                      </div>
                    ) : (
                      <pre className="text-gray-300 whitespace-pre-wrap text-sm">
                        {JSON.stringify(selectedConversation.input_data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Output */}
                <div>
                  <h3 className="text-richy-gold font-semibold mb-2">📤 Résultat :</h3>
                  <div className="bg-richy-black rounded-lg p-4">
                    {selectedConversation.agent_type === 'chat' ? (
                      <p className="text-gray-300 whitespace-pre-wrap text-sm">
                        {selectedConversation.output_data?.response || JSON.stringify(selectedConversation.output_data, null, 2)}
                      </p>
                    ) : selectedConversation.agent_type === 'validator' ? (
                      <div className="space-y-3 text-sm">
                        {selectedConversation.output_data?.score !== undefined && (
                          <div>
                            <span className="text-richy-gold font-semibold">Score :</span>{' '}
                            <span className="text-white text-lg font-bold">{selectedConversation.output_data.score}/100</span>
                          </div>
                        )}
                        {selectedConversation.output_data?.analysis && (
                          <div>
                            <span className="text-richy-gold font-semibold">Analyse :</span>
                            <p className="text-gray-300 whitespace-pre-wrap mt-1">{selectedConversation.output_data.analysis}</p>
                          </div>
                        )}
                        {selectedConversation.output_data?.response && (
                          <p className="text-gray-300 whitespace-pre-wrap">{selectedConversation.output_data.response}</p>
                        )}
                        {!selectedConversation.output_data?.score && !selectedConversation.output_data?.analysis && !selectedConversation.output_data?.response && (
                          <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(selectedConversation.output_data, null, 2)}</pre>
                        )}
                      </div>
                    ) : selectedConversation.agent_type === 'prompt' ? (
                      <div className="space-y-2">
                        {selectedConversation.output_data?.prompt && (
                          <div>
                            <span className="text-richy-gold font-semibold">Prompt généré :</span>
                            <pre className="text-gray-300 whitespace-pre-wrap text-sm mt-2 bg-richy-black-soft p-3 rounded border border-gray-700">
                              {selectedConversation.output_data.prompt}
                            </pre>
                          </div>
                        )}
                        {selectedConversation.output_data?.response && (
                          <p className="text-gray-300 whitespace-pre-wrap text-sm">{selectedConversation.output_data.response}</p>
                        )}
                        {!selectedConversation.output_data?.prompt && !selectedConversation.output_data?.response && (
                          <pre className="text-gray-300 whitespace-pre-wrap text-sm">{JSON.stringify(selectedConversation.output_data, null, 2)}</pre>
                        )}
                      </div>
                    ) : selectedConversation.agent_type === 'builder' ? (
                      <div className="space-y-2">
                        {selectedConversation.output_data?.roadmap && (
                          <div>
                            <span className="text-richy-gold font-semibold">Roadmap :</span>
                            <pre className="text-gray-300 whitespace-pre-wrap text-sm mt-2 bg-richy-black-soft p-3 rounded border border-gray-700">
                              {selectedConversation.output_data.roadmap}
                            </pre>
                          </div>
                        )}
                        {selectedConversation.output_data?.response && (
                          <p className="text-gray-300 whitespace-pre-wrap text-sm">{selectedConversation.output_data.response}</p>
                        )}
                        {!selectedConversation.output_data?.roadmap && !selectedConversation.output_data?.response && (
                          <pre className="text-gray-300 whitespace-pre-wrap text-sm">{JSON.stringify(selectedConversation.output_data, null, 2)}</pre>
                        )}
                      </div>
                    ) : (
                      <pre className="text-gray-300 whitespace-pre-wrap text-sm">
                        {JSON.stringify(selectedConversation.output_data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Link
                      href={`/${selectedConversation.agent_type}?conversation=${selectedConversation.id}`}
                      className="flex-1 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-2 px-4 rounded-lg text-center hover:scale-105 transition-all duration-200 shadow-lg"
                    >
                      Continuer cette conversation →
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

          {/* Mobile Modal */}
          {selectedConversation && (
            <div className="md:hidden fixed inset-0 z-50 bg-richy-black">
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="bg-richy-black-soft border-b border-gray-800 p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getAgentIcon(selectedConversation.agent_type)}</span>
                    <h2 className={`text-lg font-bold ${getAgentColor(selectedConversation.agent_type)}`}>
                      {selectedConversation.agent_type.charAt(0).toUpperCase() + selectedConversation.agent_type.slice(1)}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="text-richy-gold hover:text-richy-gold-light transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  <div className="border-b border-gray-800 pb-4">
                    <p className="text-sm text-gray-500">
                      {new Date(selectedConversation.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>

                  {/* Input */}
                  <div>
                    <h3 className="text-richy-gold font-semibold mb-2">📥 Entrée :</h3>
                    <div className="bg-richy-black-soft rounded-lg p-4">
                      {selectedConversation.agent_type === 'chat' ? (
                        <p className="text-gray-300 whitespace-pre-wrap text-sm">
                          {selectedConversation.input_data?.message || JSON.stringify(selectedConversation.input_data, null, 2)}
                        </p>
                      ) : selectedConversation.agent_type === 'validator' ? (
                        <div className="space-y-2 text-sm text-gray-300">
                          {selectedConversation.input_data?.url && (
                            <p><span className="text-richy-gold">URL :</span> {selectedConversation.input_data.url}</p>
                          )}
                          {selectedConversation.input_data?.description && (
                            <p><span className="text-richy-gold">Description :</span> {selectedConversation.input_data.description}</p>
                          )}
                          {!selectedConversation.input_data?.url && !selectedConversation.input_data?.description && (
                            <pre className="whitespace-pre-wrap">{JSON.stringify(selectedConversation.input_data, null, 2)}</pre>
                          )}
                        </div>
                      ) : selectedConversation.agent_type === 'prompt' ? (
                        <div className="space-y-2 text-sm text-gray-300">
                          {selectedConversation.input_data?.description && (
                            <p><span className="text-richy-gold">Description :</span> {selectedConversation.input_data.description}</p>
                          )}
                          {!selectedConversation.input_data?.description && (
                            <pre className="whitespace-pre-wrap">{JSON.stringify(selectedConversation.input_data, null, 2)}</pre>
                          )}
                        </div>
                      ) : selectedConversation.agent_type === 'builder' ? (
                        <div className="space-y-2 text-sm text-gray-300">
                          {selectedConversation.input_data?.description && (
                            <p><span className="text-richy-gold">Description :</span> {selectedConversation.input_data.description}</p>
                          )}
                          {!selectedConversation.input_data?.description && (
                            <pre className="whitespace-pre-wrap">{JSON.stringify(selectedConversation.input_data, null, 2)}</pre>
                          )}
                        </div>
                      ) : (
                        <pre className="text-gray-300 whitespace-pre-wrap text-sm">
                          {JSON.stringify(selectedConversation.input_data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Output */}
                  <div>
                    <h3 className="text-richy-gold font-semibold mb-2">📤 Résultat :</h3>
                    <div className="bg-richy-black-soft rounded-lg p-4">
                      {selectedConversation.agent_type === 'chat' ? (
                        <p className="text-gray-300 whitespace-pre-wrap text-sm">
                          {selectedConversation.output_data?.response || JSON.stringify(selectedConversation.output_data, null, 2)}
                        </p>
                      ) : selectedConversation.agent_type === 'validator' ? (
                        <div className="space-y-3 text-sm">
                          {selectedConversation.output_data?.score !== undefined && (
                            <div>
                              <span className="text-richy-gold font-semibold">Score :</span>{' '}
                              <span className="text-white text-lg font-bold">{selectedConversation.output_data.score}/100</span>
                            </div>
                          )}
                          {selectedConversation.output_data?.analysis && (
                            <div>
                              <span className="text-richy-gold font-semibold">Analyse :</span>
                              <p className="text-gray-300 whitespace-pre-wrap mt-1">{selectedConversation.output_data.analysis}</p>
                            </div>
                          )}
                          {selectedConversation.output_data?.response && (
                            <p className="text-gray-300 whitespace-pre-wrap">{selectedConversation.output_data.response}</p>
                          )}
                          {!selectedConversation.output_data?.score && !selectedConversation.output_data?.analysis && !selectedConversation.output_data?.response && (
                            <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(selectedConversation.output_data, null, 2)}</pre>
                          )}
                        </div>
                      ) : selectedConversation.agent_type === 'prompt' ? (
                        <div className="space-y-2">
                          {selectedConversation.output_data?.prompt && (
                            <div>
                              <span className="text-richy-gold font-semibold">Prompt généré :</span>
                              <pre className="text-gray-300 whitespace-pre-wrap text-sm mt-2 bg-richy-black p-3 rounded border border-gray-700">
                                {selectedConversation.output_data.prompt}
                              </pre>
                            </div>
                          )}
                          {selectedConversation.output_data?.response && (
                            <p className="text-gray-300 whitespace-pre-wrap text-sm">{selectedConversation.output_data.response}</p>
                          )}
                          {!selectedConversation.output_data?.prompt && !selectedConversation.output_data?.response && (
                            <pre className="text-gray-300 whitespace-pre-wrap text-sm">{JSON.stringify(selectedConversation.output_data, null, 2)}</pre>
                          )}
                        </div>
                      ) : selectedConversation.agent_type === 'builder' ? (
                        <div className="space-y-2">
                          {selectedConversation.output_data?.roadmap && (
                            <div>
                              <span className="text-richy-gold font-semibold">Roadmap :</span>
                              <pre className="text-gray-300 whitespace-pre-wrap text-sm mt-2 bg-richy-black p-3 rounded border border-gray-700">
                                {selectedConversation.output_data.roadmap}
                              </pre>
                            </div>
                          )}
                          {selectedConversation.output_data?.response && (
                            <p className="text-gray-300 whitespace-pre-wrap text-sm">{selectedConversation.output_data.response}</p>
                          )}
                          {!selectedConversation.output_data?.roadmap && !selectedConversation.output_data?.response && (
                            <pre className="text-gray-300 whitespace-pre-wrap text-sm">{JSON.stringify(selectedConversation.output_data, null, 2)}</pre>
                          )}
                        </div>
                      ) : (
                        <pre className="text-gray-300 whitespace-pre-wrap text-sm">
                          {JSON.stringify(selectedConversation.output_data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pb-4">
                    <Link
                      href={`/${selectedConversation.agent_type}?conversation=${selectedConversation.id}`}
                      onClick={() => setSelectedConversation(null)}
                      className="flex-1 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-2 px-4 rounded-lg text-center hover:scale-105 transition-all duration-200 shadow-lg"
                    >
                      Continuer cette conversation →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}