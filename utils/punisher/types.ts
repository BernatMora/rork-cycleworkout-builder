export type PunisherFocus = 'CADENCE' | 'TORQUE' | 'MIXED' | 'OVER_UNDER';

export type MaxRatioClamp = 100 | 110 | 120 | 130 | 150;

export type PunisherLegType = 'warmup' | 'spin' | 'torque' | 'recovery' | 'cooldown';

export interface PunisherLeg {
  type: PunisherLegType;
  duration_seconds: number;
  /** ICTraining levelRatio: percentage of FTP-based reference power */
  levelRatio: number;
  rpm: number;
}

export interface PunisherParams {
  ftp: number;
  /** Duration in minutes, 30–90 */
  duration: number;
  focus: PunisherFocus;
  /** 0 = gentle, 10 = brutal */
  cruelty: number;
  seed: number;
  maxRatio: MaxRatioClamp;
}

export interface PunisherWorkout {
  legs: PunisherLeg[];
  params: PunisherParams;
  name: string;
  createdAt: number;
}

export interface SavedSession {
  id: string;
  name: string;
  workout: PunisherWorkout;
  createdAt: number;
}

export type PunisherPresetId = 'bkool_short' | 'bkool_standard' | 'bkool_torque' | 'bkool_cadence';

export interface PunisherPreset {
  id: PunisherPresetId;
  label: string;
  description: string;
  params: Partial<PunisherParams>;
}
