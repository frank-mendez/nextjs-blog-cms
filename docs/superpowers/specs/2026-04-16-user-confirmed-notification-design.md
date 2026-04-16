# User Registration Notification — Design Spec

**Date:** 2026-04-16  
**Branch:** feature/user-create-notification  
**Status:** Approved

## Overview

When a new user completes email confirmation after registering, an event-driven notification is sent to the admin via email (Resend) and Slack (Incoming Webhook). Notifications fire after confirmation — not at signup time — ensuring only fully verified users trigger alerts.

---

## Architecture

### Event Flow

```
User clicks confirmation link
  → Supabase sets auth.users.confirmed_at
    → Postgres trigger (on_auth_user_confirmed) fires
      → Updates public.profiles.confirmed_at
        → Supabase Database Webhook fires
          → POST /api/webhooks/user-confirmed
            → sendAdminEmail(profile)   [Resend]
            → sendSlackNotification(profile)   [Slack Incoming Webhook]
```

### Why this approach

- Confirmation happens inside Supabase Auth, outside the app request cycle — the register server action cannot hook into it.
- Bridging via `public.profiles.confirmed_at` allows Supabase Database Webhooks (which only support public schema tables) to observe the auth event.
- All notification logic lives in the Next.js codebase — no separate Edge Function deployment needed.

---

## Section 1: Data Layer

### Migration: `database/migrations/add_confirmed_at_to_profiles.sql`

- Add `confirmed_at timestamptz` column to `public.profiles` (nullable, default null).
- Create trigger function `public.handle_user_confirmed()`:
  - Fires `AFTER UPDATE ON auth.users FOR EACH ROW`
  - Condition: `OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL`
  - Action: `UPDATE public.profiles SET confirmed_at = NEW.confirmed_at WHERE id = NEW.id`
- Create trigger `on_auth_user_confirmed` bound to the function above.

---

## Section 2: API Route

### `app/api/webhooks/user-confirmed/route.ts`

- **Method:** POST
- **Security:** Reads `x-webhook-secret` header, compares to `WEBHOOK_SECRET` env var. Returns `401` on mismatch.
- **Payload:** Supabase sends `{ type, table, record, old_record }`. The handler reads `record` for `id`, `email`, `full_name`, `confirmed_at`.
- **Handler logic:**
  1. Verify webhook secret → 401 if invalid
  2. Parse profile from `record`
  3. Call `sendAdminEmail(profile)` and `sendSlackNotification(profile)` independently
  4. Each call is wrapped in its own try/catch — one failure does not block the other
  5. Errors are logged via `console.error`
  6. Return `200 OK` regardless of notification outcome (prevents Supabase from retrying on non-critical failures)

---

## Section 3: Notification Services

### `lib/notifications/user-confirmed.ts`

#### `sendAdminEmail(profile: Profile): Promise<void>`

- Uses Resend SDK (`resend.emails.send(...)`)
- **To:** `ADMIN_EMAIL` env var
- **Subject:** `New user registered: {full_name}`
- **Body (HTML):** Name, email, user ID, confirmed timestamp
- Reads `RESEND_API_KEY` from env

#### `sendSlackNotification(profile: Profile): Promise<void>`

- `fetch` POST to `SLACK_WEBHOOK_URL` env var
- Content-Type: `application/json`
- Slack payload: simple message block with name, email, and confirmed timestamp

### New environment variables

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key for sending email |
| `ADMIN_EMAIL` | Admin email address to receive notifications |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL |
| `WEBHOOK_SECRET` | Shared secret for Supabase webhook verification |

---

## Section 4: Supabase Dashboard Configuration

One-time manual setup after deployment:

1. Go to **Database → Webhooks → Create new webhook**
2. **Table:** `public.profiles`
3. **Events:** `UPDATE`
4. **URL:** `https://your-domain.com/api/webhooks/user-confirmed`
5. **HTTP headers:** `x-webhook-secret: <WEBHOOK_SECRET value>`
6. **Recommended filter:** only fire when `confirmed_at IS NOT NULL` to avoid noise from unrelated profile updates

Document this setup in `docs/setup/webhooks.md`.

---

## Files To Create / Modify

| File | Action |
|---|---|
| `database/migrations/add_confirmed_at_to_profiles.sql` | Create |
| `app/api/webhooks/user-confirmed/route.ts` | Create |
| `lib/notifications/user-confirmed.ts` | Create |
| `.env.local` | Add 4 env vars |
| `docs/setup/webhooks.md` | Create (setup instructions) |

---

## Error Handling

- Webhook secret mismatch → `401`, no notifications sent
- Resend failure → logged, Slack still attempted
- Slack failure → logged, does not affect email
- Malformed payload → `400` returned, logged

## Out of Scope

- Retry logic for failed notifications (Supabase will retry on non-2xx; returning 200 always prevents unnecessary retries on notification failures)
- Notification preferences UI
- Multiple admin recipients
- Notification for users confirmed without email flow (i.e., when Supabase email confirmation is disabled)
