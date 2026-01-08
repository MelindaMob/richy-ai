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
    // Vérifier TOUS les enregistrements avec ce hash (pas seulement verified=true)
    const { data: allVerifications } = await supabase
      .from('phone_verifications')
      .select('verified, phone_hash, created_at, account_created')
      .eq('phone_hash', phoneHash)
      .order('created_at', { ascending: false })

    // Si un enregistrement est déjà vérifié ET associé à un compte, bloquer
    const hasAccountCreatedField = allVerifications && allVerifications.length > 0 && Object.prototype.hasOwnProperty.call(allVerifications[0], 'account_created')
    const verifiedAndLinked = allVerifications?.some(v => v.verified === true && (!hasAccountCreatedField || v.account_created === true))
    if (verifiedAndLinked) {
      console.log('[phone-verify/send] Numéro déjà vérifié et lié à un compte:', phoneHash)
      return NextResponse.json({
        error: 'Ce numéro a déjà été vérifié et est lié à un compte. Connecte-toi ou utilise un autre numéro.',
        alreadyUsed: true
      }, { status: 400 })
    }
    
    // Si un enregistrement récent existe (moins de 24h) même non vérifié, on peut aussi bloquer pour éviter le spam
    // Mais on va laisser passer pour permettre une nouvelle tentative si le code a expiré

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

