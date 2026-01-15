'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import UpgradeModal from '@/components/UpgradeModal'

interface DashboardHeaderProps {
  trialDaysLeft: number
  userEmail: string
  subscriptionStatus: string
  hasTrialLimitations: boolean
}

export function DashboardHeader({ 
  trialDaysLeft, 
  userEmail,
  subscriptionStatus,
  hasTrialLimitations
}: DashboardHeaderProps) {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isTrial = hasTrialLimitations || subscriptionStatus === 'trialing'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <>
      <header className="border-b border-richy-gold/20 bg-richy-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2">
              <img src="/richy-logo.jpg" alt="Richy.ai" className="h-8 w-8" />
              <span className="font-display text-2xl text-richy-gold hidden md:block">RICHY.AI</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
                Dashboard
              </Link>
              <Link href="/chat" className="text-gray-400 hover:text-white transition-colors text-sm">
                Chat
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
              <Link href="/history" className="text-gray-400 hover:text-white transition-colors text-sm">
                📜 Historique
              </Link>

              {/* Status abonnement */}
              {isTrial ? (
                <div className="flex items-center gap-3">
                  <span className="badge badge-warning">
                    🔥 Essai gratuit - {trialDaysLeft} jour(s)
                  </span>
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="btn btn-primary btn-sm"
                  >
                    Upgrade →
                  </button>
                </div>
              ) : (
                <span className="badge badge-success">
                  👑 Premium
                </span>
              )}

              {/* User menu */}
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">{userEmail}</span>
                <button
                  onClick={handleLogout}
                  className="btn btn-ghost btn-sm"
                >
                  Déconnexion
                </button>
              </div>
            </nav>

            {/* Mobile Burger Button */}
            <button
              onClick={() => setMenuOpen(!isMenuOpen)}
              className="md:hidden text-richy-gold p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-200 ${
              isMenuOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
            }`}
            style={{
              pointerEvents: isMenuOpen ? 'auto' : 'none'
            }}
          >
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-lg p-4 space-y-3">
              <Link 
                href="/dashboard" 
                className="block text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link 
                href="/chat" 
                className="block text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Chat
              </Link>
              <Link 
                href="/validator" 
                className="block text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Validator
              </Link>
              <Link 
                href="/prompt" 
                className="block text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Prompt
              </Link>
              <Link 
                href="/builder" 
                className="block text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Builder
              </Link>
              <Link 
                href="/history" 
                className="block text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                📜 Historique
              </Link>
              
              <div className="border-t border-gray-700 pt-3 mt-3">
                {isTrial ? (
                  <div className="space-y-2">
                    <span className="block text-yellow-400 text-sm font-semibold">
                      🔥 Essai gratuit - {trialDaysLeft} jour(s)
                    </span>
                    <button
                      onClick={() => {
                        setShowUpgrade(true)
                        setMenuOpen(false)
                      }}
                      className="w-full btn btn-primary btn-sm"
                    >
                      Upgrade →
                    </button>
                  </div>
                ) : (
                  <span className="block text-green-400 text-sm font-semibold">
                    👑 Premium
                  </span>
                )}
                <p className="text-gray-400 text-xs mt-2">{userEmail}</p>
                <button
                  onClick={handleLogout}
                  className="w-full btn btn-ghost btn-sm mt-2"
                >
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="UPGRADE"
      />
    </>
  )
}

