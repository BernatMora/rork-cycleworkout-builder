import { FitnessLevel, WorkoutDuration, WorkoutInterval } from '@/types/workout';

export type AdvancedTrainingMode =
  | 'Off'
  | 'Race Simulator'
  | 'Spin Class'
  | 'Cadence Intelligence'
  | 'Heat/Stress Safe'
  | 'Micro-dose'
  | 'Skills Day'
  | 'Block Periodization';

export type RaceSimulatorProfile = 'TT' | 'Crits' | 'Gran Fondo';
export type BlockFocus = 'VO2' | 'Threshold';
export type SpinClassStyle = 'Rhythm' | 'Climb' | 'Power' | 'Recovery Flow';

export interface AdvancedModeSignals {
  previousRpe: number;
  hrDriftPercent: number;
  cadenceStability: number;
}

export interface AdvancedModeInput {
  mode: AdvancedTrainingMode;
  duration: WorkoutDuration;
  week: number;
  level: FitnessLevel;
  spinStyle: SpinClassStyle;
  baseIntervals: WorkoutInterval[];
  raceProfile: RaceSimulatorProfile;
  blockFocus: BlockFocus;
  signals: AdvancedModeSignals;
}

export interface AdvancedModeResult {
  intervals: WorkoutInterval[];
  summarySuffix: string;
  label: string;
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

  const scale = targetSeconds / Math.max(total, 1);
  const scaled = safe.map((item) => ({
    ...item,
    duration_seconds: Math.max(15, Math.round(item.duration_seconds * scale)),
  }));

  let delta = targetSeconds - scaled.reduce((sum, item) => sum + item.duration_seconds, 0);
  let index = scaled.length - 1;
  let guard = 0;

