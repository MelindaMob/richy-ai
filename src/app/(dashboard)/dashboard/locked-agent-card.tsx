'use client'

import { useState } from 'react'
import UpgradeModal from '@/components/UpgradeModal'

interface LockedAgentCardProps {
  title: string
  description: string
  tags: string
}

export default function LockedAgentCard({ title, description, tags }: LockedAgentCardProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  return (
    <>
      <div className="relative bg-richy-black-soft border border-gray-700 rounded-xl p-8 opacity-50 blur-sm pointer-events-none">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-500">
            {title}
          </h3>
          <span className="text-gray-500 text-2xl">
            →
          </span>
        </div>
        <p className="text-gray-500">
          {description}
        </p>
        <div className="mt-4 text-sm text-gray-600">
          {tags}
        </div>
      </div>
      
      {/* Overlay avec bouton */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-richy-black-soft/95 border border-richy-gold/30 rounded-xl p-6 text-center backdrop-blur-sm">
          <p className="text-white font-semibold mb-4">🔒 Réservé Premium</p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Upgrade pour débloquer →
          </button>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason="FEATURE_LOCKED"
      />
    </>
  )
}

