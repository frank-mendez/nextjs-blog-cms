// components/ai-assistant/NewChatModal.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, ChevronRight, Loader2, AlertTriangle, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { AVAILABLE_MODELS } from '@/features/ai-assistant/types'
import type { AIBook, LLMModel, LLMProvider, LLMProviderKeyRecord } from '@/features/ai-assistant/types'
import { format } from 'date-fns'

type Props = {
  open: boolean
  onClose: () => void
  onChatCreated: (chatId: string) => void
}

export function NewChatModal({ open, onClose, onChatCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [books, setBooks] = useState<AIBook[]>([])
  const [providerKeys, setProviderKeys] = useState<LLMProviderKeyRecord[]>([])
  const [selectedBook, setSelectedBook] = useState<AIBook | null>(null)
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [creating, setCreating] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { setStep(1); setSelectedBook(null); setSelectedModel(null); return }

    Promise.all([
      fetch('/api/ai-assistant/books').then((r) => r.json()),
      fetch('/api/developer/llm-keys').then((r) => r.json()),
    ]).then(([booksData, keysData]) => {
      setBooks(booksData.books ?? [])
      const keys: LLMProviderKeyRecord[] = keysData.keys ?? []
      setProviderKeys(keys)
      // Auto-select default model
      const hasClaudeKey = keys.some((k) => k.provider === 'claude' && k.is_valid)
      const hasGeminiKey = keys.some((k) => k.provider === 'gemini' && k.is_valid)
      const defaultModel = hasClaudeKey
        ? AVAILABLE_MODELS.find((m) => m.id === 'claude-sonnet-4-6') ?? null
        : hasGeminiKey
          ? AVAILABLE_MODELS.find((m) => m.provider === 'gemini') ?? null
          : null
      setSelectedModel(defaultModel)
    })
  }, [open])

  function isProviderEnabled(provider: LLMProvider) {
    return providerKeys.some((k) => k.provider === provider && k.is_valid)
  }

  function getDisabledReason(model: LLMModel): string | null {
    if (!isProviderEnabled(model.provider)) {
      const label = model.provider === 'claude' ? 'Anthropic' : 'Google'
      return `Add your ${label} API key in Developer Settings to use ${model.name}`
    }
    return null
  }

  async function handleFileSelect(file: File) {
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file'); return }
    if (file.size > 20 * 1024 * 1024) { toast.error('File too large — max 20MB'); return }

    setUploading(true)
    setUploadProgress(10)

    try {
      const fd = new FormData()
      fd.append('file', file)

      setUploadProgress(40)
      const res = await fetch('/api/ai-assistant/books', { method: 'POST', body: fd })
      setUploadProgress(90)

      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Upload failed')
        return
      }

      const { book } = await res.json()
      setBooks((prev) => [book, ...prev])
      setSelectedBook(book)
      setUploadProgress(100)
      setTimeout(() => { setStep(2); setUploadProgress(0) }, 300)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleStartChat() {
    if (!selectedBook || !selectedModel) return
    setCreating(true)
    try {
      const res = await fetch('/api/ai-assistant/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: selectedBook.id,
          llm_provider: selectedModel.provider,
          llm_model: selectedModel.id,
        }),
      })
      if (!res.ok) { toast.error('Failed to create chat'); return }
      const { chat } = await res.json()
      onChatCreated(chat.id)
    } catch {
      toast.error('Failed to create chat')
    } finally {
      setCreating(false)
    }
  }

  const noKeysConfigured = !providerKeys.some((k) => k.is_valid)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Upload a PDF or select an existing book' : 'Choose your AI model'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                dragOver ? 'border-blue-500 bg-blue-50/10' : 'border-slate-200 hover:border-slate-300',
                uploading && 'pointer-events-none opacity-60'
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFileSelect(f)
              }}
            >
              <input
                ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
              {uploading ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 text-blue-500 mx-auto animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading… {uploadProgress}%</p>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Drop a PDF here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse — max 20MB</p>
                </>
              )}
            </div>

            {/* Existing books */}
            {books.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Or select an existing book</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {books.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => { setSelectedBook(book); setStep(2) }}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left text-sm transition-colors',
                        selectedBook?.id === book.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{book.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {book.file_name} · {format(new Date(book.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && selectedBook && (
          <div className="space-y-4">
            {/* Selected book recap */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
              <FileText className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-sm font-medium truncate">{selectedBook.title}</span>
              <button
                onClick={() => setStep(1)}
                className="ml-auto text-xs text-blue-600 hover:underline shrink-0"
              >
                Change
              </button>
            </div>

            {/* No keys warning */}
            {noKeysConfigured && (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  No LLM providers configured.{' '}
                  <a href="/dashboard/developer" className="underline font-medium">
                    Go to Developer Settings
                  </a>{' '}
                  to add your API keys.
                </p>
              </div>
            )}

            {/* Model selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Choose model</p>
              {(['claude', 'gemini'] as LLMProvider[]).map((provider) => {
                const providerModels = AVAILABLE_MODELS.filter((m) => m.provider === provider)
                const providerLabel = provider === 'claude' ? 'Anthropic' : 'Google'
                return (
                  <div key={provider}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5 px-1">
                      {providerLabel}
                    </p>
                    <div className="space-y-1">
                      {providerModels.map((model) => {
                        const disabledReason = getDisabledReason(model)
                        const isSelected = selectedModel?.id === model.id
                        return (
                          <button
                            key={model.id}
                            title={disabledReason ?? ''}
                            disabled={!!disabledReason}
                            onClick={() => setSelectedModel(model)}
                            className={cn(
                              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left text-sm transition-colors',
                              isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : disabledReason
                                  ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                                  : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                            )}
                          >
                            <Bot className="h-4 w-4 shrink-0 text-slate-400" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{model.name}</span>
                                {model.free && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Free</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{model.description}</p>
                            </div>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-9">
                Back
              </Button>
              <Button
                onClick={handleStartChat}
                disabled={!selectedModel || creating}
                className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Start Chat
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
