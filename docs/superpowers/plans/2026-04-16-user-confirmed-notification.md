# User Registration Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit an event when a user confirms their email and notify the admin via Resend email and Slack Incoming Webhook.

**Architecture:** A Postgres trigger fires when `auth.users.confirmed_at` transitions from NULL to a value and syncs it to `public.profiles.confirmed_at`. A Supabase Database Webhook watches `public.profiles` for that UPDATE and calls `/api/webhooks/user-confirmed`, which verifies a shared secret then calls `lib/notifications/user-confirmed.ts` to send both notifications in parallel.

**Tech Stack:** Next.js App Router (API route), Resend SDK, Slack Incoming Webhook (fetch), Supabase Postgres trigger, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `database/migrations/add_confirmed_at_to_profiles.sql` | Create | Add `confirmed_at` column + trigger function + trigger |
| `lib/supabase/types.ts` | Modify | Add `confirmed_at` to `profiles` Row/Insert/Update types |
| `lib/notifications/user-confirmed.ts` | Create | `sendAdminEmail` and `sendSlackNotification` |
| `app/api/webhooks/user-confirmed/route.ts` | Create | Verify secret, parse payload, call notifications |
| `__tests__/lib/notifications/user-confirmed.test.ts` | Create | Unit tests for notification service |
| `__tests__/api/webhooks/user-confirmed.test.ts` | Create | Unit tests for webhook route |
| `vitest.config.ts` | Modify | Add new files to coverage include list |
| `docs/setup/webhooks.md` | Create | One-time Supabase Dashboard setup instructions |

---

## Task 1: Install Resend and configure environment variables

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.local`

- [ ] **Step 1: Install the Resend SDK**

```bash
npm install resend
```

Expected output: `added 1 package` (or similar). No errors.

- [ ] **Step 2: Add new env vars to `.env.local`**

Open `.env.local` and append these four lines (fill in your actual values):

```
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
WEBHOOK_SECRET=a_random_secret_string_min_32_chars
```

> `RESEND_FROM_EMAIL` must be a verified sender domain in your Resend account. `WEBHOOK_SECRET` can be any random string — generate one with `openssl rand -hex 32`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install resend SDK"
```

---

## Task 2: Database migration

**Files:**
- Create: `database/migrations/add_confirmed_at_to_profiles.sql`

- [ ] **Step 1: Create the migration file**

Create `database/migrations/add_confirmed_at_to_profiles.sql` with this content:

```sql
-- ============================================================
-- Migration: add confirmed_at to profiles + sync trigger
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add confirmed_at column to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- 2. Backfill confirmed_at for any already-confirmed users
UPDATE public.profiles p
SET confirmed_at = u.confirmed_at
FROM auth.users u
WHERE p.id = u.id
  AND u.confirmed_at IS NOT NULL
  AND p.confirmed_at IS NULL;

-- 3. Trigger function: sync confirmed_at from auth.users to profiles
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when confirmed_at transitions from NULL to a value
  IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET confirmed_at = NEW.confirmed_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger on auth.users UPDATE
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_confirmed();
```

- [ ] **Step 2: Run the migration in Supabase**

Paste the contents of the file into the **Supabase Dashboard → SQL Editor** and run it. Verify no errors appear. You should see the `confirmed_at` column in `public.profiles` via **Table Editor**.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/add_confirmed_at_to_profiles.sql
git commit -m "feat: add confirmed_at migration and sync trigger"
```

---

## Task 3: Update TypeScript types

**Files:**
- Modify: `lib/supabase/types.ts:204-233`

- [ ] **Step 1: Add `confirmed_at` to the profiles type definition**

In `lib/supabase/types.ts`, find the `profiles` table definition (around line 204). Add `confirmed_at` to the `Row`, `Insert`, and `Update` interfaces:

```typescript
      profiles: {
        Row: {
          avatar_url: string | null
          confirmed_at: string | null        // ← add this line
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          confirmed_at?: string | null       // ← add this line
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          confirmed_at?: string | null       // ← add this line
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add confirmed_at to Profile type"
```

---

## Task 4: Notification service (TDD)

**Files:**
- Create: `__tests__/lib/notifications/user-confirmed.test.ts`
- Create: `lib/notifications/user-confirmed.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/notifications/user-confirmed.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { sendAdminEmail, sendSlackNotification } from '@/lib/notifications/user-confirmed'

const profile = {
  id: 'user-123',
  email: 'jane@example.com',
  full_name: 'Jane Doe',
  confirmed_at: '2026-04-16T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('RESEND_API_KEY', 'test-resend-key')
  vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@example.com')
  vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
  vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/test')
})

describe('sendAdminEmail', () => {
  it('sends email to ADMIN_EMAIL with correct subject using full_name', async () => {
    mockSend.mockResolvedValue({ id: 'email-id' })
    await sendAdminEmail(profile)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'New user registered: Jane Doe',
      })
    )
  })

  it('uses email as display name when full_name is null', async () => {
    mockSend.mockResolvedValue({ id: 'email-id' })
    await sendAdminEmail({ ...profile, full_name: null })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'New user registered: jane@example.com',
      })
    )
  })

  it('includes user id and email in the html body', async () => {
    mockSend.mockResolvedValue({ id: 'email-id' })
    await sendAdminEmail(profile)
    const call = mockSend.mock.calls[0][0]
    expect(call.html).toContain('user-123')
    expect(call.html).toContain('jane@example.com')
  })
})

