import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "RICHY.AI - Ton assistant IA pour valider et construire ton SaaS",
  description: "Valide et construis ton SaaS avec l'IA. Pas de bullshit, que du concret.",
  openGraph: {
    title: "RICHY.AI - Ton assistant IA pour valider et construire ton SaaS",
    description: "Valide et construis ton SaaS avec l'IA. Pas de bullshit, que du concret.",
    type: "website",
    siteName: "RICHY.AI",
    images: [
      {
        url: "/logo-richy.png",
        width: 1200,
        height: 630,
        alt: "RICHY.AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RICHY.AI - Ton assistant IA pour valider et construire ton SaaS",
    description: "Valide et construis ton SaaS avec l'IA. Pas de bullshit, que du concret.",
    images: ["/logo-richy.png"],
  },
}

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
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-richy.png" alt="RICHY.AI" className="h-8 w-8" />
            <span className="font-display text-2xl text-richy-gold">
              RICHY.AI
            </span>
          </Link>
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
            Valide et construis ton SaaS.
          </p>
          
          <p className="text-lg md:text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Ton assistant IA entrepreneur disponible 24h/24 pour valider ton idée, générer tes prompts professionnels, 
            créer ta roadmap détaillée et t'accompagner pas à pas dans la construction de ton SaaS.
            <br /> 
            <span className="text-richy-gold">Que du concret.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <button className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black rounded-lg hover:scale-105 transition-all font-bold text-lg shadow-lg shadow-richy-gold/20 border-2 border-richy-gold/50">
                Essai Gratuit 3 jours
              </button>
            </Link>
            <Link href="/register">
              <button className="w-full sm:w-auto px-8 py-4 bg-richy-black-soft border-2 border-richy-gold text-richy-gold rounded-lg hover:bg-richy-gold/10 hover:scale-105 transition-all font-bold text-lg shadow-lg">
                Accès Premium Immédiat
              </button>
            </Link>
          </div>
        </div>

        {/* Features - Horizontal cards at bottom */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-richy-black-soft/40 backdrop-blur-sm border border-white/10 rounded-lg py-3 px-4 flex items-center gap-3 hover:border-richy-gold/30 transition-all">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-medium text-sm">Validation d'idée</h3>
              </div>
            </div>

            <div className="bg-richy-black-soft/40 backdrop-blur-sm border border-white/10 rounded-lg py-3 px-4 flex items-center gap-3 hover:border-richy-gold/30 transition-all">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-medium text-sm">Roadmap personnalisée</h3>
              </div>
            </div>

            <div className="bg-richy-black-soft/40 backdrop-blur-sm border border-white/10 rounded-lg py-3 px-4 flex items-center gap-3 hover:border-richy-gold/30 transition-all">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-medium text-sm">Conseils entrepreneur</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}