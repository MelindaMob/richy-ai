import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const BUILDER_SYSTEM = `Tu es l'agent Builder de Richy.ai. Tu crées des roadmaps de construction SaaS.

LIVRABLES OBLIGATOIRES:
1. MVP DÉFINITION
   - Features core (3-5 max)
   - Ce qui est exclu du MVP
   - Durée estimée

2. STACK TECHNIQUE
   - Frontend (avec justification)
   - Backend (avec justification)
   - Database
   - Hébergement
   - Services tiers

3. ROADMAP (4 sprints de 2 semaines)
   - Sprint 1: Fondations
   - Sprint 2: Core features
   - Sprint 3: Polish & tests
   - Sprint 4: Launch prep

4. PLAN DE LANCEMENT
   - Pré-lancement (actions)
   - Jour J
   - Post-lancement (7 jours)
   - KPIs à tracker

APPROCHE:
- No-code/Low-code privilégié selon le niveau technique
- Rapidité d'exécution
- Coûts minimaux
- Solutions pragmatiques

Retourne un JSON structuré avec tous les champs.`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { project_name, project_description, budget, timeline, technical_level } = await req.json()

    if (!project_name || !project_description) {
      return NextResponse.json({ error: 'Informations manquantes' }, { status: 400 })
    }

    // Demo response si pas de clé OpenAI
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('fake')) {
      const demoResult: any = {
        mvp_definition: {
          features: [
            'Authentication et gestion des utilisateurs',
            'Dashboard principal avec métriques clés',
            'Fonctionnalité core du SaaS (selon le projet)',
            'Système de paiement basique (Stripe)',
            'API REST pour intégrations futures'
          ],
          excluded: [
            'Application mobile native',
            'Intégrations complexes tierces',
            'Analytics avancés',
            'Fonctionnalités sociales',
            'Multi-langue'
          ],
          duration: '8 semaines avec 1 développeur'
        },
        tech_stack: {
          frontend: technical_level === 'beginner' ? 'Next.js + Tailwind (simple)' : 'Next.js 14 + TypeScript + Tailwind',
          backend: technical_level === 'beginner' ? 'Next.js API Routes' : 'Node.js + Express + TypeScript',
          database: 'PostgreSQL avec Supabase',
          hosting: 'Vercel (frontend) + Supabase (backend/DB)',
          third_party: ['Stripe', 'SendGrid', 'Cloudinary', 'Sentry']
        },
        roadmap: {
          sprint_1: [
            'Setup environnement de développement',
            'Configuration base de données et auth',
            'Création des pages principales',
            'Design system et composants UI de base',
            'CI/CD pipeline'
          ],
          sprint_2: [
            'Développement feature principale',
            'Dashboard utilisateur',
            'API endpoints essentiels',
            'Tests unitaires critiques',
            'Intégration paiement Stripe'
          ],
          sprint_3: [
            'Optimisation performances',
            'Responsive design complet',
            'Gestion des erreurs',
            'Documentation API',
            'Tests d\'intégration'
          ],
          sprint_4: [
            'Landing page marketing',
            'SEO optimisation',
            'Analytics setup',
            'Préparation production',
            'Tests finaux et bug fixes'
          ]
        },
        launch_plan: {
          pre_launch: [
            'Beta test avec 10-20 utilisateurs',
            'Créer le contenu marketing (blog, réseaux)',
            'Préparer l\'email de lancement',
            'Setup support client',
            'Vérifier la scalabilité'
          ],
          launch_day: [
            'Post sur Product Hunt',
            'Annonce sur LinkedIn/Twitter',
            'Email à la liste d\'attente',
            'Activer les campagnes Google Ads',
            'Monitoring temps réel'
          ],
          post_launch: [
            'Répondre aux feedbacks rapidement',
            'Corriger les bugs critiques en priorité',
            'Analyser les métriques d\'acquisition',
            'Itérer sur l\'onboarding',
            'Planifier les features v2'
          ],
          kpis: [
            'Taux de conversion visiteur → signup',
            'Taux d\'activation (signup → usage)',
            'Churn rate première semaine',
            'CAC (coût d\'acquisition)',
            'NPS score',
            'MRR growth'
          ]
        }
      }

      // Adapter selon le budget
      if (budget === '0-5k') {
        demoResult.tech_stack.frontend = 'Next.js + Shadcn UI (gratuit)'
        demoResult.tech_stack.hosting = 'Vercel free tier + Supabase free'
      }

      // Adapter selon la timeline
      if (timeline === '1-month') {
        demoResult.mvp_definition.duration = '4 semaines en mode intensif'
        demoResult.mvp_definition.features = demoResult.mvp_definition.features.slice(0, 3)
      }

      await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'builder',
        title: `Roadmap pour ${project_name}`,
        input_data: { project_name, project_description, budget, timeline, technical_level },
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
    const userInput = `
    Projet: ${project_name}
    Description: ${project_description}
    Budget: ${budget}
    Timeline: ${timeline}
    Niveau technique: ${technical_level}
    `

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: BUILDER_SYSTEM },
        { role: 'user', content: userInput }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2500,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    
    await supabase.from('conversations').insert({
      user_id: user.id,
      agent_type: 'builder',
      title: `Roadmap pour ${project_name}`,
      input_data: { project_name, project_description, budget, timeline, technical_level },
      output_data: result,
      tokens_used: completion.usage?.total_tokens || 0,
    })

    return NextResponse.json({ 
      success: true, 
      result 
    })
    */

  } catch (error: any) {
    console.error('Builder API Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération' },
      { status: 500 }
    )
  }
}