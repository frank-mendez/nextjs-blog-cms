# Back-to-Top Button — Design Spec

**Date:** 2026-03-22
**Scope:** Edit Post page (`PostEditor.tsx`)

## Goal

Add a floating "back to top" button to the edit post page that appears after the user scrolls down, allowing them to return to the sticky action bar quickly on long posts.

## Behaviour

- Visible only when `window.scrollY > 300`
- Fixed position: `bottom-6 right-6`, `z-50`
- Clicking scrolls to `{ top: 0, behavior: 'smooth' }`
- Hidden by default; no layout shift

## Implementation

**File:** `components/dashboard/PostEditor.tsx`

1. Add `showBackToTop` boolean state (default `false`)
2. Add `useEffect` that attaches/cleans up a `window` scroll listener; sets state based on `scrollY > 300`
3. Add `ArrowUp` to the lucide-react import
4. Render at the bottom of the JSX (inside the `<form>`):

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

## Non-Goals

- No animation/transition (keep it simple)
- Not added to other dashboard pages
- No new files
