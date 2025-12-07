import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const PROMPT_SYSTEM = `Tu es l'agent Prompt de Richy.ai. Tu transformes les idées en prompts professionnels.

STRUCTURE OBLIGATOIRE DU PROMPT:
1. CONTEXTE ET RÔLE
2. OBJECTIF PRINCIPAL
3. CONTRAINTES TECHNIQUES
4. FORMAT DE SORTIE ATTENDU
5. ÉTAPES DE RAISONNEMENT
6. EXEMPLES (si pertinent)
7. CRITÈRES DE VALIDATION

LE PROMPT DOIT:
- Être ultra-précis et structuré
- Fonctionner sur GPT-4, Claude, Gemini
- Inclure le chain-of-thought
- Définir les outputs exacts
- Éviter toute ambiguïté
- Permettre de créer le SaaS directement

Retourne un JSON avec: title, prompt, usage_instructions, compatible_with`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { title, description, target_audience, features } = await req.json()

    if (!title || !description || !target_audience) {
      return NextResponse.json({ error: 'Informations manquantes' }, { status: 400 })
    }

    // Demo response si pas de clé OpenAI
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('fake')) {
      const demoResult = {
        title: `Prompt professionnel pour ${title}`,
        prompt: `# CONTEXTE ET RÔLE
Tu es un expert en développement SaaS spécialisé dans ${title}.

# OBJECTIF PRINCIPAL
Créer un système complet pour ${description}

# CIBLE
${target_audience}

# CONTRAINTES TECHNIQUES
- Architecture scalable et modulaire
- Code propre et documenté
- Performance optimisée
- Sécurité renforcée

# FORMAT DE SORTIE
1. Architecture complète du système
2. Liste des endpoints API nécessaires
3. Modèles de données détaillés
4. Plan d'implémentation étape par étape
5. Code des fonctions principales

# ÉTAPES DE RAISONNEMENT
1. Analyser les besoins de ${target_audience}
2. Définir l'architecture technique optimale
3. Lister tous les composants nécessaires
4. Créer le plan d'implémentation
5. Générer le code avec commentaires

# CRITÈRES DE VALIDATION
- Le système doit être production-ready
- Scalabilité jusqu'à 10,000 utilisateurs
- Documentation complète incluse
- Tests unitaires fournis

# FEATURES REQUISES
${features || '- Dashboard utilisateur\n- API REST complète\n- Authentication sécurisée\n- Analytics intégrés'}

Commence par me donner l'architecture complète, puis détaille chaque composant.`,
        usage_instructions: `1. Copie ce prompt dans ChatGPT, Claude ou Gemini
2. L'IA va générer l'architecture complète de ton SaaS
3. Demande ensuite le code spécifique pour chaque partie
4. Utilise les réponses pour construire ton MVP rapidement
5. Itère en demandant des améliorations spécifiques`,
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