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

// Duration options
export const DURATIONS: string[] = ['30 min', '45 min', '60 min', '75 min', '90 min'];

// Training goals
export const GOALS: TrainingGoal[] = [
  'Endurance (Z2)',
  'Tempo',
  'Sweet Spot',
  'Threshold',
  'VO2Max',
  'Anaerobic Capacity',
  'Sprint Power',
  'HIIT',
  'Climbing',
  'Time Trial',
  'Polarized',
  'Recovery Ride',
  'Race Prep',
  'Cadence Skills',
  'Muscular Endurance',
];

// Fitness levels
export const LEVELS: FitnessLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

// Workout styles
export const STYLES: WorkoutStyle[] = ['Steady', 'Intervals', 'Pyramid', 'Over/Under'];

// Game ride profiles
export const GAME_RIDE_PROFILES: GameRideProfile[] = ['Explorer', 'Crusher', 'Technician'];

// Advanced training modes
export const ADVANCED_TRAINING_MODES: AdvancedTrainingMode[] = [
  'Off',
  'Race Simulator',
  'Spin Class',
  'Cadence Intelligence',
  'Heat/Stress Safe',
  'Micro-dose',
  'Skills Day',
  'Block Periodization',
];

// Race simulator profiles
export const RACE_SIMULATOR_PROFILES: RaceSimulatorProfile[] = ['TT', 'Crits', 'Gran Fondo'];

// Spin class styles
export const SPIN_CLASS_STYLES: SpinClassStyle[] = ['Rhythm', 'Climb', 'Power', 'Recovery Flow'];

// Block periodization focus options
export const BLOCK_PERIODIZATION_FOCUS_OPTIONS: BlockFocus[] = ['VO2', 'Threshold'];

// Plan duration options
export const WEEKS: string[] = ['1 week', '2 weeks', '3 weeks', '4 weeks', '6 weeks', '8 weeks'];

// Sessions per week options
export const SESSIONS_PER_WEEK: string[] = [
  '1 session',
  '2 sessions',
  '3 sessions',
  '4 sessions',
  '5 sessions',
  '6 sessions',
];

// Export file formats
export const EXPORT_FILE_FORMATS = ['.ictx', '.zwo', '.mrc', '.erg', '.ictx+.zwo'] as const;

export const EXPORT_FORMAT_LABELS: Record<(typeof EXPORT_FILE_FORMATS)[number], string> = {
  '.ictx': 'ICTX (.ictx)',
  '.zwo': 'ZWO (.zwo)',
  '.mrc': 'MRC (.mrc)',
  '.erg': 'ERG (.erg)',
  '.ictx+.zwo': 'Dual (.ictx + .zwo)',
};

// Filename template presets
export const EXPORT_FILENAME_TEMPLATE_PRESETS = [
  '{{goal}}_{{duration}}_{{date}}',
  '{{goal}}_w{{week}}_s{{session}}_{{date}}',
  '{{workout}}_{{date}}',
] as const;

// FTP test protocols
export const FTP_TEST_PROTOCOLS = ['Ramp Test', '20-min Test', '8-min x2 Test'] as const;

// Weekday options
export const WEEKDAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Storage keys
export const STORAGE_KEYS = {
  WORKOUT_DISPLAY_NAME: 'ictrainer_workout_display_name',
  EXPORT_NAME: 'ictrainer_export_name',
  EXPORT_FILENAME_TEMPLATE: 'ictrainer_export_filename_template',
  APP_LANGUAGE: 'ictrainer_app_language',
  EXPORT_HISTORY: 'ictrainer_export_history',
  SESSION_FAVORITES: 'ictrainer_session_favorites',
  ADAPTIVE_FEEDBACK: 'ictrainer_adaptive_feedback',
  TRAINING_DAYS: 'ictrainer_training_days',
  SESSION_EXECUTION_LOG: 'ictrainer_session_execution_log',
  PLAN: 'ictrainer_plan',
  SELECTED_PLAN_WORKOUT: 'ictrainer_selected_plan_workout_id',
  COMPLETED_SESSIONS: 'ictrainer_completed_sessions',
} as const;

// Type exports
export type ExportFileFormat = (typeof EXPORT_FILE_FORMATS)[number];
export type ExportSingleFileFormat = Exclude<ExportFileFormat, '.ictx+.zwo'>;
export type FtpTestProtocol = (typeof FTP_TEST_PROTOCOLS)[number];
export type Weekday = (typeof WEEKDAY_OPTIONS)[number];

// Varied combos for 4-combo mode
export interface VariedCombo {
  goal: TrainingGoal;
  style: WorkoutStyle;
  label: string;
}

export const VARIED_COMBOS: VariedCombo[] = [
  { goal: 'VO2Max', style: 'Over/Under', label: 'VO2Max + Over/Under' },
  { goal: 'HIIT', style: 'Pyramid', label: 'HIIT + Pyramid' },
  { goal: 'Polarized', style: 'Intervals', label: 'Polarized + Intervals' },
  { goal: 'Cadence Skills', style: 'Over/Under', label: 'Cadence Skills + Over/Under' },
];

