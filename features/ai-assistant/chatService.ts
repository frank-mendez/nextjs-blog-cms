import { createClient } from '@/lib/supabase/server'
import type { AIBook, AIChat, AIMessage, LLMProvider } from './types'

// ─── Books ────────────────────────────────────────────────────────────────────

export async function createBook(data: {
  user_id: string
  title: string
  file_name: string
  file_url: string
  file_size?: number
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
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AIBook[]
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
    .select('*, book:ai_books(id, title, file_name, file_url)')
    .eq('id', chatId)
    .single()

  if (error) return null
  return data as AIChat & { book: AIBook }
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
