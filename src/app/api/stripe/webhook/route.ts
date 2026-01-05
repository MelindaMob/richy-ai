// app/api/stripe/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/admin' // Admin client

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover'
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook error:', err.message)
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
  }

  const supabase = createClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      
      // Récupérer la subscription
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      )
      
      const userId = subscription.metadata.user_id
      const planType = subscription.metadata.plan_type
      
      // Déterminer les limitations si trial
      const limitations = planType === 'trial' ? {
        chat_messages: 5,
        validator_uses: 1,
        prompt_uses: 0,
        builder_uses: 0
      } : null
      
      // Mettre à jour la DB
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0].price.id,
        status: subscription.status,
        plan_type: planType,
        trial_limitations: limitations,
        trial_ends_at: subscription.trial_end 
          ? new Date(subscription.trial_end * 1000).toISOString() 
          : null,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
      })
      
      console.log(`✅ Subscription ${planType} created for user ${userId}`)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      
      await supabase.from('subscriptions')
        .update({
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
        })
        .eq('stripe_subscription_id', subscription.id)
      
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      
      await supabase.from('subscriptions')
        .update({ 
          status: 'canceled',
          trial_limitations: null
        })
        .eq('stripe_subscription_id', subscription.id)
      
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      
      // Si c'est après un trial, enlever les limitations
      if (invoice.billing_reason === 'subscription_cycle') {
        await supabase.from('subscriptions')
          .update({ 
            trial_limitations: null,
            status: 'active'
          })
          .eq('stripe_customer_id', invoice.customer)
      }
      
      // Logger le paiement
      await supabase.from('payments').insert({
        user_id: invoice.metadata?.user_id,
        stripe_payment_intent_id: invoice.payment_intent as string,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        status: 'succeeded'
      })
      
      break
    }
  }

  return NextResponse.json({ received: true })
}