# AI Assistant Feature — Design Spec

**Date:** 2026-04-08
**Branch:** feature/ai-assistant
**Status:** Approved

---

## Overview

Add an "AI Assistant" section to the blog CMS dashboard. Users upload a PDF, chat with it using Claude or Gemini, and generate a blog post draft from the conversation. The UI mimics Claude.ai — a full-screen split-pane layout with a left sidebar listing recent chats grouped by book.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| LLM key storage | Admin-only in Developer Settings, global | Author role doesn't need its own keys; simplifies key management |
| PDF handling | Upload to Supabase Storage, pass URL directly to LLM | Claude and Gemini support native PDF inputs; avoids `pdf-parse` issues in Next.js App Router |
| LLM providers | Claude + Gemini only (no OpenAI) | OpenAI does not support PDF document inputs natively |
| Layout | Full-screen takeover via route group, no dashboard sidebar | Claude.ai-style immersive experience |
| Route structure | `app/(ai-assistant)/` route group at `/dashboard/ai-assistant` | Keeps `/dashboard/` URL prefix while bypassing dashboard layout |

---

## Architecture

### Directory Structure

```
app/
  (dashboard)/
    dashboard/
      developer/                    ← Add LLM Providers section (admin-only)
  (ai-assistant)/                   ← New route group, own layout
    layout.tsx                      ← Full-screen split-pane, no dashboard sidebar
    dashboard/
      ai-assistant/
        page.tsx                    ← Empty state
        [chatId]/
          page.tsx                  ← Active chat view

features/
  ai-assistant/
    chatService.ts                  ← Supabase CRUD for books, chats, messages
    llmService.ts                   ← Claude + Gemini unified interface

lib/
  encryption.ts                     ← AES-256-GCM encrypt/decrypt

components/
  ai-assistant/
    AISidebar.tsx                   ← Left panel
    NewChatModal.tsx                ← Upload PDF + select model
    ChatMessages.tsx                ← Message list with streaming
    ChatInput.tsx                   ← Textarea + send button

app/api/
  ai-assistant/
    books/route.ts
    chats/route.ts
    chats/[chatId]/
      messages/route.ts
      generate-post/route.ts
  developer/
    llm-keys/route.ts
```

### Data Flow

1. Admin configures LLM keys in Developer Settings → encrypted with AES-256-GCM → stored in `llm_provider_keys`
2. User uploads PDF → stored in Supabase Storage bucket `ai-books` at `{userId}/{bookId}/{filename}` → `ai_books` record created with `file_url`
3. User sends message → API route fetches + decrypts global LLM key → calls Claude/Gemini with PDF `file_url` as native document attachment + full message history → streams response back
4. On first message: auto-generate 4-6 word chat title via non-streaming LLM call
5. "Generate Post" → LLM returns structured JSON → reuse existing `createPost()` with `status: 'draft'` → `ai_generated_posts` record links chat to post

---

## Database

### Migration File
`supabase/migrations/20260408000000_create_ai_assistant_tables.sql`

### Tables

**`ai_books`**
```sql
CREATE TABLE ai_books (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  file_url     TEXT NOT NULL,       -- Supabase Storage path
  file_size    INTEGER,             -- bytes
  page_count   INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: auth.uid() = user_id
```

Note: `extracted_text` column removed — PDF content is passed via `file_url` directly to LLM.

**`ai_chats`**
```sql
CREATE TABLE ai_chats (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id          UUID NOT NULL REFERENCES ai_books(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT 'New Chat',
  llm_provider     TEXT NOT NULL DEFAULT 'claude',  -- 'claude' | 'gemini'
  llm_model        TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: auth.uid() = user_id
```

**`ai_messages`**
```sql
CREATE TABLE ai_messages (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id   UUID NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: chat_id IN (SELECT id FROM ai_chats WHERE user_id = auth.uid())
```

**`ai_generated_posts`**
```sql
CREATE TABLE ai_generated_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: chat_id IN (SELECT id FROM ai_chats WHERE user_id = auth.uid())
```

