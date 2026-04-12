import { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutInterval, TrainingGoal, ProgressionObjective } from '@/types/workout';
import { STORAGE_KEYS, WEEKDAY_OPTIONS } from '@/constants/workout-options';
import { GameRideProfile } from '@/utils/adaptive-game';

export type PlanPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';
export type PlanListFilter = 'All' | 'Pending' | 'Completed';
export type MainViewTab = 'Builder' | 'Calendar' | 'Analysis';
export type ExportHistoryFilter = 'All' | '24h' | '7d';

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

export function buildSessionKey(week: number, sessionInWeek: number): string {
  return `w${week}_s${sessionInWeek}`;
}

export function assignDayLabel(sessionIndex: number, trainingDays: string[]): string | undefined {
  if (trainingDays.length === 0) return undefined;
  return trainingDays[sessionIndex % trainingDays.length];
}

export function getReadinessLabel(score: number): 'FATIGUED' | 'READY' | 'MODERATE' {
  if (score < 40) return 'FATIGUED';
  if (score > 70) return 'READY';
  return 'MODERATE';
}

export function usePlanState(selectedTrainingDays: string[]) {
  const [plan, setPlan] = useState<PlanWorkout[]>([]);
  const [selectedPlanWorkoutId, setSelectedPlanWorkoutId] = useState<string>('');
  const [mainViewTab, setMainViewTab] = useState<MainViewTab>('Builder');
  const [planListFilter, setPlanListFilter] = useState<PlanListFilter>('All');
  const [showFatiguedOnly, setShowFatiguedOnly] = useState<boolean>(false);
  const [regeneratingWorkoutId, setRegeneratingWorkoutId] = useState<string>('');

  // Load plan from storage on mount
  useEffect(() => {
    const loadPlan = async () => {
      try {
        const [storedPlan, storedSelectedWorkout] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.PLAN),
          AsyncStorage.getItem(STORAGE_KEYS.SELECTED_PLAN_WORKOUT),
        ]);

        if (storedPlan) {
          const parsed = JSON.parse(storedPlan);
          if (Array.isArray(parsed)) {
            setPlan(parsed);
          }
        }

        if (storedSelectedWorkout) {
          setSelectedPlanWorkoutId(storedSelectedWorkout);
        }
      } catch (error) {
        console.error('Error loading plan:', error);
      }
    };

    loadPlan();
  }, []);

  // Save plan to storage when it changes
  const savePlan = useCallback(async (newPlan: PlanWorkout[]) => {
    setPlan(newPlan);
    await AsyncStorage.setItem(STORAGE_KEYS.PLAN, JSON.stringify(newPlan));
  }, []);

  // Save selected workout ID
  const saveSelectedWorkout = useCallback(async (workoutId: string) => {
    setSelectedPlanWorkoutId(workoutId);
    await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_PLAN_WORKOUT, workoutId);
  }, []);

  // Get selected workout
  const selectedWorkout = useMemo(() => {
    return plan.find((w) => w.id === selectedPlanWorkoutId) || null;
  }, [plan, selectedPlanWorkoutId]);

  // Group plan by week
  const planByWeek = useMemo(() => {
    const grouped = new Map<number, PlanWorkout[]>();

    for (const workout of plan) {
      const existing = grouped.get(workout.week) ?? [];
      existing.push(workout);
      grouped.set(workout.week, existing);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, sessions]) => ({
        week,
        sessions: sessions.sort((a, b) => a.sessionInWeek - b.sessionInWeek),
      }));
  }, [plan]);

  // Group plan by day
  const planByDay = useMemo(() => {
    const grouped = new Map<string, PlanWorkout[]>();

    for (const day of WEEKDAY_OPTIONS) {
      grouped.set(day, []);
    }

    for (const workout of plan) {
      const day =
        workout.dayLabel ?? assignDayLabel(workout.sessionInWeek - 1, selectedTrainingDays) ?? 'Mon';
      const existing = grouped.get(day) ?? [];
      existing.push(workout);
      grouped.set(day, existing);
    }

    return WEEKDAY_OPTIONS.map((day) => ({ day, sessions: grouped.get(day) ?? [] }));
  }, [plan, selectedTrainingDays]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalTss = plan.reduce((sum, session) => sum + session.tss, 0);
    const totalSeconds = plan.reduce(
      (sum, session) =>
        sum + session.intervals.reduce((inner, interval) => inner + interval.duration_seconds, 0),
      0
    );

    const zoneMinutes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };

    for (const session of plan) {
      for (const interval of session.intervals) {
        const mins = interval.duration_seconds / 60;
        if (interval.power_percent_ftp < 56) zoneMinutes.z1 += mins;
        else if (interval.power_percent_ftp < 76) zoneMinutes.z2 += mins;
        else if (interval.power_percent_ftp < 91) zoneMinutes.z3 += mins;
        else if (interval.power_percent_ftp < 106) zoneMinutes.z4 += mins;
        else if (interval.power_percent_ftp < 121) zoneMinutes.z5 += mins;
        else zoneMinutes.z6 += mins;
      }
    }

    return {
      totalTss,
      totalMinutes: Math.round(totalSeconds / 60),
      totalSessions: plan.length,
      zoneMinutes,
    };
  }, [plan]);

  // Get fatigued sessions
  const fatiguedSessions = useMemo(() => {
    return plan
      .filter(
        (item) => item.gameRideInfo && getReadinessLabel(item.gameRideInfo.readinessScore) === 'FATIGUED'
      )
      .sort((a, b) => a.week - b.week || a.sessionInWeek - b.sessionInWeek);
  }, [plan]);

  // Get ready sessions
  const readySessions = useMemo(() => {
    return plan
      .filter(
        (item) => item.gameRideInfo && getReadinessLabel(item.gameRideInfo.readinessScore) === 'READY'
      )
      .sort((a, b) => a.week - b.week || a.sessionInWeek - b.sessionInWeek);
  }, [plan]);

  // Get crazy profile summary
  const crazyProfileSummary = useMemo(() => {
    const counter = new Map<string, number>();

    for (const workout of plan) {
      if (!workout.crazyProfileLabel) continue;
      counter.set(workout.crazyProfileLabel, (counter.get(workout.crazyProfileLabel) ?? 0) + 1);
    }

    return Array.from(counter.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [plan]);

  // Update a workout in the plan
  const updateWorkout = useCallback(
    async (workoutId: string, updates: Partial<PlanWorkout>) => {
      const newPlan = plan.map((w) => (w.id === workoutId ? { ...w, ...updates } : w));
      await savePlan(newPlan);
    },
    [plan, savePlan]
  );

  // Replace a workout's intervals
  const replaceWorkoutIntervals = useCallback(
    async (workoutId: string, intervals: WorkoutInterval[], tss: number) => {
      await updateWorkout(workoutId, { intervals, tss });
    },
    [updateWorkout]
  );

  // Clear plan
  const clearPlan = useCallback(async () => {
    await savePlan([]);
    setSelectedPlanWorkoutId('');
    await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_PLAN_WORKOUT);
  }, [savePlan]);

  // Check if single session
  const isSingleSession = useMemo(() => plan.length === 1, [plan.length]);

  return {
    // State
    plan,
    selectedPlanWorkoutId,
    selectedWorkout,
    mainViewTab,
    planListFilter,
    showFatiguedOnly,
    regeneratingWorkoutId,

    // Setters
    setPlan: savePlan,
    setSelectedPlanWorkoutId: saveSelectedWorkout,
    setMainViewTab,
    setPlanListFilter,
    setShowFatiguedOnly,
    setRegeneratingWorkoutId,

    // Computed
    planByWeek,
    planByDay,
    analytics,
    fatiguedSessions,
    readySessions,
    crazyProfileSummary,
    isSingleSession,

    // Actions
    updateWorkout,
    replaceWorkoutIntervals,
    clearPlan,
  };
}

export type PlanStateHook = ReturnType<typeof usePlanState>;
