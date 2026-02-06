-- SpeakMate AI - Supabase Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    full_name TEXT,
    native_language TEXT DEFAULT 'uz',
    target_band DECIMAL(2,1) DEFAULT 7.0,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('free_speaking', 'ielts_test', 'training')),
    topic TEXT,
    duration_seconds INTEGER DEFAULT 0,
    overall_scores JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Conversation turns table
CREATE TABLE IF NOT EXISTS public.conversation_turns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    transcription TEXT,
    duration_ms INTEGER,
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detected errors table
CREATE TABLE IF NOT EXISTS public.detected_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('pronunciation', 'grammar', 'vocabulary', 'fluency')),
    subcategory TEXT,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    explanation TEXT,
    confidence DECIMAL(3,2) DEFAULT 0.0,
    timestamp_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error profiles table (aggregated user errors)
CREATE TABLE IF NOT EXISTS public.error_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('pronunciation', 'grammar', 'vocabulary', 'fluency')),
    subcategory TEXT NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    improvement_rate DECIMAL(4,2) DEFAULT 0.0,
    last_occurred TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    examples JSONB DEFAULT '[]'::jsonb,
    UNIQUE(user_id, category, subcategory)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_turns_session_id ON public.conversation_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_turns_sequence ON public.conversation_turns(session_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_detected_errors_session_id ON public.detected_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_detected_errors_category ON public.detected_errors(category);
CREATE INDEX IF NOT EXISTS idx_error_profiles_user_id ON public.error_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_error_profiles_category ON public.error_profiles(user_id, category);

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detected_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_profiles ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Sessions policies
CREATE POLICY "Users can view own sessions" ON public.sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON public.sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Conversation turns policies
CREATE POLICY "Users can view own conversation turns" ON public.conversation_turns
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE sessions.id = conversation_turns.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own conversation turns" ON public.conversation_turns
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE sessions.id = conversation_turns.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- Detected errors policies
CREATE POLICY "Users can view own errors" ON public.detected_errors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE sessions.id = detected_errors.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own errors" ON public.detected_errors
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE sessions.id = detected_errors.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- Error profiles policies
CREATE POLICY "Users can view own error profiles" ON public.error_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own error profiles" ON public.error_profiles
    FOR ALL USING (auth.uid() = user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, phone, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.phone,
        NEW.raw_user_meta_data->>'full_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on users table
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Sample IELTS topics for reference
CREATE TABLE IF NOT EXISTS public.ielts_topics (
    id SERIAL PRIMARY KEY,
    part INTEGER NOT NULL CHECK (part IN (1, 2, 3)),
    category TEXT NOT NULL,
    topic TEXT NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard'))
);

-- Insert sample IELTS topics
INSERT INTO public.ielts_topics (part, category, topic, questions, difficulty) VALUES
-- Part 1 topics
(1, 'personal', 'Home and Accommodation', '["Do you live in a house or an apartment?", "What is your favorite room in your home?", "Would you like to move to a different home in the future?", "What do you like about your neighborhood?"]', 'easy'),
(1, 'personal', 'Work and Studies', '["Do you work or are you a student?", "What do you like about your job/studies?", "What would you like to change about your work/studies?", "Do you prefer working alone or in a team?"]', 'easy'),
(1, 'hobbies', 'Free Time', '["What do you usually do in your free time?", "Do you prefer indoor or outdoor activities?", "Have your hobbies changed since you were a child?", "Would you like to learn a new hobby?"]', 'easy'),

-- Part 2 topics
(2, 'experience', 'A memorable journey', '["Describe a memorable journey you have taken. You should say: where you went, who you went with, what you did there, and explain why it was memorable."]', 'medium'),
(2, 'person', 'Someone who has influenced you', '["Describe a person who has had a significant influence on your life. You should say: who this person is, how you know them, what they have done, and explain how they have influenced you."]', 'medium'),
(2, 'object', 'A useful piece of technology', '["Describe a piece of technology that you find useful. You should say: what it is, how often you use it, what you use it for, and explain why you find it useful."]', 'medium'),

-- Part 3 topics
(3, 'society', 'Technology and Society', '["How has technology changed the way people communicate?", "Do you think technology has more advantages or disadvantages?", "What might be the future of technology in education?", "Should governments regulate technology companies?"]', 'hard'),
(3, 'environment', 'Environmental Issues', '["What are the biggest environmental problems in your country?", "Whose responsibility is it to protect the environment?", "How can individuals contribute to environmental protection?", "Do you think environmental problems will get better or worse?"]', 'hard'),
(3, 'education', 'Education Systems', '["How has education changed in recent years?", "What are the advantages of online learning?", "Should university education be free?", "What skills should schools focus on teaching?"]', 'hard')
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
