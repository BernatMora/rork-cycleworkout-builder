import { describe, expect, it, mock } from 'bun:test';
import { TrainingGoal } from '@/types/workout';

// El modul del generador importa el SDK d'IA, que arrossega react-native (i el
// seu index.js.flow no es pot parsejar fora de Metro). El generador LOCAL no el
// fa servir per a res, aixi que es substitueix per un mock abans d'importar.
mock.module('@rork-ai/toolkit-sdk', () => ({
  generateObject: async () => {
    throw new Error('la IA no s\'ha de cridar en aquests tests');
  },
}));

const { buildVariedMain } = await import('./workout-generator-local');
const { generateWorkoutLocally } = await import('./workout-generator');

const GOALS: TrainingGoal[] = [
  'Endurance (Z2)', 'Tempo', 'Sweet Spot', 'Threshold', 'VO2Max',
  'Anaerobic Capacity', 'Sprint Power', 'HIIT', 'Climbing', 'Time Trial',
  'Polarized', 'Recovery Ride', 'Race Prep', 'Cadence Skills', 'Muscular Endurance',
];

describe('generador local', () => {
  it('la part principal no te dos intervals de treball iguals', () => {
    const main = buildVariedMain(2400, 'Threshold', 'Intervals', 'Intermediate');
    const works = main.filter((i) => i.type === 'interval');

    expect(works.length).toBeGreaterThan(2);
    const signatures = works.map((w) => `${w.duration_seconds}-${w.power_percent_ftp}`);
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('la potencia de la part principal cau dins la banda de l\'objectiu', () => {
    const bands: Partial<Record<TrainingGoal, [number, number]>> = {
      'Sweet Spot': [84, 97],
      VO2Max: [106, 120],
      'Sprint Power': [130, 170],
      'Recovery Ride': [45, 65],
    };

    for (const [goal, band] of Object.entries(bands) as [TrainingGoal, [number, number]][]) {
      const main = buildVariedMain(1800, goal, 'Intervals', 'Intermediate');
      const powers = main.filter((i) => i.type === 'interval').map((i) => i.power_percent_ftp);
      expect(powers.length).toBeGreaterThan(0);
      for (const p of powers) {
        expect(p).toBeGreaterThanOrEqual(band[0]);
        expect(p).toBeLessThanOrEqual(band[1]);
      }
    }
  });

  it('quadra la durada exacta per a tots els objectius i durades', () => {
    for (const goal of GOALS) {
      for (const duration of [30, 45, 60, 90] as const) {
        const result = generateWorkoutLocally({
          ftp: 250,
          duration,
          goal,
          level: 'Intermediate',
          style: 'Intervals',
          warmupMinutes: 5,
          cooldownMinutes: 5,
          warmupPowerPercent: 55,
          cooldownPowerPercent: 45,
        });

        const total = result.intervals.reduce((sum, i) => sum + i.duration_seconds, 0);
        expect(total).toBe(duration * 60);

        // Sempre amb escalfament, refredament i cos
        expect(result.intervals[0].type).toBe('warmup');
        expect(result.intervals[result.intervals.length - 1].type).toBe('cooldown');
        expect(result.intervals.length).toBeGreaterThan(3);
      }
    }
  });

  it('les repeticions porten postura i cadencia, i no son totes iguals', () => {
    const result = generateWorkoutLocally({
      ftp: 250,
      duration: 60,
      goal: 'VO2Max',
      level: 'Advanced',
      style: 'Intervals',
      warmupMinutes: 5,
      cooldownMinutes: 5,
      warmupPowerPercent: 55,
      cooldownPowerPercent: 45,
    });

    const works = result.intervals.filter((i) => i.type === 'interval');
    expect(works.every((w) => w.posture_cue === 'seated')).toBe(true);
    expect(new Set(works.map((w) => w.cadence_rpm_target)).size).toBeGreaterThan(1);
  });

  it('el nivell mou la intensitat cap amunt', () => {
    const base = {
      ftp: 250, duration: 60 as const, goal: 'Threshold' as TrainingGoal,
      style: 'Intervals' as const, warmupMinutes: 5, cooldownMinutes: 5,
      warmupPowerPercent: 55, cooldownPowerPercent: 45,
    };

    const avg = (level: 'Beginner' | 'Advanced') => {
      const works = generateWorkoutLocally({ ...base, level }).intervals
        .filter((i) => i.type === 'interval');
      return works.reduce((s, w) => s + w.power_percent_ftp, 0) / works.length;
    };

    expect(avg('Advanced')).toBeGreaterThan(avg('Beginner'));
  });
});
