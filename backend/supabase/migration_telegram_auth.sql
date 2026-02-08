-- =============================================
-- SpeakMate AI - Telegram Auth Columns Migration
-- =============================================
-- Ensures public.users has fields required by Telegram auth flow.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'supabase';

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);

UPDATE public.users
SET auth_provider = COALESCE(auth_provider, 'supabase')
WHERE auth_provider IS NULL;

