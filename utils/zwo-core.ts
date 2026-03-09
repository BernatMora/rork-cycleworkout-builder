import { TrainingGoal, WorkoutInterval } from '@/types/workout';

const ICTX_PREVIEW_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAKoAAAAXCAYAAACbItQpAAAABHNCSVQICAgIfAhkiAAAAYxJREFUaIHt2D9IAlEcB/DvHYppNfRHBAcJ2oRcg7YgorGttSkiItodSiiKppaaGlwCoymJhsYgaC6oTYImCbIgIxLv2sSzI/rFPfOX38/24L3f+x1+ee9OC0Q+HlfnXOma+O6RZaIXALBNFSYKUuivG2iHu5llt+Y4ojWZ833x6XA9vSQ6hUrVJ8xeFkT7xOxQ9mpqYUOy5jfP0mm6IqjDkRg+nLrxfYYiUdH8Sq1HfL3Ctl3pPv+B0aAmgN7mcRmotkyxEkDsuzk+Nd4AyH9gUs1oUIvp/GvzePx23oY3ZP3FdP6lZY7nmvKpMQDgOeBWqcPxY4pUYFBJBQaVVGi8ox6MXhj4QCl5Rjup4/pgONF4Bz2rHL63rvjah7dGJjrxsJLc7pP1cSqb7tvHT5yIZluW5Uj3WSxNlkWbANhKFdx4OClctSfdxiieqKRCV/yPSm2zZqBmDmBQKUCbIzfrQdfM3o/lAF79pASDSiowqKQCg0oqMKikAoNKKjCopAKDSiowqKQCg0oqfAL8Y1MNbT+YigAAAABJRU5ErkJggg==';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function intervalToZwoTag(interval: WorkoutInterval): string {
  const power = interval.power_percent_ftp / 100;
  const duration = interval.duration_seconds;

  switch (interval.type) {
    case 'warmup':
      return `        <Warmup Duration="${duration}" PowerLow="0.25" PowerHigh="${power.toFixed(2)}"/>`;
    case 'cooldown':
      return `        <Cooldown Duration="${duration}" PowerLow="${power.toFixed(2)}" PowerHigh="0.25"/>`;
    case 'interval':
    case 'recovery':
    default:
      return `        <SteadyState Duration="${duration}" Power="${power.toFixed(2)}"/>`;
  }
}

function formatIctxDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60).toString().padStart(2, '0');
  const secs = (total % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatIctxDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getIctxLevelFromRatio(ratio: number): 'XS' | 'S' | 'M' | 'L' | 'XL' {
  if (ratio <= 50) return 'XS';
  if (ratio <= 70) return 'S';
  if (ratio <= 85) return 'M';
  if (ratio <= 100) return 'L';
  return 'XL';
}

function getIctxRpm(level: 'XS' | 'S' | 'M' | 'L' | 'XL'): number {
  switch (level) {
    case 'XS':
    case 'S':
      return 80;
    case 'M':
      return 95;
    case 'L':
      return 75;
    case 'XL':
    default:
      return 70;
  }
}

function getIctxBpm(ratio: number): number {
  return Math.max(50, Math.min(95, Math.round(45 + (ratio * 0.35))));
}

function buildIctxSequence(name: string, legs: WorkoutInterval[]): string {
  const legLines = legs.map((leg, index) => {
    const ratio = Math.max(40, Math.min(140, Math.round(leg.power_percent_ftp)));
    const level = getIctxLevelFromRatio(ratio);
    const rpm = leg.cadence_rpm_target
      ? Math.max(50, Math.min(130, Math.round(leg.cadence_rpm_target)))
      : getIctxRpm(level);
    const bpm = getIctxBpm(ratio);
    const bpmDefault = index === 0 ? 'true' : 'false';

    return [
      '      <leg>',
      `        <level>${level}</level>`,
      `        <levelRatio>${ratio}</levelRatio>`,
      `        <duration>${formatIctxDuration(leg.duration_seconds)}</duration>`,
      `        <rpm>${rpm}</rpm>`,
      `        <bpm>${bpm}</bpm>`,
      `        <bpmDefault>${bpmDefault}</bpmDefault>`,
      '      </leg>',
    ].join('\n');
  }).join('\n');

  return [
    '    <sequence>',
    `      <name>${name}</name>`,
    '      <loops>1</loops>',
    legLines,
    '    </sequence>',
  ].join('\n');
}

function getIctxPostureLabel(leg: WorkoutInterval): string {
  if (leg.posture_cue === 'standing') {
    return 'Stand';
  }
  if (leg.posture_cue === 'seated') {
    return 'Sit';
  }
  return 'Any';
}

function buildIctxMainSequencesWithPosture(mainLegs: WorkoutInterval[]): string[] {
  const safeMain = mainLegs.length > 0
    ? mainLegs
    : [{ type: 'interval' as const, duration_seconds: 20 * 60, power_percent_ftp: 70 }];

  const hasPostureCues = safeMain.some((leg) => typeof leg.posture_cue === 'string');
  if (!hasPostureCues) {
    return [buildIctxSequence('Main part', safeMain)];
  }

  const blocks: WorkoutInterval[][] = [];
  let current: WorkoutInterval[] = [];

  for (const leg of safeMain) {
    if (current.length === 0) {
      current.push(leg);
      continue;
    }

    const previous = current[current.length - 1];
    if ((previous.posture_cue ?? 'seated') === (leg.posture_cue ?? 'seated')) {
      current.push(leg);
      continue;
    }

    blocks.push(current);
    current = [leg];
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks.map((block, index) => buildIctxSequence(`Main part ${index + 1} · ${getIctxPostureLabel(block[0])}`, block));
}

export function generateIctxXml(
  intervals: WorkoutInterval[],
  workoutName: string = 'Generated Workout',
  options?: { previewImageBase64?: string; goal?: TrainingGoal; includePostureCues?: boolean }
): string {
  const safeIntervals = intervals.length > 0
    ? intervals
    : [{ type: 'interval' as const, duration_seconds: 20 * 60, power_percent_ftp: 70 }];

  const warmupLegs = safeIntervals.filter((i) => i.type === 'warmup');
  const cooldownLegs = safeIntervals.filter((i) => i.type === 'cooldown');
  const mainLegs = safeIntervals.filter((i) => i.type !== 'warmup' && i.type !== 'cooldown');

  const workoutStruct = `ratio;${safeIntervals
    .map((i) => `${Math.max(1, Math.round(i.duration_seconds))}-${Math.max(40, Math.min(140, Math.round(i.power_percent_ftp)))}`)
    .join(';')}`;
  const maxRatio = safeIntervals.reduce((max, i) => Math.max(max, Math.round(i.power_percent_ftp)), 100);
  const sequenceBlocks: string[] = [];

  if (warmupLegs.length > 0) {
    sequenceBlocks.push(buildIctxSequence('WarmUp', warmupLegs));
  }

  const includePostureCues = options?.includePostureCues ?? true;
  sequenceBlocks.push(...(includePostureCues
    ? buildIctxMainSequencesWithPosture(mainLegs)
    : [buildIctxSequence('Main part', mainLegs.length > 0 ? mainLegs : safeIntervals)]));

  if (cooldownLegs.length > 0) {
    sequenceBlocks.push(buildIctxSequence('CoolDown', cooldownLegs));
  }

  const previewImage = options?.previewImageBase64?.trim().length
    ? options.previewImageBase64.trim()
    : ICTX_PREVIEW_IMAGE_BASE64;
  const goal = options?.goal;
  const exerciseType =
    goal === 'VO2Max' || goal === 'HIIT'
      ? 'VO2MAX'
      : goal === 'Anaerobic Capacity'
        ? 'ANAEROBIC'
        : goal === 'Sprint Power'
          ? 'SPRINT'
          : goal === 'Threshold' || goal === 'Sweet Spot' || goal === 'Time Trial' || goal === 'Climbing'
            ? 'THRESHOLD'
            : goal === 'Recovery Ride'
              ? 'RECOVERY'
              : 'ENDURANCE';

  return `<?xml version="1.0" ?>
<icTrainer>
  <icTrainerExercise>
    <name>${escapeXml(workoutName)}</name>
    <code></code>
    <version>9</version>
    <sportType>Road</sportType>
    <exerciseLevel>BEGINNER</exerciseLevel>
    <exerciseType>${exerciseType}</exerciseType>
    <workoutStruct>${workoutStruct}</workoutStruct>
    <playlist></playlist>
    <lastUpdate>${formatIctxDate()}</lastUpdate>
    <startImage></startImage>
    <maxLevelRatioDisplay>${Math.max(100, Math.min(140, maxRatio))}</maxLevelRatioDisplay>
    <ratioExercise>true</ratioExercise>
    <author>Cycle Plan Builder</author>
    <image>${previewImage}</image>
    <containsVideo>false</containsVideo>
    <containsAudio>false</containsAudio>
${sequenceBlocks.join('\n')}
  </icTrainerExercise>
</icTrainer>`;
}

export function generateZwoXml(
  intervals: WorkoutInterval[],
  workoutName: string = 'Generated Workout'
): string {
  const tags = intervals.map(intervalToZwoTag).join('\n');

  return `<workout_file>
    <author>Cycle Plan Builder</author>
    <name>${escapeXml(workoutName)}</name>
    <description>Generated by Cycle Plan Builder</description>
    <sportType>bike</sportType>
    <workout>
${tags}
    </workout>
</workout_file>`;
}

export function generateMrcText(
  intervals: WorkoutInterval[],
  workoutName: string = 'Generated Workout'
): string {
  const safeIntervals = intervals.length > 0
    ? intervals
    : [{ type: 'interval' as const, duration_seconds: 20 * 60, power_percent_ftp: 70 }];

  let elapsedSeconds = 0;
  const rows: string[] = [];

  for (const interval of safeIntervals) {
    const startMinutes = elapsedSeconds / 60;
    const endMinutes = (elapsedSeconds + Math.max(1, interval.duration_seconds)) / 60;
    const intensity = Math.max(40, Math.min(200, Math.round(interval.power_percent_ftp)));
    rows.push(`${startMinutes.toFixed(2)} ${intensity}`);
    rows.push(`${endMinutes.toFixed(2)} ${intensity}`);
    elapsedSeconds += Math.max(1, interval.duration_seconds);
  }

  return [
    '[COURSE HEADER]',
    'VERSION = 2',
    'UNITS = ENGLISH',
    `DESCRIPTION = ${workoutName} (%FTP)`,
    `FILE NAME = ${workoutName}`,
    'MINUTES PERCENT',
    '[END COURSE HEADER]',
    '[COURSE DATA]',
    ...rows,
    '[END COURSE DATA]',
  ].join('\n');
}

export function generateErgText(
  intervals: WorkoutInterval[],
  ftpWatts: number = 200,
  workoutName: string = 'Generated Workout'
): string {
  const safeIntervals = intervals.length > 0
    ? intervals
    : [{ type: 'interval' as const, duration_seconds: 20 * 60, power_percent_ftp: 70 }];
  const safeFtp = Math.max(100, Math.round(ftpWatts));

  let elapsedSeconds = 0;
  const rows: string[] = [];

  for (const interval of safeIntervals) {
    const startMinutes = elapsedSeconds / 60;
    const endMinutes = (elapsedSeconds + Math.max(1, interval.duration_seconds)) / 60;
    const targetWatts = Math.max(50, Math.round((Math.max(40, interval.power_percent_ftp) / 100) * safeFtp));
    rows.push(`${startMinutes.toFixed(2)}\t${targetWatts}`);
    rows.push(`${endMinutes.toFixed(2)}\t${targetWatts}`);
    elapsedSeconds += Math.max(1, interval.duration_seconds);
  }

  return [
    '[COURSE HEADER]',
    'VERSION = 2',
    'UNITS = ENGLISH',
    `DESCRIPTION = ${workoutName}`,
    `FILE NAME = ${workoutName}`,
    `FTP = ${safeFtp}`,
    '[END COURSE HEADER]',
    '[COURSE DATA]',
    ...rows,
    '[END COURSE DATA]',
  ].join('\n');
}

export function calculateTSS(
  intervals: WorkoutInterval[],
  ftpWatts: number
): number {
  let totalNPSeconds = 0;

  for (const interval of intervals) {
    const watts = (interval.power_percent_ftp / 100) * ftpWatts;
    const normalizedPower4 = Math.pow(watts, 4) * interval.duration_seconds;
    totalNPSeconds += normalizedPower4;
  }

  const totalDuration = intervals.reduce((sum, i) => sum + i.duration_seconds, 0);
  if (totalDuration === 0) return 0;

  const avgNP = Math.pow(totalNPSeconds / totalDuration, 0.25);
  const intensityFactor = avgNP / ftpWatts;
  const tss = (totalDuration * avgNP * intensityFactor) / (ftpWatts * 3600) * 100;

  return Math.round(tss);
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export function getZoneColor(powerPercent: number): string {
  if (powerPercent < 56) return '#3B82F6';
  if (powerPercent < 76) return '#22C55E';
  if (powerPercent < 91) return '#EAB308';
  if (powerPercent < 106) return '#F97316';
  if (powerPercent < 121) return '#EF4444';
  return '#A855F7';
}

export function getZoneName(powerPercent: number): string {
  if (powerPercent < 56) return 'Z1';
  if (powerPercent < 76) return 'Z2';
  if (powerPercent < 91) return 'Z3';
  if (powerPercent < 106) return 'Z4';
  if (powerPercent < 121) return 'Z5';
  return 'Z6';
}

export function getHrRangeFromPower(powerPercent: number, maxHr: number): { low: number; high: number } {
  const zoneRanges: Array<{ maxPowerExclusive: number; lowPct: number; highPct: number }> = [
    { maxPowerExclusive: 56, lowPct: 0.55, highPct: 0.68 },
    { maxPowerExclusive: 76, lowPct: 0.69, highPct: 0.78 },
    { maxPowerExclusive: 91, lowPct: 0.79, highPct: 0.85 },
    { maxPowerExclusive: 106, lowPct: 0.86, highPct: 0.91 },
    { maxPowerExclusive: 121, lowPct: 0.92, highPct: 0.96 },
    { maxPowerExclusive: Number.POSITIVE_INFINITY, lowPct: 0.97, highPct: 1.0 },
  ];

  const range = zoneRanges.find((item) => powerPercent < item.maxPowerExclusive) ?? zoneRanges[zoneRanges.length - 1];
  return {
    low: Math.round(maxHr * range.lowPct),
    high: Math.round(maxHr * range.highPct),
  };
}

export function getRpeFromPower(powerPercent: number): string {
  if (powerPercent < 56) return '2-3';
  if (powerPercent < 76) return '3-4';
  if (powerPercent < 91) return '5-6';
  if (powerPercent < 106) return '7-8';
  if (powerPercent < 121) return '8-9';
  return '9-10';
}

export function parseZwoIntervals(xmlContent: string): WorkoutInterval[] {
  const intervals: WorkoutInterval[] = [];

  const warmupRegex = /<Warmup\s+[^>]*Duration="(\d+)"[^>]*PowerHigh="([\d.]+)"[^>]*\/>/gi;
  const cooldownRegex = /<Cooldown\s+[^>]*Duration="(\d+)"[^>]*PowerLow="([\d.]+)"[^>]*\/>/gi;
  const steadyRegex = /<SteadyState\s+[^>]*Duration="(\d+)"[^>]*Power="([\d.]+)"[^>]*\/>/gi;

  let match: RegExpExecArray | null;

  while ((match = warmupRegex.exec(xmlContent)) !== null) {
    intervals.push({
      type: 'warmup',
      duration_seconds: parseInt(match[1], 10),
      power_percent_ftp: Math.round(parseFloat(match[2]) * 100),
    });
  }

  while ((match = steadyRegex.exec(xmlContent)) !== null) {
    intervals.push({
      type: 'interval',
      duration_seconds: parseInt(match[1], 10),
      power_percent_ftp: Math.round(parseFloat(match[2]) * 100),
    });
  }

  while ((match = cooldownRegex.exec(xmlContent)) !== null) {
    intervals.push({
      type: 'cooldown',
      duration_seconds: parseInt(match[1], 10),
      power_percent_ftp: Math.round(parseFloat(match[2]) * 100),
    });
  }

  if (intervals.length > 0) {
    return intervals;
  }

  const sequenceRegex = /<sequence>([\s\S]*?)<\/sequence>/gi;
  const sequenceBlocks: Array<{ name: string; block: string }> = [];
  let sequenceMatch: RegExpExecArray | null;

  while ((sequenceMatch = sequenceRegex.exec(xmlContent)) !== null) {
    const block = sequenceMatch[1] ?? '';
    const nameMatch = block.match(/<name>\s*([^<]+?)\s*<\/name>/i);
    sequenceBlocks.push({ name: (nameMatch?.[1] ?? '').toLowerCase(), block });
  }

  const ictxIntervals: WorkoutInterval[] = [];

  for (const sequence of sequenceBlocks) {
    const legRegex = /<leg>([\s\S]*?)<\/leg>/gi;
    let legMatch: RegExpExecArray | null;

    while ((legMatch = legRegex.exec(sequence.block)) !== null) {
      const legBlock = legMatch[1] ?? '';
      const ratio = parseInt((legBlock.match(/<levelRatio>\s*(\d+)\s*<\/levelRatio>/i)?.[1] ?? '0'), 10);
      const durationRaw = legBlock.match(/<duration>\s*([^<]+)\s*<\/duration>/i)?.[1] ?? '';
      const durationMatch = durationRaw.match(/^(\d+):(\d{2})$/);
      const minutes = durationMatch ? parseInt(durationMatch[1], 10) : 0;
      const seconds = durationMatch ? parseInt(durationMatch[2], 10) : 0;
      const durationSeconds = (minutes * 60) + seconds;

      if (!ratio || !durationSeconds) {
        continue;
      }

      const type: WorkoutInterval['type'] = sequence.name.includes('warm')
        ? 'warmup'
        : sequence.name.includes('cool')
          ? 'cooldown'
          : ratio <= 62
            ? 'recovery'
            : 'interval';

      ictxIntervals.push({
        type,
        duration_seconds: durationSeconds,
        power_percent_ftp: ratio,
      });
    }
  }

  if (ictxIntervals.length > 0) {
    return ictxIntervals;
  }

  return intervals;
}
