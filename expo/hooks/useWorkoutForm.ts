import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TrainingGoal,
  FitnessLevel,
  WorkoutStyle,
  ProgressionObjective,
} from '@/types/workout';
import { GameRideProfile } from '@/utils/adaptive-game';
import {
  AdvancedTrainingMode,
  BlockFocus,
  RaceSimulatorProfile,
  SpinClassStyle,
} from '@/utils/advanced-modes';
import {
  STORAGE_KEYS,
  ExportFileFormat,
  EXPORT_FILENAME_TEMPLATE_PRESETS,
} from '@/constants/workout-options';
import { getDefaultProgressionObjective, resolveProgressionObjectiveOnGoalChange } from '@/utils/adaptive-v2';

export type CrazyIntensityLevel = 'Controlled' | 'Balanced' | 'Wild' | 'Insane';
export type CrazySurpriseLevel = 'Low' | 'Medium' | 'High';
export type CrazyThemePack =
  | 'Custom'
  | 'Climber Chaos'
  | 'Sprinter Riot'
  | 'Time Trial Glitch'
  | 'Diesel Nightmare'
  | 'Punchline Roulette';

export interface WorkoutFormState {
  // Basic settings
  ftp: string;
  maxHr: string;
  duration: string;
  goal: TrainingGoal;
  level: FitnessLevel;
  style: WorkoutStyle;
  progressionObjective: ProgressionObjective;
  autoProgressionFromGoal: boolean;

  // Plan settings
  planWeeks: string;
  sessionsPerWeek: string;
  selectedTrainingDays: string[];

  // Export settings
  exportFileFormat: ExportFileFormat;
  exportName: string;
  exportFilenameTemplate: string;
  workoutDisplayName: string;

  // Filename fields
  filenameGoalValue: string;
  filenameDurationValue: string;
  filenameWeekValue: string;
  filenameSessionValue: string;
  filenameDateValue: string;
  filenameWorkoutValue: string;

  // Warmup/Cooldown
  warmupMinutes: string;
  cooldownMinutes: string;
  warmupPowerPercent: string;
  cooldownPowerPercent: string;

  // Advanced training modes
  advancedTrainingMode: AdvancedTrainingMode;
  spinClassStyle: SpinClassStyle;
  raceSimulatorProfile: RaceSimulatorProfile;
  blockPeriodizationFocus: BlockFocus;

  // Game ride
  gameRideMode: boolean;
  gameRideProfile: GameRideProfile;

  // Varied/mix modes
  variedComboMode: boolean;
  singleSessionMixMode: boolean;
  surpriseRandomPerSessionMode: boolean;

  // Tri-focus
  triFocusMode: boolean;
  triFocusGoals: [TrainingGoal, TrainingGoal, TrainingGoal];

  // Crazy lab
  bossFightMode: boolean;
  diceMode: boolean;
  musicDropsMode: boolean;
  zigZagMode: boolean;
  lastMinuteTwistMode: boolean;
  crazyIntensityLevel: CrazyIntensityLevel;
  crazySurpriseLevel: CrazySurpriseLevel;
  crazyThemePack: CrazyThemePack;

  // Bkool options
  bkoolErgMode: boolean;
  bkoolConservativeMode: boolean;
  includeSpinCuesInIctx: boolean;

  // FTP test
  selectedFtpProtocol: string;
  ftpTestPowerInput: string;

  // UI state
  simpleMode: boolean;
}

