-- ============================================================
-- Migration: add confirmed_at to profiles + sync trigger
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add confirmed_at column to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- 2. Backfill confirmed_at for any already-confirmed users
UPDATE public.profiles p
SET confirmed_at = u.confirmed_at
FROM auth.users u
WHERE p.id = u.id
  AND u.confirmed_at IS NOT NULL
  AND p.confirmed_at IS NULL;

-- 3. Trigger function: sync confirmed_at from auth.users to profiles
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when confirmed_at transitions from NULL to a value
  IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET confirmed_at = NEW.confirmed_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger on auth.users UPDATE
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_confirmed();
