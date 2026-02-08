-- =============================================
-- SpeakMate AI - Super Coach Migration
-- =============================================
-- Adds persistent tables for:
-- - Daily missions
-- - Mnemonic feedback
-- - Behavior events
-- - Telegram notification events

-- -----------------------------------------------------------------
-- Daily mission snapshots
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_daily_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mission_date DATE NOT NULL,
    mission_payload JSONB NOT NULL,
    difficulty TEXT,
    best_hour SMALLINT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    tasks_completed INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    success_rate DECIMAL(4,3),
    rating SMALLINT,
    completion_notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, mission_date)
);

CREATE INDEX IF NOT EXISTS idx_coach_missions_user_date
    ON public.coach_daily_missions(user_id, mission_date DESC);

-- -----------------------------------------------------------------
-- Mnemonic usefulness feedback
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_mnemonic_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    error_code TEXT NOT NULL,
    style TEXT NOT NULL,
    helpfulness SMALLINT NOT NULL CHECK (helpfulness BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_mnemonic_feedback_user
    ON public.coach_mnemonic_feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_mnemonic_feedback_error_style
    ON public.coach_mnemonic_feedback(error_code, style);

-- -----------------------------------------------------------------
-- Behavior analytics events
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_behavior_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_behavior_events_user_type
    ON public.coach_behavior_events(user_id, event_type, created_at DESC);

-- -----------------------------------------------------------------
-- Notification dedupe / audit
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_notification_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    telegram_id BIGINT,
    event_type TEXT NOT NULL,
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, event_type, event_date)
);

CREATE INDEX IF NOT EXISTS idx_coach_notification_events_user
    ON public.coach_notification_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_notification_events_type_date
    ON public.coach_notification_events(event_type, event_date DESC);

-- -----------------------------------------------------------------
-- Triggers for updated_at
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS update_coach_daily_missions_updated_at ON public.coach_daily_missions;
CREATE TRIGGER update_coach_daily_missions_updated_at
    BEFORE UPDATE ON public.coach_daily_missions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------
ALTER TABLE public.coach_daily_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_mnemonic_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own coach missions" ON public.coach_daily_missions;
CREATE POLICY "Users can view own coach missions" ON public.coach_daily_missions
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own coach missions" ON public.coach_daily_missions;
CREATE POLICY "Users can update own coach missions" ON public.coach_daily_missions
    FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own coach missions" ON public.coach_daily_missions;
CREATE POLICY "Users can insert own coach missions" ON public.coach_daily_missions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own mnemonic feedback" ON public.coach_mnemonic_feedback;
CREATE POLICY "Users can view own mnemonic feedback" ON public.coach_mnemonic_feedback
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own mnemonic feedback" ON public.coach_mnemonic_feedback;
CREATE POLICY "Users can insert own mnemonic feedback" ON public.coach_mnemonic_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own behavior events" ON public.coach_behavior_events;
CREATE POLICY "Users can view own behavior events" ON public.coach_behavior_events
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own behavior events" ON public.coach_behavior_events;
CREATE POLICY "Users can insert own behavior events" ON public.coach_behavior_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own notification events" ON public.coach_notification_events;
CREATE POLICY "Users can view own notification events" ON public.coach_notification_events
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own notification events" ON public.coach_notification_events;
CREATE POLICY "Users can insert own notification events" ON public.coach_notification_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------
GRANT ALL ON TABLE public.coach_daily_missions TO authenticated;
GRANT ALL ON TABLE public.coach_mnemonic_feedback TO authenticated;
GRANT ALL ON TABLE public.coach_behavior_events TO authenticated;
GRANT ALL ON TABLE public.coach_notification_events TO authenticated;
