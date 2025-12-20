import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialiser Gemini avec ta clé
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const VALIDATION_PROMPT = `Tu es un expert en analyse de projets SaaS. Évalue si la description du projet contient assez d'informations pour créer une roadmap détaillée.

INFORMATIONS NÉCESSAIRES:
1. Problème résolu clairement défini
2. Solution proposée
3. Cible/marché identifié
4. Fonctionnalités principales (au moins 2-3)
5. Modèle de revenus envisagé

Si des informations CRITIQUES manquent, retourne un JSON avec:
{
  "needs_more_info": true,
  "missing_elements": ["liste des éléments manquants"],
  "questions": ["questions spécifiques à poser"],
  "suggestions": ["exemples pour aider l'utilisateur"]
}

Si les informations sont suffisantes, retourne:
{
  "needs_more_info": false
}

Sois indulgent - même une description basique peut suffire si elle contient l'essentiel.`

const BUILDER_PROMPT = `Tu es l'agent Builder de Richy.ai. Tu crées des roadmaps de construction SaaS ultra-détaillées et pragmatiques.

Tu DOIS retourner un objet JSON avec EXACTEMENT cette structure:

{
  "mvp_definition": {
    "features": ["feature1", "feature2", "feature3", "feature4", "feature5"],
    "excluded": ["exclusion1", "exclusion2", "exclusion3"],
    "duration": "durée estimée"
  },
  "tech_stack": {
    "frontend": "description du stack frontend",
    "backend": "description du stack backend",
    "database": "type de base de données",
    "hosting": "solution d'hébergement",
    "third_party": ["service1", "service2", "service3"]
  },
  "roadmap": {
    "sprint_1": ["tâche1", "tâche2", "tâche3", "tâche4", "tâche5"],
    "sprint_2": ["tâche1", "tâche2", "tâche3", "tâche4", "tâche5"],
    "sprint_3": ["tâche1", "tâche2", "tâche3", "tâche4", "tâche5"],
    "sprint_4": ["tâche1", "tâche2", "tâche3", "tâche4", "tâche5"]
  },
  "launch_plan": {
    "pre_launch": ["action1", "action2", "action3", "action4", "action5"],
    "launch_day": ["action1", "action2", "action3", "action4", "action5"],
    "post_launch": ["action1", "action2", "action3", "action4", "action5"],
    "kpis": ["kpi1", "kpi2", "kpi3", "kpi4", "kpi5", "kpi6"]
  }
}

IMPORTANT: Retourne UNIQUEMENT le JSON, sans markdown, sans commentaires, sans texte avant ou après.`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { 
      project_name, 
      project_description, 
      budget, 
      timeline, 
      technical_level,
      skip_validation = false
    } = await req.json()

    if (!project_name || !project_description) {
      return NextResponse.json({ 
        error: 'Nom et description du projet requis' 
      }, { status: 400 })
    }

    // Si pas de clé Gemini, utiliser la démo
    if (!process.env.GEMINI_API_KEY) {
      return generateDemoResponse(user.id, project_name, project_description, budget, timeline, technical_level, supabase)
    }

    // Construire le prompt utilisateur (accessible dans try et catch)
    const userInput = `${BUILDER_PROMPT}

Projet: ${project_name}
Description détaillée: ${project_description}
Budget disponible: ${budget || 'Non spécifié'}
Timeline souhaitée: ${timeline || 'Non spécifiée'}
Niveau technique de l'équipe: ${technical_level || 'intermediate'}

Analyse ce projet et génère une roadmap complète et détaillée.
Adapte la complexité technique au niveau de l'équipe.
${budget === '0-5k' ? 'Privilégie les solutions gratuites ou très économiques.' : ''}
${timeline === '1-month' ? 'Focus sur un MVP très lean, maximum 3 features.' : ''}
${timeline === '6-months' ? 'Tu peux prévoir un MVP plus complet avec 5 features.' : ''}

IMPORTANT: Retourne UNIQUEMENT un objet JSON valide avec la structure exacte demandée, sans markdown ni commentaires.`

    try {
      // ⭐ UTILISER LE BON MODÈLE: gemini-2.5-flash
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash" 
      })

      // ÉTAPE 1: Validation de la description (sauf si skip_validation)
      if (!skip_validation && project_description.length < 100) {
        const validationPrompt = `${VALIDATION_PROMPT}

Analyse cette description de projet SaaS:
Nom: ${project_name}
Description: ${project_description}

Est-ce que cette description contient assez d'informations pour créer une roadmap détaillée ?
Retourne un JSON avec ton analyse.`

        const validationResult = await model.generateContent(validationPrompt)
        const validationText = validationResult.response.text()
        
        let validationData
        try {
          const jsonMatch = validationText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            validationData = JSON.parse(jsonMatch[0])
          }
        } catch (e) {
          // Si parsing échoue, on continue avec la génération
          validationData = { needs_more_info: false }
        }

        // Si besoin de plus d'infos, retourner les questions
        if (validationData?.needs_more_info) {
          return NextResponse.json({
            success: false,
            needs_more_info: true,
            feedback: {
              message: "J'ai besoin de plus d'informations pour créer une roadmap précise et adaptée à ton projet.",
              missing_elements: validationData.missing_elements || [
                "Problème spécifique à résoudre",
                "Fonctionnalités principales envisagées",
                "Cible et taille du marché"
              ],
              questions: validationData.questions || [
                "Quel problème précis ton SaaS va-t-il résoudre ?",
                "Qui est ta cible exacte (entreprises, particuliers, secteur) ?",
                "Quelles sont les 3-5 fonctionnalités principales que tu veux implémenter ?",
                "Comment comptes-tu monétiser (abonnement, usage, freemium) ?",
                "As-tu identifié des concurrents ? Qu'est-ce qui te différencie ?"
              ],
              suggestions: validationData.suggestions || [
                "Exemple: 'Un SaaS de gestion de projets pour les agences créatives, avec timetracking, facturation automatique et collaboration client'",
                "Pense à décrire: le problème, la solution, la cible, les features clés, le business model"
              ],
              example_format: `Exemple de description complète:

"Je veux créer un SaaS de gestion des stocks pour les restaurants. 
Problème: Les restaurateurs perdent de l'argent avec les périmés et les ruptures de stock.
Solution: Dashboard temps réel des stocks avec alertes automatiques et prédictions IA.
Cible: Restaurants indépendants (1-3 établissements) en France.
Features: 
- Scanner de produits avec code-barres
- Alertes de péremption
- Commandes fournisseurs automatisées
- Analytics et rapports
- Intégration caisse enregistreuse
Monétisation: 49€/mois par restaurant après 14 jours d'essai gratuit."`
            }
          })
        }
      }

      // ÉTAPE 2: Génération de la roadmap
      // Générer la roadmap avec Gemini 2.5 Flash
      const result = await model.generateContent(userInput)
      const responseText = result.response.text()
      
      // Extraire le JSON de la réponse
      let roadmapData
      try {
        // Essayer de parser directement
        roadmapData = JSON.parse(responseText)
      } catch (parseError) {
        // Si échec, chercher le JSON dans la réponse
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          roadmapData = JSON.parse(jsonMatch[0])
        } else {
          // Fallback sur la démo si parsing impossible
          console.error('Gemini parsing error:', responseText)
          return generateDemoResponse(user.id, project_name, project_description, budget, timeline, technical_level, supabase)
        }
      }

      // Formater et enrichir le résultat
      const formattedResult = {
        mvp_definition: {
          features: roadmapData.mvp_definition?.features || generateDefaultFeatures(project_description),
          excluded: roadmapData.mvp_definition?.excluded || [
            'Application mobile native',
            'Marketplace avancée',
            'IA/ML complexe',
            'Multi-langue',
            'White-label'
          ],
          duration: roadmapData.mvp_definition?.duration || calculateDuration(timeline)
        },
        tech_stack: {
          frontend: roadmapData.tech_stack?.frontend || selectFrontendStack(technical_level),
          backend: roadmapData.tech_stack?.backend || selectBackendStack(technical_level),
          database: roadmapData.tech_stack?.database || 'PostgreSQL (Supabase)',
          hosting: roadmapData.tech_stack?.hosting || selectHosting(budget),
          third_party: roadmapData.tech_stack?.third_party || ['Stripe', 'SendGrid', 'Sentry', 'Cloudinary']
        },
        roadmap: roadmapData.roadmap || generateDefaultRoadmap(project_name),
        launch_plan: roadmapData.launch_plan || generateDefaultLaunchPlan()
      }

      // Sauvegarder dans la DB
      await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'builder',
        title: `Roadmap pour ${project_name}`,
        input_data: { project_name, project_description, budget, timeline, technical_level },
        output_data: formattedResult,
        tokens_used: 0, // Gemini ne donne pas le compte de tokens facilement
      })

      return NextResponse.json({ 
        success: true, 
        result: formattedResult
      })

    } catch (geminiError: any) {
      console.error('Gemini API Error:', geminiError)
      
      // Gestion d'erreurs spécifiques
      if (geminiError.message?.includes('API key')) {
        return NextResponse.json({ 
          error: 'Clé API Gemini invalide. Vérifie ton .env.local' 
        }, { status: 400 })
      }
      
      if (geminiError.message?.includes('quota')) {
        return NextResponse.json({ 
          error: 'Quota Gemini dépassé (60 requêtes/min max). Réessaye dans quelques secondes.' 
        }, { status: 429 })
      }

      // Si le modèle 2.5 ne marche pas, essayer avec gemini-pro
      if (geminiError.message?.includes('models/gemini-2.5-flash')) {
        try {
          console.log('Fallback sur gemini-pro...')
          const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" })
          const result = await modelPro.generateContent(userInput)
          const responseText = result.response.text()
          
          let roadmapData
          try {
            roadmapData = JSON.parse(responseText)
          } catch (e) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              roadmapData = JSON.parse(jsonMatch[0])
            } else {
              return generateDemoResponse(user.id, project_name, project_description, budget, timeline, technical_level, supabase)
            }
          }

          const formattedResult = formatRoadmapResult(roadmapData, project_name, project_description, budget, timeline, technical_level)
          
          await supabase.from('conversations').insert({
            user_id: user.id,
            agent_type: 'builder',
            title: `Roadmap pour ${project_name}`,
            input_data: { project_name, project_description, budget, timeline, technical_level },
            output_data: formattedResult,
            tokens_used: 0,
          })

          return NextResponse.json({ 
            success: true, 
            result: formattedResult
          })
        } catch (fallbackError) {
          console.error('Fallback to gemini-pro also failed:', fallbackError)
          return generateDemoResponse(user.id, project_name, project_description, budget, timeline, technical_level, supabase)
        }
      }

      // Fallback sur la démo en cas d'erreur
      return generateDemoResponse(user.id, project_name, project_description, budget, timeline, technical_level, supabase)
    }

  } catch (error: any) {
    console.error('Builder API Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération de la roadmap' },
      { status: 500 }
    )
  }
}

