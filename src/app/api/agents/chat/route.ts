import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

// Initialiser Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!
})

const RICHY_CHAT_PROMPT = `Tu es Richy, entrepreneur qui a monté plusieurs boîtes. Tu parles comme un entrepreneur français sur TikTok - moderne, cash mais bienveillant.

COMMENT TU COMMENCES :
- "Bah écoute boss..."
- "Alors déjà..."
- "Ok les gars..."
- "Franchement..."
- "Wesh alors..."

TES EXPRESSIONS :
- "de ouf" (incroyable)
- "c'est chaud" (c'est difficile/impressionnant)
- "ça passe de fou" (c'est facile)
- "en mode" (comme)
- "genre" (pour exemplifier)
- "littéralement" (vraiment)
- "sur ma vie" (je te jure)
- "t'as capté ?" (tu comprends ?)
- "c'est carré" (c'est bon)
- "jsuis là pour..." (dire que c'est pas ton but)

STRUCTURE DE TES RÉPONSES :
1. Réaction directe (3-5 mots)
2. Contexte/Story ("L'autre jour j'ai vu...")
3. Point principal ("Le truc c'est que...")
4. Action concrète ("Du coup tu fais ça...")
5. Motivation finale ("Allez, fonce !")

TU NE DIS JAMAIS :
- "En effet", "Néanmoins", "Par conséquent"
- Phrases de plus de 15 mots
- Langage trop formel ou corporate

EXEMPLE TYPE :
"Wesh ! 

Alors ton idée elle est pas mal du tout. Mais y'a un problème.

Tu veux attaquer trop large. C'est mort ça marche jamais.

PERSONNALITÉ:
- Cash, direct, franc
- Motivant mais réaliste  
- Pas de bullshit, que de la valeur
- Humour noir et punchlines
- Style : "Bouge toi frr", "Arrête de tourner autour du pot", "C'est pas ça qu'on veut"

TON RÔLE:
- Conseiller en stratégie marketing
- Expert acquisition et branding
- Mentor mindset entrepreneur
- Dire la vérité, pas ce que l'utilisateur veut entendre

EXPERTISE:
- Growth hacking
- Personal branding
- Stratégie SaaS
- Acquisition client
- Monétisation

TOUJOURS:
- Donner des conseils actionnables
- Parler en français
- Utiliser des exemples concrets
- Challenger les idées faibles
- Pousser à l'action immédiate

PHRASES TYPIQUES:
- "Écoute champion..."
- "Soyons cash..."
- "Tu veux la vérité ?"
- "Arrête de procrastiner"
- "Action, action, action !"
- "Le marché s'en fout de tes excuses"`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier les limites d'usage
    const { checkUsageLimits } = await import('@/lib/check-limits')
    const limitCheck = await checkUsageLimits(user.id, 'chat')
    
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: limitCheck.message,
        reason: limitCheck.reason,
        showUpgrade: true
      }, { status: 403 })
    }

    const { message, history = [], thread_id } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 })
    }

    // Si pas de clé Groq, utiliser la démo
    if (!process.env.GROQ_API_KEY) {
      const demoResponses = [
        "Écoute champion, ton idée a du potentiel mais faut arrêter de réfléchir et commencer à AGIR. Lance un MVP cette semaine, teste avec 10 clients, et itère. C'est comme ça qu'on construit un empire, pas en restant dans sa tête ! 🚀",
        "Ok, je vais être cash avec toi : si tu n'as pas encore testé ton idée avec de VRAIS clients, tu perds ton temps. Va parler à 20 personnes de ta cible AUJOURD'HUI. Pas demain. AUJOURD'HUI. Reviens me voir avec leurs retours. 💪",
        "Tu veux mon conseil ? Arrête de chercher la perfection. Lance maintenant avec ce que tu as, même si c'est moche. Facebook était moche au début. Amazon vendait des livres. Start small, think big, move fast ! 🔥",
        "Voilà ce que tu vas faire : 1) Définis UNE métrique qui compte vraiment. 2) Focus 100% dessus pendant 30 jours. 3) Ignore tout le reste. C'est ça la différence entre ceux qui réussissent et ceux qui papillonnent. Action ! 🎯"
      ]

      const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)]

      // Générer un thread_id si pas fourni
      const currentThreadId = thread_id || crypto.randomUUID()

      await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'chat',
        title: message.substring(0, 50),
        input_data: { message },
        output_data: { response: randomResponse },
        tokens_used: 0,
        thread_id: currentThreadId
      })

      return NextResponse.json({ 
        success: true, 
        response: randomResponse,
        demo: true,
        remaining: limitCheck.remaining,
        isLimited: limitCheck.isLimited
      })
    }

    try {
      // Préparer les messages pour Groq
      const messages = [
        { role: 'system' as const, content: RICHY_CHAT_PROMPT },
        // Ajouter l'historique (limité aux 10 derniers pour économiser les tokens)
        ...history.slice(-10).map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user' as const, content: message }
      ]

      // Appel à Groq avec le modèle Moonshot (supporté)
      const completion = await groq.chat.completions.create({
        model: 'moonshotai/kimi-k2-instruct-0905', // Modèle Moonshot
        messages: messages,
        temperature: 0.9, // Plus créatif pour Richy
        max_tokens: 1000,
        top_p: 0.9,
        stream: false
      })

      const rawResponse = completion.choices[0]?.message?.content
      
      if (!rawResponse || rawResponse.trim().length === 0) {
        console.error('❌ Réponse Groq vide ou invalide')
        throw new Error('Réponse vide de l\'IA')
      }

      const response = rawResponse.trim()

      console.log('✅ Réponse Groq reçue:', response.substring(0, 100) + '...')

      // Générer un thread_id si pas fourni
      const currentThreadId = thread_id || crypto.randomUUID()

      // Sauvegarder la conversation
      const { error: insertError } = await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'chat',
        title: message.substring(0, 50),
        input_data: { message, thread_id: currentThreadId },
        output_data: { response, thread_id: currentThreadId },
        tokens_used: completion.usage?.total_tokens || 0
      })

      if (insertError) {
        console.error('❌ Erreur sauvegarde conversation:', insertError)
        // Ne pas bloquer si la sauvegarde échoue
      }

      return NextResponse.json({ 
        success: true, 
        response,
        remaining: limitCheck.remaining,
        isLimited: limitCheck.isLimited
      })

    } catch (groqError: any) {
      console.error('Groq API Error:', groqError)
      
      // Message d'erreur stylé Richy
      let errorMessage = "Dsl chef, y'a un bug avec l'IA 🤬 "
      
      if (groqError.message?.includes('rate limit') || groqError.status === 429) {
        errorMessage += "Trop de messages d'un coup, attends 30 secondes et réessaye. Groq est gratuit mais limité à 30 messages/minute."
      } else if (groqError.message?.includes('API key') || groqError.status === 401) {
        errorMessage += "La clé API Groq n'est pas valide. Vérifie ton .env.local"
      } else if (groqError.message?.includes('model') || groqError.status === 404) {
        errorMessage += "Le modèle Groq n'est pas disponible. Réessaye plus tard."
      } else {
        errorMessage += "Réessaye dans quelques secondes, ça devrait revenir."
      }

      // En cas d'erreur Groq, retourner une réponse de fallback
      const fallbackResponse = "Écoute champion, j'ai un petit bug technique là. Réessaye dans 10 secondes, ça devrait passer. Si ça continue, dis-moi ce que tu voulais et je te réponds direct ! 💪"

      return NextResponse.json({ 
        success: true, 
        response: fallbackResponse,
        error: errorMessage,
        fallback: true,
        remaining: limitCheck.remaining
      })
    }

  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération de la réponse' },
      { status: 500 }
    )
  }
}