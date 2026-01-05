// components/PhoneVerification.tsx

'use client'

import { useState } from 'react'
import { Phone, Shield, CheckCircle } from 'lucide-react'

export default function PhoneVerification({ 
  onVerified 
}: { 
  onVerified: () => void 
}) {
  const [step, setStep] = useState<'phone' | 'code' | 'verified'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phoneLastDigits, setPhoneLastDigits] = useState('')

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
          <Shield className="w-12 h-12 text-richy-gold" />
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
              <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                placeholder="+33 6 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
            disabled={loading || phone.length < 10}
            className="w-full py-3 bg-gradient-to-r from-richy-gold to-richy-gold-light 
                     text-richy-black font-bold rounded-lg hover:scale-105 
                     transition-all disabled:opacity-50 disabled:scale-100"
          >
            {loading ? 'Envoi...' : 'Recevoir le code SMS'}
          </button>

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
          <CheckCircle className="w-20 h-20 text-green-400 mx-auto animate-pulse" />
          <h3 className="text-2xl font-bold text-white">
            Vérifié avec succès ! 🎉
          </h3>
          <p className="text-gray-400">
            Redirection vers le dashboard...
          </p>
        </div>
      )}
    </div>
  )
}