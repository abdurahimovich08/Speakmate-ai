/**
 * SpeakMate AI - Super Coach Store
 */
import { create } from 'zustand';
import { api } from '@/services/api';
import type {
  DailyMission,
  MnemonicDrill,
  SkillGraph,
  ProgressProof,
  BehaviorInsight,
  CoachMemory,
} from '@/types';

interface CoachState {
  dailyMission: DailyMission | null;
  mnemonicDrills: MnemonicDrill[];
  skillGraph: SkillGraph | null;
  progressProof: ProgressProof | null;
  behaviorInsights: BehaviorInsight[];
  coachMemory: CoachMemory | null;
  shareCard: any | null;

  completedTaskIds: string[];

  isLoading: boolean;
  isCompletingMission: boolean;
  error: string | null;

  loadCoachDashboard: () => Promise<void>;
  refreshMnemonics: () => Promise<void>;
  toggleTaskCompletion: (taskId: string) => void;
  completeMission: (rating?: number) => Promise<void>;
  clearCoachMemory: () => Promise<void>;
}

export const useCoachStore = create<CoachState>((set, get) => ({
  dailyMission: null,
  mnemonicDrills: [],
  skillGraph: null,
  progressProof: null,
  behaviorInsights: [],
  coachMemory: null,
  shareCard: null,
  completedTaskIds: [],
  isLoading: false,
  isCompletingMission: false,
  error: null,

  loadCoachDashboard: async () => {
    try {
      set({ isLoading: true, error: null });

      const [
        dailyMission,
        skillGraph,
        progressPayload,
        behaviorPayload,
        mnemonicPayload,
        coachMemory,
        shareCardPayload,
      ] = await Promise.all([
        api.getDailyMission(),
        api.getSkillGraph(),
        api.getProgressProof(30),
        api.getBehaviorInsights(30),
        api.getMnemonicDrills(5),
        api.getCoachMemory(),
        api.getShareCard(30),
      ]);

      set({
        dailyMission,
        skillGraph,
        progressProof: progressPayload.proof,
        behaviorInsights: behaviorPayload.insights || [],
        mnemonicDrills: mnemonicPayload.drills || [],
        coachMemory,
        shareCard: shareCardPayload.card || null,
        completedTaskIds: [],
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to load coach dashboard',
        isLoading: false,
      });
    }
  },

  refreshMnemonics: async () => {
    try {
      const payload = await api.getMnemonicDrills(5);
      set({ mnemonicDrills: payload.drills || [] });
    } catch {
      // Keep dashboard usable even if mnemonic refresh fails.
    }
  },

  toggleTaskCompletion: (taskId: string) => {
    const completed = get().completedTaskIds;
    if (completed.includes(taskId)) {
      set({ completedTaskIds: completed.filter((id) => id !== taskId) });
    } else {
      set({ completedTaskIds: [...completed, taskId] });
    }
  },

  completeMission: async (rating?: number) => {
    const { dailyMission, completedTaskIds } = get();
    if (!dailyMission) return;

    try {
      set({ isCompletingMission: true, error: null });
      await api.completeDailyMission(
        dailyMission.mission_id,
        completedTaskIds.length,
        dailyMission.tasks.length,
        rating
      );

      await get().loadCoachDashboard();
      set({ isCompletingMission: false });
    } catch (error: any) {
      set({
        isCompletingMission: false,
        error: error.message || 'Failed to complete mission',
      });
    }
  },

  clearCoachMemory: async () => {
    try {
      await api.clearCoachMemory();
      await get().loadCoachDashboard();
    } catch {
      // Keep UI stable.
    }
  },
}));
