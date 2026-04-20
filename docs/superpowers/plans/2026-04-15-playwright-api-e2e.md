# Playwright API E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright API end-to-end tests for the five posts API routes (`GET /api/posts`, `POST /api/posts/create`, `GET|PATCH|DELETE /api/posts/[id]`) that run against a real Next.js dev server and a real Supabase test project.

**Architecture:** Playwright's `APIRequestContext` (no browser) issues HTTP calls to a locally running Next.js server. A global setup script seeds one test user, one API key, and three posts into Supabase before the suite runs; global teardown deletes all rows owned by that user afterward. Spec files import a shared `test` fixture that injects the raw API key and seed post IDs.

**Tech Stack:** `@playwright/test` (APIRequestContext), `dotenv`, `@supabase/supabase-js` (setup/teardown only), Node.js `crypto` (key generation).

---

## Prerequisites

- `.env.local` must contain `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing to a **dedicated test Supabase project** (not production).
- The Supabase test project must have the full schema applied (run `database/schema.sql`).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `@playwright/test`, `dotenv` dev deps; add `test:e2e` and `test:e2e:report` scripts |
| `.gitignore` | Modify | Add `.e2e-state.json` |
| `playwright.config.ts` | Create | Playwright config: baseURL, webServer, globalSetup/Teardown, workers=1, no browser |
| `e2e/global-setup.ts` | Create | Seed test user + API key + 3 posts; write `.e2e-state.json` |
| `e2e/global-teardown.ts` | Create | Delete all seeded data by `user_id`; remove `.e2e-state.json` |
| `e2e/fixtures.ts` | Create | Extend base `test` with `apiKey` and `seedPostIds` typed fixtures |
| `e2e/api/posts.list.spec.ts` | Create | Tests for `GET /api/posts` |
| `e2e/api/posts.get.spec.ts` | Create | Tests for `GET /api/posts/[id]` |
| `e2e/api/posts.create.spec.ts` | Create | Tests for `POST /api/posts/create` |
| `e2e/api/posts.update.spec.ts` | Create | Tests for `PATCH /api/posts/[id]` |
| `e2e/api/posts.delete.spec.ts` | Create | Tests for `DELETE /api/posts/[id]` |

---

## Task 1: Install Playwright and update package.json + .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install dev dependencies**

```bash
npm install --save-dev @playwright/test dotenv
```

Expected: `node_modules/@playwright/test` and `node_modules/dotenv` appear. No browser install is needed — we use API-only mode.

- [ ] **Step 2: Add scripts to package.json**

In `package.json`, add to the `"scripts"` block:

```json
"test:e2e": "playwright test",
"test:e2e:report": "playwright show-report"
```

After adding, the scripts section looks like:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:report": "playwright show-report",
  "prepare": "husky"
}
```

- [ ] **Step 3: Add .e2e-state.json to .gitignore**

Append to `.gitignore`:

