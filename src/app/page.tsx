'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-gradient-to-b from-richy-black via-richy-black-soft to-richy-black relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-richy-gold/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-richy-gold/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Header */}
      <header className="relative z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/logo-richy.png" alt="Richy.ai" className="h-16 w-16 md:h-24 md:w-24" />
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
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

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-richy-gold hover:text-richy-gold-light transition-colors z-50 relative"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu - Overlay from right */}
        <div 
          className={`md:hidden fixed top-0 right-0 bottom-0 w-64 bg-richy-black/95 backdrop-blur-sm border-l border-richy-gold/20 py-6 px-4 space-y-4 z-40 transition-all duration-300 ease-in-out ${
            isMenuOpen 
              ? 'translate-x-0 opacity-100' 
              : 'translate-x-full opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-semibold text-lg">Menu</h2>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="text-richy-gold hover:text-richy-gold-light transition-colors"
              aria-label="Close menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <Link 
            href="/login"
            onClick={() => setIsMenuOpen(false)}
            className="block w-full px-4 py-3 border border-richy-gold/30 text-white rounded-lg hover:bg-richy-gold/10 transition-colors text-sm text-center"
          >
            Se connecter
          </Link>
          <Link 
            href="/register"
            onClick={() => setIsMenuOpen(false)}
            className="block w-full px-4 py-3 bg-richy-gold text-richy-black rounded-lg hover:bg-richy-gold-light transition-colors font-semibold text-sm text-center"
          >
            Commencer
          </Link>
        </div>
        
        {/* Backdrop overlay */}
        {isMenuOpen && (
          <div
            onClick={() => setIsMenuOpen(false)}
            className="md:hidden fixed inset-0 bg-black/50 z-30"
          />
        )}
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

          <div className="flex items-center justify-center">
            <Link href="/register">
              <button className="px-8 py-4 bg-richy-gold text-richy-black rounded-lg hover:bg-richy-gold-light transition-all font-bold text-lg shadow-lg shadow-richy-gold/20">
                Commencer Gratuitement
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
                <h3 className="text-white font-medium text-sm mb-0.5">Validation d'idée</h3>
                <p className="text-gray-400 text-xs">Validator pour analyser ton SaaS</p>
              </div>
            </div>

            <div className="bg-richy-black-soft/40 backdrop-blur-sm border border-white/10 rounded-lg py-3 px-4 flex items-center gap-3 hover:border-richy-gold/30 transition-all">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-medium text-sm mb-0.5">Roadmap personnalisée</h3>
                <p className="text-gray-400 text-xs">Builder pour créer ton plan d'action</p>
              </div>
            </div>

            <div className="bg-richy-black-soft/40 backdrop-blur-sm border border-white/10 rounded-lg py-3 px-4 flex items-center gap-3 hover:border-richy-gold/30 transition-all">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-medium text-sm mb-0.5">Conseils entrepreneur</h3>
                <p className="text-gray-400 text-xs">Chat avec Richy pour tes questions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}