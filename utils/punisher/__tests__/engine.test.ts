import { generatePunisherWorkout } from '../engine';
import { buildWorkoutStruct } from '../ictx';
import { PunisherParams } from '../types';

const BASE_PARAMS: PunisherParams = {
  ftp: 250,
  duration: 45,
  focus: 'MIXED',
  cruelty: 9,
  seed: 42,
  maxRatio: 120,
};

describe('generatePunisherWorkout', () => {
  test('is deterministic for the same seed', () => {
    const w1 = generatePunisherWorkout(BASE_PARAMS);
    const w2 = generatePunisherWorkout(BASE_PARAMS);
    expect(w1.legs).toEqual(w2.legs);
  });

  test('produces different workouts for different seeds', () => {
    const w1 = generatePunisherWorkout({ ...BASE_PARAMS, seed: 1 });
    const w2 = generatePunisherWorkout({ ...BASE_PARAMS, seed: 9999 });
    expect(w1.legs).not.toEqual(w2.legs);
  });

  test('total duration matches requested duration', () => {
    const workout = generatePunisherWorkout(BASE_PARAMS);
    const total = workout.legs.reduce((s, l) => s + l.duration_seconds, 0);
    expect(total).toBe(BASE_PARAMS.duration * 60);
  });

  test('no leg exceeds maxRatio', () => {
    const workout = generatePunisherWorkout(BASE_PARAMS);
    for (const leg of workout.legs) {
      expect(leg.levelRatio).toBeLessThanOrEqual(BASE_PARAMS.maxRatio);
    }
  });

  test('all legs have positive duration', () => {
    const workout = generatePunisherWorkout(BASE_PARAMS);
    for (const leg of workout.legs) {
      expect(leg.duration_seconds).toBeGreaterThan(0);
    }
  });

  test('cruelty 10 produces more legs (denser) than cruelty 0', () => {
    const brutal = generatePunisherWorkout({ ...BASE_PARAMS, seed: 1, cruelty: 10 });
    const easy = generatePunisherWorkout({ ...BASE_PARAMS, seed: 1, cruelty: 0 });
    expect(brutal.legs.length).toBeGreaterThan(easy.legs.length);
  });
});

describe('buildWorkoutStruct', () => {
  test('total seconds in struct matches sum of leg durations', () => {
    const workout = generatePunisherWorkout(BASE_PARAMS);
    const struct = buildWorkoutStruct(workout.legs);

    // First token: "ratio;{totalSecs}"
    const firstToken = struct.split('-')[0];
    const [, totalSecsStr] = firstToken.split(';');
    const totalSecsInStruct = parseInt(totalSecsStr, 10);

    const sumFromLegs = workout.legs.reduce((s, l) => s + l.duration_seconds, 0);
    expect(totalSecsInStruct).toBe(sumFromLegs);
  });

  test('number of leg tokens equals number of legs', () => {
    const workout = generatePunisherWorkout(BASE_PARAMS);
    const struct = buildWorkoutStruct(workout.legs);

    const tokens = struct.split('-');
    // First token is the header (ratio;totalSecs), rest are legs
    const legTokens = tokens.slice(1);
    expect(legTokens.length).toBe(workout.legs.length);
  });

  test('each leg token encodes correct seconds', () => {
    const workout = generatePunisherWorkout(BASE_PARAMS);
    const struct = buildWorkoutStruct(workout.legs);
    const tokens = struct.split('-').slice(1);

    tokens.forEach((token, i) => {
      const [ratioStr, secsStr] = token.split(';');
      expect(parseInt(secsStr, 10)).toBe(workout.legs[i].duration_seconds);
      expect(parseInt(ratioStr, 10)).toBe(workout.legs[i].levelRatio);
    });
  });
});
