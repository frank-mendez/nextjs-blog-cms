// features/ai-assistant/llmService.ts
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import type { AIMessage, GeneratedPostData, LLMProvider } from './types'
import { AVAILABLE_MODELS } from './types'

// ─── Types ───────────────────────────────────────────────────────────────────

type SendMessageParams = {
  model: string
  provider: LLMProvider
  messages: AIMessage[]
  extractedText: string
  apiKey: string
}

type GenerateBlogPostParams = {
  model: string
  messages: Pick<AIMessage, 'role' | 'content'>[]
  extractedText: string
  apiKey: string
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

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

// ─── System Prompt Builder ────────────────────────────────────────────────────

export function buildSystemPrompt(extractedText: string, modelId: string): string {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId)
  const contextWindow = model?.contextWindow ?? 128000
  const reservedTokens = 8000
  const availableTokens = contextWindow - reservedTokens
  const maxChars = availableTokens * 4 // ~4 chars per token

  const truncated = extractedText.length > maxChars
  const text = truncated
    ? extractedText.slice(0, maxChars) +
      '\n\n[Book text truncated to fit model context window.]'
    : extractedText

  return `You are an expert blog writing assistant. The user has uploaded a book or document and wants to create blog posts inspired by its content.

Here is the full text of the uploaded document:
---
${text}
---

Help the user explore ideas, discuss themes, and craft compelling blog content based on this material. Be conversational, insightful, and practical.`
}

// ─── Claude streaming ─────────────────────────────────────────────────────────

async function* streamClaude(params: SendMessageParams): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: params.apiKey })

  const stream = client.messages.stream({
    model: params.model,
    max_tokens: 4096,
    system: buildSystemPrompt(params.extractedText, params.model),
    messages: params.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
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

// ─── OpenAI streaming ─────────────────────────────────────────────────────────

async function* streamOpenAI(params: SendMessageParams): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey: params.apiKey })

  const stream = await client.chat.completions.create({
    model: params.model,
    stream: true,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(params.extractedText, params.model),
      },
      ...params.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ],
    max_tokens: 4096,
    temperature: 0.7,
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    if (delta) yield delta
  }
}

// ─── Gemini streaming ─────────────────────────────────────────────────────────

async function* streamGemini(params: SendMessageParams): AsyncGenerator<string> {
  const genAI = new GoogleGenerativeAI(params.apiKey)
  const geminiModel = genAI.getGenerativeModel({
    model: params.model,
    systemInstruction: buildSystemPrompt(params.extractedText, params.model),
  })

  const contents = params.messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }))

  const result = await geminiModel.generateContentStream({ contents })
  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) yield text
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function sendMessage(params: SendMessageParams): AsyncGenerator<string> {
  if (params.provider === 'claude') return streamClaude(params)
  if (params.provider === 'openai') return streamOpenAI(params)
  if (params.provider === 'gemini') return streamGemini(params)
  throw new Error(`Unsupported provider: ${params.provider}`)
}

export async function generateBlogPost(
  params: GenerateBlogPostParams
): Promise<GeneratedPostData> {
  const provider: LLMProvider = params.model.startsWith('gemini')
    ? 'gemini'
    : params.model.startsWith('gpt')
      ? 'openai'
      : 'claude'

  const historyText = params.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const systemPrompt = buildSystemPrompt(params.extractedText, params.model)
  const prompt = `${GENERATE_POST_PROMPT}\n\nConversation history:\n${historyText}`

  let rawJson: string

  if (provider === 'claude') {
    const client = new Anthropic({ apiKey: params.apiKey })
    const response = await client.messages.create({
      model: params.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') throw new Error('No text in Claude response')
    rawJson = block.text
  } else if (provider === 'openai') {
    const client = new OpenAI({ apiKey: params.apiKey })
    const response = await client.chat.completions.create({
      model: params.model,
      stream: false,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a blog post generator. Always respond with valid JSON.' },
        { role: 'user', content: `${systemPrompt}\n\n${prompt}` },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    })
    rawJson = response.choices[0].message.content ?? '{}'
    // OpenAI json_object mode guarantees valid JSON — return directly
    try {
      return JSON.parse(rawJson) as GeneratedPostData
    } catch {
      throw new Error(`LLM returned invalid JSON: ${rawJson.slice(0, 200)}`)
    }
  } else {
    const genAI = new GoogleGenerativeAI(params.apiKey)
    const geminiModel = genAI.getGenerativeModel({
      model: params.model,
      systemInstruction: systemPrompt,
    })
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

export type HeadlessGenerateParams = {
  topic: string
  context?: string
  tone: string
  wordCount: number
  model: string
  provider: LLMProvider
  apiKey: string
}

export async function generateBlogPostHeadless(
  params: HeadlessGenerateParams
): Promise<GeneratedPostData> {
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

  if (params.provider === 'claude') {
    const client = new Anthropic({ apiKey: params.apiKey })
    const response = await client.messages.create({
      model: params.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') throw new Error('No text in Claude response')
    rawJson = block.text
  } else if (params.provider === 'openai') {
    const client = new OpenAI({ apiKey: params.apiKey })
    const response = await client.chat.completions.create({
      model: params.model,
      stream: false,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a blog post generator. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    })
    rawJson = response.choices[0].message.content ?? '{}'
    try {
      return JSON.parse(rawJson) as GeneratedPostData
    } catch {
      throw new Error(`LLM returned invalid JSON: ${rawJson.slice(0, 200)}`)
    }
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
  const prompt = `Generate a 4-6 word title for a chat that starts with this message. Reply with ONLY the title, no punctuation:\n\n"${firstMessage}"`

  if (model.startsWith('gpt')) {
    const client = new OpenAI({ apiKey })
    const response = await client.chat.completions.create({
      model,
      max_tokens: 32,
      messages: [{ role: 'user', content: prompt }],
    })
    return response.choices[0].message.content?.trim() || 'New Chat'
  }

  if (model.startsWith('gemini')) {
    const genAI = new GoogleGenerativeAI(apiKey)
    const geminiModel = genAI.getGenerativeModel({ model })
    const result = await geminiModel.generateContent(prompt)
    return result.response.text().trim() || 'New Chat'
  }

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model,
    max_tokens: 32,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content.find((b) => b.type === 'text')
  return (block && block.type === 'text' ? block.text.trim() : 'New Chat')
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
    } else if (provider === 'openai') {
      const client = new OpenAI({ apiKey })
      await client.chat.completions.create({
        model: 'gpt-4o-mini',
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
