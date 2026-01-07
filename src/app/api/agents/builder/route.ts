// app/api/agents/builder/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialiser Gemini avec la clé API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const BUILDER_SYSTEM = `Tu es l'agent Builder de Richy.ai. Tu crées des roadmaps de construction SaaS ultra-détaillées et pragmatiques.

CONTRAINTES À RESPECTER (CRITIQUES):
- BUDGET: Adapte la stack technique et les services tiers selon le budget disponible
  * Budget 0-5k€: Privilégie les solutions gratuites (Vercel free, Supabase free, etc.)
  * Budget 5k-10k€: Peut utiliser des services payants basiques
  * Budget 10k-25k€: Services payants moyens acceptables
  * Budget 25k€+: Services premium possibles
- TIMELINE: Adapte le nombre de sprints et la durée selon la timeline souhaitée
  * 1 mois: 2-3 sprints intensifs, MVP minimal
  * 2 mois: 4 sprints de 2 semaines, MVP complet
  * 3 mois: 6 sprints, MVP avec features supplémentaires
  * 6 mois: 8-12 sprints, MVP étoffé
- NIVEAU TECHNIQUE: Adapte la stack technique selon le niveau
  * Débutant: No-code (Bubble, Webflow) ou solutions très simples (Next.js + templates)
  * Intermédiaire: Low-code (Next.js, Supabase) ou frameworks populaires
  * Expert: Stack technique avancée possible (microservices, etc.)

LIVRABLES OBLIGATOIRES:
1. MVP DÉFINITION
   - core_features: Array des fonctionnalités principales incluses dans le MVP (minimum 5-8)
   - excluded_features: Array des fonctionnalités explicitement exclues du MVP
   - duration: Durée estimée du développement du MVP (DOIT respecter la timeline demandée)

2. STACK TECHNIQUE (DÉTAILLÉ)
   - frontend: Description précise avec framework/librairies spécifiques et justification (ADAPTÉ au budget et niveau technique)
   - backend: Description précise avec technologies spécifiques et justification (ADAPTÉ au budget et niveau technique)
   - database: Description précise avec type de base de données et justification (ADAPTÉ au budget)
   - hosting: Description précise avec solution d'hébergement et justification (ADAPTÉ au budget)
   - third_party_services: Array des services tiers (ex: Stripe, SendGrid, etc.) avec leur usage (ADAPTÉ au budget)

3. ROADMAP
   - Nombre de sprints adapté à la TIMELINE demandée
   - Chaque sprint doit avoir:
     * title: Nom du sprint
     * description: Description détaillée des objectifs et livrables du sprint
     * tasks: Array des tâches précises à réaliser

4. PLAN DE LANCEMENT
   - pre_lancement: Array des actions pré-lancement
   - jour_j: Array des actions jour J
   - post_lancement: Array des actions post-lancement
   - kpis: Array des KPIs à tracker

5. DIFFICULTÉ
   - difficulty_score: Score de difficulté du projet sur 10 (1=très facile, 10=très complexe)
   - difficulty_explanation: Explication brève de pourquoi ce score

