# AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen AI Assistant to the blog CMS dashboard that lets users upload PDFs, chat with them using Claude or Gemini, and generate blog post drafts from the conversation.

**Architecture:** A separate `(ai-assistant)` Next.js route group provides a Claude.ai-style split-pane layout at `/dashboard/ai-assistant` without the dashboard sidebar. PDFs are stored in a private Supabase Storage bucket (`ai-books`) and passed to LLMs via short-lived signed URLs (Claude) or base64 inline data (Gemini). Streaming uses `ReadableStream` in API routes. LLM provider keys are AES-256-GCM encrypted and stored in `llm_provider_keys`; admins manage them in Developer Settings and they apply globally for all users.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Storage + RLS), `@anthropic-ai/sdk`, `@google/generative-ai`, `react-markdown`, Node.js `crypto` (AES-256-GCM), Vitest, shadcn/ui, TailwindCSS, `date-fns`

---

## File Map

**New files:**
```
supabase/migrations/20260408000000_create_ai_assistant_tables.sql
lib/encryption.ts
features/ai-assistant/types.ts
features/ai-assistant/chatService.ts
features/ai-assistant/llmService.ts
app/api/developer/llm-keys/route.ts
app/api/ai-assistant/books/route.ts
app/api/ai-assistant/chats/route.ts
app/api/ai-assistant/chats/[chatId]/messages/route.ts
app/api/ai-assistant/chats/[chatId]/generate-post/route.ts
components/ai-assistant/LLMProvidersManager.tsx
components/ai-assistant/AISidebar.tsx
components/ai-assistant/NewChatModal.tsx
components/ai-assistant/ChatMessages.tsx
components/ai-assistant/ChatInput.tsx
app/(ai-assistant)/layout.tsx
app/(ai-assistant)/dashboard/ai-assistant/page.tsx
app/(ai-assistant)/dashboard/ai-assistant/[chatId]/page.tsx
__tests__/ai-assistant/encryption.test.ts
__tests__/ai-assistant/llmService.test.ts
```

**Modified files:**
```
.env.local                                               ← add LLM_KEY_ENCRYPTION_SECRET
app/(dashboard)/dashboard/developer/page.tsx             ← add LLMProvidersManager
components/dashboard/Sidebar.tsx                         ← add AI Assistant nav item
```

---

## Task 1: Install Packages

**Files:** `package.json`

- [ ] **Step 1: Install LLM SDKs and react-markdown**

```bash
npm install @anthropic-ai/sdk @google/generative-ai react-markdown
```

Expected: packages added to `node_modules` and `package.json`

- [ ] **Step 2: Verify installs**

```bash
node -e "require('@anthropic-ai/sdk'); require('@google/generative-ai'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @anthropic-ai/sdk, @google/generative-ai, react-markdown"
```

---

## Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/20260408000000_create_ai_assistant_tables.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260408000000_create_ai_assistant_tables.sql

-- ============================================
-- AI ASSISTANT TABLES
-- ============================================

