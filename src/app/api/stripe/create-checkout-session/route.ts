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
    
    const { 
      priceType, // 'trial' ou 'direct'
      isUpgrade = false, // Si c'est un upgrade depuis trial
      pendingRegistration // Infos d'inscription si le compte n'existe pas encore
    } = await req.json()

    let user
    
    // Si pendingRegistration existe, créer le compte Supabase d'abord
    if (pendingRegistration) {
      console.log('[create-checkout-session] Création du compte Supabase avant checkout')
      console.log('[create-checkout-session] Email:', pendingRegistration.email)
      console.log('[create-checkout-session] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL)
      
      // Vérifier que NEXT_PUBLIC_APP_URL est défini
      if (!process.env.NEXT_PUBLIC_APP_URL) {
        console.error('[create-checkout-session] NEXT_PUBLIC_APP_URL non défini')
        return NextResponse.json({ 
          error: 'Configuration serveur manquante. Veuillez contacter le support.' 
        }, { status: 500 })
      }
      
      // Vérifier si l'email existe déjà dans profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', pendingRegistration.email.toLowerCase())
        .maybeSingle()
      
      if (existingProfile) {
        console.log('[create-checkout-session] Email déjà utilisé dans profiles:', pendingRegistration.email)
        return NextResponse.json({ 
          error: 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.',
          emailAlreadyUsed: true
        }, { status: 400 })
      }
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: pendingRegistration.email,
        password: pendingRegistration.password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment-success`,
          data: {
            full_name: pendingRegistration.full_name,
            company_name: pendingRegistration.company_name
          }
        }
      })

      if (signUpError) {
        console.error('[create-checkout-session] Erreur création compte:', signUpError)
        
        // Si l'utilisateur existe déjà, retourner une erreur claire
        if (signUpError.message?.includes('already registered') || 
            signUpError.message?.includes('User already registered') ||
            signUpError.message?.includes('already exists')) {
          console.log('[create-checkout-session] Email déjà enregistré:', pendingRegistration.email)
          return NextResponse.json({ 
            error: 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.',
            emailAlreadyUsed: true
          }, { status: 400 })
        }
        
        // Retourner le message d'erreur exact de Supabase
        return NextResponse.json({ 
          error: signUpError.message || 'Erreur lors de la création du compte. Veuillez réessayer.' 
        }, { status: 400 })
      } else {
        if (!signUpData.user) {
          return NextResponse.json({ 
            error: 'Impossible de créer le compte. Veuillez réessayer.' 
          }, { status: 400 })
        }

        user = signUpData.user
        console.log('[create-checkout-session] Compte créé avec succès:', user.id)
      }

      // Mettre à jour le profil avec les infos supplémentaires
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: pendingRegistration.full_name,
          company_name: pendingRegistration.company_name,
          phone_number: pendingRegistration.phone_number
        })
        .eq('id', user.id)

      if (profileError) {
        console.error('[create-checkout-session] Erreur mise à jour profil:', profileError)
        // Ne pas bloquer le processus si la mise à jour du profil échoue
      }
      
      // Note: Le sessionStorage sera nettoyé côté client après le checkout réussi
      // On retourne un flag pour indiquer que le compte vient d'être créé
    } else {
      // Auth check pour utilisateur existant
      const { data: { user: existingUser } } = await supabase.auth.getUser()
      if (!existingUser) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
      user = existingUser
    }

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

    // Créer ou récupérer le customer Stripe
    // IMPORTANT: Le customer Stripe sera créé ici, pas avant
    let customerId = existingSub?.stripe_customer_id
    let customerExists = false
    
    if (!customerId) {
      // Pas de customer ID en base, créer un nouveau customer Stripe
      // C'est ici que le client Stripe est créé, en même temps que le checkout
      console.log('[create-checkout-session] Création du client Stripe pour user:', user.id)
      
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          user_id: user.id
        },
        balance: 0
      })
      customerId = customer.id
      customerExists = true
      
      console.log('[create-checkout-session] Client Stripe créé:', customerId)
      
      // Sauvegarder le customer ID (mais pas de subscription encore, elle sera créée par le webhook)
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: 'pending'
      }, {
        onConflict: 'user_id'
      })
    } else {
      // Vérifier si le customer existe réellement dans Stripe
      try {
        const customer = await stripe.customers.retrieve(customerId)
        
        // Vérifier si le customer n'a pas été supprimé
        if (customer.deleted) {
          throw new Error('Customer deleted')
        }
        
        customerExists = true
        
        // Réinitialiser la balance à 0 si nécessaire
        if ((customer as any).balance !== 0) {
          await stripe.customers.update(customerId, {
            balance: 0
          })
        }
      } catch (error: any) {
        // Si le customer n'existe pas dans Stripe (404 ou deleted), créer un nouveau
        console.log(`[create-checkout-session] Customer ${customerId} not found in Stripe, creating new one`)
        
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            user_id: user.id
          },
          balance: 0
        })
        customerId = customer.id
        customerExists = true
        
        // Mettre à jour la base de données avec le nouveau customer ID
        await supabase.from('subscriptions').upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: existingSub?.status || 'pending'
        })
      }
    }

    // Utiliser le même Price ID pour les deux (49€/mois)
    // La différence sera dans subscription_data.trial_period_days
    const priceId = process.env.STRIPE_PRICE_DIRECT_ID

    if (!priceId) {
      console.error('[create-checkout-session] STRIPE_PRICE_DIRECT_ID non défini')
      return NextResponse.json({ 
        error: 'Configuration Stripe manquante. Veuillez contacter le support.' 
      }, { status: 500 })
    }

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