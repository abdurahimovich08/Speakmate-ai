-- SpeakMate AI - Production Database Schema
-- Full schema with all tables, RLS, indexes, and functions

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Session modes
CREATE TYPE session_mode AS ENUM (
    'free_speaking',
    'ielts_test',
    'ielts_part1',
    'ielts_part2',
    'ielts_part3',
    'training'
);

-- Error categories
CREATE TYPE error_category AS ENUM (
    'pronunciation',
    'grammar',
    'vocabulary',
    'fluency'
);

-- Error severity levels
CREATE TYPE error_severity AS ENUM (
    'minor',      -- Doesn't affect understanding
    'moderate',   -- May cause confusion
    'major',      -- Significantly impacts communication
    'critical'    -- Prevents understanding
);

-- Analysis status
CREATE TYPE analysis_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
);

-- User plan types
CREATE TYPE user_plan AS ENUM (
    'free',
    'basic',
    'premium',
    'enterprise'
);

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    full_name TEXT,
    native_language TEXT DEFAULT 'uz',
    target_band DECIMAL(2,1) DEFAULT 7.0 CHECK (target_band >= 0 AND target_band <= 9),
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    locale TEXT DEFAULT 'en',
    
    -- Settings
    preferences JSONB DEFAULT '{}'::jsonb,
    notification_settings JSONB DEFAULT '{"email": true, "push": true}'::jsonb,
    
    -- Stats (denormalized for quick access)
    total_sessions INTEGER DEFAULT 0,
    total_practice_minutes INTEGER DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_practice_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Plans / Subscriptions
CREATE TABLE IF NOT EXISTS public.user_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan user_plan NOT NULL DEFAULT 'free',
    
    -- Limits
    monthly_minutes_limit INTEGER DEFAULT 60,
    monthly_minutes_used INTEGER DEFAULT 0,
    monthly_sessions_limit INTEGER DEFAULT 10,
    monthly_sessions_used INTEGER DEFAULT 0,
    
    -- Billing
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mode session_mode NOT NULL,
    topic TEXT,
    
    -- Timing
    duration_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    
    -- State tracking
    state TEXT DEFAULT 'active',
    turn_count INTEGER DEFAULT 0,
    
    -- IELTS specific
    ielts_part INTEGER CHECK (ielts_part IN (1, 2, 3)),
    ielts_questions_used JSONB DEFAULT '[]'::jsonb,
    
    -- Scores (denormalized for quick access)
    overall_scores JSONB,
    
    -- Consent
    consent_audio_storage BOOLEAN DEFAULT false,
    consent_transcript_storage BOOLEAN DEFAULT true,
    
    -- Device info
    device_info JSONB,
    client_version TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session Assets (audio, transcripts, reports)
CREATE TABLE IF NOT EXISTS public.session_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- URLs (Supabase Storage)
    audio_url TEXT,
    transcript_url TEXT,
    pdf_report_url TEXT,
    tts_cache_url TEXT,
    
    -- Retention
    retention_days INTEGER DEFAULT 30,
    expires_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Encryption
    encryption_key_id TEXT,
    encrypted BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id)
);

-- Conversation turns
CREATE TABLE IF NOT EXISTS public.conversation_turns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    
    -- Content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- For user turns
    transcription TEXT,
    transcription_confidence DECIMAL(4,3),
    word_timestamps JSONB, -- [{word, start_ms, end_ms, confidence}]
    
    -- Audio
    audio_duration_ms INTEGER,
    
    -- Metadata
    sequence_order INTEGER NOT NULL,
    turn_id TEXT,
    
    -- For AI turns
    prompt_version TEXT,
    model_used TEXT,
    tokens_used INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analysis Runs (versioned analysis tracking)
