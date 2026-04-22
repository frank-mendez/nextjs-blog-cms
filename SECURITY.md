# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| `main`  | ✅ Yes     |

Only the latest code on the `main` branch receives security fixes. If you are running an older fork or snapshot, upgrade to the latest commit before reporting an issue.

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately by emailing the maintainer directly or by using [GitHub's private vulnerability reporting](https://github.com/frank-mendez/nextjs-blog-cms/security/advisories/new) feature.

Include the following in your report:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept, request/response samples, or code snippets)
- The affected component(s) or file path(s)
- Any suggested mitigation or fix (optional)

You can expect an acknowledgement within **72 hours** and a resolution or status update within **14 days**. Please do not disclose the issue publicly until a fix has been released.

---

## Security Features

### Authentication

- User authentication is handled by **Supabase Auth** (email/password and session-based).
- All protected dashboard routes and API routes require a valid session or API key.
- Server-side session helpers (`lib/auth/session.ts`) enforce authentication and redirect unauthenticated requests to `/login`.

### Role-Based Access Control

- Two roles are supported: **Admin** (full control) and **Author** (own posts only).
- Access control is enforced at the database level via **Supabase Row Level Security (RLS)** policies defined in `database/policies/`.
- Client-side permission helpers (`lib/permissions/`) provide additional UI-level gating.

### API Key Authentication

- Developer API keys use the format `fmblog_<64 hex characters>`.
- Only a **SHA-256 hash** of the key is stored in the database — the raw key is shown once at generation time and never stored in plaintext.
- Keys are validated on every request by `lib/apiAuth.ts` and can be revoked at any time from the Developer Settings dashboard.

### LLM Provider Key Encryption

- User-supplied LLM API keys (Anthropic, Google, OpenAI) are encrypted at rest using **AES-256-GCM** before being written to the database (`lib/encryption.ts`).
- Encryption requires a 32-byte secret (`LLM_KEY_ENCRYPTION_SECRET`) stored as an environment variable — never committed to source control.
- Authentication tags are verified on decryption, so any tampering with the ciphertext is detected and rejected.

### Rate Limiting

- All API routes apply in-memory rate limiting via `lib/rateLimit.ts`.
- Requests that exceed the limit receive a `429 Too Many Requests` response with a `retry_after` value.
- **Note:** The current implementation uses a Node.js in-memory `Map`. In a multi-instance (horizontally scaled) deployment this does not share state across instances. For production scale, replace with a distributed store such as Redis/Upstash (see the TODO comment in `lib/rateLimit.ts`).

### Newsletter Webhook Secret

- The newsletter send endpoint (`POST /api/newsletter/send`) is called by a Vercel Cron Job and requires an `x-webhook-secret` header matching the `WEBHOOK_SECRET` environment variable.
- This prevents unauthorized parties from triggering bulk email sends.

### Content Security

- Post content is stored as a serialised TipTap JSON document (not raw HTML).
- The `EditorContent` component (`components/editor/EditorContent.tsx`) renders content by walking the TipTap JSON tree and constructing HTML strings.
- If JSON parsing fails the raw string is injected via `dangerouslySetInnerHTML`. Ensure post content written to the database originates only from the TipTap editor or the validated API, never from untrusted external sources without sanitisation.
- The `sanitize-html` library is available as a dependency and is used where raw HTML input cannot be avoided.

---

## Deployment Security Checklist

Before deploying to production, confirm the following:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reference a production project, not a development or test one.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is kept **server-side only** and never exposed to the browser.
- [ ] `LLM_KEY_ENCRYPTION_SECRET` is exactly 32 bytes and stored as a secret environment variable — never committed to source control.
- [ ] `WEBHOOK_SECRET` is a strong, randomly generated value configured in both your Vercel project settings and your cron scheduler.
- [ ] All RLS policies from `database/policies/` have been applied to the production Supabase project.
- [ ] Supabase Auth email confirmations are enabled so that only verified addresses can complete registration.
- [ ] The Supabase service role key is **not** exposed in client-side code or public environment variables.
- [ ] Rate limiting is reviewed and, for multi-instance deployments, backed by a distributed store (Redis/Upstash).

---

## Dependency Security

Dependencies are pinned to minor version ranges in `package.json`. It is recommended to:

- Regularly run `npm audit` and address reported vulnerabilities.
- Keep Next.js, Supabase libraries, and AI SDK packages up to date, as they receive active security patches.
- Review any new dependency before adding it to the project.

---

## License

This project is licensed under the [MIT License](LICENSE). Security disclosures are handled separately from licensing.