// Fonction helper pour formater le résultat
function formatRoadmapResult(roadmapData: any, projectName: string, projectDescription: string, budget: string, timeline: string, technicalLevel: string) {
  return {
    mvp_definition: {
      features: roadmapData.mvp_definition?.features || generateDefaultFeatures(projectDescription),
      excluded: roadmapData.mvp_definition?.excluded || [
        'Application mobile native',
        'Marketplace avancée',
        'IA/ML complexe',
        'Multi-langue',
        'White-label'
      ],
      duration: roadmapData.mvp_definition?.duration || calculateDuration(timeline)
    },
    tech_stack: {
      frontend: roadmapData.tech_stack?.frontend || selectFrontendStack(technicalLevel),
      backend: roadmapData.tech_stack?.backend || selectBackendStack(technicalLevel),
      database: roadmapData.tech_stack?.database || 'PostgreSQL (Supabase)',
      hosting: roadmapData.tech_stack?.hosting || selectHosting(budget),
      third_party: roadmapData.tech_stack?.third_party || ['Stripe', 'SendGrid', 'Sentry', 'Cloudinary']
    },
    roadmap: roadmapData.roadmap || generateDefaultRoadmap(projectName),
    launch_plan: roadmapData.launch_plan || generateDefaultLaunchPlan()
  }
}