-- Uploaded PDF books
CREATE TABLE IF NOT EXISTS public.ai_books (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  file_url   TEXT NOT NULL,   -- storage path within 'ai-books' bucket, e.g. {userId}/{bookId}/{filename}
  file_size  INTEGER,          -- bytes
  page_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own books"
  ON public.ai_books FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS ai_books_updated_at ON public.ai_books;
CREATE TRIGGER ai_books_updated_at
  BEFORE UPDATE ON public.ai_books
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Chat sessions tied to a book
CREATE TABLE IF NOT EXISTS public.ai_chats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         UUID NOT NULL REFERENCES public.ai_books(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'New Chat',
  llm_provider    TEXT NOT NULL DEFAULT 'claude' CHECK (llm_provider IN ('claude', 'gemini')),
  llm_model       TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chats"
  ON public.ai_chats FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS ai_chats_updated_at ON public.ai_chats;
CREATE TRIGGER ai_chats_updated_at
  BEFORE UPDATE ON public.ai_chats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Individual messages in a chat
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own messages"
  ON public.ai_messages FOR ALL
  USING (
    chat_id IN (
      SELECT id FROM public.ai_chats WHERE user_id = auth.uid()
    )
  );

-- Links a generated draft post back to the chat that produced it
CREATE TABLE IF NOT EXISTS public.ai_generated_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_generated_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own generated posts"
  ON public.ai_generated_posts FOR ALL
  USING (
    chat_id IN (
      SELECT id FROM public.ai_chats WHERE user_id = auth.uid()
    )
  );

-- LLM provider API keys (admin-managed, global)
-- user_id = the admin who saved the key; fetched globally (bypassing RLS) for LLM calls
CREATE TABLE IF NOT EXISTS public.llm_provider_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('claude', 'gemini')),
  encrypted_key    TEXT NOT NULL,       -- AES-256-GCM, format: iv:authTag:ciphertext (base64)
  key_preview      TEXT NOT NULL,       -- last 4 chars, e.g. "...a3f9"
  is_valid         BOOLEAN DEFAULT NULL, -- null = untested, true = verified, false = failed
  last_verified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.llm_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own llm keys"
  ON public.llm_provider_keys FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS llm_provider_keys_updated_at ON public.llm_provider_keys;
CREATE TRIGGER llm_provider_keys_updated_at
  BEFORE UPDATE ON public.llm_provider_keys
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-books', 'ai-books', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload/read/delete only their own files
-- File path convention: {userId}/{randomBookId}/{filename}
CREATE POLICY "Users can upload own PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ai-books'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can read own PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ai-books'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can delete own PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ai-books'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS ai_books_user_id_idx ON public.ai_books(user_id);
CREATE INDEX IF NOT EXISTS ai_chats_user_id_idx ON public.ai_chats(user_id);
CREATE INDEX IF NOT EXISTS ai_chats_book_id_idx ON public.ai_chats(book_id);
CREATE INDEX IF NOT EXISTS ai_chats_last_message_at_idx ON public.ai_chats(last_message_at DESC);
CREATE INDEX IF NOT EXISTS ai_messages_chat_id_idx ON public.ai_messages(chat_id);
```

- [ ] **Step 2: Apply migration in Supabase SQL editor**

Copy the content of `supabase/migrations/20260408000000_create_ai_assistant_tables.sql` and run it in the Supabase dashboard SQL editor. Verify tables appear in the Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260408000000_create_ai_assistant_tables.sql
git commit -m "feat: add AI assistant database migration and storage bucket"
```

---

## Task 3: Environment Variables

**Files:** `.env.local`

- [ ] **Step 1: Add encryption secret to `.env.local`**

Generate a 32-character random string:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Add to `.env.local` (append below existing vars):
```
# AI Assistant — LLM key encryption
LLM_KEY_ENCRYPTION_SECRET=<paste-32-char-string-here>

# AI Assistant — LLM providers (ENV fallback if no DB key configured)
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_KEY=
```

- [ ] **Step 2: Verify the secret is exactly 32 characters**

```bash
node -e "const s = process.env.LLM_KEY_ENCRYPTION_SECRET || ''; console.log(s.length === 32 ? 'OK' : 'ERROR: must be 32 chars, got ' + s.length)" 
```

Note: run with `source .env.local` or set the var inline if your shell doesn't auto-load it. The app will throw at startup if the secret is missing or wrong length.

- [ ] **Step 3: Commit (DO NOT commit `.env.local`)**

```bash
git add -N .env.local  # just note it exists; it's gitignored
git commit --allow-empty -m "docs: document LLM_KEY_ENCRYPTION_SECRET env var requirement"
```

---

## Task 4: Encryption Library (TDD)

**Files:**
- Create: `__tests__/ai-assistant/encryption.test.ts`
- Create: `lib/encryption.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/ai-assistant/encryption.test.ts
import { describe, it, expect, beforeAll } from 'vitest'

// Set the env var before importing the module
beforeAll(() => {
  process.env.LLM_KEY_ENCRYPTION_SECRET = 'a'.repeat(32)
})

// Dynamic import so the env var is set first
async function getEncryption() {
  return await import('@/lib/encryption')
}

describe('encryption', () => {
  it('round-trips a plaintext secret', async () => {
    const { encryptSecret, decryptSecret } = await getEncryption()
    const original = 'sk-ant-api03-test-key-abc123'
    const ciphertext = encryptSecret(original)
    expect(decryptSecret(ciphertext)).toBe(original)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const { encryptSecret } = await getEncryption()
    const c1 = encryptSecret('same-secret')
    const c2 = encryptSecret('same-secret')
    expect(c1).not.toBe(c2)
  })

  it('ciphertext has three colon-separated parts', async () => {
    const { encryptSecret } = await getEncryption()
    const parts = encryptSecret('hello').split(':')
    expect(parts).toHaveLength(3)
  })

  it('throws when ciphertext is tampered', async () => {
    const { encryptSecret, decryptSecret } = await getEncryption()
    const ciphertext = encryptSecret('real-key')
    const tampered = ciphertext.slice(0, -4) + 'XXXX'
    expect(() => decryptSecret(tampered)).toThrow()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm run test -- --run __tests__/ai-assistant/encryption.test.ts
```

Expected: fails with module not found or similar.

- [ ] **Step 3: Implement `lib/encryption.ts`**

```typescript
// lib/encryption.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.LLM_KEY_ENCRYPTION_SECRET
  if (!secret || secret.length !== 32) {
    throw new Error('LLM_KEY_ENCRYPTION_SECRET must be exactly 32 characters')
  }
  return Buffer.from(secret, 'utf8')
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a colon-separated string: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a string produced by encryptSecret.
 * Throws if the ciphertext is tampered or the key is wrong.
 */
export function decryptSecret(ciphertext: string): string {
  const key = getKey()
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':')

  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error('Invalid ciphertext format')
  }

  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return decipher.update(encrypted) + decipher.final('utf8')
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test -- --run __tests__/ai-assistant/encryption.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/encryption.ts __tests__/ai-assistant/encryption.test.ts
git commit -m "feat: add AES-256-GCM encryption library with tests"
```

---

## Task 5: AI Assistant Types

**Files:**
- Create: `features/ai-assistant/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// features/ai-assistant/types.ts

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
  created_at: string
  updated_at: string
}

export type AIChat = {
  id: string
  book_id: string
  user_id: string
  title: string
  llm_provider: LLMProvider
  llm_model: string
  created_at: string
  updated_at: string
  last_message_at: string
  book?: Pick<AIBook, 'id' | 'title' | 'file_name'>
}

export type AIMessage = {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
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
```

- [ ] **Step 2: Commit**

```bash
git add features/ai-assistant/types.ts
git commit -m "feat: add AI assistant types"
```

---

## Task 6: Chat Service

**Files:**
- Create: `features/ai-assistant/chatService.ts`

- [ ] **Step 1: Create chat service**

```typescript
// features/ai-assistant/chatService.ts
import { createClient } from '@/lib/supabase/server'
import type { AIBook, AIChat, AIMessage, LLMProvider } from './types'

// ─── Books ────────────────────────────────────────────────────────────────────

export async function createBook(data: {
  user_id: string
  title: string
  file_name: string
  file_url: string
  file_size?: number
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
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIBook[]
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
    .select('*, book:ai_books(id, title, file_name, file_url)')
    .eq('id', chatId)
    .single()

  if (error) return null
  return data as AIChat & { book: AIBook }
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

- [ ] **Step 2: Commit**

```bash
git add features/ai-assistant/chatService.ts
git commit -m "feat: add AI assistant chat service (Supabase CRUD)"
```

---

## Task 7: LLM Service — Models, Validation, and Title Generation (TDD)

**Files:**
- Create: `__tests__/ai-assistant/llmService.test.ts`
- Create: `features/ai-assistant/llmService.ts` (partial — models + validation + title)

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/ai-assistant/llmService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AVAILABLE_MODELS } from '@/features/ai-assistant/types'

// ─── AVAILABLE_MODELS ────────────────────────────────────────────────────────

describe('AVAILABLE_MODELS', () => {
  it('contains claude models', () => {
    const claude = AVAILABLE_MODELS.filter((m) => m.provider === 'claude')
    expect(claude.length).toBeGreaterThan(0)
  })

  it('contains gemini models', () => {
    const gemini = AVAILABLE_MODELS.filter((m) => m.provider === 'gemini')
    expect(gemini.length).toBeGreaterThan(0)
  })

  it('each model has required fields', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toBeTruthy()
      expect(model.name).toBeTruthy()
      expect(model.provider).toMatch(/^(claude|gemini)$/)
      expect(typeof model.free).toBe('boolean')
    }
  })

  it('has at least one free model', () => {
    expect(AVAILABLE_MODELS.some((m) => m.free)).toBe(true)
  })
})

// ─── generateChatTitle ────────────────────────────────────────────────────────

describe('generateChatTitle', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns a non-empty string from Claude response', async () => {
    // Mock the Anthropic SDK
    vi.mock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Key Themes in Atomic Habits' }],
          }),
        },
      })),
    }))

    const { generateChatTitle } = await import('@/features/ai-assistant/llmService')
    const title = await generateChatTitle(
      'What are the key themes of this book?',
      'claude-sonnet-4-6',
      'test-api-key'
    )
    expect(typeof title).toBe('string')
    expect(title.length).toBeGreaterThan(0)
  })
})

// ─── generateBlogPost ────────────────────────────────────────────────────────

describe('generateBlogPost', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('parses JSON response and returns all required fields', async () => {
    const mockPost = {
      title: 'Test Post',
      meta_title: 'Test SEO Title',
      meta_description: 'Test description',
      excerpt: 'Short summary.',
      content: '<p>Body content</p>',
      tags: ['tag1', 'tag2'],
      category: 'Technology',
    }

    vi.mock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: JSON.stringify(mockPost) }],
          }),
        },
      })),
    }))

    const { generateBlogPost } = await import('@/features/ai-assistant/llmService')
    const result = await generateBlogPost({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'Write a post' }],
      bookSignedUrl: 'https://example.com/test.pdf',
      apiKey: 'test-key',
    })

    expect(result.title).toBe('Test Post')
    expect(result.meta_title).toBe('Test SEO Title')
    expect(result.meta_description).toBe('Test description')
    expect(result.excerpt).toBe('Short summary.')
    expect(result.content).toBe('<p>Body content</p>')
    expect(result.tags).toEqual(['tag1', 'tag2'])
    expect(result.category).toBe('Technology')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm run test -- --run __tests__/ai-assistant/llmService.test.ts
```

Expected: fails because `llmService.ts` doesn't exist.

- [ ] **Step 3: Create `features/ai-assistant/llmService.ts`**

```typescript
// features/ai-assistant/llmService.ts
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIMessage, GeneratedPostData, LLMProvider } from './types'

// ─── Types ───────────────────────────────────────────────────────────────────

type SendMessageParams = {
  model: string
  provider: LLMProvider
  messages: AIMessage[]
  bookSignedUrl: string   // short-lived signed URL for the PDF
  apiKey: string
}

type GenerateBlogPostParams = {
  model: string
  messages: Pick<AIMessage, 'role' | 'content'>[]
  bookSignedUrl: string
  apiKey: string
}

// ─── System Prompt ────────────────────────────────────────────────────────────

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

// ─── Provider: Claude ─────────────────────────────────────────────────────────

/**
 * Streams a chat response from Claude.
 * The PDF is attached as a URL document in the first user message.
 * Yields text chunks as they arrive.
 */
async function* streamClaude(params: SendMessageParams): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: params.apiKey })

  // Build message array: first user message includes the PDF document
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

/**
 * Streams a chat response from Gemini.
 * The PDF is passed as inline base64 data in the first user message.
 */
async function* streamGemini(params: SendMessageParams): AsyncGenerator<string> {
  const genAI = new GoogleGenerativeAI(params.apiKey)
  const geminiModel = genAI.getGenerativeModel({
    model: params.model,
    systemInstruction: CHAT_SYSTEM_PROMPT,
  })

  // Download PDF and convert to base64 for inline data
  const pdfResponse = await fetch(params.bookSignedUrl)
  if (!pdfResponse.ok) throw new Error('Failed to fetch PDF for Gemini')
  const pdfBuffer = await pdfResponse.arrayBuffer()
  const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

  // Build Gemini content array
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

/**
 * Returns an async generator that yields LLM response text chunks.
 * Caller is responsible for collecting chunks and saving the full response.
 */
export function sendMessage(params: SendMessageParams): AsyncGenerator<string> {
  if (params.provider === 'claude') return streamClaude(params)
  if (params.provider === 'gemini') return streamGemini(params)
  throw new Error(`Unsupported provider: ${params.provider}`)
}

/**
 * Non-streaming: generates a complete blog post as structured JSON.
 * Uses Claude by default; falls back to Gemini if provider is gemini.
 */
export async function generateBlogPost(
  params: GenerateBlogPostParams
): Promise<GeneratedPostData> {
  // Determine provider from model prefix
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
    const pdfResponse = await fetch(params.bookSignedUrl)
    const pdfBuffer = await pdfResponse.arrayBuffer()
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

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

  // Strip markdown code fences if the model added them
  const cleaned = rawJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as GeneratedPostData
    return parsed
  } catch {
    throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 200)}`)
  }
}

