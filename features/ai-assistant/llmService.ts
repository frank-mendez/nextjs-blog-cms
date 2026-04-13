import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIMessage, GeneratedPostData, LLMProvider } from './types'

// ─── Types ───────────────────────────────────────────────────────────────────

type SendMessageParams = {
  model: string
  provider: LLMProvider
  messages: AIMessage[]
  bookSignedUrl: string
  apiKey: string
}

type GenerateBlogPostParams = {
  model: string
  messages: Pick<AIMessage, 'role' | 'content'>[]
  bookSignedUrl: string
  apiKey: string
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `You are an expert blog writing assistant. The user has uploaded a document and wants to create blog posts inspired by its content. Help the user explore ideas, discuss themes, and craft compelling blog content. Be conversational, insightful, and practical.`

const GENERATE_POST_PROMPT = `Based on the following conversation about the uploaded document, generate a complete, publish-ready blog post.

Return ONLY a valid JSON object with NO markdown formatting, NO code blocks, just raw JSON:
{
  "title": "Compelling blog post title",
  "meta_title": "SEO meta title (max 60 chars)",
  "meta_description": "SEO meta description (max 160 chars)",
  "excerpt": "2-3 sentence plain text summary",
  "content": "Full post content as HTML using <h2>, <p>, <ul>, <strong> tags",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "most appropriate category"
}

The post should be well-structured, SEO-friendly, and between 800-1500 words.`

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchPdfAsBase64(signedUrl: string): Promise<string> {
  const response = await fetch(signedUrl)
  if (!response.ok) throw new Error('Failed to fetch PDF')
  const buffer = await response.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

// ─── Claude streaming ─────────────────────────────────────────────────────────

async function* streamClaude(params: SendMessageParams): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: params.apiKey })

  const anthropicMessages: Anthropic.MessageParam[] = params.messages.map((msg, idx) => {
    if (idx === 0 && msg.role === 'user') {
      return {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'url', url: params.bookSignedUrl },
          } as Anthropic.DocumentBlockParam,
          { type: 'text', text: msg.content },
        ],
      }
    }
    return { role: msg.role, content: msg.content }
  })

  const stream = client.messages.stream({
    model: params.model,
    max_tokens: 4096,
    system: CHAT_SYSTEM_PROMPT,
    messages: anthropicMessages,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }
  }
}

// ─── Gemini streaming ─────────────────────────────────────────────────────────

async function* streamGemini(params: SendMessageParams): AsyncGenerator<string> {
  const genAI = new GoogleGenerativeAI(params.apiKey)
  const geminiModel = genAI.getGenerativeModel({
    model: params.model,
    systemInstruction: CHAT_SYSTEM_PROMPT,
  })

  const pdfBase64 = await fetchPdfAsBase64(params.bookSignedUrl)

  const contents = params.messages.map((msg, idx) => {
    if (idx === 0 && msg.role === 'user') {
      return {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
          { text: msg.content },
        ],
      }
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }
  })

  const result = await geminiModel.generateContentStream({ contents })
  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) yield text
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function sendMessage(params: SendMessageParams): AsyncGenerator<string> {
  if (params.provider === 'claude') return streamClaude(params)
  if (params.provider === 'gemini') return streamGemini(params)
  throw new Error(`Unsupported provider: ${params.provider}`)
}

export async function generateBlogPost(
  params: GenerateBlogPostParams
): Promise<GeneratedPostData> {
  const provider: LLMProvider = params.model.startsWith('gemini') ? 'gemini' : 'claude'

  const historyText = params.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const prompt = `${GENERATE_POST_PROMPT}\n\nConversation history:\n${historyText}`

  let rawJson: string

  if (provider === 'claude') {
    const client = new Anthropic({ apiKey: params.apiKey })
    const response = await client.messages.create({
      model: params.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'url', url: params.bookSignedUrl },
            } as Anthropic.DocumentBlockParam,
            { type: 'text', text: prompt },
          ],
        },
      ],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') throw new Error('No text in Claude response')
    rawJson = block.text
  } else {
    const genAI = new GoogleGenerativeAI(params.apiKey)
    const geminiModel = genAI.getGenerativeModel({ model: params.model })
    const pdfBase64 = await fetchPdfAsBase64(params.bookSignedUrl)

    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
            { text: prompt },
          ],
        },
      ],
    })
    rawJson = result.response.text()
  }

  const cleaned = rawJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    return JSON.parse(cleaned) as GeneratedPostData
  } catch {
    throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 200)}`)
  }
}

export type HeadlessGenerateParams = {
  topic: string
  context?: string
  tone: string
  wordCount: number
  model: string
  apiKey: string
}

export async function generateBlogPostHeadless(
  params: HeadlessGenerateParams
): Promise<GeneratedPostData> {
  const provider: LLMProvider = params.model.startsWith('gemini') ? 'gemini' : 'claude'

  const contextLine = params.context ? `Additional context:\n${params.context}\n\n` : ''

  const prompt = `Write a complete, SEO-optimized blog post about the following topic:

Topic: ${params.topic}

${contextLine}Tone: ${params.tone}
Target word count: ${params.wordCount} words

Return ONLY a valid JSON object with NO markdown, NO code blocks:
{
  "title": "Compelling blog post title",
  "meta_title": "SEO meta title (max 60 chars)",
  "meta_description": "SEO meta description (max 160 chars)",
  "excerpt": "2-3 sentence plain text summary",
  "content": "Full post content as HTML using <h2>, <p>, <ul>, <strong> tags. Minimum ${params.wordCount} words.",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "most appropriate category"
}`

  let rawJson: string

  if (provider === 'claude') {
    const client = new Anthropic({ apiKey: params.apiKey })
    const response = await client.messages.create({
      model: params.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') throw new Error('No text in Claude response')
    rawJson = block.text
  } else {
    const genAI = new GoogleGenerativeAI(params.apiKey)
    const geminiModel = genAI.getGenerativeModel({ model: params.model })
    const result = await geminiModel.generateContent(prompt)
    rawJson = result.response.text()
  }

  const cleaned = rawJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    return JSON.parse(cleaned) as GeneratedPostData
  } catch {
    throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 200)}`)
  }
}

export async function generateChatTitle(
  firstMessage: string,
  model: string,
  apiKey: string
): Promise<string> {
  const provider: LLMProvider = model.startsWith('gemini') ? 'gemini' : 'claude'
  const prompt = `Generate a 4-6 word title for a chat that starts with this message. Reply with ONLY the title, no punctuation:\n\n"${firstMessage}"`

  if (provider === 'claude') {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model,
      max_tokens: 32,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content.find((b) => b.type === 'text')
    return (block && block.type === 'text' ? block.text.trim() : 'New Chat')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const geminiModel = genAI.getGenerativeModel({ model })
  const result = await geminiModel.generateContent(prompt)
  return result.response.text().trim() || 'New Chat'
}

export async function validateProviderKey(
  provider: LLMProvider,
  apiKey: string
): Promise<boolean> {
  try {
    if (provider === 'claude') {
      const client = new Anthropic({ apiKey })
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      })
    } else {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      await model.generateContent('hi')
    }
    return true
  } catch {
    return false
  }
}
