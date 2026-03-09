import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { WorkoutInterval, WorkoutDuration, TrainingGoal, FitnessLevel, WorkoutStyle } from '@/types/workout';

const intervalSchema = z.object({
  type: z.enum(['warmup', 'interval', 'recovery', 'cooldown']),
  duration_seconds: z.number(),
  power_percent_ftp: z.number(),
});

const workoutSchema = z.object({
  intervals: z.array(intervalSchema),
  summary: z.string(),
});

interface GenerateParams {
  ftp: number;
  duration: WorkoutDuration;
  goal: TrainingGoal;
  level: FitnessLevel;
  style: WorkoutStyle;
  warmupMinutes: number;
  cooldownMinutes: number;
  warmupPowerPercent: number;
  cooldownPowerPercent: number;
  intensityAdjustmentPercent?: number;
  ergSmoothMode?: boolean;
}

interface WarmupCooldownSettings {
  warmupMinutes: number;
  cooldownMinutes: number;
  warmupPowerPercent: number;
  cooldownPowerPercent: number;
}

function buildFallbackWorkout(targetSeconds: number, goal: TrainingGoal): WorkoutInterval[] {
  const warmupSeconds = 10 * 60;
  const cooldownSeconds = 8 * 60;
  const workBlockSeconds = Math.max(6 * 60, targetSeconds - warmupSeconds - cooldownSeconds);

  const mainPowerByGoal: Record<TrainingGoal, number> = {
    'Endurance (Z2)': 68,
    Tempo: 82,
    'Sweet Spot': 90,
    Threshold: 100,
    VO2Max: 112,
    'Anaerobic Capacity': 120,
    'Sprint Power': 145,
    HIIT: 128,
    Climbing: 98,
    'Time Trial': 94,
    Polarized: 108,
    'Recovery Ride': 55,
    'Race Prep': 102,
    'Cadence Skills': 85,
    'Muscular Endurance': 92,
  };

  const recoveryPowerByGoal: Record<TrainingGoal, number> = {
    'Endurance (Z2)': 60,
    Tempo: 58,
    'Sweet Spot': 55,
    Threshold: 52,
    VO2Max: 50,
    'Anaerobic Capacity': 48,
    'Sprint Power': 45,
    HIIT: 48,
    Climbing: 56,
    'Time Trial': 58,
    Polarized: 48,
    'Recovery Ride': 50,
    'Race Prep': 55,
    'Cadence Skills': 58,
    'Muscular Endurance': 56,
  };

  if (goal === 'Recovery Ride') {
    return [
      { type: 'warmup', duration_seconds: warmupSeconds, power_percent_ftp: 50 },
      { type: 'interval', duration_seconds: workBlockSeconds, power_percent_ftp: 58 },
      { type: 'cooldown', duration_seconds: cooldownSeconds, power_percent_ftp: 45 },
    ];
  }

  const cycleLength = 5 * 60;
  const cycleCount = Math.max(1, Math.floor(workBlockSeconds / cycleLength));
  const workPerCycle = Math.round(cycleLength * 0.65);
  const recoveryPerCycle = cycleLength - workPerCycle;
  const baseIntervals: WorkoutInterval[] = [
    { type: 'warmup', duration_seconds: warmupSeconds, power_percent_ftp: 55 },
  ];

  for (let i = 0; i < cycleCount; i += 1) {
    baseIntervals.push({
      type: 'interval',
      duration_seconds: workPerCycle,
      power_percent_ftp: mainPowerByGoal[goal],
    });
    baseIntervals.push({
      type: 'recovery',
      duration_seconds: recoveryPerCycle,
      power_percent_ftp: recoveryPowerByGoal[goal],
    });
  }

  baseIntervals.push({
    type: 'cooldown',
    duration_seconds: cooldownSeconds,
    power_percent_ftp: 45,
  });

  return baseIntervals;
}