**`llm_provider_keys`**
```sql
CREATE TABLE llm_provider_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('claude', 'gemini')),
  encrypted_key    TEXT NOT NULL,
  key_preview      TEXT NOT NULL,     -- last 4 chars, e.g. "...a3f9"
  is_valid         BOOLEAN DEFAULT NULL,
  last_verified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);
-- RLS: auth.uid() = user_id (admin enforced at API layer)
```

### Storage
- Bucket: `ai-books` — private, authenticated access only
- Path convention: `{userId}/{bookId}/{filename}`

### New Environment Variable
```
LLM_KEY_ENCRYPTION_SECRET=   # exactly 32 characters, used for AES-256-GCM
```

---

## Feature Services

### `lib/encryption.ts`
- `encryptSecret(plaintext: string): string` — AES-256-GCM, returns `iv:authTag:ciphertext` base64-encoded
- `decryptSecret(ciphertext: string): string` — reverses the above
- Uses Node.js built-in `crypto` only

### `features/ai-assistant/chatService.ts`
Supabase CRUD using `createClient()` (user-scoped, RLS enforced):
- `createBook(data)`, `getBooks(userId)`
- `createChat(data)`, `getChats(userId)`, `getChatsByBook(bookId)`
- `getMessages(chatId)`, `addMessage(data)`
- `updateChatTitle(chatId, title)`, `updateChatLastMessage(chatId)`

### `features/ai-assistant/llmService.ts`

```ts
type LLMProvider = 'claude' | 'gemini'

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet', provider: 'claude', free: false },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku',  provider: 'claude', free: false },
  { id: 'gemini-1.5-flash',          name: 'Gemini Flash',  provider: 'gemini', free: true  },
  { id: 'gemini-1.5-pro',            name: 'Gemini Pro',    provider: 'gemini', free: false },
]
```

- `sendMessage({ model, messages, bookFileUrl, apiKey })` → `ReadableStream`
  - Claude: `@anthropic-ai/sdk` streaming, PDF as `document` content block with `source.type: 'url'`
  - Gemini: `@google/generative-ai` streaming, PDF as `fileData` part
- `generateBlogPost({ model, messages, bookFileUrl, apiKey })` → structured JSON post fields
- `generateChatTitle(firstMessage, model, apiKey)` → 4-6 word string, non-streaming
- `validateProviderKey(provider, apiKey)` → `boolean`, minimal test call

---

## API Routes