APPROCHE:
- ADAPTE TOUJOURS la stack technique, les services tiers et la roadmap selon le BUDGET, la TIMELINE et le NIVEAU TECHNIQUE fournis
- No-code/Low-code privilégié selon le niveau technique
- Rapidité d'exécution et coûts minimaux
- Descriptions précises et actionnables
- Retourne UNIQUEMENT un JSON structuré avec cette structure exacte:
{
  "mvp_definition": {
    "core_features": ["feature1", "feature2", ...],
    "excluded_features": ["exclu1", "exclu2", ...],
    "duration": "durée estimée"
  },
  "technical_stack": {
    "frontend": "description précise avec technologies",
    "backend": "description précise avec technologies",
    "database": "description précise avec type de DB",
    "hosting": "description précise avec solution",
    "third_party_services": ["service1", "service2", ...]
  },
  "roadmap": {
    "sprints": [
      {
        "title": "Nom du sprint",
        "description": "Description détaillée des objectifs",
        "tasks": ["tâche1", "tâche2", ...]
      }
    ]
  },
  "launch_plan": {
    "pre_lancement": ["action1", ...],
    "jour_j": ["action1", ...],
    "post_lancement": ["action1", ...],
    "kpis": ["kpi1", ...]
  },
  "difficulty": {
    "score": 7,
    "explanation": "Explication du score"
  }
}`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier les limites d'usage
    const { checkUsageLimits } = await import('@/lib/check-limits')
    const limitCheck = await checkUsageLimits(user.id, 'builder')
    
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: limitCheck.message,
        reason: limitCheck.reason,
        showUpgrade: true
      }, { status: 403 })
    }

    const { project_name, project_description, budget, timeline, technical_level, skip_validation } = await req.json()

    if (!project_name || !project_description || !budget || !timeline || !technical_level) {
      return NextResponse.json({ 
        error: 'Informations manquantes. Tous les champs sont obligatoires (nom, description, budget, timeline, niveau technique).' 
      }, { status: 400 })
    }

    // Vérification de la clé API
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('fake')) {
      return NextResponse.json({ 
        error: 'Configuration API Gemini manquante dans le fichier .env' 
      }, { status: 500 })
    }

    // Validation intelligente : analyser si la description est suffisamment détaillée
    if (!skip_validation) {
      try {
        const analysisModel = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          }
        })
        
        const analysisPrompt = `Tu es un expert en analyse de projets SaaS. Analyse cette description et détermine si elle est SUFFISAMMENT PRÉCISE ET DÉTAILLÉE pour créer une roadmap de qualité.

PROJET: ${project_name}
DESCRIPTION:
${project_description}

ÉVALUE LA QUALITÉ DU CONTENU (pas la longueur) :
- La description est-elle TROP VAGUE ou générique ? (ex: "saas pour les rh", "application de gestion", "plateforme pour entreprises")
- Contient-elle des détails CONCRETS sur le problème résolu ? (pas juste "pour les rh" mais "quel problème spécifique")
- Contient-elle des détails CONCRETS sur la solution/fonctionnalités ? (pas juste "gestion" mais "quelles fonctionnalités précises")
- Contient-elle des détails CONCRETS sur la cible ? (pas juste "pour les entreprises" mais "type d'entreprise, taille, secteur, rôle")
- Y a-t-il assez de CONTEXTE pour comprendre le projet réellement ?

RÈGLES:
- Une description peut être longue mais VAGUE → TROP VAGUE
- Une description courte mais PRÉCISE et CONCRÈTE → SUFFISANTE
- Exemples TROP VAGUES: "saas pour les rh", "application de gestion", "plateforme pour entreprises", "outil pour améliorer la productivité"
- Exemples SUFFISANTS: "SaaS pour aider les RH à gérer l'onboarding. Problème: les RH passent trop de temps sur l'administration. Solution: plateforme avec parcours personnalisables. Cible: PME 50-500 employés."

Retourne UNIQUEMENT un JSON valide (pas de texte avant ou après) :

Si TROP VAGUE (manque de précision/concrétude):
{
  "needs_more_info": true,
  "missing_elements": ["Question personnalisée 1", "Question personnalisée 2"],
  "examples": ["Exemple qui complète la description", "Exemple 2"],
  "suggestions": "Suggestion pour améliorer la précision"
}

Si SUFFISAMMENT PRÉCISE ET DÉTAILLÉE:
{
  "needs_more_info": false
}

