import { TrainingGoal, WorkoutInterval, WorkoutStyle } from '@/types/workout';

/**
 * Generador local d'entrenaments: construeix la part principal amb estructura
 * variada (el "narratiu" que fa que un entrenament sigui interessant) sense
 * cridar cap model. Substitueix el buildFallbackWorkout, que feia blocs
 * idèntics de 5 min i era el que veia tothom quan la IA no estava disponible.
 *
 * Despres d'aixo, la cadena de qualitat que ja existia (applyWarmupCooldown,
 * applyGoalQualityProfile, applyIntensityAdjustment, applyErgSmoothing i
 * fitToDuration) s'encarrega dels limits de zona i de quadrar la durada.
 */

/** Banda de treball per objectiu (mateixa que GOAL_BANDS del generador). */
const WORK_BANDS: Record<TrainingGoal, [number, number]> = {
  'Endurance (Z2)': [56, 75],
  Tempo: [76, 88],
  'Sweet Spot': [84, 97],
  Threshold: [95, 105],
  VO2Max: [106, 120],
  'Anaerobic Capacity': [115, 130],
  'Sprint Power': [130, 170],
  HIIT: [124, 154],
  Climbing: [90, 106],
  'Time Trial': [90, 103],
  Polarized: [110, 130],
  'Recovery Ride': [45, 65],
  'Race Prep': [95, 120],
  'Cadence Skills': [75, 92],
  'Muscular Endurance': [85, 97],
};

/** Recuperacio: potencia i durada tipica segons l'objectiu. */
const RECOVERY_BANDS: Record<TrainingGoal, { power: [number, number]; seconds: number }> = {
  'Endurance (Z2)': { power: [45, 65], seconds: 150 },
  Tempo: { power: [45, 62], seconds: 130 },
  'Sweet Spot': { power: [42, 60], seconds: 140 },
  Threshold: { power: [40, 58], seconds: 150 },
  VO2Max: { power: [40, 55], seconds: 110 },
  'Anaerobic Capacity': { power: [40, 55], seconds: 135 },
  'Sprint Power': { power: [40, 55], seconds: 180 },
  HIIT: { power: [40, 53], seconds: 95 },
  Climbing: { power: [48, 64], seconds: 130 },
  'Time Trial': { power: [48, 64], seconds: 140 },
  Polarized: { power: [55, 75], seconds: 190 },
  'Recovery Ride': { power: [40, 58], seconds: 160 },
  'Race Prep': { power: [42, 60], seconds: 125 },
  'Cadence Skills': { power: [45, 62], seconds: 95 },
  'Muscular Endurance': { power: [45, 62], seconds: 105 },
};

/** Durada objectiu de cada bloc de treball (segons), per tipus d'objectiu. */
function workDurationsFor(goal: TrainingGoal, mainSeconds: number): number[] {
  // Estructures curtes i explosives
  if (goal === 'Sprint Power') return [15, 18, 22, 25, 30, 35];
  if (goal === 'HIIT') return [30, 35, 40, 45, 50, 60];
  if (goal === 'Anaerobic Capacity') return [45, 50, 55, 60, 70, 80];

  // Estructures mitjanes
  if (goal === 'VO2Max') return [90, 105, 120, 135, 150, 165, 180];
  if (goal === 'Race Prep') return [120, 150, 180, 210, 240];
  if (goal === 'Cadence Skills') return [90, 120, 150, 180, 210];

  // Blocs llargs i sostinguts
  if (goal === 'Climbing' || goal === 'Muscular Endurance' || goal === 'Time Trial') {
    const base = Math.max(180, Math.round(mainSeconds / 4));
    return [base, Math.round(base * 1.15), Math.round(base * 1.3), Math.round(base * 0.9)];
  }
  if (goal === 'Polarized') return [30, 45, 60, 90, 120, 240, 300];

  return [150, 180, 210, 240, 300, 330];
}

/** Rellotgera un valor dins la banda, amb un desviament deterministic. */
function clamp(value: number, band: [number, number]): number {
  return Math.round(Math.max(band[0], Math.min(band[1], value)));
}

const CADENCES = [62, 68, 72, 78, 82, 85, 88, 92, 95, 100, 105];

/**
 * Construeix la part principal d'un entrenament amb estructura variada.
 * Repeteix un "bloc" (treball + recuperacio) variant la durada, la potencia i
 * la cadencia a cada volta, de manera que dos intervals no surtin iguals.
 */
