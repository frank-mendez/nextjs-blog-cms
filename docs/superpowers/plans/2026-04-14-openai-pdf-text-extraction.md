# OpenAI + PDF Text Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire OpenAI (GPT-4o, GPT-4o Mini) as a fully supported LLM provider, and replace PDF storage in Supabase with server-side text extraction so all LLMs receive plain text equally.

**Architecture:** PDFs are read as buffers on upload, text is extracted via `pdf-parse` server-side, and only the plain text is persisted in `ai_books.extracted_text`. The `bookSignedUrl` pattern is replaced throughout with an `extractedText` string. A `buildSystemPrompt(extractedText, modelId)` function handles per-model context window truncation.

**Tech Stack:** Next.js App Router, Supabase, `openai` SDK, `@anthropic-ai/sdk`, `@google/generative-ai`, `pdf-parse`, Vitest, TypeScript.

---

## File Structure

**New files:**
- `features/ai-assistant/pdfService.ts` — PDF buffer → plain text extraction, cleanup, truncation
- `supabase/migrations/20260414000000_update_ai_books_text_only.sql` — Drop file_url/file_size, add extracted_text/word_count/char_count; update ai_chats + llm_provider_keys constraints for 'openai'
- `__tests__/ai-assistant/pdfService.test.ts` — Unit tests for pdfService
- `__tests__/api/ai-assistant-books.test.ts` — API integration tests for POST /api/ai-assistant/books

**Modified files:**
- `features/ai-assistant/types.ts` — Add 'openai' to LLMProvider, add contextWindow to LLMModel, update AVAILABLE_MODELS, update AIBook type (remove file_url/file_size, add extracted_text/word_count/char_count)
- `features/ai-assistant/chatService.ts` — Update createBook params, update getChat book select, add getBookById
- `features/ai-assistant/llmKeyService.ts` — Add openai key lookup (env + DB)
- `features/ai-assistant/llmService.ts` — Add buildSystemPrompt, add streamOpenAI, add OpenAI in generateBlogPost/generateBlogPostHeadless/generateChatTitle/validateProviderKey; rename bookSignedUrl → extractedText everywhere
- `app/api/ai-assistant/books/route.ts` — Rewrite POST to extract text; remove storage upload
- `app/api/ai-assistant/chats/[chatId]/messages/route.ts` — Remove signed URL logic; fetch extracted_text via getBookById
- `app/api/ai-assistant/generate/route.ts` — Add 'openai' to PROVIDER_PRIORITY and DEFAULT_MODELS
- `components/ai-assistant/NewChatModal.tsx` — Add OpenAI to provider list; add 3-step upload progress; add post-upload summary card; show context window in model selector
- `components/ai-assistant/AISidebar.tsx` — Show word_count on book cards; remove file download links
- `__tests__/ai-assistant/llmService.test.ts` — Update to use extractedText instead of bookSignedUrl; add OpenAI tests

---

## Task 1: Install Required Packages

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install openai, pdf-parse, and types**

```bash
cd /home/frankmendez/Projects/nextjs-blog-cms
npm install openai pdf-parse
npm install --save-dev @types/pdf-parse
```

Expected: `package.json` now has `"openai"` and `"pdf-parse"` in dependencies and `"@types/pdf-parse"` in devDependencies. No install errors.

- [ ] **Step 2: Verify imports resolve**

```bash
node -e "require('openai'); require('pdf-parse'); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install openai and pdf-parse packages"
```

---

## Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/20260414000000_update_ai_books_text_only.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260414000000_update_ai_books_text_only.sql

-- ─── ai_books: drop storage columns, add text columns ────────────────────────

-- Add extracted_text with a default so existing rows don't violate NOT NULL
ALTER TABLE public.ai_books
  ADD COLUMN IF NOT EXISTS extracted_text TEXT NOT NULL DEFAULT '';

-- Remove the DEFAULT now that the column exists (new rows must supply the value)
ALTER TABLE public.ai_books
  ALTER COLUMN extracted_text DROP DEFAULT;

-- Drop storage columns
ALTER TABLE public.ai_books
  DROP COLUMN IF EXISTS file_url,
  DROP COLUMN IF EXISTS file_size;

-- Add computed columns for display / token estimation
ALTER TABLE public.ai_books
  ADD COLUMN IF NOT EXISTS word_count INTEGER GENERATED ALWAYS AS
    (array_length(string_to_array(trim(extracted_text), ' '), 1)) STORED;

ALTER TABLE public.ai_books
  ADD COLUMN IF NOT EXISTS char_count INTEGER GENERATED ALWAYS AS
    (char_length(extracted_text)) STORED;

-- ─── ai_chats: allow 'openai' as a provider ──────────────────────────────────

ALTER TABLE public.ai_chats
  DROP CONSTRAINT IF EXISTS ai_chats_llm_provider_check;

ALTER TABLE public.ai_chats
  ADD CONSTRAINT ai_chats_llm_provider_check
  CHECK (llm_provider IN ('claude', 'gemini', 'openai'));

-- ─── llm_provider_keys: allow 'openai' as a provider ─────────────────────────

ALTER TABLE public.llm_provider_keys
  DROP CONSTRAINT IF EXISTS llm_provider_keys_provider_check;

ALTER TABLE public.llm_provider_keys
  ADD CONSTRAINT llm_provider_keys_provider_check
  CHECK (provider IN ('claude', 'gemini', 'openai'));
```

- [ ] **Step 2: Apply migration in Supabase SQL editor**

Copy the contents of the file above and run it in the Supabase SQL editor.
Expected: No errors. Run this verification query:

```sql
SELECT column_name, data_type, is_generated
FROM information_schema.columns
WHERE table_name = 'ai_books'
ORDER BY ordinal_position;
```

Expected columns: `id`, `user_id`, `title`, `file_name`, `page_count`, `created_at`, `updated_at`, `extracted_text`, `word_count`, `char_count`.
Columns `file_url` and `file_size` must NOT appear.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260414000000_update_ai_books_text_only.sql
git commit -m "feat: migrate ai_books to text-only storage, add openai to provider constraints"
```

---

## Task 3: Update `types.ts`

**Files:**
- Modify: `features/ai-assistant/types.ts`

- [ ] **Step 1: Replace the entire file**

