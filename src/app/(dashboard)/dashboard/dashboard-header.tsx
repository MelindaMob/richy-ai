'use client'

import { useState } from 'react'
import Link from 'next/link'

interface DashboardHeaderProps {
  trialDaysLeft: number
  userEmail: string
}

export function DashboardHeader({ trialDaysLeft, userEmail }: DashboardHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="border-b border-richy-gold/20 bg-richy-black/50 backdrop-blur-sm sticky top-0 z-50 relative">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-2xl md:text-3xl text-richy-gold hover:text-richy-gold-light transition-colors">
            RICHY.AI
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Historique */}
            <Link 
              href="/history" 
              className="text-gray-400 hover:text-richy-gold transition-colors text-sm font-medium"
            >
              📜 Historique
            </Link>

            {/* Status abonnement */}
            <div className="text-sm">
              <span className="text-yellow-400">
                🔥 Essai gratuit - {trialDaysLeft} jour(s) restant(s)
              </span>
            </div>

            {/* User info */}
            <div className="text-white text-sm">
              {userEmail}
            </div>

            {/* Logout */}
            <form action="/api/auth/logout" method="POST">
              <button className="text-gray-400 hover:text-white transition-colors text-sm">
                Déconnexion
              </button>
            </form>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-richy-gold hover:text-richy-gold-light transition-colors"
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

        {/* Mobile Menu */}
        <div 
          className={`md:hidden absolute top-full left-0 right-0 bg-richy-black/95 backdrop-blur-sm border-b border-richy-gold/20 py-4 px-4 space-y-4 z-50 transition-all duration-200 ease-in-out overflow-hidden ${
            isMenuOpen 
              ? 'max-h-96 opacity-100' 
              : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <Link 
            href="/history" 
            onClick={() => setIsMenuOpen(false)}
            className="block text-gray-400 hover:text-richy-gold transition-colors text-sm font-medium"
          >
            📜 Historique
          </Link>

          <div className="text-sm">
            <span className="text-yellow-400">
              🔥 Essai gratuit - {trialDaysLeft} jour(s) restant(s)
            </span>
          </div>

          <div className="text-white text-sm">
            {userEmail}
          </div>

          <form action="/api/auth/logout" method="POST">
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}

