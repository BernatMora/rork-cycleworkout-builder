import {
  PunisherLeg,
  PunisherLegType,
  PunisherParams,
  PunisherPreset,
  PunisherWorkout,
} from './types';

// ---------------------------------------------------------------------------
// Seeded deterministic PRNG (Mulberry32)
// ---------------------------------------------------------------------------
class SeededRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.s |= 0;
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Random integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Random float in [min, max] */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Pick a random element */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clampRatio(value: number, max: number): number {
  return Math.min(Math.round(value), max);
}

function warmupLegs(rng: SeededRNG, cruelty: number): PunisherLeg[] {
  const totalSeconds = Math.round((5 - cruelty * 0.3) * 60);
  const clamped = Math.max(totalSeconds, 120);
  const numLegs = 3;
  const legDur = Math.round(clamped / numLegs);

  const ratios = [50, 65, 78];
  const rpms = [82, 88, 92];

  return ratios.map((ratio, i) => ({
    type: 'warmup' as PunisherLegType,
    duration_seconds: legDur,
    levelRatio: ratio,
    rpm: rpms[i],
  }));
}

function cooldownLegs(rng: SeededRNG, cruelty: number): PunisherLeg[] {
  const totalSeconds = Math.round((4 - cruelty * 0.2) * 60);
  const clamped = Math.max(totalSeconds, 120);
  const numLegs = 3;
  const legDur = Math.round(clamped / numLegs);

  const ratios = [72, 58, 44];
  const rpms = [84, 80, 76];

  return ratios.map((ratio, i) => ({
    type: 'cooldown' as PunisherLegType,
    duration_seconds: legDur,
    levelRatio: ratio,
    rpm: rpms[i],
  }));
}

// Tabata finisher: 8 rounds × (20 s spin + 10 s torque-punch)
function finisherLegs(rng: SeededRNG, maxRatio: number, cruelty: number): PunisherLeg[] {
  const legs: PunisherLeg[] = [];
  const rounds = 4 + Math.round(cruelty * 0.4); // 4–8 rounds (cruelty 0–10)
  for (let i = 0; i < rounds; i++) {
    legs.push({
      type: 'spin',
      duration_seconds: 20,
      levelRatio: clampRatio(rng.int(95, 115), maxRatio),
      rpm: rng.int(115, 128),
    });
    legs.push({
      type: 'torque',
      duration_seconds: 10,
      levelRatio: clampRatio(rng.int(105, 130), maxRatio),
      rpm: rng.int(55, 65),
    });
  }
  return legs;
}

interface BodyConfig {
  spinDur: [number, number];
  torqueDur: [number, number];
  recovDur: [number, number];
  spinRatio: [number, number];
  torqueRatio: [number, number];
  recovRatio: [number, number];
  spinRpm: [number, number];
  torqueRpm: [number, number];
  recovRpm: [number, number];
}

function getBodyConfig(focus: PunisherParams['focus'], cruelty: number): BodyConfig {
  const c = cruelty;

  // Base ranges; cruelty amplifies peaks and shortens recoveries
  const spinDur: [number, number] = [12, 35 + Math.round(c * 1)]; // 12–35..45
  const torqueDur: [number, number] = [8, 20 + Math.round(c * 0.8)]; // 8–20..28
  const recovDur: [number, number] = [
    Math.max(8, 20 - Math.round(c * 1.2)),
    Math.max(10, 30 - Math.round(c * 2)),
  ];

  // Spin: high cadence, moderate power
  const spinRatio: [number, number] = [72, 100 + Math.round(c * 2)]; // 72–100..120
  const spinRpm: [number, number] = [108, 130];

  // Torque: low cadence, high power
  const torqueRatio: [number, number] = [90 + Math.round(c * 3), 120 + Math.round(c * 5)]; // 90..120 – 120..170
  const torqueRpm: [number, number] = [52, 70];

  // Recovery (fake — still spinning)
  const recovRatio: [number, number] = [58, 82];
  const recovRpm: [number, number] = [85, 100];

  const base: BodyConfig = {
    spinDur,
    torqueDur,
    recovDur,
    spinRatio,
    torqueRatio,
    recovRatio,
    spinRpm,
    torqueRpm,
    recovRpm,
  };

  // Focus adjustments
  if (focus === 'CADENCE') {
    base.spinDur = [18, 45];
    base.torqueDur = [8, 14];
    base.spinRpm = [115, 132];
  } else if (focus === 'TORQUE') {
    base.torqueDur = [14, 28];
    base.spinDur = [8, 20];
    base.torqueRpm = [48, 65];
    base.torqueRatio = [95 + Math.round(c * 4), 130 + Math.round(c * 5)];
  } else if (focus === 'OVER_UNDER') {
    // Over: above threshold; Under: just below threshold
    base.spinRatio = [88, 105]; // under
    base.torqueRatio = [106 + Math.round(c * 3), 135 + Math.round(c * 3)]; // over
    base.spinDur = [20, 40];
    base.torqueDur = [15, 30];
  }

  return base;
}

