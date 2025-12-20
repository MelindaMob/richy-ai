import { GoogleGenerativeAI } from '@google/generative-ai'

// Ta clé API
const genAI = new GoogleGenerativeAI('AIzaSyB6KdVsZbhJyrSQCXD3YLFRHsaCGMGkMl8')

async function test() {
  try {
    console.log("🔧 Test Gemini avec la bonne config...")
    
    // ⭐ CORRECTION: Utilisation du nom de modèle stable et complet 'gemini-2.5-flash'
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash" 
    })
    
    console.log(`🚀 Tentative avec le modèle: ${model.model}`)
    
    const result = await model.generateContent("Dis simplement 'Bonjour, Gemini fonctionne!'")
    const response = result.response
    const text = response.text()
    
    console.log("✅ Succès! Réponse:", text)
  } catch (error: any) {
    console.error("❌ Erreur complète:", error)
    
    // Si gemini-2.5-flash ne marche pas, essaye avec gemini-2.5-pro
    try {
      console.log("\n🔄 Réessai avec gemini-2.5-pro...")
      // ⭐ CORRECTION: Utilisation du nom de modèle stable 'gemini-2.5-pro'
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-pro" 
      })
      
      const result = await model.generateContent("Dis 'Bonjour'")
      console.log("✅ Succès avec gemini-2.5-pro:", result.response.text())
    } catch (error2: any) {
      const errorMessage = error2.message || 'Erreur inconnue lors du réessai.';
      console.error("❌ Échec aussi avec gemini-2.5-pro:", errorMessage)
    }
  }
}

test()