/**
 * Non-streaming: generates a short 4-6 word chat title from the first user message.
 */
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

/**
 * Validates an API key by making a minimal test call.
 * Returns true if the key is valid, false otherwise.
 */
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test -- --run __tests__/ai-assistant/llmService.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add features/ai-assistant/llmService.ts __tests__/ai-assistant/llmService.test.ts
git commit -m "feat: add LLM service (Claude + Gemini streaming, blog post generation) with tests"
```

---

## Task 8: API — LLM Provider Keys

**Files:**
- Create: `app/api/developer/llm-keys/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/developer/llm-keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encryptSecret, decryptSecret } from '@/lib/encryption'
import { validateProviderKey } from '@/features/ai-assistant/llmService'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import type { LLMProvider, LLMProviderKeyRecord } from '@/features/ai-assistant/types'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { user, role: profile?.role as Role }
}

/**
 * GET /api/developer/llm-keys
 * Returns which providers are configured and their status.
 * Accessible to all authenticated users (authors need this to know which models are available).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service client to fetch global keys (not filtered by user_id)
  const serviceClient = createServiceClient()
  const { data: rows } = await serviceClient
    .from('llm_provider_keys')
    .select('provider, key_preview, is_valid, last_verified_at')
    .order('updated_at', { ascending: false })

  // One record per provider (take most recent if multiple)
  const seen = new Set<string>()
  const records: LLMProviderKeyRecord[] = []
  for (const row of (rows ?? [])) {
    if (!seen.has(row.provider)) {
      seen.add(row.provider)
      records.push({
        provider: row.provider as LLMProvider,
        key_preview: row.key_preview,
        is_valid: row.is_valid,
        last_verified_at: row.last_verified_at,
      })
    }
  }

  return NextResponse.json({ keys: records })
}

/**
 * POST /api/developer/llm-keys
 * Admin only. Saves or updates a provider API key.
 * Body: { provider: 'claude' | 'gemini', api_key: string }
 */