/**
 * Returns the probability of picking a torque block (vs spin) for the given focus.
 * CADENCE → mostly spin; TORQUE → mostly torque; MIXED → 50/50; OVER_UNDER → 50/50
 */
function torqueProbability(focus: PunisherParams['focus']): number {
  switch (focus) {
    case 'CADENCE': return 0.25;
    case 'TORQUE': return 0.70;
    case 'MIXED': return 0.50;
    case 'OVER_UNDER': return 0.50;
  }
}

function buildBody(
  rng: SeededRNG,
  budgetSeconds: number,
  params: PunisherParams,
): PunisherLeg[] {
  const cfg = getBodyConfig(params.focus, params.cruelty);
  const torqueProb = torqueProbability(params.focus);
  const legs: PunisherLeg[] = [];
  let remaining = budgetSeconds;

  while (remaining > 20) {
    const isTorque = rng.next() < torqueProb;

    if (isTorque) {
      // Torque punch
      const dur = Math.min(rng.int(cfg.torqueDur[0], cfg.torqueDur[1]), remaining);
      legs.push({
        type: 'torque',
        duration_seconds: dur,
        levelRatio: clampRatio(rng.float(cfg.torqueRatio[0], cfg.torqueRatio[1]), params.maxRatio),
        rpm: rng.int(cfg.torqueRpm[0], cfg.torqueRpm[1]),
      });
      remaining -= dur;
    } else {
      // Spin chunk
      const dur = Math.min(rng.int(cfg.spinDur[0], cfg.spinDur[1]), remaining);
      legs.push({
        type: 'spin',
        duration_seconds: dur,
        levelRatio: clampRatio(rng.float(cfg.spinRatio[0], cfg.spinRatio[1]), params.maxRatio),
        rpm: rng.int(cfg.spinRpm[0], cfg.spinRpm[1]),
      });
      remaining -= dur;
    }

    if (remaining <= 20) break;

    // Recovery after each work interval
    const recovDur = Math.min(
      rng.int(cfg.recovDur[0], cfg.recovDur[1]),
      remaining,
    );
    if (recovDur > 0) {
      legs.push({
        type: 'recovery',
        duration_seconds: recovDur,
        levelRatio: clampRatio(rng.float(cfg.recovRatio[0], cfg.recovRatio[1]), params.maxRatio),
        rpm: rng.int(cfg.recovRpm[0], cfg.recovRpm[1]),
      });
      remaining -= recovDur;
    }
  }

  return legs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generatePunisherWorkout(params: PunisherParams): PunisherWorkout {
  const rng = new SeededRNG(params.seed);

  const warmup = warmupLegs(rng, params.cruelty);
  const cooldown = cooldownLegs(rng, params.cruelty);
  const finisher = finisherLegs(rng, params.maxRatio, params.cruelty);

  const warmupSec = warmup.reduce((s, l) => s + l.duration_seconds, 0);
  const cooldownSec = cooldown.reduce((s, l) => s + l.duration_seconds, 0);
  const finisherSec = finisher.reduce((s, l) => s + l.duration_seconds, 0);

  const totalSec = params.duration * 60;
  const bodySec = Math.max(0, totalSec - warmupSec - cooldownSec - finisherSec);

  const body = buildBody(rng, bodySec, params);

  // Reconcile: if body is short, adjust last cooldown leg
  const allLegs = [...warmup, ...body, ...finisher, ...cooldown];
  const actualTotal = allLegs.reduce((s, l) => s + l.duration_seconds, 0);
  const diff = totalSec - actualTotal;
  if (diff !== 0 && allLegs.length > 0) {
    const last = allLegs[allLegs.length - 1];
    last.duration_seconds = Math.max(5, last.duration_seconds + diff);
  }

  return {
    legs: allLegs,
    params,
    name: `Punisher ${params.duration}' · Cruelty ${params.cruelty} · ${params.focus}`,
    createdAt: Date.now(),
  };
}

export const PUNISHER_PRESETS: PunisherPreset[] = [
  {
    id: 'bkool_short',
    label: 'Bkool Baseline – Short',
    description: '30 min, max cruelty, MIXED',
    params: { duration: 30, cruelty: 10, focus: 'MIXED', maxRatio: 120 },
  },
  {
    id: 'bkool_standard',
    label: 'Bkool Baseline – Standard',
    description: '45 min, cruelty 9, MIXED',
    params: { duration: 45, cruelty: 9, focus: 'MIXED', maxRatio: 120 },
  },
  {
    id: 'bkool_torque',
    label: 'Bkool Baseline – Torque',
    description: '45 min, cruelty 8, TORQUE focus',
    params: { duration: 45, cruelty: 8, focus: 'TORQUE', maxRatio: 130 },
  },
  {
    id: 'bkool_cadence',
    label: 'Bkool Baseline – Cadence',
    description: '45 min, cruelty 8, CADENCE focus',
    params: { duration: 45, cruelty: 8, focus: 'CADENCE', maxRatio: 110 },
  },
];
