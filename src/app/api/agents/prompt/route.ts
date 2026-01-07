import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const PROMPT_SYSTEM = `Tu es l'agent Prompt de Richy.ai. Tu transformes les idées en prompts professionnels adaptés au contexte spécifique.

STRUCTURE DU PROMPT:
1. CONTEXTE ET RÔLE (adapté au projet)
2. OBJECTIF PRINCIPAL (complété si nécessaire)
3. CIBLE (enrichie avec besoins spécifiques)
4. CONTRAINTES TECHNIQUES (essentielles)
5. FONCTIONNALITÉS (adaptées au contexte)
6. FORMAT DE SORTIE
7. ÉTAPES DE RAISONNEMENT
8. EXEMPLES CONCRETS (adaptés au contexte)

RÈGLES:
- Analyse le contexte réel (titre, description, cible, features) et adapte TOUT le prompt
- Complète l'objectif si vague, enrichis la cible si générale
- Génère des fonctionnalités et exemples SPÉCIFIQUES au contexte (pas génériques)
- Le prompt doit être concis mais complet (300-400 mots max)
- Chaque section doit être adaptée au projet réel

Retourne un JSON avec: title, prompt (adapté et concis), usage_instructions, compatible_with`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier les limites d'usage
    const { checkUsageLimits } = await import('@/lib/check-limits')
    const limitCheck = await checkUsageLimits(user.id, 'prompt')
    
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: limitCheck.message,
        reason: limitCheck.reason,
        showUpgrade: true
      }, { status: 403 })
    }

    const { title, description, target_audience, features } = await req.json()

    if (!title || !description || !target_audience) {
      return NextResponse.json({ error: 'Informations manquantes' }, { status: 400 })
    }

    // Utiliser Gemini pour analyser et générer un prompt personnalisé adapté au contexte réel
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('fake')) {
      try {
        // Analyser le contexte avec Gemini pour générer un prompt adapté
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        
        const analysisModel = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          }
        })
        
        const analysisPrompt = `Analyse ce projet SaaS et génère un prompt professionnel CONCIS (300-400 mots max) et ADAPTÉ au contexte spécifique réel.

TITRE: ${title}
DESCRIPTION: ${description}
CIBLE: ${target_audience}
FEATURES: ${features || 'Non spécifiées'}

INSTRUCTIONS CRITIQUES:
1. Analyse le contexte RÉEL (pas de catégories génériques comme "métier", "gestion", etc.)
2. Complète l'objectif si vague, enrichis la cible si générale - mais adapte au contexte réel
3. Génère des fonctionnalités et exemples SPÉCIFIQUES au projet réel (pas génériques)
4. Adapte TOUT le prompt au contexte réel décrit
5. Sois CONCIS mais complet (300-400 mots max)
6. Pas d'orientation "métier" - analyse ce qui est vraiment décrit

Retourne UNIQUEMENT un JSON:
{
  "title": "Titre du prompt",
  "prompt": "Prompt complet adapté et concis (300-400 mots max) avec sections: CONTEXTE ET RÔLE, OBJECTIF PRINCIPAL, CIBLE, CONTRAINTES TECHNIQUES, FONCTIONNALITÉS, FORMAT DE SORTIE, ÉTAPES DE RAISONNEMENT, EXEMPLES CONCRETS",
  "usage_instructions": "Instructions d'utilisation",
  "compatible_with": ["GPT-4", "Claude 3", "Gemini Pro"]
}

IMPORTANT: Le prompt doit être adapté au contexte réel décrit, pas générique.`

        const analysisResult = await analysisModel.generateContent(analysisPrompt)
        const analysisText = analysisResult.response.text().trim()
        
        let promptData: any = {}
        try {
          let cleanedText = analysisText.trim()
          const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            cleanedText = jsonMatch[0]
          }
          if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
          } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/i, '').replace(/\s*```$/g, '').trim()
          }
          promptData = JSON.parse(cleanedText)
        } catch (parseError) {
          console.error('Erreur parsing prompt Gemini:', parseError)
          promptData = null
        }

        if (promptData && promptData.prompt) {
          // Sauvegarder dans Supabase
          await supabase.from('conversations').insert({
            user_id: user.id,
            agent_type: 'prompt',
            title: promptData.title || `Prompt pour ${title}`,
            input_data: { title, description, target_audience, features },
            output_data: promptData,
            tokens_used: analysisResult.response.usageMetadata?.totalTokenCount || 0,
          })

          return NextResponse.json({ 
            success: true, 
            result: promptData,
            demo: false 
          })
        }
      } catch (geminiError) {
        console.error('Erreur Gemini pour prompt:', geminiError)
        // Fallback vers prompt simple si Gemini échoue
      }

      // Fallback: prompt simple et adaptatif (sans catégories métier)
      const enrichedObjective = description.length < 50 
        ? `${description}\n\nOBJECTIF COMPLÉTÉ:\n- Automatiser et optimiser les processus pour ${target_audience}\n- Centraliser les données et améliorer la visibilité\n- Faciliter la collaboration et la communication`
        : description

      const enrichedTarget = target_audience.length < 20
        ? `${target_audience}\n\nBESOINS SPÉCIFIQUES:\n- Interface intuitive adaptée à leur contexte d'usage\n- Automatisation des tâches répétitives\n- Suivi en temps réel des activités\n- Reporting et analytics pertinents`
        : target_audience

      const baseFeatures = features || '- Dashboard personnalisé\n- API REST complète\n- Authentication sécurisée\n- Analytics intégrés'
      
      const simplePrompt = `# CONTEXTE ET RÔLE

Tu es un expert en développement SaaS spécialisé dans ${title}. Crée un système complet et production-ready.

# OBJECTIF PRINCIPAL

${enrichedObjective}

# CIBLE

${enrichedTarget}

# CONTRAINTES TECHNIQUES

- Architecture scalable (React/Next.js frontend, Node.js/Python backend, PostgreSQL)
- API REST avec documentation OpenAPI
- Authentication JWT sécurisée
- Performance optimisée (< 2s chargement, < 200ms API)
- Sécurité renforcée (validation, chiffrement, logs audit)

# FONCTIONNALITÉS

${baseFeatures}

# FORMAT DE SORTIE

1. Architecture complète
2. Schéma de base de données
3. Endpoints API détaillés
4. Plan d'implémentation (MVP → v1 → v2)
5. Code des fonctions principales

# ÉTAPES DE RAISONNEMENT

1. Analyser les besoins de ${target_audience}
2. Concevoir l'architecture adaptée
3. Modéliser les données
4. Designer l'API
5. Planifier le développement
6. Implémenter le code

Commence par l'architecture complète, puis détaille chaque composant.`

      const demoResult = {
        title: `Prompt professionnel pour ${title}`,
        prompt: simplePrompt,
        usage_instructions: `1. Copie ce prompt dans ChatGPT, Claude ou Gemini
2. L'IA va générer l'architecture complète de ton SaaS
3. Demande ensuite le code spécifique pour chaque partie
4. Utilise les réponses pour construire ton MVP rapidement`,
        compatible_with: ['GPT-4', 'Claude 3', 'Gemini Pro', 'GPT-3.5']
      }

      await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'prompt',
        title: `Prompt pour ${title}`,
        input_data: { title, description, target_audience, features },
        output_data: demoResult,
        tokens_used: 0,
      })

      return NextResponse.json({ 
        success: true, 
        result: demoResult,
        demo: true 
      })
    }

    // Appel réel OpenAI (décommente quand tu auras la clé)
    /*
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: PROMPT_SYSTEM },
        { role: 'user', content: `Titre: ${title}\nDescription: ${description}\nCible: ${target_audience}\nFeatures: ${features}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    
    await supabase.from('conversations').insert({
      user_id: user.id,
      agent_type: 'prompt',
      title: `Prompt pour ${title}`,
      input_data: { title, description, target_audience, features },
      output_data: result,
      tokens_used: completion.usage?.total_tokens || 0,
    })

    return NextResponse.json({ 
      success: true, 
      result 
    })
    */

  } catch (error: any) {
    console.error('Prompt API Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération' },
      { status: 500 }
    )
  }
}
