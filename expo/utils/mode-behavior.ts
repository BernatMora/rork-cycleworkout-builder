import { ProgressionObjective, TrainingGoal, WorkoutStyle } from '@/types/workout';
import { getDefaultProgressionObjective } from '@/utils/adaptive-v2';

export interface VariedComboPreset {
  goal: TrainingGoal;
  style: WorkoutStyle;
  label: string;
}

interface PickVariedComboParams {
  combos: VariedComboPreset[];
  globalSessionIndex: number;
  variedComboMode: boolean;
  surpriseRandomPerSessionMode: boolean;
  random?: () => number;
}

interface ResolveProgressionOnGoalChangeParams {
  currentProgression: ProgressionObjective;
  goal: TrainingGoal;
  autoProgressionFromGoal: boolean;
}

export function pickVariedComboForSession({
  combos,
  globalSessionIndex,
  variedComboMode,
  surpriseRandomPerSessionMode,
  random = Math.random,
}: PickVariedComboParams): VariedComboPreset {
  if (combos.length === 0) {
    throw new Error('At least one varied combo is required.');
  }

  if (variedComboMode && surpriseRandomPerSessionMode) {
    const randomIndex = Math.floor(random() * combos.length);
    return combos[Math.max(0, Math.min(combos.length - 1, randomIndex))];
  }

  return combos[globalSessionIndex % combos.length];
}

export function resolveProgressionObjectiveOnGoalChange({
  currentProgression,
  goal,
  autoProgressionFromGoal,
}: ResolveProgressionOnGoalChangeParams): ProgressionObjective {
  if (!autoProgressionFromGoal) {
    return currentProgression;
  }

  return getDefaultProgressionObjective(goal);
}
