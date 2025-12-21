// components/PhoneVerification.tsx

'use client'

import { useState } from 'react'

export default function PhoneVerification({ 
  onVerified,
  userId,
  initialPhone
}: { 
  onVerified: () => void
  userId?: string | null
  initialPhone?: string
}) {
  const [step, setStep] = useState<'phone' | 'code' | 'verified'>('phone')
  const [phone, setPhone] = useState(initialPhone || '+33')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phoneLastDigits, setPhoneLastDigits] = useState('')
  const [phoneError, setPhoneError] = useState('')

  // Fonction pour valider et formater le numéro
  const validateAndFormatPhone = (value: string): { isValid: boolean; formatted: string; error: string } => {
    // Enlever tous les espaces, tirets, points
    let cleaned = value.replace(/[\s\-\.]/g, '')
    
    // Si l'utilisateur commence par 0, remplacer par +33
    if (cleaned.startsWith('0')) {
      cleaned = '+33' + cleaned.substring(1)
    }
    
    // S'assurer qu'on commence par +33
    if (!cleaned.startsWith('+33')) {
      if (cleaned.startsWith('33')) {
        cleaned = '+' + cleaned
      } else {
        cleaned = '+33' + cleaned
      }
    }
    
    // Vérifier le format : +33 suivi de 9 chiffres (numéro français)
    const phoneRegex = /^\+33[1-9]\d{8}$/
    
    if (!phoneRegex.test(cleaned)) {
      // Messages d'erreur spécifiques
      if (cleaned.length < 12) {
        return { isValid: false, formatted: cleaned, error: 'Numéro trop court. Format attendu : +33 6 12 34 56 78' }
      }
      if (cleaned.length > 12) {
        return { isValid: false, formatted: cleaned, error: 'Numéro trop long. Format attendu : +33 6 12 34 56 78' }
      }
      if (cleaned.startsWith('+330')) {
        return { isValid: false, formatted: cleaned, error: 'Ne commencez pas par 0 après +33. Utilisez directement le chiffre (ex: +33 6...)' }
      }
      return { isValid: false, formatted: cleaned, error: 'Format invalide. Format attendu : +33 6 12 34 56 78' }
    }
    
    return { isValid: true, formatted: cleaned, error: '' }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const validation = validateAndFormatPhone(value)
    
    setPhone(validation.formatted)
    setPhoneError(validation.error)
    setError('') // Clear l'erreur générale si on modifie
  }

  const sendCode = async () => {
    setLoading(true)
    setError('')
    
    // Valider avant d'envoyer
    const validation = validateAndFormatPhone(phone)
    if (!validation.isValid) {
      setPhoneError(validation.error)
      setLoading(false)
      return
    }
    
    try {
      const res = await fetch('/api/auth/phone-verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: validation.formatted })
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
        body: JSON.stringify({ phone, code, userId: userId || null })
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
                onChange={handlePhoneChange}
                className={`w-full pl-10 pr-4 py-3 bg-richy-black border rounded-lg text-white focus:outline-none transition-colors ${
                  phoneError ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-richy-gold'
                }`}
              />
            </div>
            {phoneError ? (
              <p className="text-xs text-red-400 mt-2">
                {phoneError}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-2">
                Format : +33 suivi de 9 chiffres (ex: +33 6 12 34 56 78)
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={sendCode}
            disabled={loading || !validateAndFormatPhone(phone).isValid}
            className="w-full py-3 bg-gradient-to-r from-richy-gold to-richy-gold-light 
                     text-richy-black font-bold rounded-lg hover:scale-105 
                     transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
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
              setPhone('+33')
              setPhoneError('')
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
            Redirection vers le dashboard...
          </p>
        </div>
      )}
    </div>
  )
}