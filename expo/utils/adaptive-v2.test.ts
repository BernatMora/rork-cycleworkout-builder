import { describe, expect, it } from 'bun:test';
import { getAdaptiveSessionV2, getDefaultProgressionObjective } from './adaptive-v2';

describe('adaptive v2 progression', () => {
  it('chooses Endurance objective by default for endurance-like goals', () => {
    expect(getDefaultProgressionObjective('Endurance (Z2)')).toBe('Endurance');
    expect(getDefaultProgressionObjective('Recovery Ride')).toBe('Endurance');
  });

  it('applies recovery deload in recovery phase', () => {
    const result = getAdaptiveSessionV2({
      objective: 'FTP',
      baseDuration: 60,
      baseGoal: 'Sweet Spot',
      baseStyle: 'Intervals',
      level: 'Intermediate',
      phase: 'Recovery',
      week: 4,
      totalWeeks: 8,
      sessionInWeek: 2,
      sessionsPerWeek: 3,
    });

    expect(result.goal).toBe('Recovery Ride');
    expect(result.style).toBe('Steady');
    expect(result.duration).toBeLessThanOrEqual(45);
    expect(result.intensityAdjustmentPercent).toBeLessThan(0);
  });

  it('increases endurance long-ride duration later in plan', () => {
    const result = getAdaptiveSessionV2({
      objective: 'Endurance',
      baseDuration: 60,
      baseGoal: 'Endurance (Z2)',
      baseStyle: 'Steady',
      level: 'Intermediate',
      phase: 'Build',
      week: 6,
      totalWeeks: 8,
      sessionInWeek: 3,
      sessionsPerWeek: 3,
    });

    expect(result.goal).toBe('Tempo');
    expect(result.duration).toBeGreaterThanOrEqual(75);
  });

  it('assigns high-intensity VO2 structure and positive progression', () => {
    const result = getAdaptiveSessionV2({
      objective: 'VO2',
      baseDuration: 60,
      baseGoal: 'VO2Max',
      baseStyle: 'Intervals',
      level: 'Advanced',
      phase: 'Build',
      week: 5,
      totalWeeks: 8,
      sessionInWeek: 2,
      sessionsPerWeek: 4,
    });

    expect(['VO2Max', 'HIIT', 'Anaerobic Capacity']).toContain(result.goal);
    expect(['Intervals', 'Over/Under']).toContain(result.style);
    expect(result.intensityAdjustmentPercent).toBeGreaterThan(0);
  });

  it('keeps build weeks harder than recovery weeks for same objective/session slot', () => {
    const build = getAdaptiveSessionV2({
      objective: 'FTP',
      baseDuration: 60,
      baseGoal: 'Sweet Spot',
      baseStyle: 'Intervals',
      level: 'Intermediate',
      phase: 'Build',
      week: 5,
      totalWeeks: 8,
      sessionInWeek: 2,
      sessionsPerWeek: 3,
    });

    const recovery = getAdaptiveSessionV2({
      objective: 'FTP',
      baseDuration: 60,
      baseGoal: 'Sweet Spot',
      baseStyle: 'Intervals',
      level: 'Intermediate',
      phase: 'Recovery',
      week: 4,
      totalWeeks: 8,
      sessionInWeek: 2,
      sessionsPerWeek: 3,
    });

    expect(build.intensityAdjustmentPercent).toBeGreaterThan(recovery.intensityAdjustmentPercent);
    expect(build.duration).toBeGreaterThanOrEqual(recovery.duration);
  });

  it('uses race-specific focus in FTP peak phase', () => {
    const peak = getAdaptiveSessionV2({
      objective: 'FTP',
      baseDuration: 60,
      baseGoal: 'Threshold',
      baseStyle: 'Intervals',
      level: 'Advanced',
      phase: 'Peak',
      week: 8,
      totalWeeks: 8,
      sessionInWeek: 1,
      sessionsPerWeek: 3,
    });

    expect(['Race Prep', 'Threshold']).toContain(peak.goal);
    expect(['Pyramid', 'Over/Under']).toContain(peak.style);
  });
});
