'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Composant enfant qui utilise useSearchParams
function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [syncing, setSyncing] = useState(true)

  useEffect(() => {
    // Nettoyer le sessionStorage si des infos d'inscription étaient en attente
    sessionStorage.removeItem('pending_registration')
    
    // Créer le compte depuis la session Stripe si nécessaire, puis synchroniser
    const createAccountAndSync = async () => {
      try {
        // Variables pour stocker les données de création de compte
        let sessionCheck: { hasRegistrationToken?: boolean } = {}
        let createAccountData: { success?: boolean; userId?: string; email?: string; magicLink?: string; userExists?: boolean } = {}
        
        // 1. D'abord, vérifier si c'est une nouvelle inscription ou un upgrade
        if (sessionId) {
          // Récupérer la session Stripe pour vérifier s'il y a un registration_token
          const sessionCheckResponse = await fetch(`/api/stripe/check-session?session_id=${sessionId}`)
          sessionCheck = await sessionCheckResponse.json().catch(() => ({ hasRegistrationToken: false }))
          
          // Si c'est une nouvelle inscription (avec registration_token), créer le compte
          if (sessionCheck.hasRegistrationToken) {
            const createAccountResponse = await fetch('/api/stripe/create-account-from-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId })
            })
            
            createAccountData = await createAccountResponse.json()
          }
        }
        
        // 2. Synchroniser la subscription avec Stripe (pour nouvelle inscription ET upgrade)
        // IMPORTANT: Cette étape doit TOUJOURS être exécutée avant toute redirection
        let data: any = { success: false }
        let syncSuccess = false
        
        // Essayer 2 fois maximum avec un délai entre les tentatives
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const response = await fetch('/api/stripe/sync-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: createAccountData?.userId || undefined
              })
            })
            
            if (response.ok) {
              data = await response.json()
              if (data.success || data.subscription) {
                syncSuccess = true
                break // Succès, on sort de la boucle
              }
            } else if (response.status === 404) {
              break // Ne pas retry si 404
            }
          } catch (error) {
            // Ignorer l'erreur et continuer
          }
          
          // Attendre un peu avant la prochaine tentative (sauf si c'est la dernière)
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
        
        // Si la synchronisation n'a pas réussi, attendre un peu pour que le webhook arrive
        if (!syncSuccess) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        // 3. Maintenant, gérer la redirection selon le type de compte créé
        if (sessionId && sessionCheck?.hasRegistrationToken && createAccountData?.success) {
          // Nouvelle inscription: utiliser le magic link si disponible
          if (createAccountData.magicLink) {
            try {
              const url = new URL(createAccountData.magicLink)
              const token = url.searchParams.get('token_hash') || url.searchParams.get('token')
              const type = url.searchParams.get('type')
              
              if (token && type) {
                // Attendre un peu pour que la subscription soit bien enregistrée
                await new Promise(resolve => setTimeout(resolve, 1500))
                window.location.href = `/auth/callback?token_hash=${token}&type=${type}&redirect_to=/dashboard`
                return
              }
            } catch (e) {
              // Ignorer l'erreur
            }
            
            // Fallback: rediriger directement vers le lien magique
            await new Promise(resolve => setTimeout(resolve, 1500))
            window.location.href = createAccountData.magicLink
            return
          } else {
            // Pas de lien magique, rediriger vers login
            await new Promise(resolve => setTimeout(resolve, 1500))
            router.push('/login?email=' + encodeURIComponent(createAccountData.email || ''))
            return
          }
        }
        
        // 4. Pour les upgrades ou si sync a réussi, rediriger vers dashboard
        if (data.success || data.subscription) {
          await new Promise(resolve => setTimeout(resolve, 1500))
          window.location.href = '/dashboard'
          return
        } else {
          // Si la synchronisation échoue, attendre quand même un peu au cas où le webhook arrive
          await new Promise(resolve => setTimeout(resolve, 3000))
          window.location.href = '/dashboard'
          return
        }
      } catch (error) {
        // En cas d'erreur, attendre un peu et rediriger quand même
        // Le middleware laissera passer si stripe_customer_id existe dans le profil
        await new Promise(resolve => setTimeout(resolve, 3000))
        window.location.href = '/dashboard'
      } finally {
        setSyncing(false)
      }
    }

    createAccountAndSync()
  }, [router, sessionId])

  return (
    <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-richy-black-soft/80 backdrop-blur-sm border border-richy-gold/20 rounded-2xl p-8 text-center">
        <svg className="w-20 h-20 text-green-400 mx-auto mb-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        
        <h1 className="text-3xl font-bold text-white mb-4">
          Paiement réussi ! 🎉
        </h1>
        
        <p className="text-gray-400 mb-6">
          {syncing ? 'Synchronisation de votre abonnement...' : 'Ton abonnement est maintenant actif. Redirection vers le dashboard...'}
        </p>
      </div>
    </div>
  )
}

// Composant exporté par défaut avec Suspense
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft flex items-center justify-center p-4">
        <div className="text-richy-gold animate-pulse">Chargement...</div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}

