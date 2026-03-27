import { FitnessLevel, ProgressionObjective, TrainingGoal, WorkoutDuration, WorkoutStyle } from '../types/workout';

export const PROGRESSION_OBJECTIVES: ProgressionObjective[] = ['FTP', 'Endurance', 'VO2'];

type PlanPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';

interface ProgressionInput {
  objective: ProgressionObjective;
  baseDuration: WorkoutDuration;
  baseGoal: TrainingGoal;
  baseStyle: WorkoutStyle;
  level: FitnessLevel;
  phase: PlanPhase;
  week: number;
  totalWeeks: number;
  sessionInWeek: number;
  sessionsPerWeek: number;
}

interface ProgressionResult {
  duration: WorkoutDuration;
  goal: TrainingGoal;
  style: WorkoutStyle;
  intensityAdjustmentPercent: number;
}

const ALLOWED_DURATIONS: WorkoutDuration[] = [30, 45, 60, 75, 90];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nearestDuration(minutes: number): WorkoutDuration {
  const clamped = clamp(minutes, 30, 90);
  let closest = ALLOWED_DURATIONS[0];
  let closestDiff = Math.abs(clamped - closest);

  for (const candidate of ALLOWED_DURATIONS) {
    const diff = Math.abs(clamped - candidate);
    if (diff < closestDiff) {
      closest = candidate;
      closestDiff = diff;
    }
  }

  return closest;
}

function progressRatio(week: number, totalWeeks: number): number {
  if (totalWeeks <= 1) {
    return 0;
  }

  return clamp((week - 1) / (totalWeeks - 1), 0, 1);
}

function weekWaveShift(week: number, totalWeeks: number, phase: PlanPhase): number {
  if (phase === 'Recovery') {
    return -2;
  }

  const wavePattern = [-1, 0, 1] as const;
  const wave = wavePattern[(week - 1) % wavePattern.length];

  let phaseOffset = 0;
  if (phase === 'Build') {
    phaseOffset = 1;
  } else if (phase === 'Peak') {
    phaseOffset = 0;
  }

  const taperOffset = totalWeeks >= 5 && week >= totalWeeks - 1 ? -1 : 0;
  return wave + phaseOffset + taperOffset;
}

function sessionLoadShift(
  objective: ProgressionObjective,
  phase: PlanPhase,
  sessionInWeek: number,
  sessionsPerWeek: number
): number {
  if (phase === 'Recovery') {
    return -2;
  }

  const keySession = Math.ceil(sessionsPerWeek / 2);
  const finalSession = sessionsPerWeek;

  if (objective === 'Endurance') {
    if (sessionInWeek === finalSession) {
      return 1;
    }
    return 0;
  }

  if (objective === 'FTP') {
    if (sessionInWeek === keySession) {
      return 2;
    }
    if (sessionInWeek === finalSession) {
      return -1;
    }
    return 0;
  }

  if (sessionInWeek === keySession) {
    return 2;
  }
  if (sessionInWeek === finalSession) {
    return -2;
  }
  return 1;
}

function objectiveIntensityDelta(
  objective: ProgressionObjective,
  phase: PlanPhase,
  progress: number,
  week: number,
  totalWeeks: number,
  sessionInWeek: number,
  sessionsPerWeek: number,
  level: FitnessLevel
): number {
  const levelBonus = level === 'Advanced' ? 1 : level === 'Beginner' ? -1 : 0;
  const weeklyShift = weekWaveShift(week, totalWeeks, phase);
  const sessionShift = sessionLoadShift(objective, phase, sessionInWeek, sessionsPerWeek);

  if (phase === 'Recovery') {
    return objective === 'VO2' ? -7 : -5;
  }

  if (objective === 'FTP') {
    const ramp = Math.round(progress * 4);
    const phaseBoost = phase === 'Build' ? 1 : phase === 'Peak' ? 1 : 0;
    return clamp(ramp + phaseBoost + weeklyShift + sessionShift + levelBonus, -8, 8);
  }

  if (objective === 'Endurance') {
    const ramp = Math.round(progress * 3);
    const phaseBoost = phase === 'Peak' ? 1 : 0;
    return clamp(ramp + phaseBoost + weeklyShift + sessionShift + levelBonus - 1, -8, 8);
  }

  const ramp = Math.round(progress * 6);
  const phaseBoost = phase === 'Build' ? 2 : phase === 'Peak' ? 1 : 1;
  return clamp(ramp + phaseBoost + weeklyShift + sessionShift + levelBonus, -10, 10);
}

