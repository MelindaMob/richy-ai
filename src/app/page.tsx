import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-richy-black to-richy-black-soft">
      <div className="container mx-auto px-4 py-20">
        <h1 className="font-display text-7xl text-richy-gold mb-4">
          RICHY.AI
        </h1>
        <p className="text-2xl mb-8">
          Ton assistant IA pour valider et construire ton SaaS
        </p>
        <div className="flex flex-col items-center gap-4">
          <Link href="/register">
            <Button>
              Commencer Gratuitement
            </Button>
          </Link>
          <p className="text-gray-400">
            Déjà membre ?{' '}
            <Link 
              href="/login" 
              className="text-richy-gold hover:text-richy-gold-light transition-colors font-medium"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}