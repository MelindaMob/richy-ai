// app/auth/callback/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const token = requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')
  const redirectTo = requestUrl.searchParams.get('redirect_to') || '/dashboard'

  if ((tokenHash || token) && type) {
    const supabase = await createClient()
    
    try {
      // Pour les liens magiques, utiliser verifyOtp avec le token_hash
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as any
        })

        if (error) {
          console.error('[auth/callback] Erreur vérification token_hash:', error)
          return NextResponse.redirect(new URL('/login?error=invalid_token', req.url))
        }
      } else if (token) {
        // Alternative: utiliser exchangeCodeForSession si c'est un code
        const { error } = await supabase.auth.exchangeCodeForSession(token)
        
        if (error) {
          console.error('[auth/callback] Erreur exchange code:', error)
          return NextResponse.redirect(new URL('/login?error=invalid_token', req.url))
        }
      }

      // Vérifier que l'utilisateur est bien connecté
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('[auth/callback] Utilisateur non connecté après vérification')
        return NextResponse.redirect(new URL('/login?error=session_failed', req.url))
      }

      console.log('[auth/callback] ✅ Utilisateur connecté:', user.id)
      
      // Vérifier si une subscription existe pour cet utilisateur
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      
      console.log('[auth/callback] 🔴 Subscription après connexion:', subscription ? {
        plan_type: subscription.plan_type,
        status: subscription.status
      } : 'AUCUNE SUBSCRIPTION TROUVÉE')
      
      // Rediriger vers la destination souhaitée
      return NextResponse.redirect(new URL(redirectTo, req.url))
    } catch (error: any) {
      console.error('[auth/callback] Erreur:', error)
      return NextResponse.redirect(new URL('/login?error=callback_error', req.url))
    }
  }

  // Si pas de token, rediriger vers login
  return NextResponse.redirect(new URL('/login', req.url))
}