// Quick mode presets
export interface QuickModePreset {
  id: string;
  label: string;
  goal: TrainingGoal;
  style: WorkoutStyle;
  progression: ProgressionObjective;
  variedMode?: boolean;
  singleMixMode?: boolean;
  gameRideMode?: boolean;
  gameRideProfile?: GameRideProfile;
  advancedTrainingMode?: AdvancedTrainingMode;
  spinStyle?: SpinClassStyle;
  raceSimulatorProfile?: RaceSimulatorProfile;
  blockFocus?: BlockFocus;
  forceSingleSession?: boolean;
  forceThreeDay45?: boolean;
  triFocusGoals?: [TrainingGoal, TrainingGoal, TrainingGoal];
}

export const NORMAL_MODE_PRESETS: QuickModePreset[] = [
  {
    id: 'normal_endurance',
    label: 'Endurance Base',
    goal: 'Endurance (Z2)',
    style: 'Steady',
    progression: 'Endurance',
  },
  {
    id: 'normal_ftp',
    label: 'FTP Builder',
    goal: 'Sweet Spot',
    style: 'Intervals',
    progression: 'FTP',
  },
  {
    id: 'normal_threshold',
    label: 'Threshold Focus',
    goal: 'Threshold',
    style: 'Over/Under',
    progression: 'FTP',
  },
  {
    id: 'normal_tempo',
    label: 'Tempo Flow',
    goal: 'Tempo',
    style: 'Pyramid',
    progression: 'Endurance',
  },
];

export const BALANCED_MODE_PRESETS: QuickModePreset[] = [
  {
    id: 'balanced_tri_focus_45',
    label: 'Tri-Focus 45 (3d)',
    goal: 'Sweet Spot',
    style: 'Intervals',
    progression: 'FTP',
    forceThreeDay45: true,
    triFocusGoals: ['Sweet Spot', 'Tempo', 'VO2Max'],
  },
  {
    id: 'balanced_race_ready_45',
    label: 'Race-Ready 45 (3d)',
    goal: 'Threshold',
    style: 'Over/Under',
    progression: 'FTP',
    forceThreeDay45: true,
    triFocusGoals: ['Threshold', 'Tempo', 'Race Prep'],
  },
  {
    id: 'balanced_endurance_blend_45',
    label: 'Endurance Blend 45 (3d)',
    goal: 'Endurance (Z2)',
    style: 'Steady',
    progression: 'Endurance',
    forceThreeDay45: true,
    triFocusGoals: ['Endurance (Z2)', 'Tempo', 'Sweet Spot'],
  },
];

export const SPIN_MODE_PRESETS: QuickModePreset[] = [
  {
    id: 'spin_class_core',
    label: 'Spin Rhythm',
    goal: 'Tempo',
    style: 'Pyramid',
    progression: 'Endurance',
    advancedTrainingMode: 'Spin Class',
    spinStyle: 'Rhythm',
  },
  {
    id: 'spin_class_climb',
    label: 'Spin Climb',
    goal: 'Climbing',
    style: 'Intervals',
    progression: 'FTP',
    advancedTrainingMode: 'Spin Class',
    spinStyle: 'Climb',
  },
  {
    id: 'spin_class_power',
    label: 'Spin Power',
    goal: 'HIIT',
    style: 'Intervals',
    progression: 'VO2',
    advancedTrainingMode: 'Spin Class',
    spinStyle: 'Power',
  },
  {
    id: 'spin_class_recovery',
    label: 'Spin Recovery Flow',
    goal: 'Recovery Ride',
    style: 'Steady',
    progression: 'Endurance',
    advancedTrainingMode: 'Spin Class',
    spinStyle: 'Recovery Flow',
  },
  {
    id: 'spin_cadence_intel',
    label: 'Cadence Intelligence',
    goal: 'Cadence Skills',
    style: 'Steady',
    progression: 'Endurance',
    advancedTrainingMode: 'Cadence Intelligence',
  },
  {
    id: 'spin_skills_day',
    label: 'Skills Day',
    goal: 'Cadence Skills',
    style: 'Steady',
    progression: 'Endurance',
    advancedTrainingMode: 'Skills Day',
  },
];

export const FUN_MODE_PRESETS: QuickModePreset[] = [
  {
    id: 'fun_varied_plan',
    label: 'Varied 4-combo Plan',
    goal: 'VO2Max',
    style: 'Over/Under',
    progression: 'VO2',
    variedMode: true,
  },
  {
    id: 'fun_single_mix',
    label: 'Single Mix Monster',
    goal: 'VO2Max',
    style: 'Over/Under',
    progression: 'VO2',
    singleMixMode: true,
    forceSingleSession: true,
  },
  {
    id: 'fun_game_ride',
    label: 'Game Ride MVP',
    goal: 'Threshold',
    style: 'Intervals',
    progression: 'FTP',
    gameRideMode: true,
    gameRideProfile: 'Technician',
  },
  {
    id: 'fun_race_sim',
    label: 'Race Simulator',
    goal: 'Race Prep',
    style: 'Intervals',
    progression: 'FTP',
    advancedTrainingMode: 'Race Simulator',
    raceSimulatorProfile: 'TT',
  },
];

// All quick mode presets
export const ALL_QUICK_MODE_PRESETS: QuickModePreset[] = [
  ...NORMAL_MODE_PRESETS,
  ...BALANCED_MODE_PRESETS,
  ...SPIN_MODE_PRESETS,
  ...FUN_MODE_PRESETS,
];
