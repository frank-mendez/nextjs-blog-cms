import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import {
  createBook,
  getBooks,
  getBookById,
  createChat,
  getChats,
  getChatsByBook,
  getChat,
  updateChatTitle,
  updateChatLastMessage,
  getMessages,
  addMessage,
  deleteChat,
  deleteBook,
} from '@/features/ai-assistant/chatService'

const mockCreateClient = vi.mocked(createClient)

/**
 * Creates a thenable mock chain where every chainable method returns itself,
 * so any sequence of chained calls can be awaited to get `result`.
 */
function makeChain(result: { data?: unknown; error?: unknown }) {
  const obj: any = {
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (e: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
    single: vi.fn().mockResolvedValue(result),
  }

  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
    obj[method] = vi.fn().mockReturnValue(obj)
  }

  return obj
}

function makeSupabase(result: { data?: unknown; error?: unknown }) {
  const q = makeChain(result)
  return { from: vi.fn().mockReturnValue(q) }
}

const fakeBook = {
  id: 'book-1', user_id: 'u1', title: 'Test', file_name: 'f.pdf',
  page_count: 5, word_count: 100, char_count: 500,
  extracted_text: 'content', created_at: '2024-01-01', updated_at: '2024-01-01',
}

const fakeChat = {
  id: 'chat-1', book_id: 'book-1', user_id: 'u1',
  llm_provider: 'claude', llm_model: 'claude-sonnet-4-6',
  title: 'Chat', last_message_at: null, created_at: '2024-01-01', updated_at: '2024-01-01',
}

const fakeMessage = {
  id: 'msg-1', chat_id: 'chat-1', role: 'user', content: 'Hello', created_at: '2024-01-01',
}

beforeEach(() => { vi.clearAllMocks() })

// ─── createBook ───────────────────────────────────────────────────────────────

describe('createBook', () => {
  it('returns the created book on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: fakeBook, error: null }) as any)
    const result = await createBook({ user_id: 'u1', title: 'Test', file_name: 'f.pdf', extracted_text: 'content' })
    expect(result).toEqual(fakeBook)
  })

  it('throws when Supabase returns an error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: { message: 'insert failed' } }) as any)
    await expect(createBook({ user_id: 'u1', title: 'Test', file_name: 'f.pdf', extracted_text: 'content' })).rejects.toThrow('insert failed')
  })
})

// ─── getBooks ─────────────────────────────────────────────────────────────────

describe('getBooks', () => {
  it('returns books array on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: [fakeBook], error: null }) as any)
    const result = await getBooks('u1')
    expect(result).toEqual([fakeBook])
  })

  it('returns empty array when data is null', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: null }) as any)
    const result = await getBooks('u1')
    expect(result).toEqual([])
  })

  it('throws on error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: { message: 'fetch failed' } }) as any)
    await expect(getBooks('u1')).rejects.toThrow('fetch failed')
  })
})

// ─── getBookById ──────────────────────────────────────────────────────────────

describe('getBookById', () => {
  it('returns the book on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: fakeBook, error: null }) as any)
    const result = await getBookById('book-1')
    expect(result).toEqual(fakeBook)
  })

  it('returns null when Supabase returns an error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: { message: 'not found' } }) as any)
    const result = await getBookById('missing')
    expect(result).toBeNull()
  })
})

// ─── createChat ───────────────────────────────────────────────────────────────

describe('createChat', () => {
  it('returns the created chat on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: fakeChat, error: null }) as any)
    const result = await createChat({ book_id: 'book-1', user_id: 'u1', llm_provider: 'claude', llm_model: 'claude-sonnet-4-6' })
    expect(result).toEqual(fakeChat)
  })

  it('throws on error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: { message: 'chat insert failed' } }) as any)
    await expect(createChat({ book_id: 'book-1', user_id: 'u1', llm_provider: 'claude', llm_model: 'claude-sonnet-4-6' })).rejects.toThrow('chat insert failed')
  })
})

