import { NextRequest, NextResponse } from 'next/server'
import sanitizeHtml from 'sanitize-html'
import { createClient } from '@/lib/supabase/server'
import { getMessages, getChat } from '@/features/ai-assistant/chatService'
import { generateBlogPost } from '@/features/ai-assistant/llmService'
import { getDecryptedApiKey } from '@/features/ai-assistant/llmKeyService'
import { resolveTagIds, resolveCategoryId, generateUniqueSlugForApi } from '@/features/api-keys/apiKeyService'
import { createServiceClient } from '@/lib/supabase/service'
import type { LLMProvider } from '@/features/ai-assistant/types'

type Params = { params: { chatId: string } }

/**
 * POST /api/ai-assistant/chats/[chatId]/generate-post
 * Generates a blog post draft from the chat conversation.
 * Returns: { post_id: string, post_slug: string }
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { chatId } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chat = await getChat(chatId)
  if (!chat || chat.user_id !== user.id) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }

  const messages = await getMessages(chatId)
  if (messages.length === 0) {
    return NextResponse.json({ error: 'Chat has no messages' }, { status: 400 })
  }

  let apiKey: string
  try {
    apiKey = await getDecryptedApiKey(chat.llm_provider as LLMProvider)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No API key configured' },
      { status: 422 }
    )
  }

  const bookFileUrl = chat.book?.file_url
  if (!bookFileUrl) {
    return NextResponse.json({ error: 'Book file not found' }, { status: 500 })
  }

  const { data: signedData } = await supabase.storage
    .from('ai-books')
    .createSignedUrl(bookFileUrl, 3600)

  if (!signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to access PDF' }, { status: 500 })
  }

  let postData
  try {
    postData = await generateBlogPost({
      model: chat.llm_model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      bookSignedUrl: signedData.signedUrl,
      apiKey,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const serviceClient = createServiceClient()
  const [tagIds, categoryId, slug] = await Promise.all([
    resolveTagIds(postData.tags ?? [], serviceClient),
    resolveCategoryId(postData.category ?? '', serviceClient),
    generateUniqueSlugForApi(postData.title, serviceClient),
  ])

  const safeContent = postData.content
    ? sanitizeHtml(postData.content, {
        allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'br', 'hr'],
        allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
        transformTags: {
          a: (tagName, attribs) => ({
            tagName,
            attribs: attribs.target === '_blank'
              ? { ...attribs, rel: 'noopener noreferrer' }
              : attribs,
          }),
        },
      })
    : null

  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      title: postData.title,
      slug,
      excerpt: postData.excerpt ?? null,
      content: safeContent,
      seo_title: postData.meta_title ?? null,
      seo_description: postData.meta_description ?? null,
      author_id: profile.id,
      status: 'draft',
      category_id: categoryId,
      cover_image: null,
    })
    .select()
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: postError?.message ?? 'Failed to create post' }, { status: 500 })
  }

  if (tagIds.length > 0) {
    const { error: postTagsError } = await supabase
      .from('post_tags')
      .insert(tagIds.map((tag_id) => ({ post_id: post.id, tag_id })))

    if (postTagsError) {
      await supabase.from('posts').delete().eq('id', post.id)
      return NextResponse.json(
        { error: postTagsError.message ?? 'Failed to create post tags' },
        { status: 500 }
      )
    }
  }

  const { error: aiGeneratedPostError } = await supabase
    .from('ai_generated_posts')
    .insert({ chat_id: chatId, post_id: post.id })

  if (aiGeneratedPostError) {
    await supabase.from('posts').delete().eq('id', post.id)
    return NextResponse.json(
      { error: aiGeneratedPostError.message ?? 'Failed to link generated post to chat' },
      { status: 500 }
    )
  }

  return NextResponse.json({ post_id: post.id, post_slug: post.slug })
}
