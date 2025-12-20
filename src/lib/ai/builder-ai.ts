// lib/ai/builder-ai.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) throw new Error('GEMINI_API_KEY is required')

const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

export async function generateRoadmap(projectData: any) {
  const prompt = `Génère une roadmap pour le projet suivant:
${JSON.stringify(projectData, null, 2)}`
  
  const result = await model.generateContent(prompt)
  return result.response.text()
}