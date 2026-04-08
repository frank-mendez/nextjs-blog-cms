-- ============================================
-- AI ASSISTANT TABLES
-- ============================================

-- Uploaded PDF books
CREATE TABLE IF NOT EXISTS public.ai_books (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  file_url   TEXT NOT NULL,   -- storage path within 'ai-books' bucket, e.g. {userId}/{bookId}/{filename}
  file_size  INTEGER,          -- bytes
  page_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own books"
  ON public.ai_books FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS ai_books_updated_at ON public.ai_books;
CREATE TRIGGER ai_books_updated_at
  BEFORE UPDATE ON public.ai_books
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Chat sessions tied to a book
CREATE TABLE IF NOT EXISTS public.ai_chats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         UUID NOT NULL REFERENCES public.ai_books(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'New Chat',
  llm_provider    TEXT NOT NULL DEFAULT 'claude' CHECK (llm_provider IN ('claude', 'gemini')),
  llm_model       TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chats"
  ON public.ai_chats FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS ai_chats_updated_at ON public.ai_chats;
CREATE TRIGGER ai_chats_updated_at
  BEFORE UPDATE ON public.ai_chats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Individual messages in a chat
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own messages"
  ON public.ai_messages FOR ALL
  USING (
    chat_id IN (
      SELECT id FROM public.ai_chats WHERE user_id = auth.uid()
    )
  );

-- Links a generated draft post back to the chat that produced it
CREATE TABLE IF NOT EXISTS public.ai_generated_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_generated_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own generated posts"
  ON public.ai_generated_posts FOR ALL
  USING (
    chat_id IN (
      SELECT id FROM public.ai_chats WHERE user_id = auth.uid()
    )
  );

-- LLM provider API keys (admin-managed, global)
-- user_id = the admin who saved the key; fetched globally (bypassing RLS) for LLM calls
CREATE TABLE IF NOT EXISTS public.llm_provider_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('claude', 'gemini')),
  encrypted_key    TEXT NOT NULL,       -- AES-256-GCM, format: iv:authTag:ciphertext (base64)
  key_preview      TEXT NOT NULL,       -- last 4 chars, e.g. "...a3f9"
  is_valid         BOOLEAN DEFAULT NULL, -- null = untested, true = verified, false = failed
  last_verified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.llm_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own llm keys"
  ON public.llm_provider_keys FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS llm_provider_keys_updated_at ON public.llm_provider_keys;
CREATE TRIGGER llm_provider_keys_updated_at
  BEFORE UPDATE ON public.llm_provider_keys
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-books', 'ai-books', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload/read/delete only their own files
-- File path convention: {userId}/{randomBookId}/{filename}
CREATE POLICY "Users can upload own PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ai-books'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can read own PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ai-books'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can delete own PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ai-books'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS ai_books_user_id_idx ON public.ai_books(user_id);
CREATE INDEX IF NOT EXISTS ai_chats_user_id_idx ON public.ai_chats(user_id);
CREATE INDEX IF NOT EXISTS ai_chats_book_id_idx ON public.ai_chats(book_id);
CREATE INDEX IF NOT EXISTS ai_chats_last_message_at_idx ON public.ai_chats(last_message_at DESC);
CREATE INDEX IF NOT EXISTS ai_messages_chat_id_idx ON public.ai_messages(chat_id);
