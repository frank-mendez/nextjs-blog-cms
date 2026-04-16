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

### Required: add confirmed_at filter

Without this filter, the webhook fires on every profile update (role changes, name updates, etc.), causing duplicate notifications. Add this filter condition:

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
