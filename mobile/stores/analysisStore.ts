/**
 * SpeakMate AI - Analysis Store (Zustand)
 * Stimuler uslubidagi tahlil ma'lumotlarini saqlash
 */
import { create } from 'zustand';
import { api } from '@/services/api';

// Types
export interface GrammarError {
  id: string;
  type: string;
  original: string;
  corrected: string;
  explanation: string;
}

export interface VocabSuggestion {
  id: string;
  word: string;
  type: string;
  definition: string;
  original: string;
  corrected: string;
}

export interface PronunciationWord {
  word: string;
  ipa: string;
  accuracy: number;
  userAudioUrl?: string;
  nativeAudioUrl?: string;
}

export interface AnalysisData {
  sessionId: string;
  overallBand: number;
  
  grammar: {
    score: number;
    errors: GrammarError[];
    fillerWords: number;
    fillerWordsList?: string[];
  };
  
  fluency: {
    score: number;
    wordsPerMinute: number;
    syllablesPerMinute: number;
    awkwardPauses: number;
    improvedSpeech: string;
    originalSpeech?: string;
    speakingRate: 'slow' | 'normal' | 'fast';
  };
  
  vocabulary: {
    score: number;
    wordLevels: {
      A1: number;
      A2: number;
      B1: number;
      B2: number;
      C1: number;
      C2: number;
    };
    suggestions: VocabSuggestion[];
    uniqueWords: number;
    totalWords: number;
  };
  
  pronunciation: {
    score: number;
    wordsToImprove: PronunciationWord[];
    overallClarity: number;
    intonation: number;
  };
  
  // Additional metadata
  sessionDuration: number;
  recordingUrl?: string;
  createdAt: Date;
}

interface AnalysisState {
  // Current analysis data
  analysis: AnalysisData | null;
  
  // Loading states
  isLoading: boolean;
  isFastAnalysisReady: boolean;
  isDeepAnalysisReady: boolean;
  
  // Error
  error: string | null;
  
  // Actions
  loadAnalysis: (sessionId: string) => Promise<void>;
  setFastAnalysis: (data: Partial<AnalysisData>) => void;
  setDeepAnalysis: (data: AnalysisData) => void;
  clearAnalysis: () => void;
  setError: (error: string | null) => void;
}

// Default/empty analysis for initial state
const createEmptyAnalysis = (sessionId: string): AnalysisData => ({
  sessionId,
  overallBand: 0,
  grammar: {
    score: 0,
    errors: [],
    fillerWords: 0,
  },
  fluency: {
    score: 0,
    wordsPerMinute: 0,
    syllablesPerMinute: 0,
    awkwardPauses: 0,
    improvedSpeech: '',
    speakingRate: 'normal',
  },
  vocabulary: {
    score: 0,
    wordLevels: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
    suggestions: [],
    uniqueWords: 0,
    totalWords: 0,
  },
  pronunciation: {
    score: 0,
    wordsToImprove: [],
    overallClarity: 0,
    intonation: 0,
  },
  sessionDuration: 0,
  createdAt: new Date(),
});

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  analysis: null,
  isLoading: false,
  isFastAnalysisReady: false,
  isDeepAnalysisReady: false,
  error: null,

  loadAnalysis: async (sessionId: string) => {
    try {
      set({ isLoading: true, error: null });

      // Try to get analysis from backend
      const response = await api.getSessionAnalysis(sessionId);

      if (response) {
        const deep = response.deep_analysis || null;
        const fast = response.fast_analysis || null;
        const selectedType = response.analysis_type || (deep ? 'deep' : fast ? 'fast' : null);
        const selectedAnalysis =
          response.analysis ||
          deep?.results ||
          deep?.result ||
          fast?.results ||
          fast?.result ||
          {};

        const selectedScores =
          response.scores ||
          deep?.scores ||
          (deep?.results || deep?.result || {}).scores ||
          fast?.scores ||
          (fast?.results || fast?.result || {}).scores ||
          {};

        const getBand = (value: any): number => {
          if (typeof value === 'number') return value;
          if (value && typeof value.band === 'number') return value.band;
          return 0;
        };

        const errors = response.errors || selectedAnalysis.errors || [];

        // Map backend response to our AnalysisData format
        const analysis: AnalysisData = {
          sessionId,
          overallBand: getBand(selectedScores.overall_band || selectedScores.overall_score),

          grammar: {
            score: getBand(selectedScores.grammatical_range),
            errors: errors
              .filter((e: any) => e.category === 'grammar')
              .map((e: any, i: number) => ({
                id: e.id || `grammar-${i}`,
                type: e.error_code || 'GRAMMAR',
                original: e.original_text || '',
                corrected: e.corrected_text || '',
                explanation: e.explanation || '',
              })),
            fillerWords: selectedAnalysis.filler_count || 0,
          },

          fluency: {
            score: getBand(selectedScores.fluency_coherence),
            wordsPerMinute: selectedAnalysis.words_per_minute || 0,
            syllablesPerMinute: selectedAnalysis.syllables_per_minute || 0,
            awkwardPauses: selectedAnalysis.pause_count || 0,
            improvedSpeech: selectedAnalysis.improved_speech || '',
            speakingRate: selectedAnalysis.speaking_rate || 'normal',
          },

          vocabulary: {
            score: getBand(selectedScores.lexical_resource),
            wordLevels: selectedAnalysis.word_levels || { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
            suggestions: errors
              .filter((e: any) => e.category === 'vocabulary')
              .map((e: any, i: number) => ({
                id: e.id || `vocab-${i}`,
                word: e.suggested_word || '',
                type: e.word_type || 'word',
                definition: e.definition || '',
                original: e.original_text || '',
                corrected: e.corrected_text || '',
              })),
            uniqueWords: selectedAnalysis.unique_words || 0,
            totalWords: selectedAnalysis.total_words || 0,
          },

          pronunciation: {
            score: getBand(selectedScores.pronunciation),
            wordsToImprove: errors
              .filter((e: any) => e.category === 'pronunciation')
              .map((e: any) => ({
                word: e.original_text || '',
                ipa: e.ipa || '',
                accuracy: e.confidence || 0,
              })),
            overallClarity: selectedAnalysis.clarity_score || 0,
            intonation: selectedAnalysis.intonation_score || 0,
          },

          sessionDuration: response.session?.duration_seconds || response.session?.duration || 0,
          recordingUrl: response.session?.recording_url,
          createdAt: new Date(response.created_at || Date.now()),
        };

        set({
          analysis,
          isLoading: false,
          isFastAnalysisReady: !!fast || selectedType === 'fast' || selectedType === 'deep',
          isDeepAnalysisReady: selectedType === 'deep' || !!deep,
        });
      } else {
        // Create empty analysis if none exists yet
        set({
          analysis: createEmptyAnalysis(sessionId),
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  setFastAnalysis: (data: Partial<AnalysisData>) => {
    const { analysis } = get();
    if (analysis) {
      set({
        analysis: { ...analysis, ...data },
        isFastAnalysisReady: true,
      });
    } else if (data.sessionId) {
      set({
        analysis: { ...createEmptyAnalysis(data.sessionId), ...data },
        isFastAnalysisReady: true,
      });
    }
  },

  setDeepAnalysis: (data: AnalysisData) => {
    set({
      analysis: data,
      isDeepAnalysisReady: true,
    });
  },

  clearAnalysis: () => {
    set({
      analysis: null,
      isLoading: false,
      isFastAnalysisReady: false,
      isDeepAnalysisReady: false,
      error: null,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
