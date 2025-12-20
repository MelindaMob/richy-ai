import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// Initialiser Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const PROMPT_GENERATOR_SYSTEM = `Tu es l'agent Prompt Generator de Richy.ai, expert en création de prompts professionnels pour IA.

Ton rôle est de transformer les descriptions de projets en prompts structurés et optimisés pour obtenir les meilleurs résultats des LLMs.

STRUCTURE DU PROMPT À GÉNÉRER:
1. Contexte et rôle de l'IA
2. Objectif clair et mesurable
3. Contraintes techniques et créatives
4. Format de sortie attendu
5. Exemples si pertinent
6. Étapes de raisonnement (chain-of-thought)
7. Critères de validation

PRINCIPES DE CRÉATION:
- Clarté : Instructions sans ambiguïté
- Spécificité : Détails précis sur les attentes
- Structure : Organisation logique et hiérarchisée
- Flexibilité : Adaptable selon le contexte
- Performance : Optimisé pour la qualité des réponses

LIVRABLES:
Tu dois retourner un objet JSON avec:
- title: Titre du prompt
- prompt: Le prompt complet optimisé
- usage_instructions: Comment utiliser ce prompt
- best_practices: Meilleures pratiques
- compatible_with: Liste des IA compatibles
- customization_tips: Conseils de personnalisation`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // ⭐ NOTE : Assurez-vous que les champs frontend s'appellent bien 'saas_name' et 'saas_description'
    const { saas_name, saas_description, target_audience, main_features } = await req.json()

    if (!saas_name || !saas_description) {
      return NextResponse.json({ 
        error: 'Nom et description du SaaS requis' 
      }, { status: 400 })
    }

    // Si pas de clé Claude, utiliser la démo
    if (!process.env.ANTHROPIC_API_KEY) {
      return generateDemoResponse(user.id, saas_name, saas_description, target_audience, main_features, supabase)
    }

    try {
      // Construire le prompt pour Claude
      const userPrompt = `
Créé un prompt professionnel pour développer ce SaaS:

Nom: ${saas_name}
Description: ${saas_description}
Audience cible: ${target_audience || 'Non spécifiée'}
Fonctionnalités principales: ${main_features || 'Non spécifiées'}

Génère un prompt structuré et optimisé qui permettra à une IA de:
1. Comprendre profondément le projet
2. Générer du code de qualité production
3. Proposer une architecture scalable
4. Anticiper les challenges techniques

Le prompt doit être réutilisable et adaptable pour différentes tâches de développement.`

      // Appel à Claude
      const completion = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Modèle économique et rapide
        max_tokens: 2000,
        temperature: 0.7,
        system: PROMPT_GENERATOR_SYSTEM,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })

      // Extraire le contenu de la réponse Claude
      const responseText = completion.content[0].type === 'text' 
        ? completion.content[0].text 
        : ''

      // Parser le JSON de la réponse
      let result
      try {
        // ⭐ CORRECTION APPLIQUÉE : Utilisation de indexOf/lastIndexOf pour la robustesse
        const startIndex = responseText.indexOf('{');
        const endIndex = responseText.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
             throw new Error('Aucun bloc JSON valide trouvé dans la réponse.');
        }

        const cleanContent = responseText.substring(startIndex, endIndex + 1);
        result = JSON.parse(cleanContent)

      } catch (parseError) {
        console.error('Erreur de parsing Claude:', parseError, 'Contenu brut:', responseText.substring(0, 500) + '...')
        // Fallback: créer un prompt structuré manuellement
        result = generateStructuredPrompt(saas_name, saas_description, target_audience, main_features)
      }

      // S'assurer que le résultat a tous les champs nécessaires
      const formattedResult = {
        title: result.title || `Prompt optimisé pour ${saas_name}`,
        prompt: result.prompt || generateDefaultPrompt(saas_name, saas_description, target_audience, main_features),
        usage_instructions: result.usage_instructions || generateUsageInstructions(),
        best_practices: result.best_practices || [
          "Testez le prompt avec différentes IA",
          "Ajustez la température selon vos besoins",
          "Itérez sur le prompt pour l'améliorer",
          "Documentez les variations qui fonctionnent bien"
        ],
        compatible_with: result.compatible_with || ["GPT-4", "Claude 3", "Gemini Pro", "Llama 3", "Mistral"],
        customization_tips: result.customization_tips || [
          "Adaptez le niveau de détail technique",
          "Ajoutez vos contraintes spécifiques",
          "Personnalisez selon votre workflow"
        ]
      }

      // Sauvegarder dans la base de données
      await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'prompt',
        title: `Prompt pour ${saas_name}`,
        input_data: { saas_name, saas_description, target_audience, main_features },
        output_data: formattedResult,
        tokens_used: completion.usage?.input_tokens + completion.usage?.output_tokens || 0,
      })

      return NextResponse.json({ 
        success: true, 
        result: formattedResult
      })

    } catch (claudeError: any) {
      console.error('Claude API Error:', claudeError.message) // Affiche le message d'erreur de Claude
      
      // ⭐ GESTION D'ERREUR RENFORCÉE (Code 401/400)
      if (claudeError.message?.includes('api_key') || claudeError.status === 401 || claudeError.status === 400) {
        return NextResponse.json({ 
          error: 'Clé API Claude invalide ou requêtes mal formées (Code 401/400). Vérifie ton ANTHROPIC_API_KEY.' 
        }, { status: 400 })
      }
      
      // ⭐ GESTION D'ERREUR RENFORCÉE (Limite de débit)
      if (claudeError.message?.includes('rate_limit') || claudeError.status === 429) {
        return NextResponse.json({ 
          error: 'Limite Claude atteinte (Code 429). Réessaye dans quelques secondes.' 
        }, { status: 429 })
      }

      // Afficher l'erreur générique avant le fallback
      console.error('Erreur Claude inattendue, fallback à la démo:', claudeError)

      // Fallback sur la démo
      return generateDemoResponse(user.id, saas_name, saas_description, target_audience, main_features, supabase)
    }

  } catch (error: any) {
    console.error('Prompt Generator API Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du prompt' },
      { status: 500 }
    )
  }
}

// Fonction pour générer un prompt structuré
function generateStructuredPrompt(name: string, description: string, audience: string, features: string) {
  const prompt = `## Contexte et Rôle
