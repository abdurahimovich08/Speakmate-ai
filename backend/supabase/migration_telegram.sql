-- =============================================
-- SpeakMate AI — Telegram Integration Migration
-- =============================================
-- Run this migration against your Supabase database
-- to add Telegram-specific columns to the users table.

-- 1. Add Telegram columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'supabase';
-- auth_provider values: 'supabase' (mobile app), 'telegram' (Telegram Mini App)

-- 2. Index for fast lookups by telegram_id
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- 3. (Optional) Update existing users to mark their auth_provider
UPDATE users SET auth_provider = 'supabase' WHERE auth_provider IS NULL;
