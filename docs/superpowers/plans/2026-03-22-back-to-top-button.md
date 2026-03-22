# Back-to-Top Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed floating button to the edit post page that scrolls back to the top when clicked, appearing only when the user has scrolled more than 300px.

**Architecture:** Add scroll state and a `useEffect` listener directly inside `PostEditor.tsx` (a `'use client'` component). Render a fixed `<Button>` at the bottom of the JSX, conditionally on the scroll state. One file changes, no new files.

**Tech Stack:** Next.js App Router, React (`useState`, `useEffect`), TailwindCSS, shadcn/ui `Button`, lucide-react `ArrowUp`

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `components/dashboard/PostEditor.tsx` | Modify | Add `ArrowUp` import, `showBackToTop` state, scroll `useEffect`, floating button JSX |
| `__tests__/components/PostEditor.test.tsx` | Create | Tests for scroll visibility and click behaviour |

---

## Task 1: Write the tests

**Files:**
- Create: `__tests__/components/PostEditor.test.tsx`

Tests use `@testing-library/react` + `vitest`. `PostEditor` depends on `next/navigation` (mocked), server actions (mocked), and `sonner` (mocked). The scroll behaviour only requires faking `window.scrollY` and dispatching a `scroll` event.

- [ ] **Step 1: Create `__tests__/components/PostEditor.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PostEditor } from '@/components/dashboard/PostEditor'

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

// ── Mock server actions ───────────────────────────────────────────────────────
vi.mock('@/features/posts/actions', () => ({
  createPost: vi.fn(),
  updatePost: vi.fn(),
  publishPost: vi.fn(),
  unpublishPost: vi.fn(),
}))

// ── Mock sonner ───────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── Mock TipTap Editor ────────────────────────────────────────────────────────
vi.mock('@/components/editor/Editor', () => ({
  Editor: () => <div data-testid="editor" />,
}))

const minimalProps = {
  categories: [],
  tags: [],
}

describe('PostEditor — back to top button', () => {
  beforeEach(() => {
    // Reset scroll position before each test
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 })
  })

  it('does not show the back-to-top button at scroll position 0', () => {
    render(<PostEditor {...minimalProps} />)
    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
  })

  it('shows the back-to-top button after scrolling past 300px', () => {
    render(<PostEditor {...minimalProps} />)

    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 301 })
      fireEvent.scroll(window)
    })

    expect(screen.getByRole('button', { name: /back to top/i })).toBeInTheDocument()
  })

  it('hides the back-to-top button when scrolling back above 300px', () => {
    render(<PostEditor {...minimalProps} />)

    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 301 })
      fireEvent.scroll(window)
    })
    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 100 })
      fireEvent.scroll(window)
    })

    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
  })

  it('calls window.scrollTo when the back-to-top button is clicked', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(<PostEditor {...minimalProps} />)

    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 301 })
      fireEvent.scroll(window)
    })

    fireEvent.click(screen.getByRole('button', { name: /back to top/i }))
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })

    scrollToSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
npx vitest run __tests__/components/PostEditor.test.tsx
```

Expected: 4 tests fail — `queryByRole` / `getByRole` will not find the button since it doesn't exist yet.

---

## Task 2: Implement the back-to-top button

**Files:**
- Modify: `components/dashboard/PostEditor.tsx`

- [ ] **Step 1: Add `ArrowUp` to the lucide-react import**

Current import (line 12):
```ts
import {
  Loader2, Check, ImageIcon, Tag, Settings2,
  Search, BarChart3, ChevronLeft, Globe, Send, BookOpen, ExternalLink,
} from 'lucide-react'
```

Replace with:
```ts
import {
  Loader2, Check, ImageIcon, Tag, Settings2,
  Search, BarChart3, ChevronLeft, Globe, Send, BookOpen, ExternalLink, ArrowUp,
} from 'lucide-react'
```

- [ ] **Step 2: Add `useEffect` to the React import**

Current import (line 3):
```ts
import { useState } from 'react'
```

Replace with:
```ts
import { useState, useEffect } from 'react'
```

- [ ] **Step 3: Add `showBackToTop` state inside the `PostEditor` function**

After the existing state declarations:
```ts
const [saving, setSaving] = useState(false)
const [publishing, setPublishing] = useState(false)
```

Add:
```ts
const [showBackToTop, setShowBackToTop] = useState(false)
```

- [ ] **Step 4: Add the scroll `useEffect`**

After the `showBackToTop` state line, add:
```ts
useEffect(() => {
  function onScroll() {
    setShowBackToTop(window.scrollY > 300)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => window.removeEventListener('scroll', onScroll)
}, [])
```

- [ ] **Step 5: Add the floating button JSX**

Inside the `return`, after the closing `</div>` of the main grid layout and before the closing `</form>` tag. The grid div ends with `</div>` at approximately line 432 (just before `</form>`). Insert between those two tags:
```tsx
{showBackToTop && (
  <Button
    type="button"
    variant="secondary"
    size="icon"
    className="fixed bottom-6 right-6 z-50 rounded-full shadow-md"
    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    aria-label="Back to top"
  >
    <ArrowUp className="h-4 w-4" />
  </Button>
)}
```

- [ ] **Step 6: Run the tests and confirm they all pass**

```bash
npx vitest run __tests__/components/PostEditor.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 7: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/PostEditor.tsx __tests__/components/PostEditor.test.tsx
git commit -m "feat: add back-to-top floating button to edit post page"
```