```ts
// features/ai-assistant/types.ts

export type LLMProvider = 'claude' | 'gemini' | 'openai'

export type LLMModel = {
  id: string
  name: string
  provider: LLMProvider
  description: string
  contextWindow: number
  free: boolean
}

export const AVAILABLE_MODELS: LLMModel[] = [
  // Claude — Anthropic
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'claude',
    description: 'Smart and fast — best for most articles',
    contextWindow: 200000,
    free: false,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'claude',
    description: 'Fastest Claude model',
    contextWindow: 200000,
    free: false,
  },

  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Most capable OpenAI model',
    contextWindow: 128000,
    free: false,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and cost-efficient',
    contextWindow: 128000,
    free: false,
  },

  // Gemini — Google
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Best free option — generous free tier',
    contextWindow: 1000000,
    free: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Most capable Gemini model',
    contextWindow: 2000000,
    free: false,
  },
]

export type AIBook = {
  id: string
  user_id: string
  title: string
  file_name: string
  page_count: number | null
  extracted_text: string
  word_count: number | null
  char_count: number | null
  created_at: string | null
  updated_at: string | null
}

export type AIChat = {
  id: string
  book_id: string | null
  user_id: string
  title: string
  llm_provider: LLMProvider
  llm_model: string
  created_at: string | null
  updated_at: string | null
  last_message_at: string | null
  book?: Pick<AIBook, 'id' | 'title' | 'file_name'>
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
  key_preview: string | null
  is_valid: boolean | null
  last_verified_at: string | null
}

export type ProviderStatus = {
  provider: LLMProvider
  configured: boolean
  is_valid: boolean | null
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: Errors will appear (referencing `file_url` in other files) — that's expected at this stage. Check that types.ts itself compiles cleanly by examining only its errors.

- [ ] **Step 3: Commit**

```bash
git add features/ai-assistant/types.ts
git commit -m "feat: add openai provider, contextWindow to LLMModel, text-only AIBook type"
```

---

## Task 4: Create `pdfService.ts` with Tests (TDD)

**Files:**
- Create: `__tests__/ai-assistant/pdfService.test.ts`
- Create: `features/ai-assistant/pdfService.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/ai-assistant/pdfService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

import pdfParse from 'pdf-parse'
const mockPdfParse = vi.mocked(pdfParse)

import { extractTextFromPdf } from '@/features/ai-assistant/pdfService'

