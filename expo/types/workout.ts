export type IntervalType = 'warmup' | 'interval' | 'recovery' | 'cooldown';

export interface WorkoutInterval {
  type: IntervalType;
  duration_seconds: number;
  power_percent_ftp: number;
  cadence_rpm_target?: number;
  posture_cue?: 'seated' | 'standing';
}

export type WorkoutDuration = 30 | 45 | 60 | 75 | 90;

export type TrainingGoal =
  | 'Endurance (Z2)'
  | 'Tempo'
  | 'Sweet Spot'
  | 'Threshold'
  | 'VO2Max'
  | 'Anaerobic Capacity'
  | 'Sprint Power'
  | 'HIIT'
  | 'Climbing'
  | 'Time Trial'
  | 'Polarized'
  | 'Recovery Ride'
  | 'Race Prep'
  | 'Cadence Skills'
  | 'Muscular Endurance';

export type FitnessLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type WorkoutStyle = 'Steady' | 'Intervals' | 'Pyramid' | 'Over/Under';

export type ProgressionObjective = 'FTP' | 'Endurance' | 'VO2';

export interface WorkoutFormData {
  ftp: string;
  duration: WorkoutDuration;
  goal: TrainingGoal;
  level: FitnessLevel;
  style: WorkoutStyle;
}

export interface GeneratedWorkout {
  intervals: WorkoutInterval[];
  summary?: string;
  tss?: number;
}
