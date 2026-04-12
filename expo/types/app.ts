import { WorkoutInterval, TrainingGoal, ProgressionObjective } from './workout';
import { ExportFileFormat } from '@/constants/workout-options';

// Plan phases
export type PlanPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';

// Plan list filter
export type PlanListFilter = 'All' | 'Pending' | 'Completed';

// Export history filter
export type ExportHistoryFilter = 'All' | '24h' | '7d';

// Main view tabs
export type MainViewTab = 'Builder' | 'Calendar' | 'Analysis';

// Plan session
export interface PlanSession {
  id: string;
  week: number;
  session: number;
  goal: TrainingGoal;
  progression: ProgressionObjective;
  phase: PlanPhase;
  intervals: WorkoutInterval[];
  completed?: boolean;
  fatigued?: boolean;
  ready?: boolean;
  tss?: number;
  weeklyBoss?: boolean;
  totalDurationSec?: number;
}

// Training plan
export interface TrainingPlan {
  weeks: number;
  sessionsPerWeek: number;
  sessions: PlanSession[];
  createdAt: string;
}

// Export history entry
export interface ExportHistoryEntry {
  id: string;
  name: string;
  format: ExportFileFormat;
  timestamp: number;
  goal: TrainingGoal;
  duration: string;
  tss?: number;
}

// Session favorite
export interface SessionFavorite {
  id: string;
  name: string;
  goal: TrainingGoal;
  style: string;
  duration: string;
  level: string;
  progression: ProgressionObjective;
  createdAt: string;
}

// Session execution log entry
export interface SessionExecutionEntry {
  sessionId: string;
  week: number;
  session: number;
  rpe: number;
  note?: string;
  timestamp: number;
}

// Post-workout check entry
export interface PostWorkoutCheck {
  sessionId: string;
  fatigue: number;
  legs: number;
  timestamp: number;
}

// Adaptive feedback
export interface AdaptiveFeedback {
  lastSessionId?: string;
  consecutiveHard: number;
  consecutiveEasy: number;
  overallTrend: 'easier' | 'harder' | 'stable';
}

// Crazy lab theme pack
export interface CrazyThemePack {
  id: string;
  name: string;
  bossFight: boolean;
  diceMode: boolean;
  musicDrops: boolean;
  zigZagPower: boolean;
  lastMinuteTwist: boolean;
}

export const CRAZY_THEME_PACKS: CrazyThemePack[] = [
  {
    id: 'chaos_master',
    name: 'Chaos Master',
    bossFight: true,
    diceMode: true,
    musicDrops: true,
    zigZagPower: true,
    lastMinuteTwist: true,
  },
  {
    id: 'rhythm_chaos',
    name: 'Rhythm Chaos',
    bossFight: false,
    diceMode: false,
    musicDrops: true,
    zigZagPower: true,
    lastMinuteTwist: false,
  },
  {
    id: 'boss_mode',
    name: 'Boss Mode',
    bossFight: true,
    diceMode: false,
    musicDrops: false,
    zigZagPower: false,
    lastMinuteTwist: true,
  },
  {
    id: 'dice_master',
    name: 'Dice Master',
    bossFight: false,
    diceMode: true,
    musicDrops: false,
    zigZagPower: true,
    lastMinuteTwist: false,
  },
];

// Comparison workout (for import comparison)
export interface ComparisonWorkout {
  name: string;
  intervals: WorkoutInterval[];
  source: 'ictx' | 'zwo';
}

// Backup profile data
export interface BackupProfile {
  version: number;
  exportedAt: string;
  ftp?: number;
  maxHr?: number;
  language?: string;
  favorites?: SessionFavorite[];
  executionLog?: SessionExecutionEntry[];
  adaptiveFeedback?: AdaptiveFeedback;
  trainingDays?: string[];
  plan?: TrainingPlan;
  completedSessions?: string[];
}
