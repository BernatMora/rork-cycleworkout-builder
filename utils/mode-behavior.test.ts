import { describe, expect, it } from 'bun:test';
import { pickVariedComboForSession, resolveProgressionObjectiveOnGoalChange, VariedComboPreset } from './mode-behavior';

const COMBOS: VariedComboPreset[] = [
  { goal: 'VO2Max', style: 'Over/Under', label: 'VO2Max + Over/Under' },
  { goal: 'HIIT', style: 'Pyramid', label: 'HIIT + Pyramid' },
  { goal: 'Polarized', style: 'Intervals', label: 'Polarized + Intervals' },
  { goal: 'Cadence Skills', style: 'Over/Under', label: 'Cadence Skills + Over/Under' },
];

describe('mode behavior helpers', () => {
  it('uses deterministic combo rotation when surprise random mode is off', () => {
    const combo = pickVariedComboForSession({
      combos: COMBOS,
      globalSessionIndex: 5,
      variedComboMode: true,
      surpriseRandomPerSessionMode: false,
      random: () => 0,
    });

    expect(combo).toEqual(COMBOS[1]);
  });

  it('uses random combo selection when surprise random mode is on', () => {
    const combo = pickVariedComboForSession({
      combos: COMBOS,
      globalSessionIndex: 5,
      variedComboMode: true,
      surpriseRandomPerSessionMode: true,
      random: () => 0.74,
    });

    expect(combo).toEqual(COMBOS[2]);
  });

  it('keeps explicit progression when auto progression is disabled', () => {
    const progression = resolveProgressionObjectiveOnGoalChange({
      currentProgression: 'VO2',
      goal: 'Tempo',
      autoProgressionFromGoal: false,
    });

    expect(progression).toBe('VO2');
  });

  it('updates progression from goal when auto progression is enabled', () => {
    const progression = resolveProgressionObjectiveOnGoalChange({
      currentProgression: 'FTP',
      goal: 'Tempo',
      autoProgressionFromGoal: true,
    });

    expect(progression).toBe('Endurance');
  });
});