CREATE TABLE IF NOT EXISTS public.analysis_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Run type
    run_type TEXT NOT NULL CHECK (run_type IN ('fast', 'deep', 'ielts_scoring', 'training_gen')),
    status analysis_status NOT NULL DEFAULT 'pending',
    
    -- Versioning (critical for auditability)
    analyzer_version TEXT NOT NULL,
    scorer_version TEXT,
    prompt_version TEXT NOT NULL,
    
    -- Results
    results JSONB,
    scores JSONB,
    error_count INTEGER DEFAULT 0,
    
    -- Metrics
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_ms INTEGER,
    tokens_used INTEGER DEFAULT 0,
    cost_estimate DECIMAL(10,6) DEFAULT 0,
    
    -- Error handling
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error Instances (detailed error tracking with evidence)
CREATE TABLE IF NOT EXISTS public.error_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    analysis_run_id UUID REFERENCES public.analysis_runs(id) ON DELETE SET NULL,
    
    -- Classification
    category error_category NOT NULL,
    subcategory TEXT NOT NULL,
    error_code TEXT NOT NULL, -- e.g., "GRAM_ARTICLE_MISSING"
    severity error_severity NOT NULL DEFAULT 'moderate',
    
    -- Content
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    explanation TEXT NOT NULL,
    
    -- Evidence (critical for auditability)
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- {
    --   "snippet": "I go to school yesterday",
    --   "word_indices": [2, 3, 4],
    --   "timestamps": {"start_ms": 1234, "end_ms": 2345},
    --   "confidence": 0.95,
    --   "rule_matched": "TENSE_PAST_SIMPLE",
    --   "llm_reasoning": "..."
    -- }
    
    -- Scoring
    confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    impact_score DECIMAL(4,3) DEFAULT 0.5, -- Impact on IELTS score
    
    -- Training link
    fix_drill_id UUID,
    
    -- Timestamps
    timestamp_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error Profiles (aggregated user errors)
CREATE TABLE IF NOT EXISTS public.error_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    category error_category NOT NULL,
    subcategory TEXT NOT NULL,
    error_code TEXT NOT NULL,
    
    -- Stats
    occurrence_count INTEGER DEFAULT 1,
    last_occurrence_count INTEGER DEFAULT 1, -- Count in last session
    
    -- Progress
    improvement_rate DECIMAL(4,3) DEFAULT 0.0,
    mastery_score DECIMAL(4,3) DEFAULT 0.0, -- 0 = always fails, 1 = mastered
    
    -- Examples
    example_instances JSONB DEFAULT '[]'::jsonb, -- Last 5 examples
    
    -- Timing
    first_occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, category, subcategory, error_code)
);

-- Training Tasks (spaced repetition)
CREATE TABLE IF NOT EXISTS public.training_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    error_profile_id UUID REFERENCES public.error_profiles(id) ON DELETE SET NULL,
    
    -- Task type
    task_type TEXT NOT NULL, -- 'drill', 'quiz', 'pronunciation', 'sentence_correction'
    error_code TEXT NOT NULL,
    
    -- Content
    content JSONB NOT NULL,
    -- {
    --   "prompt": "Choose the correct article:",
    --   "options": ["a", "an", "the", "no article"],
    --   "correct_answer": "the",
    --   "explanation": "...",
    --   "example_sentence": "..."
    -- }
    
    -- Spaced repetition
    difficulty DECIMAL(4,3) DEFAULT 0.3,
    interval_days INTEGER DEFAULT 1,
    ease_factor DECIMAL(4,3) DEFAULT 2.5,
    repetition_count INTEGER DEFAULT 0,
    
    -- Scheduling
    next_due_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_practiced_at TIMESTAMP WITH TIME ZONE,
    
    -- Results
    last_result TEXT, -- 'correct', 'incorrect', 'skipped'
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'mastered', 'suspended')),
    mastered_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IELTS Questions Bank
CREATE TABLE IF NOT EXISTS public.ielts_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    part INTEGER NOT NULL CHECK (part IN (1, 2, 3)),
    category TEXT NOT NULL,
    topic TEXT NOT NULL,
    
    -- Question content
    question_text TEXT NOT NULL,
    follow_up_questions JSONB DEFAULT '[]'::jsonb,
    
    -- For Part 2 cue cards
    cue_card_points JSONB, -- ["point1", "point2", "point3", "point4"]
    preparation_tips TEXT,
    
    -- Metadata
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Usage stats
    times_used INTEGER DEFAULT 0,
    avg_band_score DECIMAL(3,2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompt Registry (for version tracking)
CREATE TABLE IF NOT EXISTS public.prompt_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identity
    prompt_key TEXT NOT NULL, -- e.g., "conversation.free_v1"
    version TEXT NOT NULL,
    
    -- Content
    prompt_template TEXT NOT NULL,
    system_instructions TEXT,
    
    -- Configuration
    model TEXT DEFAULT 'gemini-pro',
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 500,
    
    -- Schema for output validation
    output_schema JSONB,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    deprecated_at TIMESTAMP WITH TIME ZONE,
    
    -- Metrics
    usage_count INTEGER DEFAULT 0,
    avg_latency_ms INTEGER,
    error_rate DECIMAL(5,4) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(prompt_key, version)
);

