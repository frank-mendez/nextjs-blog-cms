# Playwright API E2E Design

**Date:** 2026-04-15  
**Status:** Approved  
**Scope:** API-key-authenticated posts routes only

---

## Overview

Add end-to-end API tests using Playwright's `APIRequestContext` (no browser). Tests run against a real Next.js dev server connected to a dedicated Supabase test project. A single global setup seeds one test user and API key; teardown removes all seeded data by `user_id`.

---

## Tooling

**New dev dependencies:**
- `@playwright/test` — test runner and `APIRequestContext`
- `dotenv` — load `.env.local` in setup/teardown scripts

**New npm scripts:**
```json
"test:e2e": "playwright test",
"test:e2e:report": "playwright show-report"
```

**`.e2e-state.json`** — gitignored temp file written by global-setup, read by fixtures, deleted by global-teardown.

---

## Directory Structure

```
playwright.config.ts
e2e/
  global-setup.ts
  global-teardown.ts
  fixtures.ts
  api/
    posts.list.spec.ts
    posts.get.spec.ts
    posts.create.spec.ts
    posts.update.spec.ts
    posts.delete.spec.ts
```

---

## `playwright.config.ts`

- `testDir`: `./e2e`
- `globalSetup`: `./e2e/global-setup.ts`
- `globalTeardown`: `./e2e/global-teardown.ts`
- No browser projects (API-only)
- `webServer`: starts `next dev`, waits for `http://localhost:3000`, reuses existing server if already running
- `use.baseURL`: `http://localhost:3000`

---

## Global Setup (`e2e/global-setup.ts`)

Runs once before the entire suite. Steps:

1. Load `.env.local` via `dotenv`
2. Create test user via `supabase.auth.admin.createUser()` with deterministic email `e2e-test@playwright.local`
3. Upsert a `profiles` row (`role: 'author'`) for that user
4. Generate a raw API key with `generateApiKey()`, hash it, insert into `api_keys`
5. Insert 3 seed posts (`draft`, `published`, `draft`) with `author_id = userId`
6. Write `{ apiKey, userId, seedPostIds }` to `.e2e-state.json`

---

## Global Teardown (`e2e/global-teardown.ts`)

Runs once after the entire suite. Steps:

1. Load `.env.local`
2. Read `.e2e-state.json`
3. Delete all `post_tags` rows for posts owned by `userId`
4. Delete all `posts` rows with `author_id = userId` (covers seed posts and any posts created during tests)
5. Delete `api_keys` rows with `user_id = userId`
6. Delete the `profiles` row for `userId`
7. Delete the auth user via `supabase.auth.admin.deleteUser(userId)`
8. Remove `.e2e-state.json`

Teardown targets rows by `user_id` so it is safe even if a test crashes mid-run.

---

## Fixtures (`e2e/fixtures.ts`)

Extends Playwright's base `test` with two typed fixtures:

- `apiKey: string` — the raw API key read from `.e2e-state.json`; used as `Authorization: Bearer <apiKey>`
- `seedPostIds: string[]` — IDs of the 3 pre-seeded posts

All spec files import `test` from `fixtures.ts` instead of `@playwright/test`.

---

## Test Specs

### `posts.list.spec.ts` — `GET /api/posts`

| Case | Expected |
|------|----------|
| No `Authorization` header | 401 |
| Valid auth | 200 with `data[]` and `pagination` object |
| `pagination` fields | correct `total`, `has_next`, `has_prev` |
| `?status=published` filter | only published posts returned |
| `?search=<title-substring>` filter | matching posts returned |

### `posts.get.spec.ts` — `GET /api/posts/[id]`

| Case | Expected |
|------|----------|
| No auth | 401 |
| Nonexistent post ID | 404 |
| Valid auth + valid ID | 200 with full post shape (`id`, `title`, `slug`, `content`, `status`, `meta_title`, `tags`, etc.) |

### `posts.create.spec.ts` — `POST /api/posts/create`

| Case | Expected |
|------|----------|
| No auth | 401 |
| Missing `title` | 400 |
| Missing `content` | 400 |
| Valid body | 201 with `{ success: true, data: { post } }` |

Created posts are deleted in `afterEach` using the Supabase service client (tracked by post ID from the response).

### `posts.update.spec.ts` — `PATCH /api/posts/[id]`

| Case | Expected |
|------|----------|
| No auth | 401 |
| Nonexistent post ID | 404 |
| Valid auth + valid ID + body | 200 with updated fields in response |

### `posts.delete.spec.ts` — `DELETE /api/posts/[id]`

| Case | Expected |
|------|----------|
| No auth | 401 |
| Nonexistent post ID | 404 |
| Valid auth + valid ID | 200; subsequent GET returns 404 |

---

## State File Schema

```ts
interface E2EState {
  apiKey: string      // raw key, e.g. "fmblog_abc123..."
  userId: string      // UUID of the test auth user
  seedPostIds: string[] // IDs of the 3 pre-seeded posts
}
```

---

## Environment Variables Required

These must exist in `.env.local` (already required by the app):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The Supabase project used for e2e should be a **separate test project**, not production.

---

## Out of Scope

- Session-authenticated routes (`/api/developer/keys`, `/api/ai-assistant/*`)
- AI assistant routes (requires live LLM provider keys)
- Browser / UI testing
- CI integration (local only for now)
