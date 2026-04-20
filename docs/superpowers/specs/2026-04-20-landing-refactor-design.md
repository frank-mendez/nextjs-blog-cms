# Landing Page Refactor Design

**Date:** 2026-04-20  
**Branch:** `refactor/landing`  
**Status:** Approved

## Overview

Refactor the root landing page (`/`) from a Minecraft/pixel-art theme to a clean, dev.to-inspired layout that is visually consistent with `/blog` and `/dashboard`. The page uses real data from the database and the existing design system (Inter/Playfair/DM Sans, Tailwind CSS variables).

---

## Layout

Three-column layout matching the provided reference screenshot:

| Column | Width | Content |
|--------|-------|---------|
| Left sidebar | ~200px | Nav links (Home, Articles, Dashboard) + Topics tag list |
| Main feed | flexible | Vertical list of article cards |
| Right sidebar | ~220px | Popular Tags widget + Top Articles widget |

The top header and footer are inherited from `app/(public)/layout.tsx` — no changes to that file.

---

## Sections

### Left Sidebar

**Nav links** (with icons):
- 🏠 Home — active state (bold, light background highlight)
- ✏️ Articles — links to `/blog`
- ⚙️ Dashboard — links to `/dashboard`

**Topics section:**
- "TOPICS" label (small, uppercase, muted)
- List of unique tags derived from published posts, ordered alphabetically (distinct from the right sidebar which orders by count)
- Each tag links to `/blog/tag/[slug]`
- Data source: `getPopularTags()` query, sorted by name client-side

### Main Feed

Vertical list of article cards, newest first. Each card contains:
- **Author avatar** — 32px circle with author initials, deterministic color from name hash
- **Author name** + **publish date** (e.g. "Apr 18")
- **Article title** — large, bold, links to `/blog/[slug]`
- **Tags** — pill badges, link to `/blog/tag/[slug]`
- **Read time** — right-aligned, calculated as `Math.ceil(wordCount / 200)` minutes

No reactions or comments. The most recently published post gets an amber left border accent.

Data source: `getPublishedPosts(1, 10)` (existing query, page 1, limit 10).

### Right Sidebar

**Popular Tags widget:**
- Title: "Popular Tags"
- Tag pills in a wrapped layout
- Tags ranked by number of posts using that tag (descending)
- Each links to `/blog/tag/[slug]`
- Data source: `getPopularTags(8)` — top 8 tags

**Top Articles widget:**
- Title: "Top Articles"
- Numbered list 01–04
- Each entry: article title (links to `/blog/[slug]`) + author name (muted)
- Ordered by most recent `published_at`
- Data source: first 4 items sliced from the main feed result (no separate DB call)

---

## Data & Queries

### Existing (reuse)
- `getPublishedPosts(page, limit)` in `features/posts/queries.ts` — used for main feed and top articles

### New
- `getPopularTags(limit: number)` in `features/posts/queries.ts`
  - Joins `posts` → `post_tags` → `tags`
  - Filters to published posts only
  - Groups by tag, counts occurrences, orders descending
  - Returns `{ id, name, slug, count }[]`

---

## New Components

### `components/AuthorAvatar.tsx`
- Props: `name: string`, `size?: number` (default 32)
- Renders a circle with the author's initials (first letter of first + last name)
- Color determined by a simple hash of the name → picks from a palette of ~8 colors
- Pure client component, no data fetching

---

## File Changes

| Action | File |
|--------|------|
| Move + rewrite | `app/page.tsx` → `app/(public)/page.tsx` |
| Delete | `app/page.module.css` |
| Add query | `features/posts/queries.ts` — `getPopularTags()` |
| New component | `components/AuthorAvatar.tsx` |
| No change | `app/(public)/layout.tsx` |
| No change | `app/layout.tsx` |

The auth redirect logic (`?code=` search param → `/auth/callback`) stays in the page component.

---

## Styling

- All styles use Tailwind utility classes — no CSS module
- Design tokens from `globals.css`: `--background`, `--foreground`, `--border`, `--muted`, `--muted-foreground`, `--card`, `--card-foreground`
- Fonts: Inter (body), Playfair Display (`--font-playfair`) for headings if needed
- `Press_Start_2P` and `VT323` font imports are removed entirely
- Responsive: below `md` breakpoint, collapse to single column (left sidebar hidden, right sidebar hidden)

---

## Empty State

If there are no published posts:
- Main feed shows a placeholder card: "No articles yet — check back soon."
- Right sidebar Top Articles widget is hidden
- Left sidebar Topics section is hidden

---

## Out of Scope

- Reactions and comments (no new DB tables)
- Pagination on the landing page feed (shows latest 10, full feed is at `/blog`)
- Dark mode toggle (inherits app-level dark mode support via CSS variables)
- Search functionality
