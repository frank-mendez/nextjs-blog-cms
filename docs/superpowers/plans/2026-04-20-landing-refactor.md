# Landing Page Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Minecraft-themed landing page with a clean dev.to-inspired 3-column layout that uses the existing design system and pulls real data from the database.

**Architecture:** Move `app/page.tsx` into `app/(public)/page.tsx` so it inherits the shared header/footer from `(public)/layout.tsx`. The page fetches published posts and popular tags server-side, renders a left nav+topics sidebar, a main article feed, and a right popular-tags + top-articles sidebar. All styles are Tailwind — no CSS modules.

**Tech Stack:** Next.js App Router (server components), Supabase (Postgres via `@supabase/ssr`), Tailwind CSS, date-fns, Vitest + React Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `lib/utils.ts` | Add `readTime(content)` pure utility |
| Modify | `features/posts/queries.ts` | Add `getPopularTags(limit)` DB query |
| Create | `components/AuthorAvatar.tsx` | Initials avatar with deterministic color |
| Create | `app/(public)/page.tsx` | New landing page (3-column layout) |
| Delete | `app/page.tsx` | Replaced by `app/(public)/page.tsx` |
| Delete | `app/page.module.css` | Replaced by Tailwind utilities |
| Create | `__tests__/lib/utils.test.ts` | Tests for `readTime` |
| Create | `__tests__/components/AuthorAvatar.test.tsx` | Tests for `AuthorAvatar` |

---

## Task 1: `readTime` utility

**Files:**
- Modify: `lib/utils.ts`
- Create: `__tests__/lib/utils.test.ts`

- [ ] **Step 1: Check if `__tests__/lib/utils.test.ts` exists**

  ```bash
  ls __tests__/lib/utils.test.ts 2>/dev/null || echo "not found"
  ```

  If it exists, append to it. If not, create it fresh.

- [ ] **Step 2: Write the failing test**

  Create `__tests__/lib/utils.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest'
  import { readTime } from '@/lib/utils'

  describe('readTime', () => {
    it('returns 1 for very short content', () => {
      expect(readTime('Hello world')).toBe(1)
    })

    it('calculates minutes based on 200 wpm', () => {
      const words = Array(400).fill('word').join(' ')
      expect(readTime(words)).toBe(2)
    })

    it('strips HTML tags before counting words', () => {
      const html = '<p>' + Array(200).fill('word').join(' ') + '</p>'
      expect(readTime(html)).toBe(1)
    })

    it('rounds up partial minutes', () => {
      const words = Array(201).fill('word').join(' ')
      expect(readTime(words)).toBe(2)
    })

    it('returns 1 for empty string', () => {
      expect(readTime('')).toBe(1)
    })
  })
  ```

- [ ] **Step 3: Run tests to verify they fail**

  ```bash
  npx vitest run __tests__/lib/utils.test.ts
  ```

  Expected: FAIL — `readTime` is not exported from `@/lib/utils`

- [ ] **Step 4: Add `readTime` to `lib/utils.ts`**

  Append to the end of `lib/utils.ts`:

  ```ts
  export function readTime(content: string): number {
    const wordCount = content
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length
    return Math.max(1, Math.ceil(wordCount / 200))
  }
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  npx vitest run __tests__/lib/utils.test.ts
  ```

  Expected: 5 tests PASS

- [ ] **Step 6: Commit**

  ```bash
  git add lib/utils.ts __tests__/lib/utils.test.ts
  git commit -m "feat: add readTime utility to lib/utils"
  ```

---

## Task 2: `getPopularTags()` query

**Files:**
- Modify: `features/posts/queries.ts`

No TDD here — Supabase query functions have no existing tests in this project and require mocking the full client. The function will be exercised via the browser.

