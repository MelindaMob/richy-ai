import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  // Déconnexion de l'utilisateur
  await supabase.auth.signOut()
  
  // Retourner un JSON au lieu d'une redirection (évite l'erreur 405 en production)
  return NextResponse.json({ success: true, redirect: '/' })
}

