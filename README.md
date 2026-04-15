# Next.js Blog CMS

A full-stack Blog CMS built with Next.js (App Router), Supabase, TailwindCSS, and shadcn/ui. Features Supabase Auth with role-based access control, a WYSIWYG editor, draft/publish workflow, an AI writing assistant, a headless REST API, and MCP-powered development workflows.

---

## Features

- Authentication via Supabase Auth
- Role-Based Access Control — Admin and Author roles enforced through Supabase RLS
- WYSIWYG editor powered by TipTap with rich text, images, and formatting
- Draft and publish workflow
- Tags and categories
- Comments — authenticated, thread-style, with admin management
- SEO-friendly public blog pages with meta title and description support
- Developer API — generate API keys in the dashboard to create posts from external tools (n8n, Postman, scripts)
- AI Writing Assistant — chat with uploaded books (PDF) using Claude, Gemini, or OpenAI; generate full blog post drafts from conversation context
- LLM provider key management — store encrypted API keys (AES-256-GCM) for Claude, Gemini, and OpenAI per user
- Headless AI post generation via `POST /api/ai-assistant/generate`
- REST API for posts — list, create, read, update, delete via authenticated endpoints
- In-memory rate limiting on API routes
- Favicon support
- Fast Vercel deployment

---

## Tech Stack

- **Frontend:** Next.js (App Router)
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Styling:** TailwindCSS + shadcn/ui
- **Editor:** TipTap
- **AI Providers:** Anthropic (Claude), Google (Gemini), OpenAI
- **Deployment:** Vercel
- **AI Dev Layer:** Claude Code + MCP Servers

---

## MCP Servers

This project is optimized for AI-assisted development using MCP servers:

- `github-mcp` — repo management, PRs, commits
- `supabase-mcp` — database schema, queries, RLS
- `vercel-mcp` — deployments and env management
- `filesystem-mcp` — file editing and refactoring
- `browser-mcp` — UI testing and debugging
- `postgres-mcp` (optional) — query optimization

---

## Project Structure

```
app/
  (public)/        → public blog pages
  (dashboard)/     → admin & author dashboard
  (ai)/            → AI assistant (full-screen layout)
  api/             → backend routes

components/
  ui/              → reusable UI (shadcn/ui)
  editor/          → TipTap WYSIWYG editor
  blog/            → blog components

features/
  posts/
  users/
  auth/
  comments/

lib/
  supabase/
  permissions/
  utils/

database/
  schema.sql
  migrations/
  policies/

agents/
  frontend.agent.md
  backend.agent.md
  database.agent.md
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/frank-mendez/nextjs-blog-cms.git
cd nextjs-blog-cms
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_KEY_ENCRYPTION_SECRET=   # 32-character secret for AES-256-GCM key encryption
```

### 4. Set up the database

- Run `database/schema.sql` in the Supabase SQL editor
- Apply RLS policies from `database/policies/`
- Optionally seed with `database/seed.sql`

### 5. Run the app

```bash
npm run dev
```

---

## Roles and Permissions

| Role   | Access                                          |
| ------ | ----------------------------------------------- |
| Admin  | Full control (users, posts, roles, comments, developer settings) |
| Author | Create and manage own posts, delete own comments |

Enforced using Supabase Row Level Security (RLS).

---

## AI Writing Assistant

The AI assistant allows authors to upload a PDF book, chat with it using their preferred LLM, and generate a full blog post draft from the conversation.

**Supported providers:** Claude (Anthropic), Gemini (Google), OpenAI

**How it works:**

1. Navigate to **Dashboard → AI Assistant**
2. Add your LLM API key under **Dashboard → Developer → LLM Providers**
3. Start a new chat — upload a PDF and select a model
4. Chat with the book, then click **Generate Post** to create a draft

PDF text is extracted on upload and stored as plain text. The LLM receives the extracted text as context. API keys are encrypted with AES-256-GCM and never stored in plaintext.

---

## Developer API

Admins can generate API keys to allow external tools to create posts without a browser session.

### Access Developer Settings

1. Log in as Admin
2. Go to **Dashboard → Developer**
3. Click **Generate New Key**, name it, and copy the key — shown only once

### API Key Format

Keys are prefixed with `fmblog_` followed by 64 hex characters. Only a SHA-256 hash is stored in the database.

