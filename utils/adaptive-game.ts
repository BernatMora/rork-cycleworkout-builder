import { WorkoutDuration, WorkoutInterval } from '@/types/workout';

export type GameRideProfile = 'Explorer' | 'Crusher' | 'Technician';
export type GameBranch = 'safe' | 'aggressive';
export type BossFocus = 'VO2 Repeatability' | 'Threshold Durability' | 'Sprint Repeatability' | 'Cadence Control';

export interface AdaptiveGameSignals {
  previousRpe: number;
  completionRate: number;
  hrDriftPercent: number;
  cadenceStability: number;
}

export interface AdaptiveGameInput {
  duration: WorkoutDuration;
  profile: GameRideProfile;
  signals: AdaptiveGameSignals;
}

export interface AdaptiveGamePhase {
  phase: number;
  branch: GameBranch;
  label: string;
}

export interface AdaptiveGameSession {
  readinessScore: number;
  phases: AdaptiveGamePhase[];
  intervals: WorkoutInterval[];
  summary: string;
}

export interface WeeklyBossInput {
  duration: WorkoutDuration;
  weaknessScores: Record<BossFocus, number>;
}

export interface WeeklyBossWorkout {
  focus: BossFocus;
  intervals: WorkoutInterval[];
  summary: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fitIntervalsToTarget(intervals: WorkoutInterval[], targetSeconds: number): WorkoutInterval[] {
  if (intervals.length === 0) {
    return intervals;
  }

  const safe = intervals.map((item) => ({
    ...item,
    duration_seconds: Math.max(15, Math.round(item.duration_seconds)),
  }));

  const total = safe.reduce((sum, item) => sum + item.duration_seconds, 0);
  if (total === targetSeconds) {
    return safe;
  }

  const scale = targetSeconds / Math.max(1, total);
  const scaled = safe.map((item) => ({
    ...item,
    duration_seconds: Math.max(15, Math.round(item.duration_seconds * scale)),
  }));

  let delta = targetSeconds - scaled.reduce((sum, item) => sum + item.duration_seconds, 0);
  let index = scaled.length - 1;
  let guard = 0;

  while (delta !== 0 && guard < 6000) {
    const current = scaled[index];

    if (delta > 0) {
      current.duration_seconds += 1;
      delta -= 1;
    } else if (current.duration_seconds > 15) {
      current.duration_seconds -= 1;
      delta += 1;
    }

    index -= 1;
    if (index < 0) {
      index = scaled.length - 1;
    }
    guard += 1;
  }

  return scaled;
}

export function getAdaptiveGameReadinessScore(signals: AdaptiveGameSignals): number {
  const completion = clamp(signals.completionRate, 0, 1);
  const cadence = clamp(signals.cadenceStability, 0, 1);
  const rpePenalty = clamp((signals.previousRpe - 5) * 7, -14, 28);
  const driftPenalty = clamp(signals.hrDriftPercent * 2.2, 0, 24);

  const raw = 65 + (completion * 18) + (cadence * 12) - rpePenalty - driftPenalty;
  return Math.round(clamp(raw, 5, 95));
}

function branchThresholdByProfile(profile: GameRideProfile): number {
  if (profile === 'Crusher') {
    return 48;
  }

  if (profile === 'Technician') {
    return 56;
  }

  return 62;
}

function decideBranch(
  readiness: number,
  profile: GameRideProfile,
  signals: AdaptiveGameSignals,
  phase: number,
  totalPhases: number
): GameBranch {
  if (signals.previousRpe >= 9 || signals.hrDriftPercent >= 9) {
    return 'safe';
  }

  const threshold = branchThresholdByProfile(profile) + (phase === totalPhases ? 2 : 0);
  return readiness >= threshold ? 'aggressive' : 'safe';
}

function buildPhaseIntervals(targetSeconds: number, phaseIndex: number, branch: GameBranch): WorkoutInterval[] {
  const safeTemplate: WorkoutInterval[] = [
    { type: 'interval', duration_seconds: 120, power_percent_ftp: 86 + (phaseIndex * 2) },
    { type: 'recovery', duration_seconds: 90, power_percent_ftp: 58 },
    { type: 'interval', duration_seconds: 120, power_percent_ftp: 90 + (phaseIndex * 2) },
    { type: 'recovery', duration_seconds: 90, power_percent_ftp: 60 },
  ];

  const aggressiveTemplate: WorkoutInterval[] = [
    { type: 'interval', duration_seconds: 90, power_percent_ftp: 102 + (phaseIndex * 3) },
    { type: 'recovery', duration_seconds: 60, power_percent_ftp: 56 },
    { type: 'interval', duration_seconds: 75, power_percent_ftp: 114 + (phaseIndex * 2) },
    { type: 'recovery', duration_seconds: 70, power_percent_ftp: 54 },
    { type: 'interval', duration_seconds: 60, power_percent_ftp: 120 + phaseIndex },
  ];

  return fitIntervalsToTarget(branch === 'aggressive' ? aggressiveTemplate : safeTemplate, targetSeconds);
}

export function generateAdaptiveGameSession(input: AdaptiveGameInput): AdaptiveGameSession {
  const readinessScore = getAdaptiveGameReadinessScore(input.signals);
  const totalSeconds = input.duration * 60;

  const warmup = { type: 'warmup' as const, duration_seconds: 5 * 60, power_percent_ftp: 55 };
  const cooldown = { type: 'cooldown' as const, duration_seconds: 6 * 60, power_percent_ftp: 45 };

  const mainTarget = Math.max(10 * 60, totalSeconds - warmup.duration_seconds - cooldown.duration_seconds);
  const totalPhases = input.duration >= 75 ? 5 : input.duration >= 45 ? 4 : 3;
  const phaseSecondsBase = Math.floor(mainTarget / totalPhases);
  const phaseRemainder = mainTarget - (phaseSecondsBase * totalPhases);

  const phases: AdaptiveGamePhase[] = [];
  const mainIntervals: WorkoutInterval[] = [];

  for (let i = 0; i < totalPhases; i += 1) {
    const phaseIndex = i + 1;
    const phaseTarget = phaseSecondsBase + (i === totalPhases - 1 ? phaseRemainder : 0);
    const branch = decideBranch(readinessScore, input.profile, input.signals, phaseIndex, totalPhases);

    phases.push({
      phase: phaseIndex,
      branch,
      label: branch === 'aggressive' ? `Phase ${phaseIndex}: push lane` : `Phase ${phaseIndex}: control lane`,
    });

    const phaseIntervals = buildPhaseIntervals(phaseTarget, phaseIndex, branch);
    mainIntervals.push(...phaseIntervals);
  }

  const combined = [warmup, ...mainIntervals, cooldown];
  const fitted = fitIntervalsToTarget(combined, totalSeconds);

  const aggressiveCount = phases.filter((p) => p.branch === 'aggressive').length;
  const summary = `${input.profile} ride • readiness ${readinessScore}/100 • ${aggressiveCount}/${totalPhases} aggressive phases`;

  return {
    readinessScore,
    phases,
    intervals: fitted,
    summary,
  };
}

export function pickWeeklyBossFocus(weaknessScores: Record<BossFocus, number>): BossFocus {
  const entries = Object.entries(weaknessScores) as [BossFocus, number][];
  if (entries.length === 0) {
    return 'Threshold Durability';
  }

  let selected: [BossFocus, number] = entries[0];
  for (const entry of entries.slice(1)) {
    if (entry[1] > selected[1]) {
      selected = entry;
    }
  }

  return selected[0];
}

function buildBossMainTemplate(focus: BossFocus): WorkoutInterval[] {
  if (focus === 'VO2 Repeatability') {
    return [
      { type: 'interval', duration_seconds: 90, power_percent_ftp: 116 },
      { type: 'recovery', duration_seconds: 90, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 75, power_percent_ftp: 120 },
      { type: 'recovery', duration_seconds: 75, power_percent_ftp: 54 },
    ];
  }

  if (focus === 'Sprint Repeatability') {
    return [
      { type: 'interval', duration_seconds: 18, power_percent_ftp: 145 },
      { type: 'recovery', duration_seconds: 55, power_percent_ftp: 52 },
      { type: 'interval', duration_seconds: 20, power_percent_ftp: 150 },
      { type: 'recovery', duration_seconds: 60, power_percent_ftp: 52 },
      { type: 'interval', duration_seconds: 16, power_percent_ftp: 148 },
    ];
  }

  if (focus === 'Cadence Control') {
    return [
      { type: 'interval', duration_seconds: 120, power_percent_ftp: 84 },
      { type: 'interval', duration_seconds: 90, power_percent_ftp: 92 },
      { type: 'recovery', duration_seconds: 75, power_percent_ftp: 58 },
      { type: 'interval', duration_seconds: 120, power_percent_ftp: 88 },
    ];
  }

  return [
    { type: 'interval', duration_seconds: 240, power_percent_ftp: 95 },
    { type: 'recovery', duration_seconds: 120, power_percent_ftp: 58 },
    { type: 'interval', duration_seconds: 210, power_percent_ftp: 100 },
    { type: 'recovery', duration_seconds: 90, power_percent_ftp: 56 },
  ];
}

export function generateWeeklyBossWorkout(input: WeeklyBossInput): WeeklyBossWorkout {
  const focus = pickWeeklyBossFocus(input.weaknessScores);
  const totalSeconds = input.duration * 60;

  const warmup = { type: 'warmup' as const, duration_seconds: 6 * 60, power_percent_ftp: 55 };
  const cooldown = { type: 'cooldown' as const, duration_seconds: 7 * 60, power_percent_ftp: 45 };
  const mainTarget = Math.max(12 * 60, totalSeconds - warmup.duration_seconds - cooldown.duration_seconds);

  const mainTemplate = buildBossMainTemplate(focus);
  const main = fitIntervalsToTarget(mainTemplate, mainTarget);
  const intervals = fitIntervalsToTarget([warmup, ...main, cooldown], totalSeconds);

  return {
    focus,
    intervals,
    summary: `Weekly Boss • focus: ${focus}`,
  };
}
