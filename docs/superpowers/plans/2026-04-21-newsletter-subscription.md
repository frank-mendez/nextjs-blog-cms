# Newsletter Subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full newsletter subscription feature: readers subscribe at the bottom of each blog post, and when a post is published it is emailed to all active subscribers after a configurable delay via a Vercel Cron job.

**Architecture:** Subscribers and send queue are stored in Supabase (service-role only, no RLS public access). Publishing a post writes a row to `newsletter_sends` with a future `scheduled_at`. A Vercel Cron job running every minute polls for pending sends and dispatches emails via the existing Resend integration. Unsubscribe is one-click via a UUID token in every email.

**Tech Stack:** Next.js App Router · Supabase (Postgres) · Resend · Vercel Cron · React Hook Form + Zod · shadcn/ui · Vitest

---

## File Structure

**New files:**
- `supabase/migrations/20260421000000_add_newsletter_tables.sql` — tables + RLS (inline, matches existing pattern)
- `features/newsletter/types.ts` — `NewsletterSubscription`, `NewsletterSend`, `SubscriberStats`
- `features/newsletter/queries.ts` — `getActiveSubscribers`, `getSubscriberStats`, `getScheduledSends`, `getRecentSubscribers`
- `features/newsletter/actions.ts` — `scheduleNewsletterSend` server action
- `lib/notifications/newsletter.ts` — `sendNewsletterEmail` via Resend
- `app/api/newsletter/subscribe/route.ts` — `POST` subscribe endpoint
- `app/api/newsletter/unsubscribe/route.ts` — `GET ?token=` one-click unsubscribe
- `app/api/newsletter/send/route.ts` — `GET` Vercel Cron endpoint
- `app/api/newsletter/subscribers/export/route.ts` — `GET` CSV export
- `components/newsletter/SubscribeForm.tsx` — subscribe widget (client component)
- `app/(dashboard)/dashboard/admin/newsletter/page.tsx` — admin panel
- `app/(public)/newsletter/unsubscribed/page.tsx` — unsubscribe confirmation page
- `vercel.json` — cron schedule config
- `__tests__/api/newsletter/subscribe.test.ts` — subscribe route tests
- `__tests__/api/newsletter/unsubscribe.test.ts` — unsubscribe route tests

**Modified files:**
- `features/posts/actions.ts` — call `scheduleNewsletterSend` inside `publishPost`
- `app/(public)/blog/[slug]/page.tsx` — add `SubscribeForm` before `CommentSection`
- `vitest.config.ts` — add newsletter routes to coverage
- `README.md` — document newsletter feature + new env vars

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260421000000_add_newsletter_tables.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration: add_newsletter_tables
-- Created: 2026-04-21

-- ============================================
-- TABLES
-- ============================================

create table if not exists public.newsletter_subscriptions (
  id                uuid        default gen_random_uuid() primary key,
  email             text        not null unique,
  subscribed_at     timestamptz not null default now(),
  unsubscribed_at   timestamptz,
  unsubscribe_token text        not null unique
);

