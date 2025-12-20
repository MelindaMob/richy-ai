import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  // Déconnexion de l'utilisateur
  await supabase.auth.signOut()
  
  // Redirection vers la page d'accueil
  return NextResponse.redirect(new URL('/', req.url))
}

