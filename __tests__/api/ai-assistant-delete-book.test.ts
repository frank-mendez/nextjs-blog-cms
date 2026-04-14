// __tests__/api/ai-assistant-delete-book.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/features/ai-assistant/chatService', () => ({
  getBookById: vi.fn(),
  deleteBook: vi.fn(),
}))

import { DELETE } from '@/app/api/ai-assistant/books/[bookId]/route'
import { createClient } from '@/lib/supabase/server'
import { getBookById, deleteBook } from '@/features/ai-assistant/chatService'
import type { AIBook } from '@/features/ai-assistant/types'

const mockCreateClient = vi.mocked(createClient)
const mockGetBookById = vi.mocked(getBookById)
const mockDeleteBook = vi.mocked(deleteBook)

function makeAuthMock(userId = 'user-1') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
  }
}

function makeRequest(): NextRequest {
  return new Request('http://localhost/api/ai-assistant/books/book-1') as unknown as NextRequest
}

const fakeBook: AIBook = {
  id: 'book-1',
  user_id: 'user-1',
  title: 'Test Book',
  file_name: 'test.pdf',
  page_count: 10,
  extracted_text: 'content',
  word_count: 100,
  char_count: 500,
  created_at: '2026-04-14T10:00:00Z',
  updated_at: '2026-04-14T10:00:00Z',
}

beforeEach(() => vi.clearAllMocks())

describe('DELETE /api/ai-assistant/books/[bookId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const res = await DELETE(makeRequest(), { params: { bookId: 'book-1' } })
    expect(res.status).toBe(401)
  })

  it('returns 404 when book does not exist', async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock() as unknown as Awaited<ReturnType<typeof createClient>>)
    mockGetBookById.mockResolvedValue(null)

    const res = await DELETE(makeRequest(), { params: { bookId: 'book-1' } })
    expect(res.status).toBe(404)
  })

  it('returns 404 when book belongs to a different user', async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock('other-user') as unknown as Awaited<ReturnType<typeof createClient>>)
    mockGetBookById.mockResolvedValue(fakeBook)

    const res = await DELETE(makeRequest(), { params: { bookId: 'book-1' } })
    expect(res.status).toBe(404)
  })

  it('deletes the book and returns 200 on success', async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock() as unknown as Awaited<ReturnType<typeof createClient>>)
    mockGetBookById.mockResolvedValue(fakeBook)
    mockDeleteBook.mockResolvedValue(undefined)

    const res = await DELETE(makeRequest(), { params: { bookId: 'book-1' } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockDeleteBook).toHaveBeenCalledWith('book-1', 'user-1')
  })
})