Tu es un développeur senior expert en architecture SaaS. Tu vas créer ${name}, ${description}.

## Objectif Principal
Développer une solution complète et scalable qui:
- Résout efficacement le problème identifié
- Offre une expérience utilisateur exceptionnelle
- Est techniquement robuste et maintenable
- Peut évoluer avec la croissance

## Audience Cible
${audience || 'Startups et PME cherchant à optimiser leurs processus'}

## Fonctionnalités Essentielles
${features ? features.split(',').map(f => `- ${f.trim()}`).join('\n') : `- Authentication et gestion des rôles
- Dashboard analytique temps réel
- API REST complète
- Système de notifications
- Export de données`}

## Contraintes Techniques
- Performance: Temps de réponse < 200ms
- Scalabilité: Support de 10k+ utilisateurs simultanés
- Sécurité: Conformité RGPD et best practices OWASP
- Accessibilité: WCAG 2.1 niveau AA
- Responsive: Mobile-first approach

## Format de Sortie Attendu
Fournis:
1. Architecture technique détaillée
2. Choix technologiques justifiés
3. Structure de base de données
4. Plan d'implémentation par phases
5. Estimations de temps et ressources

## Processus de Raisonnement
Étape 1: Analyse des besoins et contraintes
Étape 2: Conception de l'architecture
Étape 3: Sélection des technologies
Étape 4: Planification du développement
Étape 5: Identification des risques et mitigation

## Critères de Succès
- Code maintenable et documenté
- Tests automatisés (coverage > 80%)
- Performance optimisée
- UX intuitive et moderne
- Scalabilité prouvée`

  return {
    title: `Prompt de développement pour ${name}`,
    prompt,
    usage_instructions: generateUsageInstructions(),
    best_practices: [
      "Adaptez les contraintes selon votre contexte",
      "Ajoutez des exemples concrets si nécessaire",
      "Précisez votre stack technique préférée",
      "Incluez vos standards de code"
    ],
    compatible_with: ["GPT-4", "Claude 3", "Gemini Pro", "Llama 3"],
    customization_tips: [
      "Modifiez les métriques de performance selon vos besoins",
      "Ajustez le niveau de détail technique",
      "Personnalisez les critères de succès"
    ]
  }
}

// Fonction pour générer un prompt par défaut
function generateDefaultPrompt(name: string, description: string, audience: string, features: string) {
  return `Développe ${name}: ${description}.

Cible: ${audience || 'Entreprises innovantes'}
Features: ${features || 'Dashboard, API, Analytics, Paiements'}

Fournis une solution complète avec:
- Architecture scalable
- Stack moderne
- Best practices
- Plan de développement
- Documentation

Sois précis, pragmatique et orienté production.`
}

// Fonction pour générer les instructions d'usage
function generateUsageInstructions() {
  return `1. Copiez ce prompt dans votre IA préférée (GPT-4, Claude, etc.)
2. Remplacez les variables entre [brackets] si présentes
3. Ajoutez vos contraintes spécifiques
4. Lancez la génération et itérez si nécessaire
5. Utilisez les sections séparément pour des tâches spécifiques`
}

// Fonction de démo
async function generateDemoResponse(
  userId: string,
  saasName: string,
  saasDescription: string,
  targetAudience: string,
  mainFeatures: string,
  supabase: any
) {
  const demoResult = generateStructuredPrompt(
    saasName,
    saasDescription,
    targetAudience || 'Startups et entreprises en croissance',
    mainFeatures || 'Dashboard, Analytics, API, Intégrations, Automatisation'
  )

  await supabase.from('conversations').insert({
    user_id: userId,
    agent_type: 'prompt',
    title: `Prompt pour ${saasName}`,
    input_data: { saas_name: saasName, saas_description: saasDescription, target_audience: targetAudience, main_features: mainFeatures },
    output_data: demoResult,
    tokens_used: 0,
  })

  return NextResponse.json({ 
    success: true, 
    result: demoResult,
    demo: true 
  })
}