-- Audit Log (for compliance)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    
    -- Action
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    
    -- Details
    details JSONB DEFAULT '{}'::jsonb,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON public.sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_mode ON public.sessions(mode);

-- Conversation turns
CREATE INDEX IF NOT EXISTS idx_turns_session_id ON public.conversation_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_turns_session_seq ON public.conversation_turns(session_id, sequence_order);

-- Analysis runs
CREATE INDEX IF NOT EXISTS idx_analysis_session ON public.analysis_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_status ON public.analysis_runs(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_analysis_user ON public.analysis_runs(user_id, created_at DESC);

-- Error instances
CREATE INDEX IF NOT EXISTS idx_errors_session ON public.error_instances(session_id);
CREATE INDEX IF NOT EXISTS idx_errors_category ON public.error_instances(category);
CREATE INDEX IF NOT EXISTS idx_errors_code ON public.error_instances(error_code);

-- Error profiles
CREATE INDEX IF NOT EXISTS idx_profile_user ON public.error_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_user_cat ON public.error_profiles(user_id, category);
CREATE INDEX IF NOT EXISTS idx_profile_occurrence ON public.error_profiles(user_id, occurrence_count DESC);

-- Training tasks
CREATE INDEX IF NOT EXISTS idx_training_user ON public.training_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_training_due ON public.training_tasks(user_id, next_due_at) 
    WHERE status = 'active';

-- IELTS questions
CREATE INDEX IF NOT EXISTS idx_ielts_part ON public.ielts_questions(part);
CREATE INDEX IF NOT EXISTS idx_ielts_topic ON public.ielts_questions(topic);
CREATE INDEX IF NOT EXISTS idx_ielts_active ON public.ielts_questions(is_active, part);

-- Audit log
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log(action, created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ielts_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- User plans policies
CREATE POLICY "Users can view own plan" ON public.user_plans
    FOR SELECT USING (auth.uid() = user_id);

-- Sessions policies
CREATE POLICY "Users can view own sessions" ON public.sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sessions" ON public.sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Session assets policies
CREATE POLICY "Users can view own assets" ON public.session_assets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assets" ON public.session_assets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Conversation turns policies (via session ownership)
CREATE POLICY "Users can view own turns" ON public.conversation_turns
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.sessions WHERE sessions.id = conversation_turns.session_id AND sessions.user_id = auth.uid())
    );
CREATE POLICY "Users can insert own turns" ON public.conversation_turns
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.sessions WHERE sessions.id = conversation_turns.session_id AND sessions.user_id = auth.uid())
    );

-- Analysis runs policies
CREATE POLICY "Users can view own analysis" ON public.analysis_runs
    FOR SELECT USING (auth.uid() = user_id);

-- Error instances policies (via session)
CREATE POLICY "Users can view own errors" ON public.error_instances
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.sessions WHERE sessions.id = error_instances.session_id AND sessions.user_id = auth.uid())
    );

-- Error profiles policies
CREATE POLICY "Users can view own profiles" ON public.error_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Training tasks policies
CREATE POLICY "Users can view own tasks" ON public.training_tasks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.training_tasks
    FOR UPDATE USING (auth.uid() = user_id);

-- IELTS questions - readable by all authenticated users
CREATE POLICY "Authenticated users can view questions" ON public.ielts_questions
    FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

-- Prompt registry - readable by service role only (server-side)
CREATE POLICY "Service can read prompts" ON public.prompt_registry
    FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Audit log - viewable by user for own entries
CREATE POLICY "Users can view own audit" ON public.audit_log
    FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, phone, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.phone,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    
    -- Create default plan
    INSERT INTO public.user_plans (user_id, plan, monthly_minutes_limit, monthly_sessions_limit)
    VALUES (NEW.id, 'free', 60, 10);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update user stats after session
CREATE OR REPLACE FUNCTION public.update_user_stats_after_session()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        UPDATE public.users
        SET 
            total_sessions = total_sessions + 1,
            total_practice_minutes = total_practice_minutes + COALESCE(NEW.duration_seconds, 0) / 60,
            last_practice_at = NOW()
        WHERE id = NEW.user_id;
        
        -- Update plan usage
        UPDATE public.user_plans
        SET 
            monthly_sessions_used = monthly_sessions_used + 1,
            monthly_minutes_used = monthly_minutes_used + COALESCE(NEW.duration_seconds, 0) / 60
        WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update error profile when new error detected
