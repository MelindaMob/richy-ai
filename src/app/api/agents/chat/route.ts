import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const RICHY_CHAT_PROMPT = `Tu es Richy Digital, expert marketing et mentor business sans filtre.

PERSONNALITÉ:
- Cash, direct, franc
- Motivant mais réaliste  
- Pas de bullshit, que de la valeur
- Humour noir et punchlines
- Style : "Faut se bouger", "Arrête de tourner autour du pot", "C'est pas ça qu'on veut"

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
- Pousser à l'action immédiate`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { message, history = [] } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 })
    }

    // Si pas de clé OpenAI, retourner une réponse de démo
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('fake')) {
      const demoResponses = [
        "Écoute champion, ton idée a du potentiel mais faut arrêter de réfléchir et commencer à AGIR. Lance un MVP cette semaine, teste avec 10 clients, et itère. C'est comme ça qu'on construit un empire, pas en restant dans sa tête !",
        "Ok, je vais être cash avec toi : si tu n'as pas encore testé ton idée avec de VRAIS clients, tu perds ton temps. Va parler à 20 personnes de ta cible AUJOURD'HUI. Pas demain. AUJOURD'HUI. Reviens me voir avec leurs retours.",
        "Tu veux mon conseil ? Arrête de chercher la perfection. Lance maintenant avec ce que tu as, même si c'est moche. Facebook était moche au début. Amazon vendait des livres. Start small, think big, move fast !",
        "Voilà ce que tu vas faire : 1) Définis UNE métrique qui compte vraiment. 2) Focus 100% dessus pendant 30 jours. 3) Ignore tout le reste. C'est ça la différence entre ceux qui réussissent et ceux qui papillonnent."
      ]

      const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)]

      // Sauvegarder dans la DB
      await supabase.from('conversations').insert({
        user_id: user.id,
        agent_type: 'chat',
        title: message.substring(0, 50),
        input_data: { message },
        output_data: { response: randomResponse },
        tokens_used: 0,
      })

      return NextResponse.json({ 
        success: true, 
        response: randomResponse,
        demo: true 
      })
    }

    // Appel réel à OpenAI (quand tu auras la clé)
    const messages = [
      { role: 'system' as const, content: RICHY_CHAT_PROMPT },
      ...history.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user' as const, content: message }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.8,
      max_tokens: 1000,
    })

    const response = completion.choices[0].message.content || ''

    await supabase.from('conversations').insert({
      user_id: user.id,
      agent_type: 'chat',
      title: message.substring(0, 50),
      input_data: { message },
      output_data: { response },
      tokens_used: completion.usage?.total_tokens || 0,
    })

    return NextResponse.json({ 
      success: true, 
      response 
    })

  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération de la réponse' },
      { status: 500 }
    )
  }
}