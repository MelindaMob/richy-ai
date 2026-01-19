import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@/lib/supabase/admin'

// Domaines email autorisés
const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'hotmail.fr', 'outlook.fr',
  'yahoo.com', 'yahoo.fr', 'ymail.com',
  'orange.fr', 'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'bbox.fr',
  'laposte.net', 'numericable.fr', 'club-internet.fr',
  'protonmail.com', 'proton.me',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com', 'gmx.fr',
]

// Domaines email temporaires/suspects à bloquer
const BLOCKED_EMAIL_DOMAINS = [
  '10minutemail.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'mailinator.com', 'temp-mail.org', 'getnada.com', 'mohmal.com',
  'fakeinbox.com', 'trashmail.com', 'sharklasers.com', 'grr.la',
  'guerrillamailblock.com', 'pokemail.net', 'spam4.me', 'bccto.me',
  'chitthi.in', 'dispostable.com', 'meltmail.com', 'mintemail.com',
  'mytemp.email', 'tempail.com', 'tempr.email', 'tmpmail.org',
  'yopmail.com', 'yopmail.fr', 'jetable.org', 'jetable.fr',
]

// Validation du domaine email
function validateEmailDomain(email: string): { valid: boolean; error: string | null } {
  if (!email || !email.includes('@')) {
    return { valid: false, error: 'Format email invalide' }
  }

  const domain = email.split('@')[1]?.toLowerCase().trim()
  
  if (!domain) {
    return { valid: false, error: 'Format email invalide' }
  }

  // Vérifier les domaines bloqués (emails temporaires)
  if (BLOCKED_EMAIL_DOMAINS.some(blocked => domain === blocked || domain.endsWith('.' + blocked))) {
    return { 
      valid: false, 
      error: 'Les emails temporaires ne sont pas autorisés. Utilisez une adresse email valide (Gmail, Outlook, Yahoo, Orange, etc.)' 
    }
  }

  // Vérifier les domaines autorisés
  const isAllowed = ALLOWED_EMAIL_DOMAINS.some(allowed => domain === allowed || domain.endsWith('.' + allowed))
  
  if (!isAllowed) {
    return { 
      valid: false, 
      error: 'Domaine email non autorisé. Utilisez une adresse email valide (Gmail, Outlook, Yahoo, Orange, Free, SFR, etc.)' 
    }
  }

  return { valid: true, error: null }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Valider le domaine email avant toute autre vérification
    const emailDomainValidation = validateEmailDomain(normalizedEmail)
    if (!emailDomainValidation.valid) {
      return NextResponse.json({
        error: emailDomainValidation.error,
        alreadyUsed: false
      }, { status: 400 })
    }

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

