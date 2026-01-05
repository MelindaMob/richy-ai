import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardHeader } from './dashboard-header'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Vérifier l'authentification
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Récupérer le profil
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // SKIP LA VÉRIFICATION STRIPE POUR LE DEV
  // if (!profile?.stripe_customer_id) {
  //   redirect('/onboarding')
  // }

  // Calculer les jours restants d'essai
  let trialDaysLeft = 3
  if (profile?.trial_ends_at) {
    const trialEnd = new Date(profile.trial_ends_at)
    const now = new Date()
    trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  // Récupérer les stats
  const { data: conversations } = await supabase
    .from('conversations')
    .select('agent_type')
    .eq('user_id', user.id)

  const totalConversations = conversations?.length || 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft">
      {/* Header */}
      <DashboardHeader 
        trialDaysLeft={trialDaysLeft}
        userEmail={profile?.email || user.email}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Titre avec punchline Richy */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">
            Salut boss, t'as besoin de quoi aujourd'hui ?
          </h1>
          <p className="text-base md:text-xl text-gray-400">
            Prêt à valider et construire ton SaaS ? Choisis ton agent et let's go !
          </p>
        </div>

        {/* Agents Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Validator */}
          <Link href="/validator" className="group">
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8 hover:border-richy-gold/40 transition-all hover:scale-105 hover:shadow-xl hover:shadow-richy-gold/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-richy-gold">
                  🎯 Richy.validator
                </h3>
                <span className="text-richy-gold group-hover:translate-x-2 transition-transform text-2xl">
                  →
                </span>
              </div>
              <p className="text-gray-400">
                Analyse et valide ton SaaS. Score sur 100, potentiel économique, verdict cash. La vérité, rien que la vérité.
              </p>
              <div className="mt-4 text-sm text-gray-500">
                Analyse • Score • Verdict
              </div>
            </div>
          </Link>

          
          {/* Richy Chat */} 
          <Link href="/chat" className="group">
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8 hover:border-richy-gold/40 transition-all hover:scale-105 hover:shadow-xl hover:shadow-richy-gold/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-richy-gold">
                  💬 Richy.chat
                </h3>
                <span className="text-richy-gold group-hover:translate-x-2 transition-transform text-2xl">
                  →
                </span>
              </div>
              <p className="text-gray-400">
                Ton mentor IA sans filtre. Conseils marketing, mindset, stratégie. Pas de bullshit, que du concret.
              </p>
              <div className="mt-4 text-sm text-gray-500">
                Conseil • Stratégie • Mindset
              </div>
            </div>
          </Link>

         

          {/* Prompt */}
          <Link href="/prompt" className="group">
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8 hover:border-richy-gold/40 transition-all hover:scale-105 hover:shadow-xl hover:shadow-richy-gold/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-richy-gold">
                  ✨ Richy.prompt
                </h3>
                <span className="text-richy-gold group-hover:translate-x-2 transition-transform text-2xl">
                  →
                </span>
              </div>
              <p className="text-gray-400">
                Transforme ton idée en prompt pro pour créer ton SaaS avec l'IA. Compatible GPT-4, Claude, Gemini.
              </p>
              <div className="mt-4 text-sm text-gray-500">
                Prompts • IA • Génération
              </div>
            </div>
          </Link>

          {/* Builder */}
          <Link href="/builder" className="group">
            <div className="bg-richy-black-soft border border-richy-gold/20 rounded-xl p-8 hover:border-richy-gold/40 transition-all hover:scale-105 hover:shadow-xl hover:shadow-richy-gold/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-richy-gold">
                  🚀 Richy.builder
                </h3>
                <span className="text-richy-gold group-hover:translate-x-2 transition-transform text-2xl">
                  →
                </span>
              </div>
              <p className="text-gray-400">
                Roadmap complète pour construire ton SaaS. MVP, stack technique, planning sprint par sprint.
              </p>
              <div className="mt-4 text-sm text-gray-500">
                Roadmap • Planning • Stack
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="bg-richy-black-soft/50 rounded-2xl border border-gray-800 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">📊 Tes stats</h2>
            <Link 
              href="/history" 
              className="text-richy-gold hover:text-richy-gold-light transition-colors text-sm font-medium flex items-center gap-2"
            >
              Voir tout l'historique →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-400 text-sm mb-2">Conversations totales</p>
              <p className="text-3xl font-bold text-richy-gold">{totalConversations}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2">Agent préféré</p>
              <p className="text-3xl font-bold text-white">-</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2">Membre depuis</p>
              <p className="text-3xl font-bold text-white">
                {profile ? new Date(profile.created_at).toLocaleDateString('fr-FR') : 'Aujourd\'hui'}
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        {totalConversations === 0 && (
          <div className="mt-8 text-center bg-gradient-to-r from-richy-gold/10 to-richy-gold-dark/10 border border-richy-gold/30 rounded-xl p-8">
            <h3 className="text-2xl font-bold text-richy-gold mb-3">
              🔥 C'est le moment de commencer !
            </h3>
            <p className="text-gray-300 mb-6">
              Lance ton premier agent et transforme ton idée en réalité.
              <br />
              Je recommande de commencer par le <span className="text-richy-gold font-semibold">Validator</span> pour tester ton concept.
            </p>
            <Link 
              href="/validator" 
              className="inline-block bg-gradient-to-r from-richy-gold to-richy-gold-light text-richy-black font-bold py-3 px-8 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg"
            >
              Valider mon idée maintenant →
            </Link>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-richy-gold/20 bg-richy-black/50 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <h3 className="font-display text-2xl text-richy-gold mb-4">RICHY.AI</h3>
              <p className="text-gray-400 text-sm">
                Ton assistant IA pour valider et construire ton SaaS. Pas de bullshit, que du concret.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Liens utiles</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/privacy" className="text-gray-400 hover:text-richy-gold transition-colors text-sm">
                    Politique de confidentialité
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-gray-400 hover:text-richy-gold transition-colors text-sm">
                    Conditions générales de vente
                  </Link>
                </li>
                <li>
                  <Link href="/legal" className="text-gray-400 hover:text-richy-gold transition-colors text-sm">
                    Mentions légales
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <p className="text-gray-400 text-sm">
                <a href="mailto:support@richy.ai" className="hover:text-richy-gold transition-colors">
                  support@richy.ai
                </a>
              </p>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-8 pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-xs">
              © {new Date().getFullYear()} RICHY.AI - Tous droits réservés
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}