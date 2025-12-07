import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// Prompt système pour l'agent Validator
const VALIDATOR_PROMPT = `Tu es l'agent Validator de Richy.ai. Ton rôle : analyser sans pitié les projets SaaS.

ANALYSE OBLIGATOIRE:
1. Score global /100
2. Potentiel économique (Faible/Moyen/Élevé/Exceptionnel)
3. Analyse marché et concurrence
4. Cible précise et taille du marché
5. Forces (3 minimum)
6. Faiblesses (3 minimum)
7. Points critiques à corriger
8. Fonctionnalités manquantes
9. Niveau complexité technique
10. Verdict final : "Gagnant 🏆" / "À retravailler ⚠️" / "Non rentable ❌"

CRITÈRES DE SCORING:
- Problème résolu (20 pts)
- Taille du marché (20 pts)
- Différenciation (15 pts)
- Monétisation claire (15 pts)
- Faisabilité technique (10 pts)
- UX/UI (10 pts)
- Go-to-market (10 pts)

STYLE:
- Brutal mais constructif
- Pas de complaisance
- Solutions concrètes
- Français direct

Retourne UNIQUEMENT un JSON structuré avec tous les champs demandés.`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }

    // Récupérer les données
    const { url, description } = await req.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL requise' },
        { status: 400 }
      )
    }

    // Pour le moment, on simule l'analyse (tu pourras ajouter le web scraping plus tard)
    // En production, tu utiliseras puppeteer ou playwright pour scraper le site
    
    const userInput = `
    URL du SaaS : ${url}
    Description : ${description || 'Non fournie'}
    
    Analyse ce SaaS et donne-moi ton verdict complet.
    `

    // Appel à OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: VALIDATOR_PROMPT },
        { role: 'user', content: userInput }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    // Formater le résultat pour s'assurer qu'on a tous les champs
    const formattedResult = {
      score: result.score || 50,
      verdict: result.verdict || 'À retravailler ⚠️',
      potential: result.potential || 'Moyen',
      market_analysis: result.market_analysis || 'Analyse non disponible',
      target_audience: result.target_audience || 'Non définie',
      strengths: result.strengths || ['Point fort 1', 'Point fort 2', 'Point fort 3'],
      weaknesses: result.weaknesses || ['Point faible 1', 'Point faible 2', 'Point faible 3'],
      critical_points: result.critical_points || ['Point critique 1', 'Point critique 2'],
      missing_features: result.missing_features || ['Feature 1', 'Feature 2'],
      technical_complexity: result.technical_complexity || 'Modéré',
      recommendations: result.recommendations || ['Recommandation 1', 'Recommandation 2', 'Recommandation 3']
    }

    // Sauvegarder dans la base de données
    await supabase.from('conversations').insert({
      user_id: user.id,
      agent_type: 'validator',
      title: `Validation de ${url}`,
      input_data: { url, description },
      output_data: formattedResult,
      tokens_used: completion.usage?.total_tokens || 0,
    })

    return NextResponse.json({ 
      success: true, 
      result: formattedResult 
    })

  } catch (error: any) {
    console.error('Validator API Error:', error)
    
    // Si pas de clé OpenAI, retourner une analyse de démo
    if (error.message?.includes('API key')) {
      const demoResult = {
        score: 72,
        verdict: 'À retravailler ⚠️',
        potential: 'Élevé',
        market_analysis: 'Le marché des SaaS est en pleine croissance. Ton concept a du potentiel mais nécessite des ajustements pour vraiment percer. La concurrence est présente mais tu peux te différencier.',
        target_audience: 'Entrepreneurs et startups tech cherchant à automatiser leurs processus',
        strengths: [
          'Concept innovant qui répond à un vrai besoin',
          'Interface utilisateur claire et moderne',
          'Bon potentiel de scalabilité'
        ],
        weaknesses: [
          'Proposition de valeur pas assez différenciée',
          'Manque de social proof et de cas clients',
          'Pricing strategy à retravailler'
        ],
        critical_points: [
          'Ajouter une démo interactive sur la landing page',
          'Clarifier l\'USP (Unique Selling Proposition) dès le hero'
        ],
        missing_features: [
          'Intégrations avec les outils populaires (Slack, Notion, etc.)',
          'API publique pour les développeurs',
          'Dashboard analytics plus poussé'
        ],
        technical_complexity: 'Modéré',
        recommendations: [
          'Focus sur une niche spécifique avant de scaler',
          'Implémenter un freemium ou trial de 14 jours minimum',
          'Créer du contenu pour établir ton autorité dans le domaine'
        ]
      }

      return NextResponse.json({ 
        success: true, 
        result: demoResult,
        demo: true 
      })
    }

    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse' },
      { status: 500 }
    )
  }
}