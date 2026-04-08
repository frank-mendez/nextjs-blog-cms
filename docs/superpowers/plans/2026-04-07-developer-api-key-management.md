# Developer API Key Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add API key management for admins (generate/revoke keys in a dashboard UI) plus a `POST /api/posts/create` endpoint authenticated by those keys for external integrations like n8n.

**Architecture:** Three layers — (1) database `api_keys` table + service layer for crypto and CRUD, (2) session-protected API routes for key management, (3) API-key-protected route for post creation. The Developer Settings page is a Server Component with a Client Component managing the interactive table and modal.

**Tech Stack:** Next.js 14 App Router, Supabase (supabase-js + SSR), TailwindCSS, shadcn/ui (Dialog, Button, Input, Badge, Card already installed), Vitest, `crypto` (Node built-in), `slugify`

---

## File Map

**Create:**
- `supabase/migrations/20260407000000_create_api_keys_table.sql` — DB table + RLS
- `features/api-keys/types.ts` — ApiKey TypeScript types
- `features/api-keys/apiKeyService.ts` — generate, hash, CRUD, validate
- `app/api/developer/keys/route.ts` — GET (list) + POST (create) — session-protected
- `app/api/developer/keys/[id]/route.ts` — DELETE + PATCH (revoke) — session-protected
- `app/api/posts/create/route.ts` — API-key-protected post creation
- `app/(dashboard)/dashboard/developer/page.tsx` — Server Component page
- `app/(dashboard)/dashboard/developer/ApiKeysManager.tsx` — Client Component UI
- `__tests__/api-keys/apiKeyService.test.ts` — service unit tests
- `__tests__/api/posts-create.test.ts` — route handler tests

**Modify:**
- `lib/permissions/types.ts` — add `api_keys:write` permission
- `lib/permissions/index.ts` — grant `api_keys:write` to admin role
- `middleware.ts` — protect `/dashboard/developer` with admin-role check
- `components/dashboard/Sidebar.tsx` — add Developer nav item (admin-only)
- `README.md` — add Developer API section

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260407000000_create_api_keys_table.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Create api_keys table for developer API access
CREATE TABLE public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_preview  TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active    BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own api keys"
  ON public.api_keys
  FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX api_keys_user_id_idx ON public.api_keys(user_id);
CREATE INDEX api_keys_key_hash_idx ON public.api_keys(key_hash);
```

- [ ] **Step 2: Apply the migration in Supabase SQL Editor**

Run the SQL in the Supabase dashboard SQL Editor for the project. Verify:
- `api_keys` table appears in Table Editor
- RLS is enabled on the table

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260407000000_create_api_keys_table.sql
git commit -m "feat: add api_keys migration with RLS policy"
```

---

## Task 2: Permission Types + Role Assignment

**Files:**
- Modify: `lib/permissions/types.ts`
- Modify: `lib/permissions/index.ts`

- [ ] **Step 1: Add `api_keys:write` to the Permission union in `lib/permissions/types.ts`**

Current file ends at line 18. Add the new permission at the end of the union:

```typescript
export type Permission =
  | 'posts:create'
  | 'posts:read:own'
  | 'posts:read:all'
  | 'posts:update:own'
  | 'posts:update:all'
  | 'posts:delete:own'
  | 'posts:delete:all'
  | 'posts:publish'
  | 'users:read'
  | 'users:update'
  | 'categories:write'
  | 'tags:write'
  | 'comments:delete:own'
  | 'comments:delete:all'
  | 'api_keys:write'
```

- [ ] **Step 2: Grant `api_keys:write` to admin in `lib/permissions/index.ts`**

Add `'api_keys:write'` to the admin permissions array (currently ends at `'comments:delete:all'` on line 17):

```typescript
  admin: [
    'posts:create',
    'posts:read:own',
    'posts:read:all',
    'posts:update:own',
    'posts:update:all',
    'posts:delete:own',
    'posts:delete:all',
    'posts:publish',
    'users:read',
    'users:update',
    'categories:write',
    'tags:write',
    'comments:delete:own',
    'comments:delete:all',
    'api_keys:write',
  ],
```