function objectiveDuration(
  objective: ProgressionObjective,
  baseDuration: WorkoutDuration,
  phase: PlanPhase,
  progress: number,
  week: number,
  totalWeeks: number,
  sessionInWeek: number,
  sessionsPerWeek: number
): WorkoutDuration {
  if (phase === 'Recovery') {
    const deloadDrop = sessionsPerWeek >= 4 ? 30 : 15;
    return nearestDuration(baseDuration - deloadDrop);
  }

  const waveShift = weekWaveShift(week, totalWeeks, phase);
  const sessionShift = sessionLoadShift(objective, phase, sessionInWeek, sessionsPerWeek);

  if (objective === 'Endurance') {
    const longRideSession = sessionInWeek === sessionsPerWeek;
    const baseBonus = longRideSession ? (progress >= 0.5 ? 30 : 15) : (progress >= 0.5 ? 15 : 0);
    const phaseBonus = phase === 'Build' ? 10 : phase === 'Peak' ? 5 : 0;
    const waveBonus = waveShift > 0 ? 5 : waveShift < 0 ? -5 : 0;
    return nearestDuration(baseDuration + baseBonus + phaseBonus + waveBonus);
  }

  if (objective === 'VO2') {
    const qualityShift = phase === 'Build' ? -5 : phase === 'Peak' ? -10 : 0;
    const weeklyShift = sessionShift >= 2 ? -5 : sessionShift <= -1 ? 5 : 0;
    return nearestDuration(baseDuration + qualityShift + weeklyShift);
  }

  if (objective === 'FTP') {
    const phaseShift = phase === 'Base' ? 0 : phase === 'Build' ? 5 : -5;
    const weeklyShift = sessionShift >= 2 ? 5 : sessionShift <= -1 ? -5 : 0;
    return nearestDuration(baseDuration + phaseShift + weeklyShift);
  }

  return baseDuration;
}

function objectiveGoal(
  objective: ProgressionObjective,
  phase: PlanPhase,
  sessionInWeek: number,
  sessionsPerWeek: number,
  fallbackGoal: TrainingGoal
): TrainingGoal {
  if (phase === 'Recovery') {
    return 'Recovery Ride';
  }

  if (objective === 'Endurance') {
    if (phase === 'Peak' && sessionInWeek === 1) {
      return 'Time Trial';
    }

    return sessionInWeek === sessionsPerWeek ? 'Tempo' : 'Endurance (Z2)';
  }

  if (objective === 'VO2') {
    if (sessionInWeek === sessionsPerWeek) {
      return 'Endurance (Z2)';
    }

    const order: TrainingGoal[] = phase === 'Base'
      ? ['VO2Max', 'HIIT', 'VO2Max']
      : phase === 'Build'
        ? ['VO2Max', 'HIIT', 'Anaerobic Capacity']
        : ['VO2Max', 'HIIT', 'Race Prep'];
    return order[(sessionInWeek - 1) % order.length];
  }

  if (phase === 'Peak') {
    return sessionInWeek % 2 === 0 ? 'Threshold' : 'Race Prep';
  }

  if (phase === 'Build') {
    return sessionInWeek % 2 === 0 ? 'Threshold' : 'Sweet Spot';
  }

  if (phase === 'Base') {
    return sessionInWeek % 2 === 0 ? 'Sweet Spot' : 'Tempo';
  }

  return fallbackGoal;
}

function objectiveStyle(
  objective: ProgressionObjective,
  phase: PlanPhase,
  sessionInWeek: number,
  fallbackStyle: WorkoutStyle
): WorkoutStyle {
  if (phase === 'Recovery') {
    return 'Steady';
  }

  if (objective === 'Endurance') {
    if (phase === 'Peak') {
      return sessionInWeek % 2 === 0 ? 'Intervals' : 'Steady';
    }
    return sessionInWeek % 3 === 0 ? 'Intervals' : 'Steady';
  }

  if (objective === 'VO2') {
    if (phase === 'Base') {
      return sessionInWeek % 2 === 0 ? 'Intervals' : 'Pyramid';
    }
    if (phase === 'Peak') {
      return sessionInWeek % 2 === 0 ? 'Over/Under' : 'Intervals';
    }
    return sessionInWeek % 2 === 0 ? 'Over/Under' : 'Intervals';
  }

  if (phase === 'Peak') {
    return sessionInWeek % 2 === 0 ? 'Over/Under' : 'Pyramid';
  }

  return fallbackStyle;
}

export function getDefaultProgressionObjective(goal: TrainingGoal): ProgressionObjective {
  if (goal === 'Endurance (Z2)' || goal === 'Recovery Ride' || goal === 'Tempo') {
    return 'Endurance';
  }

  if (goal === 'VO2Max' || goal === 'HIIT' || goal === 'Anaerobic Capacity' || goal === 'Sprint Power') {
    return 'VO2';
  }

  return 'FTP';
}

export function getAdaptiveSessionV2(input: ProgressionInput): ProgressionResult {
  const progress = progressRatio(input.week, input.totalWeeks);

  return {
    duration: objectiveDuration(
      input.objective,
      input.baseDuration,
      input.phase,
      progress,
      input.week,
      input.totalWeeks,
      input.sessionInWeek,
      input.sessionsPerWeek
    ),
    goal: objectiveGoal(
      input.objective,
      input.phase,
      input.sessionInWeek,
      input.sessionsPerWeek,
      input.baseGoal
    ),
    style: objectiveStyle(input.objective, input.phase, input.sessionInWeek, input.baseStyle),
    intensityAdjustmentPercent: objectiveIntensityDelta(
      input.objective,
      input.phase,
      progress,
      input.week,
      input.totalWeeks,
      input.sessionInWeek,
      input.sessionsPerWeek,
      input.level
    ),
  };
}