  while (delta !== 0 && guard < 8000) {
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

function getWarmup(base: WorkoutInterval[]): WorkoutInterval {
  return base.find((i) => i.type === 'warmup') ?? { type: 'warmup', duration_seconds: 5 * 60, power_percent_ftp: 55 };
}

function getCooldown(base: WorkoutInterval[]): WorkoutInterval {
  return [...base].reverse().find((i) => i.type === 'cooldown') ?? { type: 'cooldown', duration_seconds: 6 * 60, power_percent_ftp: 45 };
}

function buildRaceSimulator(targetSeconds: number, profile: RaceSimulatorProfile): WorkoutInterval[] {
  const startPower = profile === 'TT' ? 108 : profile === 'Crits' ? 122 : 102;
  const settlePower = profile === 'TT' ? 94 : profile === 'Crits' ? 86 : 88;
  const attackPower = profile === 'TT' ? 112 : profile === 'Crits' ? 132 : 118;
  const finalPower = profile === 'TT' ? 108 : profile === 'Crits' ? 124 : 110;

  const template: WorkoutInterval[] = [
    { type: 'interval', duration_seconds: 3 * 60, power_percent_ftp: startPower },
    { type: 'recovery', duration_seconds: 75, power_percent_ftp: 58 },
    { type: 'interval', duration_seconds: 8 * 60, power_percent_ftp: settlePower },
    { type: 'interval', duration_seconds: 60, power_percent_ftp: attackPower },
    { type: 'recovery', duration_seconds: 90, power_percent_ftp: 56 },
    { type: 'interval', duration_seconds: 75, power_percent_ftp: attackPower },
    { type: 'recovery', duration_seconds: 90, power_percent_ftp: 56 },
    { type: 'interval', duration_seconds: 4 * 60, power_percent_ftp: finalPower },
  ];

  return fitIntervalsToTarget(template, targetSeconds);
}

function buildCadenceIntelligence(baseMain: WorkoutInterval[], targetSeconds: number): WorkoutInterval[] {
  const cadenceCycle = [75, 90, 105] as const;
  const withCadence: WorkoutInterval[] = [];

  for (const interval of baseMain) {
    const blockSeconds = Math.max(45, Math.min(120, Math.round(interval.duration_seconds / 3)));
    let remaining = interval.duration_seconds;
    let idx = 0;

    while (remaining > 0) {
      const segment = Math.min(blockSeconds, remaining);
      withCadence.push({
        ...interval,
        duration_seconds: segment,
        cadence_rpm_target: cadenceCycle[idx % cadenceCycle.length],
      });
      remaining -= segment;
      idx += 1;
    }
  }

  return fitIntervalsToTarget(withCadence, targetSeconds);
}

function getSpinWeekCycle(week: number): 1 | 2 | 3 | 4 {
  const cycle = ((Math.max(1, week) - 1) % 4) + 1;
  return cycle as 1 | 2 | 3 | 4;
}

function buildSpinBaseTemplate(style: SpinClassStyle): WorkoutInterval[] {
  if (style === 'Climb') {
    return [
      { type: 'interval', duration_seconds: 2 * 60, power_percent_ftp: 74, cadence_rpm_target: 78, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 75, power_percent_ftp: 88, cadence_rpm_target: 72, posture_cue: 'standing' },
      { type: 'recovery', duration_seconds: 75, power_percent_ftp: 55, cadence_rpm_target: 85, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 3 * 60, power_percent_ftp: 82, cadence_rpm_target: 76, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 60, power_percent_ftp: 92, cadence_rpm_target: 70, posture_cue: 'standing' },
      { type: 'recovery', duration_seconds: 90, power_percent_ftp: 54, cadence_rpm_target: 86, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 2 * 60, power_percent_ftp: 84, cadence_rpm_target: 74, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 45, power_percent_ftp: 98, cadence_rpm_target: 68, posture_cue: 'standing' },
    ];
  }

  if (style === 'Power') {
    return [
      { type: 'interval', duration_seconds: 75, power_percent_ftp: 82, cadence_rpm_target: 88, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 45, power_percent_ftp: 98, cadence_rpm_target: 104, posture_cue: 'standing' },
      { type: 'recovery', duration_seconds: 60, power_percent_ftp: 54, cadence_rpm_target: 86, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 60, power_percent_ftp: 92, cadence_rpm_target: 100, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 30, power_percent_ftp: 108, cadence_rpm_target: 110, posture_cue: 'standing' },
      { type: 'recovery', duration_seconds: 75, power_percent_ftp: 53, cadence_rpm_target: 84, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 60, power_percent_ftp: 94, cadence_rpm_target: 102, posture_cue: 'standing' },
      { type: 'recovery', duration_seconds: 75, power_percent_ftp: 54, cadence_rpm_target: 86, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 45, power_percent_ftp: 106, cadence_rpm_target: 112, posture_cue: 'standing' },
    ];
  }

  if (style === 'Recovery Flow') {
    return [
      { type: 'interval', duration_seconds: 2 * 60, power_percent_ftp: 66, cadence_rpm_target: 82, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 2 * 60, power_percent_ftp: 68, cadence_rpm_target: 88, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 2 * 60, power_percent_ftp: 70, cadence_rpm_target: 94, posture_cue: 'seated' },
      { type: 'recovery', duration_seconds: 90, power_percent_ftp: 52, cadence_rpm_target: 86, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 90, power_percent_ftp: 72, cadence_rpm_target: 100, posture_cue: 'seated' },
      { type: 'recovery', duration_seconds: 90, power_percent_ftp: 50, cadence_rpm_target: 84, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 120, power_percent_ftp: 68, cadence_rpm_target: 90, posture_cue: 'seated' },
    ];
  }

  return [
    { type: 'interval', duration_seconds: 2 * 60, power_percent_ftp: 72, cadence_rpm_target: 80, posture_cue: 'seated' },
    { type: 'interval', duration_seconds: 90, power_percent_ftp: 78, cadence_rpm_target: 90, posture_cue: 'seated' },
    { type: 'interval', duration_seconds: 75, power_percent_ftp: 84, cadence_rpm_target: 100, posture_cue: 'seated' },
    { type: 'interval', duration_seconds: 45, power_percent_ftp: 90, cadence_rpm_target: 110, posture_cue: 'standing' },
    { type: 'recovery', duration_seconds: 75, power_percent_ftp: 55, cadence_rpm_target: 86, posture_cue: 'seated' },
    { type: 'interval', duration_seconds: 2 * 60, power_percent_ftp: 80, cadence_rpm_target: 82, posture_cue: 'seated' },
    { type: 'interval', duration_seconds: 60, power_percent_ftp: 88, cadence_rpm_target: 96, posture_cue: 'standing' },
    { type: 'recovery', duration_seconds: 90, power_percent_ftp: 54, cadence_rpm_target: 84, posture_cue: 'seated' },
  ];
}

function getSpinMicroObjective(style: SpinClassStyle, weekCycle: 1 | 2 | 3 | 4): string {
  if (style === 'Climb') {
    return weekCycle === 4
      ? 'Deload: smooth seated torque focus'
      : 'Stable standing torque at 68-78 rpm';
  }

  if (style === 'Power') {
    return weekCycle === 4
      ? 'Deload: crisp transitions, reduced peak power'
      : 'Explosive seated-to-standing transitions';
  }

  if (style === 'Recovery Flow') {
    return weekCycle === 4
      ? 'Deload: breathing + pedal smoothness'
      : 'Single-leg simulation and cadence control';
  }

  return weekCycle === 4
    ? 'Deload: cadence precision over load'
    : 'Cadence ladder 80/90/100/110 BPM sync';
}

function buildSpinClass(targetSeconds: number, level: FitnessLevel, week: number, style: SpinClassStyle): { intervals: WorkoutInterval[]; microObjective: string } {
  const powerDelta = level === 'Beginner' ? -6 : level === 'Advanced' ? 5 : 0;
  const cadenceDelta = level === 'Beginner' ? -4 : level === 'Advanced' ? 4 : 0;
  const weekCycle = getSpinWeekCycle(week);
  const weekPowerFactor = weekCycle === 1 ? 1 : weekCycle === 2 ? 1.03 : weekCycle === 3 ? 1.06 : 0.92;
  const weekCadenceFactor = weekCycle === 4 ? 0.98 : 1;
  const tunePower = (value: number): number => clamp(Math.round(value + powerDelta), 55, 130);
  const tuneCadence = (value: number): number => clamp(Math.round(value + cadenceDelta), 65, 120);
  const tuned = buildSpinBaseTemplate(style).map((item) => ({
    ...item,
    duration_seconds: item.type === 'recovery' && weekCycle !== 4
      ? Math.round(item.duration_seconds * 0.95)
      : item.type === 'recovery' && weekCycle === 4
        ? Math.round(item.duration_seconds * 1.12)
        : item.duration_seconds,
    power_percent_ftp: item.type === 'recovery'
      ? clamp(Math.round(tunePower(item.power_percent_ftp) * (weekCycle === 4 ? 0.95 : 1)), 48, 110)
      : clamp(Math.round(tunePower(item.power_percent_ftp) * weekPowerFactor), 60, 130),
    cadence_rpm_target: item.cadence_rpm_target
      ? clamp(Math.round(tuneCadence(item.cadence_rpm_target) * weekCadenceFactor), 65, 120)
      : undefined,
  }));

  return {
    intervals: fitIntervalsToTarget(tuned, targetSeconds),
    microObjective: getSpinMicroObjective(style, weekCycle),
  };
}

function buildHeatStressSafe(main: WorkoutInterval[], targetSeconds: number, signals: AdvancedModeSignals): WorkoutInterval[] {
  const fatigue = signals.previousRpe >= 8 || signals.hrDriftPercent >= 7;
  if (!fatigue) {
    return fitIntervalsToTarget(main, targetSeconds);
  }

  const softened: WorkoutInterval[] = [];

  for (const interval of main) {
    if (interval.type === 'interval') {
      softened.push({
        ...interval,
        power_percent_ftp: clamp(interval.power_percent_ftp - 8, 60, 150),
      });
      softened.push({
        type: 'recovery',
        duration_seconds: Math.max(45, Math.round(interval.duration_seconds * 0.3)),
        power_percent_ftp: 55,
      });
    } else if (interval.type === 'recovery') {
      softened.push({
        ...interval,
        duration_seconds: Math.round(interval.duration_seconds * 1.3),
        power_percent_ftp: clamp(interval.power_percent_ftp, 45, 62),
      });
    } else {
      softened.push(interval);
    }
  }

  return fitIntervalsToTarget(softened, targetSeconds);
}

function buildMicroDose(targetSeconds: number): WorkoutInterval[] {
  const effective = clamp(Math.round(targetSeconds * 0.68), 20 * 60, 35 * 60);
  const easy = Math.max(60, targetSeconds - effective);

  const quality = fitIntervalsToTarget([
    { type: 'interval', duration_seconds: 90, power_percent_ftp: 108 },
    { type: 'recovery', duration_seconds: 90, power_percent_ftp: 56 },
    { type: 'interval', duration_seconds: 75, power_percent_ftp: 114 },
    { type: 'recovery', duration_seconds: 75, power_percent_ftp: 55 },
    { type: 'interval', duration_seconds: 60, power_percent_ftp: 118 },
    { type: 'recovery', duration_seconds: 60, power_percent_ftp: 55 },
  ], effective);

  return fitIntervalsToTarget([
    ...quality,
    { type: 'recovery', duration_seconds: easy, power_percent_ftp: 52 },
  ], targetSeconds);
}

function buildSkillsDay(targetSeconds: number): WorkoutInterval[] {
  const template: WorkoutInterval[] = [
    { type: 'interval', duration_seconds: 120, power_percent_ftp: 70, cadence_rpm_target: 75 },
    { type: 'interval', duration_seconds: 120, power_percent_ftp: 72, cadence_rpm_target: 90 },
    { type: 'interval', duration_seconds: 120, power_percent_ftp: 74, cadence_rpm_target: 105 },
    { type: 'recovery', duration_seconds: 90, power_percent_ftp: 55, cadence_rpm_target: 85 },
    { type: 'interval', duration_seconds: 150, power_percent_ftp: 76, cadence_rpm_target: 80 },
    { type: 'interval', duration_seconds: 150, power_percent_ftp: 78, cadence_rpm_target: 95 },
    { type: 'recovery', duration_seconds: 90, power_percent_ftp: 54, cadence_rpm_target: 85 },
  ];

  return fitIntervalsToTarget(template, targetSeconds);
}

function buildBlockPeriodization(targetSeconds: number, week: number, focus: BlockFocus): WorkoutInterval[] {
  const consolidation = week % 4 === 0;

  if (consolidation) {
    return fitIntervalsToTarget([
      { type: 'interval', duration_seconds: 5 * 60, power_percent_ftp: 84 },
      { type: 'recovery', duration_seconds: 2 * 60, power_percent_ftp: 58 },
      { type: 'interval', duration_seconds: 6 * 60, power_percent_ftp: 86 },
      { type: 'recovery', duration_seconds: 2 * 60, power_percent_ftp: 58 },
      { type: 'interval', duration_seconds: 4 * 60, power_percent_ftp: 88 },
    ], targetSeconds);
  }

  if (focus === 'VO2') {
    return fitIntervalsToTarget([
      { type: 'interval', duration_seconds: 90, power_percent_ftp: 112 },
      { type: 'recovery', duration_seconds: 90, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 75, power_percent_ftp: 118 },
      { type: 'recovery', duration_seconds: 75, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 60, power_percent_ftp: 122 },
      { type: 'recovery', duration_seconds: 90, power_percent_ftp: 56 },
    ], targetSeconds);
  }

  return fitIntervalsToTarget([
    { type: 'interval', duration_seconds: 8 * 60, power_percent_ftp: 96 },
    { type: 'recovery', duration_seconds: 2 * 60, power_percent_ftp: 58 },
    { type: 'interval', duration_seconds: 10 * 60, power_percent_ftp: 100 },
    { type: 'recovery', duration_seconds: 2 * 60, power_percent_ftp: 58 },
    { type: 'interval', duration_seconds: 6 * 60, power_percent_ftp: 102 },
  ], targetSeconds);
}

export function applyAdvancedTrainingMode(input: AdvancedModeInput): AdvancedModeResult {
  const warmup = getWarmup(input.baseIntervals);
  const cooldown = getCooldown(input.baseIntervals);
  const targetSeconds = input.duration * 60;

  const safeWarmup = Math.max(60, Math.min(targetSeconds - 180, warmup.duration_seconds));
  const safeCooldown = Math.max(60, Math.min(targetSeconds - safeWarmup - 60, cooldown.duration_seconds));
  const mainTarget = Math.max(180, targetSeconds - safeWarmup - safeCooldown);

  const baseMain = input.baseIntervals.filter((item) => item.type !== 'warmup' && item.type !== 'cooldown');
  const fallbackMain = baseMain.length > 0
    ? baseMain
    : [{ type: 'interval' as const, duration_seconds: mainTarget, power_percent_ftp: 88 }];

  if (input.mode === 'Off') {
    return {
      intervals: fitIntervalsToTarget(input.baseIntervals, targetSeconds),
      summarySuffix: '',
      label: 'Off',
    };
  }

  let modeMain: WorkoutInterval[] = fallbackMain;
  let suffix: string = input.mode;

  if (input.mode === 'Race Simulator') {
    modeMain = buildRaceSimulator(mainTarget, input.raceProfile);
    suffix = `Race Simulator (${input.raceProfile})`;
  } else if (input.mode === 'Spin Class') {
    const spin = buildSpinClass(mainTarget, input.level, input.week, input.spinStyle);
    modeMain = spin.intervals;
    suffix = `Spin Class (${input.spinStyle} · ${input.level} · ${spin.microObjective})`;
  } else if (input.mode === 'Cadence Intelligence') {
    modeMain = buildCadenceIntelligence(fallbackMain, mainTarget);
    suffix = 'Cadence Intelligence (75/90/105 rpm blocks)';
  } else if (input.mode === 'Heat/Stress Safe') {
    modeMain = buildHeatStressSafe(fallbackMain, mainTarget, input.signals);
    suffix = 'Heat/Stress Safe (auto peak trimming)';
  } else if (input.mode === 'Micro-dose') {
    modeMain = buildMicroDose(mainTarget);
    suffix = 'Micro-dose (minimal effective stimulus)';
  } else if (input.mode === 'Skills Day') {
    modeMain = buildSkillsDay(mainTarget);
    suffix = 'Skills Day (technique focus)';
  } else if (input.mode === 'Block Periodization') {
    modeMain = buildBlockPeriodization(mainTarget, input.week, input.blockFocus);
    suffix = `Block Periodization (${input.blockFocus}${input.week % 4 === 0 ? ' · consolidation' : ''})`;
  }

  const combined = [
    { ...warmup, duration_seconds: safeWarmup },
    ...modeMain,
    { ...cooldown, duration_seconds: safeCooldown },
  ];

  return {
    intervals: fitIntervalsToTarget(combined, targetSeconds),
    summarySuffix: suffix,
    label: input.mode,
  };
}
