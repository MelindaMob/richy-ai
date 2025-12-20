import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as cheerio from 'cheerio'

// Configuration Perplexity
const PERPLEXITY_API_URL = 'https://api.perplexity.ai'

// Fonction simplifiée pour scraper un site web
async function scrapeSiteContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      return null
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extraire juste les infos essentielles
    return {
      title: $('title').text() || '',
      description: $('meta[name="description"]').attr('content') || '',
      heroText: $('h1').first().text() || '',
      hasSSL: url.startsWith('https'),
      // Limiter le contenu pour éviter les messages trop longs
      snippet: $('main, article, .content')
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500) // Seulement 500 caractères
    }
  } catch (error) {
    console.error('Erreur de scraping:', error)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { url, description } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL requise' }, { status: 400 })
    }

    // Vérifier si on a une clé Perplexity
    if (!process.env.PERPLEXITY_API_KEY) {
      return generateDemoResponse(user.id, url, description, supabase)
    }

    try {
      // Scraper le site
      console.log('🕷️ Scraping du site...')
      const scrapedData = await scrapeSiteContent(url)
      
      // Construire un prompt COURT et PRÉCIS
      let userPrompt = `Analyse ce SaaS et donne ton verdict:
URL: ${url}
Description: ${description || 'SaaS à analyser'}`

      if (scrapedData) {
        userPrompt += `
Titre du site: ${scrapedData.title}
Description meta: ${scrapedData.description}
SSL: ${scrapedData.hasSSL ? 'Oui' : 'Non'}`
      }

      userPrompt += `

Fournis une analyse JSON avec:
- score (sur 100)
- verdict ("Gagnant 🏆" ou "À retravailler ⚠️" ou "Non rentable ❌")
- potential ("Faible", "Moyen", "Élevé", "Exceptionnel")
- market_analysis (analyse du marché en 2-3 phrases)
- target_audience (cible principale)
- strengths (3 forces, array)
- weaknesses (3 faiblesses, array)
- critical_points (2-3 points critiques, array)
- missing_features (features manquantes, array)
- technical_complexity ("Simple", "Modéré", "Complexe")
- recommendations (3 recommandations, array)`

      // Appel à Perplexity avec un prompt plus court
      console.log('📊 Analyse avec Perplexity...')
      const analysisResponse = await fetch(`${PERPLEXITY_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-reasoning-pro', // <- comme dans la doc
          messages: [
            {
              role: 'system',
              content: 'Tu es un expert en analyse de SaaS. Analyse et donne ton verdict de manière concise. Retourne UNIQUEMENT un JSON valide.'
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.7,
          // Ancienne valeur : max_tokens: 1500,
        max_tokens: 3000,
          return_citations: true
        })
      })

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text()
        console.error('Erreur Perplexity:', analysisResponse.status, errorText)
        throw new Error(`Perplexity API error: ${analysisResponse.status}`)
      }

      const analysisData = await analysisResponse.json()
      const analysisContent = analysisData.choices[0].message.content

      // ⭐ CORRECTION DU BLOC DE PARSING ICI
      let result
      try {
        // Tente de trouver le début et la fin du bloc JSON le plus à l'extérieur
        const startIndex = analysisContent.indexOf('{');
        const endIndex = analysisContent.lastIndexOf('}');

        if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
            throw new Error('Aucun bloc JSON valide trouvé.');
        }
        
        const cleanContent = analysisContent.substring(startIndex, endIndex + 1);
        result = JSON.parse(cleanContent)
        
      } catch (parseError) {
        console.error('❌ Erreur de parsing du JSON de l\'IA. Utilisation des valeurs par défaut.', parseError)
        console.error('Contenu brut de l\'IA (pour inspection):', analysisContent)
        
        // Utiliser des valeurs par défaut
        result = {
          score: 65,
          verdict: 'À retravailler ⚠️',
          potential: 'Moyen',
          market_analysis: 'Analyse non disponible (Erreur de format IA). Veuillez ré-essayer.',
          target_audience: 'À définir',
          strengths: ['Concept intéressant'],
          weaknesses: ['À améliorer'],
          critical_points: ['Plus de détails nécessaires'],
          missing_features: ['À identifier'],
          technical_complexity: 'Modéré',
          recommendations: ['Approfondir l\'analyse']
        }
      }

      // Formater le résultat final
      const formattedResult = {
        score: result.score || 50,
        verdict: result.verdict || 'À retravailler ⚠️',
        potential: result.potential || 'Moyen',
        market_analysis: result.market_analysis || 'Le marché des SaaS est en croissance constante.',
        target_audience: result.target_audience || 'Entreprises et startups',
        strengths: Array.isArray(result.strengths) ? result.strengths : ['À analyser'],
        weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : ['À analyser'],
        critical_points: Array.isArray(result.critical_points) ? result.critical_points : ['À analyser'],
        missing_features: Array.isArray(result.missing_features) ? result.missing_features : ['À analyser'],
        technical_complexity: result.technical_complexity || 'Modéré',
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : ['À définir'],
        sources: analysisData.citations || []
      }

      // Sauvegarder
      await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'validator',
        title: `Validation de ${url}`,
        input_data: { url, description },
        output_data: formattedResult,
        tokens_used: analysisData.usage?.total_tokens || 0,
      })

      return NextResponse.json({ 
        success: true, 
        result: formattedResult 
      })

    } catch (error: any) {
      console.error('Erreur complète:', error)
      return generateDemoResponse(user.id, url, description, supabase)
    }

  } catch (error: any) {
    console.error('Validator API Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse' },
      { status: 500 }
    )
  }
}

// Fonction de démo simplifiée
async function generateDemoResponse(userId: string, url: string, description: string, supabase: any) {
  const demoResult = {
    score: 72,
    verdict: 'À retravailler ⚠️',
    potential: 'Élevé',
    market_analysis: 'Le marché des SaaS B2B est en forte croissance avec une valorisation globale de 195 milliards de dollars. La niche ciblée montre un potentiel intéressant mais nécessite une différenciation claire.',
    target_audience: 'Startups et PME en phase de croissance (10-100 employés)',
    strengths: [
      'Concept innovant qui répond à un besoin réel',
      'Interface utilisateur moderne et intuitive',
      'Potentiel de scalabilité important'
    ],
    weaknesses: [
      'Proposition de valeur pas assez différenciée',
      'Manque de social proof et cas clients',
      'Stratégie de pricing à clarifier'
    ],
    critical_points: [
      'Ajouter une démo interactive sur la landing page',
      'Clarifier l\'USP dès le hero section'
    ],
    missing_features: [
      'Intégrations avec outils populaires (Slack, Notion)',
      'API publique pour développeurs',
      'Dashboard analytics'
    ],
    technical_complexity: 'Modéré',
    recommendations: [
      'Focus sur une niche ultra-spécifique avant d\'élargir',
      'Implémenter un freemium ou trial de 14 jours',
      'Créer du contenu SEO pour établir l\'autorité'
    ],
    sources: ['Mode démo - Configurez PERPLEXITY_API_KEY pour une analyse réelle']
  }

  await supabase.from('conversations').insert({
    user_id: userId,
    agent_type: 'validator',
    title: `Validation de ${url}`,
    input_data: { url, description },
    output_data: demoResult,
    tokens_used: 0,
  })

  return NextResponse.json({ 
    success: true, 
    result: demoResult,
    demo: true 
  })
}