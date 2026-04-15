import { describe, it, expect, afterEach } from 'vitest'
import robots from '@/app/robots'

describe('robots', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SITE_URL

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalUrl
    }
  })

  it('uses NEXT_PUBLIC_SITE_URL when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    const result = robots()
    expect(result.sitemap).toBe('https://example.com/sitemap.xml')
  })

  it('falls back to localhost:3000 when env var is not set', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    const result = robots()
    expect(result.sitemap).toBe('http://localhost:3000/sitemap.xml')
  })

  it('allows all paths under /', () => {
    const { rules } = robots()
    const rule = Array.isArray(rules) ? rules[0] : rules
    expect(rule.userAgent).toBe('*')
    expect(rule.allow).toBe('/')
  })

  it('disallows /dashboard/ and /api/', () => {
    const { rules } = robots()
    const rule = Array.isArray(rules) ? rules[0] : rules
    expect(rule.disallow).toContain('/dashboard/')
    expect(rule.disallow).toContain('/api/')
  })
})