function fitToDuration(intervals: WorkoutInterval[], targetSeconds: number): WorkoutInterval[] {
  if (intervals.length === 0) {
    return intervals;
  }

  const minIntervalSeconds = 1;

  const adjusted = intervals.map((interval) => ({
    ...interval,
    duration_seconds: Math.max(minIntervalSeconds, Math.round(interval.duration_seconds)),
  }));

  const totalSeconds = adjusted.reduce((sum, item) => sum + item.duration_seconds, 0);
  if (totalSeconds <= 0) {
    return adjusted;
  }

  if (totalSeconds === targetSeconds) {
    return adjusted;
  }

  const scale = targetSeconds / totalSeconds;
  const scaled = adjusted.map((interval) => ({
    ...interval,
    duration_seconds: Math.max(minIntervalSeconds, Math.round(interval.duration_seconds * scale)),
  }));

  let currentTotal = scaled.reduce((sum, item) => sum + item.duration_seconds, 0);
  let delta = targetSeconds - currentTotal;

  if (delta === 0) {
    return scaled;
  }

  const direction = delta > 0 ? 1 : -1;
  let index = scaled.length - 1;
  let guard = 0;

  while (delta !== 0 && guard < 100000) {
    const item = scaled[index];

    if (direction > 0) {
      item.duration_seconds += 1;
      delta -= 1;
    } else if (item.duration_seconds > minIntervalSeconds) {
      item.duration_seconds -= 1;
      delta += 1;
    }

    index -= 1;
    if (index < 0) {
      index = scaled.length - 1;
    }

    guard += 1;
  }

  currentTotal = scaled.reduce((sum, item) => sum + item.duration_seconds, 0);
  if (currentTotal !== targetSeconds) {
    const correction = targetSeconds - currentTotal;
    const lastIndex = scaled.length - 1;
    scaled[lastIndex] = {
      ...scaled[lastIndex],
      duration_seconds: Math.max(minIntervalSeconds, scaled[lastIndex].duration_seconds + correction),
    };
  }

  return scaled;
}

function validateGeneratedIntervals(
  intervals: WorkoutInterval[],
  targetSeconds: number,
  goal: TrainingGoal,
  settings: WarmupCooldownSettings
): WorkoutInterval[] {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    console.log('[workout-generator] Empty intervals from AI, using fallback workout');
    return applyWarmupCooldown(
      fitToDuration(buildFallbackWorkout(targetSeconds, goal), targetSeconds),
      targetSeconds,
      settings
    );
  }

  const sanitized: WorkoutInterval[] = intervals.map((interval) => ({
    ...interval,
    duration_seconds: Math.max(1, Math.round(interval.duration_seconds)),
    power_percent_ftp: Math.max(35, Math.min(170, Math.round(interval.power_percent_ftp))),
  }));

  const fitted = fitToDuration(sanitized, targetSeconds);
  return applyWarmupCooldown(fitted, targetSeconds, settings);
}

function applyWarmupCooldown(
  intervals: WorkoutInterval[],
  targetSeconds: number,
  settings: WarmupCooldownSettings
): WorkoutInterval[] {
  const safeWarmupMinutes = Math.max(1, Math.min(5, settings.warmupMinutes));
  const warmupSecondsRaw = Math.round(safeWarmupMinutes * 60);
  const cooldownSecondsRaw = Math.round(settings.cooldownMinutes * 60);

  const safeWarmup = Math.max(30, Math.min(targetSeconds - 30, warmupSecondsRaw));
  const safeCooldown = Math.max(30, Math.min(targetSeconds - safeWarmup, cooldownSecondsRaw));

  const mainTargetSeconds = Math.max(30, targetSeconds - safeWarmup - safeCooldown);
  const mainIntervals = intervals.filter((item) => item.type !== 'warmup' && item.type !== 'cooldown');

  const mainBase = mainIntervals.length > 0
    ? mainIntervals
    : [{ type: 'interval' as const, duration_seconds: mainTargetSeconds, power_percent_ftp: 80 }];

  const fittedMain = fitToDuration(mainBase, mainTargetSeconds);

  const merged = [
    {
      type: 'warmup' as const,
      duration_seconds: safeWarmup,
      power_percent_ftp: Math.max(40, Math.min(85, Math.round(settings.warmupPowerPercent))),
    },
    ...fittedMain,
    {
      type: 'cooldown' as const,
      duration_seconds: safeCooldown,
      power_percent_ftp: Math.max(35, Math.min(75, Math.round(settings.cooldownPowerPercent))),
    },
  ];

  return fitToDuration(merged, targetSeconds);
}

