/**
 * SpeakMate AI - Supabase Client
 */
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { SUPABASE_CONFIG } from '@/constants/Config';

// Required for Google Sign-In
WebBrowser.maybeCompleteAuthSession();

// Custom storage adapter for React Native
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
    }
  },
};

// Create Supabase client
export const supabase = createClient(
  SUPABASE_CONFIG.URL,
  SUPABASE_CONFIG.ANON_KEY,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Auth helper functions
export const auth = {
  /**
   * Sign up with email and password
   */
  signUpWithEmail: async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  },

  /**
   * Sign in with email and password
   */
  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  /**
   * Sign in with phone (OTP)
   */
  signInWithPhone: async (phone: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });
    return { data, error };
  },

  /**
   * Verify phone OTP
   */
  verifyPhoneOtp: async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    return { data, error };
  },

  /**
   * Sign out
   */
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  /**
   * Get current session
   */
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  },

  /**
   * Get current user
   */
  getUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error };
  },

  /**
   * Reset password
   */
  resetPassword: async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    return { data, error };
  },

  /**
   * Sign in with Google
   */
  signInWithGoogle: async () => {
    try {
      // Create redirect URL
      const redirectUrl = AuthSession.makeRedirectUri({
        path: 'auth/callback',
      });

      // Start OAuth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');

      // Open browser for authentication
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      if (result.type === 'success') {
        // Extract the URL and get the session
        const url = result.url;
        
        // Parse the URL to get tokens
        const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
          // Set the session manually
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) throw sessionError;
          return { data: sessionData, error: null };
        }
      }

      return { data: null, error: new Error('Authentication was cancelled') };
    } catch (error) {
      console.error('Google Sign-In error:', error);
      return { data: null, error };
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (updates: { full_name?: string; avatar_url?: string }) => {
    const { data, error } = await supabase.auth.updateUser({
      data: updates,
    });
    return { data, error };
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helper functions
export const db = {
  /**
   * Get user profile
   */
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  /**
   * Update user profile
   */
  updateUserProfile: async (userId: string, updates: Record<string, any>) => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  /**
   * Get user sessions
   */
  getUserSessions: async (userId: string, limit = 20) => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  /**
   * Get session by ID
   */
  getSession: async (sessionId: string) => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    return { data, error };
  },

  /**
   * Get session errors
   */
  getSessionErrors: async (sessionId: string) => {
    const { data, error } = await supabase
      .from('detected_errors')
      .select('*')
      .eq('session_id', sessionId);
    return { data, error };
  },

  /**
   * Get user error profile
   */
  getUserErrorProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('error_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('occurrence_count', { ascending: false });
    return { data, error };
  },

  /**
   * Get IELTS topics
   */
  getIELTSTopics: async (part?: number) => {
    let query = supabase.from('ielts_topics').select('*');
    if (part) {
      query = query.eq('part', part);
    }
    const { data, error } = await query;
    return { data, error };
  },
};
