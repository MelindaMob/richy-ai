// lib/ai/prompt-ai.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function generatePrompt(userInput: string, systemPrompt: string) {
  const completion = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: userInput
    }],
    system: systemPrompt
  })
  
  return completion.content[0].type === 'text' 
    ? completion.content[0].text 
    : ''
}