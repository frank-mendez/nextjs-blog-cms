export type LLMProvider = 'claude' | 'gemini'

export type LLMModel = {
  id: string
  name: string
  provider: LLMProvider
  description: string
  free: boolean
}

export const AVAILABLE_MODELS: LLMModel[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet',
    provider: 'claude',
    description: 'Anthropic — Smart & fast',
    free: false,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku',
    provider: 'claude',
    description: 'Anthropic — Fastest',
    free: false,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Google — Best free option',
    free: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Google — Most capable',
    free: false,
  },
]

export type AIBook = {
  id: string
  user_id: string
  title: string
  file_name: string
  file_url: string   // storage path within 'ai-books' bucket
  file_size: number | null
  page_count: number | null
  created_at: string | null
  updated_at: string | null
}

export type AIChat = {
  id: string
  book_id: string
  user_id: string
  title: string
  llm_provider: LLMProvider
  llm_model: string
  created_at: string | null
  updated_at: string | null
  last_message_at: string | null
  book?: Pick<AIBook, 'id' | 'title' | 'file_name' | 'file_url'>
}

export type AIMessage = {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string | null
}

export type GeneratedPostData = {
  title: string
  meta_title: string
  meta_description: string
  excerpt: string
  content: string          // HTML
  tags: string[]
  category: string
}

export type LLMProviderKeyRecord = {
  provider: LLMProvider
  key_preview: string
  is_valid: boolean | null
  last_verified_at: string | null
}

export type ProviderStatus = {
  provider: LLMProvider
  configured: boolean
  is_valid: boolean | null
}