All routes authenticate via `createClient()` and check session. LLM key routes additionally require `can(role, 'api_keys:write')`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/ai-assistant/books` | Upload PDF to Storage, create `ai_books` record |
| GET | `/api/ai-assistant/books` | List user's books |
| POST | `/api/ai-assistant/chats` | Create chat session |
| GET | `/api/ai-assistant/chats` | Recent chats ordered by `last_message_at` |
| GET | `/api/ai-assistant/chats/[chatId]/messages` | Full message history |
| POST | `/api/ai-assistant/chats/[chatId]/messages` | Send message + stream LLM response |
| POST | `/api/ai-assistant/chats/[chatId]/generate-post` | Generate draft blog post from chat |
| GET | `/api/developer/llm-keys` | List configured providers (preview only) |
| POST | `/api/developer/llm-keys` | Save/update provider key (validates before saving) |
| DELETE | `/api/developer/llm-keys` | Remove provider key by `provider` |

### Message streaming detail
1. Save user message to `ai_messages`
2. Fetch book `file_url` from `ai_books`
3. Fetch global LLM key from `llm_provider_keys`, decrypt with `decryptSecret`
4. Call `llmService.sendMessage`, pipe `ReadableStream` to response
5. Once complete: save assistant message, update `last_message_at`
6. If first message in chat: call `generateChatTitle`, update chat title

### ENV fallback
If no key found in `llm_provider_keys`, fall back to:
- `process.env.ANTHROPIC_API_KEY`
- `process.env.GOOGLE_GENERATIVE_AI_KEY`

This supports self-hosted installs with ENV-only config.

---

## UI Components

### Layout: `app/(ai-assistant)/layout.tsx`
- Full-screen, no dashboard sidebar
- Wraps `<AuthProvider>` + `<Toaster>`
- Checks session, redirects to `/login` if unauthenticated
- Renders: `<AISidebar />` (260px fixed) + `<main>` (flex-1)
- Mobile: sidebar collapses to slide-in drawer

### `components/ai-assistant/AISidebar.tsx`
- Header: "AI Assistant" title + "← Dashboard" back link
- "New Chat" button (full width)
- **Recent Chats**: flat list of last 10 chats by `last_message_at`. Row: chat title + book name + relative time
- **By Book**: collapsible sections per book, shows filename + chat count
- Active chat highlighted

### `components/ai-assistant/NewChatModal.tsx`
Two-step dialog:
- **Step 1**: Drag-and-drop PDF zone (20MB client-side limit) OR existing book cards
- **Step 2**: Model selector grouped by provider. Disabled models show tooltip if key not configured. Gemini Flash has "Free" badge. Warning banner + link to `/dashboard/developer` if no keys configured.

### Pages

**`app/(ai-assistant)/dashboard/ai-assistant/page.tsx`** — Empty state
- `<Bot />` icon, "AI Assistant" heading, "Upload a PDF or book and chat with it to generate blog posts" subheading, "New Chat" button

**`app/(ai-assistant)/dashboard/ai-assistant/[chatId]/page.tsx`** — Chat view
- Header: book title + PDF icon | model badge | "Generate Post" button
- Messages: `react-markdown` for assistant, right-aligned bubbles for user, streaming text, animated dots while waiting
- Suggested prompts when chat is empty
- Input: auto-resize textarea, Enter to send / Shift+Enter for newline
- Generate Post flow: confirmation dialog → loading → success toast with "View Draft" link

### Dashboard Sidebar Addition
Add to `navItems` in `components/dashboard/Sidebar.tsx`:
```ts
{ href: '/dashboard/ai-assistant', icon: Bot, label: 'AI Assistant', show: true }
```
Visible to both Admin and Author roles.

### Developer Settings Addition
New "LLM Providers" section in `app/(dashboard)/dashboard/developer/page.tsx` (and its `ApiKeysManager` client component). Cards for Claude and Gemini showing: provider name, supported models, masked key, Edit/Clear buttons, connection status dot.

---

## LLM Prompts

### Chat system prompt
```
You are an expert blog writing assistant. The user has uploaded a document and wants
to create blog posts inspired by its content. Help the user explore ideas, discuss
themes, and craft compelling blog content. Be conversational, insightful, and practical.
```
(PDF content delivered via native document attachment, not injected into prompt text.)

### Generate post prompt
```
Based on the following conversation about the uploaded document, generate a complete,
publish-ready blog post.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "...",
  "meta_title": "... (max 60 chars)",
  "meta_description": "... (max 160 chars)",
  "excerpt": "2-3 sentence plain text summary",
  "content": "Full HTML using <h2>, <p>, <ul>, <strong>",
  "tags": ["tag1", "tag2"],
  "category": "most appropriate category"
}

The post should be 800-1500 words, well-structured, and SEO-friendly.
```

---

## Packages to Install

```bash
npm install @anthropic-ai/sdk @google/generative-ai react-markdown
```

---

## Tests

**`__tests__/ai-assistant/llmService.test.ts`**
- `AVAILABLE_MODELS` contains both `claude` and `gemini` providers
- `generateChatTitle` returns non-empty string (mock LLM call)
- `generateBlogPost` parses JSON and returns all required fields

**`__tests__/ai-assistant/encryption.test.ts`**
- `encryptSecret` + `decryptSecret` round-trips correctly
- `decryptSecret` throws on tampered ciphertext

---

## Constraints

- TypeScript throughout, follow existing project conventions
- Streaming responses for chat — never wait for full response
- PDF URL passed to LLM server-side only — never exposed to client
- LLM API keys never sent to client — decrypted server-side at call time
- Both Admin and Author can use AI Assistant
- Generated posts always `status: 'draft'` — never auto-publish
- PDF size limit: 20MB, validated client-side before upload
- If no LLM keys configured (DB or ENV), disable models in UI with tooltip