function applyIntensityAdjustment(intervals: WorkoutInterval[], adjustmentPercent: number): WorkoutInterval[] {
  if (!adjustmentPercent) {
    return intervals;
  }

  return intervals.map((interval) => {
    if (interval.type === 'warmup' || interval.type === 'cooldown') {
      return interval;
    }

    const adjustedPower = Math.round(interval.power_percent_ftp + adjustmentPercent);
    return {
      ...interval,
      power_percent_ftp: Math.max(35, Math.min(170, adjustedPower)),
    };
  });
}

const GOAL_BANDS: Record<TrainingGoal, { work: [number, number]; recovery: [number, number] }> = {
  'Endurance (Z2)': { work: [56, 75], recovery: [45, 65] },
  Tempo: { work: [76, 88], recovery: [45, 62] },
  'Sweet Spot': { work: [84, 97], recovery: [42, 60] },
  Threshold: { work: [95, 105], recovery: [40, 58] },
  VO2Max: { work: [106, 120], recovery: [40, 55] },
  'Anaerobic Capacity': { work: [115, 130], recovery: [40, 55] },
  'Sprint Power': { work: [130, 170], recovery: [40, 55] },
  HIIT: { work: [124, 154], recovery: [40, 53] },
  Climbing: { work: [90, 106], recovery: [48, 64] },
  'Time Trial': { work: [90, 103], recovery: [48, 64] },
  Polarized: { work: [110, 130], recovery: [55, 75] },
  'Recovery Ride': { work: [45, 65], recovery: [40, 58] },
  'Race Prep': { work: [95, 120], recovery: [42, 60] },
  'Cadence Skills': { work: [75, 92], recovery: [45, 62] },
  'Muscular Endurance': { work: [85, 97], recovery: [45, 62] },
};

const HIGH_INTENSITY_STRUCTURES: Partial<Record<TrainingGoal, { maxOn: number; on: number; recovery: number; minPower: number; recoveryPower: number }>> = {
  VO2Max: { maxOn: 210, on: 160, recovery: 95, minPower: 108, recoveryPower: 52 },
  HIIT: { maxOn: 75, on: 35, recovery: 70, minPower: 124, recoveryPower: 49 },
  'Anaerobic Capacity': { maxOn: 75, on: 45, recovery: 105, minPower: 118, recoveryPower: 48 },
  'Sprint Power': { maxOn: 35, on: 15, recovery: 45, minPower: 130, recoveryPower: 45 },
};

function clampToBand(value: number, band: [number, number]): number {
  return Math.max(band[0], Math.min(band[1], value));
}