- [ ] **Step 3: Run existing permission tests to verify no regression**

```bash
npx vitest run __tests__/lib/permissions.test.ts
```

Expected: all tests pass (no changes to existing logic).

- [ ] **Step 4: Commit**

```bash
git add lib/permissions/types.ts lib/permissions/index.ts
git commit -m "feat: add api_keys:write permission for admin role"
```

---

## Task 3: API Key Types

**Files:**
- Create: `features/api-keys/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
export type ApiKey = {
  id: string
  name: string
  key_hash: string
  key_preview: string
  user_id: string
  created_at: string | null
  last_used_at: string | null
  is_active: boolean
}

export type ApiKeyListItem = Omit<ApiKey, 'key_hash'>

export type CreateApiKeyResult = {
  key: ApiKeyListItem
  rawKey: string
}
```

No commit yet — commit together with the service in Task 4.

---

## Task 4: API Key Service (TDD)

**Files:**
- Create: `features/api-keys/apiKeyService.ts`
- Create: `__tests__/api-keys/apiKeyService.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// __tests__/api-keys/apiKeyService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateApiKey, hashApiKey } from '@/features/api-keys/apiKeyService'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

describe('generateApiKey', () => {
  it('returns a string prefixed with fmblog_', () => {
    const key = generateApiKey()
    expect(key).toMatch(/^fmblog_[0-9a-f]{64}$/)
  })

  it('returns a different key each call', () => {
    const key1 = generateApiKey()
    const key2 = generateApiKey()
    expect(key1).not.toBe(key2)
  })
})

describe('hashApiKey', () => {
  it('is deterministic — same input produces same output', () => {
    const key = 'fmblog_test123'
    expect(hashApiKey(key)).toBe(hashApiKey(key))
  })

  it('produces a 64-character hex string', () => {
    expect(hashApiKey('fmblog_test')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('different keys produce different hashes', () => {
    expect(hashApiKey('fmblog_aaa')).not.toBe(hashApiKey('fmblog_bbb'))
  })
})

describe('validateApiKey', () => {
  it('returns user_id for a valid active key', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const fakeKey = generateApiKey()
    const fakeHash = hashApiKey(fakeKey)

    const mockSelect = vi.fn().mockResolvedValue({
      data: { id: 'key-id', user_id: 'user-123', is_active: true },
      error: null,
    })
    const mockUpdate = vi.fn().mockResolvedValue({ error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSelect,
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: mockUpdate,
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const { validateApiKey } = await import('@/features/api-keys/apiKeyService')
    const result = await validateApiKey(fakeKey)
    expect(result).toBe('user-123')
  })

  it('returns null for a revoked key', async () => {
    vi.resetModules()
    const { createServiceClient } = await import('@/lib/supabase/service')

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'key-id', user_id: 'user-123', is_active: false },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn() }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const { validateApiKey, generateApiKey } = await import('@/features/api-keys/apiKeyService')
    const result = await validateApiKey(generateApiKey())
    expect(result).toBeNull()
  })

  it('returns null for a nonexistent key', async () => {
    vi.resetModules()
    const { createServiceClient } = await import('@/lib/supabase/service')

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn() }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const { validateApiKey, generateApiKey } = await import('@/features/api-keys/apiKeyService')
    const result = await validateApiKey(generateApiKey())
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/api-keys/apiKeyService.test.ts
```

Expected: FAIL — "Cannot find module '@/features/api-keys/apiKeyService'"

- [ ] **Step 3: Implement the service**

