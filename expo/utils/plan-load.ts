import { WorkoutInterval } from '@/types/workout';
import { calculateTSS } from './zwo-core';

type PlanPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';

interface PlanSessionLike {
  id: string;
  name: string;
  summary: string;
  intervals: WorkoutInterval[];
  tss: number;
  week: number;
  sessionInWeek: number;
  phase: PlanPhase;
  dayLabel?: string;
  tssCapped?: boolean;
}

interface ZoneMinutes {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
  z6: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cloneIntervals(intervals: WorkoutInterval[]): WorkoutInterval[] {
  return intervals.map((interval) => ({ ...interval }));
}

function getZoneMinutes(intervals: WorkoutInterval[]): ZoneMinutes {
  const zoneMinutes: ZoneMinutes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };

  for (const interval of intervals) {
    const mins = interval.duration_seconds / 60;
    if (interval.power_percent_ftp < 56) zoneMinutes.z1 += mins;
    else if (interval.power_percent_ftp < 76) zoneMinutes.z2 += mins;
    else if (interval.power_percent_ftp < 91) zoneMinutes.z3 += mins;
    else if (interval.power_percent_ftp < 106) zoneMinutes.z4 += mins;
    else if (interval.power_percent_ftp < 121) zoneMinutes.z5 += mins;
    else zoneMinutes.z6 += mins;
  }

  return zoneMinutes;
}

function getPhaseTargets(phase: PlanPhase): { highShareCap: number; easyShareMin: number } {
  if (phase === 'Recovery') {
    return { highShareCap: 0.06, easyShareMin: 0.72 };
  }

  if (phase === 'Base') {
    return { highShareCap: 0.14, easyShareMin: 0.55 };
  }

  if (phase === 'Build') {
    return { highShareCap: 0.2, easyShareMin: 0.45 };
  }

  return { highShareCap: 0.24, easyShareMin: 0.38 };
}

function applyPhasePowerBounds(interval: WorkoutInterval, phase: PlanPhase): WorkoutInterval {
  if (interval.type === 'warmup') {
    return {
      ...interval,
      power_percent_ftp: clamp(interval.power_percent_ftp, 40, phase === 'Recovery' ? 70 : 85),
    };
  }

  if (interval.type === 'cooldown') {
    return {
      ...interval,
      power_percent_ftp: clamp(interval.power_percent_ftp, 35, 70),
    };
  }

  if (interval.type === 'recovery') {
    return {
      ...interval,
      power_percent_ftp: clamp(interval.power_percent_ftp, 40, phase === 'Recovery' ? 62 : 75),
    };
  }

  if (phase === 'Recovery') {
    return {
      ...interval,
      power_percent_ftp: clamp(interval.power_percent_ftp, 50, 95),
    };
  }

  if (phase === 'Base') {
    return {
      ...interval,
      power_percent_ftp: clamp(interval.power_percent_ftp, 55, 130),
    };
  }

  if (phase === 'Build') {
    return {
      ...interval,
      power_percent_ftp: clamp(interval.power_percent_ftp, 55, 150),
    };
  }

  return {
    ...interval,
    power_percent_ftp: clamp(interval.power_percent_ftp, 55, 165),
  };
}

function nudgeWeekTowardZoneTargets(intervals: WorkoutInterval[], phase: PlanPhase): WorkoutInterval[] {
  const adjusted = cloneIntervals(intervals).map((interval) => applyPhasePowerBounds(interval, phase));
  const { highShareCap, easyShareMin } = getPhaseTargets(phase);

  for (let step = 0; step < 4; step += 1) {
    const zone = getZoneMinutes(adjusted);
    const total = zone.z1 + zone.z2 + zone.z3 + zone.z4 + zone.z5 + zone.z6;
    if (total <= 0) {
      return adjusted;
    }

    const highShare = (zone.z5 + zone.z6) / total;
    const easyShare = (zone.z1 + zone.z2) / total;

    if (highShare <= highShareCap && easyShare >= easyShareMin) {
      break;
    }

    for (let i = 0; i < adjusted.length; i += 1) {
      const interval = adjusted[i];
      if (interval.type === 'warmup' || interval.type === 'cooldown') {
        continue;
      }

      if (highShare > highShareCap && interval.power_percent_ftp >= 106) {
        adjusted[i] = {
          ...interval,
          power_percent_ftp: clamp(Math.round(interval.power_percent_ftp * 0.95), 40, 170),
        };
        continue;
      }

      if (easyShare < easyShareMin && interval.type !== 'recovery' && interval.power_percent_ftp >= 91) {
        adjusted[i] = {
          ...interval,
          power_percent_ftp: clamp(Math.round(interval.power_percent_ftp * 0.96), 40, 170),
        };
      }
    }
  }

  return adjusted;
}

