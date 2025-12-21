// app/api/auth/phone-verify/confirm/route.ts

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { phone, code, userId } = await req.json()
    
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
    const supabase = await createClient()
    
    // Hasher le numéro pour comparer
    const phoneHash = await bcrypt.hash(cleanPhone, 10)
    
    // Récupérer la vérification
    const { data: verification } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone_hash', phoneHash)
      .single()

    if (!verification) {
      return NextResponse.json({ 
        error: 'Aucun code envoyé pour ce numéro' 
      }, { status: 400 })
    }

    // Vérifier l'expiration
    if (new Date() > new Date(verification.code_expires_at)) {
      return NextResponse.json({ 
        error: 'Code expiré. Demande un nouveau code.' 
      }, { status: 400 })
    }

    // Vérifier le code
    if (verification.verification_code !== code) {
      return NextResponse.json({ 
        error: 'Code incorrect. Vérifie ton SMS.' 
      }, { status: 400 })
    }

    // Marquer comme vérifié
    await supabase
      .from('phone_verifications')
      .update({ verified: true })
      .eq('id', verification.id)

    // Mettre à jour le profil utilisateur
    if (userId) {
      await supabase
        .from('profiles')
        .update({ 
          phone_verified: true,
          phone_hash: phoneHash
        })
        .eq('id', userId)
    }

    return NextResponse.json({ 
      success: true,
      message: 'Numéro vérifié ! Tu peux profiter de ton essai gratuit 🎉' 
    })

  } catch (error: any) {
    console.error('Code verification error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification' },
      { status: 500 }
    )
  }
}

