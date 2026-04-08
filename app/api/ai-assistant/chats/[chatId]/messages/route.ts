import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getMessages, addMessage, updateChatLastMessage, updateChatTitle, getChat,
} from '@/features/ai-assistant/chatService'
import { sendMessage, generateChatTitle } from '@/features/ai-assistant/llmService'
import { getDecryptedApiKey } from '@/features/ai-assistant/llmKeyService'
import type { LLMProvider } from '@/features/ai-assistant/types'

type Params = { params: Promise<{ chatId: string }> }

/**
 * GET /api/ai-assistant/chats/[chatId]/messages
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { chatId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chat = await getChat(chatId)
  if (!chat || chat.user_id !== user.id) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }

  const messages = await getMessages(chatId)
  return NextResponse.json({ messages })
}

/**
 * POST /api/ai-assistant/chats/[chatId]/messages
 * Body: { content: string }
 * Returns a streaming text/plain response (LLM reply chunks).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { chatId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chat = await getChat(chatId)
  if (!chat || chat.user_id !== user.id) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }

  const { content } = await req.json() as { content?: string }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  // Save user message
  await addMessage({ chat_id: chatId, role: 'user', content: content.trim() })

  // Fetch full history (including the message just saved)
  const history = await getMessages(chatId)
  const isFirstMessage = history.filter((m) => m.role === 'user').length === 1

  // Get decrypted API key
  let apiKey: string
  try {
    apiKey = await getDecryptedApiKey(chat.llm_provider as LLMProvider)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No API key configured' },
      { status: 422 }
    )
  }

  // Generate signed URL for the PDF (1 hour TTL)
  // chat.book.file_url is the storage path (set by getChat which selects book with file_url)
  const bookFileUrl = (chat as any).book?.file_url as string | undefined
  if (!bookFileUrl) {
    return NextResponse.json({ error: 'Book file not found' }, { status: 500 })
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from('ai-books')
    .createSignedUrl(bookFileUrl, 3600)

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to access PDF' }, { status: 500 })
  }

  // Stream the LLM response
  const llmStream = sendMessage({
    model: chat.llm_model,
    provider: chat.llm_provider as LLMProvider,
    messages: history,
    bookSignedUrl: signedData.signedUrl,
    apiKey,
  })

  let fullResponse = ''

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of llmStream) {
          fullResponse += chunk
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      } finally {
        // Save assistant message and update metadata (fire and forget)
        Promise.all([
          addMessage({ chat_id: chatId, role: 'assistant', content: fullResponse }),
          updateChatLastMessage(chatId),
          isFirstMessage
            ? generateChatTitle(content.trim(), chat.llm_model, apiKey)
                .then((title) => updateChatTitle(chatId, title))
                .catch(() => null)
            : Promise.resolve(),
        ]).catch(console.error)
      }
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