function scaleWeekLoad(intervals: WorkoutInterval[], factor: number): WorkoutInterval[] {
  return intervals.map((interval) => {
    if (interval.type === 'warmup' || interval.type === 'cooldown') {
      return interval;
    }

    return {
      ...interval,
      power_percent_ftp: clamp(Math.round(interval.power_percent_ftp * factor), 35, 170),
    };
  });
}

export function rebalancePlanLoad<T extends PlanSessionLike>(plan: T[], ftpWatts: number): T[] {
  if (plan.length <= 1 || !ftpWatts || ftpWatts < 50) {
    return plan;
  }

  const byWeek = new Map<number, T[]>();
  for (const session of plan) {
    const existing = byWeek.get(session.week) ?? [];
    existing.push({ ...session, intervals: cloneIntervals(session.intervals) } as T);
    byWeek.set(session.week, existing);
  }

  const weeks = Array.from(byWeek.keys()).sort((a, b) => a - b);
  let previousWeekTss = 0;
  let previousWeekPhase: PlanPhase | undefined;
  let previousNonRecoveryWeekTss = 0;

  for (const week of weeks) {
    const sessions = (byWeek.get(week) ?? []).sort((a, b) => a.sessionInWeek - b.sessionInWeek);
    if (sessions.length === 0) {
      continue;
    }

    const phase = sessions[0].phase;

    for (let i = 0; i < sessions.length; i += 1) {
      sessions[i] = {
        ...sessions[i],
        intervals: nudgeWeekTowardZoneTargets(sessions[i].intervals, phase),
      };
    }

    let currentWeekTss = sessions.reduce((sum, session) => sum + calculateTSS(session.intervals, ftpWatts), 0);

    if (previousWeekTss > 0) {
      const anchorWeekTss = (phase === 'Build' && previousWeekPhase === 'Recovery' && previousNonRecoveryWeekTss > 0)
        ? previousNonRecoveryWeekTss
        : previousWeekTss;

      const maxMultiplier = phase === 'Recovery' ? 0.82 : phase === 'Peak' ? 1.1 : 1.13;
      const minMultiplier = phase === 'Recovery' ? 0.65 : 0.86;
      const maxAllowed = Math.round(anchorWeekTss * maxMultiplier);
      const minAllowed = Math.round(anchorWeekTss * minMultiplier);

      if (currentWeekTss > maxAllowed) {
        const factor = clamp(maxAllowed / Math.max(currentWeekTss, 1), 0.82, 0.99);
        for (let i = 0; i < sessions.length; i += 1) {
          sessions[i] = {
            ...sessions[i],
            intervals: scaleWeekLoad(sessions[i].intervals, factor),
          };
        }
        currentWeekTss = sessions.reduce((sum, session) => sum + calculateTSS(session.intervals, ftpWatts), 0);
      } else if (phase !== 'Recovery' && currentWeekTss < minAllowed) {
        const factor = clamp(minAllowed / Math.max(currentWeekTss, 1), 1.01, 1.08);
        for (let i = 0; i < sessions.length; i += 1) {
          sessions[i] = {
            ...sessions[i],
            intervals: scaleWeekLoad(sessions[i].intervals, factor),
          };
        }
        currentWeekTss = sessions.reduce((sum, session) => sum + calculateTSS(session.intervals, ftpWatts), 0);
      }
    }

    previousWeekTss = currentWeekTss;
    previousWeekPhase = phase;
    if (phase !== 'Recovery') {
      previousNonRecoveryWeekTss = currentWeekTss;
    }

    for (let i = 0; i < sessions.length; i += 1) {
      sessions[i] = {
        ...sessions[i],
        tss: calculateTSS(sessions[i].intervals, ftpWatts),
      };
    }

    byWeek.set(week, sessions);
  }

  const flattened = weeks.flatMap((week) => byWeek.get(week) ?? []);
  return flattened as T[];
}
