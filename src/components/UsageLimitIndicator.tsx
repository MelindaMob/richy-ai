// components/UsageLimitIndicator.tsx

'use client'

import { AlertCircle, Lock } from 'lucide-react'
import { useState } from 'react'
import UpgradeModal from './UpgradeModal'

export function UsageLimitIndicator({ 
  remaining, 
  agentType 
}: { 
  remaining?: number
  agentType: string 
}) {
  const [showUpgrade, setShowUpgrade] = useState(false)

  if (remaining === undefined) return null

  return (
    <>
      {/* Toast notification */}
      <div className="toast toast-bottom toast-end">
        <div className={`alert ${remaining === 0 ? 'alert-error' : 'alert-warning'}`}>
          {remaining === 0 ? (
            <>
              <Lock className="w-5 h-5" />
              <div>
                <div className="font-bold">Limite atteinte !</div>
                <div className="text-xs">Upgrade pour continuer</div>
              </div>
              <button 
                onClick={() => setShowUpgrade(true)}
                className="btn btn-sm btn-primary"
              >
                Upgrade
              </button>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5" />
              <span>
                {remaining} {agentType === 'chat' ? 'messages' : 'usage(s)'} restant(s)
              </span>
            </>
          )}
        </div>
      </div>

      <UpgradeModal 
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="LIMIT_REACHED"
      />
    </>
  )
}