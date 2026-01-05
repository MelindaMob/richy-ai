// app/api/stripe/create-checkout-session/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover'
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { 
      priceType, // 'trial' ou 'direct'
      isUpgrade = false // Si c'est un upgrade depuis trial
    } = await req.json()

    // Check si déjà abonné
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Si upgrade, annuler l'ancien
    if (isUpgrade && existingSub?.stripe_subscription_id) {
      await stripe.subscriptions.cancel(existingSub.stripe_subscription_id, {
        prorate: false,
        invoice_now: false
      })
    }

    // Créer ou récupérer le customer
    let customerId = existingSub?.stripe_customer_id
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          user_id: user.id
        }
      })
      customerId = customer.id
      
      // Sauvegarder le customer ID
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: 'pending'
      })
    }

    // Sélectionner le prix
    const priceId = priceType === 'trial' 
      ? process.env.STRIPE_PRICE_TRIAL_ID!
      : process.env.STRIPE_PRICE_DIRECT_ID!

    // Créer la session (pour embedded checkout)
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded', // IMPORTANT pour embedded
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_type: priceType,
          is_upgrade: isUpgrade.toString()
        }
      }
    })

    return NextResponse.json({
      clientSecret: session.client_secret
    })

  } catch (error: any) {
    console.error('Create checkout error:', error)
    return NextResponse.json(
      { error: 'Erreur création checkout' },
      { status: 500 }
    )
  }
}