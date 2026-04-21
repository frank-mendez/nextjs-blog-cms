-- Migration: add_newsletter_tables
-- Created: 2026-04-21

-- ============================================
-- TABLES
-- ============================================

create table if not exists public.newsletter_subscriptions (
  id                uuid        default gen_random_uuid() primary key,
  email             text        not null unique,
  subscribed_at     timestamptz not null default now(),
  unsubscribed_at   timestamptz,
  unsubscribe_token text        not null unique
);

create table if not exists public.newsletter_sends (
  id                   uuid        default gen_random_uuid() primary key,
  post_id              uuid        not null unique references public.posts(id) on delete cascade,
  scheduled_at         timestamptz not null,
  status               text        not null default 'pending'
                                   check (status in ('pending', 'sending', 'sent', 'failed')),
  sending_started_at   timestamptz,
  sent_at              timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists newsletter_sends_status_scheduled_idx
  on public.newsletter_sends (status, scheduled_at)
  where status = 'pending';

-- ============================================
-- RLS
-- ============================================

alter table public.newsletter_subscriptions enable row level security;
alter table public.newsletter_sends         enable row level security;

-- Service role bypasses RLS — no public policies needed.
-- All access goes through the service role client in API routes.
