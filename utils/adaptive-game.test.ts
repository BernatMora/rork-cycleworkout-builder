import { describe, expect, it } from 'bun:test';
import {
  generateAdaptiveGameSession,
  generateWeeklyBossWorkout,
  getAdaptiveGameReadinessScore,
  pickWeeklyBossFocus,
} from './adaptive-game';

describe('adaptive game training system', () => {
  it('computes high readiness for strong completion and low fatigue', () => {
    const readiness = getAdaptiveGameReadinessScore({
      previousRpe: 6,
      completionRate: 0.96,
      hrDriftPercent: 2,
      cadenceStability: 0.9,
    });

    expect(readiness).toBeGreaterThanOrEqual(70);
  });

  it('forces safe branches when fatigue markers are high', () => {
    const session = generateAdaptiveGameSession({
      duration: 45,
      profile: 'Crusher',
      signals: {
        previousRpe: 9,
        completionRate: 0.9,
        hrDriftPercent: 10,
        cadenceStability: 0.8,
      },
    });

    expect(session.phases.every((phase) => phase.branch === 'safe')).toBe(true);
  });

  it('builds a full session with exact duration and warmup/cooldown', () => {
    const session = generateAdaptiveGameSession({
      duration: 60,
      profile: 'Technician',
      signals: {
        previousRpe: 6,
        completionRate: 0.88,
        hrDriftPercent: 4,
        cadenceStability: 0.82,
      },
    });

    const total = session.intervals.reduce((sum, item) => sum + item.duration_seconds, 0);
    expect(total).toBe(60 * 60);
    expect(session.intervals[0]?.type).toBe('warmup');
    expect(session.intervals[session.intervals.length - 1]?.type).toBe('cooldown');
    expect(session.phases.length).toBe(4);
  });

  it('picks weekly boss focus from highest weakness score', () => {
    const focus = pickWeeklyBossFocus({
      'VO2 Repeatability': 42,
      'Threshold Durability': 65,
      'Sprint Repeatability': 51,
      'Cadence Control': 44,
    });

    expect(focus).toBe('Threshold Durability');
  });

  it('generates weekly boss workout with exact target duration', () => {
    const boss = generateWeeklyBossWorkout({
      duration: 45,
      weaknessScores: {
        'VO2 Repeatability': 71,
        'Threshold Durability': 52,
        'Sprint Repeatability': 63,
        'Cadence Control': 40,
      },
    });

    const total = boss.intervals.reduce((sum, item) => sum + item.duration_seconds, 0);
    expect(total).toBe(45 * 60);
    expect(boss.focus).toBe('VO2 Repeatability');
  });
});
