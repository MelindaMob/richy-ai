import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Vérifier si l'email existe déjà dans profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile) {
      console.log('[check-email] Email déjà utilisé dans profiles:', normalizedEmail)
      return NextResponse.json({
        error: 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.',
        alreadyUsed: true
      }, { status: 400 })
    }

    // Vérifier aussi dans auth.users en essayant de créer un compte temporaire
    // (Supabase retournera une erreur si l'email existe)
    // Mais on ne peut pas directement vérifier auth.users sans admin, donc on se base sur profiles
    // Si l'email n'est pas dans profiles mais existe dans auth, ça sera détecté lors de la création du compte

    return NextResponse.json({
      available: true
    })

  } catch (error: any) {
    console.error('Check email error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

