import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBook, getBooks } from '@/features/ai-assistant/chatService'

/**
 * POST /api/ai-assistant/books
 * Accepts multipart/form-data with a PDF file (max 20MB).
 * Uploads to Supabase Storage and creates an ai_books record.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const titleOverride = formData.get('title') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
  }

  const bookId = crypto.randomUUID()
  const safeFileName = file.name.replace(/[/\\?%*:|"<>\x00-\x1f]/g, '_')
  const storagePath = `${user.id}/${bookId}/${safeFileName}`

  const { error: uploadError } = await supabase.storage
    .from('ai-books')
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const title = titleOverride?.trim() || file.name.replace(/\.pdf$/i, '')

  const book = await createBook({
    id: bookId,
    user_id: user.id,
    title,
    file_name: safeFileName,
    file_url: storagePath,
    file_size: file.size,
  })

  return NextResponse.json({ book }, { status: 201 })
}

/**
 * GET /api/ai-assistant/books
 * Returns all books for the current user.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const books = await getBooks(user.id)
  return NextResponse.json({ books })
}