```
.e2e-state.json
```

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: install playwright and add e2e scripts"
```

---

## Task 2: Create playwright.config.ts

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Create the config file**

Create `playwright.config.ts` at the project root:

```ts
import { defineConfig } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    {
      name: 'api',
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
```

> `workers: 1` ensures spec files run sequentially — required because the delete spec permanently removes a seed post and must not race with the get/update specs.
>
> `reuseExistingServer: true` means if `next dev` is already running locally, Playwright reuses it instead of starting a second instance.

- [ ] **Step 2: Verify config is valid**

```bash
npx playwright --version
```

Expected: prints a version string like `Version 1.x.x` without errors.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: add playwright.config.ts"
```

---

## Task 3: Create e2e/global-setup.ts

**Files:**
- Create: `e2e/global-setup.ts`

This script runs once before all tests. It seeds a deterministic test user, creates an API key, inserts three posts, then writes state to `.e2e-state.json`.

- [ ] **Step 1: Create the file**

```bash
mkdir -p e2e/api
```

Create `e2e/global-setup.ts`:

```ts
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import crypto from 'crypto'

config({ path: '.env.local' })

const E2E_EMAIL = 'e2e-test@playwright.local'

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. Create or reuse test user ──────────────────────────────────────────
  const { data: { users } } = await supabase.auth.admin.listUsers()
  let userId: string
  const existing = users.find((u) => u.email === E2E_EMAIL)

  if (existing) {
    userId = existing.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: E2E_EMAIL,
      password: 'E2eTestPassword123!',
      email_confirm: true,
    })
    if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`)
    userId = data.user.id
  }

  // ── 2. Upsert profiles row ────────────────────────────────────────────────
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, email: E2E_EMAIL, full_name: 'E2E Test User', role: 'author' })
  if (profileError) throw new Error(`Failed to upsert profile: ${profileError.message}`)

  // ── 3. Create API key ─────────────────────────────────────────────────────
  // Remove any leftover keys from a previous run
  await supabase.from('api_keys').delete().eq('user_id', userId)

  const rawBytes = crypto.randomBytes(32)
  const apiKey = `fmblog_${rawBytes.toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  const keyPreview = `fmblog_...${apiKey.slice(-4)}`

  const { error: keyError } = await supabase.from('api_keys').insert({
    name: 'E2E Test Key',
    key_hash: keyHash,
    key_preview: keyPreview,
    user_id: userId,
    is_active: true,
  })
  if (keyError) throw new Error(`Failed to create API key: ${keyError.message}`)

  // ── 4. Seed three posts ───────────────────────────────────────────────────
  // Remove leftover posts from a previous interrupted run
  const { data: oldPosts } = await supabase.from('posts').select('id').eq('author_id', userId)
  if (oldPosts && oldPosts.length > 0) {
    await supabase.from('post_tags').delete().in('post_id', oldPosts.map((p) => p.id))
    await supabase.from('posts').delete().eq('author_id', userId)
  }

  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .insert([
      {
        title: 'E2E Draft Post One',
        slug: 'e2e-draft-post-one',
        content: '<p>Draft content one</p>',
        excerpt: 'Draft excerpt one',
        status: 'draft',
        author_id: userId,
        seo_title: 'E2E Draft Post One',
      },
      {
        title: 'E2E Published Post',
        slug: 'e2e-published-post',
        content: '<p>Published content</p>',
        excerpt: 'Published excerpt',
        status: 'published',
        published_at: new Date().toISOString(),
        author_id: userId,
        seo_title: 'E2E Published Post',
      },
      {
        title: 'E2E Draft Post Two',
        slug: 'e2e-draft-post-two',
        content: '<p>Draft content two</p>',
        excerpt: 'Draft excerpt two',
        status: 'draft',
        author_id: userId,
        seo_title: 'E2E Draft Post Two',
      },
    ])
    .select('id')
  if (postsError || !posts) throw new Error(`Failed to seed posts: ${postsError?.message}`)

  // ── 5. Write state file ───────────────────────────────────────────────────
  const state = { apiKey, userId, seedPostIds: posts.map((p) => p.id) }
  writeFileSync('.e2e-state.json', JSON.stringify(state, null, 2))

  console.log(`✓ E2E setup complete — user: ${E2E_EMAIL}, posts: ${posts.length}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/global-setup.ts
git commit -m "test(e2e): add global setup — seed user, api key, posts"
```

---

## Task 4: Create e2e/global-teardown.ts

**Files:**
- Create: `e2e/global-teardown.ts`

- [ ] **Step 1: Create the file**

Create `e2e/global-teardown.ts`:

```ts
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, unlinkSync, existsSync } from 'fs'

config({ path: '.env.local' })

