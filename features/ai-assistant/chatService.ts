// features/ai-assistant/chatService.ts
import { createClient } from '@/lib/supabase/server'
import type { AIBook, AIChat, AIMessage, LLMProvider } from './types'

// ─── Books ────────────────────────────────────────────────────────────────────

export async function createBook(data: {
  id?: string
  user_id: string
  title: string
  file_name: string
  page_count?: number
  extracted_text: string
}): Promise<AIBook> {
  const supabase = await createClient()
  const { data: book, error } = await supabase
    .from('ai_books')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return book as AIBook
}

export async function getBooks(userId: string): Promise<AIBook[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_books')
    .select('id, user_id, title, file_name, page_count, word_count, char_count, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIBook[]
}

export async function getBookById(bookId: string): Promise<AIBook | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_books')
    .select('*')
    .eq('id', bookId)
    .single()

  if (error) return null
  return data as AIBook
}

// ─── Chats ────────────────────────────────────────────────────────────────────

export async function createChat(data: {
  book_id: string
  user_id: string
  llm_provider: LLMProvider
  llm_model: string
}): Promise<AIChat> {
  const supabase = await createClient()
  const { data: chat, error } = await supabase
    .from('ai_chats')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return chat as AIChat
}

export async function getChats(userId: string): Promise<AIChat[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_chats')
    .select('*, book:ai_books(id, title, file_name)')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIChat[]
}

export async function getChatsByBook(bookId: string): Promise<AIChat[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_chats')
    .select('*, book:ai_books(id, title, file_name)')
    .eq('book_id', bookId)
    .order('last_message_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIChat[]
}

export async function getChat(chatId: string): Promise<AIChat | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_chats')
    .select('*, book:ai_books(id, title, file_name)')
    .eq('id', chatId)
    .single()

  if (error) return null
  return data as AIChat
}

export async function updateChatTitle(chatId: string, title: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ai_chats').update({ title }).eq('id', chatId)
}

export async function updateChatLastMessage(chatId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('ai_chats')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', chatId)
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(chatId: string): Promise<AIMessage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIMessage[]
}

export async function addMessage(data: {
  chat_id: string
  role: 'user' | 'assistant'
  content: string
}): Promise<AIMessage> {
  const supabase = await createClient()
  const { data: message, error } = await supabase
    .from('ai_messages')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return message as AIMessage
}

export async function deleteChat(chatId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('ai_chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function deleteBook(bookId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('ai_books')
    .delete()
    .eq('id', bookId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}
