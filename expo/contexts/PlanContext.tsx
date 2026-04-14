import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutInterval } from '@/types/workout';
import { STORAGE_KEYS } from '@/constants/workout-options';
import { calculateTSS } from '@/utils/zwo';
import { GameRideProfile } from '@/utils/adaptive-game';

export type PlanPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';

export interface PlanWorkout {
  id: string;
  name: string;
  summary: string;
  intervals: WorkoutInterval[];
  tss: number;
  tssCapped?: boolean;
  crazyProfileLabel?: string;
  advancedModeLabel?: string;
  gameRideInfo?: {
    profile: GameRideProfile;
    readinessScore: number;
    aggressivePhases: number;
    totalPhases: number;
    weeklyBoss: boolean;
  };
  week: number;
  sessionInWeek: number;
  phase: PlanPhase;
  dayLabel?: string;
}

export const [PlanProvider, usePlanContext] = createContextHook(() => {
  const [plan, setPlanLocal] = useState<PlanWorkout[]>([]);
  const [selectedPlanWorkoutId, setSelectedIdLocal] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedPlan, storedId] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.PLAN),
          AsyncStorage.getItem(STORAGE_KEYS.SELECTED_PLAN_WORKOUT),
        ]);
        if (storedPlan) {
          const parsed = JSON.parse(storedPlan);
          if (Array.isArray(parsed)) setPlanLocal(parsed);
        }
        if (storedId) setSelectedIdLocal(storedId);
      } catch (e) {
        console.error('[PlanContext] Load error:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  const setPlan = useCallback(async (newPlan: PlanWorkout[]) => {
    setPlanLocal(newPlan);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PLAN, JSON.stringify(newPlan));
    } catch (e) {
      console.error('[PlanContext] Save plan error:', e);
    }
  }, []);

  const setSelectedPlanWorkoutId = useCallback(async (id: string) => {
    setSelectedIdLocal(id);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_PLAN_WORKOUT, id);
    } catch (e) {
      console.error('[PlanContext] Save selected id error:', e);
    }
  }, []);

  const updateWorkoutIntervals = useCallback(
    async (workoutId: string, intervals: WorkoutInterval[], ftp: number) => {
      console.log('[PlanContext] Updating workout intervals for:', workoutId);
      setPlanLocal((prev) => {
        const updated = prev.map((w) =>
          w.id === workoutId
            ? { ...w, intervals, tss: calculateTSS(intervals, ftp) }
            : w
        );
        AsyncStorage.setItem(STORAGE_KEYS.PLAN, JSON.stringify(updated)).catch((e) =>
          console.error('[PlanContext] Persist after edit error:', e)
        );
        return updated;
      });
    },
    []
  );

  const updateWorkoutDetails = useCallback(
    async (workoutId: string, updates: Partial<PlanWorkout>) => {
      setPlanLocal((prev) => {
        const updated = prev.map((w) =>
          w.id === workoutId ? { ...w, ...updates } : w
        );
        AsyncStorage.setItem(STORAGE_KEYS.PLAN, JSON.stringify(updated)).catch((e) =>
          console.error('[PlanContext] Persist after detail edit error:', e)
        );
        return updated;
      });
    },
    []
  );

  const selectedWorkout = useMemo(() => {
    if (plan.length === 0) return null;
    return plan.find((w) => w.id === selectedPlanWorkoutId) ?? plan[0];
  }, [plan, selectedPlanWorkoutId]);

  return {
    plan,
    setPlan,
    selectedPlanWorkoutId,
    setSelectedPlanWorkoutId,
    selectedWorkout,
    updateWorkoutIntervals,
    updateWorkoutDetails,
    isLoaded,
  };
});