export default async function globalTeardown() {
  if (!existsSync('.e2e-state.json')) {
    console.log('No .e2e-state.json found — skipping teardown')
    return
  }

  const { userId } = JSON.parse(readFileSync('.e2e-state.json', 'utf8')) as {
    userId: string
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Fetch all post IDs for this user (seed posts + any created by tests)
  const { data: posts } = await supabase
    .from('posts')
    .select('id')
    .eq('author_id', userId)

  const postIds = (posts ?? []).map((p) => p.id)

  if (postIds.length > 0) {
    await supabase.from('post_tags').delete().in('post_id', postIds)
    await supabase.from('posts').delete().eq('author_id', userId)
  }

  await supabase.from('api_keys').delete().eq('user_id', userId)
  await supabase.from('profiles').delete().eq('id', userId)
  await supabase.auth.admin.deleteUser(userId)

  unlinkSync('.e2e-state.json')

  console.log(`✓ E2E teardown complete — all rows for user ${userId} removed`)
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/global-teardown.ts
git commit -m "test(e2e): add global teardown — delete all seeded data by user_id"
```

---

## Task 5: Create e2e/fixtures.ts

**Files:**
- Create: `e2e/fixtures.ts`

- [ ] **Step 1: Create the file**

Create `e2e/fixtures.ts`:

```ts
import { test as base, expect } from '@playwright/test'
import { readFileSync } from 'fs'

interface E2EState {
  apiKey: string
  userId: string
  seedPostIds: string[]
}

function readState(): E2EState {
  return JSON.parse(readFileSync('.e2e-state.json', 'utf8'))
}

export const test = base.extend<{
  apiKey: string
  seedPostIds: string[]
}>({
  apiKey: async ({}, use) => {
    await use(readState().apiKey)
  },
  seedPostIds: async ({}, use) => {
    await use(readState().seedPostIds)
  },
})

export { expect }
```

- [ ] **Step 2: Verify the e2e directory looks right**

```bash
ls e2e/
```

Expected output:
```
api/  fixtures.ts  global-setup.ts  global-teardown.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/fixtures.ts
git commit -m "test(e2e): add fixtures — apiKey and seedPostIds"
```

---

## Task 6: Create posts.list.spec.ts

**Files:**
- Create: `e2e/api/posts.list.spec.ts`

- [ ] **Step 1: Create the spec**

Create `e2e/api/posts.list.spec.ts`:

```ts
import { test, expect } from '../fixtures'

test.describe('GET /api/posts', () => {
  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.get('/api/posts')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test('returns 200 with data array and pagination object', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.pagination).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
      total_pages: expect.any(Number),
      has_next: expect.any(Boolean),
      has_prev: expect.any(Boolean),
    })
  })

  test('pagination.has_prev is false on page 1', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts?page=1', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await res.json()
    expect(body.pagination.has_prev).toBe(false)
  })

  test('returns at least 3 posts (the seeded ones)', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await res.json()
    expect(body.pagination.total).toBeGreaterThanOrEqual(3)
  })

  test('filters by status=published — all returned posts are published', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts?status=published', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    for (const post of body.data as { status: string }[]) {
      expect(post.status).toBe('published')
    }
  })

  test('search filter returns only posts matching the title substring', async ({ request, apiKey }) => {
    const res = await request.get('/api/posts?search=E2E+Published', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.length).toBeGreaterThanOrEqual(1)
    const titles = (body.data as { title: string }[]).map((p) => p.title)
    expect(titles.some((t) => t.includes('E2E Published'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the spec**

Start the Next.js dev server in one terminal if not already running:
```bash
npm run dev
```

Then in another terminal:
```bash
npx playwright test e2e/api/posts.list.spec.ts --reporter=line
```

Expected: all 6 tests pass. If any fail, check that `.env.local` points to your test Supabase project and that the schema is applied.

- [ ] **Step 3: Commit**

```bash
git add e2e/api/posts.list.spec.ts
git commit -m "test(e2e): GET /api/posts — list, auth, pagination, filters"
```

---

## Task 7: Create posts.get.spec.ts

**Files:**
- Create: `e2e/api/posts.get.spec.ts`

- [ ] **Step 1: Create the spec**

Create `e2e/api/posts.get.spec.ts`:

```ts
import { test, expect } from '../fixtures'

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('GET /api/posts/[id]', () => {
  test('returns 401 with no Authorization header', async ({ request, seedPostIds }) => {
    const res = await request.get(`/api/posts/${seedPostIds[0]}`)
    expect(res.status()).toBe(401)
  })

  test('returns 404 for a nonexistent post ID', async ({ request, apiKey }) => {
    const res = await request.get(`/api/posts/${NONEXISTENT_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(404)
  })

  test('returns 200 with the full post shape for a valid ID', async ({ request, apiKey, seedPostIds }) => {
    const res = await request.get(`/api/posts/${seedPostIds[0]}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      id: seedPostIds[0],
      title: 'E2E Draft Post One',
      slug: 'e2e-draft-post-one',
      status: 'draft',
      content: expect.any(String),
      meta_title: expect.any(String),
      tags: expect.any(Array),
    })
  })
})
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test e2e/api/posts.get.spec.ts --reporter=line
```

Expected: all 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/api/posts.get.spec.ts
git commit -m "test(e2e): GET /api/posts/[id] — auth, 404, full post shape"
```

---

## Task 8: Create posts.create.spec.ts

**Files:**
- Create: `e2e/api/posts.create.spec.ts`

The `afterEach` hook deletes any post created during the test via the API's DELETE endpoint. This keeps the suite idempotent without needing Supabase credentials in the spec file.

- [ ] **Step 1: Create the spec**

Create `e2e/api/posts.create.spec.ts`:

```ts
import { test, expect } from '../fixtures'

test.describe('POST /api/posts/create', () => {
  let createdPostId: string | null = null

  test.afterEach(async ({ request, apiKey }) => {
    if (createdPostId) {
      await request.delete(`/api/posts/${createdPostId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      createdPostId = null
    }
  })

  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.post('/api/posts/create', {
      data: { title: 'Unauthorized Post', content: '<p>Content</p>' },
    })
    expect(res.status()).toBe(401)
  })

  test('returns 400 when title is missing', async ({ request, apiKey }) => {
    const res = await request.post('/api/posts/create', {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { content: '<p>No title here</p>' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/title/i)
  })

  test('returns 400 when content is missing', async ({ request, apiKey }) => {
    const res = await request.post('/api/posts/create', {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { title: 'No Content Post' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/content/i)
  })

  test('returns 201 with the created post for a valid body', async ({ request, apiKey }) => {
    const res = await request.post('/api/posts/create', {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        title: 'E2E Created Post',
        content: '<p>Created during e2e test run</p>',
        excerpt: 'E2E excerpt',
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.post).toMatchObject({
      title: 'E2E Created Post',
      status: 'draft',
    })
    expect(typeof body.data.post.id).toBe('string')
    createdPostId = body.data.post.id
  })
})
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test e2e/api/posts.create.spec.ts --reporter=line
```

Expected: all 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/api/posts.create.spec.ts
git commit -m "test(e2e): POST /api/posts/create — auth, validation, 201 happy path"
```

---

## Task 9: Create posts.update.spec.ts

**Files:**
- Create: `e2e/api/posts.update.spec.ts`

Uses `seedPostIds[0]` (E2E Draft Post One). Teardown will clean up the modified title — it deletes by `user_id`, not by field values.

- [ ] **Step 1: Create the spec**

Create `e2e/api/posts.update.spec.ts`:

```ts
import { test, expect } from '../fixtures'

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('PATCH /api/posts/[id]', () => {
  test('returns 401 with no Authorization header', async ({ request, seedPostIds }) => {
    const res = await request.patch(`/api/posts/${seedPostIds[0]}`, {
      data: { title: 'Should Not Update' },
    })
    expect(res.status()).toBe(401)
  })

  test('returns 404 for a nonexistent post ID', async ({ request, apiKey }) => {
    const res = await request.patch(`/api/posts/${NONEXISTENT_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { title: 'Ghost Post' },
    })
    expect(res.status()).toBe(404)
  })

  test('returns 200 with updated title reflected in response', async ({ request, apiKey, seedPostIds }) => {
    const res = await request.patch(`/api/posts/${seedPostIds[0]}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { title: 'E2E Updated Title' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.title).toBe('E2E Updated Title')
    expect(body.data.id).toBe(seedPostIds[0])
  })
})
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test e2e/api/posts.update.spec.ts --reporter=line
```

Expected: all 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/api/posts.update.spec.ts
git commit -m "test(e2e): PATCH /api/posts/[id] — auth, 404, successful update"
```

---

## Task 10: Create posts.delete.spec.ts

**Files:**
- Create: `e2e/api/posts.delete.spec.ts`

Uses `seedPostIds[2]` (E2E Draft Post Two) — distinct from what update uses — so delete and update can't interfere. After deletion the teardown's `DELETE ... WHERE author_id = userId` simply finds no row for that post, which is safe.

- [ ] **Step 1: Create the spec**

Create `e2e/api/posts.delete.spec.ts`:

```ts
import { test, expect } from '../fixtures'

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('DELETE /api/posts/[id]', () => {
  test('returns 401 with no Authorization header', async ({ request, seedPostIds }) => {
    const res = await request.delete(`/api/posts/${seedPostIds[2]}`)
    expect(res.status()).toBe(401)
  })

  test('returns 404 for a nonexistent post ID', async ({ request, apiKey }) => {
    const res = await request.delete(`/api/posts/${NONEXISTENT_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.status()).toBe(404)
  })

  test('returns 200 and a subsequent GET for that ID returns 404', async ({ request, apiKey, seedPostIds }) => {
    const postId = seedPostIds[2]

    const deleteRes = await request.delete(`/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(deleteRes.status()).toBe(200)
    const deleteBody = await deleteRes.json()
    expect(deleteBody.success).toBe(true)

    const getRes = await request.get(`/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(getRes.status()).toBe(404)
  })
})
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test e2e/api/posts.delete.spec.ts --reporter=line
```

Expected: all 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/api/posts.delete.spec.ts
git commit -m "test(e2e): DELETE /api/posts/[id] — auth, 404, delete + verify gone"
```

---

## Task 11: Full suite run and final verification

- [ ] **Step 1: Run the complete e2e suite**

```bash
npm run test:e2e
```

Expected output (all 19 tests pass):
```
Running 19 tests using 1 worker

  ✓ GET /api/posts › returns 401 with no Authorization header
  ✓ GET /api/posts › returns 200 with data array and pagination object
  ✓ GET /api/posts › pagination.has_prev is false on page 1
  ✓ GET /api/posts › returns at least 3 posts (the seeded ones)
  ✓ GET /api/posts › filters by status=published — all returned posts are published
  ✓ GET /api/posts › search filter returns only posts matching the title substring
  ✓ GET /api/posts/[id] › returns 401 with no Authorization header
  ✓ GET /api/posts/[id] › returns 404 for a nonexistent post ID
  ✓ GET /api/posts/[id] › returns 200 with the full post shape for a valid ID
  ✓ POST /api/posts/create › returns 401 with no Authorization header
  ✓ POST /api/posts/create › returns 400 when title is missing
  ✓ POST /api/posts/create › returns 400 when content is missing
  ✓ POST /api/posts/create › returns 201 with the created post for a valid body
  ✓ PATCH /api/posts/[id] › returns 401 with no Authorization header
  ✓ PATCH /api/posts/[id] › returns 404 for a nonexistent post ID
  ✓ PATCH /api/posts/[id] › returns 200 with updated title reflected in response
  ✓ DELETE /api/posts/[id] › returns 401 with no Authorization header
  ✓ DELETE /api/posts/[id] › returns 404 for a nonexistent post ID
  ✓ DELETE /api/posts/[id] › returns 200 and a subsequent GET for that ID returns 404

  19 passed (Xs)
```

- [ ] **Step 2: Verify teardown cleaned up (optional sanity check)**

After the run, confirm `.e2e-state.json` no longer exists:

```bash
ls .e2e-state.json 2>/dev/null && echo "FOUND — teardown may have failed" || echo "Cleaned up correctly"
```

Expected: `Cleaned up correctly`

- [ ] **Step 3: View the HTML report**

```bash
npm run test:e2e:report
```

Expected: browser opens with the Playwright HTML report showing all 19 passed tests.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test(e2e): complete Playwright API e2e suite — 19 tests across 5 post routes"
```
