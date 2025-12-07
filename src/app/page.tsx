import { Button } from '@/components/ui/button'

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
        <Button>
          Commencer Gratuitement
        </Button>
      </div>
    </main>
  )
}