describe('extractTextFromPdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns text, pageCount, wordCount, charCount, wasTruncated=false for normal PDF', async () => {
    mockPdfParse.mockResolvedValue({
      text: 'Hello world. This is a test document with some content.',
      numpages: 3,
      info: { Title: 'My PDF' },
      metadata: null,
      version: '1.10.100',
    })

    const buf = Buffer.from('fake-pdf-bytes')
    const result = await extractTextFromPdf(buf)

    expect(result.text).toContain('Hello world')
    expect(result.pageCount).toBe(3)
    expect(result.title).toBe('My PDF')
    expect(result.wordCount).toBeGreaterThan(0)
    expect(result.charCount).toBe(result.text.length)
    expect(result.wasTruncated).toBe(false)
  })

  it('returns null title when PDF metadata has no Title', async () => {
    mockPdfParse.mockResolvedValue({
      text: 'Some text.',
      numpages: 1,
      info: {},
      metadata: null,
      version: '1.10.100',
    })

    const result = await extractTextFromPdf(Buffer.from('fake'))
    expect(result.title).toBeNull()
  })

  it('sets wasTruncated=true and appends note when text exceeds 400,000 chars', async () => {
    const longText = 'a'.repeat(500000)
    mockPdfParse.mockResolvedValue({
      text: longText,
      numpages: 100,
      info: {},
      metadata: null,
      version: '1.10.100',
    })

    const result = await extractTextFromPdf(Buffer.from('fake'))
    expect(result.wasTruncated).toBe(true)
    expect(result.text.length).toBeLessThan(500000)
    expect(result.text).toContain('[Note: This document was truncated')
    expect(result.charCount).toBe(result.text.length)
  })

  it('collapses multiple blank lines into at most two newlines', async () => {
    mockPdfParse.mockResolvedValue({
      text: 'line one\n\n\n\n\n\nline two',
      numpages: 1,
      info: {},
      metadata: null,
      version: '1.10.100',
    })

    const result = await extractTextFromPdf(Buffer.from('fake'))
    expect(result.text).not.toMatch(/\n{3,}/)
    expect(result.text).toContain('line one')
    expect(result.text).toContain('line two')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/ai-assistant/pdfService.test.ts 2>&1 | tail -20
```

Expected: `FAIL` — module not found for `@/features/ai-assistant/pdfService`.

- [ ] **Step 3: Implement `pdfService.ts`**

```ts
// features/ai-assistant/pdfService.ts
import pdfParse from 'pdf-parse'

const MAX_CHARS = 400_000
const TRUNCATION_NOTE =
  '\n\n[Note: This document was truncated due to length. The above content covers the first portion of the book.]'

export type ExtractedPdfData = {
  text: string
  pageCount: number
  title: string | null
  wordCount: number
  charCount: number
  wasTruncated: boolean
}

function cleanText(raw: string): string {
  // Collapse 3+ consecutive newlines into exactly 2
  return raw.replace(/\n{3,}/g, '\n\n').trim()
}

export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractedPdfData> {
  const parsed = await pdfParse(buffer)

  let text = cleanText(parsed.text)
  let wasTruncated = false

  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + TRUNCATION_NOTE
    wasTruncated = true
  }

  const title = (parsed.info?.Title as string | undefined)?.trim() || null
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const charCount = text.length

  return {
    text,
    pageCount: parsed.numpages,
    title,
    wordCount,
    charCount,
    wasTruncated,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/ai-assistant/pdfService.test.ts 2>&1 | tail -20
```

Expected: `PASS  __tests__/ai-assistant/pdfService.test.ts` with 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add features/ai-assistant/pdfService.ts __tests__/ai-assistant/pdfService.test.ts
git commit -m "feat: add pdfService with text extraction, truncation, and cleanup"
```

---

## Task 5: Update `chatService.ts`

**Files:**
- Modify: `features/ai-assistant/chatService.ts`

- [ ] **Step 1: Rewrite the file**

```ts
// features/ai-assistant/chatService.ts
import { createClient } from '@/lib/supabase/server'
import type { AIBook, AIChat, AIMessage, LLMProvider } from './types'

// ─── Books ────────────────────────────────────────────────────────────────────

export async function createBook(data: {
  id?: string
  user_id: string
  title: string
  file_name: string
  page_count?: number
  extracted_text: string
}): Promise<AIBook> {
  const supabase = await createClient()
  const { data: book, error } = await supabase
    .from('ai_books')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return book as AIBook
}

export async function getBooks(userId: string): Promise<AIBook[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_books')
    .select('id, user_id, title, file_name, page_count, word_count, char_count, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIBook[]
}

export async function getBookById(bookId: string): Promise<AIBook | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_books')
    .select('*')
    .eq('id', bookId)
    .single()

  if (error) return null
  return data as AIBook
}

// ─── Chats ────────────────────────────────────────────────────────────────────

export async function createChat(data: {
  book_id: string
  user_id: string
  llm_provider: LLMProvider
  llm_model: string
}): Promise<AIChat> {
  const supabase = await createClient()
  const { data: chat, error } = await supabase
    .from('ai_chats')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return chat as AIChat
}

export async function getChats(userId: string): Promise<AIChat[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_chats')
    .select('*, book:ai_books(id, title, file_name)')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIChat[]
}

export async function getChatsByBook(bookId: string): Promise<AIChat[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_chats')
    .select('*, book:ai_books(id, title, file_name)')
    .eq('book_id', bookId)
    .order('last_message_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIChat[]
}

export async function getChat(chatId: string): Promise<AIChat | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_chats')
    .select('*, book:ai_books(id, title, file_name)')
    .eq('id', chatId)
    .single()

  if (error) return null
  return data as AIChat
}

export async function updateChatTitle(chatId: string, title: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ai_chats').update({ title }).eq('id', chatId)
}

export async function updateChatLastMessage(chatId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('ai_chats')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', chatId)
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(chatId: string): Promise<AIMessage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIMessage[]
}

export async function addMessage(data: {
  chat_id: string
  role: 'user' | 'assistant'
  content: string
}): Promise<AIMessage> {
  const supabase = await createClient()
  const { data: message, error } = await supabase
    .from('ai_messages')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return message as AIMessage
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep 'chatService' | head -20
```

Expected: No errors referencing chatService.ts. There may still be errors in other files (books route, messages route) since they haven't been updated yet.

- [ ] **Step 3: Commit**

```bash
git add features/ai-assistant/chatService.ts
git commit -m "feat: update chatService for text-only books (remove file_url, add getBookById)"
```

---

## Task 6: Update `llmKeyService.ts`

**Files:**
- Modify: `features/ai-assistant/llmKeyService.ts`

- [ ] **Step 1: Update the env key lookup to handle 'openai'**

Replace lines 22-28 in `features/ai-assistant/llmKeyService.ts`:

```ts
  const envKey =
    provider === 'claude'
      ? process.env.ANTHROPIC_API_KEY
      : provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.GOOGLE_GENERATIVE_AI_KEY
```

The complete updated file:

```ts
// features/ai-assistant/llmKeyService.ts
import { createServiceClient } from '@/lib/supabase/service'
import { decryptSecret } from '@/lib/encryption'
import type { LLMProvider } from '@/features/ai-assistant/types'

/**
 * Fetches the decrypted LLM API key for the given provider.
 * Checks DB first (any admin's key), falls back to ENV vars.
 */
export async function getDecryptedApiKey(provider: LLMProvider): Promise<string> {
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('llm_provider_keys')
    .select('encrypted_key')
    .eq('provider', provider)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (data?.encrypted_key) {
    return decryptSecret(data.encrypted_key)
  }

  const envKey =
    provider === 'claude'
      ? process.env.ANTHROPIC_API_KEY
      : provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.GOOGLE_GENERATIVE_AI_KEY

  if (envKey) return envKey

  throw new Error(
    `No API key configured for ${provider}. Add your key in Developer Settings.`
  )
}

/**
 * Fetches the decrypted LLM API key for a specific user and provider.
 * Returns null (instead of throwing) when no key is found.
 */
export async function getDecryptedApiKeyForUser(
  provider: LLMProvider,
  userId: string
): Promise<string | null> {
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('llm_provider_keys')
    .select('encrypted_key')
    .eq('provider', provider)
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error(`[llmKeyService] DB error fetching ${provider} key for user ${userId}:`, error.message)
    return null
  }

  if (data?.encrypted_key) {
    return decryptSecret(data.encrypted_key)
  }

  return null
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep 'llmKeyService' | head -10
```

Expected: No errors in llmKeyService.ts.

- [ ] **Step 3: Commit**

```bash
git add features/ai-assistant/llmKeyService.ts
git commit -m "feat: add openai key lookup to llmKeyService"
```

---

## Task 7: Rewrite `llmService.ts` (Tests First)

**Files:**
- Modify: `__tests__/ai-assistant/llmService.test.ts`
- Modify: `features/ai-assistant/llmService.ts`

- [ ] **Step 1: Rewrite the test file to match the new API**

```ts
// __tests__/ai-assistant/llmService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AVAILABLE_MODELS } from '@/features/ai-assistant/types'

// ─── AVAILABLE_MODELS ────────────────────────────────────────────────────────

describe('AVAILABLE_MODELS', () => {
  it('contains claude models', () => {
    const claude = AVAILABLE_MODELS.filter((m) => m.provider === 'claude')
    expect(claude.length).toBeGreaterThan(0)
  })

  it('contains openai models', () => {
    const openai = AVAILABLE_MODELS.filter((m) => m.provider === 'openai')
    expect(openai.length).toBeGreaterThan(0)
  })

  it('contains gemini models', () => {
    const gemini = AVAILABLE_MODELS.filter((m) => m.provider === 'gemini')
    expect(gemini.length).toBeGreaterThan(0)
  })

  it('each model has required fields including contextWindow', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toBeTruthy()
      expect(model.name).toBeTruthy()
      expect(model.provider).toMatch(/^(claude|gemini|openai)$/)
      expect(typeof model.free).toBe('boolean')
      expect(typeof model.contextWindow).toBe('number')
      expect(model.contextWindow).toBeGreaterThan(0)
    }
  })

  it('has at least one free model', () => {
    expect(AVAILABLE_MODELS.some((m) => m.free)).toBe(true)
  })
})

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('includes the full text when it fits within context window', async () => {
    const { buildSystemPrompt } = await import('@/features/ai-assistant/llmService')
    const text = 'This is the book content.'
    const prompt = buildSystemPrompt(text, 'gemini-1.5-flash')
    expect(prompt).toContain(text)
    expect(prompt).not.toContain('[Book text truncated')
  })

  it('truncates text and adds note when it exceeds model context window', async () => {
    const { buildSystemPrompt } = await import('@/features/ai-assistant/llmService')
    // gpt-4o has 128k context; 8k reserved = 120k available = 480k chars
    // Create text of 600k chars to force truncation
    const longText = 'x'.repeat(600000)
    const prompt = buildSystemPrompt(longText, 'gpt-4o')
    expect(prompt).toContain('[Book text truncated')
    expect(prompt.length).toBeLessThan(longText.length + 500)
  })

  it('does NOT truncate for Gemini 1.5 Flash (1M context window)', async () => {
    const { buildSystemPrompt } = await import('@/features/ai-assistant/llmService')
    // 600k chars / 4 = 150k tokens — fits in 1M context
    const text = 'y'.repeat(600000)
    const prompt = buildSystemPrompt(text, 'gemini-1.5-flash')
    expect(prompt).not.toContain('[Book text truncated')
  })
})

// ─── Shared mock for @anthropic-ai/sdk ───────────────────────────────────────

const mockAnthropicCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function () {
    return {
      messages: { create: mockAnthropicCreate },
    }
  }),
}))

// ─── Shared mock for openai ───────────────────────────────────────────────────

const mockOpenAICreate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn(function () {
    return {
      chat: {
        completions: {
          create: mockOpenAICreate,
        },
      },
    }
  }),
}))

// ─── generateChatTitle ────────────────────────────────────────────────────────

describe('generateChatTitle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a non-empty string from Claude response', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Key Themes in Atomic Habits' }],
    })

    const { generateChatTitle } = await import('@/features/ai-assistant/llmService')
    const title = await generateChatTitle(
      'What are the key themes of this book?',
      'claude-sonnet-4-6',
      'test-api-key'
    )
    expect(typeof title).toBe('string')
    expect(title.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string from OpenAI response', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'GPT Chat Title' } }],
    })

    const { generateChatTitle } = await import('@/features/ai-assistant/llmService')
    const title = await generateChatTitle(
      'Tell me about this book',
      'gpt-4o',
      'sk-openai-key'
    )
    expect(typeof title).toBe('string')
    expect(title.length).toBeGreaterThan(0)
  })
})

// ─── generateBlogPost ────────────────────────────────────────────────────────

describe('generateBlogPost', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses JSON response from Claude and returns all required fields', async () => {
    const mockPost = {
      title: 'Test Post',
      meta_title: 'Test SEO Title',
      meta_description: 'Test description',
      excerpt: 'Short summary.',
      content: '<p>Body content</p>',
      tags: ['tag1', 'tag2'],
      category: 'Technology',
    }

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(mockPost) }],
    })

    const { generateBlogPost } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPost({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'Write a post' }],
      extractedText: 'Book content here.',
      apiKey: 'test-key',
    })

    expect(result.title).toBe('Test Post')
    expect(result.meta_title).toBe('Test SEO Title')
    expect(result.tags).toEqual(['tag1', 'tag2'])
  })

  it('parses JSON from OpenAI using response_format json_object mode', async () => {
    const mockPost = {
      title: 'OpenAI Post',
      meta_title: 'OpenAI SEO',
      meta_description: 'OpenAI description',
      excerpt: 'OpenAI summary.',
      content: '<p>OpenAI body</p>',
      tags: ['openai'],
      category: 'AI',
    }

    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockPost) } }],
    })

    const { generateBlogPost } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPost({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Write a post' }],
      extractedText: 'Book content here.',
      apiKey: 'sk-openai-key',
    })

    expect(result.title).toBe('OpenAI Post')
    // OpenAI was called with response_format: json_object
    const callArgs = mockOpenAICreate.mock.calls[0][0]
    expect(callArgs.response_format).toEqual({ type: 'json_object' })
    expect(callArgs.stream).toBe(false)
  })

  it('strips markdown code fences from Claude response', async () => {
    const mockPost = {
      title: 'Fenced Post',
      meta_title: 'Fenced SEO Title',
      meta_description: 'Fenced description',
      excerpt: 'Fenced summary.',
      content: '<p>Fenced body</p>',
      tags: ['fenced'],
      category: 'Tech',
    }

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(mockPost)}\n\`\`\`` }],
    })

    const { generateBlogPost } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPost({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'Write a post' }],
      extractedText: 'Book content here.',
      apiKey: 'test-key',
    })

    expect(result.title).toBe('Fenced Post')
  })
})