const defaultFormState: WorkoutFormState = {
  ftp: '',
  maxHr: '185',
  duration: '60 min',
  goal: 'Sweet Spot',
  level: 'Intermediate',
  style: 'Intervals',
  progressionObjective: 'FTP',
  autoProgressionFromGoal: true,
  planWeeks: '1 week',
  sessionsPerWeek: '1 session',
  selectedTrainingDays: ['Tue', 'Thu', 'Sat'],
  exportFileFormat: '.ictx',
  exportName: '',
  exportFilenameTemplate: EXPORT_FILENAME_TEMPLATE_PRESETS[0],
  workoutDisplayName: '',
  filenameGoalValue: '',
  filenameDurationValue: '',
  filenameWeekValue: '',
  filenameSessionValue: '',
  filenameDateValue: '',
  filenameWorkoutValue: '',
  warmupMinutes: '5',
  cooldownMinutes: '6',
  warmupPowerPercent: '55',
  cooldownPowerPercent: '45',
  advancedTrainingMode: 'Off',
  spinClassStyle: 'Rhythm',
  raceSimulatorProfile: 'TT',
  blockPeriodizationFocus: 'Threshold',
  gameRideMode: false,
  gameRideProfile: 'Technician',
  variedComboMode: false,
  singleSessionMixMode: false,
  surpriseRandomPerSessionMode: false,
  triFocusMode: false,
  triFocusGoals: ['Sweet Spot', 'Tempo', 'VO2Max'],
  bossFightMode: false,
  diceMode: false,
  musicDropsMode: false,
  zigZagMode: false,
  lastMinuteTwistMode: false,
  crazyIntensityLevel: 'Balanced',
  crazySurpriseLevel: 'Medium',
  crazyThemePack: 'Custom',
  bkoolErgMode: true,
  bkoolConservativeMode: true,
  includeSpinCuesInIctx: true,
  selectedFtpProtocol: '20-min Test',
  ftpTestPowerInput: '',
  simpleMode: true,
};