export function buildVariedMain(
  mainSeconds: number,
  goal: TrainingGoal,
  style: WorkoutStyle,
  level: 'Beginner' | 'Intermediate' | 'Advanced'
): WorkoutInterval[] {
  const workBand = WORK_BANDS[goal];
  const recovery = RECOVERY_BANDS[goal];
  const durations = workDurationsFor(goal, mainSeconds);

  // Nivell: desplac,a dins la banda (Beginner baix, Advanced alt).
  const levelShift = level === 'Beginner' ? -0.25 : level === 'Advanced' ? 0.25 : 0;
  const midpoint = (workBand[0] + workBand[1]) / 2;
  const swing = (workBand[1] - workBand[0]) / 2;

  // Estil: Steady -> poques variants, Intervals -> mes contrast.
  const steady = style === 'Steady';
  const contrast = steady ? 0.35 : style === 'Over/Under' ? 1 : style === 'Pyramid' ? 0.75 : 0.6;

  const main: WorkoutInterval[] = [];
  let remaining = mainSeconds;

  // Blocs d'insistencia: a muntanya/endurance/contrarellotge en fem pocs i llargs.
  const longBlocks = goal === 'Climbing' || goal === 'Muscular Endurance' || goal === 'Time Trial';

  let index = 0;
  while (remaining > 30 && index < 60) {
    const cycle = durations[index % durations.length];
    const workSeconds = Math.min(cycle, remaining);
    // Llindar baix a proposit: els esprints d'aquests objectius duren 15-18 s,
    // i amb un tall de 20 s el bucle sortia a la primera volta i no generava res.
    if (workSeconds < 10) break;

    // Potencia: alterna per sobre i per sota del punt mig, amb contrast creixent.
    const wave = Math.sin(index * 1.1) * contrast;
    const target = midpoint + levelShift * (workBand[1] - workBand[0]) + wave * swing;
    const power = clamp(target, workBand);

    // Cadencia: agrupada per tipus d'objectiu.
    const cadence =
      goal === 'Climbing' || goal === 'Muscular Endurance'
        ? 58 + ((index * 3) % 12)
        : goal === 'Sprint Power'
          ? 100 + ((index * 4) % 16)
          : CADENCES[(index * 3) % CADENCES.length];

    main.push({
      type: 'interval',
      duration_seconds: Math.round(workSeconds),
      power_percent_ftp: power,
      cadence_rpm_target: cadence,
      posture_cue: 'seated',
    });

    remaining -= workSeconds;
    if (remaining <= 30) break;

    // Recuperacio: mateixa durada base pero desviada, perque no siguin iguals.
    // En estils sostinguts el treball va seguit i no hi ha recuperacio.
    if (!(steady && longBlocks)) {
      const jitter = 1 + (((index * 7) % 11) - 5) / 50; // ±10%
      const recSeconds = Math.min(Math.round(recovery.seconds * jitter), remaining);
      if (recSeconds >= 10) {
        main.push({
          type: 'recovery',
          duration_seconds: recSeconds,
          power_percent_ftp: clamp(
            recovery.power[0] + ((index * 5) % (recovery.power[1] - recovery.power[0] + 1)),
            recovery.power
          ),
          cadence_rpm_target: 80 + ((index * 2) % 10),
          posture_cue: 'seated',
        });
        remaining -= recSeconds;
      }
    }

    index += 1;
  }

  // Si per qualsevol motiu no ha sortit cap bloc, torna un unic bloc de treball
  // que la resta de la cadena quadrarà. Mai retornar buit.
  if (main.length === 0) {
    main.push({
      type: 'interval',
      duration_seconds: Math.max(30, mainSeconds),
      power_percent_ftp: clamp(midpoint, workBand),
      cadence_rpm_target: 85,
      posture_cue: 'seated',
    });
  }

  // El que sobra (si el bucle s'ha aturat) va al darrer bloc, perque la
  // cadena de qualitat quadri la durada exacta igualment.
  if (remaining > 0 && main.length > 0) {
    const last = main[main.length - 1];
    if (last.type === 'interval') {
      last.duration_seconds += remaining;
    } else {
      main.push({
        type: 'interval',
        duration_seconds: remaining,
        power_percent_ftp: clamp(midpoint, workBand),
        cadence_rpm_target: 85,
        posture_cue: 'seated',
      });
    }
  }

  return main;
}

/** Resum d'una frase, en l'estil que ja feia servir l'app. */
export function describeGeneratedWorkout(goal: TrainingGoal, totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes}-minute structured ${goal} workout with warmup and cooldown, ready to export.`;
}