// ─── generateBlogPostHeadless ─────────────────────────────────────────────────

describe('generateBlogPostHeadless', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls Claude without a document block and returns parsed JSON', async () => {
    const mockPost = {
      title: 'Headless Post',
      meta_title: 'Headless SEO Title',
      meta_description: 'Headless description',
      excerpt: 'Short headless summary.',
      content: '<p>Headless body</p>',
      tags: ['headless', 'cms'],
      category: 'Technology',
    }

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(mockPost) }],
    })

    const { generateBlogPostHeadless } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPostHeadless({
      topic: 'Headless CMS',
      tone: 'professional',
      wordCount: 800,
      model: 'claude-sonnet-4-6',
      provider: 'claude' as const,
      apiKey: 'test-key',
    })

    expect(result.title).toBe('Headless Post')
    // Plain string content, no document block
    const callArgs = mockAnthropicCreate.mock.calls[0][0]
    expect(typeof callArgs.messages[0].content).toBe('string')
  })

  it('calls OpenAI with response_format json_object for headless generation', async () => {
    const mockPost = {
      title: 'OpenAI Headless Post',
      meta_title: 'OpenAI Headless SEO',
      meta_description: 'OpenAI headless description',
      excerpt: 'OpenAI headless summary.',
      content: '<p>OpenAI headless body</p>',
      tags: ['openai'],
      category: 'AI',
    }

    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockPost) } }],
    })

    const { generateBlogPostHeadless } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPostHeadless({
      topic: 'OpenAI Headless',
      tone: 'casual',
      wordCount: 600,
      model: 'gpt-4o',
      provider: 'openai' as const,
      apiKey: 'sk-openai-key',
    })

    expect(result.title).toBe('OpenAI Headless Post')
    const callArgs = mockOpenAICreate.mock.calls[0][0]
    expect(callArgs.response_format).toEqual({ type: 'json_object' })
  })

  it('strips markdown code fences from Claude response', async () => {
    const mockPost = {
      title: 'Fenced Post',
      meta_title: '', meta_description: '', excerpt: '',
      content: '', tags: [], category: '',
    }

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(mockPost)}\n\`\`\`` }],
    })

    const { generateBlogPostHeadless } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPostHeadless({
      topic: 'Code fences',
      tone: 'casual',
      wordCount: 500,
      model: 'claude-sonnet-4-6',
      provider: 'claude' as const,
      apiKey: 'test-key',
    })

    expect(result.title).toBe('Fenced Post')
  })

  it('throws when LLM returns invalid JSON', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    })

    const { generateBlogPostHeadless } = await import('@/features/ai-assistant/llmService')

    await expect(
      generateBlogPostHeadless({
        topic: 'Bad response',
        tone: 'neutral',
        wordCount: 600,
        model: 'claude-sonnet-4-6',
        provider: 'claude' as const,
        apiKey: 'test-key',
      })
    ).rejects.toThrow('LLM returned invalid JSON')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (expected — llmService hasn't been updated yet)**

```bash
npx vitest run __tests__/ai-assistant/llmService.test.ts 2>&1 | tail -30
```

Expected: Multiple failures for `buildSystemPrompt` (not exported), `generateBlogPost` (bookSignedUrl vs extractedText), OpenAI tests.

- [ ] **Step 3: Rewrite `llmService.ts`**

```ts
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
```

- [ ] **Step 4: Run the llmService tests**

```bash
npx vitest run __tests__/ai-assistant/llmService.test.ts 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add features/ai-assistant/llmService.ts __tests__/ai-assistant/llmService.test.ts
git commit -m "feat: add OpenAI streaming/generation, buildSystemPrompt with context window truncation, replace bookSignedUrl with extractedText"
```

---

## Task 8: Update Books API Route (Tests First)

**Files:**
- Create: `__tests__/api/ai-assistant-books.test.ts`
- Modify: `app/api/ai-assistant/books/route.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/api/ai-assistant-books.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/features/ai-assistant/chatService', () => ({
  createBook: vi.fn(),
  getBooks: vi.fn(),
}))

vi.mock('@/features/ai-assistant/pdfService', () => ({
  extractTextFromPdf: vi.fn(),
}))

import { POST, GET } from '@/app/api/ai-assistant/books/route'
import { createClient } from '@/lib/supabase/server'
import { createBook, getBooks } from '@/features/ai-assistant/chatService'
import { extractTextFromPdf } from '@/features/ai-assistant/pdfService'

const mockCreateClient = vi.mocked(createClient)
const mockCreateBook = vi.mocked(createBook)
const mockGetBooks = vi.mocked(getBooks)
const mockExtractTextFromPdf = vi.mocked(extractTextFromPdf)

function makeAuthMock(userId = 'user-1') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
  }
}

function makePdfFile(name = 'book.pdf', sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes).fill(37) // 37 = '%' (PDF header starts with %)
  return new File([content], name, { type: 'application/pdf' })
}

function makeFormData(file: File, title?: string): FormData {
  const fd = new FormData()
  fd.append('file', file)
  if (title) fd.append('title', title)
  return fd
}

function makeRequest(formData: FormData): Request {
  return new Request('http://localhost/api/ai-assistant/books', {
    method: 'POST',
    body: formData,
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/ai-assistant/books', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const res = await POST(makeRequest(makeFormData(makePdfFile())) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no file provided', async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock() as unknown as Awaited<ReturnType<typeof createClient>>)

    const fd = new FormData()
    const res = await POST(makeRequest(fd) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/no file/i)
  })

  it('returns 400 when file is not a PDF', async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock() as unknown as Awaited<ReturnType<typeof createClient>>)

    const textFile = new File(['hello'], 'doc.txt', { type: 'text/plain' })
    const res = await POST(makeRequest(makeFormData(textFile)) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/pdf/i)
  })

  it('returns 400 when PDF is larger than 20MB', async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock() as unknown as Awaited<ReturnType<typeof createClient>>)

    const bigFile = makePdfFile('big.pdf', 21 * 1024 * 1024)
    const res = await POST(makeRequest(makeFormData(bigFile)) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/20MB/i)
  })

  it('returns 400 when extracted text is empty (image-only PDF)', async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock() as unknown as Awaited<ReturnType<typeof createClient>>)
    mockExtractTextFromPdf.mockResolvedValue({
      text: '   ',
      pageCount: 1,
      title: null,
      wordCount: 0,
      charCount: 0,
      wasTruncated: false,
    })

    const res = await POST(makeRequest(makeFormData(makePdfFile())) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/text-based/i)
  })

  it('returns 201 with word_count, char_count, page_count on valid upload', async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock() as unknown as Awaited<ReturnType<typeof createClient>>)
    mockExtractTextFromPdf.mockResolvedValue({
      text: 'This is extracted book content with many words.',
      pageCount: 12,
      title: 'My Book',
      wordCount: 8,
      charCount: 47,
      wasTruncated: false,
    })
    mockCreateBook.mockResolvedValue({
      id: 'book-1',
      user_id: 'user-1',
      title: 'My Book',
      file_name: 'book.pdf',
      page_count: 12,
      extracted_text: 'This is extracted book content with many words.',
      word_count: 8,
      char_count: 47,
      created_at: '2026-04-14T10:00:00Z',
      updated_at: '2026-04-14T10:00:00Z',
    })

    const res = await POST(makeRequest(makeFormData(makePdfFile())) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.word_count).toBe(8)
    expect(json.data.char_count).toBe(47)
    expect(json.data.page_count).toBe(12)
    expect(json.data).not.toHaveProperty('file_url')
  })

  it('uses title override from form data when provided', async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock() as unknown as Awaited<ReturnType<typeof createClient>>)
    mockExtractTextFromPdf.mockResolvedValue({
      text: 'Some book content here.',
      pageCount: 5,
      title: 'PDF Title',
      wordCount: 4,
      charCount: 23,
      wasTruncated: false,
    })
    mockCreateBook.mockResolvedValue({
      id: 'book-2',
      user_id: 'user-1',
      title: 'Custom Title',
      file_name: 'book.pdf',
      page_count: 5,
      extracted_text: 'Some book content here.',
      word_count: 4,
      char_count: 23,
      created_at: '2026-04-14T10:00:00Z',
      updated_at: '2026-04-14T10:00:00Z',
    })

    const fd = makeFormData(makePdfFile(), 'Custom Title')
    const res = await POST(makeRequest(fd) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(201)

    const callArgs = mockCreateBook.mock.calls[0][0]
    expect(callArgs.title).toBe('Custom Title')
  })
})

describe('GET /api/ai-assistant/books', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const req = new Request('http://localhost/api/ai-assistant/books')
    const res = await GET(req as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/api/ai-assistant-books.test.ts 2>&1 | tail -20
```

Expected: `FAIL` — the current books/route.ts doesn't use extractTextFromPdf.

- [ ] **Step 3: Rewrite `app/api/ai-assistant/books/route.ts`**

```ts
// app/api/ai-assistant/books/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBook, getBooks } from '@/features/ai-assistant/chatService'
import { extractTextFromPdf } from '@/features/ai-assistant/pdfService'

/**
 * POST /api/ai-assistant/books
 * Accepts multipart/form-data with a PDF file (max 20MB).
 * Extracts text server-side — the PDF file is NOT stored.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const titleOverride = formData.get('title') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'PDF too large. Maximum size is 20MB.' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let extracted
  try {
    extracted = await extractTextFromPdf(buffer)
  } catch (err) {
    console.error('[POST /api/ai-assistant/books] PDF extraction error:', err)
    return NextResponse.json(
      { error: 'Failed to parse PDF. Please ensure it is a valid PDF file.' },
      { status: 400 }
    )
  }

  if (!extracted.text.trim() || extracted.text.trim().length < 100) {
    return NextResponse.json(
      {
        error:
          'Could not extract text from this PDF. It may be a scanned image PDF. Please use a text-based PDF.',
      },
      { status: 400 }
    )
  }

  const safeFileName = file.name.replace(/[/\\?%*:|"<>\x00-\x1f]/g, '_')
  const title =
    titleOverride?.trim() ||
    extracted.title ||
    safeFileName.replace(/\.pdf$/i, '')

  const book = await createBook({
    user_id: user.id,
    title,
    file_name: safeFileName,
    page_count: extracted.pageCount,
    extracted_text: extracted.text,
  })

  return NextResponse.json(
    {
      success: true,
      data: {
        id: book.id,
        title: book.title,
        file_name: book.file_name,
        page_count: book.page_count,
        word_count: extracted.wordCount,
        char_count: extracted.charCount,
        was_truncated: extracted.wasTruncated,
        created_at: book.created_at,
      },
    },
    { status: 201 }
  )
}

/**
 * GET /api/ai-assistant/books
 * Returns all books for the current user.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const books = await getBooks(user.id)
  return NextResponse.json({ books })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/api/ai-assistant-books.test.ts 2>&1 | tail -20
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/ai-assistant/books/route.ts __tests__/api/ai-assistant-books.test.ts
git commit -m "feat: rewrite books route to extract PDF text on upload, no file storage"
```

---

## Task 9: Update Chat Messages Route

**Files:**
- Modify: `app/api/ai-assistant/chats/[chatId]/messages/route.ts`

- [ ] **Step 1: Rewrite the POST handler to use extractedText**

Replace `app/api/ai-assistant/chats/[chatId]/messages/route.ts` with:

```ts
// app/api/ai-assistant/chats/[chatId]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getMessages, addMessage, updateChatLastMessage, updateChatTitle, getChat, getBookById,
} from '@/features/ai-assistant/chatService'
import { sendMessage, generateChatTitle } from '@/features/ai-assistant/llmService'
import { getDecryptedApiKey } from '@/features/ai-assistant/llmKeyService'
import type { LLMProvider } from '@/features/ai-assistant/types'

type Params = { params: { chatId: string } }

/**
 * GET /api/ai-assistant/chats/[chatId]/messages
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { chatId } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chat = await getChat(chatId)
  if (!chat || chat.user_id !== user.id) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }

  const messages = await getMessages(chatId)
  return NextResponse.json({ messages })
}

/**
 * POST /api/ai-assistant/chats/[chatId]/messages
 * Body: { content: string }
 * Returns a streaming text/plain response (LLM reply chunks).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { chatId } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chat = await getChat(chatId)
  if (!chat || chat.user_id !== user.id) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }

  const { content } = await req.json() as { content?: string }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  // Save user message
  await addMessage({ chat_id: chatId, role: 'user', content: content.trim() })

  // Fetch full history (including the message just saved)
  const history = await getMessages(chatId)
  const isFirstMessage = history.filter((m) => m.role === 'user').length === 1

  // Get decrypted API key
  let apiKey: string
  try {
    apiKey = await getDecryptedApiKey(chat.llm_provider as LLMProvider)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No API key configured' },
      { status: 422 }
    )
  }

  // Fetch book's extracted text
  if (!chat.book_id) {
    return NextResponse.json({ error: 'Chat has no associated book' }, { status: 400 })
  }

  const book = await getBookById(chat.book_id)
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  // Stream the LLM response
  const llmStream = sendMessage({
    model: chat.llm_model,
    provider: chat.llm_provider as LLMProvider,
    messages: history,
    extractedText: book.extracted_text,
    apiKey,
  })

  let fullResponse = ''

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of llmStream) {
          fullResponse += chunk
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      } finally {
        // Save assistant message and update metadata (fire and forget)
        Promise.all([
          addMessage({ chat_id: chatId, role: 'assistant', content: fullResponse }),
          updateChatLastMessage(chatId),
          isFirstMessage
            ? generateChatTitle(content.trim(), chat.llm_model, apiKey)
                .then((title) => updateChatTitle(chatId, title))
                .catch(() => null)
            : Promise.resolve(),
        ]).catch(console.error)
      }
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep 'messages/route' | head -20
```

Expected: No errors in this file.

- [ ] **Step 3: Commit**

```bash
git add app/api/ai-assistant/chats/[chatId]/messages/route.ts
git commit -m "feat: update messages route to use book extracted_text instead of signed PDF URL"
```

---

## Task 10: Update Generate Route for OpenAI

**Files:**
- Modify: `app/api/ai-assistant/generate/route.ts`

- [ ] **Step 1: Update PROVIDER_PRIORITY and DEFAULT_MODELS**

In `app/api/ai-assistant/generate/route.ts`, replace lines 17-21:

```ts
const PROVIDER_PRIORITY: LLMProvider[] = ['claude', 'openai', 'gemini']

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro',
}
```

- [ ] **Step 2: Run existing generate tests**

```bash
npx vitest run __tests__/api/ai-generate.test.ts 2>&1 | tail -20
```

Expected: All existing tests still pass. The test that checks `llm_model: 'gpt-9000-unknown'` should still return 422 since gpt-9000-unknown is not in AVAILABLE_MODELS.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep 'generate/route' | head -10
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/ai-assistant/generate/route.ts
git commit -m "feat: add openai to generate route provider priority and default models"
```

---

## Task 11: Update `NewChatModal.tsx`

**Files:**
- Modify: `components/ai-assistant/NewChatModal.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
// components/ai-assistant/NewChatModal.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, ChevronRight, Loader2, AlertTriangle, Bot, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { AVAILABLE_MODELS } from '@/features/ai-assistant/types'
import type { AIBook, LLMModel, LLMProvider, LLMProviderKeyRecord } from '@/features/ai-assistant/types'
import { format } from 'date-fns'

type UploadedBookData = {
  id: string
  title: string
  file_name: string
  page_count: number | null
  word_count: number | null
  char_count: number | null
  was_truncated: boolean
  created_at: string | null
}

type UploadStep = 'uploading' | 'extracting' | 'done'

type Props = {
  open: boolean
  onClose: () => void
  onChatCreated: (chatId: string) => void
}

function formatWordCount(count: number | null): string {
  if (!count) return ''
  if (count >= 1000) return `~${Math.round(count / 1000)}k words`
  return `~${count} words`
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M context`
  if (tokens >= 1000) return `${tokens / 1000}K context`
  return `${tokens} context`
}

export function NewChatModal({ open, onClose, onChatCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [books, setBooks] = useState<AIBook[]>([])
  const [providerKeys, setProviderKeys] = useState<LLMProviderKeyRecord[]>([])
  const [selectedBook, setSelectedBook] = useState<AIBook | null>(null)
  const [uploadedBookData, setUploadedBookData] = useState<UploadedBookData | null>(null)
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState<UploadStep>('uploading')
  const [creating, setCreating] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setStep(1)
      setSelectedBook(null)
      setSelectedModel(null)
      setUploadedBookData(null)
      return
    }

    Promise.all([
      fetch('/api/ai-assistant/books').then((r) => r.json()),
      fetch('/api/developer/llm-keys').then((r) => r.json()),
    ]).then(([booksData, keysData]) => {
      setBooks(booksData.books ?? [])
      const keys: LLMProviderKeyRecord[] = keysData.keys ?? []
      setProviderKeys(keys)
      const hasClaudeKey = keys.some((k) => k.provider === 'claude' && k.is_valid !== false)
      const hasOpenAIKey = keys.some((k) => k.provider === 'openai' && k.is_valid !== false)
      const hasGeminiKey = keys.some((k) => k.provider === 'gemini' && k.is_valid !== false)
      const defaultModel = hasClaudeKey
        ? AVAILABLE_MODELS.find((m) => m.id === 'claude-sonnet-4-6') ?? null
        : hasOpenAIKey
          ? AVAILABLE_MODELS.find((m) => m.id === 'gpt-4o') ?? null
          : hasGeminiKey
            ? AVAILABLE_MODELS.find((m) => m.provider === 'gemini') ?? null
            : null
      setSelectedModel(defaultModel)
    }).catch(() => toast.error('Failed to load data — please try again'))
  }, [open])

  function isProviderEnabled(provider: LLMProvider) {
    return providerKeys.some((k) => k.provider === provider && k.is_valid !== false)
  }

  function getDisabledReason(model: LLMModel): string | null {
    if (!isProviderEnabled(model.provider)) {
      const label = model.provider === 'claude'
        ? 'Anthropic'
        : model.provider === 'openai'
          ? 'OpenAI'
          : 'Google'
      return `Add your ${label} API key in Developer Settings to use ${model.name}`
    }
    return null
  }

  function isLargeBook(model: LLMModel): boolean {
    if (!uploadedBookData?.char_count) return false
    return model.provider === 'openai' && uploadedBookData.char_count > 400000
  }

  async function handleFileSelect(file: File) {
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file'); return }
    if (file.size > 20 * 1024 * 1024) { toast.error('File too large — max 20MB'); return }

    setUploading(true)
    setUploadStep('uploading')

    try {
      const fd = new FormData()
      fd.append('file', file)

      // Simulate upload → extracting progress
      setTimeout(() => setUploadStep('extracting'), 400)

      const res = await fetch('/api/ai-assistant/books', { method: 'POST', body: fd })

      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Upload failed')
        return
      }

      const { data } = await res.json()
      setUploadStep('done')
      setUploadedBookData(data)

      // Add the newly created book to the list as an AIBook
      const newBook: AIBook = {
        id: data.id,
        user_id: '',
        title: data.title,
        file_name: data.file_name,
        page_count: data.page_count,
        extracted_text: '',
        word_count: data.word_count,
        char_count: data.char_count,
        created_at: data.created_at,
        updated_at: null,
      }
      setBooks((prev) => [newBook, ...prev])
      setSelectedBook(newBook)

      setTimeout(() => setStep(2), 800)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleStartChat() {
    if (!selectedBook || !selectedModel) return
    setCreating(true)
    try {
      const res = await fetch('/api/ai-assistant/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: selectedBook.id,
          llm_provider: selectedModel.provider,
          llm_model: selectedModel.id,
        }),
      })
      if (!res.ok) { toast.error('Failed to create chat'); return }
      const { chat } = await res.json()
      onChatCreated(chat.id)
    } catch {
      toast.error('Failed to create chat')
    } finally {
      setCreating(false)
    }
  }

  const noKeysConfigured = !providerKeys.some((k) => k.is_valid !== false)

  const providerGroups: { provider: LLMProvider; label: string }[] = [
    { provider: 'claude', label: 'Anthropic' },
    { provider: 'openai', label: 'OpenAI' },
    { provider: 'gemini', label: 'Google' },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Upload a PDF — text will be extracted automatically. The file itself is not stored.'
              : 'Choose your AI model'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                dragOver ? 'border-blue-500 bg-blue-50/10' : 'border-slate-200 hover:border-slate-300',
                uploading && 'pointer-events-none opacity-60'
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFileSelect(f)
              }}
            >
              <input
                ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
              {uploading ? (
                <div className="space-y-3">
                  <Loader2 className="h-8 w-8 text-blue-500 mx-auto animate-spin" />
                  <div className="space-y-1.5">
                    {(['uploading', 'extracting', 'done'] as UploadStep[]).map((s) => {
                      const labels: Record<UploadStep, string> = {
                        uploading: 'Uploading PDF…',
                        extracting: 'Extracting text…',
                        done: 'Ready to chat!',
                      }
                      const isDone = uploadStep === 'done'
                        || (s === 'uploading' && uploadStep !== 'uploading')
                      const isCurrent = uploadStep === s
                      return (
                        <p
                          key={s}
                          className={cn(
                            'text-xs',
                            isDone ? 'text-green-600' : isCurrent ? 'text-blue-600 font-medium' : 'text-slate-400'
                          )}
                        >
                          {isDone ? '✅' : isCurrent ? '⏳' : '○'} {labels[s]}
                        </p>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Drop a PDF here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse — max 20MB</p>
                </>
              )}
            </div>

            {/* Existing books */}
            {books.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Or select an existing book</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {books.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => { setSelectedBook(book); setUploadedBookData(null); setStep(2) }}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left text-sm transition-colors',
                        selectedBook?.id === book.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{book.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {book.file_name}
                          {book.word_count ? ` · ${formatWordCount(book.word_count)}` : ''}
                          {book.created_at ? ` · ${format(new Date(book.created_at), 'MMM d, yyyy')}` : ''}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && selectedBook && (
          <div className="space-y-4">
            {/* Uploaded book summary card */}
            {uploadedBookData ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm font-medium text-green-800">Book processed</span>
                </div>
                <p className="text-xs text-green-700 pl-6">
                  📄 {uploadedBookData.file_name}
                </p>
                <p className="text-xs text-green-700 pl-6">
                  📖 {uploadedBookData.page_count ? `${uploadedBookData.page_count} pages` : ''}
                  {uploadedBookData.word_count ? `  ·  ${formatWordCount(uploadedBookData.word_count)}` : ''}
                  {uploadedBookData.char_count ? `  ·  ${uploadedBookData.char_count.toLocaleString()} characters` : ''}
                </p>
                {uploadedBookData.was_truncated && (
                  <div className="flex items-start gap-1.5 mt-1 pl-6">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      This book is very long. The first ~400,000 characters were extracted for AI context.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Selected book recap (for existing books) */
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-sm font-medium truncate">{selectedBook.title}</span>
                <button
                  onClick={() => setStep(1)}
                  className="ml-auto text-xs text-blue-600 hover:underline shrink-0"
                >
                  Change
                </button>
              </div>
            )}

            {/* No keys warning */}
            {noKeysConfigured && (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  No LLM providers configured.{' '}
                  <a href="/dashboard/developer" className="underline font-medium">
                    Go to Developer Settings
                  </a>{' '}
                  to add your API keys.
                </p>
              </div>
            )}

            {/* Model selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Choose model</p>
              {providerGroups.map(({ provider, label }) => {
                const providerModels = AVAILABLE_MODELS.filter((m) => m.provider === provider)
                return (
                  <div key={provider}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5 px-1">
                      {label}
                    </p>
                    <div className="space-y-1">
                      {providerModels.map((model) => {
                        const disabledReason = getDisabledReason(model)
                        const isSelected = selectedModel?.id === model.id
                        const largeBookWarning = isLargeBook(model)
                        return (
                          <button
                            key={model.id}
                            title={disabledReason ?? (largeBookWarning ? 'This book is large. GPT-4o will use a truncated version of the text. Consider using Claude or Gemini for better full-book coverage.' : '')}
                            disabled={!!disabledReason}
                            onClick={() => setSelectedModel(model)}
                            className={cn(
                              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left text-sm transition-colors',
                              isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : disabledReason
                                  ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                                  : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                            )}
                          >
                            <Bot className="h-4 w-4 shrink-0 text-slate-400" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{model.name}</span>
                                {model.free && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Free</Badge>
                                )}
                                <span className="text-[10px] text-slate-400">
                                  {formatContextWindow(model.contextWindow)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{model.description}</p>
                            </div>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-9">
                Back
              </Button>
              <Button
                onClick={handleStartChat}
                disabled={!selectedModel || creating}
                className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Start Chat
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep 'NewChatModal' | head -10
```

Expected: No errors in NewChatModal.tsx.

- [ ] **Step 3: Commit**

```bash
git add components/ai-assistant/NewChatModal.tsx
git commit -m "feat: update NewChatModal with OpenAI provider, upload progress steps, book summary card, context window display"
```

---

## Task 12: Update `AISidebar.tsx`

**Files:**
- Modify: `components/ai-assistant/AISidebar.tsx`

- [ ] **Step 1: Update the book card in the "By Book" section to show word count**

In the book button (around line 131), replace the span that currently shows nothing with:

```tsx
<button
  onClick={() => toggleBook(book.id)}
  className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
>
  {expandedBooks.has(book.id)
    ? <ChevronDown className="h-3 w-3 shrink-0" />
    : <ChevronRight className="h-3 w-3 shrink-0" />
  }
  <FileText className="h-3 w-3 shrink-0" />
  <span className="truncate font-medium">{book.title}</span>
  <span className="ml-auto text-[10px] text-slate-600 shrink-0 flex items-center gap-1.5">
    {book.word_count ? `~${Math.round(book.word_count / 1000)}k words` : ''}
    <span className="text-slate-700">{bookChats.length}</span>
  </span>
</button>
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep 'AISidebar' | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/ai-assistant/AISidebar.tsx
git commit -m "feat: show word count on book cards in AI sidebar"
```

---

## Task 13: Final Type Check and Full Test Run

**Files:** No changes — verification only.

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: Zero errors. If errors appear referencing `file_url`, `bookSignedUrl`, or `extractedText` mismatches, fix them before proceeding.

- [ ] **Step 2: Run all AI assistant tests**

```bash
npx vitest run __tests__/ai-assistant/ __tests__/api/ai-assistant-books.test.ts __tests__/api/ai-generate.test.ts 2>&1 | tail -30
```

Expected: All tests pass. Report:
```
✓ __tests__/ai-assistant/pdfService.test.ts (4 tests)
✓ __tests__/ai-assistant/llmService.test.ts (12+ tests)
✓ __tests__/api/ai-assistant-books.test.ts (7 tests)
✓ __tests__/api/ai-generate.test.ts (7 tests)
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: All tests pass with no regressions.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: resolve any remaining type errors from ai-assistant migration"
```

---

## Task 14: Verify the Dev Server Builds

- [ ] **Step 1: Build the project**

```bash
npm run build 2>&1 | tail -30
```

Expected: Build succeeds. No TypeScript or module-not-found errors.

- [ ] **Step 2: If build fails — diagnose and fix**

Common issues to check:
- `import pdfParse from 'pdf-parse'` — if ESM/CJS conflict, use `const { default: pdfParse } = await import('pdf-parse')` inside the function body in pdfService.ts
- Missing `@types/pdf-parse` — run `npm install --save-dev @types/pdf-parse`
- `openai` import in an Edge runtime file — ensure books/route.ts and messages/route.ts do NOT use `export const runtime = 'edge'`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: ensure build passes after ai-assistant migration"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] OpenAI GPT-4o and GPT-4o Mini in AVAILABLE_MODELS (Task 3)
- [x] `contextWindow` field on LLMModel (Task 3)
- [x] DB migration: drop file_url/file_size, add extracted_text/word_count/char_count (Task 2)
- [x] DB migration: ai_chats and llm_provider_keys constraints updated for 'openai' (Task 2)
- [x] `pdfService.ts` with extractTextFromPdf (Task 4)
- [x] Text truncation at 400,000 chars with note (Task 4)
- [x] `buildSystemPrompt` with model-aware context window truncation (Task 7)
- [x] OpenAI streaming via `streamOpenAI` (Task 7)
- [x] OpenAI `generateBlogPost` with `response_format: json_object` (Task 7)
- [x] OpenAI `generateBlogPostHeadless` with `response_format: json_object` (Task 7)
- [x] OpenAI `generateChatTitle` (Task 7)
- [x] OpenAI `validateProviderKey` (Task 7)
- [x] Books route: no storage upload, returns word_count/char_count/was_truncated (Task 8)
- [x] Messages route: uses extractedText, no signed URL (Task 9)
- [x] Generate route: openai in PROVIDER_PRIORITY and DEFAULT_MODELS (Task 10)
- [x] NewChatModal: OpenAI in model selector, 3-step upload progress, book summary card, context window label, truncation warning (Task 11)
- [x] AISidebar: word count on book cards (Task 12)
- [x] pdfService tests (Task 4)
- [x] llmService tests updated for extractedText + OpenAI (Task 7)
- [x] Books API tests (Task 8)
- [x] `getDecryptedApiKey` handles 'openai' env var (Task 6)
- [x] Gemini streaming rewritten to use extractedText (no more fetchPdfAsBase64) (Task 7)

**Notes for executor:**
- The `generateBlogPost` function in `app/api/ai-assistant/chats/[chatId]/generate-post/route.ts` also uses `bookSignedUrl` — check that file and update similarly to messages route (fetch book via `getBookById`, pass `extracted_text` as `extractedText`).
- The `generate-post` route was not listed in the spec's exploration files but likely exists and needs updating; treat it as a follow-on fix if encountered.
