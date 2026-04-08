'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Plus, ChevronDown, ChevronRight, ArrowLeft, FileText, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { NewChatModal } from './NewChatModal'
import type { AIChat, AIBook } from '@/features/ai-assistant/types'

export function AISidebar() {
  const pathname = usePathname()
  const [chats, setChats] = useState<AIChat[]>([])
  const [books, setBooks] = useState<AIBook[]>([])
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [chatsRes, booksRes] = await Promise.all([
        fetch('/api/ai-assistant/chats').then((r) => r.json()),
        fetch('/api/ai-assistant/books').then((r) => r.json()),
      ])
      setChats(chatsRes.chats ?? [])
      setBooks(booksRes.books ?? [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function toggleBook(bookId: string) {
    setExpandedBooks((prev) => {
      const next = new Set(prev)
      next.has(bookId) ? next.delete(bookId) : next.add(bookId)
      return next
    })
  }

  const recentChats = chats.slice(0, 10)

  const chatsByBook = books.map((book) => ({
    book,
    chats: chats.filter((c) => c.book_id === book.id),
  }))

  const currentChatId = pathname.match(/\/dashboard\/ai-assistant\/([^/]+)/)?.[1]

  return (
    <>
      <aside className="w-64 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white text-sm">AI Assistant</span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </Link>
          <Button
            onClick={() => setModalOpen(true)}
            className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Chat
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {recentChats.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-2 mb-1.5">
                    Recent
                  </p>
                  <div className="space-y-0.5">
                    {recentChats.map((chat) => (
                      <Link
                        key={chat.id}
                        href={`/dashboard/ai-assistant/${chat.id}`}
                        className={cn(
                          'flex flex-col px-2 py-2 rounded-lg text-xs transition-colors',
                          currentChatId === chat.id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        )}
                      >
                        <span className="font-medium truncate">{chat.title}</span>
                        <span className={cn(
                          'text-[10px] truncate',
                          currentChatId === chat.id ? 'text-blue-200' : 'text-slate-600'
                        )}>
                          {chat.book?.title} · {formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true })}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {chatsByBook.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-2 mb-1.5">
                    By Book
                  </p>
                  <div className="space-y-1">
                    {chatsByBook.map(({ book, chats: bookChats }) => (
                      <div key={book.id}>
                        <button
                          onClick={() => toggleBook(book.id)}
                          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          {expandedBooks.has(book.id)
                            ? <ChevronDown className="h-3 w-3 shrink-0" />
                            : <ChevronRight className="h-3 w-3 shrink-0" />
                          }
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate font-medium">{book.title}</span>
                          <span className="ml-auto text-[10px] text-slate-600 shrink-0">
                            {bookChats.length}
                          </span>
                        </button>
                        {expandedBooks.has(book.id) && (
                          <div className="ml-5 mt-0.5 space-y-0.5">
                            {bookChats.length === 0 ? (
                              <p className="text-[10px] text-slate-600 px-2 py-1">No chats yet</p>
                            ) : (
                              bookChats.map((chat) => (
                                <Link
                                  key={chat.id}
                                  href={`/dashboard/ai-assistant/${chat.id}`}
                                  className={cn(
                                    'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-colors',
                                    currentChatId === chat.id
                                      ? 'bg-blue-600 text-white'
                                      : 'text-slate-500 hover:text-white hover:bg-slate-800'
                                  )}
                                >
                                  <MessageSquare className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{chat.title}</span>
                                </Link>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {chats.length === 0 && books.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No chats yet.</p>
                  <p className="text-xs text-slate-600">Click New Chat to start.</p>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <NewChatModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onChatCreated={(chatId: string) => {
          setModalOpen(false)
          loadData()
          window.location.href = `/dashboard/ai-assistant/${chatId}`
        }}
      />
    </>
  )
}