```typescript
// features/api-keys/apiKeyService.ts
import crypto from 'crypto'
import slugify from 'slugify'
import { createServiceClient } from '@/lib/supabase/service'
import type { ApiKeyListItem, CreateApiKeyResult } from './types'

export function generateApiKey(): string {
  const bytes = crypto.randomBytes(32)
  return `fmblog_${bytes.toString('hex')}`
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export async function createApiKey(
  name: string,
  userId: string
): Promise<CreateApiKeyResult> {
  const rawKey = generateApiKey()
  const keyHash = hashApiKey(rawKey)
  const keyPreview = `fmblog_...${rawKey.slice(-4)}`

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ name, key_hash: keyHash, key_preview: keyPreview, user_id: userId })
    .select('id, name, key_preview, user_id, created_at, last_used_at, is_active')
    .single()

  if (error) throw new Error(error.message)

  return { key: data as ApiKeyListItem, rawKey }
}

export async function listApiKeys(userId: string): Promise<ApiKeyListItem[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_preview, user_id, created_at, last_used_at, is_active')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ApiKeyListItem[]
}

export async function revokeApiKey(id: string, userId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function deleteApiKey(id: string, userId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function validateApiKey(rawKey: string): Promise<string | null> {
  const hash = hashApiKey(rawKey)
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, is_active')
    .eq('key_hash', hash)
    .single()

  if (error || !data || !data.is_active) return null

  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return data.user_id
}

export async function resolveTagIds(
  tagNames: string[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<string[]> {
  const ids: string[] = []

  for (const name of tagNames) {
    const slug = slugify(name, { lower: true, strict: true })

    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      ids.push(existing.id)
    } else {
      const { data: created, error } = await supabase
        .from('tags')
        .insert({ name, slug })
        .select('id')
        .single()

      if (!error && created) ids.push(created.id)
    }
  }

  return ids
}

export async function resolveCategoryId(
  category: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  const slug = slugify(category, { lower: true, strict: true })

  const { data } = await supabase
    .from('categories')
    .select('id')
    .or(`slug.eq.${slug},name.ilike.${category}`)
    .single()

  return data?.id ?? null
}

export async function generateUniqueSlugForApi(
  title: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  const base = slugify(title, { lower: true, strict: true })
  let slug = base
  let counter = 2

  while (true) {
    const { data } = await supabase.from('posts').select('id').eq('slug', slug)
    if (!data || data.length === 0) break
    slug = `${base}-${counter}`
    counter++
  }

  return slug
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/api-keys/apiKeyService.test.ts
```

Expected: all tests pass (generateApiKey, hashApiKey, validateApiKey suites).

- [ ] **Step 5: Commit**

```bash
git add features/api-keys/types.ts features/api-keys/apiKeyService.ts __tests__/api-keys/apiKeyService.test.ts
git commit -m "feat: add api key service with generate, hash, CRUD, and validate functions"
```

---

## Task 5: Key Management API Routes

**Files:**
- Create: `app/api/developer/keys/route.ts`
- Create: `app/api/developer/keys/[id]/route.ts`