export function useWorkoutForm() {
  const [formState, setFormState] = useState<WorkoutFormState>(defaultFormState);

  // Load saved values on mount
  useEffect(() => {
    const loadSavedValues = async () => {
      try {
        const [savedExportName, savedWorkoutName, savedFilenameTemplate, savedTrainingDays] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.EXPORT_NAME),
            AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_DISPLAY_NAME),
            AsyncStorage.getItem(STORAGE_KEYS.EXPORT_FILENAME_TEMPLATE),
            AsyncStorage.getItem(STORAGE_KEYS.TRAINING_DAYS),
          ]);

        setFormState((prev) => ({
          ...prev,
          exportName: savedExportName || '',
          workoutDisplayName: savedWorkoutName || '',
          exportFilenameTemplate: savedFilenameTemplate || EXPORT_FILENAME_TEMPLATE_PRESETS[0],
          selectedTrainingDays: savedTrainingDays
            ? JSON.parse(savedTrainingDays)
            : ['Tue', 'Thu', 'Sat'],
        }));
      } catch (error) {
        console.error('Error loading saved form values:', error);
      }
    };

    loadSavedValues();
  }, []);

  // Generic setter for any field
  const setField = useCallback(
    <K extends keyof WorkoutFormState>(field: K, value: WorkoutFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Specific setters for common fields
  const setFtp = useCallback((value: string) => setField('ftp', value), [setField]);
  const setDuration = useCallback((value: string) => setField('duration', value), [setField]);
  const setLevel = useCallback((value: FitnessLevel) => setField('level', value), [setField]);
  const setStyle = useCallback((value: WorkoutStyle) => setField('style', value), [setField]);

  // Goal setter with auto-progression update
  const setGoal = useCallback(
    (value: TrainingGoal) => {
      setFormState((prev) => {
        const newState = { ...prev, goal: value };
        if (prev.autoProgressionFromGoal) {
          newState.progressionObjective = getDefaultProgressionObjective(value);
        }
        return newState;
      });
    },
    []
  );

  // Toggle simple mode
  const toggleSimpleMode = useCallback(() => {
    setFormState((prev) => ({ ...prev, simpleMode: !prev.simpleMode }));
  }, []);

  // Save export name to AsyncStorage
  const saveExportName = useCallback(async (name: string) => {
    setField('exportName', name);
    await AsyncStorage.setItem(STORAGE_KEYS.EXPORT_NAME, name);
  }, [setField]);

  // Save workout display name to AsyncStorage
  const saveWorkoutDisplayName = useCallback(async (name: string) => {
    setField('workoutDisplayName', name);
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_DISPLAY_NAME, name);
  }, [setField]);

  // Clear saved names
  const clearSavedNames = useCallback(async () => {
    setFormState((prev) => ({
      ...prev,
      exportName: '',
      workoutDisplayName: '',
    }));
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.EXPORT_NAME),
      AsyncStorage.removeItem(STORAGE_KEYS.WORKOUT_DISPLAY_NAME),
    ]);
  }, []);

  // Save training days
  const saveTrainingDays = useCallback(async (days: string[]) => {
    setField('selectedTrainingDays', days);
    await AsyncStorage.setItem(STORAGE_KEYS.TRAINING_DAYS, JSON.stringify(days));
  }, [setField]);

  // Toggle training day
  const toggleTrainingDay = useCallback(
    (day: string) => {
      setFormState((prev) => {
        const current = prev.selectedTrainingDays;
        const newDays = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day];
        AsyncStorage.setItem(STORAGE_KEYS.TRAINING_DAYS, JSON.stringify(newDays));
        return { ...prev, selectedTrainingDays: newDays };
      });
    },
    []
  );

  // Apply quick mode preset
  const applyQuickModePreset = useCallback(
    (preset: {
      goal: TrainingGoal;
      style: WorkoutStyle;
      progression: ProgressionObjective;
      advancedTrainingMode?: AdvancedTrainingMode;
      spinStyle?: SpinClassStyle;
      raceSimulatorProfile?: RaceSimulatorProfile;
      blockFocus?: BlockFocus;
      variedMode?: boolean;
      singleMixMode?: boolean;
      gameRideMode?: boolean;
      gameRideProfile?: GameRideProfile;
      forceThreeDay45?: boolean;
      triFocusGoals?: [TrainingGoal, TrainingGoal, TrainingGoal];
      forceSingleSession?: boolean;
    }) => {
      setFormState((prev) => ({
        ...prev,
        goal: preset.goal,
        style: preset.style,
        progressionObjective: preset.progression,
        autoProgressionFromGoal: false,
        advancedTrainingMode: preset.advancedTrainingMode || 'Off',
        spinClassStyle: preset.spinStyle || 'Rhythm',
        raceSimulatorProfile: preset.raceSimulatorProfile || 'TT',
        blockPeriodizationFocus: preset.blockFocus || 'Threshold',
        variedComboMode: preset.variedMode || false,
        singleSessionMixMode: preset.singleMixMode || false,
        gameRideMode: preset.gameRideMode || false,
        gameRideProfile: preset.gameRideProfile || 'Technician',
        triFocusMode: preset.forceThreeDay45 || false,
        triFocusGoals: preset.triFocusGoals || ['Sweet Spot', 'Tempo', 'VO2Max'],
        ...(preset.forceThreeDay45 && {
          duration: '45 min',
          sessionsPerWeek: '3 sessions',
        }),
        ...(preset.forceSingleSession && {
          planWeeks: '1 week',
          sessionsPerWeek: '1 session',
        }),
      }));
    },
    []
  );

  // Validate FTP
  const validateFtp = useCallback((): boolean => {
    const ftpNum = parseInt(formState.ftp, 10);
    return !isNaN(ftpNum) && ftpNum >= 50 && ftpNum <= 500;
  }, [formState.ftp]);

  // Get FTP as number
  const getFtpNumber = useCallback((): number => {
    return parseInt(formState.ftp, 10) || 200;
  }, [formState.ftp]);

  // Get duration in minutes
  const getDurationMinutes = useCallback((): number => {
    const match = formState.duration.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 60;
  }, [formState.duration]);

  // Get plan weeks as number
  const getPlanWeeksNumber = useCallback((): number => {
    const match = formState.planWeeks.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }, [formState.planWeeks]);

  // Get sessions per week as number
  const getSessionsPerWeekNumber = useCallback((): number => {
    const match = formState.sessionsPerWeek.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }, [formState.sessionsPerWeek]);

  // Check if it's a single session plan
  const isSingleSession = useCallback((): boolean => {
    return getPlanWeeksNumber() === 1 && getSessionsPerWeekNumber() === 1;
  }, [getPlanWeeksNumber, getSessionsPerWeekNumber]);

  return {
    ...formState,
    setField,
    setFtp,
    setDuration,
    setGoal,
    setLevel,
    setStyle,
    toggleSimpleMode,
    saveExportName,
    saveWorkoutDisplayName,
    clearSavedNames,
    saveTrainingDays,
    toggleTrainingDay,
    applyQuickModePreset,
    validateFtp,
    getFtpNumber,
    getDurationMinutes,
    getPlanWeeksNumber,
    getSessionsPerWeekNumber,
    isSingleSession,
  };
}

export type WorkoutFormHook = ReturnType<typeof useWorkoutForm>;
