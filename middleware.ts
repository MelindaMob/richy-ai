import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'

export async function middleware(request: NextRequest) {
  // Mettre à jour la session Supabase
  const response = await updateSession(request)
  
  // Ne pas toucher aux routes d'inscription (/register/*)
  // Ces routes gèrent leur propre logique de redirection
  if (request.nextUrl.pathname.startsWith('/register')) {
    return response
  }
  
  // Protéger les routes /dashboard/* (sauf /dashboard/payment-success)
  if (request.nextUrl.pathname.startsWith('/dashboard') && 
      !request.nextUrl.pathname.startsWith('/dashboard/payment-success')) {
    
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      // Si pas connecté, rediriger vers login
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      
      // Vérifier si l'utilisateur a une subscription active dans la table subscriptions
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, trial_limitations, trial_ends_at, current_period_end, stripe_subscription_id, plan_type')
        .eq('user_id', user.id)
        .maybeSingle()
      
      // Si pas de subscription, vérifier si un paiement vient d'être fait (webhook en cours)
      // Dans ce cas, on laisse passer pour permettre la synchronisation
      if (!subscription) {
        // Vérifier si l'utilisateur a un customer Stripe (indique qu'un paiement a été fait)
        // Si oui, laisser passer pour permettre la synchronisation
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .maybeSingle()
        
        // Si pas de customer Stripe, rediriger vers pricing
        if (!profile?.stripe_customer_id) {
          return NextResponse.redirect(new URL('/register/pricing-choice', request.url))
        }
        // Sinon, laisser passer (le webhook va créer la subscription)
        return response
      }
      
      // Si status invalide (canceled, past_due), rediriger vers pricing
      // MAIS: si stripe_subscription_id existe, c'est qu'un paiement a été fait, on accepte même si status est 'pending'
      if (subscription.status === 'canceled' || 
          subscription.status === 'past_due' ||
          (subscription.status === 'pending' && !subscription.stripe_subscription_id)) {
        return NextResponse.redirect(new URL('/register/pricing-choice', request.url))
      }
      
      // Si trial expiré, rediriger vers pricing
      if (subscription.status === 'trialing' && subscription.trial_ends_at) {
        const trialEnd = new Date(subscription.trial_ends_at)
        if (new Date() > trialEnd) {
          return NextResponse.redirect(new URL('/register/pricing-choice', request.url))
        }
      }
      
      // Si plan_type === 'trial' mais que trial_ends_at est NULL ou expiré, rediriger vers pricing
      if (subscription.plan_type === 'trial') {
        if (!subscription.trial_ends_at) {
          // Si pas de trial_ends_at, vérifier si ça fait plus de 3 jours depuis la création
          // On ne peut pas vérifier created_at ici, donc on accepte pour l'instant
          // Le check sera fait côté dashboard
        } else {
          const trialEnd = new Date(subscription.trial_ends_at)
          if (new Date() > trialEnd) {
            return NextResponse.redirect(new URL('/register/pricing-choice', request.url))
          }
        }
      }
      
    } catch (error) {
      console.error('Middleware error:', error)
      // En cas d'erreur, rediriger vers pricing pour sécurité
      return NextResponse.redirect(new URL('/register/pricing-choice', request.url))
    }
  }
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