- [ ] **Step 1: Add the `TagWithCount` type and `getPopularTags` export to `features/posts/queries.ts`**

  Append after the last export in `features/posts/queries.ts`:

  ```ts
  export type TagWithCount = { id: string; name: string; slug: string; count: number }

  export async function getPopularTags(limit = 8): Promise<TagWithCount[]> {
    const supabase = await createClient()

    // Fetch all post_tags rows joined to published posts and their tags.
    // !inner ensures we only get rows where a matching post exists.
    const { data, error } = await supabase
      .from('post_tags')
      .select('tags(id, name, slug), post:posts!inner(status)')
      .eq('post.status', 'published')

    if (error) throw error

    // Aggregate tag counts in JS — Supabase JS client doesn't support GROUP BY
    const counts = new Map<string, TagWithCount>()
    for (const row of data ?? []) {
      const tag = (row as unknown as { tags: { id: string; name: string; slug: string } | null }).tags
      if (!tag) continue
      const entry = counts.get(tag.id)
      if (entry) {
        entry.count++
      } else {
        counts.set(tag.id, { ...tag, count: 1 })
      }
    }

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors related to `features/posts/queries.ts`

- [ ] **Step 3: Commit**

  ```bash
  git add features/posts/queries.ts
  git commit -m "feat: add getPopularTags query"
  ```

---

## Task 3: `AuthorAvatar` component

**Files:**
- Create: `components/AuthorAvatar.tsx`
- Create: `__tests__/components/AuthorAvatar.test.tsx`

- [ ] **Step 1: Write the failing tests**

  Create `__tests__/components/AuthorAvatar.test.tsx`:

  ```tsx
  import { describe, it, expect } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { AuthorAvatar } from '@/components/AuthorAvatar'

  describe('AuthorAvatar', () => {
    it('renders initials for a two-word name', () => {
      render(<AuthorAvatar name="Frank Mendez" />)
      expect(screen.getByText('FM')).toBeInTheDocument()
    })

    it('renders first two characters for a single-word name', () => {
      render(<AuthorAvatar name="Madonna" />)
      expect(screen.getByText('MA')).toBeInTheDocument()
    })

    it('uses the first and last word for names with more than two parts', () => {
      render(<AuthorAvatar name="Mary Jane Watson" />)
      expect(screen.getByText('MW')).toBeInTheDocument()
    })

    it('applies the default size of 32px', () => {
      const { container } = render(<AuthorAvatar name="Frank Mendez" />)
      const el = container.firstChild as HTMLElement
      expect(el.style.width).toBe('32px')
      expect(el.style.height).toBe('32px')
    })

    it('applies a custom size', () => {
      const { container } = render(<AuthorAvatar name="Frank Mendez" size={48} />)
      const el = container.firstChild as HTMLElement
      expect(el.style.width).toBe('48px')
      expect(el.style.height).toBe('48px')
    })

    it('always returns the same color for the same name (deterministic)', () => {
      const { container: c1 } = render(<AuthorAvatar name="Frank Mendez" />)
      const { container: c2 } = render(<AuthorAvatar name="Frank Mendez" />)
      const color1 = (c1.firstChild as HTMLElement).style.background
      const color2 = (c2.firstChild as HTMLElement).style.background
      expect(color1).toBe(color2)
    })
  })
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  npx vitest run __tests__/components/AuthorAvatar.test.tsx
  ```

  Expected: FAIL — `AuthorAvatar` module not found

- [ ] **Step 3: Implement `components/AuthorAvatar.tsx`**

  Create `components/AuthorAvatar.tsx`:

  ```tsx
  const COLORS = [
    '#f59e0b', '#10b981', '#6366f1', '#ec4899',
    '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
  ]

  function nameToColor(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = (hash + name.charCodeAt(i)) % COLORS.length
    }
    return COLORS[hash]
  }

  function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  interface AuthorAvatarProps {
    name: string
    size?: number
  }

  export function AuthorAvatar({ name, size = 32 }: AuthorAvatarProps) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: nameToColor(name),
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: `${Math.round(size * 0.34)}px`,
          fontWeight: 700,
          color: '#fff',
          userSelect: 'none',
        }}
        aria-label={name}
      >
        {getInitials(name)}
      </div>
    )
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npx vitest run __tests__/components/AuthorAvatar.test.tsx
  ```

  Expected: 6 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add components/AuthorAvatar.tsx __tests__/components/AuthorAvatar.test.tsx
  git commit -m "feat: add AuthorAvatar component"
  ```

---

## Task 4: Landing page

**Files:**
- Create: `app/(public)/page.tsx`
- Delete: `app/page.tsx`
- Delete: `app/page.module.css`

The new page inherits the header/footer from `app/(public)/layout.tsx` (no changes to that file).

- [ ] **Step 1: Delete the old page and CSS module**

  ```bash
  git rm app/page.tsx app/page.module.css
  ```

