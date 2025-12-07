import { createClient } from '@/lib/supabase/server'

export default async function TestDB() {
  const supabase = await createClient()
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')

  return (
    <div className="p-8 bg-richy-black min-h-screen text-white">
      <h1 className="text-3xl font-bold text-richy-gold mb-6">
        Test Connexion Supabase
      </h1>
      
      {error ? (
        <div className="bg-red-900/50 border border-red-500 p-4 rounded">
          <p className="text-red-400">❌ Erreur : {error.message}</p>
        </div>
      ) : (
        <div className="bg-green-900/50 border border-green-500 p-4 rounded">
          <p className="text-green-400">✅ Connexion réussie !</p>
          <p className="mt-2 text-sm">
            Nombre de profils : {profiles?.length || 0}
          </p>
        </div>
      )}
    </div>
  )
}