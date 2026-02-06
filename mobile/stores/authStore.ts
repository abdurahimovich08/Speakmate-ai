/**
 * SpeakMate AI - Auth Store (Zustand)
 */
import { create } from 'zustand';
import { auth, db } from '@/services/supabase';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // Get current session
      const { session, error: sessionError } = await auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (session?.user) {
        // Get user profile
        const { data: profile } = await db.getUserProfile(session.user.id);

        set({
          session,
          user: profile || {
            id: session.user.id,
            email: session.user.email,
            phone: session.user.phone,
            native_language: 'uz',
            target_band: 7.0,
            created_at: new Date().toISOString(),
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          session: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }

      // Listen for auth changes
      auth.onAuthStateChange(async (event, newSession) => {
        if (event === 'SIGNED_IN' && newSession?.user) {
          const { data: profile } = await db.getUserProfile(newSession.user.id);
          set({
            session: newSession,
            user: profile || {
              id: newSession.user.id,
              email: newSession.user.email,
              phone: newSession.user.phone,
              native_language: 'uz',
              target_band: 7.0,
              created_at: new Date().toISOString(),
            },
            isAuthenticated: true,
          });
        } else if (event === 'SIGNED_OUT') {
          set({
            session: null,
            user: null,
            isAuthenticated: false,
          });
        }
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await auth.signInWithEmail(email, password);

      if (error) {
        throw error;
      }

      if (data.user) {
        const { data: profile } = await db.getUserProfile(data.user.id);
        set({
          session: data.session,
          user: profile,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  signUpWithEmail: async (email: string, password: string, fullName?: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await auth.signUpWithEmail(email, password, fullName);

      if (error) {
        throw error;
      }

      set({ isLoading: false });

      // User needs to verify email
      if (!data.session) {
        return;
      }

      if (data.user) {
        const { data: profile } = await db.getUserProfile(data.user.id);
        set({
          session: data.session,
          user: profile,
          isAuthenticated: true,
        });
      }
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  signInWithPhone: async (phone: string) => {
    try {
      set({ isLoading: true, error: null });

      const { error } = await auth.signInWithPhone(phone);

      if (error) {
        throw error;
      }

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  signInWithGoogle: async () => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await auth.signInWithGoogle();

      if (error) {
        throw error;
      }

      if (data?.session?.user) {
        const { data: profile } = await db.getUserProfile(data.session.user.id);
        set({
          session: data.session,
          user: profile || {
            id: data.session.user.id,
            email: data.session.user.email,
            full_name: data.session.user.user_metadata?.full_name,
            avatar_url: data.session.user.user_metadata?.avatar_url,
            native_language: 'uz',
            target_band: 7.0,
            created_at: new Date().toISOString(),
          },
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  verifyOtp: async (phone: string, code: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await auth.verifyPhoneOtp(phone, code);

      if (error) {
        throw error;
      }

      if (data.user) {
        const { data: profile } = await db.getUserProfile(data.user.id);
        set({
          session: data.session,
          user: profile || {
            id: data.user.id,
            phone: data.user.phone,
            native_language: 'uz',
            target_band: 7.0,
            created_at: new Date().toISOString(),
          },
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true, error: null });

      const { error } = await auth.signOut();

      if (error) {
        throw error;
      }

      set({
        session: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  updateProfile: async (updates: Partial<User>) => {
    try {
      const { user } = get();
      if (!user) return;

      set({ isLoading: true, error: null });

      const { data, error } = await db.updateUserProfile(user.id, updates);

      if (error) {
        throw error;
      }

      set({
        user: { ...user, ...data },
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