create table if not exists public.newsletter_sends (
  id                   uuid        default gen_random_uuid() primary key,
  post_id              uuid        not null unique references public.posts(id) on delete cascade,
  scheduled_at         timestamptz not null,
  status               text        not null default 'pending'
                                   check (status in ('pending', 'sending', 'sent', 'failed')),
  sending_started_at   timestamptz,
  sent_at              timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists newsletter_sends_status_scheduled_idx
  on public.newsletter_sends (status, scheduled_at)
  where status = 'pending';

-- ============================================
-- RLS
-- ============================================

alter table public.newsletter_subscriptions enable row level security;
alter table public.newsletter_sends         enable row level security;

-- Service role bypasses RLS — no public policies needed.
-- All access goes through the service role client in API routes.
```

- [ ] **Step 2: Apply the migration locally**

```bash
npx supabase db push
```

Expected: migration applied, tables visible in Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421000000_add_newsletter_tables.sql
git commit -m "feat: add newsletter_subscriptions and newsletter_sends tables"
```

---

## Task 2: Newsletter Types

**Files:**
- Create: `features/newsletter/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
export type NewsletterSubscription = {
  id: string
  email: string
  subscribed_at: string
  unsubscribed_at: string | null
  unsubscribe_token: string
}

export type NewsletterSend = {
  id: string
  post_id: string
  scheduled_at: string
  status: 'pending' | 'sending' | 'sent' | 'failed'
  sending_started_at: string | null
  sent_at: string | null
  created_at: string
}

export type SubscriberStats = {
  active: number
  sends_dispatched: number
  unsubscribed: number
}
```

- [ ] **Step 2: Commit**

```bash
git add features/newsletter/types.ts
git commit -m "feat: add newsletter types"
```

---

## Task 3: Newsletter Email Sender

**Files:**
- Create: `lib/notifications/newsletter.ts`

- [ ] **Step 1: Create the email sender**

```typescript
import { Resend } from 'resend'
import type { NewsletterSubscription } from '@/features/newsletter/types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeSubject(str: string): string {
  return str.replace(/[\r\n\x00-\x1F\x7F]/g, '')
}

export interface PostEmailData {
  title: string
  slug: string
  excerpt: string | null
  cover_image: string | null
}

export async function sendNewsletterEmail(
  subscriber: NewsletterSubscription,
  post: PostEmailData
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  if (!fromEmail) throw new Error('RESEND_FROM_EMAIL is not configured')

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
  const resend = new Resend(apiKey)

  const postUrl = `${siteUrl}/blog/${post.slug}`
  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${subscriber.unsubscribe_token}`
  const title = escapeHtml(post.title)
  const excerpt = post.excerpt ? escapeHtml(post.excerpt) : ''

  await resend.emails.send({
    from: fromEmail,
    to: subscriber.email,
    subject: sanitizeSubject(`New post: ${post.title}`),
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="font-size:24px;font-weight:700;margin-bottom:8px;">${title}</h1>
        ${excerpt ? `<p style="color:#6b7280;margin-bottom:16px;">${excerpt}</p>` : ''}
        ${post.cover_image ? `<img src="${escapeHtml(post.cover_image)}" alt="${title}" style="width:100%;border-radius:8px;margin-bottom:16px;" />` : ''}
        <a href="${postUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Read Post</a>
        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;" />
        <p style="color:#9ca3af;font-size:12px;">
          You're receiving this because you subscribed to new posts.
          <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a>
        </p>
      </div>
    `,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/notifications/newsletter.ts
git commit -m "feat: add sendNewsletterEmail via Resend"
```

---

## Task 4: Subscribe API Route (TDD)

**Files:**
- Create: `__tests__/api/newsletter/subscribe.test.ts`
- Create: `app/api/newsletter/subscribe/route.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/newsletter/subscribe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/service'
import { POST } from '@/app/api/newsletter/subscribe/route'

const mockCreateServiceClient = vi.mocked(createServiceClient)

function makeReq(body: unknown) {
  return new Request('http://localhost/api/newsletter/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

function makeSupabase({
  existingRow = null as { id: string; unsubscribed_at: string | null } | null,
  insertError = null as { message: string } | null,
  updateError = null as { message: string } | null,
} = {}) {
  const singleMock = vi.fn().mockResolvedValue({ data: existingRow, error: null })
  const selectChain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: singleMock,
  }
  const insertMock = vi.fn().mockResolvedValue({ error: insertError })
  const updateEqMock = vi.fn().mockResolvedValue({ error: updateError })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })
  const mutateChain: any = { insert: insertMock, update: updateMock }

  return {
    from: vi.fn()
      .mockReturnValueOnce(selectChain)
      .mockReturnValue(mutateChain),
  } as unknown as ReturnType<typeof createServiceClient>
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/newsletter/subscribe', () => {
  it('returns 400 for invalid email', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase())
    const res = await POST(makeReq({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.message).toBe('Invalid email address')
  })

  it('returns 400 for missing body', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase())
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }) as unknown as import('next/server').NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 and subscribes a new email', async () => {
    const supabase = makeSupabase({ existingRow: null })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await POST(makeReq({ email: 'new@example.com' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 200 when email is already active', async () => {
    const supabase = makeSupabase({ existingRow: { id: 'sub-1', unsubscribed_at: null } })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await POST(makeReq({ email: 'active@example.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.message).toBe("You're already subscribed")
  })

  it('re-subscribes an unsubscribed email', async () => {
    const supabase = makeSupabase({
      existingRow: { id: 'sub-1', unsubscribed_at: '2026-01-01T00:00:00Z' },
    })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await POST(makeReq({ email: 'old@example.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.message).toBe("You've been re-subscribed")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- __tests__/api/newsletter/subscribe.test.ts
```

Expected: FAIL — module `@/app/api/newsletter/subscribe/route` not found.

- [ ] **Step 3: Implement the subscribe route**

```typescript
// app/api/newsletter/subscribe/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ success: false, message: 'Invalid email address' }, { status: 400 })
  }

  const { email } = result.data
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('newsletter_subscriptions')
    .select('id, unsubscribed_at')
    .eq('email', email)
    .single()

  if (existing) {
    if (existing.unsubscribed_at === null) {
      return NextResponse.json({ success: true, message: "You're already subscribed" })
    }
    await supabase
      .from('newsletter_subscriptions')
      .update({ unsubscribed_at: null, subscribed_at: new Date().toISOString() })
      .eq('id', existing.id)
    return NextResponse.json({ success: true, message: "You've been re-subscribed" })
  }

  const { error } = await supabase.from('newsletter_subscriptions').insert({
    email,
    unsubscribe_token: crypto.randomUUID(),
  })

  if (error) {
    return NextResponse.json({ success: false, message: 'Failed to subscribe' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: "You're subscribed!" }, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- __tests__/api/newsletter/subscribe.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/newsletter/subscribe/route.ts __tests__/api/newsletter/subscribe.test.ts
git commit -m "feat: add newsletter subscribe API route with tests"
```

---

## Task 5: Unsubscribe API Route (TDD)

**Files:**
- Create: `__tests__/api/newsletter/unsubscribe.test.ts`
- Create: `app/api/newsletter/unsubscribe/route.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/newsletter/unsubscribe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/service'
import { GET } from '@/app/api/newsletter/unsubscribe/route'

const mockCreateServiceClient = vi.mocked(createServiceClient)

function makeReq(token?: string) {
  const url = token
    ? `http://localhost/api/newsletter/unsubscribe?token=${token}`
    : 'http://localhost/api/newsletter/unsubscribe'
  return new Request(url) as unknown as import('next/server').NextRequest
}

function makeSupabase({
  foundRow = null as { id: string } | null,
  updateError = null as { message: string } | null,
} = {}) {
  const singleMock = vi.fn().mockResolvedValue({ data: foundRow, error: null })
  const selectChain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: singleMock,
  }
  const updateEqMock = vi.fn().mockResolvedValue({ error: updateError })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

  return {
    from: vi.fn()
      .mockReturnValueOnce(selectChain)
      .mockReturnValue({ update: updateMock }),
  } as unknown as ReturnType<typeof createServiceClient>
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/newsletter/unsubscribe', () => {
  it('returns 404 when no token provided', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabase())
    const res = await GET(makeReq())
    expect(res.status).toBe(404)
  })

  it('returns 404 for unknown token', async () => {
    const supabase = makeSupabase({ foundRow: null })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await GET(makeReq('unknown-token'))
    expect(res.status).toBe(404)
  })

  it('redirects to /newsletter/unsubscribed for valid token', async () => {
    const supabase = makeSupabase({ foundRow: { id: 'sub-1' } })
    mockCreateServiceClient.mockReturnValue(supabase)
    const res = await GET(makeReq('valid-token'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/newsletter/unsubscribed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- __tests__/api/newsletter/unsubscribe.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the unsubscribe route**

```typescript
// app/api/newsletter/unsubscribe/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return new NextResponse(null, { status: 404 })

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('newsletter_subscriptions')
    .select('id')
    .eq('unsubscribe_token', token)
    .single()

  if (!data) return new NextResponse(null, { status: 404 })

  await supabase
    .from('newsletter_subscriptions')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', data.id)

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
  return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed`)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- __tests__/api/newsletter/unsubscribe.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/newsletter/unsubscribe/route.ts __tests__/api/newsletter/unsubscribe.test.ts
git commit -m "feat: add newsletter unsubscribe API route with tests"
```

---

## Task 6: Newsletter Scheduling — Action + publishPost Hook

**Files:**
- Create: `features/newsletter/actions.ts`
- Modify: `features/posts/actions.ts`

- [ ] **Step 1: Create the scheduling server action**

```typescript
// features/newsletter/actions.ts
'use server'

import { createServiceClient } from '@/lib/supabase/service'

export async function scheduleNewsletterSend(postId: string): Promise<void> {
  const delayMinutes = parseInt(process.env.NEWSLETTER_DELAY_MINUTES ?? '60', 10)
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
  const supabase = createServiceClient()
  await supabase
    .from('newsletter_sends')
    .upsert(
      { post_id: postId, scheduled_at: scheduledAt, status: 'pending' },
      { onConflict: 'post_id', ignoreDuplicates: true }
    )
}
```

- [ ] **Step 2: Hook into publishPost in features/posts/actions.ts**

In `features/posts/actions.ts`, add the import at the top of the file (after the existing imports):

```typescript
import { scheduleNewsletterSend } from '@/features/newsletter/actions'
```

Then in the `publishPost` function, add the schedule call after the post is updated successfully (around line 140, after the `if (error)` check):

```typescript
export async function publishPost(id: string) {
  const profile = await getProfile()
  if (!profile || !can(profile.role as Role, 'posts:publish')) {
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { data: post, error } = await supabase
    .from('posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  await scheduleNewsletterSend(id)

  revalidatePath('/dashboard/posts')
  revalidatePath('/blog')
  revalidatePath(`/blog/${post.slug}`)
  return { data: post }
}
```

- [ ] **Step 3: Commit**

```bash
git add features/newsletter/actions.ts features/posts/actions.ts
git commit -m "feat: schedule newsletter send when post is published"
```

---

## Task 7: SubscribeForm Component

**Files:**
- Create: `components/newsletter/SubscribeForm.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/newsletter/SubscribeForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({ email: z.string().email('Enter a valid email address') })
type FormValues = z.infer<typeof schema>

export function SubscribeForm() {
  const [subscribed, setSubscribed] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    const res = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const json = await res.json()
    if (json.success) {
      setSubscribed(true)
      toast.success(json.message)
    } else {
      toast.error(json.message ?? 'Something went wrong')
    }
  }

  if (subscribed) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center max-w-lg mx-auto mt-12">
        <p className="font-semibold text-lg">You&apos;re subscribed!</p>
        <p className="text-muted-foreground text-sm mt-1">
          You&apos;ll get an email when the next post is published.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-8 text-center max-w-lg mx-auto mt-12">
      <h2 className="text-xl font-bold mb-1">Stay in the loop</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Get notified when new posts are published. No spam, unsubscribe anytime.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 max-w-sm mx-auto">
        <Input
          {...register('email')}
          type="email"
          placeholder="your@email.com"
          className="flex-1"
          disabled={isSubmitting}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Subscribing...' : 'Subscribe'}
        </Button>
      </form>
      {errors.email && (
        <p className="text-destructive text-xs mt-2">{errors.email.message}</p>
      )}
      <p className="text-muted-foreground text-xs mt-3">No spam · Unsubscribe anytime</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/newsletter/SubscribeForm.tsx
git commit -m "feat: add SubscribeForm component"
```

---

## Task 8: Integrate SubscribeForm into Blog Post Page

**Files:**
- Modify: `app/(public)/blog/[slug]/page.tsx`

- [ ] **Step 1: Add the SubscribeForm import and usage**

At the top of `app/(public)/blog/[slug]/page.tsx`, add the import after the existing imports:

```typescript
import { SubscribeForm } from '@/components/newsletter/SubscribeForm'
```

In the JSX, add `<SubscribeForm />` after the tags section and before `<CommentSection>`. The tags block currently ends with:

```tsx
        {post.tags && post.tags.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link key={tag.id} href={`/blog/tag/${tag.slug}`}>
                <Badge variant="secondary" className="rounded-full px-3 text-xs">#{tag.name}</Badge>
              </Link>
            ))}
          </div>
        )}

        <CommentSection postId={post.id} postSlug={post.slug} />
```

Replace it with:

```tsx
        {post.tags && post.tags.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link key={tag.id} href={`/blog/tag/${tag.slug}`}>
                <Badge variant="secondary" className="rounded-full px-3 text-xs">#{tag.name}</Badge>
              </Link>
            ))}
          </div>
        )}

        <SubscribeForm />

        <CommentSection postId={post.id} postSlug={post.slug} />
