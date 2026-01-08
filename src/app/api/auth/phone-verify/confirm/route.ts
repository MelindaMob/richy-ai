import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

function parsePhoneNumber(phone: string) {
  const normalized = phone.replace(/\s/g, '')
  const phoneHash = crypto.createHash('sha256').update(normalized).digest('hex')
  return { phoneHash, normalized }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { phone, code } = await req.json()

    if (!phone || !code) {
      return NextResponse.json({ error: 'Numéro et code requis' }, { status: 400 })
    }

    // Parser le numéro
    const { phoneHash, normalized } = parsePhoneNumber(phone)

    // D'ABORD vérifier si le numéro est déjà lié à un compte
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, phone_number')
      .eq('phone_number', normalized)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({
        error: 'Ce numéro est déjà lié à un compte. Connecte-toi avec ce numéro ou utilise un autre numéro.',
        alreadyUsed: true
      }, { status: 400 })
    }

    // Vérifier le code dans la table phone_verifications
    // Avec la contrainte UNIQUE sur phone_hash, il ne peut y avoir qu'une seule entrée
    console.log('[phone-verify/confirm] Recherche vérification pour phone_hash:', phoneHash, 'code:', code)
    
    const { data: verification, error: verifyError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone_hash', phoneHash)
      .eq('verification_code', code)
      .eq('verified', false)
      .maybeSingle()

    if (verifyError) {
      console.error('[phone-verify/confirm] Erreur lors de la recherche:', verifyError)
      return NextResponse.json({
        error: 'Erreur lors de la vérification du code'
      }, { status: 500 })
    }

    if (!verification) {
      console.log('[phone-verify/confirm] Aucune vérification trouvée avec ce code')
      
      // Vérifier si le numéro a déjà été vérifié
      const { data: alreadyVerified } = await supabase
        .from('phone_verifications')
        .select('verified')
        .eq('phone_hash', phoneHash)
        .eq('verified', true)
        .maybeSingle()
      
      if (alreadyVerified) {
        return NextResponse.json({
          error: 'Ce numéro a déjà été vérifié. Connecte-toi ou utilise un autre numéro.',
          alreadyUsed: true
        }, { status: 400 })
      }
      
      return NextResponse.json({
        error: 'Code invalide'
      }, { status: 400 })
    }

    console.log('[phone-verify/confirm] Vérification trouvée:', verification.id)

    // Vérifier l'expiration
    if (verification.code_expires_at) {
      const expiresAt = new Date(verification.code_expires_at)
      if (new Date() > expiresAt) {
        console.log('[phone-verify/confirm] Code expiré:', verification.code_expires_at)
        return NextResponse.json({
          error: 'Code expiré'
        }, { status: 400 })
      }
    } else if (verification.created_at) {
      // Vérifier que le code a été créé il y a moins de 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      const createdAt = new Date(verification.created_at)
      if (createdAt < tenMinutesAgo) {
        console.log('[phone-verify/confirm] Code expiré (créé il y a plus de 10 min):', verification.created_at)
        return NextResponse.json({
          error: 'Code expiré'
        }, { status: 400 })
      }
    }

    // Vérifier les tentatives si la colonne existe
    if (verification.max_attempts && verification.attempts !== undefined) {
      if (verification.attempts >= verification.max_attempts) {
        console.log('[phone-verify/confirm] Trop de tentatives:', verification.attempts, '/', verification.max_attempts)
        return NextResponse.json({
          error: 'Trop de tentatives. Demande un nouveau code.'
        }, { status: 400 })
      }
    }

    // Marquer comme vérifié
    // Mettre à jour verified à true et incrémenter attempts si la colonne existe
    const updateData: any = { verified: true }
    if (verification.attempts !== undefined) {
      updateData.attempts = (verification.attempts || 0) + 1
    }
    // Associer explicitement le flag account_created à false si la colonne existe
    if (Object.prototype.hasOwnProperty.call(verification, 'account_created')) {
      updateData.account_created = false
    }
    
    const { error: updateError } = await supabase
      .from('phone_verifications')
      .update(updateData)
      .eq('id', verification.id)

    if (updateError) {
      console.error('[phone-verify/confirm] Erreur mise à jour verified:', updateError)
      console.error('[phone-verify/confirm] Détails erreur:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      })
      return NextResponse.json({
        error: 'Erreur lors de la validation'
      }, { status: 500 })
    }
    
    console.log('[phone-verify/confirm] Vérification mise à jour avec succès')

    console.log('[phone-verify/confirm] Numéro vérifié avec succès:', normalized)

    return NextResponse.json({
      success: true,
      verified: true,
      verificationId: verification.id,
      phone: normalized
    })

  } catch (error: any) {
    console.error('Phone verification confirm error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

