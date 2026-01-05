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
        },
        balance: 0 // Set initial balance to 0
      })
      customerId = customer.id
      
      // Sauvegarder le customer ID
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: 'pending'
      })
    } else {
      // Si le customer existe déjà, vérifier et réinitialiser sa balance si nécessaire
      const customer = await stripe.customers.retrieve(customerId)
      if (customer && !customer.deleted && (customer as any).balance !== 0) {
        // Réinitialiser la balance à 0 pour éviter les crédits appliqués
        await stripe.customers.update(customerId, {
          balance: 0
        })
      }
    }

    // Utiliser le même Price ID pour les deux (49€/mois)
    // La différence sera dans subscription_data.trial_period_days
    const priceId = process.env.STRIPE_PRICE_DIRECT_ID!

    // Si c'est un upgrade, forcer priceType à 'direct' et ne pas mettre de trial
    const finalPriceType = isUpgrade ? 'direct' : priceType

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
      
      // Désactiver les taxes automatiques pour éviter les frais supplémentaires
      automatic_tax: {
        enabled: false
      },
      
      subscription_data: {
        // Si c'est un trial (et pas un upgrade), ajouter la période d'essai de 3 jours
        ...(finalPriceType === 'trial' && !isUpgrade && {
          trial_period_days: 3,
        }),
        // Si c'est un upgrade, ne pas mettre de trial
        metadata: {
          user_id: user.id,
          plan_type: finalPriceType,
          is_upgrade: isUpgrade.toString()
        }
      }
    })
    
    console.log(`[create-checkout-session] Session created: ${session.id}, plan_type: ${finalPriceType}, is_upgrade: ${isUpgrade}`)

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