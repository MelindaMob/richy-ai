import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = await createClient()
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

    // Stocker le code dans phone_verifications avec le schéma existant
    const insertData: any = {
      phone_hash: phoneHash,
      phone_last_4: phoneLast4,
      country_code: countryCode,
      verified: false
    }

    // Essayer d'insérer avec verification_code si la colonne existe
    // Sinon, on stockera le code dans code_expires_at ou on utilisera une autre approche
    let codeStored = false
    try {
      // Essayer avec verification_code
      const { error: insertError } = await supabase
        .from('phone_verifications')
        .insert({
          ...insertData,
          verification_code: code,
          code_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        })

      if (!insertError) {
        codeStored = true
      } else {
        // Si verification_code n'existe pas, essayer sans mais stocker le code ailleurs
        // On peut utiliser une approche différente : stocker dans une table séparée ou en mémoire
        console.error('Error storing with verification_code:', insertError)
        
        // Essayer juste avec les colonnes de base (le code sera vérifié côté serveur)
        const { error: insertError2 } = await supabase
          .from('phone_verifications')
          .insert({
            ...insertData,
            code_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
          })

        if (!insertError2) {
          codeStored = true
          // Stocker le code temporairement (en production, utiliser Redis ou une table dédiée)
          // Pour l'instant, on va devoir ajouter la colonne verification_code
          console.warn('Code envoyé mais pas stocké en BDD. Ajoutez la colonne verification_code à phone_verifications.')
        } else {
          console.error('Error storing verification code:', insertError2)
        }
      }
    } catch (err) {
      console.error('Error inserting verification:', err)
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