### Endpoints

#### POST /api/posts/create

Create a new post from any HTTP client.

**Headers:**
```
Authorization: Bearer fmblog_your_key_here
Content-Type: application/json
```

**Body:**

| Field              | Type                   | Required | Description                                            |
| ------------------ | ---------------------- | -------- | ------------------------------------------------------ |
| `title`            | string                 | Yes      | Post title                                             |
| `content`          | string                 | Yes      | HTML content (TipTap-compatible)                       |
| `slug`             | string                 | No       | URL slug — auto-generated from title if omitted        |
| `status`           | `draft` \| `published` | No       | Defaults to `draft`                                    |
| `excerpt`          | string                 | No       | Plain-text summary                                     |
| `meta_title`       | string                 | No       | SEO title — defaults to `title`                        |
| `meta_description` | string                 | No       | SEO description — defaults to `excerpt`                |
| `tags`             | string[]               | No       | Tag names — created automatically if they don't exist  |
| `category`         | string                 | No       | Category name — matched by name or slug                |
| `image_url`        | string                 | No       | Featured image URL                                     |

**Example:**
```bash
curl -X POST https://your-domain.com/api/posts/create \
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
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Hello from n8n",
    "slug": "hello-from-n8n",
    "status": "draft"
  }
}
```

#### POST /api/ai-assistant/generate

Generate a blog post headlessly using the AI assistant.

**Headers:**
```
Authorization: Bearer fmblog_your_key_here
Content-Type: application/json
```

#### GET /api/posts

List posts with pagination and filters.

#### GET /api/posts/[id]

Retrieve a single post by ID.

#### PATCH /api/posts/[id]

Update a post by ID.

#### DELETE /api/posts/[id]

Delete a post by ID.

### Security Notes

- Raw API keys are never stored — only SHA-256 hashes
- The key is shown exactly once after generation
- Keys can be revoked or deleted at any time from Developer Settings
- `author_id` is always set to the user who owns the API key
- API routes are rate-limited in-memory

---

## Testing

### Unit Tests (Vitest)

Covers lib utilities, API routes, services, and UI components with 80%+ thresholds across lines, branches, functions, and statements.

```bash
npm test                  # watch mode
npm run test:run          # single run
npm run test:coverage     # coverage report
```

### API End-to-End Tests (Playwright)

Tests the five posts REST API routes (`GET`, `POST`, `PATCH`, `DELETE`) against a real Next.js dev server and a dedicated Supabase test project. No browser — pure HTTP via `APIRequestContext`.

**Prerequisites:**

- `.env.local` must point to a **separate Supabase test project** (not production)
- The test project must have the full schema applied (`database/schema.sql`)

```bash
npm run test:e2e          # run the full suite (19 tests)
npm run test:e2e:report   # open the HTML report
```

Global setup seeds a test user, API key, and three posts before the suite runs. Global teardown deletes all seeded data by `user_id` after the suite finishes.

---

## Deployment

1. Import repo to Vercel
2. Add environment variables
3. Assign a domain (e.g. `blog.yourdomain.com`)

---

## AI Development Workflow

This project is designed to work seamlessly with Claude Code:

- Modular, feature-based architecture for safe refactoring
- Dedicated `agents/` instruction files
- MCP servers for full-stack automation

---

## Screenshots

**Public Blog — SEO-friendly article listing**

![Public Blog](public/screenshots/public-blog.png)

**AI Assistant — Chat with books and generate blog posts**

![AI Assistant](public/screenshots/ai-assistant.png)

**Developer Settings — API Key Management and LLM Providers**

![Developer Settings](public/screenshots/developer-settings.png)

---

## Roadmap

- [x] Comments system
- [x] Developer API with API key management
- [x] AI Writing Assistant (Claude, Gemini, OpenAI)
- [x] PDF text extraction and LLM context
- [x] REST API for posts
- [ ] Analytics dashboard
- [ ] Scheduled posts
- [ ] Multi-author collaboration
- [ ] Headless CMS API

---

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes with clear messages
4. Open a Pull Request — describe what changed and why

For significant changes, open an issue first to discuss the approach.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold a respectful and inclusive environment. Report unacceptable behavior to the project maintainer.

---

## License

[MIT](LICENSE)

---

## Author

Frank Mendez