// Fonctions helper pour générer des valeurs par défaut intelligentes
function generateDefaultFeatures(description: string): string[] {
  const features = [
    'Authentication sécurisée et gestion des rôles',
    'Dashboard principal avec métriques temps réel'
  ]
  
  // Ajouter des features basées sur des mots-clés dans la description
  if (description.toLowerCase().includes('paiement') || description.toLowerCase().includes('abonnement')) {
    features.push('Système de paiement et facturation automatique')
  }
  if (description.toLowerCase().includes('api')) {
    features.push('API REST documentée avec webhooks')
  }
  if (description.toLowerCase().includes('analytics') || description.toLowerCase().includes('rapport')) {
    features.push('Analytics avancés et exports de données')
  }
  
  // Toujours ajouter une feature générique basée sur le projet
  features.push(`Fonctionnalité core: ${description.substring(0, 50)}...`)
  
  return features.slice(0, 5) // Maximum 5 features
}

function calculateDuration(timeline?: string): string {
  switch(timeline) {
    case '1-month': return '4 semaines en mode sprint intensif'
    case '2-months': return '8 semaines avec 1-2 développeurs'
    case '3-months': return '12 semaines avec méthodologie agile'
    case '6-months': return '24 semaines pour un produit complet'
    default: return '8 semaines pour un MVP standard'
  }
}

function selectFrontendStack(level?: string): string {
  switch(level) {
    case 'beginner': return 'Next.js + Tailwind CSS (learning curve douce)'
    case 'intermediate': return 'Next.js 14 + TypeScript + Tailwind + Shadcn UI'
    case 'expert': return 'Next.js 14 + TypeScript + Tailwind + Custom Design System'
    default: return 'Next.js 14 + TypeScript + Tailwind CSS'
  }
}