- [ ] **Step 2: Create `app/(public)/page.tsx`**

  Create `app/(public)/page.tsx`:

  ```tsx
  import { redirect } from 'next/navigation'
  import Link from 'next/link'
  import { format } from 'date-fns'
  import { getPublishedPosts } from '@/features/posts/queries'
  import { getPopularTags } from '@/features/posts/queries'
  import type { TagWithCount } from '@/features/posts/queries'
  import { AuthorAvatar } from '@/components/AuthorAvatar'
  import { readTime } from '@/lib/utils'
  import type { PostWithRelations } from '@/features/posts/types'

  export const revalidate = 60

  interface HomePageProps {
    searchParams: Promise<{ code?: string }>
  }

  export default async function HomePage({ searchParams }: HomePageProps) {
    const params = await searchParams
    if (params.code) {
      redirect(`/auth/callback?code=${encodeURIComponent(params.code)}`)
    }

    const [{ posts }, popularTags] = await Promise.all([
      getPublishedPosts(1, 10),
      getPopularTags(8),
    ])

    const topArticles = posts.slice(0, 4)
    const sidebarTags = [...popularTags].sort((a, b) => a.name.localeCompare(b.name))

    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 3-column grid — collapses to single column on small screens */}
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_220px] gap-0">

          {/* ── Left sidebar ── */}
          <aside className="hidden md:block pr-4 border-r border-border">
            {/* Nav */}
            <nav className="flex flex-col gap-1 mb-6">
              <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted font-semibold text-sm text-foreground">
                <span>🏠</span> Home
              </div>
              <Link
                href="/blog"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <span>✏️</span> Articles
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <span>⚙️</span> Dashboard
              </Link>
            </nav>

            {/* Topics */}
            {sidebarTags.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Topics</p>
                <ul className="flex flex-col gap-2">
                  {sidebarTags.map((tag) => (
                    <li key={tag.id}>
                      <Link
                        href={`/blog/tag/${tag.slug}`}
                        className="text-sm text-foreground hover:text-primary transition-colors"
                      >
                        #{tag.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* ── Main feed ── */}
          <main className="md:border-x md:border-border">
            {posts.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No articles yet — check back soon.
              </div>
            ) : (
              posts.map((post, i) => (
                <ArticleCard key={post.id} post={post} featured={i === 0} />
              ))
            )}
          </main>

          {/* ── Right sidebar ── */}
          <aside className="hidden md:flex flex-col gap-4 pl-4 border-l border-border">

            {/* Popular Tags */}
            {popularTags.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h2 className="font-bold text-sm text-foreground mb-3">Popular Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/blog/tag/${tag.slug}`}
                      className="bg-muted text-muted-foreground text-xs rounded-full px-3 py-1 hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Top Articles */}
            {topArticles.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h2 className="font-bold text-sm text-foreground mb-3">Top Articles</h2>
                <ol className="flex flex-col gap-3">
                  {topArticles.map((post, i) => (
                    <li key={post.id} className="flex gap-3 items-start">
                      <span className="text-xl font-extrabold text-border leading-none min-w-[24px]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <Link
                          href={`/blog/${post.slug}`}
                          className="text-xs font-semibold text-foreground leading-snug hover:text-primary transition-colors line-clamp-2"
                        >
                          {post.title}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {post.author?.full_name ?? post.author?.email ?? 'Unknown'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

          </aside>
        </div>
      </div>
    )
  }

  // ── Article card sub-component ────────────────────────────────────────────────

  function ArticleCard({ post, featured }: { post: PostWithRelations; featured: boolean }) {
    const authorName = post.author?.full_name ?? post.author?.email ?? 'Unknown'
    const mins = readTime(post.content ?? '')
    const publishedDate = post.published_at
      ? format(new Date(post.published_at), 'MMM d')
      : null

    return (
      <article
        className={[
          'bg-card px-5 py-4 border-b border-border',
          featured ? 'border-l-4 border-l-amber-400' : '',
        ].join(' ')}
      >
        {/* Author row */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <AuthorAvatar name={authorName} size={32} />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-foreground">{authorName}</span>
            {publishedDate && (
              <time
                dateTime={post.published_at!}
                className="text-muted-foreground text-xs"
              >
                {publishedDate}
              </time>
            )}
          </div>
        </div>

        {/* Title */}
        <Link href={`/blog/${post.slug}`}>
          <h2 className="text-lg font-bold text-foreground leading-snug hover:text-primary transition-colors mb-2">
            {post.title}
          </h2>
        </Link>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {post.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/blog/tag/${tag.slug}`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                #{tag.slug}
              </Link>
            ))}
          </div>
        )}

        {/* Footer row */}
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground">{mins} min read</span>
        </div>
      </article>
    )
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no new type errors

- [ ] **Step 4: Start the dev server and verify the page renders**

  ```bash
  npm run dev
  ```

  Open http://localhost:3000 and confirm:
  - 3-column layout is visible (left sidebar, main feed, right sidebar)
  - Articles appear with author initials, date, tags, and read time
  - Popular Tags and Top Articles populate in the right sidebar
  - Topic list in the left sidebar is alphabetically ordered
  - On mobile width (< 768px), sidebars are hidden, only feed is shown
  - Navigating to http://localhost:3000?code=test redirects to `/auth/callback?code=test`

- [ ] **Step 5: Run the full test suite to confirm no regressions**

  ```bash
  npx vitest run
  ```

  Expected: all tests pass (the old pixel-font related tests don't exist — the suite should be clean)

- [ ] **Step 6: Commit**

  ```bash
  git add app/'(public)'/page.tsx
  git commit -m "feat: refactor landing page to dev.to-inspired 3-column layout"
  ```

---

## Task 5: Clean up coverage config

The two new testable files (`lib/utils.ts` already included, `components/AuthorAvatar.tsx` is new) should be added to the Vitest coverage include list so regressions are caught.

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Add `AuthorAvatar` to the coverage include list in `vitest.config.ts`**

  In `vitest.config.ts`, find the `coverage.include` array and add after the last `'components/...'` entry:

  ```ts
  'components/AuthorAvatar.tsx',
  ```

- [ ] **Step 2: Verify coverage still passes thresholds**

  ```bash
  npx vitest run --coverage
  ```

  Expected: all coverage thresholds (lines/functions/branches/statements ≥ 80%) still pass

- [ ] **Step 3: Commit**

  ```bash
  git add vitest.config.ts
  git commit -m "chore: add AuthorAvatar to coverage include list"
  ```
