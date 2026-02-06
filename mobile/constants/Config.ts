/**
 * SpeakMate AI - App Configuration
 */

// API Configuration
export const API_CONFIG = {
  // Change this to your backend URL
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
  WS_URL: process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8000',
  API_VERSION: 'v1',
  TIMEOUT: 30000,
};

// Supabase Configuration
export const SUPABASE_CONFIG = {
  URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
};

// Audio Configuration
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  BIT_DEPTH: 16,
  ENCODING: 'pcm_16bit',
  // Recording settings
  RECORDING_OPTIONS: {
    android: {
      extension: '.wav',
      outputFormat: 2, // MPEG_4
      audioEncoder: 3, // AAC
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.wav',
      outputFormat: 'lpcm',
      audioQuality: 127,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  },
};

// Session Configuration
export const SESSION_CONFIG = {
  // Minimum duration to save session (seconds)
  MIN_DURATION: 30,
  // Maximum duration for free mode (seconds)
  MAX_DURATION_FREE: 600, // 10 minutes
  // IELTS timing
  IELTS_PART1_DURATION: 240, // 4-5 minutes
  IELTS_PART2_PREP_TIME: 60, // 1 minute
  IELTS_PART2_SPEAK_TIME: 120, // 2 minutes
  IELTS_PART3_DURATION: 300, // 4-5 minutes
};

// UI Configuration
export const UI_CONFIG = {
  // Animation durations (ms)
  ANIMATION_FAST: 150,
  ANIMATION_NORMAL: 300,
  ANIMATION_SLOW: 500,
  // Debounce times (ms)
  DEBOUNCE_SEARCH: 300,
  DEBOUNCE_INPUT: 150,
  // Pagination
  PAGE_SIZE: 20,
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  AUTH_ERROR: 'Authentication failed. Please sign in again.',
  SESSION_ERROR: 'Failed to start session. Please try again.',
  RECORDING_ERROR: 'Microphone access denied. Please enable in settings.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
};

// Feature flags
export const FEATURES = {
  ENABLE_VIDEO: false,
  ENABLE_IELTS_MODE: true,
  ENABLE_TRAINING_MODE: true,
  ENABLE_PDF_EXPORT: true,
  ENABLE_ANALYTICS: false,
};