function selectBackendStack(level?: string): string {
  switch(level) {
    case 'beginner': return 'Next.js API Routes (tout intégré)'
    case 'intermediate': return 'Next.js API + Prisma ORM + tRPC'
    case 'expert': return 'Node.js + Express + TypeScript + GraphQL'
    default: return 'Next.js API Routes + Prisma'
  }
}

function selectHosting(budget?: string): string {
  switch(budget) {
    case '0-5k': return 'Vercel hobby + Supabase free (0€/mois)'
    case '5k-10k': return 'Vercel Pro + Supabase Pro (50€/mois)'
    case '10k-25k': return 'Vercel Pro + AWS RDS (150€/mois)'
    case '25k+': return 'AWS/GCP avec Kubernetes (300€+/mois)'
    default: return 'Vercel + Supabase'
  }
}

function generateDefaultRoadmap(projectName: string) {
  return {
    sprint_1: [
      'Architecture et setup environnement de développement',
      'Configuration Supabase (auth, database, storage)',
      'Modélisation des données et relations',
      'Design system et composants réutilisables',
      'CI/CD avec GitHub Actions'
    ],
    sprint_2: [
      `Développement de la feature principale: ${projectName}`,
      'CRUD complet avec validation',
      'API REST avec rate limiting',
      'Tests unitaires coverage >80%',
      'Intégration Stripe pour paiements'
    ],
    sprint_3: [
      'Optimisation performances (Core Web Vitals)',
      'PWA et responsive design',
      'Système de notifications',
      'Documentation utilisateur et API',
      'Tests E2E avec Playwright'
    ],
    sprint_4: [
      'Landing page avec A/B testing',
      'SEO technique et contenu',
      'Analytics et tracking',
      'Mise en production avec monitoring',
      'Plan de maintenance et backup'
    ]
  }
}

function generateDefaultLaunchPlan() {
  return {
    pre_launch: [
      'Beta privée avec 20-30 early adopters',
      'Content marketing (5 articles SEO)',
      'Séquence email onboarding (7 emails)',
      'Setup support client (Crisp/Intercom)',
      'Stress test et optimisation serveur'
    ],
    launch_day: [
      'Launch Product Hunt (00:01 PST)',
      'Annonces réseaux sociaux coordonnées',
      'Email à la liste d\'attente (>500 contacts)',
      'Activation campagnes Google/Meta Ads',
      'Monitoring live avec war room'
    ],
    post_launch: [
      'Réponse rapide feedbacks (< 2h)',
      'Hotfixes bugs critiques (< 24h)',
      'Analyse funnel conversion',
      'Optimisation onboarding (J+3)',
      'Roadmap V2 avec user feedback (J+7)'
    ],
    kpis: [
      'Conversion landing → trial (>5%)',
      'Activation D1 (>60%)',
      'Retention D7 (>40%)',
      'CAC < 100€',
      'NPS > 50',
      'MRR growth +30%/mois'
    ]
  }
}

// Fonction pour générer une réponse de démo (inchangée)
async function generateDemoResponse(
  userId: string, 
  projectName: string, 
  projectDescription: string, 
  budget: string,
  timeline: string,
  technicalLevel: string,
  supabase: any
) {
  const demoResult = {
    mvp_definition: {
      features: generateDefaultFeatures(projectDescription),
      excluded: [
        'Application mobile native',
        'Marketplace ou features sociales',
        'Intelligence artificielle avancée',
        'Support multi-langue',
        'White-label ou multi-tenancy'
      ],
      duration: calculateDuration(timeline)
    },
    tech_stack: {
      frontend: selectFrontendStack(technicalLevel),
      backend: selectBackendStack(technicalLevel),
      database: 'PostgreSQL avec Supabase',
      hosting: selectHosting(budget),
      third_party: ['Stripe', 'SendGrid', 'Cloudinary', 'Sentry', 'PostHog']
    },
    roadmap: generateDefaultRoadmap(projectName),
    launch_plan: generateDefaultLaunchPlan()
  }

  await supabase.from('conversations').insert({
    user_id: userId,
    agent_type: 'builder',
    title: `Roadmap pour ${projectName}`,
    input_data: { 
      project_name: projectName, 
      project_description: projectDescription, 
      budget, 
      timeline, 
      technical_level: technicalLevel 
    },
    output_data: demoResult,
    tokens_used: 0,
  })

  return NextResponse.json({ 
    success: true, 
    result: demoResult,
    demo: true 
  })
}