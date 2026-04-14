-- Allow headless AI generation chat records that have no associated PDF book.
ALTER TABLE public.ai_chats ALTER COLUMN book_id DROP NOT NULL;
