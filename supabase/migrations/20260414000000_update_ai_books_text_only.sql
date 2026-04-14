-- supabase/migrations/20260414000000_update_ai_books_text_only.sql

-- ─── ai_books: drop storage columns, add text columns ────────────────────────

-- Add extracted_text with a default so existing rows don't violate NOT NULL
ALTER TABLE public.ai_books
  ADD COLUMN IF NOT EXISTS extracted_text TEXT NOT NULL DEFAULT '';

-- Remove the DEFAULT now that the column exists (new rows must supply the value)
ALTER TABLE public.ai_books
  ALTER COLUMN extracted_text DROP DEFAULT;

-- Drop storage columns
ALTER TABLE public.ai_books
  DROP COLUMN IF EXISTS file_url,
  DROP COLUMN IF EXISTS file_size;

-- Add computed columns for display / token estimation
ALTER TABLE public.ai_books
  ADD COLUMN IF NOT EXISTS word_count INTEGER GENERATED ALWAYS AS
    (array_length(string_to_array(trim(extracted_text), ' '), 1)) STORED;

ALTER TABLE public.ai_books
  ADD COLUMN IF NOT EXISTS char_count INTEGER GENERATED ALWAYS AS
    (char_length(extracted_text)) STORED;

-- ─── ai_chats: allow 'openai' as a provider ──────────────────────────────────

ALTER TABLE public.ai_chats
  DROP CONSTRAINT IF EXISTS ai_chats_llm_provider_check;

ALTER TABLE public.ai_chats
  ADD CONSTRAINT ai_chats_llm_provider_check
  CHECK (llm_provider IN ('claude', 'gemini', 'openai'));

-- ─── llm_provider_keys: allow 'openai' as a provider ─────────────────────────

ALTER TABLE public.llm_provider_keys
  DROP CONSTRAINT IF EXISTS llm_provider_keys_provider_check;

ALTER TABLE public.llm_provider_keys
  ADD CONSTRAINT llm_provider_keys_provider_check
  CHECK (provider IN ('claude', 'gemini', 'openai'));
