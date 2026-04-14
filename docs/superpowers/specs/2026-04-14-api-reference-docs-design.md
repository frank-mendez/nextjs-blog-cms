# API Reference Docs — Developer Page Design

**Date:** 2026-04-14
**Location:** `/dashboard/developer` — replaces the existing "API Usage" card

---

## Goal

Replace the single static code block in the "API Usage" card with a full Swagger-style API reference section that documents all 6 REST endpoints. Developers integrating n8n (or any external tool) should be able to read the auth requirements, understand each endpoint's parameters, and copy working request/response examples — without leaving the dashboard.

---

## Scope

**In scope:**
- New `ApiReferenceSection` client component rendered in `ApiKeysManager.tsx`
- Auth banner (Bearer token format + rate limits)
- 6 endpoint cards: all collapsible, with params tables and Request/Response tabs
- Happy-path responses only (no error response tab in this iteration)

**Out of scope:**
- Interactive "Try it" / live API execution
- Error response documentation
- Copy-to-clipboard on individual code blocks (beyond browser default select)

---

## Component Design

### `ApiReferenceSection` (`components/developer/ApiReferenceSection.tsx`)

A new client component (`'use client'`). Self-contained — receives no props. All endpoint definitions are static data defined inside the file.

**Internal structure:**
- `AUTH_BANNER` — static JSX block showing `Authorization: Bearer fmblog_...` and rate limit note
- `ENDPOINTS` — array of `EndpointDef` objects (defined below)
- `EndpointCard` — renders one collapsible endpoint. Manages its own `open` and `activeTab` state locally via `useState`

**EndpointDef shape:**
```ts
type EndpointDef = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  badge?: string          // e.g. 'AI' — rendered as a purple pill
  params?: ParamRow[]     // query/path/body params table
  paramLabel?: string     // heading for the table: 'Query Parameters' | 'Request Body' | 'Path Parameter'
  request: string         // raw string for the request code block
  response: string        // raw string for the response code block
  responseStatus: number  // e.g. 200, 201
}

type ParamRow = {
  name: string
  type: string
  required: boolean
  description: string
  default?: string
}
```

### Integration into `ApiKeysManager.tsx`

The existing "API Usage" `<Card>` (lines 201–222) is replaced with `<ApiReferenceSection />`. The import is added at the top of `ApiKeysManager.tsx`. No changes to `page.tsx`.

---

## Visual Design

### Auth banner
- Light slate background (`bg-slate-50`), slate border
- Left label: `AUTH` in small caps, bold
- Right: monospace Bearer token line + small rate limit note below

### Endpoint cards
- White card, `border border-gray-200 rounded-lg`
- Header row (always visible): method badge · path · description · chevron
- Method badge colors:
  - `GET` → green (`bg-emerald-50 text-emerald-700`)
  - `POST` → blue (`bg-blue-50 text-blue-700`)
  - `PATCH` → amber (`bg-amber-50 text-amber-700`)
  - `DELETE` → red (`bg-red-50 text-red-700`)
- "AI" pill: `bg-purple-100 text-purple-700` — shown on the generate endpoint only
- Path params like `{id}` rendered in blue within the path text
- Expanded body: params table + tab bar + code block
- Tab bar: `Request` and `Response NNN` (e.g. `Response 200`)
- Active tab: blue underline, bold
- Code block: `bg-slate-950 text-slate-100`, monospace, `overflow-x-auto`
- All 6 cards start collapsed

### Params table
- Columns: **Field/Param**, **Type**, **Required/Default**, **Description**
- Required fields: red `required` text; optional fields: gray default value or `—`
- Field names in `font-mono text-blue-700`

---

## Endpoints Documented

| Method | Path | Response | Notes |
|--------|------|----------|-------|
| GET | `/api/posts` | 200 | Query params: page, limit, status, search, sort, order |
| POST | `/api/posts/create` | 201 | Body: title (req), content (req), status, excerpt, tags, category, image_url |
| GET | `/api/posts/{id}` | 200 | Path param: UUID or slug |
| PATCH | `/api/posts/{id}` | 200 | Body: all fields optional (partial update) |
| DELETE | `/api/posts/{id}` | 200 | No body |
| POST | `/api/ai-assistant/generate` | 201 | Body: topic (req), context, tone, word_count, llm_provider, llm_model, post_overrides |

---

## File Changes

| Action | File |
|--------|------|
| Create | `components/developer/ApiReferenceSection.tsx` |
| Modify | `app/(dashboard)/dashboard/developer/ApiKeysManager.tsx` — replace "API Usage" card with `<ApiReferenceSection />` |

No new routes, no database changes, no new dependencies.

---

## Testing

This is a static display component with no external data dependencies. Verification is manual:
- Dev server running, navigate to `/dashboard/developer`
- Each card expands/collapses on click
- Request/Response tabs switch correctly
- Code blocks are readable and scroll horizontally on overflow
- No TypeScript or lint errors (`npm run build` passes)
