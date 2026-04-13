import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit } from '@/lib/rateLimit'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('checkRateLimit', () => {
  it('allows first request', () => {
    const result = checkRateLimit('key1', 5, 60_000)
    expect(result.allowed).toBe(true)
  })

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('key2', 5, 60_000).allowed).toBe(true)
    }
  })

  it('blocks the request exceeding the limit', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('key3', 5, 60_000)
    const result = checkRateLimit('key3', 5, 60_000)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('resets after the window expires', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('key4', 5, 60_000)
    vi.advanceTimersByTime(61_000)
    expect(checkRateLimit('key4', 5, 60_000).allowed).toBe(true)
  })

  it('different keys are independent', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('key5a', 5, 60_000)
    expect(checkRateLimit('key5b', 5, 60_000).allowed).toBe(true)
  })
})
