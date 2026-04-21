# Newsletter Subscription Feature — Design Spec

**Date:** 2026-04-21
**Branch:** `feature/newsletter-subscription`
**Status:** Approved

---

## Overview

Add a newsletter subscription feature to the Blog CMS. Readers subscribe from a widget at the bottom of each blog post. When a post is published, an email is automatically sent to all active subscribers after a configurable delay. Unsubscribing is one-click via a link in every email.

---

## Goals & Constraints

- **Single opt-in** — entering an email subscribes immediately, no confirmation email
- **Auto-notify on publish** — no manual send step; triggered by post publish event
- **Configurable delay** — email goes out after `NEWSLETTER_DELAY_MINUTES` (default: 60) minutes
- **One-click unsubscribe** — token-based, no login required
- **No new vendors** — uses existing Resend integration and Supabase

---

## Data Model

### `newsletter_subscriptions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `email` | `text` UNIQUE NOT NULL | |
| `subscribed_at` | `timestamptz` | DEFAULT `now()` |
| `unsubscribed_at` | `timestamptz` | NULL = active |
| `unsubscribe_token` | `text` UNIQUE NOT NULL | UUID generated on insert |

### `newsletter_sends`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `post_id` | `uuid` FK → `posts.id` UNIQUE | One send per post |
| `scheduled_at` | `timestamptz` NOT NULL | `now() + delay` |
| `status` | `text` | `pending` / `sending` / `sent` / `failed` |
| `sent_at` | `timestamptz` | NULL until delivered |
| `created_at` | `timestamptz` | DEFAULT `now()` |

**RLS:** Both tables are service-role only — no public read or write access.

---

## Architecture

### Option Chosen: Full in-house with Vercel Cron (Option A)

Subscribers stored in Supabase. A `newsletter_sends` queue table holds scheduled sends. A Vercel Cron Job runs every minute, checks for pending sends past their `scheduled_at`, and dispatches emails via Resend.

### Data Flow

1. Reader submits email on blog post → `POST /api/newsletter/subscribe` → insert into `newsletter_subscriptions`
2. Admin publishes post → server action writes row to `newsletter_sends` with `scheduled_at = now() + NEWSLETTER_DELAY_MINUTES`
3. Vercel Cron fires every minute → `GET /api/newsletter/cron` → finds rows where `status = 'pending'` AND `scheduled_at <= now()`
4. For each pending send: fetch all active subscribers, send email via Resend with post details + unsubscribe link, update `status = 'sent'`
5. Reader clicks unsubscribe link → `GET /api/newsletter/unsubscribe?token=xxx` → sets `unsubscribed_at = now()` → redirects to `/newsletter/unsubscribed`

---

## API Routes

### `POST /api/newsletter/subscribe`
- Validates email with Zod
- If email exists and is active: return 200 "You're already subscribed"
- If email exists and unsubscribed: clear `unsubscribed_at`, update `subscribed_at`
- If new: insert with generated `unsubscribe_token`
- Returns: `{ success: true, message: string }`

### `GET /api/newsletter/unsubscribe?token=xxx`
- Looks up token in `newsletter_subscriptions`
- If not found: returns 404 page
- If found: sets `unsubscribed_at = now()`
- Redirects to `/newsletter/unsubscribed`

### `GET /api/newsletter/cron`
- Protected by `Authorization: Bearer $CRON_SECRET` header
- Queries `newsletter_sends` where `status = 'pending'` AND `scheduled_at <= now()`
- Also marks sends stuck in `sending` for >10 minutes as `failed` (recovery from cron crash)
- For each `pending` send: set `status = 'sending'`, fetch active subscribers (where `unsubscribed_at IS NULL`), call `sendNewsletterEmail()` sequentially, set `status = 'sent'` / `'failed'`
- Failed sends are not retried automatically — admin must investigate

---

## File Structure

```
features/newsletter/
  actions.ts            # subscribe / unsubscribe server actions
  queries.ts            # getActiveSubscribers, getSubscriberStats, getSends
  types.ts              # NewsletterSubscription, NewsletterSend

components/newsletter/
  SubscribeForm.tsx     # email input + submit, shown at bottom of blog posts

app/api/newsletter/
  subscribe/route.ts
  unsubscribe/route.ts
  cron/route.ts

app/(dashboard)/dashboard/admin/newsletter/
  page.tsx              # admin panel: stats, scheduled sends, subscriber table

app/(public)/newsletter/
  unsubscribed/page.tsx # confirmation page shown after unsubscribing

supabase/
  migrations/add_newsletter_tables.sql
  policies/newsletter.sql

lib/notifications/
  newsletter.ts         # sendNewsletterEmail() via Resend

vercel.json             # cron entry: "* * * * *" → /api/newsletter/cron
README.md               # updated with newsletter feature docs
```

---

## UI Components

### SubscribeForm
- Placed at the bottom of `/blog/[slug]` below post content
- Email input + "Subscribe" button
- Success state: inline confirmation message replacing the form
- Error state: inline error message, form remains
- Uses `sonner` toast for feedback

### Admin Newsletter Panel (`/dashboard/admin/newsletter`)
- Stats cards: Active Subscribers, Sends Dispatched (count of `newsletter_sends` with `status = 'sent'`), Unsubscribed
- Scheduled Sends table: post title, time until send, status badge
- Recent Subscribers table: email, subscribed date, status badge
- Export CSV button (downloads `newsletter_subscriptions` as CSV)
- Admin-only route (enforced by existing RBAC middleware)

---

## Environment Variables

```
NEWSLETTER_DELAY_MINUTES=60   # delay between publish and send
CRON_SECRET=                  # shared secret for Vercel Cron auth
```

---

## Error Handling & Edge Cases

| Scenario | Behaviour |
|---|---|
| Duplicate subscribe (active) | 200 "You're already subscribed" — no leak |
| Re-subscribe (previously unsubscribed) | Clear `unsubscribed_at`, update `subscribed_at` |
| Invalid unsubscribe token | 404 — no detail leaked |
| Post published multiple times | Unique constraint on `post_id` silently ignores second insert |
| Cron crash mid-send | Status stuck in `sending`; after 10 min treat as `failed` |
| Resend API error | Set `status = 'failed'`, log error, no auto-retry |
| Empty subscriber list | Mark send as `sent`, no emails dispatched |

---

## Testing

### Unit Tests (Vitest)
- `subscribe` action: valid email, duplicate active, re-subscribe, invalid email format
- `unsubscribe` action: valid token, invalid token

### Integration Tests (Vitest)
- Cron route: mock Resend, seed `pending` send with `scheduled_at` in the past, assert status transitions to `sent` and Resend called once per subscriber

### E2E Tests (Playwright)
- Subscribe form: enter email → submit → success state visible
- Unsubscribe: navigate to `/api/newsletter/unsubscribe?token=xxx` → redirect to `/newsletter/unsubscribed`