IMPORTANT: Retourne UNIQUEMENT le JSON, rien d'autre. Évalue la QUALITÉ et la PRÉCISION, pas la longueur.`

        const analysisResult = await analysisModel.generateContent(analysisPrompt)
        const analysisText = analysisResult.response.text().trim()
        
        let analysisData: any = {}
        try {
          let cleanedAnalysis = analysisText.trim()
          
          // Extraire le JSON même s'il y a du texte avant/après
          const jsonMatch = cleanedAnalysis.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            cleanedAnalysis = jsonMatch[0]
          }
          
          // Nettoyer les markdown code blocks
          if (cleanedAnalysis.startsWith('```json')) {
            cleanedAnalysis = cleanedAnalysis.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
          } else if (cleanedAnalysis.startsWith('```')) {
            cleanedAnalysis = cleanedAnalysis.replace(/^```\s*/i, '').replace(/\s*```$/g, '').trim()
          }
          
          analysisData = JSON.parse(cleanedAnalysis)
        } catch (parseError) {
          console.error('Erreur parsing analyse:', parseError)
          console.error('Texte reçu:', analysisText.substring(0, 200))
          
          // Si le parsing échoue, on considère que c'est trop vague par sécurité
          // On fait une validation basique basée sur la QUALITÉ et la PRÉCISION du contenu
          const descLower = project_description.toLowerCase().trim()
          const wordCount = project_description.trim().split(/\s+/).length
          
          // Détection de descriptions trop vagues
          const isTooVaguePattern = descLower.match(/^(saas|application|plateforme|logiciel|outil|système|service)\s+(pour|de|d['e])\s+/i) && wordCount < 15
          const hasConcreteProblem = descLower.match(/(problème|besoin|souci|difficulté|résout|résoudre|aide)/) && wordCount > 5
          const hasConcreteSolution = descLower.match(/(solution|fonctionnalité|feature|fonction|permet|offre|gère)/) && wordCount > 5
          const hasConcreteTarget = descLower.match(/(cible|client|utilisateur|entreprise|pm[ée]|eti)/) || (descLower.match(/(pour les|pour la)/) && wordCount > 10)
          
          // Si trop vague ou manque de précision, considérer comme trop vague
          if (isTooVaguePattern || !hasConcreteProblem || !hasConcreteSolution || !hasConcreteTarget) {
            analysisData = { needs_more_info: true }
          } else {
            // Si le parsing échoue mais que ça a l'air précis, on continue quand même
            analysisData = { needs_more_info: false }
          }
        }

        // Validation supplémentaire basée sur la longueur et le contenu (TOUJOURS appliquée)
        const descLower = project_description.toLowerCase().trim()
        const isTooShort = project_description.trim().length < 80 // Minimum 80 caractères pour être considéré comme détaillé
        const wordCount = project_description.trim().split(/\s+/).length
        
        // Détection plus stricte : doit contenir des mots-clés explicites
        const hasProblem = descLower.includes('problème') || descLower.includes('besoin') || descLower.includes('souci') || descLower.includes('difficulté') || descLower.includes('résout') || descLower.includes('résoudre') || descLower.includes('aide')
        const hasSolution = descLower.includes('solution') || descLower.includes('fonctionnalité') || descLower.includes('feature') || descLower.includes('fonction') || descLower.includes('permet') || descLower.includes('offre') || descLower.includes('gère') || descLower.includes('gestion')
        const hasTarget = (descLower.includes('cible') || descLower.includes('client') || descLower.includes('utilisateur') || descLower.includes('entreprise')) && !descLower.match(/^[^.]{0,30}$/) // Éviter les phrases trop courtes avec juste "pour"
        
        // Descriptions trop vagues (exemples connus)
        const isTooVague = descLower.match(/^(saas|application|plateforme|logiciel|outil|système)\s+(pour|de|d['e])\s+/i) && wordCount < 10
        
        // Si trop court, trop peu de mots, trop vague, ou manque d'infos essentielles, forcer needs_more_info à true
        const shouldRequireMoreInfo = isTooShort || wordCount < 10 || isTooVague || !hasProblem || !hasSolution || !hasTarget || analysisData.needs_more_info === true
        
        // Si l'analyse indique qu'il manque des infos, retourner la page d'aide
        if (shouldRequireMoreInfo) {
          // Fallback si l'analyse ne retourne pas assez d'éléments
          if (!analysisData.missing_elements || analysisData.missing_elements.length === 0) {
            analysisData.missing_elements = []
            
            const descLower = project_description.toLowerCase()
            const hasProblem = descLower.includes('problème') || descLower.includes('besoin') || descLower.includes('souci') || descLower.includes('difficulté') || descLower.includes('résout')
            const hasSolution = descLower.includes('solution') || descLower.includes('fonctionnalité') || descLower.includes('feature') || descLower.includes('fonction') || descLower.includes('permet')
            const hasTarget = descLower.includes('cible') || descLower.includes('client') || descLower.includes('utilisateur') || descLower.includes('entreprise') || descLower.includes('pour')
            
            let contextHint = ''
            if (descLower.includes('rh') || descLower.includes('ressources humaines')) {
              contextHint = 'RH'
            } else if (descLower.includes('projet') || descLower.includes('gestion')) {
              contextHint = 'gestion de projets'
            } else if (descLower.includes('vente') || descLower.includes('commerce')) {
              contextHint = 'vente/commerce'
            }
            
            if (!hasProblem) {
              analysisData.missing_elements.push(
                contextHint 
                  ? `Quel problème spécifique rencontrent ${contextHint === 'RH' ? 'les RH' : contextHint === 'gestion de projets' ? 'les équipes' : 'les utilisateurs'} que ton SaaS résout ?`
                  : 'Quel problème ou besoin concret ton SaaS résout-il ? Décris la situation actuelle et les difficultés rencontrées.'
              )
            }
            
            if (!hasSolution) {
              analysisData.missing_elements.push(
                contextHint
                  ? `Quelles fonctionnalités précises veux-tu pour ${contextHint} ? (détaille 2-3 fonctionnalités principales)`
                  : 'Quelles sont les 2-3 fonctionnalités principales que ton SaaS offrira ? Décris-les en détail.'
              )
            }
            
            if (!hasTarget) {
              analysisData.missing_elements.push(
                contextHint
                  ? `Qui est ta cible précise pour ${contextHint} ? (type d'entreprise, taille, secteur, rôle des utilisateurs)`
                  : 'Qui est ta cible ? (type d\'entreprise, taille, secteur, rôle des utilisateurs)'
              )
            }
          }

          if (!analysisData.examples || analysisData.examples.length === 0) {
            const baseDescription = project_description.trim()
            const examples: string[] = []
            
            if (!project_description.toLowerCase().includes('problème') && !project_description.toLowerCase().includes('solution')) {
              examples.push(`${baseDescription}\n\nProblème résolu : [Décris le problème concret que ton SaaS résout]\n\nSolution proposée : [Décris comment ton SaaS résout ce problème avec des fonctionnalités précises]`)
            }
            
            if (!project_description.toLowerCase().includes('cible') && !project_description.toLowerCase().includes('modèle')) {
              examples.push(`${baseDescription}\n\nCible : [Qui sont tes utilisateurs ? Type d'entreprise, taille, secteur]\n\nModèle économique : [Comment monétises-tu ? Abonnement, freemium, usage, etc.]`)
            }
            
            if (examples.length === 0) {
              examples.push(`${baseDescription}\n\n[Complète avec plus de détails sur : le problème résolu, les fonctionnalités précises, la cible, et le modèle économique]`)
            }
            
            analysisData.examples = examples
          }

          return NextResponse.json({
            needsMoreInfo: true,
            missingElements: analysisData.missing_elements || [],
            examples: analysisData.examples || [],
            suggestions: analysisData.suggestions || 'Ta description est trop vague. Ajoute des détails concrets sur le problème résolu, les fonctionnalités précises, et la cible pour obtenir une roadmap de qualité.'
          }, { status: 400 })
        }
      } catch (analysisError) {
        console.error('Erreur lors de l\'analyse de la description:', analysisError)
        // Si l'analyse échoue, on continue avec la génération pour ne pas bloquer l'utilisateur
      }
    }

    const userPrompt = `Crée une roadmap complète et détaillée pour ce projet SaaS :

NOM DU PROJET: ${project_name}

DESCRIPTION DÉTAILLÉE:
${project_description}

CONTRAINTES CRITIQUES À RESPECTER (OBLIGATOIRE):
- BUDGET DISPONIBLE: ${budget || 'Non spécifié'}
  * Si 0-5k€: Utilise UNIQUEMENT des solutions gratuites (Vercel free, Supabase free, etc.)
  * Si 5k-10k€: Services payants basiques acceptables
  * Si 10k-25k€: Services payants moyens possibles
  * Si 25k€+: Services premium autorisés
  * ADAPTE la stack technique et les services tiers selon ce budget

- TIMELINE SOUHAITÉE: ${timeline || 'Non spécifiée'}
  * Si 1 mois: 2-3 sprints intensifs, MVP minimal avec features essentielles
  * Si 2 mois: 4 sprints de 2 semaines, MVP complet
  * Si 3 mois: 6 sprints, MVP avec features supplémentaires
  * Si 6 mois: 8-12 sprints, MVP étoffé
  * ADAPTE le nombre de sprints et leur durée selon cette timeline

- NIVEAU TECHNIQUE: ${technical_level || 'Débutant'}
  * Si Débutant: Privilégie NO-CODE (Bubble.io, Webflow) ou solutions très simples (Next.js + templates pré-faits)
  * Si Intermédiaire: Utilise LOW-CODE (Next.js, Supabase) ou frameworks populaires
  * Si Expert: Stack technique avancée possible (microservices, architectures complexes)
  * ADAPTE la stack technique selon ce niveau

IMPORTANT:
- Analyse la description en détail pour comprendre le projet réel
- Les fonctionnalités MVP doivent être spécifiques au projet décrit
- La stack technique DOIT être adaptée au BUDGET, à la TIMELINE et au NIVEAU TECHNIQUE
- Le nombre de sprints DOIT respecter la TIMELINE demandée
- Chaque sprint doit avoir une DESCRIPTION DÉTAILLÉE des objectifs et livrables
- Les tâches doivent être actionnables et précises
- Évalue la difficulté du projet sur 10 avec une explication claire
- La durée du MVP DOIT correspondre à la TIMELINE demandée`

    try {
      console.log('🤖 Génération de la roadmap avec Gemini...')
      
      // Utiliser gemini-2.5-flash (le plus récent et stable)
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      })
      
      console.log('✅ Modèle chargé: gemini-2.5-flash')
      
      const fullPrompt = `${BUILDER_SYSTEM}\n\n${userPrompt}\n\nIMPORTANT: Retourne UNIQUEMENT du JSON valide, pas de texte, pas de markdown.`

      const result = await model.generateContent(fullPrompt)
      const text = result.response.text().trim()
      
      let parsedResult
      try {
        // Nettoyage pour extraire uniquement le JSON
        let cleanedText = text.trim()
        
        // Enlever les backticks markdown si présents
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/i, '').replace(/\s*```$/g, '').trim()
        }
        
        // Enlever les retours à la ligne en début/fin
        cleanedText = cleanedText.replace(/^\s+|\s+$/g, '')
        
        parsedResult = JSON.parse(cleanedText)
        console.log('✅ JSON parsé avec succès')
      } catch (parseError: any) {
        console.error('Erreur parsing JSON IA:', parseError.message)
        console.error('Texte reçu (premiers 500 caractères):', text.substring(0, 500))
        
        // Essayer d'extraire le JSON même s'il y a du texte autour
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            parsedResult = JSON.parse(jsonMatch[0])
            console.log('✅ JSON extrait avec regex')
          } catch (regexError) {
            throw new Error('La réponse de l\'IA n\'est pas un JSON valide: ' + parseError.message)
          }
        } else {
          throw new Error('La réponse de l\'IA n\'est pas un JSON valide: ' + parseError.message)
        }
      }

      // Normaliser la structure pour correspondre au format attendu par le frontend
      const normalizedResult: any = {
        mvp_definition: parsedResult.mvp_definition || parsedResult.mvp || {},
        technical_stack: parsedResult.technical_stack || parsedResult.tech_stack || parsedResult.stack_technique || {},
        roadmap: parsedResult.roadmap || {},
        launch_plan: parsedResult.launch_plan || parsedResult.plan_de_lancement || {}
      }

      // Normaliser mvp_definition
      if (normalizedResult.mvp_definition) {
        // Gérer core_features, features_core, features, features_included
        if (parsedResult.mvp_definition?.core_features) {
          normalizedResult.mvp_definition.features = parsedResult.mvp_definition.core_features
        } else if (parsedResult.mvp_definition?.features_core) {
          normalizedResult.mvp_definition.features = parsedResult.mvp_definition.features_core
        } else if (parsedResult.mvp_definition?.features) {
          normalizedResult.mvp_definition.features = parsedResult.mvp_definition.features
        } else if (parsedResult.mvp?.features_included) {
          normalizedResult.mvp_definition.features = parsedResult.mvp.features_included
        }
        
        // Gérer excluded_features, features_exclues, excluded, features_excluded
        if (parsedResult.mvp_definition?.excluded_features) {
          normalizedResult.mvp_definition.excluded = parsedResult.mvp_definition.excluded_features
        } else if (parsedResult.mvp_definition?.features_exclues) {
          normalizedResult.mvp_definition.excluded = parsedResult.mvp_definition.features_exclues
        } else if (parsedResult.mvp_definition?.excluded) {
          normalizedResult.mvp_definition.excluded = parsedResult.mvp_definition.excluded
        } else if (parsedResult.mvp?.features_excluded) {
          normalizedResult.mvp_definition.excluded = parsedResult.mvp.features_excluded
        }
        
        // Gérer duration
        if (parsedResult.mvp_definition?.duration) {
          normalizedResult.mvp_definition.duration = parsedResult.mvp_definition.duration
        } else if (parsedResult.mvp_definition?.duree_mvp_dev) {
          normalizedResult.mvp_definition.duration = parsedResult.mvp_definition.duree_mvp_dev
        } else if (parsedResult.mvp?.estimated_duration) {
          normalizedResult.mvp_definition.duration = parsedResult.mvp.estimated_duration
        }
      }

      // Normaliser roadmap.sprints
      if (normalizedResult.roadmap.sprints && Array.isArray(normalizedResult.roadmap.sprints)) {
        // Déjà au bon format
      } else {
        // Convertir les différents formats de sprints
        const sprints: any[] = []
        
        // Format sprint_1_week_1, sprint_2_week_2, etc.
        const sprintKeys = Object.keys(normalizedResult.roadmap).filter(key => 
          key.startsWith('sprint_') && (key.includes('week_') || /sprint_\d+/.test(key))
        ).sort()
        
        if (sprintKeys.length > 0) {
          sprintKeys.forEach((key, index) => {
            const sprint = normalizedResult.roadmap[key]
            if (sprint && sprint.tasks) {
              sprints.push({
                name: sprint.title || `Sprint ${index + 1}`,
                tasks: Array.isArray(sprint.tasks) ? sprint.tasks : []
              })
            }
          })
        } else if (normalizedResult.roadmap.sprint_1) {
          // Format sprint_1, sprint_2, etc.
          sprints.push(
            { name: 'Sprint 1 - Fondations', tasks: normalizedResult.roadmap.sprint_1 },
            { name: 'Sprint 2 - Core features', tasks: normalizedResult.roadmap.sprint_2 || [] },
            { name: 'Sprint 3 - Polish & tests', tasks: normalizedResult.roadmap.sprint_3 || [] },
            { name: 'Sprint 4 - Launch prep', tasks: normalizedResult.roadmap.sprint_4 || [] }
          )
        } else if (Array.isArray(parsedResult.roadmap)) {
          // Si roadmap est directement un array
          sprints.push(...parsedResult.roadmap)
        }
        
        if (sprints.length > 0) {
          normalizedResult.roadmap.sprints = sprints
        }
      }

      console.log('📦 Structure normalisée:', JSON.stringify(normalizedResult, null, 2).substring(0, 500))

      // Sauvegarde dans Supabase
      await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'builder',
        title: `Roadmap pour ${project_name}`,
        input_data: { project_name, project_description, budget, timeline, technical_level },
        output_data: normalizedResult,
        tokens_used: result.response.usageMetadata?.totalTokenCount || 0,
      })

      return NextResponse.json({ 
        success: true, 
        result: normalizedResult,
        remaining: limitCheck.remaining
      })

    } catch (error: any) {
      console.error('Erreur Gemini:', error)
      
      // Si le modèle n'est pas disponible ou quota dépassé, essayer un autre modèle
      if (error.message?.includes('404') || error.message?.includes('429') || error.message?.includes('quota')) {
        console.log('⚠️ Modèle gemini-2.5-flash non disponible, essai avec gemini-2.0-flash')
        
        try {
          const fallbackModel = genAI.getGenerativeModel({ 
            model: 'gemini-2.0-flash',
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
            }
          })
          
          const fullPrompt = `${BUILDER_SYSTEM}\n\n${userPrompt}\n\nIMPORTANT: Retourne UNIQUEMENT du JSON valide, pas de texte, pas de markdown.`
          const result = await fallbackModel.generateContent(fullPrompt)
          const text = result.response.text().trim()
          
          let parsedResult
          try {
            // Nettoyage pour extraire uniquement le JSON
            let cleanedText = text.trim()
            
            // Enlever les backticks markdown si présents
            if (cleanedText.startsWith('```json')) {
              cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
            } else if (cleanedText.startsWith('```')) {
              cleanedText = cleanedText.replace(/^```\s*/i, '').replace(/\s*```$/g, '').trim()
            }
            
            // Enlever les retours à la ligne en début/fin
            cleanedText = cleanedText.replace(/^\s+|\s+$/g, '')
            
            parsedResult = JSON.parse(cleanedText)
            console.log('✅ JSON parsé avec succès (fallback)')
          } catch (parseError: any) {
            console.error('Erreur parsing JSON IA (fallback):', parseError.message)
            
            // Essayer d'extraire le JSON même s'il y a du texte autour
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              try {
                parsedResult = JSON.parse(jsonMatch[0])
                console.log('✅ JSON extrait avec regex (fallback)')
              } catch (regexError) {
                // Dernier essai avec gemini-flash-latest
                console.log('⚠️ Essai avec gemini-flash-latest')
                const lastModel = genAI.getGenerativeModel({ 
                  model: 'gemini-flash-latest',
                  generationConfig: {
      temperature: 0.7,
                    maxOutputTokens: 8192,
                  }
                })
                
                const lastResult = await lastModel.generateContent(fullPrompt)
                const lastText = lastResult.response.text().trim()
                
                // Nettoyer le texte du dernier modèle
                let cleanedLastText = lastText.trim()
                if (cleanedLastText.startsWith('```json')) {
                  cleanedLastText = cleanedLastText.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
                } else if (cleanedLastText.startsWith('```')) {
                  cleanedLastText = cleanedLastText.replace(/^```\s*/i, '').replace(/\s*```$/g, '').trim()
                }
                cleanedLastText = cleanedLastText.replace(/^\s+|\s+$/g, '')
                
                // Essayer de parser, sinon extraire avec regex
                try {
                  parsedResult = JSON.parse(cleanedLastText)
                } catch {
                  const lastJsonMatch = cleanedLastText.match(/\{[\s\S]*\}/)
                  if (lastJsonMatch) {
                    parsedResult = JSON.parse(lastJsonMatch[0])
                  } else {
                    throw new Error('Impossible d\'extraire le JSON de la réponse')
                  }
                }
              }
            } else {
              throw new Error('Aucun JSON trouvé dans la réponse')
            }
          }
    
    await supabase.from('conversations').insert({
      user_id: user.id,
      agent_type: 'builder',
      title: `Roadmap pour ${project_name}`,
      input_data: { project_name, project_description, budget, timeline, technical_level },
            output_data: parsedResult,
            tokens_used: result.response.usageMetadata?.totalTokenCount || 0,
    })

    return NextResponse.json({ 
      success: true, 
            result: parsedResult,
            remaining: limitCheck.remaining
          })
          
        } catch (fallbackError: any) {
          console.error('Erreur avec tous les modèles:', fallbackError)
          
          // Retourner une roadmap par défaut en cas d'échec total
          const defaultRoadmap = {
            mvp: {
              features_included: ["Landing page", "Auth système", "Dashboard basique"],
              features_excluded: ["Analytics avancées", "API publique"],
              estimated_duration: "4 semaines"
            },
            tech_stack: {
              frontend: ["Next.js", "Tailwind CSS"],
              backend: ["Supabase"],
              database: ["PostgreSQL"],
              hosting: ["Vercel"],
              third_party_services: []
            },
            roadmap: [
              {
                sprint_number: 1,
                duration: "2 semaines",
                title: "Foundation",
                tasks: ["Setup projet", "Auth système", "DB schema"],
                deliverables: ["Projet configuré", "Auth fonctionnel"]
              },
              {
                sprint_number: 2,
                duration: "2 semaines",
                title: "Core Features",
                tasks: ["Dashboard", "CRUD opérations"],
                deliverables: ["MVP fonctionnel"]
              },
              {
                sprint_number: 3,
                duration: "2 semaines",
                title: "Polish",
                tasks: ["UI/UX améliorations", "Tests"],
                deliverables: ["Version stable"]
              },
              {
                sprint_number: 4,
                duration: "2 semaines",
                title: "Launch",
                tasks: ["Déploiement", "Marketing"],
                deliverables: ["Produit en ligne"]
              }
            ],
            launch_plan: {
              pre_launch: ["Beta testing", "Content création"],
              launch_day: ["Annonce sur réseaux sociaux", "Email campaign"],
              post_launch: ["Support utilisateurs", "Itérations"],
              kpis_to_track: ["Inscriptions", "Activation rate", "Churn"]
            }
          }

          return NextResponse.json({ 
            success: true, 
            result: defaultRoadmap,
            fallback: true,
            message: "Roadmap générée en mode offline",
            remaining: limitCheck.remaining
          })
        }
      }
      
      return NextResponse.json({ 
        error: 'Erreur Gemini: ' + (error.message || 'Problème de connexion')
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Builder API Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}