- [ ] **Step 1: Write `app/api/developer/keys/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createApiKey, listApiKeys } from '@/features/api-keys/apiKeyService'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null
  return user
}

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const keys = await listApiKeys(user.id)
    return NextResponse.json({ keys })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list keys' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  try {
    const result = await createApiKey(name, user.id)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write `app/api/developer/keys/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revokeApiKey, deleteApiKey } from '@/features/api-keys/apiKeyService'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null
  return user
}

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await revokeApiKey(params.id, user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await deleteApiKey(params.id, user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete key' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/developer/keys/route.ts app/api/developer/keys/[id]/route.ts
git commit -m "feat: add developer key management API routes (list, create, revoke, delete)"
```

---

## Task 6: Post Creation API Route (TDD)

**Files:**
- Create: `app/api/posts/create/route.ts`
- Create: `__tests__/api/posts-create.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/posts-create.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock validateApiKey before importing the route
vi.mock('@/features/api-keys/apiKeyService', () => ({
  validateApiKey: vi.fn(),
  resolveTagIds: vi.fn().mockResolvedValue([]),
  resolveCategoryId: vi.fn().mockResolvedValue(null),
  generateUniqueSlugForApi: vi.fn().mockResolvedValue('test-post'),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { POST } from '@/app/api/posts/create/route'
import { validateApiKey } from '@/features/api-keys/apiKeyService'
import { createServiceClient } from '@/lib/supabase/service'

const mockValidateApiKey = vi.mocked(validateApiKey)
const mockCreateServiceClient = vi.mocked(createServiceClient)

function makeRequest(body: unknown, authHeader?: string): Request {
  return new Request('http://localhost/api/posts/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/posts/create', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = makeRequest({ title: 'Test', content: '<p>Hi</p>' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Missing or invalid Authorization header')
  })

  it('returns 401 when the API key is invalid', async () => {
    mockValidateApiKey.mockResolvedValue(null)
    const req = makeRequest({ title: 'Test', content: '<p>Hi</p>' }, 'Bearer fmblog_invalid')
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Invalid or revoked API key')
  })

  it('returns 400 when title is missing', async () => {
    mockValidateApiKey.mockResolvedValue('user-123')
    const req = makeRequest({ content: '<p>Hi</p>' }, 'Bearer fmblog_valid')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('title')
  })

  it('returns 400 when content is missing', async () => {
    mockValidateApiKey.mockResolvedValue('user-123')
    const req = makeRequest({ title: 'Test' }, 'Bearer fmblog_valid')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('content')
  })

  it('returns 201 with created post on valid request', async () => {
    mockValidateApiKey.mockResolvedValue('user-123')

    const fakePost = {
      id: 'post-abc',
      title: 'Test Post',
      slug: 'test-post',
      status: 'draft',
      author_id: 'user-123',
      content: '<p>Hello</p>',
      excerpt: null,
      cover_image: null,
      category_id: null,
      seo_title: null,
      seo_description: null,
      published_at: null,
      created_at: '2026-04-07T00:00:00Z',
      updated_at: '2026-04-07T00:00:00Z',
    }

    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: fakePost, error: null }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const req = makeRequest(
      { title: 'Test Post', content: '<p>Hello</p>' },
      'Bearer fmblog_valid'
    )
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.post.id).toBe('post-abc')
    expect(json.post.title).toBe('Test Post')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/api/posts-create.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/posts/create/route'"

- [ ] **Step 3: Implement the route**

```typescript
// app/api/posts/create/route.ts
import { NextResponse } from 'next/server'
import {
  validateApiKey,
  resolveTagIds,
  resolveCategoryId,
  generateUniqueSlugForApi,
} from '@/features/api-keys/apiKeyService'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  // 1. Auth: extract and validate Bearer token
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    )
  }

  const rawKey = authHeader.slice(7)
  const userId = await validateApiKey(rawKey)
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
  }

  // 2. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, content, slug, status, excerpt, meta_title, meta_description, tags, category, image_url } = body as {
    title?: string
    content?: string
    slug?: string
    status?: string
    excerpt?: string
    meta_title?: string
    meta_description?: string
    tags?: string[]
    category?: string
    image_url?: string
  }

  // 3. Validate required fields
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const postStatus = status === 'published' ? 'published' : 'draft'
  const supabase = createServiceClient()

  // 4. Resolve slug
  const resolvedSlug = (typeof slug === 'string' && slug.trim())
    ? slug.trim()
    : await generateUniqueSlugForApi(title, supabase)

  // 5. Resolve category_id
  const categoryId = category ? await resolveCategoryId(category, supabase) : null

  // 6. Insert post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      title: title.trim(),
      slug: resolvedSlug,
      content,
      excerpt: typeof excerpt === 'string' ? excerpt : null,
      cover_image: typeof image_url === 'string' ? image_url : null,
      status: postStatus,
      author_id: userId,
      category_id: categoryId,
      seo_title: typeof meta_title === 'string' ? meta_title : title.trim(),
      seo_description: typeof meta_description === 'string'
        ? meta_description
        : (typeof excerpt === 'string' ? excerpt : null),
      published_at: postStatus === 'published' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (postError) {
    return NextResponse.json({ error: postError.message }, { status: 500 })
  }

  // 7. Handle tags
  if (Array.isArray(tags) && tags.length > 0) {
    const tagNames = tags.filter((t) => typeof t === 'string' && t.trim())
    const tagIds = await resolveTagIds(tagNames, supabase)

    if (tagIds.length > 0) {
      await supabase
        .from('post_tags')
        .insert(tagIds.map((tag_id) => ({ post_id: post.id, tag_id })))
    }
  }

  return NextResponse.json({ post }, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/api/posts-create.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/posts/create/route.ts __tests__/api/posts-create.test.ts
git commit -m "feat: add POST /api/posts/create endpoint with API key auth"
```

---

## Task 7: Middleware Update

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add `/dashboard/developer` admin-only protection**

The existing admin check is in the `if (pathname.startsWith('/dashboard/admin'))` block. Add a similar check for `/dashboard/developer` directly below it. The full updated middleware:

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Protect /dashboard/admin and /dashboard/developer — require admin role
    if (
      pathname.startsWith('/dashboard/admin') ||
      pathname.startsWith('/dashboard/developer')
    ) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const profile = profileData as { role: string } | null
      if (profile?.role !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
  ],
}
```

Note: `/api/posts/create` is NOT in the matcher, so it is already excluded from session auth.

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: protect /dashboard/developer route with admin-role check in middleware"
```

---

## Task 8: Sidebar Update

**Files:**
- Modify: `components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Add the `Code` icon import and Developer nav item**

In `components/dashboard/Sidebar.tsx`, update the lucide-react import (currently line 8) to include `Code`:

```typescript
import {
  LayoutDashboard, FileText, PlusCircle, Users, FolderOpen, Tag, LogOut, PenLine, Menu, X, MessageSquare, Loader2, Code,
} from 'lucide-react'
```

Then add the Developer item at the end of the `navItems` array (currently line 40–48):

```typescript
  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
    { href: '/dashboard/posts', icon: FileText, label: 'Posts', show: true },
    { href: '/dashboard/posts/new', icon: PlusCircle, label: 'New Post', show: true },
    { href: '/dashboard/admin/users', icon: Users, label: 'Users', show: can(role, 'users:read') },
    { href: '/dashboard/admin/categories', icon: FolderOpen, label: 'Categories', show: can(role, 'categories:write') },
    { href: '/dashboard/admin/tags', icon: Tag, label: 'Tags', show: can(role, 'tags:write') },
    { href: '/dashboard/comments', icon: MessageSquare, label: 'Comments', show: can(role, 'comments:delete:all') },
    { href: '/dashboard/developer', icon: Code, label: 'Developer', show: can(role, 'api_keys:write') },
  ]
```

- [ ] **Step 2: Run the dev server briefly to verify sidebar renders without errors**

```bash
npm run dev
```

Visit `/dashboard` as admin — verify "Developer" appears in the Admin sidebar section. Visit as author — verify it does not appear.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/Sidebar.tsx
git commit -m "feat: add Developer nav item to sidebar (admin-only)"
```

---

## Task 9: Developer Settings Page

**Files:**
- Create: `app/(dashboard)/dashboard/developer/page.tsx`
- Create: `app/(dashboard)/dashboard/developer/ApiKeysManager.tsx`

- [ ] **Step 1: Write the Server Component page**

```typescript
// app/(dashboard)/dashboard/developer/page.tsx
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { listApiKeys } from '@/features/api-keys/apiKeyService'
import { ApiKeysManager } from './ApiKeysManager'

export const metadata: Metadata = { title: 'Developer Settings' }

export default async function DeveloperPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!can((profileData as { role: string } | null)?.role as Role, 'api_keys:write')) {
    redirect('/dashboard')
  }

  const keys = await listApiKeys(user.id)

  return (
    <div className="p-8 space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Developer Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage API keys for external integrations
        </p>
      </div>
      <ApiKeysManager initialKeys={keys} />
    </div>
  )
}
```

- [ ] **Step 2: Write the Client Component**

```typescript
// app/(dashboard)/dashboard/developer/ApiKeysManager.tsx
'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Key, Plus, Trash2, Ban, Copy, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { ApiKeyListItem } from '@/features/api-keys/types'
import { format } from 'date-fns'

interface ApiKeysManagerProps {
  initialKeys: ApiKeyListItem[]
}

export function ApiKeysManager({ initialKeys }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState<ApiKeyListItem[]>(initialKeys)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleCreate() {
    if (!newKeyName.trim()) return
    setIsCreating(true)

    try {
      const res = await fetch('/api/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to create key')
        return
      }

      const { key, rawKey } = await res.json()
      setKeys((prev) => [key, ...prev])
      setRevealedKey(rawKey)
      setNewKeyName('')
    } catch {
      toast.error('Failed to create key')
    } finally {
      setIsCreating(false)
    }
  }

  function handleDialogClose() {
    if (revealedKey) {
      // Key has been shown — clear it and close
      setRevealedKey(null)
      setCopied(false)
    }
    setDialogOpen(false)
    setNewKeyName('')
  }

  async function handleCopy() {
    if (!revealedKey) return
    await navigator.clipboard.writeText(revealedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/developer/keys/${id}`, { method: 'PATCH' })
    if (!res.ok) {
      toast.error('Failed to revoke key')
      return
    }
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, is_active: false } : k))
    )
    toast.success('Key revoked')
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/developer/keys/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete key')
      return
    }
    setKeys((prev) => prev.filter((k) => k.id !== id))
    toast.success('Key deleted')
  }

  return (
    <div className="space-y-8">
      {/* API Keys section */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 shrink-0">
              <Key className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">API Keys</h2>
              <p className="text-xs text-muted-foreground">{keys.length} key{keys.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Generate New Key
          </Button>
        </div>

        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Key className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-sm text-muted-foreground">No API keys yet. Generate one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Name</th>
                  <th className="text-left pb-2 font-medium">Key</th>
                  <th className="text-left pb-2 font-medium">Created</th>
                  <th className="text-left pb-2 font-medium">Last Used</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-right pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {keys.map((key) => (
                  <tr key={key.id} className="py-3">
                    <td className="py-3 pr-4 font-medium text-gray-900">{key.name}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{key.key_preview}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {key.created_at ? format(new Date(key.created_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {key.last_used_at ? format(new Date(key.last_used_at), 'MMM d, yyyy') : 'Never'}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={key.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {key.is_active ? 'Active' : 'Revoked'}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {key.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(key.id)}
                            className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Revoke
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(key.id)}
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* API Usage section */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">API Usage</h2>
          <p className="text-xs text-muted-foreground">Use your API key to create posts from external tools</p>
        </div>
        <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre">
{`POST https://blog.frankmendez.site/api/posts/create
Authorization: Bearer fmblog_your_key_here
Content-Type: application/json

{
  "title": "Your Post Title",
  "content": "<p>HTML content here</p>",
  "status": "draft",
  "excerpt": "Optional short summary",
  "tags": ["nextjs", "tutorial"],
  "category": "Technology",
  "image_url": "https://example.com/image.jpg"
}`}
        </pre>
      </Card>

      {/* Generate Key Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleDialogClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>
              Give your key a descriptive name so you know where it&apos;s used.
            </DialogDescription>
          </DialogHeader>

          {!revealedKey ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  ref={inputRef}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. n8n workflow, Postman test"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleDialogClose}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={isCreating || !newKeyName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                >
                  {isCreating ? 'Generating…' : 'Generate Key'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  This key will only be shown once. Copy it now — you won&apos;t be able to see it again.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Your API Key</Label>
                <div className="flex gap-2">
                  <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs font-mono break-all">
                    {revealedKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleDialogClose} className="bg-blue-600 hover:bg-blue-700 text-white border-0">
                  I&apos;ve copied my key
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify page renders in the browser**

```bash
npm run dev
```

Navigate to `/dashboard/developer` as admin. Verify:
- Page loads with header "Developer Settings"
- Empty state shows when no keys exist
- "Generate New Key" button opens the dialog
- After creating a key, the raw key is displayed in the dialog with a copy button
- Closing the dialog shows the key in the table with preview only

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/dashboard/developer/page.tsx app/(dashboard)/dashboard/developer/ApiKeysManager.tsx
git commit -m "feat: add Developer Settings page with API key management UI"
```

---

## Task 10: README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the Developer API section at the end of README.md**

Append this section to the bottom of the file:

```markdown
## Developer API

Admins can generate API keys in the dashboard to allow external tools (n8n, Postman, scripts) to create posts without a browser session.

### Accessing Developer Settings

1. Log in as an Admin
2. Navigate to **Dashboard → Developer** in the sidebar
3. Click **Generate New Key**, give it a name, and copy the key — it is shown only once

### API Key Format

Keys are prefixed with `fmblog_` followed by 64 hex characters, e.g. `fmblog_a1b2c3d4...`. Only a SHA-256 hash of the key is stored in the database — the raw key is never persisted.

### POST /api/posts/create

Create a new post from any HTTP client.

**Endpoint:** `POST /api/posts/create`

**Headers:**
```
Authorization: Bearer fmblog_your_key_here
Content-Type: application/json
```

**Body:**
| Field             | Type       | Required | Description                                        |
|-------------------|------------|----------|----------------------------------------------------|
| `title`           | string     | Yes      | Post title                                         |
| `content`         | string     | Yes      | HTML content (TipTap-compatible)                   |
| `slug`            | string     | No       | URL slug — auto-generated from title if omitted    |
| `status`          | `draft` \| `published` | No | Defaults to `draft`               |
| `excerpt`         | string     | No       | Plain-text summary                                 |
| `meta_title`      | string     | No       | SEO title — defaults to `title`                    |
| `meta_description`| string     | No       | SEO description — defaults to `excerpt`            |
| `tags`            | string[]   | No       | Tag names — created automatically if they don't exist |
| `category`        | string     | No       | Category name — matched by name or slug            |
| `image_url`       | string     | No       | Featured/cover image URL                           |

**curl example:**
```bash
curl -X POST https://blog.frankmendez.site/api/posts/create \
  -H "Authorization: Bearer fmblog_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello from n8n",
    "content": "<p>This post was created via the API.</p>",
    "status": "draft",
    "tags": ["automation", "n8n"],
    "category": "Technology"
  }'
```

**Response (201):**
```json
{
  "post": {
    "id": "uuid",
    "title": "Hello from n8n",
    "slug": "hello-from-n8n",
    "status": "draft",
    ...
  }
}
```

### Security Notes

- Raw API keys are **never stored** — only SHA-256 hashes
- The key is shown to the user **exactly once** after generation
- Keys can be revoked (deactivated) or deleted at any time from Developer Settings
- The `/api/posts/create` endpoint is excluded from Supabase session middleware
- `author_id` is always set to the user who owns the API key
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Developer API section to README"
```

---

## Task 11: Final Integration Test

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass, no regressions.

- [ ] **Step 2: Manual smoke test with curl**

Start the dev server (`npm run dev`), generate an API key from the dashboard, then:

```bash
curl -X POST http://localhost:3000/api/posts/create \
  -H "Authorization: Bearer <your-generated-key>" \
  -H "Content-Type: application/json" \
  -d '{"title": "API Test Post", "content": "<p>Created via API</p>"}'
```

Expected: 201 response with the new post object. Verify the post appears in the dashboard.

- [ ] **Step 3: Verify non-admin cannot access `/dashboard/developer`**

Log in as an Author and navigate to `/dashboard/developer` — should redirect to `/dashboard`.

- [ ] **Step 4: Create a final integration commit if needed**

```bash
git add .
git commit -m "chore: verify developer API integration end-to-end"
```