describe('sendSlackNotification', () => {
  it('posts to SLACK_WEBHOOK_URL with profile name and email', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await sendSlackNotification(profile)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text).toContain('Jane Doe')
    expect(body.text).toContain('jane@example.com')
  })

  it('uses email as display name when full_name is null', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await sendSlackNotification({ ...profile, full_name: null })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text).toContain('jane@example.com')
    expect(body.text).not.toContain('null')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run __tests__/lib/notifications/user-confirmed.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/notifications/user-confirmed'`

- [ ] **Step 3: Implement the notification service**

Create `lib/notifications/user-confirmed.ts`:

```typescript
import { Resend } from 'resend'

interface NotificationProfile {
  id: string
  email: string
  full_name: string | null
  confirmed_at: string | null
}

export async function sendAdminEmail(profile: NotificationProfile): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const displayName = profile.full_name ?? profile.email

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: process.env.ADMIN_EMAIL!,
    subject: `New user registered: ${displayName}`,
    html: `
      <h2>New user registered</h2>
      <p><strong>Name:</strong> ${displayName}</p>
      <p><strong>Email:</strong> ${profile.email}</p>
      <p><strong>User ID:</strong> ${profile.id}</p>
      <p><strong>Confirmed at:</strong> ${profile.confirmed_at}</p>
    `,
  })
}

export async function sendSlackNotification(profile: NotificationProfile): Promise<void> {
  const displayName = profile.full_name ?? profile.email

  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `New user confirmed: *${displayName}* (${profile.email}) — ID: \`${profile.id}\``,
    }),
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run __tests__/lib/notifications/user-confirmed.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/user-confirmed.ts __tests__/lib/notifications/user-confirmed.test.ts
git commit -m "feat: add notification service for user email confirmation"
```

---

## Task 5: Webhook API route (TDD)

**Files:**
- Create: `__tests__/api/webhooks/user-confirmed.test.ts`
- Create: `app/api/webhooks/user-confirmed/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/webhooks/user-confirmed.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/notifications/user-confirmed', () => ({
  sendAdminEmail: vi.fn().mockResolvedValue(undefined),
  sendSlackNotification: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '@/app/api/webhooks/user-confirmed/route'
import { sendAdminEmail, sendSlackNotification } from '@/lib/notifications/user-confirmed'

const mockSendAdminEmail = vi.mocked(sendAdminEmail)
const mockSendSlackNotification = vi.mocked(sendSlackNotification)

const WEBHOOK_SECRET = 'test-secret-value'

function makeRequest(body: unknown, secret?: string): Request {
  return new Request('http://localhost/api/webhooks/user-confirmed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret !== undefined ? { 'x-webhook-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  })
}

const validPayload = {
  type: 'UPDATE',
  table: 'profiles',
  record: {
    id: 'user-123',
    email: 'jane@example.com',
    full_name: 'Jane Doe',
    confirmed_at: '2026-04-16T10:00:00Z',
  },
  old_record: {
    id: 'user-123',
    email: 'jane@example.com',
    full_name: 'Jane Doe',
    confirmed_at: null,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('WEBHOOK_SECRET', WEBHOOK_SECRET)
})

