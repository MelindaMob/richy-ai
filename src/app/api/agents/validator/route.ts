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

    return {
      title: $('title').text() || '',
      description: $('meta[name="description"]').attr('content') || '',
      heroText: $('h1').first().text() || '',
      hasSSL: url.startsWith('https'),
      snippet: $('main, article, .content')
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500)
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

    // Vérifier les limites d'usage
    const { checkUsageLimits } = await import('@/lib/check-limits')
    const limitCheck = await checkUsageLimits(user.id, 'validator')
    
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: limitCheck.message,
        reason: limitCheck.reason,
        showUpgrade: true
      }, { status: 403 })
    }

    const { url, description } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL requise' }, { status: 400 })
    }

    if (!process.env.PERPLEXITY_API_KEY) {
      return generateDemoResponse(user.id, url, description, supabase)
    }

    try {
      console.log('🕷️ Scraping du site...')
      const scrapedData = await scrapeSiteContent(url)
      
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

Fournis une analyse JSON avec strictement cette structure:
- score (sur 100)
- verdict ("Gagnant 🏆" ou "À retravailler ⚠️" ou "Non rentable ❌")
- potential ("Faible", "Moyen", "Élevé", "Exceptionnel")
- market_analysis (analyse du marché en 2-3 phrases)
- target_audience (cible principale)
- strengths (array)
- weaknesses (array)
- critical_points (array)
- missing_features (array)
- technical_complexity ("Simple", "Modéré", "Complexe")
- recommendations (array)`

      console.log('📊 Analyse avec Perplexity...')
      const analysisResponse = await fetch(`${PERPLEXITY_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-reasoning-pro',
          messages: [
            {
              role: 'system',
              content: `Tu es Richy, entrepreneur français style TikTok - cash mais bienveillant. 
              Utilise des expressions comme "Wesh", "C'est carré", "T'as capté ?".
              Tu analyses les SaaS sans filtre. 
              IMPORTANT: Tu dois répondre EXCLUSIVEMENT avec un objet JSON valide.`
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 3000,
          return_citations: true
        })
      })

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text()
        throw new Error(`Perplexity API error: ${analysisResponse.status}`)
      }

      const analysisData = await analysisResponse.json()
      const analysisContent = analysisData.choices[0].message.content

      let result
      try {
        // Nettoyer le contenu pour extraire le JSON
        let cleanedContent = analysisContent.trim()
        
        // Retirer les markdown code blocks si présents
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
        } else if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/i, '').replace(/\s*```$/g, '').trim()
        }
        
        // Extraire le JSON même s'il y a du texte avant/après
        const startIndex = cleanedContent.indexOf('{')
        const endIndex = cleanedContent.lastIndexOf('}')

        if (startIndex === -1 || endIndex === -1) {
          throw new Error('Aucun bloc JSON trouvé dans la réponse')
        }
        
        const jsonString = cleanedContent.substring(startIndex, endIndex + 1)
        result = JSON.parse(jsonString)
        
        console.log('✅ JSON parsé avec succès:', Object.keys(result))
        
      } catch (parseError: any) {
        console.error('❌ Erreur de parsing JSON IA:', parseError.message)
        console.error('Contenu reçu:', analysisContent.substring(0, 500))
        // Utiliser des valeurs par défaut avec des arrays non vides
        result = {
          score: 50,
          verdict: 'À retravailler ⚠️',
          potential: 'Moyen',
          market_analysis: 'Impossible d\'analyser automatiquement. Veuillez fournir plus de détails dans la description.',
          target_audience: 'À définir',
          strengths: ['Analyse en cours...'],
          weaknesses: ['Analyse en cours...'],
          critical_points: ['Analyse en cours...'],
          missing_features: ['Analyse en cours...'],
          technical_complexity: 'Modéré',
          recommendations: ['Réessayez avec une description plus détaillée']
        }
      }

      // Normaliser et s'assurer que tous les champs sont présents
      const formattedResult = {
        score: typeof result.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 50,
        verdict: result.verdict || 'À retravailler ⚠️',
        potential: result.potential || 'Moyen',
        market_analysis: result.market_analysis || 'Analyse indisponible. Veuillez fournir une description détaillée.',
        target_audience: result.target_audience || 'À définir',
        strengths: Array.isArray(result.strengths) && result.strengths.length > 0 
          ? result.strengths 
          : ['Analyse en cours...'],
        weaknesses: Array.isArray(result.weaknesses) && result.weaknesses.length > 0
          ? result.weaknesses
          : ['Analyse en cours...'],
        critical_points: Array.isArray(result.critical_points) && result.critical_points.length > 0
          ? result.critical_points
          : ['Analyse en cours...'],
        missing_features: Array.isArray(result.missing_features) && result.missing_features.length > 0
          ? result.missing_features
          : ['Analyse en cours...'],
        technical_complexity: result.technical_complexity || 'Modéré',
        recommendations: Array.isArray(result.recommendations) && result.recommendations.length > 0
          ? result.recommendations
          : ['Réessayez avec une description plus détaillée'],
        sources: analysisData.citations || []
      }
      
      console.log('📊 Résultat formaté:', {
        score: formattedResult.score,
        verdict: formattedResult.verdict,
        strengthsCount: formattedResult.strengths.length,
        weaknessesCount: formattedResult.weaknesses.length
      })

      await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'validator',
        title: `Validation de ${url}`,
        input_data: { url, description },
        output_data: formattedResult,
        tokens_used: analysisData.usage?.total_tokens || 0,
      })

      return NextResponse.json({ success: true, result: formattedResult })

    } catch (error: any) {
      console.error('Erreur complète:', error)
      return generateDemoResponse(user.id, url, description, supabase)
    }

  } catch (error: any) {
    console.error('Validator API Error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'analyse' }, { status: 500 })
  }
}

async function generateDemoResponse(userId: string, url: string, description: string, supabase: any) {
  const demoResult = {
    score: 72,
    verdict: 'À retravailler ⚠️',
    potential: 'Élevé',
    market_analysis: description 
      ? `Analyse basée sur votre description: ${description.substring(0, 200)}...`
      : 'Mode démo activé. Pour une analyse complète, configurez PERPLEXITY_API_KEY.',
    target_audience: description 
      ? 'Cible à identifier depuis la description'
      : 'Startups et entrepreneurs',
    strengths: [
      'Concept SaaS identifié',
      'URL accessible',
      description ? 'Description fournie' : 'Potentiel à évaluer'
    ],
    weaknesses: [
      'Analyse approfondie requise',
      'Données de marché à compléter',
      'Validation utilisateur nécessaire'
    ],
    critical_points: [
      'Configurer PERPLEXITY_API_KEY pour une analyse complète',
      'Fournir une description détaillée du SaaS',
      'Valider le marché cible'
    ],
    missing_features: [
      'Intégrations à définir',
      'Fonctionnalités core à identifier',
      'Roadmap à établir'
    ],
    technical_complexity: 'Modéré',
    recommendations: [
      'Configurez PERPLEXITY_API_KEY pour une analyse IA complète',
      'Fournissez une description détaillée incluant: cible, problème résolu, business model',
      'Utilisez Richy.builder pour créer une roadmap détaillée'
    ],
    sources: ['DEMO MODE']
  }

  await supabase.from('conversations').insert({
    user_id: userId,
    agent_type: 'validator',
    title: `Validation de ${url}`,
    input_data: { url, description },
    output_data: demoResult,
    tokens_used: 0,
  })

  return NextResponse.json({ success: true, result: demoResult, demo: true })
}
