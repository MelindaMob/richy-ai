// components/PhoneVerification.tsx

'use client'

import { useState } from 'react'

export default function PhoneVerification({ 
  onVerified,
  initialPhone = ''
}: { 
  onVerified: () => void
  initialPhone?: string
}) {
  const [step, setStep] = useState<'phone' | 'code' | 'verified'>('phone')
  const [phone, setPhone] = useState(initialPhone || '+33')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phoneLastDigits, setPhoneLastDigits] = useState('')

  // Validation du format téléphone français
  const isValidFrenchPhone = (phoneNumber: string): boolean => {
    // Format: +33 6 12 34 56 78 ou +33612345678
    const normalized = phoneNumber.replace(/\s/g, '')
    // Doit commencer par +33 et avoir 10 chiffres après (total 13 caractères)
    return /^\+33[67]\d{8}$/.test(normalized)
  }

  const sendCode = async () => {
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/auth/phone-verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error)
        
        // Si déjà utilisé, proposer le plan payant
        if (data.alreadyUsed) {
          setTimeout(() => {
            window.location.href = '/pricing'
          }, 3000)
        }
        return
      }
      
      setPhoneLastDigits(data.phoneLastDigits)
      setStep('code')
      
    } catch (err) {
      setError('Erreur réseau, réessaye')
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/auth/phone-verify/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error)
        return
      }
      
      setStep('verified')
      setTimeout(() => {
        onVerified()
      }, 2000)
      
    } catch (err) {
      setError('Erreur réseau, réessaye')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-richy-black-soft rounded-xl border border-richy-gold/20">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <svg className="w-12 h-12 text-richy-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Vérification téléphone
        </h2>
        <p className="text-gray-400 text-sm">
          Pour profiter de tes 3 jours gratuits
        </p>
      </div>

      {/* Step 1: Phone */}
      {step === 'phone' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Numéro de téléphone
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-3 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <input
                type="tel"
                placeholder="+33 6 12 34 56 78"
                value={phone}
                onChange={(e) => {
                  let value = e.target.value
                  // Forcer +33 au début
                  if (!value.startsWith('+33')) {
                    value = '+33' + value.replace(/^\+33/, '')
                  }
                  // Limiter à 17 caractères max (+33 6 12 34 56 78)
                  if (value.length <= 17) {
                    setPhone(value)
                  }
                }}
                onBlur={(e) => {
                  // Formater automatiquement avec espaces
                  let value = e.target.value.replace(/\s/g, '')
                  if (value.startsWith('+33') && value.length > 3) {
                    // Formater: +33 6 12 34 56 78
                    const number = value.substring(3)
                    if (number.length >= 1) {
                      const formatted = '+33 ' + number.match(/.{1,2}/g)?.join(' ') || number
                      setPhone(formatted)
                    }
                  }
                }}
                className="w-full pl-10 pr-4 py-3 bg-richy-black border border-gray-700 
                         rounded-lg text-white focus:border-richy-gold transition-colors"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Format international requis (+33 pour la France)
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={sendCode}
            disabled={loading || !isValidFrenchPhone(phone)}
            className="w-full py-3 bg-gradient-to-r from-richy-gold to-richy-gold-light 
                     text-richy-black font-bold rounded-lg hover:scale-105 
                     transition-all disabled:opacity-50 disabled:scale-100"
          >
            {loading ? 'Envoi...' : 'Recevoir le code SMS'}
          </button>
          
          {phone && !isValidFrenchPhone(phone) && phone.length > 3 && (
            <p className="text-red-400 text-xs mt-2">
              Format invalide. Utilisez un numéro français : +33 6 12 34 56 78
            </p>
          )}

          <p className="text-xs text-center text-gray-500">
            Un seul essai gratuit par numéro • RGPD compliant
          </p>
        </div>
      )}

      {/* Step 2: Code */}
      {step === 'code' && (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
            <p className="text-green-400 text-sm">
              ✅ Code envoyé au ****{phoneLastDigits}
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Code à 6 chiffres
            </label>
            <input
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 bg-richy-black border border-gray-700 
                       rounded-lg text-white text-center text-2xl tracking-widest
                       focus:border-richy-gold transition-colors"
              maxLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={verifyCode}
            disabled={loading || code.length !== 6}
            className="w-full py-3 bg-gradient-to-r from-richy-gold to-richy-gold-light 
                     text-richy-black font-bold rounded-lg hover:scale-105 
                     transition-all disabled:opacity-50 disabled:scale-100"
          >
            {loading ? 'Vérification...' : 'Vérifier le code'}
          </button>

          <button
            onClick={() => {
              setStep('phone')
              setCode('')
              setError('')
            }}
            className="w-full py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Changer de numéro
          </button>
        </div>
      )}

      {/* Step 3: Verified */}
      {step === 'verified' && (
        <div className="text-center space-y-4 py-8">
          <svg className="w-20 h-20 text-green-400 mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-2xl font-bold text-white">
            Vérifié avec succès ! 🎉
          </h3>
          <p className="text-gray-400">
            Finalisation de l'inscription...
          </p>
        </div>
      )}
    </div>
  )
}