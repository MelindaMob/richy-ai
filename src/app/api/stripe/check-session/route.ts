// app/api/stripe/check-session/route.ts

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover'
})

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id requis' }, { status: 400 })
    }

    // Récupérer la session Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    })

    // Vérifier s'il y a un registration_token (indique une nouvelle inscription)
    const registrationToken = session.metadata?.registration_token || 
                             (typeof session.subscription === 'object' && session.subscription?.metadata?.registration_token) ||
                             null

    return NextResponse.json({ 
      hasRegistrationToken: !!registrationToken,
      isUpgrade: session.subscription && typeof session.subscription === 'object' && session.subscription.metadata?.is_upgrade === 'true'
    })

  } catch (error: any) {
    console.error('[check-session] Erreur:', error)
    return NextResponse.json({ 
      error: 'Erreur lors de la vérification de la session',
      details: error.message
    }, { status: 500 })
  }
}

