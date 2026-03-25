# Next.js Blog CMS

A modern blog CMS vibe-coded with Claude Code using Next.js, Supabase, and TailwindCSS, featuring authentication, role-based access, WYSIWYG editing, and MCP-powered development workflows.

---

## ✨ Features

- 🔐 Authentication (Supabase Auth)
- 👥 Role-Based Access Control (Admin / Author)
- 📝 WYSIWYG Editor (TipTap / Lexical ready)
- 📰 Draft & Publish workflow
- 🏷️ Tags & Categories
- 💬 Comments (authenticated users, thread-style, admin management)
- 🌐 SEO-friendly blog pages
- ⚡ Fast deployment with Vercel
- 🤖 AI-assisted development via Claude Code + MCP

---

## 🧱 Tech Stack

- **Frontend:** Next.js (App Router)
- **Backend:** Supabase (Postgres + Auth)
- **Styling:** TailwindCSS + shadcn/ui
- **Editor:** TipTap (recommended)
- **Deployment:** Vercel
- **AI Dev Layer:** Claude Code + MCP Servers

---

## 🤖 MCP Servers Used

This project is optimized for AI-assisted development using MCP servers:

- `github-mcp` – repo management, PRs, commits
- `supabase-mcp` – database schema, queries, RLS
- `vercel-mcp` – deployments and env management
- `filesystem-mcp` – file editing and refactoring
- `browser-mcp` – UI testing and debugging
- `postgres-mcp` (optional) – query optimization

---

## 📁 Project Structure

```

app/
(public)/        → public blog pages
(dashboard)/     → admin & author dashboard
api/             → backend routes

components/
ui/              → reusable UI
editor/          → WYSIWYG editor
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

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/nextjs-blog-cms.git
cd nextjs-blog-cms
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Setup environment variables

Create a `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

### 4. Setup database

- Run SQL from `database/schema.sql`
- Apply policies from `database/policies/`
- (Optional) Seed data from `database/seed.sql`

---

### 5. Run the app

```bash
npm run dev
```

---

## 🔐 Roles & Permissions

| Role   | Access                                          |
| ------ | ----------------------------------------------- |
| Admin  | Full control (users, posts, roles, comments)    |
| Author | Create & manage own posts, delete own comments  |

Enforced using **Supabase Row Level Security (RLS)**.

---

## ✍️ Writing Posts

- Use the dashboard editor
- Save as **draft**
- Publish when ready
- Supports rich text, images, and formatting

---

## 🌐 Deployment

Deploy easily with Vercel:

1. Import repo to Vercel
2. Add environment variables
3. Add domain (e.g. `blog.yourdomain.com`)

---

## 🧠 AI Development Workflow

This project is designed to work seamlessly with **Claude Code**:

- Modular structure for safe refactoring
- Feature-based architecture
- Dedicated `agents/` instructions
- MCP servers for full-stack automation

---

## 📌 Roadmap

- [x] Comments system
- [ ] Analytics dashboard
- [ ] Scheduled posts
- [ ] Multi-author collaboration
- [ ] AI-assisted writing
- [ ] Headless CMS API

---

## 💡 Why This Project

This project demonstrates:

- Full-stack architecture
- Secure authentication & RBAC
- Database design with RLS
- Rich text editor integration
- AI-assisted development workflows

---

## 🛠️ Contributing

PRs are welcome. For major changes, open an issue first.

---

## 📄 License

MIT

---

## 👤 Author

Frank Mendez

---

## ⭐ Support

If you find this useful, give it a star ⭐

```

---

If you want to level this up even more, next move is:

👉 Add a **“Live Demo + Screenshots + Architecture Diagram”** section — that’s what turns this from “nice repo” into “hire this guy.”
```
