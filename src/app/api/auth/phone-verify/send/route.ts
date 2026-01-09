import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/admin'
import twilio from 'twilio'
import crypto from 'crypto'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// Fonction pour extraire le code pays et le numéro
function parsePhoneNumber(phone: string) {
  const normalized = phone.replace(/\s/g, '')
  // Extraire le code pays (ex: +33)
  const countryCodeMatch = normalized.match(/^\+(\d{1,3})/)
  const countryCode = countryCodeMatch ? `+${countryCodeMatch[1]}` : '+33'
  const phoneLast4 = normalized.slice(-4)
  
  // Hash du numéro complet pour la sécurité
  const phoneHash = crypto.createHash('sha256').update(normalized).digest('hex')
  
  return { countryCode, phoneLast4, phoneHash, normalized }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { phone } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Numéro requis' }, { status: 400 })
    }

    // Parser le numéro
    const { countryCode, phoneLast4, phoneHash, normalized } = parsePhoneNumber(phone)

    // IMPORTANT: Vérifier si le numéro est déjà lié à un compte AVANT d'envoyer le SMS
    // 1. Vérifier dans profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, phone_number')
      .eq('phone_number', normalized)
      .maybeSingle()

    if (existingProfile) {
      console.log('[phone-verify/send] Numéro déjà utilisé dans profiles:', normalized)
      return NextResponse.json({
        error: 'Ce numéro est déjà lié à un compte. Connecte-toi avec ce numéro ou utilise un autre numéro.',
        alreadyUsed: true
      }, { status: 400 })
    }

    // 2. Vérifier aussi avec le hash dans phone_verifications si déjà vérifié
    const { data: allVerifications } = await supabase
      .from('phone_verifications')
      .select('id, verified, phone_hash, created_at, account_created')
      .eq('phone_hash', phoneHash)
      .order('created_at', { ascending: false })

    // Si un enregistrement est vérifié ET associé à un compte créé, bloquer
    const verifiedWithAccount = allVerifications?.some(v => {
      if (v.verified !== true) return false
      // Si la colonne account_created existe, vérifier qu'elle est true
      if (Object.prototype.hasOwnProperty.call(v, 'account_created')) {
        return v.account_created === true
      }
      // Si la colonne n'existe pas, considérer comme bloqué si verified=true (ancien comportement)
      return true
    })

    if (verifiedWithAccount) {
      console.log('[phone-verify/send] Numéro déjà vérifié et lié à un compte:', phoneHash)
      return NextResponse.json({
        error: 'Ce numéro a déjà été vérifié et est lié à un compte. Connecte-toi ou utilise un autre numéro.',
        alreadyUsed: true
      }, { status: 400 })
    }

    // Si une vérification existe avec verified=true mais account_created=false,
    // permettre de réutiliser si elle n'est pas expirée (moins de 24h)
    const existingVerified = allVerifications?.find(v => 
      v.verified === true && 
      Object.prototype.hasOwnProperty.call(v, 'account_created') && 
      v.account_created === false
    )

    if (existingVerified) {
      const createdAt = new Date(existingVerified.created_at)
      const isExpired = Date.now() - createdAt.getTime() > 24 * 60 * 60 * 1000 // 24h
      
      if (!isExpired) {
        console.log('[phone-verify/send] Vérification existante non expirée, réutilisation possible')
        // Retourner un succès sans envoyer de SMS, le frontend pourra réutiliser cette vérification
        return NextResponse.json({
          success: true,
          phoneLastDigits: phoneLast4,
          reuseExisting: true,
          verificationId: existingVerified.id
        })
      } else {
        console.log('[phone-verify/send] Vérification existante expirée, création d\'une nouvelle')
      }
    }

    // 3. Si toutes les vérifications passent, générer et envoyer le code
    console.log('[phone-verify/send] Numéro valide, génération du code pour:', normalized)
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Envoyer le SMS via Twilio UNIQUEMENT si les vérifications ont passé
    try {
      await twilioClient.messages.create({
        body: `Ton code de vérification Richy.ai : ${code}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: normalized
      })
      console.log('[phone-verify/send] SMS envoyé avec succès')
    } catch (twilioError: any) {
      console.error('[phone-verify/send] Erreur Twilio:', twilioError)
      return NextResponse.json({
        error: 'Erreur lors de l\'envoi du SMS. Vérifie ton numéro.'
      }, { status: 500 })
    }

    // Vérifier s'il existe déjà une entrée pour ce phone_hash
    // Avec la contrainte UNIQUE, on ne peut avoir qu'une seule entrée par phone_hash
    const { data: existingVerification } = await supabase
      .from('phone_verifications')
      .select('id, verified, account_created, attempts')
      .eq('phone_hash', phoneHash)
      .maybeSingle()

    // Préparer les données à insérer/mettre à jour
    const verificationData: any = {
      phone_hash: phoneHash,
      phone_last_4: phoneLast4,
      country_code: countryCode,
      verification_code: code,
      code_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verified: false
    }

    // Réinitialiser les tentatives si la colonne existe
    if (existingVerification && existingVerification.attempts !== undefined) {
      verificationData.attempts = 0
    }

    // Utiliser upsert pour gérer la contrainte UNIQUE
    // Si l'entrée existe, elle sera mise à jour avec le nouveau code
    // Si elle n'existe pas, elle sera créée
    const { error: upsertError } = await supabase
      .from('phone_verifications')
      .upsert(verificationData, {
        onConflict: 'phone_hash',
        ignoreDuplicates: false
      })

    if (upsertError) {
      console.error('[phone-verify/send] Erreur lors de l\'upsert:', upsertError)
      return NextResponse.json({
        error: 'Erreur lors de l\'enregistrement du code'
      }, { status: 500 })
    }

    if (existingVerification) {
      console.log('[phone-verify/send] Code mis à jour dans l\'entrée existante:', existingVerification.id)
    } else {
      console.log('[phone-verify/send] Nouvelle entrée créée avec succès')
    }

    // Retourner les 4 derniers chiffres pour affichage
    return NextResponse.json({
      success: true,
      phoneLastDigits: phoneLast4
    })

  } catch (error: any) {
    console.error('Phone verification send error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

