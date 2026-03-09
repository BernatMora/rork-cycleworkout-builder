import { describe, expect, it } from 'bun:test';
import { WorkoutInterval } from '@/types/workout';
import { applyAdvancedTrainingMode } from './advanced-modes';

const BASE_INTERVALS: WorkoutInterval[] = [
  { type: 'warmup', duration_seconds: 300, power_percent_ftp: 55 },
  { type: 'interval', duration_seconds: 1200, power_percent_ftp: 90 },
  { type: 'cooldown', duration_seconds: 360, power_percent_ftp: 45 },
];

describe('advanced training modes', () => {
  it('generates race simulator with exact duration', () => {
    const result = applyAdvancedTrainingMode({
      mode: 'Race Simulator',
      duration: 45,
      week: 2,
      level: 'Intermediate',
      spinStyle: 'Rhythm',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'Crits',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const total = result.intervals.reduce((sum, item) => sum + item.duration_seconds, 0);
    expect(total).toBe(45 * 60);
    expect(result.summarySuffix).toContain('Race Simulator');
  });

  it('applies cadence targets in cadence intelligence mode', () => {
    const result = applyAdvancedTrainingMode({
      mode: 'Cadence Intelligence',
      duration: 45,
      week: 2,
      level: 'Intermediate',
      spinStyle: 'Rhythm',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const cadenceTargets = result.intervals
      .filter((item) => item.type !== 'warmup' && item.type !== 'cooldown')
      .map((item) => item.cadence_rpm_target)
      .filter((value): value is number => typeof value === 'number');

    expect(cadenceTargets.length).toBeGreaterThan(0);
    expect(cadenceTargets.some((value) => value === 75)).toBe(true);
    expect(cadenceTargets.some((value) => value === 90)).toBe(true);
    expect(cadenceTargets.some((value) => value === 105)).toBe(true);
  });

  it('builds spin class rhythm ride with exact duration and cadence dynamics', () => {
    const result = applyAdvancedTrainingMode({
      mode: 'Spin Class',
      duration: 45,
      week: 2,
      level: 'Intermediate',
      spinStyle: 'Rhythm',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const total = result.intervals.reduce((sum, item) => sum + item.duration_seconds, 0);
    expect(total).toBe(45 * 60);

    const cadenceTargets = result.intervals
      .map((item) => item.cadence_rpm_target)
      .filter((value): value is number => typeof value === 'number');

    expect(cadenceTargets.length).toBeGreaterThan(0);
    expect(cadenceTargets.some((value) => value <= 82)).toBe(true);
    expect(cadenceTargets.some((value) => value >= 105)).toBe(true);
    expect(result.intervals.some((item) => item.posture_cue === 'standing')).toBe(true);
    expect(result.summarySuffix).toContain('Spin Class');
    expect(result.summarySuffix).toContain('Rhythm');
  });

  it('scales spin class intensity by fitness level', () => {
    const beginner = applyAdvancedTrainingMode({
      mode: 'Spin Class',
      duration: 45,
      week: 2,
      level: 'Beginner',
      spinStyle: 'Power',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const advanced = applyAdvancedTrainingMode({
      mode: 'Spin Class',
      duration: 45,
      week: 2,
      level: 'Advanced',
      spinStyle: 'Power',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const beginnerMax = Math.max(...beginner.intervals.map((item) => item.power_percent_ftp));
    const advancedMax = Math.max(...advanced.intervals.map((item) => item.power_percent_ftp));

    expect(advancedMax).toBeGreaterThan(beginnerMax);
    expect(advanced.summarySuffix).toContain('Advanced');
    expect(beginner.summarySuffix).toContain('Beginner');
  });

  it('switches behavior across spin styles', () => {
    const climb = applyAdvancedTrainingMode({
      mode: 'Spin Class',
      duration: 45,
      week: 2,
      level: 'Intermediate',
      spinStyle: 'Climb',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const recovery = applyAdvancedTrainingMode({
      mode: 'Spin Class',
      duration: 45,
      week: 2,
      level: 'Intermediate',
      spinStyle: 'Recovery Flow',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const climbMax = Math.max(...climb.intervals.map((item) => item.power_percent_ftp));
    const recoveryMax = Math.max(...recovery.intervals.map((item) => item.power_percent_ftp));
    const climbCadenceMin = Math.min(...climb.intervals.map((item) => item.cadence_rpm_target ?? 200));

    expect(climb.summarySuffix).toContain('Climb');
    expect(recovery.summarySuffix).toContain('Recovery Flow');
    expect(climbMax).toBeGreaterThan(recoveryMax);
    expect(climbCadenceMin).toBeLessThanOrEqual(74);
  });

  it('applies spin weekly deload on week 4', () => {
    const build = applyAdvancedTrainingMode({
      mode: 'Spin Class',
      duration: 45,
      week: 3,
      level: 'Intermediate',
      spinStyle: 'Rhythm',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const deload = applyAdvancedTrainingMode({
      mode: 'Spin Class',
      duration: 45,
      week: 4,
      level: 'Intermediate',
      spinStyle: 'Rhythm',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const buildMax = Math.max(...build.intervals.map((item) => item.power_percent_ftp));
    const deloadMax = Math.max(...deload.intervals.map((item) => item.power_percent_ftp));

    expect(deloadMax).toBeLessThan(buildMax);
    expect(deload.summarySuffix).toContain('Deload');
  });

  it('softens intensity in heat stress safe mode when fatigue is high', () => {
    const normal = applyAdvancedTrainingMode({
      mode: 'Heat/Stress Safe',
      duration: 45,
      week: 2,
      level: 'Intermediate',
      spinStyle: 'Rhythm',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const fatigued = applyAdvancedTrainingMode({
      mode: 'Heat/Stress Safe',
      duration: 45,
      week: 2,
      level: 'Intermediate',
      spinStyle: 'Rhythm',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'Threshold',
      signals: { previousRpe: 9, hrDriftPercent: 9, cadenceStability: 0.7 },
    });

    const normalMax = Math.max(...normal.intervals.map((item) => item.power_percent_ftp));
    const fatiguedMax = Math.max(...fatigued.intervals.map((item) => item.power_percent_ftp));

    expect(fatiguedMax).toBeLessThanOrEqual(normalMax);
  });

  it('builds block periodization consolidation week differently', () => {
    const buildWeek = applyAdvancedTrainingMode({
      mode: 'Block Periodization',
      duration: 60,
      week: 3,
      level: 'Intermediate',
      spinStyle: 'Rhythm',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'VO2',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const consolidationWeek = applyAdvancedTrainingMode({
      mode: 'Block Periodization',
      duration: 60,
      week: 4,
      level: 'Intermediate',
      spinStyle: 'Rhythm',
      baseIntervals: BASE_INTERVALS,
      raceProfile: 'TT',
      blockFocus: 'VO2',
      signals: { previousRpe: 6, hrDriftPercent: 4, cadenceStability: 0.8 },
    });

    const buildMax = Math.max(...buildWeek.intervals.map((item) => item.power_percent_ftp));
    const consolidationMax = Math.max(...consolidationWeek.intervals.map((item) => item.power_percent_ftp));

    expect(consolidationMax).toBeLessThan(buildMax);
  });
});