```

- [ ] **Step 2: Verify the page renders without errors**

```bash
npm run build 2>&1 | grep -E "error|Error|✓|✗" | head -20
```

Expected: build succeeds without errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(public\)/blog/\[slug\]/page.tsx
git commit -m "feat: add SubscribeForm to blog post page"
```

---

## Task 9: Newsletter Queries

**Files:**
- Create: `features/newsletter/queries.ts`

- [ ] **Step 1: Create the queries file**

```typescript
// features/newsletter/queries.ts
import { createServiceClient } from '@/lib/supabase/service'
import type { NewsletterSubscription, NewsletterSend, SubscriberStats } from './types'

export async function getSubscriberStats(): Promise<SubscriberStats> {
  const supabase = createServiceClient()
  const [
    { count: active },
    { count: unsubscribed },
    { count: sends_dispatched },
  ] = await Promise.all([
    supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .is('unsubscribed_at', null),
    supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .not('unsubscribed_at', 'is', null),
    supabase
      .from('newsletter_sends')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent'),
  ])
  return {
    active: active ?? 0,
    sends_dispatched: sends_dispatched ?? 0,
    unsubscribed: unsubscribed ?? 0,
  }
}

export async function getScheduledSends(): Promise<(NewsletterSend & { post_title: string })[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('newsletter_sends')
    .select('*, post:posts(title)')
    .in('status', ['pending', 'sending'])
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    post_title: row.post?.title ?? 'Unknown post',
  }))
}

export async function getRecentSubscribers(limit = 20): Promise<NewsletterSubscription[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('*')
    .order('subscribed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as NewsletterSubscription[]
}

export async function getActiveSubscribers(): Promise<NewsletterSubscription[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('*')
    .is('unsubscribed_at', null)
  if (error) throw error
  return (data ?? []) as NewsletterSubscription[]
}
```

