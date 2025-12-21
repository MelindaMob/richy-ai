// app/api/auth/phone-verify/send/route.ts

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// Fonction pour nettoyer le numéro
function cleanPhoneNumber(phone: string): string {
  // Enlever tous les espaces, tirets, parenthèses
  return phone.replace(/[\s\-\(\)]/g, '')
}

// Fonction pour valider le format
function isValidPhone(phone: string): boolean {
  // Format international : +33612345678
  const phoneRegex = /^\+[1-9]\d{1,14}$/
  return phoneRegex.test(phone)
}

export async function POST(req: NextRequest) {
  try {
    const { phone, email } = await req.json()
    
    // Nettoyer et valider le numéro
    const cleanPhone = cleanPhoneNumber(phone)
    
    if (!isValidPhone(cleanPhone)) {
      return NextResponse.json({ 
        error: 'Numéro invalide. Format: +33612345678' 
      }, { status: 400 })
    }

    const supabase = await createClient()

    // Hasher le numéro pour le stocker (RGPD)
    const phoneHash = await bcrypt.hash(cleanPhone, 10)
    
    // Vérifier si ce numéro a déjà été utilisé
    const { data: existingPhone } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone_hash', phoneHash)
      .single()

    if (existingPhone && existingPhone.verified) {
      // Ce numéro a déjà eu son trial gratuit !
      return NextResponse.json({ 
        error: 'Ce numéro a déjà été utilisé pour un essai gratuit. Utilise un autre numéro ou passe directement au plan payant ! 😉',
        alreadyUsed: true 
      }, { status: 400 })
    }

    // Vérifier les tentatives (anti-spam)
    if (existingPhone && existingPhone.attempts >= 3) {
      const timeSinceLastAttempt = Date.now() - new Date(existingPhone.created_at).getTime()
      const oneHour = 60 * 60 * 1000
      
      if (timeSinceLastAttempt < oneHour) {
        return NextResponse.json({ 
          error: 'Trop de tentatives. Réessaye dans 1 heure.' 
        }, { status: 429 })
      }
    }

    // Générer un code à 6 chiffres
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    // Envoyer le SMS avec Twilio
    try {
      await twilioClient.messages.create({
        body: `🚀 Richy.ai - Ton code de vérification : ${verificationCode}\n\nValable 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: cleanPhone
      })
    } catch (twilioError: any) {
      console.error('Twilio error:', twilioError)
      
      // Si c'est un numéro invalide
      if (twilioError.code === 21211) {
        return NextResponse.json({ 
          error: 'Numéro invalide ou non reconnu' 
        }, { status: 400 })
      }
      
      throw twilioError
    }

    // Sauvegarder le code en base
    const codeExpiresAt = new Date()
    codeExpiresAt.setMinutes(codeExpiresAt.getMinutes() + 10) // Expire dans 10 min

    if (existingPhone) {
      // Update existing
      await supabase
        .from('phone_verifications')
        .update({
          verification_code: verificationCode,
          code_expires_at: codeExpiresAt.toISOString(),
          attempts: existingPhone.attempts + 1
        })
        .eq('phone_hash', phoneHash)
    } else {
      // Create new
      await supabase
        .from('phone_verifications')
        .insert({
          phone_hash: phoneHash,
          phone_last_4: cleanPhone.slice(-4), // Garder les 4 derniers pour display
          country_code: cleanPhone.slice(0, 3), // +33, +1, etc
          verification_code: verificationCode,
          code_expires_at: codeExpiresAt.toISOString(),
          attempts: 1
        })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Code envoyé ! Check tes SMS 📱',
      phoneLastDigits: cleanPhone.slice(-4) // Pour afficher ****5678
    })

  } catch (error: any) {
    console.error('Phone verification error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi du SMS' },
      { status: 500 }
    )
  }
}