function mergeSteadyMainIntervals(main: WorkoutInterval[]): WorkoutInterval[] {
  if (main.length === 0) {
    return main;
  }

  const merged: WorkoutInterval[] = [{ ...main[0] }];

  for (let i = 1; i < main.length; i += 1) {
    const current = main[i];
    const last = merged[merged.length - 1];
    const similarPower = Math.abs(last.power_percent_ftp - current.power_percent_ftp) <= 4;

    if (last.type === current.type && similarPower) {
      last.duration_seconds += current.duration_seconds;
      last.power_percent_ftp = Math.round((last.power_percent_ftp + current.power_percent_ftp) / 2);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function splitHighIntensityBlock(interval: WorkoutInterval, goal: TrainingGoal): WorkoutInterval[] {
  const structure = HIGH_INTENSITY_STRUCTURES[goal];
  if (!structure || interval.type !== 'interval') {
    return [{ ...interval }];
  }

  if (interval.duration_seconds <= structure.maxOn) {
    return [{ ...interval }];
  }

  const segments: WorkoutInterval[] = [];
  let remaining = interval.duration_seconds;
  const onPower = Math.max(structure.minPower, interval.power_percent_ftp);

  while (remaining > 0) {
    const onDuration = Math.min(structure.on, remaining);
    segments.push({
      type: 'interval',
      duration_seconds: onDuration,
      power_percent_ftp: onPower,
    });
    remaining -= onDuration;

    if (remaining <= 0) {
      break;
    }

    const recoveryDuration = Math.min(structure.recovery, remaining);
    segments.push({
      type: 'recovery',
      duration_seconds: recoveryDuration,
      power_percent_ftp: structure.recoveryPower,
    });
    remaining -= recoveryDuration;
  }

  return segments;
}

function applyGoalQualityProfile(
  intervals: WorkoutInterval[],
  targetSeconds: number,
  goal: TrainingGoal,
  style: WorkoutStyle
): WorkoutInterval[] {
  const band = GOAL_BANDS[goal];

  const warmup = intervals.find((item) => item.type === 'warmup');
  const cooldown = [...intervals].reverse().find((item) => item.type === 'cooldown');

  const mainRaw = intervals.filter((item) => item.type !== 'warmup' && item.type !== 'cooldown');
  let main = mainRaw.length > 0
    ? mainRaw
    : [{ type: 'interval' as const, duration_seconds: Math.max(60, targetSeconds - 120), power_percent_ftp: Math.round((band.work[0] + band.work[1]) / 2) }];

  main = main.flatMap((interval) => splitHighIntensityBlock(interval, goal));

  if (style === 'Steady' || goal === 'Time Trial' || goal === 'Climbing' || goal === 'Muscular Endurance') {
    main = mergeSteadyMainIntervals(main);
  }

  main = main.map((interval) => {
    const clampedPower = interval.type === 'recovery'
      ? clampToBand(interval.power_percent_ftp, band.recovery)
      : clampToBand(interval.power_percent_ftp, band.work);

    return {
      ...interval,
      power_percent_ftp: Math.round(clampedPower),
      duration_seconds: Math.max(20, Math.round(interval.duration_seconds)),
    };
  });

  const rebuilt: WorkoutInterval[] = [
    ...(warmup ? [{ ...warmup }] : []),
    ...main,
    ...(cooldown ? [{ ...cooldown }] : []),
  ];

  return fitToDuration(rebuilt, targetSeconds);
}

function applyErgSmoothing(intervals: WorkoutInterval[]): WorkoutInterval[] {
  if (intervals.length === 0) {
    return intervals;
  }

  const smoothed = intervals.map((interval) => ({ ...interval }));

  for (let i = 1; i < smoothed.length; i += 1) {
    const prev = smoothed[i - 1];
    const current = smoothed[i];

    if (current.type === 'warmup' || current.type === 'cooldown') {
      continue;
    }

    const delta = current.power_percent_ftp - prev.power_percent_ftp;
    if (Math.abs(delta) > 20) {
      current.power_percent_ftp = prev.power_percent_ftp + (delta > 0 ? 20 : -20);
    }

    if (current.duration_seconds < 90 && current.type === 'interval') {
      current.duration_seconds = 90;
    }
  }

  const targetSeconds = intervals.reduce((sum, item) => sum + item.duration_seconds, 0);
  return fitToDuration(smoothed, targetSeconds);
}

export async function generateWorkout(params: GenerateParams): Promise<{
  intervals: WorkoutInterval[];
  summary: string;
}> {
  console.log('[workout-generator] Generating workout with params:', params);

  const safeWarmupMinutes = Math.max(1, Math.min(5, params.warmupMinutes));
  const safeCooldownMinutes = Math.max(1, Math.min(20, params.cooldownMinutes));

  const prompt = `Create a structured indoor cycling workout using the following parameters:

FTP: ${params.ftp} watts
Duration: ${params.duration} minutes
Goal: ${params.goal}
Level: ${params.level}
Style: ${params.style}
Warmup: ${safeWarmupMinutes} minutes at ${params.warmupPowerPercent}% FTP
Cooldown: ${safeCooldownMinutes} minutes at ${params.cooldownPowerPercent}% FTP
Intensity adjustment target: ${params.intensityAdjustmentPercent ?? 0}%
ERG smooth mode: ${params.ergSmoothMode ? 'enabled (avoid abrupt jumps)' : 'disabled'}

Rules:
- Always include warmup and cooldown.
- Warmup must be exactly ${safeWarmupMinutes} minutes around ${params.warmupPowerPercent}% FTP.
- Cooldown must be exactly ${safeCooldownMinutes} minutes around ${params.cooldownPowerPercent}% FTP.
- Workout must fit exactly within ${params.duration} minutes (${params.duration * 60} seconds total).
- Use realistic indoor cycling interval structures.
- Power targets must be expressed as percentage of FTP (e.g., 75 means 75% of FTP).
- Include recovery intervals when intensity is high.
- Warmup should gradually build from 40-50% to 60-75% FTP.
- Cooldown should be 40-60% FTP.
- Recovery intervals should be 40-55% FTP.
- For Endurance (Z2), keep most work between 56-75% FTP.
- For Tempo, keep main intervals at 76-88% FTP.
- For Sweet Spot, keep main intervals at 84-97% FTP.
- For Threshold, keep main intervals at 95-105% FTP.
- For VO2Max, keep main intervals at 106-120% FTP.
- For Anaerobic Capacity, use repeat efforts around 115-130% FTP with generous recovery.
- For Sprint Power, use very short explosive efforts at 130-170% FTP with long easy recoveries.
- For HIIT, use short bursts at 120-150% FTP with recovery.
- For Climbing, favor sustained seated climbing blocks around 88-105% FTP.
- For Time Trial, favor long uninterrupted efforts around 88-102% FTP.
- For Polarized, keep most time easy (55-75% FTP) with short high-intensity blocks (110-130% FTP).
- For Recovery Ride, keep everything under 65% FTP.
- For Race Prep, combine sustained threshold blocks (95-105% FTP) with short surges (110-120% FTP).
- For Cadence Skills, include cadence-focused intervals at moderate intensity (75-92% FTP) with smooth recoveries.
- For Muscular Endurance, include longer seated torque-style blocks at 85-97% FTP with short recoveries.
- Also provide a brief one-sentence summary of the workout.

Return the intervals array and a summary string.`;

  const targetSeconds = params.duration * 60;

  try {
    const result = await generateObject({
      messages: [{ role: 'user', content: prompt }],
      schema: workoutSchema,
    });

    console.log('[workout-generator] Generated workout:', result);

    let intervals = validateGeneratedIntervals(
      result.intervals as WorkoutInterval[],
      targetSeconds,
      params.goal,
      {
        warmupMinutes: safeWarmupMinutes,
        cooldownMinutes: safeCooldownMinutes,
        warmupPowerPercent: params.warmupPowerPercent,
        cooldownPowerPercent: params.cooldownPowerPercent,
      }
    );
    intervals = applyIntensityAdjustment(intervals, params.intensityAdjustmentPercent ?? 0);
    intervals = applyGoalQualityProfile(intervals, targetSeconds, params.goal, params.style);
    if (params.ergSmoothMode) {
      intervals = applyErgSmoothing(intervals);
    }
    const totalSeconds = intervals.reduce((sum, i) => sum + i.duration_seconds, 0);
    console.log('[workout-generator] Total duration:', totalSeconds, 'seconds, target:', targetSeconds);

    return {
      intervals,
      summary: result.summary || `Structured ${params.goal} workout with warmup and cooldown.`,
    };
  } catch (error) {
    console.error('[workout-generator] AI generation failed, using fallback workout:', error);
    let fallbackIntervals = applyWarmupCooldown(
      fitToDuration(buildFallbackWorkout(targetSeconds, params.goal), targetSeconds),
      targetSeconds,
      {
        warmupMinutes: safeWarmupMinutes,
        cooldownMinutes: safeCooldownMinutes,
        warmupPowerPercent: params.warmupPowerPercent,
        cooldownPowerPercent: params.cooldownPowerPercent,
      }
    );
    fallbackIntervals = applyIntensityAdjustment(fallbackIntervals, params.intensityAdjustmentPercent ?? 0);
    fallbackIntervals = applyGoalQualityProfile(fallbackIntervals, targetSeconds, params.goal, params.style);
    if (params.ergSmoothMode) {
      fallbackIntervals = applyErgSmoothing(fallbackIntervals);
    }

    return {
      intervals: fallbackIntervals,
      summary: `Structured ${params.goal} fallback workout, ready to export as ZWO.`,
    };
  }
}
