// app/api/auth/auto-login/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }

    const supabase = createClient()

    // Créer une session pour l'utilisateur
    // On utilise l'admin client pour créer une session directement
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase().trim()
    })

    if (sessionError || !sessionData) {
      console.error('[auto-login] Erreur génération lien:', sessionError)
      return NextResponse.json({ 
        error: 'Impossible de créer la session',
        details: sessionError?.message 
      }, { status: 500 })
    }

    // Extraire le token du lien magique
    const magicLink = sessionData.properties?.action_link
    if (!magicLink) {
      return NextResponse.json({ 
        error: 'Lien magique non généré' 
      }, { status: 500 })
    }

    // Retourner le lien magique pour que le client puisse l'utiliser
    return NextResponse.json({ 
      success: true,
      magicLink
    })

  } catch (error: any) {
    console.error('[auto-login] Erreur:', error)
    return NextResponse.json({ 
      error: 'Erreur lors de la connexion automatique',
      details: error.message
    }, { status: 500 })
  }
}