- [ ] **Step 2: Commit**

```bash
git add features/newsletter/queries.ts
git commit -m "feat: add newsletter queries"
```

---

## Task 10: Admin Newsletter Page

**Files:**
- Create: `app/(dashboard)/dashboard/admin/newsletter/page.tsx`

- [ ] **Step 1: Create the admin page**

```tsx
// app/(dashboard)/dashboard/admin/newsletter/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { requirePermission } from '@/lib/auth/session'
import {
  getSubscriberStats,
  getScheduledSends,
  getRecentSubscribers,
} from '@/features/newsletter/queries'

export const metadata: Metadata = { title: 'Newsletter' }

export default async function NewsletterPage() {
  await requirePermission('users:read')

  const [stats, scheduledSends, recentSubscribers] = await Promise.all([
    getSubscriberStats(),
    getScheduledSends(),
    getRecentSubscribers(20),
  ])

  return (
    <div className="p-4 md:p-8 space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Newsletter</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage subscribers and scheduled sends
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Active Subscribers" value={stats.active} />
        <StatCard label="Sends Dispatched" value={stats.sends_dispatched} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} />
      </div>

      {scheduledSends.length > 0 && (
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b font-semibold text-sm">Scheduled Sends</div>
          <div className="divide-y">
            {scheduledSends.map((send) => (
              <div key={send.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="font-medium truncate mr-4">{send.post_title}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-muted-foreground text-xs">
                    {new Date(send.scheduled_at) > new Date()
                      ? `Sends in ${formatDistanceToNow(new Date(send.scheduled_at))}`
                      : 'Processing...'}
                  </span>
                  <StatusBadge status={send.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b font-semibold text-sm flex items-center justify-between">
          <span>Subscribers</span>
          <Link
            href="/api/newsletter/subscribers/export"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Export CSV
          </Link>
        </div>
        {recentSubscribers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No subscribers yet.</p>
        ) : (
          <div className="divide-y">
            {recentSubscribers.map((sub) => (
              <div key={sub.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span>{sub.email}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {format(new Date(sub.subscribed_at), 'MMM d, yyyy')}
                  </span>
                  <StatusBadge status={sub.unsubscribed_at ? 'unsubscribed' : 'active'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

const statusClasses: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  sending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  unsubscribed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses[status] ?? ''}`}
    >
      {status}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/dashboard/admin/newsletter/page.tsx
