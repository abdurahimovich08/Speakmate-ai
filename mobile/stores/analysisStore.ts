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
        // Map backend response to our AnalysisData format
        const analysis: AnalysisData = {
          sessionId,
          overallBand: response.scores?.overall_band || 0,
          
          grammar: {
            score: response.scores?.grammatical_range || 0,
            errors: (response.errors || [])
              .filter((e: any) => e.category === 'grammar')
              .map((e: any, i: number) => ({
                id: e.id || `grammar-${i}`,
                type: e.error_code || 'GRAMMAR',
                original: e.original_text || '',
                corrected: e.corrected_text || '',
                explanation: e.explanation || '',
              })),
            fillerWords: response.analysis?.filler_count || 0,
          },
          
          fluency: {
            score: response.scores?.fluency_coherence || 0,
            wordsPerMinute: response.analysis?.words_per_minute || 0,
            syllablesPerMinute: response.analysis?.syllables_per_minute || 0,
            awkwardPauses: response.analysis?.pause_count || 0,
            improvedSpeech: response.analysis?.improved_speech || '',
            speakingRate: response.analysis?.speaking_rate || 'normal',
          },
          
          vocabulary: {
            score: response.scores?.lexical_resource || 0,
            wordLevels: response.analysis?.word_levels || { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
            suggestions: (response.errors || [])
              .filter((e: any) => e.category === 'vocabulary')
              .map((e: any, i: number) => ({
                id: e.id || `vocab-${i}`,
                word: e.suggested_word || '',
                type: e.word_type || 'word',
                definition: e.definition || '',
                original: e.original_text || '',
                corrected: e.corrected_text || '',
              })),
            uniqueWords: response.analysis?.unique_words || 0,
            totalWords: response.analysis?.total_words || 0,
          },
          
          pronunciation: {
            score: response.scores?.pronunciation || 0,
            wordsToImprove: (response.errors || [])
              .filter((e: any) => e.category === 'pronunciation')
              .map((e: any) => ({
                word: e.original_text || '',
                ipa: e.ipa || '',
                accuracy: e.confidence || 0,
              })),
            overallClarity: response.analysis?.clarity_score || 0,
            intonation: response.analysis?.intonation_score || 0,
          },
          
          sessionDuration: response.session?.duration || 0,
          recordingUrl: response.session?.recording_url,
          createdAt: new Date(response.created_at || Date.now()),
        };

        set({
          analysis,
          isLoading: false,
          isFastAnalysisReady: true,
          isDeepAnalysisReady: response.analysis_type === 'deep',
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
