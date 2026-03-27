import { describe, expect, it } from 'bun:test';
import { WorkoutInterval } from '../types/workout';
import { rebalancePlanLoad } from './plan-load';

type PlanPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';

interface MockSession {
  id: string;
  name: string;
  summary: string;
  intervals: WorkoutInterval[];
  tss: number;
  week: number;
  sessionInWeek: number;
  phase: PlanPhase;
}

function makeSession(
  id: string,
  week: number,
  sessionInWeek: number,
  phase: PlanPhase,
  intervals: WorkoutInterval[],
): MockSession {
  return {
    id,
    name: `W${week} S${sessionInWeek}`,
    summary: 'mock',
    intervals,
    tss: 0,
    week,
    sessionInWeek,
    phase,
  };
}

describe('plan load rebalance', () => {
  it('keeps week-to-week TSS growth bounded', () => {
    const heavy: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 1800, power_percent_ftp: 120 },
      { type: 'cooldown', duration_seconds: 300, power_percent_ftp: 45 },
    ];

    const moderate: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 1800, power_percent_ftp: 95 },
      { type: 'cooldown', duration_seconds: 300, power_percent_ftp: 45 },
    ];

    const plan: MockSession[] = [
      makeSession('w1s1', 1, 1, 'Base', moderate),
      makeSession('w1s2', 1, 2, 'Base', moderate),
      makeSession('w2s1', 2, 1, 'Build', heavy),
      makeSession('w2s2', 2, 2, 'Build', heavy),
    ];

    const balanced = rebalancePlanLoad(plan, 250);

    const week1 = balanced.filter((item) => item.week === 1).reduce((sum, item) => sum + item.tss, 0);
    const week2 = balanced.filter((item) => item.week === 2).reduce((sum, item) => sum + item.tss, 0);

    expect(week2).toBeLessThanOrEqual(Math.round(week1 * 1.13));
  });

  it('reduces high-zone bias in recovery phase sessions', () => {
    const veryHard: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 60 },
      { type: 'interval', duration_seconds: 900, power_percent_ftp: 128 },
      { type: 'interval', duration_seconds: 900, power_percent_ftp: 122 },
      { type: 'cooldown', duration_seconds: 300, power_percent_ftp: 50 },
    ];

    const plan: MockSession[] = [
      makeSession('w4s1', 4, 1, 'Recovery', veryHard),
      makeSession('w4s2', 4, 2, 'Recovery', veryHard),
    ];

    const balanced = rebalancePlanLoad(plan, 250);
    const allIntervals = balanced.flatMap((item) => item.intervals);
    const highMinutes = allIntervals
      .filter((i) => i.power_percent_ftp >= 106)
      .reduce((sum, i) => sum + (i.duration_seconds / 60), 0);
    const totalMinutes = allIntervals.reduce((sum, i) => sum + (i.duration_seconds / 60), 0);

    expect(highMinutes / totalMinutes).toBeLessThanOrEqual(0.1);
  });

  it('keeps build week stronger than base when build follows recovery', () => {
    const baseModerate: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 1500, power_percent_ftp: 96 },
      { type: 'cooldown', duration_seconds: 300, power_percent_ftp: 45 },
    ];

    const recoveryEasy: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 50 },
      { type: 'interval', duration_seconds: 1200, power_percent_ftp: 62 },
      { type: 'cooldown', duration_seconds: 300, power_percent_ftp: 45 },
    ];

    const buildHard: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 1500, power_percent_ftp: 102 },
      { type: 'cooldown', duration_seconds: 300, power_percent_ftp: 45 },
    ];

    const plan: MockSession[] = [
      makeSession('w1s1', 1, 1, 'Base', baseModerate),
      makeSession('w1s2', 1, 2, 'Base', baseModerate),
      makeSession('w2s1', 2, 1, 'Recovery', recoveryEasy),
      makeSession('w2s2', 2, 2, 'Recovery', recoveryEasy),
      makeSession('w3s1', 3, 1, 'Build', buildHard),
      makeSession('w3s2', 3, 2, 'Build', buildHard),
    ];

    const balanced = rebalancePlanLoad(plan, 250);
    const week1 = balanced.filter((item) => item.week === 1).reduce((sum, item) => sum + item.tss, 0);
    const week3 = balanced.filter((item) => item.week === 3).reduce((sum, item) => sum + item.tss, 0);

    expect(week3).toBeGreaterThanOrEqual(week1);
  });
});