// ─── getChats ─────────────────────────────────────────────────────────────────

describe('getChats', () => {
  it('returns chats on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: [fakeChat], error: null }) as any)
    const result = await getChats('u1')
    expect(result).toEqual([fakeChat])
  })

  it('returns empty array when data is null', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: null }) as any)
    const result = await getChats('u1')
    expect(result).toEqual([])
  })

  it('throws on error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: { message: 'fetch failed' } }) as any)
    await expect(getChats('u1')).rejects.toThrow('fetch failed')
  })
})

// ─── getChatsByBook ───────────────────────────────────────────────────────────

describe('getChatsByBook', () => {
  it('returns chats for a book', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: [fakeChat], error: null }) as any)
    const result = await getChatsByBook('book-1')
    expect(result).toEqual([fakeChat])
  })

  it('returns empty array when data is null', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: null }) as any)
    const result = await getChatsByBook('book-1')
    expect(result).toEqual([])
  })

  it('throws on error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: { message: 'fetch failed' } }) as any)
    await expect(getChatsByBook('book-1')).rejects.toThrow('fetch failed')
  })
})

// ─── getChat ──────────────────────────────────────────────────────────────────

describe('getChat', () => {
  it('returns chat on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: fakeChat, error: null }) as any)
    const result = await getChat('chat-1')
    expect(result).toEqual(fakeChat)
  })

  it('returns null on error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: { message: 'not found' } }) as any)
    const result = await getChat('missing')
    expect(result).toBeNull()
  })
})

// ─── updateChatTitle / updateChatLastMessage ──────────────────────────────────

describe('updateChatTitle', () => {
  it('resolves without throwing on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ error: null }) as any)
    await expect(updateChatTitle('chat-1', 'New Title')).resolves.toBeUndefined()
  })
})

describe('updateChatLastMessage', () => {
  it('resolves without throwing', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ error: null }) as any)
    await expect(updateChatLastMessage('chat-1')).resolves.toBeUndefined()
  })
})

// ─── getMessages ──────────────────────────────────────────────────────────────

describe('getMessages', () => {
  it('returns messages on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: [fakeMessage], error: null }) as any)
    const result = await getMessages('chat-1')
    expect(result).toEqual([fakeMessage])
  })

  it('returns empty array when data is null', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: null }) as any)
    const result = await getMessages('chat-1')
    expect(result).toEqual([])
  })

  it('throws on error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: { message: 'fetch failed' } }) as any)
    await expect(getMessages('chat-1')).rejects.toThrow('fetch failed')
  })
})

// ─── addMessage ───────────────────────────────────────────────────────────────

describe('addMessage', () => {
  it('returns the created message on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: fakeMessage, error: null }) as any)
    const result = await addMessage({ chat_id: 'chat-1', role: 'user', content: 'Hello' })
    expect(result).toEqual(fakeMessage)
  })

  it('throws on error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: { message: 'insert failed' } }) as any)
    await expect(addMessage({ chat_id: 'chat-1', role: 'user', content: 'Hello' })).rejects.toThrow('insert failed')
  })
})

// ─── deleteChat ───────────────────────────────────────────────────────────────

describe('deleteChat', () => {
  it('resolves without throwing on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ error: null }) as any)
    await expect(deleteChat('chat-1', 'u1')).resolves.toBeUndefined()
  })

  it('throws when Supabase returns an error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ error: { message: 'delete failed' } }) as any)
    await expect(deleteChat('chat-1', 'u1')).rejects.toThrow('delete failed')
  })
})

// ─── deleteBook ───────────────────────────────────────────────────────────────

describe('deleteBook', () => {
  it('resolves without throwing on success', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ error: null }) as any)
    await expect(deleteBook('book-1', 'u1')).resolves.toBeUndefined()
  })

  it('throws when Supabase returns an error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ error: { message: 'delete failed' } }) as any)
    await expect(deleteBook('book-1', 'u1')).rejects.toThrow('delete failed')
  })
})
