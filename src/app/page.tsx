import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-richy-black via-richy-black-soft to-richy-black relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-richy-gold/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-richy-gold/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl text-richy-gold">
            RICHY.AI
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/login"
              className="px-4 py-2 border border-richy-gold/30 text-white rounded-lg hover:bg-richy-gold/10 transition-colors text-sm"
            >
              Se connecter
            </Link>
            <Link 
              href="/register"
              className="px-4 py-2 bg-richy-gold text-richy-black rounded-lg hover:bg-richy-gold-light transition-colors font-semibold text-sm"
            >
              Commencer
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <h1 className="font-display text-6xl md:text-8xl text-white mb-4 leading-tight">
            RICHY AI
          </h1>
          <p className="text-3xl md:text-4xl text-richy-gold mb-6 font-semibold">
            valide et construis ton SaaS.
          </p>
          
          <p className="text-lg md:text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Ton assistant IA disponible 24h/24 et 7j/7 pour valider ton idée, générer tes prompts, 
            créer ta roadmap et t'accompagner dans la construction de ton SaaS. Pas de bullshit, que du concret.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <button className="px-8 py-4 bg-richy-gold text-richy-black rounded-lg hover:bg-richy-gold-light transition-all font-bold text-lg shadow-lg shadow-richy-gold/20">
                Commencer
              </button>
            </Link>
            <Link href="#demo">
              <button className="px-8 py-4 bg-richy-black-soft border border-richy-gold/30 text-white rounded-lg hover:bg-richy-gold/10 transition-all font-semibold text-lg">
                Découvrir la vidéo
              </button>
            </Link>
          </div>
        </div>

        {/* Features - Horizontal cards at bottom */}
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-richy-black-soft/50 backdrop-blur-sm border border-white/20 rounded-xl p-6 flex items-center gap-4 hover:border-richy-gold/40 transition-all">
              <div className="text-3xl">💬</div>
              <div>
                <h3 className="text-white font-semibold mb-1">Réponse instantanée</h3>
                <p className="text-gray-400 text-sm">Conseils en temps réel</p>
              </div>
            </div>

            <div className="bg-richy-black-soft/50 backdrop-blur-sm border border-white/20 rounded-xl p-6 flex items-center gap-4 hover:border-richy-gold/40 transition-all">
              <div className="text-3xl">🎯</div>
              <div>
                <h3 className="text-white font-semibold mb-1">Validation automatique</h3>
                <p className="text-gray-400 text-sm">Analyse complète de ton SaaS</p>
              </div>
            </div>

            <div className="bg-richy-black-soft/50 backdrop-blur-sm border border-white/20 rounded-xl p-6 flex items-center gap-4 hover:border-richy-gold/40 transition-all">
              <div className="text-3xl">🚀</div>
              <div>
                <h3 className="text-white font-semibold mb-1">Service 24h/24 et 7j/7</h3>
                <p className="text-gray-400 text-sm">Disponible à tout moment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}