describe('POST /api/webhooks/user-confirmed', () => {
  it('returns 401 when x-webhook-secret header is missing', async () => {
    const req = makeRequest(validPayload)
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 when x-webhook-secret is incorrect', async () => {
    const req = makeRequest(validPayload, 'wrong-secret')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/webhooks/user-confirmed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 400 when confirmed_at is null in record', async () => {
    const req = makeRequest(
      { ...validPayload, record: { ...validPayload.record, confirmed_at: null } },
      WEBHOOK_SECRET
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Missing confirmed_at')
  })

  it('returns 200 and calls both notification functions on valid payload', async () => {
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockSendAdminEmail).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'jane@example.com',
      full_name: 'Jane Doe',
      confirmed_at: '2026-04-16T10:00:00Z',
    })
    expect(mockSendSlackNotification).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'jane@example.com',
      full_name: 'Jane Doe',
      confirmed_at: '2026-04-16T10:00:00Z',
    })
  })

  it('returns 200 even when sendAdminEmail throws', async () => {
    mockSendAdminEmail.mockRejectedValue(new Error('Resend API error'))
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('returns 200 even when sendSlackNotification throws', async () => {
    mockSendSlackNotification.mockRejectedValue(new Error('Slack error'))
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('still calls sendSlackNotification when sendAdminEmail throws', async () => {
    mockSendAdminEmail.mockRejectedValue(new Error('Resend error'))
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    await POST(req)
    expect(mockSendSlackNotification).toHaveBeenCalled()
  })

  it('still calls sendAdminEmail when sendSlackNotification throws', async () => {
    mockSendSlackNotification.mockRejectedValue(new Error('Slack error'))
    const req = makeRequest(validPayload, WEBHOOK_SECRET)
    await POST(req)
    expect(mockSendAdminEmail).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run __tests__/api/webhooks/user-confirmed.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/webhooks/user-confirmed/route'`

- [ ] **Step 3: Create the route directory and implement the handler**

```bash
mkdir -p app/api/webhooks/user-confirmed
```

Create `app/api/webhooks/user-confirmed/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { sendAdminEmail, sendSlackNotification } from '@/lib/notifications/user-confirmed'

interface WebhookPayload {
  type: string
  table: string
  record: {
    id: string
    email: string
    full_name: string | null
    confirmed_at: string | null
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: WebhookPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, email, full_name, confirmed_at } = body.record

  if (!confirmed_at) {
    return NextResponse.json({ error: 'Missing confirmed_at' }, { status: 400 })
  }

  const profile = { id, email, full_name, confirmed_at }

  await Promise.all([
    sendAdminEmail(profile).catch((err) =>
      console.error('[webhook] sendAdminEmail failed:', err)
    ),
    sendSlackNotification(profile).catch((err) =>
      console.error('[webhook] sendSlackNotification failed:', err)
    ),
  ])

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run the tests to verify they all pass**

```bash
npx vitest run __tests__/api/webhooks/user-confirmed.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/user-confirmed/route.ts __tests__/api/webhooks/user-confirmed.test.ts
git commit -m "feat: add webhook handler for user email confirmation"
```

---

## Task 6: Add new files to coverage config and write setup docs

**Files:**
- Modify: `vitest.config.ts:16-49`
- Create: `docs/setup/webhooks.md`

- [ ] **Step 1: Add new files to the coverage `include` array in `vitest.config.ts`**

In `vitest.config.ts`, find the `coverage.include` array and add two lines:

```typescript
        // notifications
        'lib/notifications/user-confirmed.ts',
        // webhook routes
        'app/api/webhooks/user-confirmed/route.ts',
```

The array should look like this after the change (excerpt):

```typescript
      include: [
        // lib core logic
        'lib/utils.ts',
        'lib/permissions/index.ts',
        'lib/store/taxonomy.ts',
        'lib/apiAuth.ts',
        'lib/apiHelpers.ts',
        'lib/rateLimit.ts',
        'lib/encryption.ts',
        'lib/api/auth.ts',
        'lib/auth/session.ts',
        // notifications
        'lib/notifications/user-confirmed.ts',
        // features
        ...
        // webhook routes
        'app/api/webhooks/user-confirmed/route.ts',
        // api routes (existing entries)
        'app/api/posts/route.ts',
        ...
      ],
```

- [ ] **Step 2: Run full test suite to confirm nothing broke**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Create Supabase webhook setup documentation**

Create `docs/setup/webhooks.md`:

```markdown
# Supabase Database Webhook Setup

## User Confirmed Notification Webhook

This webhook fires when a user confirms their email and triggers admin notifications (email + Slack).

### One-time setup in Supabase Dashboard

1. Go to **Database → Webhooks** in the Supabase Dashboard
2. Click **Create a new hook**
3. Fill in the following fields:

| Field | Value |
|---|---|
| **Name** | `user-confirmed-notification` |
| **Table** | `public.profiles` |
| **Events** | `UPDATE` |
| **Type** | HTTP Request |
| **Method** | POST |
| **URL** | `https://your-domain.com/api/webhooks/user-confirmed` |

4. Under **HTTP Headers**, add:

| Header | Value |
|---|---|
| `x-webhook-secret` | *(value of your `WEBHOOK_SECRET` env var)* |

5. Click **Confirm** to save.

### Optional: filter to reduce noise

To avoid triggering the webhook on every profile update (e.g. role changes), add a filter condition:

- **Column:** `confirmed_at`
- **Operator:** `is not`
- **Value:** `null`

This ensures the webhook only fires when `confirmed_at` is set.

### Required environment variables

Make sure these are set in `.env.local` (dev) and in your Vercel / hosting environment (prod):

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=
ADMIN_EMAIL=
SLACK_WEBHOOK_URL=
WEBHOOK_SECRET=
```
```

- [ ] **Step 4: Commit**

```bash
git add -f docs/setup/webhooks.md vitest.config.ts
git commit -m "chore: add coverage config and webhook setup docs"
```

---

## Done

At this point:
- The Postgres trigger syncs email confirmation from `auth.users` to `public.profiles`
- The webhook route verifies the secret and calls both notifications in parallel
- Failures in one notification do not block the other
- All new code has test coverage
- Setup instructions are documented in `docs/setup/webhooks.md`

**Final step (manual):** Follow `docs/setup/webhooks.md` to configure the Supabase Database Webhook in the dashboard, pointing at your deployed URL.
