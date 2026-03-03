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

  const adjusted = intervals.map((interval) => ({
    ...interval,
    duration_seconds: Math.max(5, Math.round(interval.duration_seconds)),
  }));

  const totalSeconds = adjusted.reduce((sum, item) => sum + item.duration_seconds, 0);
  const delta = targetSeconds - totalSeconds;

  if (delta === 0) {
    return adjusted;
  }

  const lastIndex = adjusted.length - 1;
  adjusted[lastIndex] = {
    ...adjusted[lastIndex],
    duration_seconds: Math.max(5, adjusted[lastIndex].duration_seconds + delta),
  };

  const finalTotal = adjusted.reduce((sum, item) => sum + item.duration_seconds, 0);
  if (finalTotal !== targetSeconds) {
    const correction = targetSeconds - finalTotal;
    adjusted[lastIndex] = {
      ...adjusted[lastIndex],
      duration_seconds: Math.max(5, adjusted[lastIndex].duration_seconds + correction),
    };
  }

  return adjusted;
}

function validateGeneratedIntervals(
  intervals: WorkoutInterval[],
  targetSeconds: number,
  goal: TrainingGoal
): WorkoutInterval[] {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    console.log('[workout-generator] Empty intervals from AI, using fallback workout');
    return fitToDuration(buildFallbackWorkout(targetSeconds, goal), targetSeconds);
  }

  const sanitized: WorkoutInterval[] = intervals.map((interval) => ({
    ...interval,
    duration_seconds: Math.max(5, Math.round(interval.duration_seconds)),
    power_percent_ftp: Math.max(35, Math.min(170, Math.round(interval.power_percent_ftp))),
  }));

  const withWarmup: WorkoutInterval[] = sanitized.some((item) => item.type === 'warmup')
    ? sanitized
    : [{ type: 'warmup' as const, duration_seconds: 8 * 60, power_percent_ftp: 52 }, ...sanitized];

  const withCooldown: WorkoutInterval[] = withWarmup.some((item) => item.type === 'cooldown')
    ? withWarmup
    : [...withWarmup, { type: 'cooldown' as const, duration_seconds: 6 * 60, power_percent_ftp: 45 }];

  return fitToDuration(withCooldown, targetSeconds);
}

export async function generateWorkout(params: GenerateParams): Promise<{
  intervals: WorkoutInterval[];
  summary: string;
}> {
  console.log('[workout-generator] Generating workout with params:', params);

  const prompt = `Create a structured indoor cycling workout using the following parameters:

FTP: ${params.ftp} watts
Duration: ${params.duration} minutes
Goal: ${params.goal}
Level: ${params.level}
Style: ${params.style}

Rules:
- Always include warmup and cooldown.
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

    const intervals = validateGeneratedIntervals(
      result.intervals as WorkoutInterval[],
      targetSeconds,
      params.goal
    );
    const totalSeconds = intervals.reduce((sum, i) => sum + i.duration_seconds, 0);
    console.log('[workout-generator] Total duration:', totalSeconds, 'seconds, target:', targetSeconds);

    return {
      intervals,
      summary: result.summary || `Structured ${params.goal} workout with warmup and cooldown.`,
    };
  } catch (error) {
    console.error('[workout-generator] AI generation failed, using fallback workout:', error);
    const fallbackIntervals = fitToDuration(buildFallbackWorkout(targetSeconds, params.goal), targetSeconds);

    return {
      intervals: fallbackIntervals,
      summary: `Structured ${params.goal} fallback workout, ready to export as ZWO.`,
    };
  }
}
