import { generateText, gateway } from 'ai'
import { NextResponse } from 'next/server'
import { languages, languageName } from '@/lib/language'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.slice(0, 80_000) : ''
    const question = typeof body.question === 'string' ? body.question.slice(0, 600) : ''
    const clauses = Array.isArray(body.clauses) ? body.clauses.slice(0, 60) : []
    const requestedLanguage = languages.find(item => item.code === body.language)?.code ?? 'en'
    const answerLanguage = languageName(requestedLanguage)
    if (!text || !question) return NextResponse.json({ error: 'Terms and a question are required.' }, { status: 400 })
    const { text: answer } = await generateText({
      model: gateway('openai/gpt-4.1-mini'),
      system: `You are T&C Guardian, a plain-language explainer. Answer only from the provided Terms & Conditions text and supplied extracted clauses. Never infer outside facts or give legal advice. If the text does not answer the question, explicitly say that you could not find the answer in the shared terms. Keep answers concise and write the entire answer in ${answerLanguage}. When you rely on a provided extracted clause, end with its exact ID in the format [CLAUSE: clause-1]. Never invent or translate an ID.`,
      prompt: `TERMS TEXT:\n${text}\n\nEXTRACTED CLAUSES (JSON):\n${JSON.stringify(clauses)}\n\nUSER QUESTION:\n${question}`,
      maxOutputTokens: 450,
      abortSignal: AbortSignal.timeout(15_000),
    })
    const match = answer.match(/\[CLAUSE:\s*(clause-\d+)\]/)
    return NextResponse.json({ answer: answer.replace(/\s*\[CLAUSE:\s*clause-\d+\]/, '').trim(), clauseId: match?.[1] })
  } catch {
    return NextResponse.json({ error: 'Assistant is temporarily unavailable.' }, { status: 503 })
  }
}
