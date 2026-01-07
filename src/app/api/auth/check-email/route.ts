import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    console.log('[check-email] Vérification de l\'email:', normalizedEmail)

    // 1. Vérifier si l'email existe déjà dans profiles
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (profileError) {
      console.error('[check-email] Erreur lors de la vérification dans profiles:', profileError)
    }

    if (existingProfile) {
      console.log('[check-email] Email déjà utilisé dans profiles:', normalizedEmail)
      return NextResponse.json({
        error: 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.',
        alreadyUsed: true
      }, { status: 400 })
    }

    // 2. Vérifier aussi dans auth.users avec le client admin
    // Note: listUsers() peut être lent avec beaucoup d'utilisateurs, mais c'est la seule façon de vérifier
    try {
      console.log('[check-email] Recherche dans auth.users...')
      const { data: { users }, error: authError } = await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Limiter à 1000 pour éviter les problèmes de performance
      })
      
      if (authError) {
        console.error('[check-email] Erreur lors de la vérification dans auth.users:', authError)
        // Si erreur, on continue quand même (la vérification dans profiles devrait suffire)
      } else {
        console.log('[check-email] Nombre d\'utilisateurs dans auth.users:', users?.length || 0)
        const emailExists = users?.some(u => u.email?.toLowerCase().trim() === normalizedEmail)
        if (emailExists) {
          console.log('[check-email] Email déjà utilisé dans auth.users:', normalizedEmail)
          return NextResponse.json({
            error: 'Cet email est déjà enregistré. Connecte-toi ou utilise un autre email.',
            alreadyUsed: true
          }, { status: 400 })
        }
        console.log('[check-email] Email non trouvé dans auth.users')
      }
    } catch (adminError: any) {
      console.error('[check-email] Erreur client admin:', adminError)
      // Si le client admin échoue, continuer quand même (la vérification dans profiles devrait suffire)
    }

    console.log('[check-email] Email disponible:', normalizedEmail)
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

