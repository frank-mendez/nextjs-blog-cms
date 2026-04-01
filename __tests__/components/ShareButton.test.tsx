import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShareButton } from '@/components/ShareButton'

const TEST_URL = 'https://example.com/blog/my-post'
const TEST_TITLE = 'My Test Post'

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn() },
  writable: true,
  configurable: true,
})

// Mock window.open
const mockWindowOpen = vi.fn()
vi.stubGlobal('open', mockWindowOpen)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ShareButton', () => {
  it('renders the share trigger button', () => {
    render(<ShareButton url={TEST_URL} title={TEST_TITLE} />)
    expect(screen.getByRole('button', { name: /share this post/i })).toBeInTheDocument()
  })

  it('opens the dropdown when trigger is clicked', async () => {
    render(<ShareButton url={TEST_URL} title={TEST_TITLE} />)
    fireEvent.click(screen.getByRole('button', { name: /share this post/i }))
    await waitFor(() => {
      expect(screen.getByText('Copy link')).toBeInTheDocument()
    })
  })

  describe('Copy link', () => {
    it('calls clipboard.writeText with the post URL', async () => {
      vi.mocked(navigator.clipboard.writeText).mockResolvedValueOnce(undefined)
      render(<ShareButton url={TEST_URL} title={TEST_TITLE} />)
      fireEvent.click(screen.getByRole('button', { name: /share this post/i }))
      await waitFor(() => screen.getByText('Copy link'))
      fireEvent.click(screen.getByText('Copy link'))
      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_URL))
    })

    it('shows "Link copied!" feedback after successful copy', async () => {
      vi.mocked(navigator.clipboard.writeText).mockResolvedValueOnce(undefined)
      render(<ShareButton url={TEST_URL} title={TEST_TITLE} />)
      const trigger = screen.getByRole('button', { name: /share this post/i })

      // Open → click Copy link → dropdown closes
      fireEvent.click(trigger)
      await waitFor(() => screen.getByText('Copy link'))
      fireEvent.click(screen.getByText('Copy link'))

      // Wait for async clipboard write to resolve, then reopen dropdown
      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
      fireEvent.click(trigger)
      await waitFor(() => {
        expect(screen.getByText('Link copied!')).toBeInTheDocument()
      })
    })
  })

  describe('Social share options', () => {
    const cases = [
      {
        label: 'Share on Bluesky',
        urlPattern: 'bsky.app',
      },
      {
        label: 'Share on Facebook',
        urlPattern: 'facebook.com/sharer',
      },
      {
        label: 'Share on LinkedIn',
        urlPattern: 'linkedin.com/sharing',
      },
      {
        label: 'Share on Threads',
        urlPattern: 'threads.net/intent',
      },
      {
        label: 'Share on X',
        urlPattern: 'x.com/intent/tweet',
      },
    ]

    it.each(cases)('opens $label in a new tab with the correct URL', async ({ label, urlPattern }) => {
      render(<ShareButton url={TEST_URL} title={TEST_TITLE} />)
      fireEvent.click(screen.getByRole('button', { name: /share this post/i }))
      await waitFor(() => screen.getByText(label))
      fireEvent.click(screen.getByText(label))
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining(urlPattern),
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('includes the encoded post URL in social share links', async () => {
      render(<ShareButton url={TEST_URL} title={TEST_TITLE} />)
      fireEvent.click(screen.getByRole('button', { name: /share this post/i }))
      await waitFor(() => screen.getByText('Share on X'))
      fireEvent.click(screen.getByText('Share on X'))
      const calledUrl: string = mockWindowOpen.mock.calls[0][0]
      expect(calledUrl).toContain(encodeURIComponent(TEST_URL))
    })
  })
})