export async function POST(req: NextRequest) {
  const auth = await getAdminUser()
  if (!auth || !can(auth.role, 'api_keys:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { provider?: string; api_key?: string }
  const { provider, api_key } = body

  if (!provider || !['claude', 'gemini'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  if (!api_key || api_key.trim().length < 8) {
    return NextResponse.json({ error: 'API key too short' }, { status: 400 })
  }

  const llmProvider = provider as LLMProvider
  const trimmedKey = api_key.trim()

  // Validate key with a test call
  const isValid = await validateProviderKey(llmProvider, trimmedKey)

  const encrypted = encryptSecret(trimmedKey)
  const key_preview = `...${trimmedKey.slice(-4)}`

  const supabase = await createClient()
  const { error } = await supabase
    .from('llm_provider_keys')
    .upsert(
      {
        user_id: auth.user.id,
        provider: llmProvider,
        encrypted_key: encrypted,
        key_preview,
        is_valid: isValid,
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ provider: llmProvider, key_preview, is_valid: isValid })
}

/**
 * DELETE /api/developer/llm-keys
 * Admin only. Removes a provider key.
 * Body: { provider: 'claude' | 'gemini' }
 */
export async function DELETE(req: NextRequest) {
  const auth = await getAdminUser()
  if (!auth || !can(auth.role, 'api_keys:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { provider } = await req.json() as { provider?: string }
  if (!provider || !['claude', 'gemini'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('llm_provider_keys')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('provider', provider)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

/**
 * Helper used by message/generate-post API routes to fetch the global LLM key.
 * Checks DB first, falls back to ENV vars.
 */
export async function getDecryptedApiKey(provider: LLMProvider): Promise<string> {
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('llm_provider_keys')
    .select('encrypted_key, is_valid')
    .eq('provider', provider)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (data?.encrypted_key) {
    return decryptSecret(data.encrypted_key)
  }

  // ENV fallback
  const envKey = provider === 'claude'
    ? process.env.ANTHROPIC_API_KEY
    : process.env.GOOGLE_GENERATIVE_AI_KEY

  if (envKey) return envKey

  throw new Error(
    `No API key configured for ${provider}. Add your key in Developer Settings.`
  )
}
```

- [ ] **Step 2: Manually test the endpoints**

Start the dev server (`npm run dev`), log in as admin, and test:
```bash
# GET — should return empty keys array
curl -b '<your-session-cookie>' http://localhost:3000/api/developer/llm-keys

# POST — save a key (replace with a real key to test validation)
curl -b '<your-session-cookie>' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"provider":"claude","api_key":"sk-ant-test..."}' \
  http://localhost:3000/api/developer/llm-keys
```

- [ ] **Step 3: Commit**

```bash
git add app/api/developer/llm-keys/route.ts
git commit -m "feat: add LLM provider keys API (GET/POST/DELETE)"
```

---

## Task 9: API — Books

**Files:**
- Create: `app/api/ai-assistant/books/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/ai-assistant/books/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBook, getBooks } from '@/features/ai-assistant/chatService'

/**
 * POST /api/ai-assistant/books
 * Accepts multipart/form-data with a PDF file (max 20MB enforced client-side).
 * Uploads to Supabase Storage and creates an ai_books record.
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
    return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
  }

  // Generate a unique book ID for the storage path
  const bookId = crypto.randomUUID()
  const storagePath = `${user.id}/${bookId}/${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('ai-books')
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const title = titleOverride?.trim() || file.name.replace(/\.pdf$/i, '')

  const book = await createBook({
    user_id: user.id,
    title,
    file_name: file.name,
    file_url: storagePath,   // storage path, NOT a public URL
    file_size: file.size,
  })

  return NextResponse.json({ book }, { status: 201 })
}

/**
 * GET /api/ai-assistant/books
 * Returns all books for the current user.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const books = await getBooks(user.id)
  return NextResponse.json({ books })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/ai-assistant/books/route.ts
git commit -m "feat: add books API route (upload PDF to Storage, list books)"
```

---

## Task 10: API — Chats

**Files:**
- Create: `app/api/ai-assistant/chats/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/ai-assistant/chats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createChat, getChats } from '@/features/ai-assistant/chatService'
import { AVAILABLE_MODELS } from '@/features/ai-assistant/types'
import type { LLMProvider } from '@/features/ai-assistant/types'

/**
 * POST /api/ai-assistant/chats
 * Body: { book_id: string, llm_provider: string, llm_model: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    book_id?: string
    llm_provider?: string
    llm_model?: string
  }

  const { book_id, llm_provider, llm_model } = body

  if (!book_id) return NextResponse.json({ error: 'book_id required' }, { status: 400 })
  if (!llm_provider || !['claude', 'gemini'].includes(llm_provider)) {
    return NextResponse.json({ error: 'Invalid llm_provider' }, { status: 400 })
  }
  if (!llm_model || !AVAILABLE_MODELS.some((m) => m.id === llm_model)) {
    return NextResponse.json({ error: 'Invalid llm_model' }, { status: 400 })
  }

  // Verify the book belongs to this user
  const { data: book } = await supabase
    .from('ai_books')
    .select('id')
    .eq('id', book_id)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  const chat = await createChat({
    book_id,
    user_id: user.id,
    llm_provider: llm_provider as LLMProvider,
    llm_model,
  })

  return NextResponse.json({ chat }, { status: 201 })
}

/**
 * GET /api/ai-assistant/chats
 * Returns recent chats for the current user, ordered by last_message_at desc.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chats = await getChats(user.id)
  return NextResponse.json({ chats })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/ai-assistant/chats/route.ts
git commit -m "feat: add chats API route (create chat, list recent chats)"
```

---

## Task 11: API — Messages (Streaming)

**Files:**
- Create: `app/api/ai-assistant/chats/[chatId]/messages/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/ai-assistant/chats/[chatId]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getMessages, addMessage, updateChatLastMessage, updateChatTitle, getChat,
} from '@/features/ai-assistant/chatService'
import { sendMessage, generateChatTitle } from '@/features/ai-assistant/llmService'
import { getDecryptedApiKey } from '@/app/api/developer/llm-keys/route'
import type { LLMProvider } from '@/features/ai-assistant/types'

type Params = { params: Promise<{ chatId: string }> }

/**
 * GET /api/ai-assistant/chats/[chatId]/messages
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { chatId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify chat belongs to user (RLS enforces this, but let's be explicit)
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
 * Returns a streaming text response (LLM reply chunks).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { chatId } = await params
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

  // Fetch full history (including the message we just saved)
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

  // Generate signed URL for the PDF (1 hour TTL)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('ai-books')
    .createSignedUrl((chat as any).book.file_url, 3600)

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to access PDF' }, { status: 500 })
  }

  // Stream the LLM response
  const llmStream = sendMessage({
    model: chat.llm_model,
    provider: chat.llm_provider as LLMProvider,
    messages: history,
    bookSignedUrl: signedData.signedUrl,
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

- [ ] **Step 2: Commit**

```bash
git add app/api/ai-assistant/chats/[chatId]/messages/route.ts
git commit -m "feat: add messages API route with LLM streaming"
```

---

## Task 12: API — Generate Post

**Files:**
- Create: `app/api/ai-assistant/chats/[chatId]/generate-post/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/ai-assistant/chats/[chatId]/generate-post/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMessages, getChat } from '@/features/ai-assistant/chatService'
import { generateBlogPost } from '@/features/ai-assistant/llmService'
import { getDecryptedApiKey } from '@/app/api/developer/llm-keys/route'
import { resolveTagIds, resolveCategoryId, generateUniqueSlugForApi } from '@/features/api-keys/apiKeyService'
import { createServiceClient } from '@/lib/supabase/service'
import type { LLMProvider } from '@/features/ai-assistant/types'

type Params = { params: Promise<{ chatId: string }> }

/**
 * POST /api/ai-assistant/chats/[chatId]/generate-post
 * Generates a blog post draft from the chat conversation.
 * Returns: { post_id: string, post_slug: string }
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { chatId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chat = await getChat(chatId)
  if (!chat || chat.user_id !== user.id) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }

  const messages = await getMessages(chatId)
  if (messages.length === 0) {
    return NextResponse.json({ error: 'Chat has no messages' }, { status: 400 })
  }

  let apiKey: string
  try {
    apiKey = await getDecryptedApiKey(chat.llm_provider as LLMProvider)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No API key configured' },
      { status: 422 }
    )
  }

  // Generate signed URL for PDF
  const { data: signedData } = await supabase.storage
    .from('ai-books')
    .createSignedUrl((chat as any).book.file_url, 3600)

  if (!signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to access PDF' }, { status: 500 })
  }

  // Generate post content via LLM
  let postData
  try {
    postData = await generateBlogPost({
      model: chat.llm_model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      bookSignedUrl: signedData.signedUrl,
      apiKey,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }

  // Fetch user profile for author_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Resolve tags and category using service client
  const serviceClient = createServiceClient()
  const [tagIds, categoryId, slug] = await Promise.all([
    resolveTagIds(postData.tags ?? [], serviceClient),
    resolveCategoryId(postData.category ?? '', serviceClient),
    generateUniqueSlugForApi(postData.title, serviceClient),
  ])

  // Create draft post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      title: postData.title,
      slug,
      excerpt: postData.excerpt ?? null,
      content: postData.content ?? null,
      seo_title: postData.meta_title ?? null,
      seo_description: postData.meta_description ?? null,
      author_id: profile.id,
      status: 'draft',
      category_id: categoryId,
      cover_image: null,
    })
    .select()
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: postError?.message ?? 'Failed to create post' }, { status: 500 })
  }

  // Attach tags
  if (tagIds.length > 0) {
    await supabase
      .from('post_tags')
      .insert(tagIds.map((tag_id) => ({ post_id: post.id, tag_id })))
  }

  // Record the AI→post link
  await supabase
    .from('ai_generated_posts')
    .insert({ chat_id: chatId, post_id: post.id })

  return NextResponse.json({ post_id: post.id, post_slug: post.slug })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/ai-assistant/chats/[chatId]/generate-post/route.ts
git commit -m "feat: add generate-post API route"
```

---

## Task 13: Developer Settings — LLM Providers UI

**Files:**
- Create: `components/ai-assistant/LLMProvidersManager.tsx`
- Modify: `app/(dashboard)/dashboard/developer/page.tsx`

- [ ] **Step 1: Create `LLMProvidersManager.tsx`**

```tsx
// components/ai-assistant/LLMProvidersManager.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Bot, Check, X, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { LLMProvider, LLMProviderKeyRecord } from '@/features/ai-assistant/types'

type ProviderConfig = {
  provider: LLMProvider
  label: string
  color: string
  models: string
  note?: string
}

const PROVIDERS: ProviderConfig[] = [
  {
    provider: 'claude',
    label: 'Anthropic (Claude)',
    color: 'text-purple-600',
    models: 'Claude Sonnet, Claude Haiku',
  },
  {
    provider: 'gemini',
    label: 'Google (Gemini)',
    color: 'text-blue-600',
    models: 'Gemini 1.5 Flash (free), Gemini 1.5 Pro',
    note: 'Gemini Flash has a free tier',
  },
]

export function LLMProvidersManager() {
  const [keys, setKeys] = useState<LLMProviderKeyRecord[]>([])
  const [editing, setEditing] = useState<LLMProvider | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<LLMProvider | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/developer/llm-keys')
      .then((r) => r.json())
      .then(({ keys: k }) => setKeys(k ?? []))
      .catch(() => toast.error('Failed to load LLM keys'))
      .finally(() => setLoading(false))
  }, [])

  function getKey(provider: LLMProvider) {
    return keys.find((k) => k.provider === provider) ?? null
  }

  async function handleSave(provider: LLMProvider) {
    if (!inputValue.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/developer/llm-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: inputValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to save key'); return }
      setKeys((prev) => {
        const next = prev.filter((k) => k.provider !== provider)
        return [...next, { provider, key_preview: data.key_preview, is_valid: data.is_valid, last_verified_at: new Date().toISOString() }]
      })
      toast.success(data.is_valid ? 'Key saved and verified' : 'Key saved (verification failed — check the key)')
      setEditing(null)
      setInputValue('')
    } catch {
      toast.error('Failed to save key')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(provider: LLMProvider) {
    setDeleting(provider)
    try {
      const res = await fetch('/api/developer/llm-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      if (!res.ok) { toast.error('Failed to remove key'); return }
      setKeys((prev) => prev.filter((k) => k.provider !== provider))
      toast.success('Key removed')
    } catch {
      toast.error('Failed to remove key')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50 shrink-0">
          <Bot className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">LLM Providers</h2>
          <p className="text-xs text-muted-foreground">API keys for the AI Assistant feature</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {PROVIDERS.map(({ provider, label, color, models, note }) => {
            const keyRecord = getKey(provider)
            const isEditing = editing === provider
            const isDeleting = deleting === provider

            return (
              <div key={provider} className="rounded-lg border border-gray-100 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-medium ${color}`}>{label}</p>
                    <p className="text-xs text-muted-foreground">Models: {models}</p>
                    {note && <p className="text-xs text-muted-foreground italic mt-0.5">{note}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {keyRecord ? (
                      <>
                        <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                          {keyRecord.key_preview}
                        </span>
                        <Badge
                          variant={keyRecord.is_valid ? 'default' : keyRecord.is_valid === false ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {keyRecord.is_valid ? (
                            <><Check className="h-2.5 w-2.5 mr-1" />Connected</>
                          ) : keyRecord.is_valid === false ? (
                            <><X className="h-2.5 w-2.5 mr-1" />Invalid</>
                          ) : (
                            'Untested'
                          )}
                        </Badge>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={() => { setEditing(provider); setInputValue('') }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 px-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(provider)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Not configured</Badge>
                    )}
                  </div>
                </div>

                {(isEditing || !keyRecord) && (
                  <div className="space-y-2">
                    <Label className="text-xs">API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={`Paste your ${label} API key`}
                        className="text-xs font-mono h-8"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(provider) }}
                      />
                      <Button
                        size="sm" className="h-8 shrink-0 bg-blue-600 hover:bg-blue-700 text-white border-0"
                        onClick={() => handleSave(provider)}
                        disabled={saving || !inputValue.trim()}
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                      </Button>
                      {keyRecord && (
                        <Button
                          size="sm" variant="ghost" className="h-8 shrink-0"
                          onClick={() => { setEditing(null); setInputValue('') }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Modify `app/(dashboard)/dashboard/developer/page.tsx`**

Add the import and component below `<ApiKeysManager />`. The file currently ends with:
```tsx
    <ApiKeysManager initialKeys={keys} />
  </div>
)
```

Change it to:
```tsx
import { LLMProvidersManager } from '@/components/ai-assistant/LLMProvidersManager'

// ... (keep all existing imports and code)

  return (
    <div className="p-8 space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Developer Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage API keys for external integrations
        </p>
      </div>
      <ApiKeysManager initialKeys={keys} />
      <LLMProvidersManager />
    </div>
  )
```

- [ ] **Step 3: Test the UI**

Start dev server, log in as admin, visit `/dashboard/developer`. Verify the "LLM Providers" card appears below the API Keys section with Claude and Gemini entries.

- [ ] **Step 4: Commit**

```bash
git add components/ai-assistant/LLMProvidersManager.tsx app/(dashboard)/dashboard/developer/page.tsx
git commit -m "feat: add LLM Providers section to Developer Settings"
```

---

## Task 14: AI Assistant Route Group Layout

**Files:**
- Create: `app/(ai-assistant)/layout.tsx`

- [ ] **Step 1: Create the layout**

```tsx
// app/(ai-assistant)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthProvider } from '@/features/auth/context/AuthProvider'
import { AISidebar } from '@/components/ai-assistant/AISidebar'
import { Toaster } from 'sonner'

export default async function AIAssistantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden bg-slate-900">
        <AISidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
      <Toaster richColors />
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(ai-assistant)/layout.tsx
git commit -m "feat: add AI assistant route group layout (full-screen, no dashboard sidebar)"
```

---

## Task 15: AISidebar Component

**Files:**
- Create: `components/ai-assistant/AISidebar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ai-assistant/AISidebar.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Plus, ChevronDown, ChevronRight, ArrowLeft, FileText, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { NewChatModal } from './NewChatModal'
import type { AIChat, AIBook } from '@/features/ai-assistant/types'

export function AISidebar() {
  const pathname = usePathname()
  const [chats, setChats] = useState<AIChat[]>([])
  const [books, setBooks] = useState<AIBook[]>([])
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [chatsRes, booksRes] = await Promise.all([
        fetch('/api/ai-assistant/chats').then((r) => r.json()),
        fetch('/api/ai-assistant/books').then((r) => r.json()),
      ])
      setChats(chatsRes.chats ?? [])
      setBooks(booksRes.books ?? [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function toggleBook(bookId: string) {
    setExpandedBooks((prev) => {
      const next = new Set(prev)
      next.has(bookId) ? next.delete(bookId) : next.add(bookId)
      return next
    })
  }

  const recentChats = chats.slice(0, 10)

  // Group chats by book
  const chatsByBook = books.map((book) => ({
    book,
    chats: chats.filter((c) => c.book_id === book.id),
  }))

  const currentChatId = pathname.match(/\/dashboard\/ai-assistant\/([^/]+)/)?.[1]

  return (
    <>
      <aside className="w-64 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white text-sm">AI Assistant</span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </Link>
          <Button
            onClick={() => setModalOpen(true)}
            className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Chat
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Recent Chats */}
              {recentChats.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-2 mb-1.5">
                    Recent
                  </p>
                  <div className="space-y-0.5">
                    {recentChats.map((chat) => (
                      <Link
                        key={chat.id}
                        href={`/dashboard/ai-assistant/${chat.id}`}
                        className={cn(
                          'flex flex-col px-2 py-2 rounded-lg text-xs transition-colors',
                          currentChatId === chat.id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        )}
                      >
                        <span className="font-medium truncate">{chat.title}</span>
                        <span className={cn(
                          'text-[10px] truncate',
                          currentChatId === chat.id ? 'text-blue-200' : 'text-slate-600'
                        )}>
                          {chat.book?.title} · {formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true })}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* By Book */}
              {chatsByBook.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-2 mb-1.5">
                    By Book
                  </p>
                  <div className="space-y-1">
                    {chatsByBook.map(({ book, chats: bookChats }) => (
                      <div key={book.id}>
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
                          <span className="ml-auto text-[10px] text-slate-600 shrink-0">
                            {bookChats.length}
                          </span>
                        </button>
                        {expandedBooks.has(book.id) && (
                          <div className="ml-5 mt-0.5 space-y-0.5">
                            {bookChats.length === 0 ? (
                              <p className="text-[10px] text-slate-600 px-2 py-1">No chats yet</p>
                            ) : (
                              bookChats.map((chat) => (
                                <Link
                                  key={chat.id}
                                  href={`/dashboard/ai-assistant/${chat.id}`}
                                  className={cn(
                                    'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-colors',
                                    currentChatId === chat.id
                                      ? 'bg-blue-600 text-white'
                                      : 'text-slate-500 hover:text-white hover:bg-slate-800'
                                  )}
                                >
                                  <MessageSquare className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{chat.title}</span>
                                </Link>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {chats.length === 0 && books.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No chats yet.</p>
                  <p className="text-xs text-slate-600">Click New Chat to start.</p>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <NewChatModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onChatCreated={(chatId) => {
          setModalOpen(false)
          loadData()
          window.location.href = `/dashboard/ai-assistant/${chatId}`
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai-assistant/AISidebar.tsx
git commit -m "feat: add AISidebar component (recent chats, by-book grouping)"
```

---

## Task 16: NewChatModal Component

**Files:**
- Create: `components/ai-assistant/NewChatModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ai-assistant/NewChatModal.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, ChevronRight, Loader2, AlertTriangle, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { AVAILABLE_MODELS } from '@/features/ai-assistant/types'
import type { AIBook, LLMModel, LLMProvider, LLMProviderKeyRecord } from '@/features/ai-assistant/types'
import { format } from 'date-fns'

type Props = {
  open: boolean
  onClose: () => void
  onChatCreated: (chatId: string) => void
}

export function NewChatModal({ open, onClose, onChatCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [books, setBooks] = useState<AIBook[]>([])
  const [providerKeys, setProviderKeys] = useState<LLMProviderKeyRecord[]>([])
  const [selectedBook, setSelectedBook] = useState<AIBook | null>(null)
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [creating, setCreating] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { setStep(1); setSelectedBook(null); setSelectedModel(null); return }

    Promise.all([
      fetch('/api/ai-assistant/books').then((r) => r.json()),
      fetch('/api/developer/llm-keys').then((r) => r.json()),
    ]).then(([booksData, keysData]) => {
      setBooks(booksData.books ?? [])
      const keys: LLMProviderKeyRecord[] = keysData.keys ?? []
      setProviderKeys(keys)
      // Auto-select default model
      const hasClaudeKey = keys.some((k) => k.provider === 'claude' && k.is_valid)
      const hasGeminiKey = keys.some((k) => k.provider === 'gemini' && k.is_valid)
      const defaultModel = hasClaudeKey
        ? AVAILABLE_MODELS.find((m) => m.id === 'claude-sonnet-4-6') ?? null
        : hasGeminiKey
          ? AVAILABLE_MODELS.find((m) => m.provider === 'gemini') ?? null
          : null
      setSelectedModel(defaultModel)
    })
  }, [open])

  function isProviderEnabled(provider: LLMProvider) {
    return providerKeys.some((k) => k.provider === provider)
  }

  function getDisabledReason(model: LLMModel): string | null {
    if (!isProviderEnabled(model.provider)) {
      const label = model.provider === 'claude' ? 'Anthropic' : 'Google'
      return `Add your ${label} API key in Developer Settings to use ${model.name}`
    }
    return null
  }

  async function handleFileSelect(file: File) {
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file'); return }
    if (file.size > 20 * 1024 * 1024) { toast.error('File too large — max 20MB'); return }

    setUploading(true)
    setUploadProgress(10)

    try {
      const fd = new FormData()
      fd.append('file', file)

      setUploadProgress(40)
      const res = await fetch('/api/ai-assistant/books', { method: 'POST', body: fd })
      setUploadProgress(90)

      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Upload failed')
        return
      }

      const { book } = await res.json()
      setBooks((prev) => [book, ...prev])
      setSelectedBook(book)
      setUploadProgress(100)
      setTimeout(() => { setStep(2); setUploadProgress(0) }, 300)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
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

  const noKeysConfigured = providerKeys.length === 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Upload a PDF or select an existing book' : 'Choose your AI model'}
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
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 text-blue-500 mx-auto animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading… {uploadProgress}%</p>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
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
                      onClick={() => { setSelectedBook(book); setStep(2) }}
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
                          {book.file_name} · {format(new Date(book.created_at), 'MMM d, yyyy')}
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
            {/* Selected book recap */}
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
              {(['claude', 'gemini'] as LLMProvider[]).map((provider) => {
                const providerModels = AVAILABLE_MODELS.filter((m) => m.provider === provider)
                const providerLabel = provider === 'claude' ? 'Anthropic' : 'Google'
                return (
                  <div key={provider}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5 px-1">
                      {providerLabel}
                    </p>
                    <div className="space-y-1">
                      {providerModels.map((model) => {
                        const disabledReason = getDisabledReason(model)
                        const isSelected = selectedModel?.id === model.id
                        return (
                          <button
                            key={model.id}
                            title={disabledReason ?? ''}
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
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{model.name}</span>
                                {model.free && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Free</Badge>
                                )}
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

- [ ] **Step 2: Commit**

```bash
git add components/ai-assistant/NewChatModal.tsx
git commit -m "feat: add NewChatModal component (PDF upload + model selection)"
```

---

## Task 17: ChatMessages and ChatInput Components

**Files:**
- Create: `components/ai-assistant/ChatMessages.tsx`
- Create: `components/ai-assistant/ChatInput.tsx`

- [ ] **Step 1: Create `ChatMessages.tsx`**

```tsx
// components/ai-assistant/ChatMessages.tsx
'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AIMessage } from '@/features/ai-assistant/types'

type Props = {
  messages: AIMessage[]
  streamingContent: string  // partial assistant message being streamed
  isStreaming: boolean
  onSuggestedPrompt?: (prompt: string) => void
}

const SUGGESTED_PROMPTS = [
  'Summarize the key themes of this document',
  'What are the most interesting ideas I could write about?',
  'Write an outline for a blog post based on this material',
  'What are the main arguments made by the author?',
]

export function ChatMessages({ messages, streamingContent, isStreaming, onSuggestedPrompt }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Bot className="h-12 w-12 text-slate-700 mb-4" />
        <p className="text-sm font-medium text-slate-400 mb-1">Start the conversation</p>
        <p className="text-xs text-slate-600 mb-6">Ask anything about the uploaded document</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSuggestedPrompt?.(prompt)}
              className="text-left px-3 py-2.5 rounded-xl border border-slate-700 text-xs text-slate-400 hover:text-white hover:border-slate-600 hover:bg-slate-800 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
        >
          {message.role === 'assistant' && (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0 mr-2.5 mt-1">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <div
            className={cn(
              'max-w-[75%] rounded-2xl px-4 py-3 text-sm',
              message.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-slate-800 text-slate-100 rounded-bl-sm'
            )}
          >
            {message.role === 'user' ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Streaming assistant message */}
      {isStreaming && (
        <div className="flex justify-start">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0 mr-2.5 mt-1">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="max-w-[75%] rounded-2xl px-4 py-3 text-sm bg-slate-800 text-slate-100 rounded-bl-sm">
            {streamingContent ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center gap-1 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" />
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 2: Create `ChatInput.tsx`**

```tsx
// components/ai-assistant/ChatInput.tsx
'use client'

import { useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ value, onChange, onSend, disabled, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSend()
    }
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950 p-4">
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden focus-within:border-slate-600 transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? 'Ask something about the document…'}
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600',
              'px-4 py-3 resize-none outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
        </div>
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-colors',
            disabled || !value.trim()
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="text-center text-[10px] text-slate-700 mt-2 max-w-4xl mx-auto">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ai-assistant/ChatMessages.tsx components/ai-assistant/ChatInput.tsx
git commit -m "feat: add ChatMessages and ChatInput components"
```

---

## Task 18: Empty State Page

**Files:**
- Create: `app/(ai-assistant)/dashboard/ai-assistant/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(ai-assistant)/dashboard/ai-assistant/page.tsx
'use client'

import { useState } from 'react'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NewChatModal } from '@/components/ai-assistant/NewChatModal'

export default function AIAssistantPage() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center h-full text-center p-8">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 mb-6 shadow-lg shadow-purple-500/20">
          <Bot className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">AI Assistant</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Upload a PDF or book and chat with it to generate blog posts
        </p>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white border-0"
        >
          Start New Chat
        </Button>
      </div>

      <NewChatModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onChatCreated={(chatId) => {
          setModalOpen(false)
          window.location.href = `/dashboard/ai-assistant/${chatId}`
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(ai-assistant)/dashboard/ai-assistant/page.tsx
git commit -m "feat: add AI assistant empty state page"
```

---

## Task 19: Chat View Page

**Files:**
- Create: `app/(ai-assistant)/dashboard/ai-assistant/[chatId]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(ai-assistant)/dashboard/ai-assistant/[chatId]/page.tsx
'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { ChatMessages } from '@/components/ai-assistant/ChatMessages'
import { ChatInput } from '@/components/ai-assistant/ChatInput'
import { AVAILABLE_MODELS } from '@/features/ai-assistant/types'
import type { AIChat, AIMessage } from '@/features/ai-assistant/types'

type Props = { params: Promise<{ chatId: string }> }

export default function ChatPage({ params }: Props) {
  const { chatId } = use(params)
  const router = useRouter()

  const [chat, setChat] = useState<AIChat | null>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [chatRes, messagesRes] = await Promise.all([
          fetch(`/api/ai-assistant/chats`).then((r) => r.json()),
          fetch(`/api/ai-assistant/chats/${chatId}/messages`).then((r) => r.json()),
        ])
        const foundChat = (chatRes.chats ?? []).find((c: AIChat) => c.id === chatId)
        setChat(foundChat ?? null)
        setMessages(messagesRes.messages ?? [])
      } catch {
        toast.error('Failed to load chat')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [chatId])

  async function handleSend() {
    const content = inputValue.trim()
    if (!content || isStreaming) return

    setInputValue('')
    setIsStreaming(true)
    setStreamingContent('')

    // Optimistically add user message
    const tempUserMsg: AIMessage = {
      id: `temp-${Date.now()}`,
      chat_id: chatId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const res = await fetch(`/api/ai-assistant/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to send message')
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamingContent(full)
      }

      // Reload messages to get the persisted versions with real IDs
      const msgRes = await fetch(`/api/ai-assistant/chats/${chatId}/messages`)
      const msgData = await msgRes.json()
      setMessages(msgData.messages ?? [])
    } catch {
      toast.error('Connection error')
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  async function handleGeneratePost() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/ai-assistant/chats/${chatId}/generate-post`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Generation failed'); return }

      setGenerateOpen(false)
      toast.success(
        <span>
          Post created!{' '}
          <a
            href={`/dashboard/posts/${data.post_id}/edit`}
            className="underline font-medium"
          >
            View Draft
          </a>
        </span>
      )
    } catch {
      toast.error('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const modelInfo = chat
    ? AVAILABLE_MODELS.find((m) => m.id === chat.llm_model)
    : null

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 text-slate-600 animate-spin" />
      </div>
    )
  }

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <p className="text-sm text-slate-500">Chat not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950 shrink-0">
        <FileText className="h-4 w-4 text-slate-500 shrink-0" />
        <span className="text-sm font-medium text-slate-200 truncate flex-1">
          {(chat as any).book?.title ?? 'Document'}
        </span>
        {modelInfo && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {modelInfo.name}
          </Badge>
        )}
        <Button
          size="sm"
          onClick={() => setGenerateOpen(true)}
          disabled={messages.length === 0}
          className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white border-0 shrink-0"
        >
          <Sparkles className="h-3 w-3 mr-1.5" />
          Generate Post
        </Button>
      </div>

      {/* Messages */}
      <ChatMessages
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        onSuggestedPrompt={(prompt) => { setInputValue(prompt) }}
      />

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={isStreaming}
      />

      {/* Generate Post confirmation dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Blog Post</DialogTitle>
            <DialogDescription>
              Generate a draft blog post from this conversation? The post will be saved as a draft for you to review and edit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleGeneratePost}
              disabled={generating}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</>
              ) : (
                'Generate Post'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(ai-assistant)/dashboard/ai-assistant/[chatId]/page.tsx
git commit -m "feat: add chat view page with streaming and generate-post flow"
```

---

## Task 20: Dashboard Sidebar — Add AI Assistant Link

**Files:**
- Modify: `components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Add the import and nav item**

In `components/dashboard/Sidebar.tsx`, find the import line:
```ts
import {
  LayoutDashboard, FileText, PlusCircle, Users, FolderOpen, Tag, LogOut, PenLine, Menu, X, MessageSquare, Loader2, Code,
} from 'lucide-react'
```

Change to:
```ts
import {
  LayoutDashboard, FileText, PlusCircle, Users, FolderOpen, Tag, LogOut, PenLine, Menu, X, MessageSquare, Loader2, Code, Bot,
} from 'lucide-react'
```

Then find the `navItems` array and add the AI Assistant item after `New Post`:
```ts
const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
  { href: '/dashboard/posts', icon: FileText, label: 'Posts', show: true },
  { href: '/dashboard/posts/new', icon: PlusCircle, label: 'New Post', show: true },
  { href: '/dashboard/ai-assistant', icon: Bot, label: 'AI Assistant', show: true },  // ← add this
  { href: '/dashboard/admin/users', icon: Users, label: 'Users', show: can(role, 'users:read') },
  // ... rest unchanged
]
```

Note: `mainItems` is `visibleItems.slice(0, 3)` and `adminItems` is `visibleItems.slice(3)`. The AI Assistant item at index 3 will appear in the Admin section due to the slice. Change `mainItems` to `visibleItems.slice(0, 4)` and `adminItems` to `visibleItems.slice(4)` to keep AI Assistant in the Main section:

```ts
const mainItems = visibleItems.slice(0, 4)
const adminItems = visibleItems.slice(4)
```

- [ ] **Step 2: Verify in browser**

Start dev server and verify "AI Assistant" appears in the sidebar under Main for both admin and author roles.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/Sidebar.tsx
git commit -m "feat: add AI Assistant nav item to dashboard sidebar"
```

---

## Task 21: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
npm run test -- --run
```

Expected: all tests pass (encryption + llmService suites).

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Fix any errors before proceeding.

- [ ] **Step 3: Manual smoke test**

With dev server running (`npm run dev`):

1. Log in as **admin** → go to `/dashboard/developer` → add a real Claude or Gemini API key → verify "Connected" status appears
2. Click "AI Assistant" in sidebar → verify split-pane layout (no dashboard sidebar) + empty state page
3. Click "New Chat" → upload a PDF (< 20MB) → select a model → click "Start Chat"
4. In the chat view, type a question and send → verify streaming response appears
5. Click "Generate Post" → confirm → verify success toast with "View Draft" link
6. Click "View Draft" → verify post exists as draft at `/dashboard/posts/{id}/edit`
7. Log in as **author** → verify AI Assistant is accessible (not blocked)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete AI assistant feature (PDF chat + blog post generation)"
```

---

## Notes for Implementer

- **`file_url` in `ai_books`** stores the Supabase Storage *path* (e.g., `{userId}/{bookId}/{filename}`), NOT a full URL. Signed URLs are generated on demand in API routes.
- **`getChat()`** in `chatService.ts` selects `book:ai_books(id, title, file_name, file_url)` — the `file_url` field on the nested book is needed by the messages route to generate the signed URL.
- **`getDecryptedApiKey()`** is exported from `app/api/developer/llm-keys/route.ts` and imported by the messages and generate-post routes. It tries DB first, then ENV fallback.
- **Streaming**: The messages route pipes the LLM `AsyncGenerator<string>` directly into a `ReadableStream`. The client reads it with `response.body.getReader()`. The assistant message is saved server-side after the stream closes (fire-and-forget `Promise.all`).
- **Route group conflict**: `app/(ai-assistant)/dashboard/ai-assistant/` and `app/(dashboard)/dashboard/posts/` both live under `/dashboard/` but in different route groups. Next.js resolves them independently with no conflict — each group applies its own layout.
- **Missing shadcn components**: All UI components used (`Dialog`, `Card`, `Button`, `Input`, `Label`, `Badge`, `Skeleton`) already exist in `components/ui/`. No new shadcn installs needed.
