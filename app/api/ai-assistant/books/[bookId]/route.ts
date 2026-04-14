// app/api/ai-assistant/books/[bookId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookById, deleteBook } from '@/features/ai-assistant/chatService'

type Params = { params: { bookId: string } }

/**
 * DELETE /api/ai-assistant/books/[bookId]
 * Deletes a book and all its associated chats (via cascade in DB).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { bookId } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const book = await getBookById(bookId)
  if (!book || book.user_id !== user.id) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  await deleteBook(bookId, user.id)
  return NextResponse.json({ success: true })
}