git commit -m "feat: add admin newsletter dashboard page"
```

---

## Task 11: CSV Export Route

**Files:**
- Create: `app/api/newsletter/subscribers/export/route.ts`

- [ ] **Step 1: Create the export route**

```typescript
// app/api/newsletter/subscribers/export/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { getProfile } from '@/lib/auth/session'

export async function GET(_req: NextRequest) {
  const profile = await getProfile()
  if (!profile || !can(profile.role as Role, 'users:read')) {
    return new NextResponse(null, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('email, subscribed_at, unsubscribed_at')
    .order('subscribed_at', { ascending: false })

  if (error) return new NextResponse('Export failed', { status: 500 })

  const rows = data ?? []
  const csv = [
    'email,subscribed_at,status',
    ...rows.map((r: any) =>
      `${r.email},${r.subscribed_at},${r.unsubscribed_at ? 'unsubscribed' : 'active'}`
    ),
  ].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/newsletter/subscribers/export/route.ts
git commit -m "feat: add newsletter subscribers CSV export route"
```

---

## Task 12: Cron Route

**Files:**
- Create: `app/api/newsletter/send/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
// app/api/newsletter/send/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNewsletterEmail } from '@/lib/notifications/newsletter'
import type { NewsletterSubscription } from '@/features/newsletter/types'

export async function GET(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  // Recover sends stuck in 'sending' for more than 10 minutes
  await supabase
    .from('newsletter_sends')
    .update({ status: 'failed' })
    .eq('status', 'sending')
    .lt('sending_started_at', tenMinutesAgo)

  // Fetch pending sends that are due
  const { data: pendingSends, error: sendsError } = await supabase
    .from('newsletter_sends')
    .select('*, post:posts(id, title, slug, excerpt, cover_image)')
    .eq('status', 'pending')
    .lte('scheduled_at', now)

  if (sendsError) {
    console.error('[newsletter/cron] DB error fetching sends:', sendsError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!pendingSends || pendingSends.length === 0) {
    return NextResponse.json({ dispatched: 0 })
  }

  // Fetch all active subscribers once
  const { data: subscribers, error: subError } = await supabase
    .from('newsletter_subscriptions')
    .select('*')
    .is('unsubscribed_at', null)

  if (subError) {
    console.error('[newsletter/cron] DB error fetching subscribers:', subError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const activeSubscribers = (subscribers ?? []) as NewsletterSubscription[]
  let dispatched = 0

  for (const send of pendingSends) {
    await supabase
      .from('newsletter_sends')
      .update({ status: 'sending', sending_started_at: new Date().toISOString() })
      .eq('id', send.id)

    try {
      for (const sub of activeSubscribers) {
        await sendNewsletterEmail(sub, send.post)
      }
      await supabase
        .from('newsletter_sends')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', send.id)
      dispatched++
    } catch (err) {
      console.error(`[newsletter/cron] Send failed for post ${send.post_id}:`, err)
      await supabase
        .from('newsletter_sends')
        .update({ status: 'failed' })
        .eq('id', send.id)
    }
  }

  return NextResponse.json({ dispatched })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/newsletter/send/route.ts
git commit -m "feat: add newsletter Vercel Cron route"
```

---

## Task 13: Unsubscribed Confirmation Page

**Files:**
- Create: `app/(public)/newsletter/unsubscribed/page.tsx`

- [ ] **Step 1: Create the confirmation page**

```tsx
// app/(public)/newsletter/unsubscribed/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Unsubscribed' }

export default function UnsubscribedPage() {
  return (
    <div className="container max-w-lg mx-auto py-24 px-4 text-center">
      <h1 className="text-2xl font-bold mb-2">You&apos;ve been unsubscribed</h1>
      <p className="text-muted-foreground mb-8">
        You won&apos;t receive any more newsletter emails. You can re-subscribe anytime from any
        blog post.
      </p>
      <Link
        href="/blog"
        className="text-sm underline underline-offset-4 hover:text-foreground transition-colors"
      >
        Back to blog
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(public\)/newsletter/unsubscribed/page.tsx
git commit -m "feat: add unsubscribed confirmation page"
```

---

## Task 14: Vercel Cron Config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/newsletter/send",
      "schedule": "* * * * *"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: configure Vercel Cron job for newsletter sends"
```

---

## Task 15: Update vitest Coverage Config

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Add newsletter routes to the coverage include array**

In `vitest.config.ts`, inside the `coverage.include` array, add after the `'app/api/webhooks/user-confirmed/route.ts'` line:

```typescript
        // newsletter routes
        'app/api/newsletter/subscribe/route.ts',
        'app/api/newsletter/unsubscribe/route.ts',
        'app/api/newsletter/send/route.ts',
        'lib/notifications/newsletter.ts',
```

- [ ] **Step 2: Run coverage to verify thresholds still pass**

```bash
npm run test:coverage 2>&1 | tail -20
```

Expected: coverage thresholds (80%) still met.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add newsletter routes to vitest coverage"
```

---

## Task 16: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add newsletter to the Features list**

In `README.md`, find the Features section and add after the Comments line:

```markdown
- Newsletter — readers subscribe at the bottom of each post; an email is sent automatically after a configurable delay when a post is published; one-click unsubscribe via token link
```

- [ ] **Step 2: Add newsletter env vars to the Getting Started section**

In the environment variables block (step 3 of Getting Started), add after `SLACK_WEBHOOK_URL` / `WEBHOOK_SECRET`:

```markdown
NEXT_PUBLIC_SITE_URL=           # Full URL of your deployment, e.g. https://blog.example.com
NEWSLETTER_DELAY_MINUTES=60     # Minutes to wait after publish before sending email
WEBHOOK_SECRET=               # Secret used to authenticate calls to /api/newsletter/send
```

- [ ] **Step 3: Add Newsletter section to the README**

Add a new `## Newsletter` section after the `## Developer API` section:

```markdown
## Newsletter

Readers can subscribe to new posts from a widget at the bottom of each blog post. When a post is published, an email is sent to all active subscribers after a configurable delay.

### How it works

1. Reader submits their email on any blog post page
2. When a post is published, a send is queued in `newsletter_sends` with `scheduled_at = now() + NEWSLETTER_DELAY_MINUTES`
3. A Vercel Cron job runs every minute, finds pending sends past their `scheduled_at`, and dispatches emails via Resend
4. Every email includes a one-click unsubscribe link

### Admin Panel

Navigate to **Dashboard → Admin → Newsletter** to see:
- Active subscriber count, sends dispatched, unsubscribed count
- Scheduled sends and their status
- Recent subscribers table
- CSV export of all subscribers

### Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Full public URL (e.g. `https://blog.example.com`) — used in email links |
| `NEWSLETTER_DELAY_MINUTES` | Minutes to wait after publish before sending (default: `60`) |
| `WEBHOOK_SECRET` | Secret Vercel sends in the `Authorization` header to authenticate cron calls |

### Vercel Setup

Add `WEBHOOK_SECRET` to your Vercel project environment variables. The cron job is configured in `vercel.json` and runs every minute.
```

- [ ] **Step 4: Update the Roadmap section to mark newsletter complete**

Find the Roadmap section and add:
```markdown
- [x] Newsletter subscription with auto-send on publish
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document newsletter subscription feature in README"
```

---

## Task 17: Fix database/ references in README.md

The README still refers to the old `database/` directory for schema setup. Update the Getting Started step 4.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update "Set up the database" step in Getting Started**

Find:
```markdown
### 4. Set up the database

- Run `database/schema.sql` in the Supabase SQL editor
- Apply RLS policies from `database/policies/`
- Optionally seed with `database/seed.sql`
```

Replace with:
```markdown
### 4. Set up the database

Migrations are managed via the Supabase CLI:

```bash
npx supabase db push
```

This applies all migrations from `supabase/migrations/` to your Supabase project.
```

Also update the Project Structure section — find:
```
database/
  schema.sql
  migrations/
  policies/
```

Replace with:
```
supabase/
  migrations/   → SQL migrations (applied via npx supabase)
  templates/    → custom email templates
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README to reference supabase/ directory for migrations"
```