CREATE OR REPLACE FUNCTION public.update_error_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get user_id from session
    SELECT user_id INTO v_user_id FROM public.sessions WHERE id = NEW.session_id;
    
    INSERT INTO public.error_profiles (user_id, category, subcategory, error_code, occurrence_count, last_occurred_at)
    VALUES (v_user_id, NEW.category, NEW.subcategory, NEW.error_code, 1, NOW())
    ON CONFLICT (user_id, category, subcategory, error_code)
    DO UPDATE SET
        occurrence_count = error_profiles.occurrence_count + 1,
        last_occurred_at = NOW(),
        example_instances = (
            SELECT jsonb_agg(e)
            FROM (
                SELECT e FROM jsonb_array_elements(error_profiles.example_instances) e
                UNION ALL
                SELECT jsonb_build_object(
                    'original', NEW.original_text,
                    'corrected', NEW.corrected_text,
                    'session_id', NEW.session_id
                )
                LIMIT 5
            ) sub
        );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate spaced repetition interval
CREATE OR REPLACE FUNCTION public.calculate_next_review(
    p_ease_factor DECIMAL,
    p_interval INTEGER,
    p_success BOOLEAN
)
RETURNS TABLE(new_interval INTEGER, new_ease DECIMAL) AS $$
BEGIN
    IF p_success THEN
        -- SM-2 algorithm
        new_ease := GREATEST(1.3, p_ease_factor + 0.1);
        IF p_interval = 0 THEN
            new_interval := 1;
        ELSIF p_interval = 1 THEN
            new_interval := 6;
        ELSE
            new_interval := ROUND(p_interval * new_ease);
        END IF;
    ELSE
        new_ease := GREATEST(1.3, p_ease_factor - 0.2);
        new_interval := 1;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- User triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Session triggers
DROP TRIGGER IF EXISTS update_user_stats_on_session_end ON public.sessions;
CREATE TRIGGER update_user_stats_on_session_end
    AFTER UPDATE ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_after_session();

-- Error instance triggers
DROP TRIGGER IF EXISTS update_profile_on_error ON public.error_instances;
CREATE TRIGGER update_profile_on_error
    AFTER INSERT ON public.error_instances
    FOR EACH ROW EXECUTE FUNCTION public.update_error_profile();

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert sample IELTS questions
INSERT INTO public.ielts_questions (part, category, topic, question_text, follow_up_questions, difficulty) VALUES
-- Part 1
(1, 'personal', 'Home', 'Do you live in a house or an apartment?', 
    '["What do you like about your home?", "Would you like to change anything about it?", "How long have you lived there?"]', 'easy'),
(1, 'personal', 'Work', 'Do you work or are you a student?',
    '["What do you enjoy about your work/studies?", "Would you like to change your job/field in the future?"]', 'easy'),
(1, 'hobbies', 'Free Time', 'What do you usually do in your free time?',
    '["Have you always enjoyed this?", "Would you like to try something new?"]', 'easy'),
(1, 'technology', 'Internet', 'How often do you use the internet?',
    '["What do you mainly use it for?", "Do you think the internet has changed how people communicate?"]', 'medium'),

-- Part 2
(2, 'experience', 'Journey', 'Describe a memorable journey you have taken.',
    '[]', 'medium'),
(2, 'person', 'Influence', 'Describe a person who has influenced you.',
    '[]', 'medium'),
(2, 'object', 'Technology', 'Describe a piece of technology you find useful.',
    '[]', 'medium'),

-- Part 3
(3, 'society', 'Technology', 'How has technology changed the way people communicate?',
    '["Do you think face-to-face communication is becoming less important?", "What might be the long-term effects of this?"]', 'hard'),
(3, 'environment', 'Climate', 'What are the main environmental problems in your country?',
    '["Whose responsibility is it to solve these problems?", "What can individuals do?"]', 'hard')
ON CONFLICT DO NOTHING;

-- Insert default prompts
INSERT INTO public.prompt_registry (prompt_key, version, prompt_template, model, temperature) VALUES
('conversation.free', 'v1', 'You are a friendly English conversation partner...', 'gemini-pro', 0.7),
('analysis.errors', 'v1', 'Analyze this English speech for errors...', 'gemini-pro', 0.3),
('scoring.ielts', 'v1', 'Score this speaking response using IELTS criteria...', 'gemini-pro', 0.2)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PERMISSIONS
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
