import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Zap, Download, RefreshCw, ChevronRight, CalendarDays, Bike, CheckCircle2, Upload, FileDown, Pencil } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { usePlanContext } from '@/contexts/PlanContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JSZip from 'jszip';
import Colors from '@/constants/colors';
import PickerField from '@/components/PickerField';
import WorkoutPreview from '@/components/WorkoutPreview';
// Nous components modulars
import { TabBar } from '@/components/TabBar';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/SectionCard';
import { InputField } from '@/components/InputField';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { QuickModeButton } from '@/components/QuickModeButton';
import { StatusBar as AppStatusBar } from '@/components/StatusBar';
import {
  WorkoutDuration,
  TrainingGoal,
  FitnessLevel,
  WorkoutStyle,
  WorkoutInterval,
  ProgressionObjective,
} from '@/types/workout';
import { generateZwoXml, generateIctxXml, generateMrcText, generateErgText, calculateTSS, downloadZwoFile, parseZwoIntervals } from '@/utils/zwo';
import { generateWorkout } from '@/utils/workout-generator';
import { PROGRESSION_OBJECTIVES, getAdaptiveSessionV2, getDefaultProgressionObjective } from '@/utils/adaptive-v2';
import { rebalancePlanLoad } from '@/utils/plan-load';
import { pickVariedComboForSession, resolveProgressionObjectiveOnGoalChange } from '@/utils/mode-behavior';
import { GameRideProfile, generateAdaptiveGameSession, generateWeeklyBossWorkout } from '@/utils/adaptive-game';
import { AdvancedTrainingMode, BlockFocus, RaceSimulatorProfile, SpinClassStyle, applyAdvancedTrainingMode } from '@/utils/advanced-modes';
import { detectBrowserLanguage } from '@/constants/workout-options';

const DURATIONS: string[] = ['30 min', '45 min', '60 min', '75 min', '90 min'];
const GOALS: TrainingGoal[] = [
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
const LEVELS: FitnessLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const STYLES: WorkoutStyle[] = ['Steady', 'Intervals', 'Pyramid', 'Over/Under'];
const GAME_RIDE_PROFILES: GameRideProfile[] = ['Explorer', 'Crusher', 'Technician'];
const ADVANCED_TRAINING_MODES: AdvancedTrainingMode[] = [
  'Off',
  'Race Simulator',
  'Spin Class',
  'Cadence Intelligence',
  'Heat/Stress Safe',
  'Micro-dose',
  'Skills Day',
  'Block Periodization',
];
const RACE_SIMULATOR_PROFILES: RaceSimulatorProfile[] = ['TT', 'Crits', 'Gran Fondo'];
const SPIN_CLASS_STYLES: SpinClassStyle[] = ['Rhythm', 'Climb', 'Power', 'Recovery Flow'];
const BLOCK_PERIODIZATION_FOCUS_OPTIONS: BlockFocus[] = ['VO2', 'Threshold'];
const WEEKS: string[] = ['1 week', '2 weeks', '3 weeks', '4 weeks', '6 weeks', '8 weeks'];
const SESSIONS_PER_WEEK: string[] = ['1 session', '2 sessions', '3 sessions', '4 sessions', '5 sessions', '6 sessions'];
const EXPORT_FILE_FORMATS = ['.ictx', '.zwo', '.mrc', '.erg', '.ictx+.zwo'] as const;
const EXPORT_FORMAT_LABELS: Record<(typeof EXPORT_FILE_FORMATS)[number], string> = {
  '.ictx': 'ICTX (.ictx)',
  '.zwo': 'ZWO (.zwo)',
  '.mrc': 'MRC (.mrc)',
  '.erg': 'ERG (.erg)',
  '.ictx+.zwo': 'Dual (.ictx + .zwo)',
};
const EXPORT_FILENAME_TEMPLATE_PRESETS = [
  '{{goal}}_{{duration}}_{{date}}',
  '{{goal}}_w{{week}}_s{{session}}_{{date}}',
  '{{workout}}_{{date}}',
] as const;
type AppLanguage = 'ca' | 'es' | 'en';

const TRANSLATIONS = {
  en: {
    badge: 'Cycle Planner',
    subtitleSingle: 'Create a single workout and download it as',
    subtitlePlan: 'Create full training plans and download every session as',
    tabBuilder: 'Builder',
    tabCalendar: 'Calendar',
    tabAnalysis: 'Analysis',
    simpleOn: 'Simple mode ON',
    simpleOff: 'Simple mode OFF',
    ftpLabel: 'Your FTP (Watts)',
    maxHrLabel: 'Max HR (optional)',
    durationLabel: 'Workout Duration',
    goalLabel: 'Training Goal',
    progressionLabel: 'Progression Objective',
    progressionModeAuto: 'Progression mode: Auto (from goal)',
    progressionModeLocked: 'Progression mode: Locked (manual or preset)',
    levelLabel: 'Fitness Level',
    styleLabel: 'Base Workout Style',
    advancedModeLabel: 'Advanced Training Mode',
    raceProfileLabel: 'Race Profile',
    spinStyleLabel: 'Spin Style',
    blockFocusLabel: 'Block Focus',
    planLengthLabel: 'Plan Length',
    sessionsLabel: 'Sessions Per Week',
    trainingDaysLabel: 'Training days',
    saveNameLabel: 'Save Name (optional)',
    workoutNameLabel: 'Workout Name',
    exportFormatLabel: 'Export format',
    clearNames: 'Clear saved names',
    totalSessions: 'total sessions',
    generateWorkout: 'Generate Workout',
    generatePlan: 'Generate Plan',
    generatingWorkout: 'Generating Workout...',
    generatingPlan: 'Generating Plan...',
    validationTitle: 'Pre-export check',
    downloadWorkout: 'Download Workout',
    downloadPlan: 'Download Full Plan',
    rideOnBike: 'Ride it on the bike',
    heroSingleTitle: 'Cycle Workout Builder',
    heroPlanTitle: 'Cycle Plan Builder',
    ftpPlaceholder: 'e.g. 250',
    ftpHint: 'Enter a value between 50-500',
    maxHrPlaceholder: 'e.g. 185',
    quickModesTitle: 'Quick Modes',
    quickModesSubtitle: 'One-tap setup for normal, spin, balanced or fun sessions',
    normalModesTitle: 'Normal Modes',
    balancedModesTitle: 'Balanced Modes',
    spinStudioTitle: 'Spin Studio',
    funTitle: 'Fun',
    surpriseMe: 'Surprise me',
    triFocusActive: 'Tri-focus active: {goals} | 45m | 3 sessions/week',
    bkoolErgSmooth: 'Bkool ERG smooth mode {state}',
    conservativeRamps: 'Conservative ramps {state}',
    spinCuesIctx: 'Spin cues in ICTX {state}',
    onLabel: 'ON',
    offLabel: 'OFF',
    spinCuesHint: 'Adds Sit/Stand guidance to ICTX sequence names for compatible ICTrainer views.',
    variedComboMode: 'Varied 4-combo mode {state}',
    surpriseRandomHint: 'Surprise random: each session picks a different combo.',
    gameRideMode: 'Adaptive Game Ride {state}',
    gameRideHint: 'Branching safe/aggressive phases + weekly boss workout.',
    gameRideProfileLabel: 'Game Ride Profile',
    singleSessionMix: 'Single-session 4-combo mix {state}',
    singleSessionMixHint: 'Combines VO2Max + HIIT + Polarized + Cadence Skills in one workout.',
    crazyLab: 'Crazy Lab',
    tssCapAppliedLine: 'TSS safety cap applied in {count}/{total} generated session(s): {sessions}',
    crazyProfileMix: 'Crazy profile mix:',
    themePackLabel: 'Theme Pack',
    crazyIntensityLabel: 'Crazy Intensity',
    surpriseDensityLabel: 'Surprise Density',
    bossFight: 'Boss Fight',
    diceMode: 'Dice Mode',
    musicDrops: 'Music Drops',
    zigZagPower: 'ZigZag Power',
    lastMinuteTwist: 'Last-Minute Twist',
    guidedFtpTests: 'Guided FTP Tests',
    protocolLabel: 'Protocol',
    createFtpTestWorkout: 'Create FTP Test Workout',
    ftpPowerPlaceholder: 'Average power from test (e.g. 250)',
    applyFtpFromTest: 'Apply FTP from Test',
    warmupMin: 'Warmup min',
    warmupPct: 'Warmup %FTP',
    cooldownMin: 'Cooldown min',
    cooldownPct: 'Cooldown %FTP',
    warmupPlaceholder: '5',
    warmupPctPlaceholder: '55',
    cooldownPlaceholder: '6',
    cooldownPctPlaceholder: '45',
    warmupCooldownHint: 'Warmup: 1-5 min @ 40-85% | Cooldown: 1-20 min @ 35-75%',
    saveNamePlaceholder: 'e.g. threshold_tuesday',
    workoutNamePlaceholder: 'e.g. Tuesday Threshold',
    filenameTemplatePreset: 'Filename template preset',
    filenameTemplateLabel: 'Filename template',
    filenameTemplatePlaceholder: '{{goal}}_w{{week}}_s{{session}}_{{date}}',
    filenameTemplateHint: 'Use: {{goal}}, {{duration}}, {{week}}, {{session}}, {{date}}, {{workout}}',
    filenameTemplatePreviewLabel: 'Preview:',
    filenamePresetGoalDurationDate: 'Goal + Duration + Date',
    filenamePresetPlanSlot: 'Goal + Week + Session + Date',
    filenamePresetWorkoutDate: 'Workout + Date',
    filenameFieldsTitle: 'Filename fields',
    filenameFieldGoal: 'Goal',
    filenameFieldDuration: 'Duration',
    filenameFieldWeek: 'Week',
    filenameFieldSession: 'Session',
    filenameFieldDate: 'Date',
    filenameFieldWorkout: 'Workout',
    optionalShort: 'optional',
    saveCurrentFavorite: 'Save current as favorite',
    sessionFavorites: 'Session Favorites',
    delete: 'Delete',
    workoutTitle: 'Workout',
    planSessionsTitle: 'Plan Sessions',
    fatiguedOnly: 'Fatigued only',
    noSessionsForFilter: 'No sessions for this filter.',
    completedState: 'Completed',
    markDone: 'Mark done',
    easier: 'Easier',
    okay: 'OK',
    harder: 'Harder',
    importCompare: 'Import .ictx/.zwo to compare',
    exportZip: 'Export workout pack (ZIP)',
    exportCsv: 'Export CSV summary',
    exportBackup: 'Export profile backup (.json)',
    importBackup: 'Import profile backup (.json)',
    regenerateSelected: 'Regenerate Selected Workout',
    regeneratingSelected: 'Regenerating selected...',
    recoverSelected: 'Recover selected (softer)',
    recoverAllFatigued: 'Recover all fatigued ({count})',
    recoveringAllFatigued: 'Recovering all fatigued...',
    pushAllReady: 'Push all ready ({count})',
    pushingAllReady: 'Pushing all ready...',
    moreChaosSelected: 'More chaos for selected session',
    revengeButton: 'Revenge button (+spike)',
    sessionExecutionLog: 'Session execution log',
    rpeLabel: 'RPE (1-10)',
    rpePlaceholder: '7',
    sessionNoteOptional: 'Session note (optional)',
    sessionNotePlaceholder: 'How did it feel? Cadence, fatigue, legs...',
    saveSessionExecution: 'Save session execution',
    postWorkoutCheck: 'Post-workout check',
    fatigueLabel: 'Fatigue (1-10)',
    legsLabel: 'Legs (1-10)',
    fatiguePlaceholder: '6',
    legsPlaceholder: '6',
    applyNextSession: 'Apply to next session',
    recentExports: 'Recent Exports',
    searchByNameOrFormat: 'Search by name or format',
    noExportsFilter: 'No exports match this filter.',
    reexport: 'Re-export',
    regenerateWorkout: 'Regenerate Workout',
    regeneratePlan: 'Regenerate Plan',
    generationFailedTitle: 'Generation Failed',
    generationFailedFallback: 'Workout generation failed. Try again.',
    invalidFtpTitle: 'Invalid FTP',
    invalidFtpMessage: 'Please enter a valid FTP between 50 and 500 watts.',
    selectedWorkoutRegenerated: 'Selected workout regenerated.',
    regenerationFailedTitle: 'Regeneration failed',
    regenerationFailedMessage: 'Could not regenerate this workout. Please try again.',
    noFatiguedSessions: 'No fatigued sessions found.',
    noReadySessions: 'No ready sessions found.',
    planDownloadedTitle: 'Plan downloaded',
    workoutReadyTitle: 'Workout ready',
    noFilesDownloaded: 'No files were downloaded. Please try again.',
    clearSavedNamesTitle: 'Clear saved names?',
    clearSavedNamesMessage: 'This will remove the saved Save Name and Workout Name values.',
    cancel: 'Cancel',
    clear: 'Clear',
    namesCleared: 'Names cleared.',
    invalidRpeTitle: 'Invalid RPE',
    invalidRpeMessage: 'Enter an RPE value between 1 and 10.',
    noteTooLongTitle: 'Note too long',
    noteTooLongMessage: 'Keep session notes under 180 characters.',
    invalidCheckinTitle: 'Invalid check-in',
    invalidCheckinMessage: 'Enter RPE, fatigue and legs scores between 1 and 10.',
    invalidFtpBeforeTest: 'Set a valid FTP before generating a test protocol.',
    invalidPowerTitle: 'Invalid power',
    invalidPowerMessage: 'Enter a valid average power from your test effort.',
    compareParseFailed: 'Could not parse imported file.',
    backupExportWebOnly: 'Profile backup export is currently available on web.',
    backupImportWebOnly: 'Profile backup import is currently available on web.',
    invalidBackupFile: 'Invalid backup file format.',
    backupImported: 'Profile backup imported.',
    backupImportFailed: 'Could not import backup file.',
    adaptiveGameRideTitle: 'Adaptive Game Ride',
    weeklyBossActive: 'Weekly Boss active on this session',
    planAnalytics: 'Plan Analytics',
    weeklyCalendar: 'Weekly Calendar',
    realDaysCalendar: 'Real Days Calendar',
    noSession: 'No session',
    chaosFailedTitle: 'Chaos regenerate failed',
    chaosFailedMessage: 'Could not regenerate with more chaos. Please try again.',
    revengeFailedTitle: 'Revenge failed',
    revengeFailedMessage: 'Could not apply revenge mode. Please try again.',
    recoveryFailedTitle: 'Recovery tune failed',
    recoveryFailedMessage: 'Could not regenerate softer session. Please try again.',
    bulkRecoveryFailedTitle: 'Bulk recovery failed',
    bulkRecoveryFailedMessage: 'Could not regenerate all fatigued sessions. Please try again.',
    bulkPushFailedTitle: 'Bulk push failed',
    bulkPushFailedMessage: 'Could not regenerate all ready sessions. Please try again.',
    zipBundleFailed: 'Could not export ZIP bundle. Please try again.',
    filterAll: 'All',
    filterPending: 'Pending',
    filterCompleted: 'Completed',
    profileShort: 'Profile',
    advancedShort: 'Advanced',
    gameRideShort: 'Game Ride',
    chaosShort: 'Chaos',
    chaosLevelAutoApplied: 'Chaos level {level}/4 applied (auto-chaos boost enabled).',
    chaosLevelApplied: 'Chaos level {level}/4 applied to selected workout.',
    revengeApplied: 'Revenge mode applied: +1 chaos spike for selected workout.',
    recoveryAppliedSelected: 'Recovery tune applied: selected session regenerated softer.',
    recoveryAppliedCount: 'Recovery tune applied to {count} fatigued session(s).',
    pushAppliedCount: 'Push tune applied to {count} ready session(s).',
    preparingFiles: 'Preparing {count} file(s)...',
    downloadedProgress: 'Downloaded {done}/{total} file(s)...',
    doneExported: 'Done: {count} workout file(s) exported.',
    workoutReadyMessage: 'Workout file created. You can now save or share it from the iOS sheet.',
    workoutExportedShare: 'Workout exported. Open share sheet to save to Files.',
    savedFavoriteStatus: 'Saved favorite: {name}',
    loadedFavoriteStatus: 'Loaded favorite: {name}',
    executionSavedStatus: 'Execution saved for W{week} S{session}.',
    modeLoadedStatus: 'Mode loaded: {name}',
    crazyThemeCustom: 'Crazy theme: Custom',
    crazyThemeLoaded: 'Crazy theme loaded: {theme}',
    surpriseModeStatus: 'Surprise mode: random combo per session | {duration} | {level}',
    adaptiveFeedbackOnTarget: 'Adaptive feedback: on target.',
    adaptiveFeedbackEasier: 'Adaptive feedback: next sessions easier.',
    adaptiveFeedbackHarder: 'Adaptive feedback: next sessions harder.',
    postCheckNoNext: 'Post-workout check saved. No next session to adapt.',
    postCheckUnchanged: 'Post-workout check saved. Next session stays unchanged.',
    postCheckEased: 'Post-workout check saved. Next session (W{week} S{session}) eased.',
    postCheckIntensified: 'Post-workout check saved. Next session (W{week} S{session}) intensified.',
    ftpProtocolReady: 'FTP protocol ready: {protocol}',
    ftpUpdatedStatus: 'FTP updated to {ftp}w from {protocol}.',
    bundleExportedStatus: 'Bundle exported: {count} file(s) + summary.csv + summary.json + pack_manifest.json',
    tssCapApplied: 'TSS cap applied',
    summaryCrazyProfile: 'Crazy profile: {profile}',
    analyticsTotalTss: 'Total TSS: {value}',
    analyticsMinutes: 'Minutes: {value}',
    analyticsCompleted: 'Completed: {done}/{total}',
    analyticsZonesPrefix: 'Zones (min):',
  },
  ca: {
    badge: 'Planificador de Cicle',
    subtitleSingle: 'Crea un entrenament i descarrega\'l com a',
    subtitlePlan: 'Crea un pla complet i descarrega cada sessio com a',
    tabBuilder: 'Constructor',
    tabCalendar: 'Calendari',
    tabAnalysis: 'Analisi',
    simpleOn: 'Mode simple activat',
    simpleOff: 'Mode simple desactivat',
    ftpLabel: 'FTP (watts)',
    maxHrLabel: 'FC maxima (opc.)',
    durationLabel: 'Durada entrenament',
    goalLabel: 'Objectiu',
    progressionLabel: 'Objectiu de progres',
    progressionModeAuto: 'Progres: Automatic (segons objectiu)',
    progressionModeLocked: 'Progres: Fixat (manual o preset)',
    levelLabel: 'Nivell',
    styleLabel: 'Estil base',
    advancedModeLabel: 'Mode avancat',
    raceProfileLabel: 'Perfil de cursa',
    spinStyleLabel: 'Estil de spin',
    blockFocusLabel: 'Focalitzacio de bloc',
    planLengthLabel: 'Durada del pla',
    sessionsLabel: 'Sessions per setmana',
    trainingDaysLabel: 'Dies d\'entrenament',
    saveNameLabel: 'Nom de desat (opc.)',
    workoutNameLabel: 'Nom entrenament',
    exportFormatLabel: 'Format d\'exportacio',
    clearNames: 'Neteja noms desats',
    totalSessions: 'sessions totals',
    generateWorkout: 'Genera entrenament',
    generatePlan: 'Genera pla',
    generatingWorkout: 'Generant entrenament...',
    generatingPlan: 'Generant pla...',
    validationTitle: 'Validacio abans d\'exportar',
    downloadWorkout: 'Descarrega entrenament',
    downloadPlan: 'Descarrega pla complet',
    rideOnBike: 'Fes-lo a la bici',
    heroSingleTitle: 'Constructor d\'entrenaments',
    heroPlanTitle: 'Constructor de plans',
    ftpPlaceholder: 'ex. 250',
    ftpHint: 'Introdueix un valor entre 50-500',
    maxHrPlaceholder: 'ex. 185',
    quickModesTitle: 'Modes rapids',
    quickModesSubtitle: 'Configuracio en un toc per sessions normals, spin, equilibrades o fun',
    normalModesTitle: 'Modes normals',
    balancedModesTitle: 'Modes equilibrats',
    spinStudioTitle: 'Spin Studio',
    funTitle: 'Fun',
    surpriseMe: 'Sorpren-me',
    triFocusActive: 'Tri-focus actiu: {goals} | 45m | 3 sessions/setmana',
    bkoolErgSmooth: 'Mode suau Bkool ERG {state}',
    conservativeRamps: 'Rampes conservadores {state}',
    spinCuesIctx: 'Cues de spin a ICTX {state}',
    onLabel: 'ON',
    offLabel: 'OFF',
    spinCuesHint: 'Afegeix indicacions Sit/Stand als noms de sequencia ICTX per vistes compatibles d\'ICTrainer.',
    variedComboMode: 'Mode variat 4-combos {state}',
    surpriseRandomHint: 'Mode sorpresa: cada sessio tria un combo diferent.',
    gameRideMode: 'Adaptive Game Ride {state}',
    gameRideHint: 'Fases segures/agressives + boss setmanal.',
    gameRideProfileLabel: 'Perfil Game Ride',
    singleSessionMix: 'Mix 4-combos d\'una sessio {state}',
    singleSessionMixHint: 'Combina VO2Max + HIIT + Polarized + Cadence Skills en un entrenament.',
    crazyLab: 'Crazy Lab',
    tssCapAppliedLine: 'Cap de seguretat TSS aplicat a {count}/{total} sessio(ns): {sessions}',
    crazyProfileMix: 'Barreja de perfils crazy:',
    themePackLabel: 'Theme Pack',
    crazyIntensityLabel: 'Intensitat crazy',
    surpriseDensityLabel: 'Densitat sorpresa',
    bossFight: 'Boss Fight',
    diceMode: 'Mode daus',
    musicDrops: 'Music Drops',
    zigZagPower: 'Potencia ZigZag',
    lastMinuteTwist: 'Gir d\'ultim minut',
    guidedFtpTests: 'Tests FTP guiats',
    protocolLabel: 'Protocol',
    createFtpTestWorkout: 'Crea entrenament de test FTP',
    ftpPowerPlaceholder: 'Potencia mitjana del test (ex. 250)',
    applyFtpFromTest: 'Aplica FTP del test',
    warmupMin: 'Escalfament min',
    warmupPct: 'Escalfament %FTP',
    cooldownMin: 'Refredament min',
    cooldownPct: 'Refredament %FTP',
    warmupPlaceholder: '5',
    warmupPctPlaceholder: '55',
    cooldownPlaceholder: '6',
    cooldownPctPlaceholder: '45',
    warmupCooldownHint: 'Escalfament: 1-5 min @ 40-85% | Refredament: 1-20 min @ 35-75%',
    saveNamePlaceholder: 'ex. threshold_tuesday',
    workoutNamePlaceholder: 'ex. Tuesday Threshold',
    filenameTemplatePreset: 'Preset plantilla de nom',
    filenameTemplateLabel: 'Plantilla de nom',
    filenameTemplatePlaceholder: '{{goal}}_w{{week}}_s{{session}}_{{date}}',
    filenameTemplateHint: 'Usa: {{goal}}, {{duration}}, {{week}}, {{session}}, {{date}}, {{workout}}',
    filenameTemplatePreviewLabel: 'Previsualitzacio:',
    filenamePresetGoalDurationDate: 'Objectiu + Durada + Data',
    filenamePresetPlanSlot: 'Objectiu + Setmana + Sessio + Data',
    filenamePresetWorkoutDate: 'Entrenament + Data',
    filenameFieldsTitle: 'Camps del nom del fitxer',
    filenameFieldGoal: 'Objectiu',
    filenameFieldDuration: 'Durada',
    filenameFieldWeek: 'Setmana',
    filenameFieldSession: 'Sessio',
    filenameFieldDate: 'Data',
    filenameFieldWorkout: 'Entrenament',
    optionalShort: 'opcional',
    saveCurrentFavorite: 'Desa configuracio com a favorit',
    sessionFavorites: 'Favorits de sessio',
    delete: 'Esborra',
    workoutTitle: 'Entrenament',
    planSessionsTitle: 'Sessions del pla',
    fatiguedOnly: 'Nomes fatigades',
    noSessionsForFilter: 'No hi ha sessions per aquest filtre.',
    completedState: 'Completada',
    markDone: 'Marca com feta',
    easier: 'Mes facil',
    okay: 'OK',
    harder: 'Mes dura',
    importCompare: 'Importa .ictx/.zwo per comparar',
    exportZip: 'Exporta pack entrenaments (ZIP)',
    exportCsv: 'Exporta resum CSV',
    exportBackup: 'Exporta backup del perfil (.json)',
    importBackup: 'Importa backup del perfil (.json)',
    regenerateSelected: 'Regenera sessio seleccionada',
    regeneratingSelected: 'Regenerant seleccionada...',
    recoverSelected: 'Recupera seleccionada (mes suau)',
    recoverAllFatigued: 'Recupera totes les fatigades ({count})',
    recoveringAllFatigued: 'Recuperant totes les fatigades...',
    pushAllReady: 'Empeny totes les preparades ({count})',
    pushingAllReady: 'Aplicant push a totes les preparades...',
    moreChaosSelected: 'Mes caos per la sessio seleccionada',
    revengeButton: 'Boto revenge (+spike)',
    sessionExecutionLog: 'Registre d\'execucio de sessio',
    rpeLabel: 'RPE (1-10)',
    rpePlaceholder: '7',
    sessionNoteOptional: 'Nota de sessio (opcional)',
    sessionNotePlaceholder: 'Com t\'has sentit? Cadencia, fatiga, cames...',
    saveSessionExecution: 'Desa execucio de sessio',
    postWorkoutCheck: 'Check post-entrenament',
    fatigueLabel: 'Fatiga (1-10)',
    legsLabel: 'Cames (1-10)',
    fatiguePlaceholder: '6',
    legsPlaceholder: '6',
    applyNextSession: 'Aplica a la seguent sessio',
    recentExports: 'Exportacions recents',
    searchByNameOrFormat: 'Cerca per nom o format',
    noExportsFilter: 'Cap exportacio coincideix amb aquest filtre.',
    reexport: 'Torna a exportar',
    regenerateWorkout: 'Regenera entrenament',
    regeneratePlan: 'Regenera pla',
    generationFailedTitle: 'Generacio fallida',
    generationFailedFallback: 'La generacio ha fallat. Torna-ho a provar.',
    invalidFtpTitle: 'FTP invalid',
    invalidFtpMessage: 'Introdueix un FTP valid entre 50 i 500 watts.',
    selectedWorkoutRegenerated: 'Entrenament seleccionat regenerat.',
    regenerationFailedTitle: 'Regeneracio fallida',
    regenerationFailedMessage: 'No s\'ha pogut regenerar aquest entrenament. Torna-ho a provar.',
    noFatiguedSessions: 'No s\'han trobat sessions fatigades.',
    noReadySessions: 'No s\'han trobat sessions preparades.',
    planDownloadedTitle: 'Pla descarregat',
    workoutReadyTitle: 'Entrenament llest',
    noFilesDownloaded: 'No s\'ha descarregat cap fitxer. Torna-ho a provar.',
    clearSavedNamesTitle: 'Netejar noms desats?',
    clearSavedNamesMessage: 'Aixo eliminara els valors desats de Save Name i Workout Name.',
    cancel: 'Cancela',
    clear: 'Neteja',
    namesCleared: 'Noms netejats.',
    invalidRpeTitle: 'RPE invalid',
    invalidRpeMessage: 'Introdueix un valor RPE entre 1 i 10.',
    noteTooLongTitle: 'Nota massa llarga',
    noteTooLongMessage: 'Mantingues les notes per sota de 180 caracters.',
    invalidCheckinTitle: 'Check-in invalid',
    invalidCheckinMessage: 'Introdueix RPE, fatiga i cames entre 1 i 10.',
    invalidFtpBeforeTest: 'Defineix un FTP valid abans de generar un protocol de test.',
    invalidPowerTitle: 'Potencia invalida',
    invalidPowerMessage: 'Introdueix una potencia mitjana valida del teu test.',
    compareParseFailed: 'No s\'ha pogut interpretar el fitxer importat.',
    backupExportWebOnly: 'L\'exportacio de backup del perfil nomes esta disponible al web.',
    backupImportWebOnly: 'La importacio de backup del perfil nomes esta disponible al web.',
    invalidBackupFile: 'Format de fitxer de backup invalid.',
    backupImported: 'Backup del perfil importat.',
    backupImportFailed: 'No s\'ha pogut importar el fitxer de backup.',
    adaptiveGameRideTitle: 'Adaptive Game Ride',
    weeklyBossActive: 'Boss setmanal actiu en aquesta sessio',
    planAnalytics: 'Analitica del pla',
    weeklyCalendar: 'Calendari setmanal',
    realDaysCalendar: 'Calendari de dies reals',
    noSession: 'Sense sessio',
    chaosFailedTitle: 'Regeneracio caos fallida',
    chaosFailedMessage: 'No s\'ha pogut regenerar amb mes caos. Torna-ho a provar.',
    revengeFailedTitle: 'Revenge fallit',
    revengeFailedMessage: 'No s\'ha pogut aplicar el mode revenge. Torna-ho a provar.',
    recoveryFailedTitle: 'Recovery fallit',
    recoveryFailedMessage: 'No s\'ha pogut regenerar una sessio mes suau. Torna-ho a provar.',
    bulkRecoveryFailedTitle: 'Recovery massiu fallit',
    bulkRecoveryFailedMessage: 'No s\'han pogut regenerar totes les sessions fatigades. Torna-ho a provar.',
    bulkPushFailedTitle: 'Push massiu fallit',
    bulkPushFailedMessage: 'No s\'han pogut regenerar totes les sessions preparades. Torna-ho a provar.',
    zipBundleFailed: 'No s\'ha pogut exportar el ZIP. Torna-ho a provar.',
    filterAll: 'Totes',
    filterPending: 'Pendents',
    filterCompleted: 'Completades',
    profileShort: 'Perfil',
    advancedShort: 'Avancat',
    gameRideShort: 'Game Ride',
    chaosShort: 'Caos',
    chaosLevelAutoApplied: 'Nivell de caos {level}/4 aplicat (auto-chaos actiu).',
    chaosLevelApplied: 'Nivell de caos {level}/4 aplicat a la sessio seleccionada.',
    revengeApplied: 'Mode revenge aplicat: +1 spike de caos a la sessio seleccionada.',
    recoveryAppliedSelected: 'Recovery aplicat: sessio seleccionada regenerada mes suau.',
    recoveryAppliedCount: 'Recovery aplicat a {count} sessions fatigades.',
    pushAppliedCount: 'Push aplicat a {count} sessions preparades.',
    preparingFiles: 'Preparant {count} fitxer(s)...',
    downloadedProgress: 'Descarregats {done}/{total} fitxer(s)...',
    doneExported: 'Fet: {count} fitxer(s) exportat(s).',
    workoutReadyMessage: 'Fitxer d\'entrenament creat. Ara el pots desar o compartir des del full d\'iOS.',
    workoutExportedShare: 'Entrenament exportat. Obre el full de compartir per desar-lo a Fitxers.',
    savedFavoriteStatus: 'Favorit desat: {name}',
    loadedFavoriteStatus: 'Favorit carregat: {name}',
    executionSavedStatus: 'Execucio desada per W{week} S{session}.',
    modeLoadedStatus: 'Mode carregat: {name}',
    crazyThemeCustom: 'Tema crazy: Personalitzat',
    crazyThemeLoaded: 'Tema crazy carregat: {theme}',
    surpriseModeStatus: 'Mode sorpresa: combo aleatori per sessio | {duration} | {level}',
    adaptiveFeedbackOnTarget: 'Feedback adaptatiu: correcte.',
    adaptiveFeedbackEasier: 'Feedback adaptatiu: seguents sessions mes facils.',
    adaptiveFeedbackHarder: 'Feedback adaptatiu: seguents sessions mes dures.',
    postCheckNoNext: 'Check post-entrenament desat. No hi ha seguent sessio per adaptar.',
    postCheckUnchanged: 'Check post-entrenament desat. La seguent sessio no canvia.',
    postCheckEased: 'Check post-entrenament desat. Seguent sessio (W{week} S{session}) suavitzada.',
    postCheckIntensified: 'Check post-entrenament desat. Seguent sessio (W{week} S{session}) intensificada.',
    ftpProtocolReady: 'Protocol FTP llest: {protocol}',
    ftpUpdatedStatus: 'FTP actualitzat a {ftp}w des de {protocol}.',
    bundleExportedStatus: 'Bundle exportat: {count} fitxer(s) + summary.csv + summary.json + pack_manifest.json',
    tssCapApplied: 'Cap TSS aplicat',
    summaryCrazyProfile: 'Perfil crazy: {profile}',
    analyticsTotalTss: 'TSS total: {value}',
    analyticsMinutes: 'Minuts: {value}',
    analyticsCompleted: 'Completades: {done}/{total}',
    analyticsZonesPrefix: 'Zones (min):',
  },
  es: {
    badge: 'Planificador Ciclista',
    subtitleSingle: 'Crea un entrenamiento y descargalo como',
    subtitlePlan: 'Crea un plan completo y descarga cada sesion como',
    tabBuilder: 'Constructor',
    tabCalendar: 'Calendario',
    tabAnalysis: 'Analisis',
    simpleOn: 'Modo simple activado',
    simpleOff: 'Modo simple desactivado',
    ftpLabel: 'FTP (vatios)',
    maxHrLabel: 'FC maxima (opc.)',
    durationLabel: 'Duracion entrenamiento',
    goalLabel: 'Objetivo',
    progressionLabel: 'Objetivo de progresion',
    progressionModeAuto: 'Progresion: Automatica (segun objetivo)',
    progressionModeLocked: 'Progresion: Fijada (manual o preset)',
    levelLabel: 'Nivel',
    styleLabel: 'Estilo base',
    advancedModeLabel: 'Modo avanzado',
    raceProfileLabel: 'Perfil de carrera',
    spinStyleLabel: 'Estilo de spin',
    blockFocusLabel: 'Enfoque del bloque',
    planLengthLabel: 'Duracion del plan',
    sessionsLabel: 'Sesiones por semana',
    trainingDaysLabel: 'Dias de entrenamiento',
    saveNameLabel: 'Nombre de guardado (opc.)',
    workoutNameLabel: 'Nombre del entrenamiento',
    exportFormatLabel: 'Formato de exportacion',
    clearNames: 'Limpiar nombres guardados',
    totalSessions: 'sesiones totales',
    generateWorkout: 'Generar entrenamiento',
    generatePlan: 'Generar plan',
    generatingWorkout: 'Generando entrenamiento...',
    generatingPlan: 'Generando plan...',
    validationTitle: 'Validacion antes de exportar',
    downloadWorkout: 'Descargar entrenamiento',
    downloadPlan: 'Descargar plan completo',
    rideOnBike: 'Hacerlo en la bici',
    heroSingleTitle: 'Constructor de entrenamientos',
    heroPlanTitle: 'Constructor de planes',
    ftpPlaceholder: 'ej. 250',
    ftpHint: 'Introduce un valor entre 50-500',
    maxHrPlaceholder: 'ej. 185',
    quickModesTitle: 'Modos rapidos',
    quickModesSubtitle: 'Configuracion en un toque para sesiones normales, spin, balanceadas o fun',
    normalModesTitle: 'Modos normales',
    balancedModesTitle: 'Modos balanceados',
    spinStudioTitle: 'Spin Studio',
    funTitle: 'Fun',
    surpriseMe: 'Sorprendeme',
    triFocusActive: 'Tri-focus activo: {goals} | 45m | 3 sesiones/semana',
    bkoolErgSmooth: 'Modo suave Bkool ERG {state}',
    conservativeRamps: 'Rampas conservadoras {state}',
    spinCuesIctx: 'Cues de spin en ICTX {state}',
    onLabel: 'ON',
    offLabel: 'OFF',
    spinCuesHint: 'Agrega guias Sit/Stand en nombres de secuencia ICTX para vistas compatibles de ICTrainer.',
    variedComboMode: 'Modo variado 4-combos {state}',
    surpriseRandomHint: 'Sorpresa aleatoria: cada sesion elige un combo diferente.',
    gameRideMode: 'Adaptive Game Ride {state}',
    gameRideHint: 'Fases seguras/agresivas + boss semanal.',
    gameRideProfileLabel: 'Perfil Game Ride',
    singleSessionMix: 'Mix 4-combos de sesion unica {state}',
    singleSessionMixHint: 'Combina VO2Max + HIIT + Polarized + Cadence Skills en un entrenamiento.',
    crazyLab: 'Crazy Lab',
    tssCapAppliedLine: 'Cap de seguridad TSS aplicado en {count}/{total} sesion(es): {sessions}',
    crazyProfileMix: 'Mezcla de perfiles crazy:',
    themePackLabel: 'Theme Pack',
    crazyIntensityLabel: 'Intensidad crazy',
    surpriseDensityLabel: 'Densidad sorpresa',
    bossFight: 'Boss Fight',
    diceMode: 'Modo dados',
    musicDrops: 'Music Drops',
    zigZagPower: 'Potencia ZigZag',
    lastMinuteTwist: 'Giro de ultimo minuto',
    guidedFtpTests: 'Tests FTP guiados',
    protocolLabel: 'Protocolo',
    createFtpTestWorkout: 'Crear entrenamiento de test FTP',
    ftpPowerPlaceholder: 'Potencia media del test (ej. 250)',
    applyFtpFromTest: 'Aplicar FTP desde test',
    warmupMin: 'Calentamiento min',
    warmupPct: 'Calentamiento %FTP',
    cooldownMin: 'Enfriamiento min',
    cooldownPct: 'Enfriamiento %FTP',
    warmupPlaceholder: '5',
    warmupPctPlaceholder: '55',
    cooldownPlaceholder: '6',
    cooldownPctPlaceholder: '45',
    warmupCooldownHint: 'Calentamiento: 1-5 min @ 40-85% | Enfriamiento: 1-20 min @ 35-75%',
    saveNamePlaceholder: 'ej. threshold_tuesday',
    workoutNamePlaceholder: 'ej. Tuesday Threshold',
    filenameTemplatePreset: 'Preset de plantilla de nombre',
    filenameTemplateLabel: 'Plantilla de nombre',
    filenameTemplatePlaceholder: '{{goal}}_w{{week}}_s{{session}}_{{date}}',
    filenameTemplateHint: 'Usa: {{goal}}, {{duration}}, {{week}}, {{session}}, {{date}}, {{workout}}',
    filenameTemplatePreviewLabel: 'Vista previa:',
    filenamePresetGoalDurationDate: 'Objetivo + Duracion + Fecha',
    filenamePresetPlanSlot: 'Objetivo + Semana + Sesion + Fecha',
    filenamePresetWorkoutDate: 'Entrenamiento + Fecha',
    filenameFieldsTitle: 'Campos del nombre de archivo',
    filenameFieldGoal: 'Objetivo',
    filenameFieldDuration: 'Duracion',
    filenameFieldWeek: 'Semana',
    filenameFieldSession: 'Sesion',
    filenameFieldDate: 'Fecha',
    filenameFieldWorkout: 'Entrenamiento',
    optionalShort: 'opcional',
    saveCurrentFavorite: 'Guardar configuracion como favorito',
    sessionFavorites: 'Favoritos de sesion',
    delete: 'Eliminar',
    workoutTitle: 'Entrenamiento',
    planSessionsTitle: 'Sesiones del plan',
    fatiguedOnly: 'Solo fatigadas',
    noSessionsForFilter: 'No hay sesiones para este filtro.',
    completedState: 'Completada',
    markDone: 'Marcar hecha',
    easier: 'Mas facil',
    okay: 'OK',
    harder: 'Mas dura',
    importCompare: 'Importar .ictx/.zwo para comparar',
    exportZip: 'Exportar pack de entrenamientos (ZIP)',
    exportCsv: 'Exportar resumen CSV',
    exportBackup: 'Exportar backup de perfil (.json)',
    importBackup: 'Importar backup de perfil (.json)',
    regenerateSelected: 'Regenerar sesion seleccionada',
    regeneratingSelected: 'Regenerando seleccionada...',
    recoverSelected: 'Recuperar seleccionada (mas suave)',
    recoverAllFatigued: 'Recuperar todas las fatigadas ({count})',
    recoveringAllFatigued: 'Recuperando todas las fatigadas...',
    pushAllReady: 'Empujar todas las listas ({count})',
    pushingAllReady: 'Aplicando push a todas las listas...',
    moreChaosSelected: 'Mas caos para la sesion seleccionada',
    revengeButton: 'Boton revenge (+spike)',
    sessionExecutionLog: 'Registro de ejecucion de sesion',
    rpeLabel: 'RPE (1-10)',
    rpePlaceholder: '7',
    sessionNoteOptional: 'Nota de sesion (opcional)',
    sessionNotePlaceholder: 'Como te sentiste? Cadencia, fatiga, piernas...',
    saveSessionExecution: 'Guardar ejecucion de sesion',
    postWorkoutCheck: 'Check post-entrenamiento',
    fatigueLabel: 'Fatiga (1-10)',
    legsLabel: 'Piernas (1-10)',
    fatiguePlaceholder: '6',
    legsPlaceholder: '6',
    applyNextSession: 'Aplicar a la siguiente sesion',
    recentExports: 'Exportaciones recientes',
    searchByNameOrFormat: 'Buscar por nombre o formato',
    noExportsFilter: 'Ninguna exportacion coincide con este filtro.',
    reexport: 'Volver a exportar',
    regenerateWorkout: 'Regenerar entrenamiento',
    regeneratePlan: 'Regenerar plan',
    generationFailedTitle: 'Generacion fallida',
    generationFailedFallback: 'La generacion fallo. Intentalo de nuevo.',
    invalidFtpTitle: 'FTP invalido',
    invalidFtpMessage: 'Introduce un FTP valido entre 50 y 500 vatios.',
    selectedWorkoutRegenerated: 'Entrenamiento seleccionado regenerado.',
    regenerationFailedTitle: 'Regeneracion fallida',
    regenerationFailedMessage: 'No se pudo regenerar este entrenamiento. Intentalo de nuevo.',
    noFatiguedSessions: 'No se encontraron sesiones fatigadas.',
    noReadySessions: 'No se encontraron sesiones listas.',
    planDownloadedTitle: 'Plan descargado',
    workoutReadyTitle: 'Entrenamiento listo',
    noFilesDownloaded: 'No se descargo ningun archivo. Intentalo de nuevo.',
    clearSavedNamesTitle: 'Limpiar nombres guardados?',
    clearSavedNamesMessage: 'Esto eliminara los valores guardados de Save Name y Workout Name.',
    cancel: 'Cancelar',
    clear: 'Limpiar',
    namesCleared: 'Nombres limpiados.',
    invalidRpeTitle: 'RPE invalido',
    invalidRpeMessage: 'Introduce un valor de RPE entre 1 y 10.',
    noteTooLongTitle: 'Nota demasiado larga',
    noteTooLongMessage: 'Manten las notas por debajo de 180 caracteres.',
    invalidCheckinTitle: 'Check-in invalido',
    invalidCheckinMessage: 'Introduce RPE, fatiga y piernas entre 1 y 10.',
    invalidFtpBeforeTest: 'Define un FTP valido antes de generar un protocolo de test.',
    invalidPowerTitle: 'Potencia invalida',
    invalidPowerMessage: 'Introduce una potencia media valida de tu test.',
    compareParseFailed: 'No se pudo interpretar el archivo importado.',
    backupExportWebOnly: 'La exportacion de backup de perfil solo esta disponible en web.',
    backupImportWebOnly: 'La importacion de backup de perfil solo esta disponible en web.',
    invalidBackupFile: 'Formato de archivo de backup invalido.',
    backupImported: 'Backup de perfil importado.',
    backupImportFailed: 'No se pudo importar el archivo de backup.',
    adaptiveGameRideTitle: 'Adaptive Game Ride',
    weeklyBossActive: 'Boss semanal activo en esta sesion',
    planAnalytics: 'Analitica del plan',
    weeklyCalendar: 'Calendario semanal',
    realDaysCalendar: 'Calendario de dias reales',
    noSession: 'Sin sesion',
    chaosFailedTitle: 'Regeneracion con caos fallida',
    chaosFailedMessage: 'No se pudo regenerar con mas caos. Intentalo de nuevo.',
    revengeFailedTitle: 'Revenge fallido',
    revengeFailedMessage: 'No se pudo aplicar el modo revenge. Intentalo de nuevo.',
    recoveryFailedTitle: 'Recovery fallido',
    recoveryFailedMessage: 'No se pudo regenerar una sesion mas suave. Intentalo de nuevo.',
    bulkRecoveryFailedTitle: 'Recovery masivo fallido',
    bulkRecoveryFailedMessage: 'No se pudieron regenerar todas las sesiones fatigadas. Intentalo de nuevo.',
    bulkPushFailedTitle: 'Push masivo fallido',
    bulkPushFailedMessage: 'No se pudieron regenerar todas las sesiones listas. Intentalo de nuevo.',
    zipBundleFailed: 'No se pudo exportar el ZIP. Intentalo de nuevo.',
    filterAll: 'Todas',
    filterPending: 'Pendientes',
    filterCompleted: 'Completadas',
    profileShort: 'Perfil',
    advancedShort: 'Avanzado',
    gameRideShort: 'Game Ride',
    chaosShort: 'Caos',
    chaosLevelAutoApplied: 'Nivel de caos {level}/4 aplicado (auto-chaos activado).',
    chaosLevelApplied: 'Nivel de caos {level}/4 aplicado a la sesion seleccionada.',
    revengeApplied: 'Modo revenge aplicado: +1 spike de caos en la sesion seleccionada.',
    recoveryAppliedSelected: 'Recovery aplicado: sesion seleccionada regenerada mas suave.',
    recoveryAppliedCount: 'Recovery aplicado a {count} sesion(es) fatigada(s).',
    pushAppliedCount: 'Push aplicado a {count} sesion(es) listas.',
    preparingFiles: 'Preparando {count} archivo(s)...',
    downloadedProgress: 'Descargados {done}/{total} archivo(s)...',
    doneExported: 'Hecho: {count} archivo(s) de entrenamiento exportado(s).',
    workoutReadyMessage: 'Archivo de entrenamiento creado. Ya puedes guardarlo o compartirlo desde la hoja de iOS.',
    workoutExportedShare: 'Entrenamiento exportado. Abre la hoja de compartir para guardarlo en Archivos.',
    savedFavoriteStatus: 'Favorito guardado: {name}',
    loadedFavoriteStatus: 'Favorito cargado: {name}',
    executionSavedStatus: 'Ejecucion guardada para W{week} S{session}.',
    modeLoadedStatus: 'Modo cargado: {name}',
    crazyThemeCustom: 'Tema crazy: Personalizado',
    crazyThemeLoaded: 'Tema crazy cargado: {theme}',
    surpriseModeStatus: 'Modo sorpresa: combo aleatorio por sesion | {duration} | {level}',
    adaptiveFeedbackOnTarget: 'Feedback adaptativo: correcto.',
    adaptiveFeedbackEasier: 'Feedback adaptativo: siguientes sesiones mas faciles.',
    adaptiveFeedbackHarder: 'Feedback adaptativo: siguientes sesiones mas duras.',
    postCheckNoNext: 'Check post-entrenamiento guardado. No hay siguiente sesion para adaptar.',
    postCheckUnchanged: 'Check post-entrenamiento guardado. La siguiente sesion no cambia.',
    postCheckEased: 'Check post-entrenamiento guardado. Siguiente sesion (W{week} S{session}) suavizada.',
    postCheckIntensified: 'Check post-entrenamiento guardado. Siguiente sesion (W{week} S{session}) intensificada.',
    ftpProtocolReady: 'Protocolo FTP listo: {protocol}',
    ftpUpdatedStatus: 'FTP actualizado a {ftp}w desde {protocol}.',
    bundleExportedStatus: 'Bundle exportado: {count} archivo(s) + summary.csv + summary.json + pack_manifest.json',
    tssCapApplied: 'Cap TSS aplicado',
    summaryCrazyProfile: 'Perfil crazy: {profile}',
    analyticsTotalTss: 'TSS total: {value}',
    analyticsMinutes: 'Minutos: {value}',
    analyticsCompleted: 'Completadas: {done}/{total}',
    analyticsZonesPrefix: 'Zonas (min):',
  },
} as const;

type TranslationKey = keyof typeof TRANSLATIONS.en;
const WORKOUT_DISPLAY_NAME_STORAGE_KEY = 'ictrainer_workout_display_name';
const EXPORT_NAME_STORAGE_KEY = 'ictrainer_export_name';
const EXPORT_FILENAME_TEMPLATE_STORAGE_KEY = 'ictrainer_export_filename_template';
const APP_LANGUAGE_STORAGE_KEY = 'ictrainer_app_language';
const EXPORT_HISTORY_STORAGE_KEY = 'ictrainer_export_history';
const SESSION_FAVORITES_STORAGE_KEY = 'ictrainer_session_favorites';
const ADAPTIVE_FEEDBACK_STORAGE_KEY = 'ictrainer_adaptive_feedback';
const TRAINING_DAYS_STORAGE_KEY = 'ictrainer_training_days';
const SESSION_EXECUTION_LOG_STORAGE_KEY = 'ictrainer_session_execution_log';
const PLAN_STORAGE_KEY = 'ictrainer_plan';
const SELECTED_PLAN_WORKOUT_STORAGE_KEY = 'ictrainer_selected_plan_workout_id';
const COMPLETED_SESSIONS_STORAGE_KEY = 'ictrainer_completed_sessions';
const FTP_TEST_PROTOCOLS = ['Ramp Test', '20-min Test', '8-min x2 Test'] as const;
const WEEKDAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type PlanPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';
type PlanListFilter = 'All' | 'Pending' | 'Completed';
type ExportFileFormat = (typeof EXPORT_FILE_FORMATS)[number];
type ExportSingleFileFormat = Exclude<ExportFileFormat, '.ictx+.zwo'>;
type ExportHistoryFilter = 'All' | '24h' | '7d';
type MainViewTab = 'Builder' | 'Calendar' | 'Analysis';

interface VariedCombo {
  goal: TrainingGoal;
  style: WorkoutStyle;
  label: string;
}

interface QuickModePreset {
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

const VARIED_COMBOS: VariedCombo[] = [
  { goal: 'VO2Max', style: 'Over/Under', label: 'VO2Max + Over/Under' },
  { goal: 'HIIT', style: 'Pyramid', label: 'HIIT + Pyramid' },
  { goal: 'Polarized', style: 'Intervals', label: 'Polarized + Intervals' },
  { goal: 'Cadence Skills', style: 'Over/Under', label: 'Cadence Skills + Over/Under' },
];

const NORMAL_MODE_PRESETS: QuickModePreset[] = [
  { id: 'normal_endurance', label: 'Endurance Base', goal: 'Endurance (Z2)', style: 'Steady', progression: 'Endurance' },
  { id: 'normal_ftp', label: 'FTP Builder', goal: 'Sweet Spot', style: 'Intervals', progression: 'FTP' },
  { id: 'normal_threshold', label: 'Threshold Focus', goal: 'Threshold', style: 'Over/Under', progression: 'FTP' },
  { id: 'normal_tempo', label: 'Tempo Flow', goal: 'Tempo', style: 'Pyramid', progression: 'Endurance' },
];

const BALANCED_MODE_PRESETS: QuickModePreset[] = [
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

const SPIN_MODE_PRESETS: QuickModePreset[] = [
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

const FUN_MODE_PRESETS: QuickModePreset[] = [
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
    raceSimulatorProfile: 'Crits',
  },
  {
    id: 'fun_cadence_intel',
    label: 'Cadence Intelligence',
    goal: 'Cadence Skills',
    style: 'Steady',
    progression: 'Endurance',
    advancedTrainingMode: 'Cadence Intelligence',
  },
  {
    id: 'fun_heat_safe',
    label: 'Heat/Stress Safe',
    goal: 'Tempo',
    style: 'Steady',
    progression: 'Endurance',
    advancedTrainingMode: 'Heat/Stress Safe',
  },
  {
    id: 'fun_micro_dose',
    label: 'Micro-dose',
    goal: 'VO2Max',
    style: 'Intervals',
    progression: 'VO2',
    advancedTrainingMode: 'Micro-dose',
    forceSingleSession: true,
  },
  {
    id: 'fun_block_period',
    label: 'Block Periodization',
    goal: 'Threshold',
    style: 'Intervals',
    progression: 'FTP',
    advancedTrainingMode: 'Block Periodization',
    blockFocus: 'Threshold',
  },
  { id: 'fun_hiit_party', label: 'HIIT Party', goal: 'HIIT', style: 'Pyramid', progression: 'VO2' },
  { id: 'fun_cadence_freak', label: 'Cadence Freak', goal: 'Cadence Skills', style: 'Over/Under', progression: 'Endurance' },
];

interface PlanWorkout {
  id: string;
  name: string;
  summary: string;
  intervals: WorkoutInterval[];
  tss: number;
  tssCapped?: boolean;
  crazyProfileLabel?: string;
  advancedModeLabel?: string;
  gameRideInfo?: {
    profile: GameRideProfile;
    readinessScore: number;
    aggressivePhases: number;
    totalPhases: number;
    weeklyBoss: boolean;
  };
  week: number;
  sessionInWeek: number;
  phase: PlanPhase;
  dayLabel?: string;
}

interface ExportHistoryEntry {
  id: string;
  label: string;
  files: number;
  createdAt: string;
  format: ExportFileFormat;
  template?: string;
}

interface CompletedSessionMap {
  [sessionId: string]: boolean;
}

interface AdaptiveFeedbackMap {
  [sessionId: string]: -5 | 0 | 5;
}

interface SessionExecutionEntry {
  rpe: number;
  note: string;
  completedAt: string;
}

interface SessionExecutionMap {
  [sessionId: string]: SessionExecutionEntry;
}

interface SessionChaosMap {
  [sessionId: string]: number;
}

type CrazyIntensityLevel = 'Controlled' | 'Balanced' | 'Wild' | 'Insane';
type CrazySurpriseLevel = 'Low' | 'Medium' | 'High';
type CrazyThemePack =
  | 'Custom'
  | 'Climber Chaos'
  | 'Sprinter Riot'
  | 'Time Trial Glitch'
  | 'Diesel Nightmare'
  | 'Punchline Roulette';

interface CrazyThemePreset {
  goal: TrainingGoal;
  style: WorkoutStyle;
  progression: ProgressionObjective;
  variedMode: boolean;
  singleMixMode: boolean;
  bossFight: boolean;
  dice: boolean;
  musicDrops: boolean;
  zigZag: boolean;
  lastMinuteTwist: boolean;
  intensity: CrazyIntensityLevel;
  surprise: CrazySurpriseLevel;
  description: string;
}

interface CrazyModeOptions {
  bossFight: boolean;
  dice: boolean;
  musicDrops: boolean;
  zigZag: boolean;
  lastMinuteTwist: boolean;
  chaosFactor: number;
  surpriseFactor: number;
  revengeBoost?: boolean;
}

interface CrazyObjectiveProfile {
  deltaMultiplier: number;
  jitterMultiplier: number;
  dropDensityMultiplier: number;
  bossDurationMultiplier: number;
  burstPowerBonus: number;
  tssCapBonus: number;
  intervalPowerCap: number;
  recoveryPowerCap: number;
}

interface CrazySessionResult {
  intervals: WorkoutInterval[];
  tssCapped: boolean;
}

const CRAZY_INTENSITY_LEVELS: CrazyIntensityLevel[] = ['Controlled', 'Balanced', 'Wild', 'Insane'];
const CRAZY_SURPRISE_LEVELS: CrazySurpriseLevel[] = ['Low', 'Medium', 'High'];
const CRAZY_THEME_PACKS: CrazyThemePack[] = [
  'Custom',
  'Climber Chaos',
  'Sprinter Riot',
  'Time Trial Glitch',
  'Diesel Nightmare',
  'Punchline Roulette',
];
const CRAZY_THEME_PRESETS: Record<Exclude<CrazyThemePack, 'Custom'>, CrazyThemePreset> = {
  'Climber Chaos': {
    goal: 'Climbing',
    style: 'Over/Under',
    progression: 'FTP',
    variedMode: true,
    singleMixMode: false,
    bossFight: true,
    dice: false,
    musicDrops: false,
    zigZag: true,
    lastMinuteTwist: true,
    intensity: 'Wild',
    surprise: 'Medium',
    description: 'Steep over/under ramps with brutal finishing surge.',
  },
  'Sprinter Riot': {
    goal: 'Sprint Power',
    style: 'Intervals',
    progression: 'VO2',
    variedMode: true,
    singleMixMode: true,
    bossFight: false,
    dice: true,
    musicDrops: true,
    zigZag: true,
    lastMinuteTwist: true,
    intensity: 'Insane',
    surprise: 'High',
    description: 'Fast punches, random spikes, and relentless kickers.',
  },
  'Time Trial Glitch': {
    goal: 'Time Trial',
    style: 'Steady',
    progression: 'FTP',
    variedMode: true,
    singleMixMode: false,
    bossFight: true,
    dice: false,
    musicDrops: true,
    zigZag: false,
    lastMinuteTwist: true,
    intensity: 'Balanced',
    surprise: 'Low',
    description: 'TT focus with controlled rhythm breaks and pressure spikes.',
  },
  'Diesel Nightmare': {
    goal: 'Muscular Endurance',
    style: 'Over/Under',
    progression: 'FTP',
    variedMode: true,
    singleMixMode: false,
    bossFight: true,
    dice: false,
    musicDrops: false,
    zigZag: true,
    lastMinuteTwist: false,
    intensity: 'Wild',
    surprise: 'Low',
    description: 'Heavy sustained torque blocks with a punishing late overdrive.',
  },
  'Punchline Roulette': {
    goal: 'Anaerobic Capacity',
    style: 'Intervals',
    progression: 'VO2',
    variedMode: true,
    singleMixMode: true,
    bossFight: true,
    dice: true,
    musicDrops: true,
    zigZag: true,
    lastMinuteTwist: true,
    intensity: 'Insane',
    surprise: 'High',
    description: 'Unpredictable punchy spikes with rapid mood swings and finale chaos.',
  },
};

function getCrazyIntensityMultiplier(level: CrazyIntensityLevel): number {
  if (level === 'Controlled') return 0.75;
  if (level === 'Wild') return 1.35;
  if (level === 'Insane') return 1.65;
  return 1;
}

function getCrazySurpriseFactor(level: CrazySurpriseLevel): number {
  if (level === 'Low') return 0.7;
  if (level === 'High') return 1.5;
  return 1;
}

function getCrazyObjectiveProfile(goal: TrainingGoal, style: WorkoutStyle): CrazyObjectiveProfile {
  const base: CrazyObjectiveProfile = {
    deltaMultiplier: 1,
    jitterMultiplier: 1,
    dropDensityMultiplier: 1,
    bossDurationMultiplier: 1,
    burstPowerBonus: 0,
    tssCapBonus: 0,
    intervalPowerCap: 158,
    recoveryPowerCap: 84,
  };

  if (goal === 'Sprint Power' || goal === 'Anaerobic Capacity') {
    return {
      ...base,
      deltaMultiplier: 1.22,
      jitterMultiplier: 1.18,
      dropDensityMultiplier: 1.1,
      bossDurationMultiplier: 0.86,
      burstPowerBonus: 8,
      tssCapBonus: 0.04,
      intervalPowerCap: 168,
      recoveryPowerCap: 80,
    };
  }

  if (goal === 'VO2Max' || goal === 'HIIT') {
    return {
      ...base,
      deltaMultiplier: 1.16,
      jitterMultiplier: 1.1,
      dropDensityMultiplier: 1.08,
      bossDurationMultiplier: 1,
      burstPowerBonus: 5,
      tssCapBonus: 0.03,
      intervalPowerCap: 165,
      recoveryPowerCap: 82,
    };
  }

  if (goal === 'Endurance (Z2)' || goal === 'Recovery Ride' || goal === 'Tempo') {
    return {
      ...base,
      deltaMultiplier: 0.82,
      jitterMultiplier: 0.78,
      dropDensityMultiplier: 0.72,
      bossDurationMultiplier: 1.18,
      burstPowerBonus: -4,
      tssCapBonus: -0.05,
      intervalPowerCap: 146,
      recoveryPowerCap: 78,
    };
  }

  if (goal === 'Climbing' || goal === 'Time Trial' || goal === 'Muscular Endurance') {
    return {
      ...base,
      deltaMultiplier: 0.92,
      jitterMultiplier: 0.86,
      dropDensityMultiplier: 0.8,
      bossDurationMultiplier: 1.22,
      burstPowerBonus: -1,
      tssCapBonus: -0.02,
      intervalPowerCap: 152,
      recoveryPowerCap: 80,
    };
  }

  if (style === 'Steady') {
    return {
      ...base,
      deltaMultiplier: 0.88,
      jitterMultiplier: 0.82,
      dropDensityMultiplier: 0.75,
      bossDurationMultiplier: 1.15,
      burstPowerBonus: -2,
      tssCapBonus: -0.02,
      intervalPowerCap: 150,
      recoveryPowerCap: 80,
    };
  }

  return base;
}

function getCrazyObjectiveProfileLabel(goal: TrainingGoal, style: WorkoutStyle): string {
  if (goal === 'Sprint Power' || goal === 'Anaerobic Capacity') {
    return 'Explosive Bursts';
  }

  if (goal === 'VO2Max' || goal === 'HIIT') {
    return 'Aggressive VO2';
  }

  if (goal === 'Endurance (Z2)' || goal === 'Recovery Ride' || goal === 'Tempo') {
    return 'Controlled Endurance';
  }

  if (goal === 'Climbing' || goal === 'Time Trial' || goal === 'Muscular Endurance') {
    return 'Sustained Pressure';
  }

  if (style === 'Steady') {
    return 'Steady Chaos';
  }

  return 'Balanced Chaos';
}

interface ProfileBackupPayload {
  version: 1;
  exportedAt: string;
  profile: {
    ftp: string;
    duration: string;
    goal: TrainingGoal;
    level: FitnessLevel;
    style: WorkoutStyle;
    progressionObjective: ProgressionObjective;
    planWeeks: string;
    sessionsPerWeek: string;
    exportName: string;
    workoutDisplayName: string;
    maxHr: string;
    warmupMinutes: string;
    cooldownMinutes: string;
    warmupPowerPercent: string;
    cooldownPowerPercent: string;
    selectedTrainingDays: string[];
    bkoolErgMode: boolean;
    bkoolConservativeMode: boolean;
    selectedFtpProtocol: FtpTestProtocol;
    planListFilter: PlanListFilter;
  };
  data: {
    sessionFavorites: SessionFavorite[];
    adaptiveFeedback: AdaptiveFeedbackMap;
    completedSessions: CompletedSessionMap;
    sessionExecutionLog: SessionExecutionMap;
  };
}

type FtpTestProtocol = typeof FTP_TEST_PROTOCOLS[number];

interface SessionFavorite {
  id: string;
  name: string;
  duration: string;
  goal: TrainingGoal;
  level: FitnessLevel;
  style: WorkoutStyle;
  warmupMinutes: string;
  cooldownMinutes: string;
  warmupPowerPercent: string;
  cooldownPowerPercent: string;
}

function getWeeklyPhase(week: number, totalWeeks: number): PlanPhase {
  if (totalWeeks <= 2) {
    return week === totalWeeks ? 'Peak' : 'Build';
  }

  if (week === totalWeeks) {
    return 'Peak';
  }

  if (week % 4 === 0) {
    return 'Recovery';
  }

  if (week <= Math.ceil(totalWeeks / 2)) {
    return 'Base';
  }

  return 'Build';
}

function getPhaseDuration(baseDuration: WorkoutDuration, phase: PlanPhase): WorkoutDuration {
  return baseDuration;
}

function getPhaseStyle(baseStyle: WorkoutStyle, phase: PlanPhase, sessionIndex: number): WorkoutStyle {
  if (phase === 'Recovery') {
    return 'Steady';
  }

  if (phase === 'Peak') {
    return sessionIndex % 2 === 0 ? 'Over/Under' : 'Intervals';
  }

  if (phase === 'Build') {
    return sessionIndex % 3 === 0 ? 'Pyramid' : baseStyle;
  }

  return sessionIndex % 2 === 0 ? baseStyle : 'Steady';
}

function getPhaseGoal(baseGoal: TrainingGoal, phase: PlanPhase): TrainingGoal {
  if (phase === 'Recovery') {
    return 'Recovery Ride';
  }

  if (phase === 'Peak' && baseGoal === 'Endurance (Z2)') {
    return 'Time Trial';
  }

  return baseGoal;
}

function getTriFocusStyle(goal: TrainingGoal): WorkoutStyle {
  if (goal === 'VO2Max' || goal === 'HIIT' || goal === 'Anaerobic Capacity') {
    return 'Intervals';
  }

  if (goal === 'Threshold' || goal === 'Race Prep' || goal === 'Climbing') {
    return 'Over/Under';
  }

  if (goal === 'Endurance (Z2)' || goal === 'Recovery Ride' || goal === 'Tempo') {
    return 'Steady';
  }

  return 'Pyramid';
}

function getPhaseLabel(phase: PlanPhase): string {
  if (phase === 'Base') {
    return 'Base'
  }

  if (phase === 'Build') {
    return 'Build';
  }

  if (phase === 'Peak') {
    return 'Peak';
  }

  return 'Recovery';
}

function getPhaseColor(phase: PlanPhase): string {
  if (phase === 'Base') {
    return '#0EA5A4';
  }

  if (phase === 'Build') {
    return '#F59E0B';
  }

  if (phase === 'Peak') {
    return '#F97316';
  }

  return '#60A5FA';
}

function parseDuration(label: string): WorkoutDuration {
  return parseInt(label.split(' ')[0], 10) as WorkoutDuration;
}

function parseCount(label: string): number {
  return parseInt(label.split(' ')[0], 10);
}

function fitIntervalsToTarget(intervals: WorkoutInterval[], targetSeconds: number): WorkoutInterval[] {
  if (intervals.length === 0) {
    return intervals;
  }

  const safe = intervals.map((item) => ({
    ...item,
    duration_seconds: Math.max(20, Math.round(item.duration_seconds)),
  }));

  const total = safe.reduce((sum, item) => sum + item.duration_seconds, 0);
  if (total === targetSeconds) {
    return safe;
  }

  const scale = targetSeconds / Math.max(1, total);
  const scaled = safe.map((item) => ({
    ...item,
    duration_seconds: Math.max(20, Math.round(item.duration_seconds * scale)),
  }));

  let delta = targetSeconds - scaled.reduce((sum, item) => sum + item.duration_seconds, 0);
  let idx = scaled.length - 1;
  let guard = 0;

  while (delta !== 0 && guard < 5000) {
    const current = scaled[idx];
    if (delta > 0) {
      current.duration_seconds += 1;
      delta -= 1;
    } else if (current.duration_seconds > 20) {
      current.duration_seconds -= 1;
      delta += 1;
    }

    idx -= 1;
    if (idx < 0) {
      idx = scaled.length - 1;
    }
    guard += 1;
  }

  return scaled;
}

function normalizeIntervalSequence(intervals: WorkoutInterval[], targetSeconds: number): WorkoutInterval[] {
  if (intervals.length <= 1) {
    return fitIntervalsToTarget(intervals, targetSeconds);
  }

  const warmup = intervals.find((item) => item.type === 'warmup');
  const cooldown = [...intervals].reverse().find((item) => item.type === 'cooldown');
  const main = intervals.filter((item) => item.type !== 'warmup' && item.type !== 'cooldown');

  if (main.length === 0) {
    return fitIntervalsToTarget(intervals, targetSeconds);
  }

  const mergedMain: WorkoutInterval[] = [];
  for (const item of main) {
    const last = mergedMain[mergedMain.length - 1];
    if (
      last &&
      last.type === item.type &&
      Math.abs(last.power_percent_ftp - item.power_percent_ftp) <= 1 &&
      (last.cadence_rpm_target ?? null) === (item.cadence_rpm_target ?? null) &&
      (last.posture_cue ?? null) === (item.posture_cue ?? null)
    ) {
      last.duration_seconds += item.duration_seconds;
    } else {
      mergedMain.push({ ...item });
    }
  }

  const withRecoveryBreaks: WorkoutInterval[] = [];
  for (let i = 0; i < mergedMain.length; i += 1) {
    const current = { ...mergedMain[i] };
    const next = mergedMain[i + 1];

    withRecoveryBreaks.push(current);

    const needsBreak =
      current.type === 'interval' &&
      next?.type === 'interval' &&
      current.duration_seconds >= 120 &&
      next.duration_seconds >= 120;

    if (needsBreak) {
      const breakSeconds = Math.min(30, Math.max(20, Math.round(Math.min(current.duration_seconds, next.duration_seconds) * 0.12)));
      current.duration_seconds = Math.max(30, current.duration_seconds - Math.ceil(breakSeconds / 2));
      next.duration_seconds = Math.max(30, next.duration_seconds - Math.floor(breakSeconds / 2));

      withRecoveryBreaks.push({
        type: 'recovery',
        duration_seconds: breakSeconds,
        power_percent_ftp: 58,
      });
    }
  }

  const normalized: WorkoutInterval[] = [
    ...(warmup ? [{ ...warmup }] : []),
    ...withRecoveryBreaks,
    ...(cooldown ? [{ ...cooldown }] : []),
  ];

  return fitIntervalsToTarget(normalized, targetSeconds);
}

function buildAccurateWorkoutSummary(baseSummary: string, intervals: WorkoutInterval[]): string {
  const mainWork = intervals.filter((item) => item.type === 'interval');
  const recoveryBlocks = intervals.filter((item) => item.type === 'recovery').length;

  if (mainWork.length === 0) {
    return baseSummary;
  }

  const minWork = Math.min(...mainWork.map((item) => item.power_percent_ftp));
  const maxWork = Math.max(...mainWork.map((item) => item.power_percent_ftp));
  const weightedSum = mainWork.reduce((sum, item) => sum + (item.power_percent_ftp * item.duration_seconds), 0);
  const weightedDuration = Math.max(1, mainWork.reduce((sum, item) => sum + item.duration_seconds, 0));
  const avgWork = Math.round(weightedSum / weightedDuration);
  const rangeLabel = `${minWork}-${maxWork}% FTP`;
  const profileLabel = `Actual profile: ${mainWork.length} work blocks at ${rangeLabel} (avg ${avgWork}% FTP) with ${recoveryBlocks} recoveries.`;

  const cleanedBase = baseSummary.trim().replace(/\b\d{2,3}\s*[–-]\s*\d{2,3}%\s*FTP\b/gi, rangeLabel);
  if (cleanedBase.length === 0) {
    return profileLabel;
  }

  if (/Actual profile:/i.test(cleanedBase)) {
    return cleanedBase.replace(/Actual profile:.*$/i, profileLabel);
  }

  return `${cleanedBase} ${profileLabel}`;
}

function buildVariedBlock(
  targetSeconds: number,
  template: { duration: number; power: number; type: 'interval' | 'recovery' }[]
): WorkoutInterval[] {
  const block: WorkoutInterval[] = [];
  let total = 0;
  let index = 0;

  while (total < targetSeconds) {
    const step = template[index % template.length];
    block.push({
      type: step.type,
      duration_seconds: step.duration,
      power_percent_ftp: step.power,
    });
    total += step.duration;
    index += 1;
  }

  return fitIntervalsToTarget(block, targetSeconds);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applyTemplateVariation(
  template: { duration: number; power: number; type: 'interval' | 'recovery' }[],
  combo: VariedCombo,
  chaosFactor: number,
  surpriseFactor: number
): { duration: number; power: number; type: 'interval' | 'recovery' }[] {
  const normalizedChaos = clampNumber(chaosFactor, 1, 6);
  const normalizedSurprise = clampNumber(surpriseFactor, 0.5, 2);
  const intensityBase = combo.goal === 'VO2Max' || combo.goal === 'HIIT' ? 8 : 6;
  const durationBase = combo.goal === 'Polarized' ? 25 : 18;
  const intensityJitter = intensityBase + (normalizedChaos - 1) * 3;
  const durationJitter = durationBase + (normalizedChaos - 1) * 8;

  let varied = template.map((step) => {
    const jitteredDuration = step.duration + Math.round((Math.random() * 2 - 1) * durationJitter);
    const jitteredPower = step.power + Math.round((Math.random() * 2 - 1) * intensityJitter);

    const minPower = step.type === 'recovery' ? 50 : 72;
    const maxPower = step.type === 'recovery' ? 78 : 140;

    return {
      ...step,
      duration: clampNumber(jitteredDuration, 20, 240),
      power: clampNumber(jitteredPower, minPower, maxPower),
    };
  });

  if (varied.length >= 4) {
    const surpriseInsertions = Math.max(1, Math.round((Math.floor(varied.length / 6) + (normalizedChaos - 1)) * normalizedSurprise));

    for (let i = 0; i < surpriseInsertions; i += 1) {
      const insertAt = Math.min(varied.length - 1, Math.max(1, Math.floor(Math.random() * varied.length)));
      const surgePower = combo.goal === 'Polarized' ? 132 : combo.goal === 'Cadence Skills' ? 112 : 138;
      const surgeDuration = combo.goal === 'HIIT' ? 16 : 22 - Math.min(8, (normalizedChaos - 1) * 2);

      varied.splice(insertAt, 0,
        { type: 'interval', duration: surgeDuration, power: surgePower },
        { type: 'recovery', duration: 35, power: 58 }
      );
    }
  }

  return varied;
}

function buildSingleSessionFourComboMix(baseIntervals: WorkoutInterval[], targetSeconds: number): WorkoutInterval[] {
  const warmupBase = baseIntervals.find((item) => item.type === 'warmup');
  const cooldownBase = [...baseIntervals].reverse().find((item) => item.type === 'cooldown');

  const warmupSeconds = warmupBase?.duration_seconds ?? 8 * 60;
  const cooldownSeconds = cooldownBase?.duration_seconds ?? 6 * 60;
  const warmupPower = warmupBase?.power_percent_ftp ?? 55;
  const cooldownPower = cooldownBase?.power_percent_ftp ?? 45;

  const safeWarmup = Math.max(60, Math.min(targetSeconds - 180, warmupSeconds));
  const safeCooldown = Math.max(60, Math.min(targetSeconds - safeWarmup - 120, cooldownSeconds));
  const mainSeconds = Math.max(180, targetSeconds - safeWarmup - safeCooldown);

  const blockBase = Math.floor(mainSeconds / 4);
  const blockRemainder = mainSeconds - (blockBase * 4);
  const blockSeconds = [blockBase, blockBase, blockBase, blockBase + blockRemainder];

  const overUnder = buildVariedBlock(blockSeconds[0], [
    { duration: 75, power: 108, type: 'interval' },
    { duration: 75, power: 88, type: 'interval' },
    { duration: 30, power: 60, type: 'recovery' },
  ]);

  const pyramid = buildVariedBlock(blockSeconds[1], [
    { duration: 60, power: 75, type: 'interval' },
    { duration: 60, power: 85, type: 'interval' },
    { duration: 60, power: 95, type: 'interval' },
    { duration: 60, power: 105, type: 'interval' },
    { duration: 60, power: 95, type: 'interval' },
    { duration: 60, power: 85, type: 'interval' },
    { duration: 60, power: 75, type: 'interval' },
  ]);

  const polarized = buildVariedBlock(blockSeconds[2], [
    { duration: 120, power: 65, type: 'recovery' },
    { duration: 30, power: 125, type: 'interval' },
    { duration: 90, power: 68, type: 'recovery' },
    { duration: 30, power: 120, type: 'interval' },
  ]);

  const cadence = buildVariedBlock(blockSeconds[3], [
    { duration: 60, power: 80, type: 'interval' },
    { duration: 60, power: 90, type: 'interval' },
    { duration: 45, power: 70, type: 'recovery' },
    { duration: 60, power: 95, type: 'interval' },
    { duration: 45, power: 72, type: 'recovery' },
  ]);

  const mixed: WorkoutInterval[] = [
    { type: 'warmup', duration_seconds: safeWarmup, power_percent_ftp: warmupPower },
    ...overUnder,
    ...pyramid,
    ...polarized,
    ...cadence,
    { type: 'cooldown', duration_seconds: safeCooldown, power_percent_ftp: cooldownPower },
  ];

  return fitIntervalsToTarget(mixed, targetSeconds);
}

function buildVariedComboSession(
  baseIntervals: WorkoutInterval[],
  targetSeconds: number,
  combo: VariedCombo,
  chaosFactor: number = 1,
  surpriseFactor: number = 1
): WorkoutInterval[] {
  const warmupBase = baseIntervals.find((item) => item.type === 'warmup');
  const cooldownBase = [...baseIntervals].reverse().find((item) => item.type === 'cooldown');

  const warmupSeconds = warmupBase?.duration_seconds ?? 8 * 60;
  const cooldownSeconds = cooldownBase?.duration_seconds ?? 6 * 60;
  const warmupPower = warmupBase?.power_percent_ftp ?? 55;
  const cooldownPower = cooldownBase?.power_percent_ftp ?? 45;

  const safeWarmup = Math.max(90, Math.min(targetSeconds - 240, warmupSeconds));
  const safeCooldown = Math.max(90, Math.min(targetSeconds - safeWarmup - 120, cooldownSeconds));
  const mainSeconds = Math.max(240, targetSeconds - safeWarmup - safeCooldown);

  let template: { duration: number; power: number; type: 'interval' | 'recovery' }[] = [
    { duration: 60, power: 92, type: 'interval' },
    { duration: 45, power: 60, type: 'recovery' },
  ];

  if (combo.goal === 'VO2Max' && combo.style === 'Over/Under') {
    template = [
      { duration: 30, power: 120, type: 'interval' },
      { duration: 45, power: 92, type: 'interval' },
      { duration: 20, power: 128, type: 'interval' },
      { duration: 40, power: 58, type: 'recovery' },
      { duration: 30, power: 116, type: 'interval' },
      { duration: 45, power: 90, type: 'interval' },
      { duration: 35, power: 62, type: 'recovery' },
    ];
  } else if (combo.goal === 'HIIT' && combo.style === 'Pyramid') {
    template = [
      { duration: 30, power: 95, type: 'interval' },
      { duration: 30, power: 108, type: 'interval' },
      { duration: 30, power: 120, type: 'interval' },
      { duration: 30, power: 132, type: 'interval' },
      { duration: 30, power: 120, type: 'interval' },
      { duration: 30, power: 108, type: 'interval' },
      { duration: 30, power: 95, type: 'interval' },
      { duration: 60, power: 55, type: 'recovery' },
    ];
  } else if (combo.goal === 'Polarized' && combo.style === 'Intervals') {
    template = [
      { duration: 150, power: 65, type: 'recovery' },
      { duration: 25, power: 130, type: 'interval' },
      { duration: 120, power: 68, type: 'recovery' },
      { duration: 30, power: 122, type: 'interval' },
      { duration: 90, power: 70, type: 'recovery' },
      { duration: 20, power: 135, type: 'interval' },
    ];
  } else if (combo.goal === 'Cadence Skills' && combo.style === 'Over/Under') {
    template = [
      { duration: 45, power: 78, type: 'interval' },
      { duration: 45, power: 88, type: 'interval' },
      { duration: 30, power: 96, type: 'interval' },
      { duration: 40, power: 72, type: 'recovery' },
      { duration: 25, power: 105, type: 'interval' },
      { duration: 50, power: 82, type: 'interval' },
      { duration: 40, power: 70, type: 'recovery' },
    ];
  }

  const variedTemplate = applyTemplateVariation(template, combo, chaosFactor, surpriseFactor);

  const mainBlock = buildVariedBlock(mainSeconds, variedTemplate);

  const session: WorkoutInterval[] = [
    { type: 'warmup', duration_seconds: safeWarmup, power_percent_ftp: warmupPower },
    ...mainBlock,
    { type: 'cooldown', duration_seconds: safeCooldown, power_percent_ftp: cooldownPower },
  ];

  return fitIntervalsToTarget(session, targetSeconds);
}

function applyZigZagPower(
  mainIntervals: WorkoutInterval[],
  chaosFactor: number,
  surpriseFactor: number = 1,
  profile?: CrazyObjectiveProfile
): WorkoutInterval[] {
  const targetSeconds = mainIntervals.reduce((sum, item) => sum + item.duration_seconds, 0);
  const normalizedSurprise = clampNumber(surpriseFactor, 0.5, 2);
  const deltaMultiplier = profile?.deltaMultiplier ?? 1;
  const jitterMultiplier = profile?.jitterMultiplier ?? 1;
  const intervalCap = profile?.intervalPowerCap ?? 158;
  const recoveryCap = profile?.recoveryPowerCap ?? 84;
  const baseDelta = (8 + (chaosFactor * 3) + Math.round((normalizedSurprise - 1) * 4)) * deltaMultiplier;
  const zigzag: WorkoutInterval[] = [];

  for (const interval of mainIntervals) {
    let remaining = interval.duration_seconds;
    let up = Math.random() > 0.35;
    while (remaining > 0) {
      const localDelta = Math.round(baseDelta + ((Math.random() * 2 - 1) * (3 + chaosFactor) * jitterMultiplier));
      const step = Math.min(remaining, 16 + Math.floor(Math.random() * ((18 + Math.round(8 * normalizedSurprise)) * jitterMultiplier)));
      const power = interval.type === 'recovery'
        ? clampNumber(interval.power_percent_ftp + (up ? localDelta : -localDelta), 42, recoveryCap)
        : clampNumber(interval.power_percent_ftp + (up ? localDelta : -localDelta), 62, intervalCap);
      zigzag.push({
        ...interval,
        duration_seconds: step,
        power_percent_ftp: power,
      });
      remaining -= step;
      up = Math.random() > 0.2 ? !up : up;
    }
  }

  return fitIntervalsToTarget(zigzag, targetSeconds);
}

function applyDiceMode(
  mainIntervals: WorkoutInterval[],
  chaosFactor: number,
  surpriseFactor: number = 1,
  profile?: CrazyObjectiveProfile
): WorkoutInterval[] {
  const normalizedSurprise = clampNumber(surpriseFactor, 0.5, 2);
  const deltaMultiplier = profile?.deltaMultiplier ?? 1;
  const jitterMultiplier = profile?.jitterMultiplier ?? 1;
  const burstPowerBonus = profile?.burstPowerBonus ?? 0;
  const intervalCap = profile?.intervalPowerCap ?? 165;
  const modifiers = ['peakBoost', 'recoveryDip', 'durationShuffle', 'microBurst', 'voltageSpikes', 'reverseSplit'] as const;
  const picked = new Set<number>();
  const rolls = Math.max(2, Math.min(4, Math.round(2 + (chaosFactor - 1) * 0.35 + (normalizedSurprise - 1) * 1.2)));
  while (picked.size < rolls) {
    picked.add(Math.floor(Math.random() * modifiers.length));
  }

  let mutated = mainIntervals.map((item) => ({ ...item }));

  for (const index of picked) {
    const modifier = modifiers[index];
    if (modifier === 'peakBoost') {
      mutated = mutated.map((item) => item.type === 'interval'
        ? { ...item, power_percent_ftp: clampNumber(item.power_percent_ftp + Math.round((4 + chaosFactor * 2) * deltaMultiplier), 60, intervalCap) }
        : item);
    }

    if (modifier === 'recoveryDip') {
      mutated = mutated.map((item) => item.type === 'recovery'
        ? { ...item, power_percent_ftp: clampNumber(item.power_percent_ftp - (4 + chaosFactor), 40, 78) }
        : item);
    }

    if (modifier === 'durationShuffle') {
      mutated = mutated.map((item) => {
        const jitter = Math.round((Math.random() * 2 - 1) * (12 + chaosFactor * 5 + (normalizedSurprise - 1) * 6) * jitterMultiplier);
        return {
          ...item,
          duration_seconds: Math.max(20, item.duration_seconds + jitter),
        };
      });
    }

    if (modifier === 'microBurst' && mutated.length > 3) {
      const bursts: WorkoutInterval[] = [];
      mutated.forEach((item, i) => {
        bursts.push(item);
        if (i % 3 === 2) {
          bursts.push({
            type: 'interval',
            duration_seconds: 14 + Math.round(Math.random() * 8),
            power_percent_ftp: clampNumber(132 + chaosFactor * 2 + burstPowerBonus, 90, intervalCap),
          });
          bursts.push({ type: 'recovery', duration_seconds: 22 + Math.round(Math.random() * 10), power_percent_ftp: 56 });
        }
      });
      mutated = bursts;
    }

    if (modifier === 'voltageSpikes') {
      const spiked: WorkoutInterval[] = [];
      mutated.forEach((item, i) => {
        spiked.push(item);
        if (item.type === 'interval' && i % 2 === 0 && item.duration_seconds >= 50) {
          spiked.push({
            type: 'interval',
            duration_seconds: 10 + Math.round(Math.random() * 8),
            power_percent_ftp: clampNumber(item.power_percent_ftp + 18 + chaosFactor * 2 + burstPowerBonus, 90, intervalCap),
          });
          spiked.push({
            type: 'recovery',
            duration_seconds: 18 + Math.round(Math.random() * 10),
            power_percent_ftp: 55,
          });
        }
      });
      mutated = spiked;
    }

    if (modifier === 'reverseSplit') {
      const splitPoint = Math.max(1, Math.floor(mutated.length * (0.45 + Math.random() * 0.2)));
      const first = mutated.slice(0, splitPoint).map((item) => (
        item.type === 'interval'
          ? { ...item, power_percent_ftp: clampNumber(item.power_percent_ftp - (4 + Math.round(chaosFactor * 1.5)), 58, 150) }
          : item
      ));
      const second = mutated.slice(splitPoint).map((item) => (
        item.type === 'interval'
          ? { ...item, power_percent_ftp: clampNumber(item.power_percent_ftp + Math.round((6 + Math.round(chaosFactor * 2)) * deltaMultiplier), 62, intervalCap) }
          : item
      ));
      mutated = [...first, ...second];
    }
  }

  const targetSeconds = mainIntervals.reduce((sum, item) => sum + item.duration_seconds, 0);
  return fitIntervalsToTarget(mutated, targetSeconds);
}

function applyMusicDrops(
  mainIntervals: WorkoutInterval[],
  chaosFactor: number,
  surpriseFactor: number,
  profile?: CrazyObjectiveProfile
): WorkoutInterval[] {
  const targetSeconds = mainIntervals.reduce((sum, item) => sum + item.duration_seconds, 0);
  const density = profile?.dropDensityMultiplier ?? 1;
  const burstPowerBonus = profile?.burstPowerBonus ?? 0;
  const intervalCap = profile?.intervalPowerCap ?? 165;
  const drops = Math.max(1, Math.round(Math.floor(targetSeconds / (300 - chaosFactor * 30)) * clampNumber(surpriseFactor, 0.5, 2) * density));
  const withDrops = [...mainIntervals];

  for (let i = 0; i < drops; i += 1) {
    const at = Math.min(withDrops.length, Math.max(1, Math.floor((i + 1) * withDrops.length / (drops + 1))));
    withDrops.splice(at, 0,
      { type: 'interval', duration_seconds: 22, power_percent_ftp: clampNumber(130 + burstPowerBonus, 90, intervalCap) },
      { type: 'recovery', duration_seconds: 38, power_percent_ftp: 56 }
    );
  }

  return fitIntervalsToTarget(withDrops, targetSeconds);
}

function applyLastMinuteTwist(mainIntervals: WorkoutInterval[], chaosFactor: number, profile?: CrazyObjectiveProfile): WorkoutInterval[] {
  const targetSeconds = mainIntervals.reduce((sum, item) => sum + item.duration_seconds, 0);
  const firstHalfTarget = Math.floor(targetSeconds * 0.5);
  const secondHalfTarget = targetSeconds - firstHalfTarget;
  const burstPowerBonus = profile?.burstPowerBonus ?? 0;
  const intervalCap = profile?.intervalPowerCap ?? 165;

  const firstHalf = fitIntervalsToTarget(mainIntervals, firstHalfTarget);
  const twistTemplate = [
    { duration: 28, power: clampNumber(118 + chaosFactor * 2 + burstPowerBonus, 80, intervalCap), type: 'interval' as const },
    { duration: 32, power: 88, type: 'interval' as const },
    { duration: 26, power: clampNumber(126 + chaosFactor * 2 + burstPowerBonus, 80, intervalCap), type: 'interval' as const },
    { duration: 34, power: 60, type: 'recovery' as const },
    { duration: 24, power: clampNumber(122 + chaosFactor * 2 + burstPowerBonus, 80, intervalCap), type: 'interval' as const },
    { duration: 36, power: 58, type: 'recovery' as const },
  ];
  const secondHalf = buildVariedBlock(secondHalfTarget, twistTemplate);

  return fitIntervalsToTarget([...firstHalf, ...secondHalf], targetSeconds);
}

function applyBossFight(
  mainIntervals: WorkoutInterval[],
  chaosFactor: number,
  surpriseFactor: number = 1,
  profile?: CrazyObjectiveProfile
): WorkoutInterval[] {
  const targetSeconds = mainIntervals.reduce((sum, item) => sum + item.duration_seconds, 0);
  const normalizedSurprise = clampNumber(surpriseFactor, 0.5, 2);
  const durationMultiplier = profile?.bossDurationMultiplier ?? 1;
  const burstPowerBonus = profile?.burstPowerBonus ?? 0;
  const intervalCap = profile?.intervalPowerCap ?? 168;
  const bossSeconds = Math.min(14 * 60, Math.max(7 * 60, Math.round(targetSeconds * (0.22 + (normalizedSurprise - 1) * 0.05) * durationMultiplier)));
  const baseSeconds = targetSeconds - bossSeconds;

  const base = fitIntervalsToTarget(mainIntervals, baseSeconds);
  const bossTemplate = [
    { duration: 42, power: 96 + chaosFactor, type: 'interval' as const },
    { duration: 20, power: clampNumber(128 + chaosFactor * 2 + burstPowerBonus, 85, intervalCap), type: 'interval' as const },
    { duration: 28, power: 92, type: 'interval' as const },
    { duration: 18, power: clampNumber(136 + chaosFactor * 2 + burstPowerBonus, 85, intervalCap), type: 'interval' as const },
    { duration: 26, power: 94, type: 'interval' as const },
    { duration: 16, power: clampNumber(144 + chaosFactor * 2 + burstPowerBonus, 85, intervalCap), type: 'interval' as const },
    { duration: 26, power: 60, type: 'recovery' as const },
    {
      duration: 14,
      power: clampNumber(150 + chaosFactor * 2 + Math.round((normalizedSurprise - 1) * 6) + burstPowerBonus, 85, intervalCap),
      type: 'interval' as const,
    },
    { duration: 24, power: 58, type: 'recovery' as const },
  ];
  const boss = buildVariedBlock(bossSeconds, bossTemplate);

  return fitIntervalsToTarget([...base, ...boss], targetSeconds);
}

function countEnabledCrazyModes(options: CrazyModeOptions): number {
  let count = 0;
  if (options.bossFight) count += 1;
  if (options.dice) count += 1;
  if (options.musicDrops) count += 1;
  if (options.zigZag) count += 1;
  if (options.lastMinuteTwist) count += 1;
  if (options.revengeBoost) count += 1;
  return count;
}

function balanceCrazyTss(
  crazyIntervals: WorkoutInterval[],
  referenceIntervals: WorkoutInterval[],
  ftpWatts: number,
  options: CrazyModeOptions,
  profile?: CrazyObjectiveProfile
): WorkoutInterval[] {
  if (!ftpWatts || ftpWatts < 50 || referenceIntervals.length === 0 || crazyIntervals.length === 0) {
    return crazyIntervals;
  }

  const referenceTss = calculateTSS(referenceIntervals, ftpWatts);
  if (referenceTss <= 0) {
    return crazyIntervals;
  }

  const enabledModes = countEnabledCrazyModes(options);
  const capMultiplier =
    1.12
    + Math.min(0.16, Math.max(0, (options.chaosFactor - 1) * 0.03))
    + Math.min(0.08, Math.max(0, (options.surpriseFactor - 1) * 0.08))
    + Math.min(0.1, enabledModes * 0.02)
    + (profile?.tssCapBonus ?? 0);
  const maxAllowedTss = Math.max(referenceTss + 2, Math.round(referenceTss * capMultiplier));

  let current = calculateTSS(crazyIntervals, ftpWatts);
  if (current <= maxAllowedTss) {
    return crazyIntervals;
  }

  let balanced = crazyIntervals.map((interval) => ({ ...interval }));

  for (let attempt = 0; attempt < 5; attempt += 1) {
    current = calculateTSS(balanced, ftpWatts);
    if (current <= maxAllowedTss) {
      break;
    }

    const ratio = clampNumber(maxAllowedTss / Math.max(current, 1), 0.7, 0.98);
    const workDamp = Math.sqrt(ratio);
    const recoveryDamp = Math.min(0.995, (workDamp + 1) / 2);

    balanced = balanced.map((interval) => {
      if (interval.type === 'warmup' || interval.type === 'cooldown') {
        return interval;
      }

      if (interval.type === 'recovery') {
        return {
          ...interval,
          power_percent_ftp: clampNumber(Math.round(52 + ((interval.power_percent_ftp - 52) * recoveryDamp)), 40, 80),
        };
      }

      return {
        ...interval,
        power_percent_ftp: clampNumber(Math.round(74 + ((interval.power_percent_ftp - 74) * workDamp)), 58, 165),
      };
    });
  }

  return balanced;
}

function applyCrazyModesToSession(
  intervals: WorkoutInterval[],
  targetSeconds: number,
  options: CrazyModeOptions,
  goal: TrainingGoal,
  style: WorkoutStyle,
  ftpWatts?: number
): CrazySessionResult {
  const profile = getCrazyObjectiveProfile(goal, style);
  const warmup = intervals.find((item) => item.type === 'warmup') ?? { type: 'warmup' as const, duration_seconds: 8 * 60, power_percent_ftp: 55 };
  const cooldown = [...intervals].reverse().find((item) => item.type === 'cooldown') ?? { type: 'cooldown' as const, duration_seconds: 6 * 60, power_percent_ftp: 45 };

  const safeWarmup = Math.max(60, Math.min(targetSeconds - 180, warmup.duration_seconds));
  const safeCooldown = Math.max(60, Math.min(targetSeconds - safeWarmup - 60, cooldown.duration_seconds));
  const mainTarget = Math.max(180, targetSeconds - safeWarmup - safeCooldown);

  let main = intervals.filter((item) => item.type !== 'warmup' && item.type !== 'cooldown');
  if (main.length === 0) {
    main = [{ type: 'interval', duration_seconds: mainTarget, power_percent_ftp: 88 }];
  }

  main = fitIntervalsToTarget(main, mainTarget);

  if (options.zigZag) {
    main = applyZigZagPower(main, options.chaosFactor, options.surpriseFactor, profile);
  }
  if (options.dice) {
    main = applyDiceMode(main, options.chaosFactor, options.surpriseFactor, profile);
  }
  if (options.musicDrops) {
    main = applyMusicDrops(main, options.chaosFactor, options.surpriseFactor, profile);
  }
  if (options.lastMinuteTwist) {
    main = applyLastMinuteTwist(main, options.chaosFactor, profile);
  }
  if (options.bossFight) {
    main = applyBossFight(main, options.chaosFactor, options.surpriseFactor, profile);
  }

  if (options.revengeBoost) {
    main = applyBossFight(main, Math.min(6, options.chaosFactor + 1), Math.min(2, options.surpriseFactor + 0.2), profile);
  }

  const combined: WorkoutInterval[] = [
    { ...warmup, duration_seconds: safeWarmup },
    ...main,
    { ...cooldown, duration_seconds: safeCooldown },
  ];

  const fitted = fitIntervalsToTarget(combined, targetSeconds);

  if (!ftpWatts || ftpWatts < 50) {
    return { intervals: fitted, tssCapped: false };
  }

  const fittedTss = calculateTSS(fitted, ftpWatts);
  const balanced = balanceCrazyTss(fitted, intervals, ftpWatts, options, profile);
  const balancedTss = calculateTSS(balanced, ftpWatts);

  return {
    intervals: balanced,
    tssCapped: balancedTss < (fittedTss - 1),
  };
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveExportTargets(format: ExportFileFormat): ExportSingleFileFormat[] {
  if (format === '.ictx+.zwo') {
    return ['.ictx', '.zwo'];
  }

  return [format];
}

function buildFilenameDateToken(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function applyFilenameTemplate(
  template: string,
  values: {
    goal: string;
    duration: string;
    week: string;
    session: string;
    date: string;
    workout: string;
  }
): string {
  const rendered = template
    .replace(/\{\{goal\}\}/gi, values.goal)
    .replace(/\{\{duration\}\}/gi, values.duration)
    .replace(/\{\{week\}\}/gi, values.week)
    .replace(/\{\{session\}\}/gi, values.session)
    .replace(/\{\{date\}\}/gi, values.date)
    .replace(/\{\{workout\}\}/gi, values.workout);

  return sanitizeFilenamePart(rendered);
}

function buildUniqueSuffix(): string {
  return Date.now().toString();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildIctxPreviewImage(intervals: WorkoutInterval[]): string | undefined {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return undefined;
  }

  const totalDuration = intervals.reduce((sum, interval) => sum + interval.duration_seconds, 0);
  if (totalDuration <= 0) {
    return undefined;
  }

  const width = 170;
  const height = 23;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    return undefined;
  }

  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#2C2F36');
  background.addColorStop(1, '#1F2228');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = 'rgba(255,255,255,0.08)';
  context.lineWidth = 1;
  for (let row = 1; row <= 3; row += 1) {
    const y = Math.round((height / 4) * row) + 0.5;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  let cursor = 0;
  for (const interval of intervals) {
    const segmentWidth = Math.max(1, Math.round((interval.duration_seconds / totalDuration) * width));
    const barHeight = Math.max(4, Math.min(height - 2, Math.round((interval.power_percent_ftp / 130) * (height - 2))));
    const y = height - barHeight;
    const color = interval.type === 'recovery' || interval.type === 'cooldown'
      ? '#A23ECF'
      : interval.power_percent_ftp >= 100
        ? '#F77E4A'
        : '#D22BA1';

    context.fillStyle = color;
    context.fillRect(cursor, y, segmentWidth, barHeight);
    context.fillStyle = 'rgba(255,255,255,0.15)';
    context.fillRect(cursor, y, segmentWidth, 1);
    cursor += segmentWidth;

    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(Math.max(0, cursor - 1), 0, 1, height);

    if (cursor >= width) {
      break;
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/png;base64,/, '');
}

function getReadinessColor(readinessScore: number): string {
  if (readinessScore >= 70) {
    return Colors.success;
  }

  if (readinessScore >= 45) {
    return Colors.warning;
  }

  return Colors.error;
}

function getReadinessLabel(readinessScore: number): 'READY' | 'CAUTION' | 'FATIGUED' {
  if (readinessScore >= 70) {
    return 'READY';
  }

  if (readinessScore >= 45) {
    return 'CAUTION';
  }

  return 'FATIGUED';
}

function buildFtpTestWorkout(protocol: FtpTestProtocol): { name: string; intervals: WorkoutInterval[]; summary: string } {
  if (protocol === 'Ramp Test') {
    return {
      name: 'Ramp Test',
      summary: 'Progressive ramp protocol. Stop when failure; take final 1-min power × 0.75 as FTP estimate.',
      intervals: [
        { type: 'warmup', duration_seconds: 8 * 60, power_percent_ftp: 55 },
        { type: 'interval', duration_seconds: 3 * 60, power_percent_ftp: 70 },
        { type: 'interval', duration_seconds: 3 * 60, power_percent_ftp: 80 },
        { type: 'interval', duration_seconds: 60, power_percent_ftp: 90 },
        { type: 'interval', duration_seconds: 60, power_percent_ftp: 100 },
        { type: 'interval', duration_seconds: 60, power_percent_ftp: 110 },
        { type: 'interval', duration_seconds: 60, power_percent_ftp: 120 },
        { type: 'interval', duration_seconds: 60, power_percent_ftp: 130 },
        { type: 'cooldown', duration_seconds: 6 * 60, power_percent_ftp: 45 },
      ],
    };
  }

  if (protocol === '20-min Test') {
    return {
      name: '20-min FTP Test',
      summary: 'Classic 20-min protocol. FTP estimate = 95% of your 20-min average power.',
      intervals: [
        { type: 'warmup', duration_seconds: 12 * 60, power_percent_ftp: 55 },
        { type: 'interval', duration_seconds: 5 * 60, power_percent_ftp: 95 },
        { type: 'recovery', duration_seconds: 5 * 60, power_percent_ftp: 50 },
        { type: 'interval', duration_seconds: 20 * 60, power_percent_ftp: 100 },
        { type: 'cooldown', duration_seconds: 8 * 60, power_percent_ftp: 45 },
      ],
    };
  }

  return {
    name: '8-min x2 FTP Test',
    summary: 'Two 8-min maximal efforts. FTP estimate = 90% of average power from both efforts.',
    intervals: [
      { type: 'warmup', duration_seconds: 10 * 60, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 8 * 60, power_percent_ftp: 108 },
      { type: 'recovery', duration_seconds: 10 * 60, power_percent_ftp: 50 },
      { type: 'interval', duration_seconds: 8 * 60, power_percent_ftp: 108 },
      { type: 'cooldown', duration_seconds: 8 * 60, power_percent_ftp: 45 },
    ],
  };
}

function assignDayLabel(index: number, selectedDays: string[]): string {
  if (selectedDays.length === 0) {
    return '';
  }

  return selectedDays[index % selectedDays.length];
}

function buildSessionKey(week: number, sessionInWeek: number): string {
  return `w${week}s${sessionInWeek}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTabletLayout = width >= 900;
  const scrollRef = useRef<ScrollView>(null);

  const [ftp, setFtp] = useState<string>('');
  const [duration, setDuration] = useState<string>('60 min');
  const [goal, setGoal] = useState<TrainingGoal>('Sweet Spot');
  const [level, setLevel] = useState<FitnessLevel>('Intermediate');
  const [style, setStyle] = useState<WorkoutStyle>('Intervals');
  const [planWeeks, setPlanWeeks] = useState<string>('1 week');
  const [sessionsPerWeek, setSessionsPerWeek] = useState<string>('1 session');
  const [exportFileFormat, setExportFileFormat] = useState<ExportFileFormat>('.ictx');
  const [exportName, setExportName] = useState<string>('');
  const [exportFilenameTemplate, setExportFilenameTemplate] = useState<string>(EXPORT_FILENAME_TEMPLATE_PRESETS[0]);
  const [filenameGoalValue, setFilenameGoalValue] = useState<string>('');
  const [filenameDurationValue, setFilenameDurationValue] = useState<string>('');
  const [filenameWeekValue, setFilenameWeekValue] = useState<string>('');
  const [filenameSessionValue, setFilenameSessionValue] = useState<string>('');
  const [filenameDateValue, setFilenameDateValue] = useState<string>('');
  const [filenameWorkoutValue, setFilenameWorkoutValue] = useState<string>('');
  const [workoutDisplayName, setWorkoutDisplayName] = useState<string>('');
  const [maxHr, setMaxHr] = useState<string>('185');
  const [warmupMinutes, setWarmupMinutes] = useState<string>('5');
  const [cooldownMinutes, setCooldownMinutes] = useState<string>('6');
  const [warmupPowerPercent, setWarmupPowerPercent] = useState<string>('55');
  const [cooldownPowerPercent, setCooldownPowerPercent] = useState<string>('45');

  const { plan, setPlan, selectedPlanWorkoutId, setSelectedPlanWorkoutId, selectedWorkout: ctxSelectedWorkout } = usePlanContext();
  const router = useRouter();
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [exportHistory, setExportHistory] = useState<ExportHistoryEntry[]>([]);
  const [exportHistorySearch, setExportHistorySearch] = useState<string>('');
  const [exportHistoryFilter, setExportHistoryFilter] = useState<ExportHistoryFilter>('All');
  const [simpleMode, setSimpleMode] = useState<boolean>(true);
  const mainViewTab: MainViewTab = 'Builder';
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(detectBrowserLanguage);
  const [regeneratingWorkoutId, setRegeneratingWorkoutId] = useState<string>('');
  const [sessionFavorites, setSessionFavorites] = useState<SessionFavorite[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSessionMap>({});
  const [adaptiveFeedback, setAdaptiveFeedback] = useState<AdaptiveFeedbackMap>({});
  const [sessionExecutionLog, setSessionExecutionLog] = useState<SessionExecutionMap>({});
  const [sessionChaosMap, setSessionChaosMap] = useState<SessionChaosMap>({});
  const [selectedTrainingDays, setSelectedTrainingDays] = useState<string[]>(['Tue', 'Thu', 'Sat']);
  const [planListFilter, setPlanListFilter] = useState<PlanListFilter>('All');
  const [showFatiguedOnly, setShowFatiguedOnly] = useState<boolean>(false);
  const [variedComboMode, setVariedComboMode] = useState<boolean>(false);
  const [singleSessionMixMode, setSingleSessionMixMode] = useState<boolean>(false);
  const [advancedTrainingMode, setAdvancedTrainingMode] = useState<AdvancedTrainingMode>('Off');
  const [spinClassStyle, setSpinClassStyle] = useState<SpinClassStyle>('Rhythm');
  const [raceSimulatorProfile, setRaceSimulatorProfile] = useState<RaceSimulatorProfile>('TT');
  const [blockPeriodizationFocus, setBlockPeriodizationFocus] = useState<BlockFocus>('Threshold');
  const [gameRideMode, setGameRideMode] = useState<boolean>(false);
  const [gameRideProfile, setGameRideProfile] = useState<GameRideProfile>('Technician');
  const [triFocusMode, setTriFocusMode] = useState<boolean>(false);
  const [triFocusGoals, setTriFocusGoals] = useState<[TrainingGoal, TrainingGoal, TrainingGoal]>(['Sweet Spot', 'Tempo', 'VO2Max']);
  const [bossFightMode, setBossFightMode] = useState<boolean>(false);
  const [diceMode, setDiceMode] = useState<boolean>(false);
  const [musicDropsMode, setMusicDropsMode] = useState<boolean>(false);
  const [zigZagMode, setZigZagMode] = useState<boolean>(false);
  const [lastMinuteTwistMode, setLastMinuteTwistMode] = useState<boolean>(false);
  const [crazyIntensityLevel, setCrazyIntensityLevel] = useState<CrazyIntensityLevel>('Balanced');
  const [crazySurpriseLevel, setCrazySurpriseLevel] = useState<CrazySurpriseLevel>('Medium');
  const [crazyThemePack, setCrazyThemePack] = useState<CrazyThemePack>('Custom');
  const [bkoolErgMode, setBkoolErgMode] = useState<boolean>(true);
  const [bkoolConservativeMode, setBkoolConservativeMode] = useState<boolean>(true);
  const [includeSpinCuesInIctx, setIncludeSpinCuesInIctx] = useState<boolean>(true);
  const [selectedFtpProtocol, setSelectedFtpProtocol] = useState<FtpTestProtocol>('20-min Test');
  const [progressionObjective, setProgressionObjective] = useState<ProgressionObjective>('FTP');
  const [autoProgressionFromGoal, setAutoProgressionFromGoal] = useState<boolean>(true);
  const [surpriseRandomPerSessionMode, setSurpriseRandomPerSessionMode] = useState<boolean>(false);
  const [ftpTestPowerInput, setFtpTestPowerInput] = useState<string>('');
  const [comparisonStatus, setComparisonStatus] = useState<string>('');
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [postWorkoutRpe, setPostWorkoutRpe] = useState<string>('');
  const [postWorkoutFatigue, setPostWorkoutFatigue] = useState<string>('');
  const [postWorkoutLegs, setPostWorkoutLegs] = useState<string>('');
  const [sessionRpeInput, setSessionRpeInput] = useState<string>('');
  const [sessionNoteInput, setSessionNoteInput] = useState<string>('');

  const ftpNum = parseInt(ftp, 10);
  const maxHrNum = parseInt(maxHr, 10);
  const warmupMinutesNum = parseInt(warmupMinutes, 10);
  const cooldownMinutesNum = parseInt(cooldownMinutes, 10);
  const warmupPowerPercentNum = parseInt(warmupPowerPercent, 10);
  const cooldownPowerPercentNum = parseInt(cooldownPowerPercent, 10);
  const hasValidWarmupCooldown =
    warmupMinutesNum >= 1 && warmupMinutesNum <= 5 &&
    cooldownMinutesNum >= 1 && cooldownMinutesNum <= 20 &&
    warmupPowerPercentNum >= 40 && warmupPowerPercentNum <= 85 &&
    cooldownPowerPercentNum >= 35 && cooldownPowerPercentNum <= 75;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const t = useCallback((key: TranslationKey, vars?: Record<string, string | number>): string => {
    const localeTable = TRANSLATIONS[appLanguage] as Partial<Record<TranslationKey, string>>;
    let text = localeTable[key] ?? TRANSLATIONS.en[key];

    if (!vars) {
      return text;
    }

    Object.entries(vars).forEach(([name, value]) => {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    });

    return text;
  }, [appLanguage]);

  const filenameTemplatePresetLabelMap = useMemo<Record<string, string>>(() => ({
    [EXPORT_FILENAME_TEMPLATE_PRESETS[0]]: t('filenamePresetGoalDurationDate'),
    [EXPORT_FILENAME_TEMPLATE_PRESETS[1]]: t('filenamePresetPlanSlot'),
    [EXPORT_FILENAME_TEMPLATE_PRESETS[2]]: t('filenamePresetWorkoutDate'),
  }), [t]);

  const filenameTemplatePresetOptions = useMemo<string[]>(() => {
    return EXPORT_FILENAME_TEMPLATE_PRESETS.map((preset) => filenameTemplatePresetLabelMap[preset] ?? preset);
  }, [filenameTemplatePresetLabelMap]);

  const resolveFilenameTokenValue = useCallback((overrideValue: string, fallbackValue: string): string => {
    const cleaned = sanitizeFilenamePart(overrideValue.trim());
    return cleaned.length > 0 ? cleaned : fallbackValue;
  }, []);

  const filenameTemplatePreview = useMemo(() => {
    const activeTemplate = exportFilenameTemplate.trim().length > 0
      ? exportFilenameTemplate.trim()
      : EXPORT_FILENAME_TEMPLATE_PRESETS[0];

    return applyFilenameTemplate(activeTemplate, {
      goal: resolveFilenameTokenValue(filenameGoalValue, sanitizeFilenamePart(goal)),
      duration: resolveFilenameTokenValue(filenameDurationValue, sanitizeFilenamePart(duration.replace(/\s+/g, ''))),
      week: resolveFilenameTokenValue(filenameWeekValue, '1'),
      session: resolveFilenameTokenValue(filenameSessionValue, '1'),
      date: resolveFilenameTokenValue(filenameDateValue, buildFilenameDateToken()),
      workout: resolveFilenameTokenValue(filenameWorkoutValue, sanitizeFilenamePart(workoutDisplayName.trim() || 'workout')),
    });
  }, [
    exportFilenameTemplate,
    filenameGoalValue,
    filenameDurationValue,
    filenameWeekValue,
    filenameSessionValue,
    filenameDateValue,
    filenameWorkoutValue,
    goal,
    duration,
    workoutDisplayName,
    resolveFilenameTokenValue,
  ]);

  const selectedWorkout = useMemo(() => {
    if (plan.length === 0) {
      return null;
    }

    return plan.find((item) => item.id === selectedPlanWorkoutId) ?? plan[0];
  }, [plan, selectedPlanWorkoutId]);

  const tssCapAppliedCount = useMemo(() => {
    return plan.reduce((sum, workout) => sum + (workout.tssCapped ? 1 : 0), 0);
  }, [plan]);

  const tssCapAppliedSessionsLabel = useMemo(() => {
    const labels = plan
      .filter((workout) => workout.tssCapped)
      .map((workout) => `W${workout.week} S${workout.sessionInWeek}`);

    if (labels.length === 0) {
      return '';
    }

    if (labels.length <= 6) {
      return labels.join(', ');
    }

    return `${labels.slice(0, 6).join(', ')}, +${labels.length - 6} more`;
  }, [plan]);

  const crazyProfileSummary = useMemo(() => {
    const counter = new Map<string, number>();

    for (const workout of plan) {
      if (!workout.crazyProfileLabel) {
        continue;
      }

      counter.set(workout.crazyProfileLabel, (counter.get(workout.crazyProfileLabel) ?? 0) + 1);
    }

    return Array.from(counter.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [plan]);

  const selectedSessionKey = useMemo(() => {
    if (!selectedWorkout) {
      return '';
    }

    return buildSessionKey(selectedWorkout.week, selectedWorkout.sessionInWeek);
  }, [selectedWorkout]);

  const summaryWorkoutTitle = useMemo(() => {
    if (!selectedWorkout) {
      return '';
    }

    const customName = workoutDisplayName.trim();
    if (customName.length === 0) {
      return selectedWorkout.name;
    }

    if (plan.length === 1) {
      return customName;
    }

    return `${customName} • W${selectedWorkout.week} S${selectedWorkout.sessionInWeek}`;
  }, [selectedWorkout, workoutDisplayName, plan.length]);

  const getDisplayWorkoutName = useCallback((workout: PlanWorkout): string => {
    const customName = workoutDisplayName.trim();

    if (customName.length === 0) {
      return workout.name;
    }

    if (plan.length === 1) {
      return customName;
    }

    return `${customName} • W${workout.week} S${workout.sessionInWeek}`;
  }, [workoutDisplayName, plan.length]);

  const planByWeek = useMemo(() => {
    const grouped = new Map<number, PlanWorkout[]>();

    for (const workout of plan) {
      const existing = grouped.get(workout.week) ?? [];
      existing.push(workout);
      grouped.set(workout.week, existing);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, sessions]) => ({
        week,
        sessions: sessions.sort((a, b) => a.sessionInWeek - b.sessionInWeek),
      }));
  }, [plan]);

  const planByDay = useMemo(() => {
    const grouped = new Map<string, PlanWorkout[]>();

    for (const day of WEEKDAY_OPTIONS) {
      grouped.set(day, []);
    }

    for (const workout of plan) {
      const day = workout.dayLabel ?? (assignDayLabel(workout.sessionInWeek - 1, selectedTrainingDays) || 'Mon');
      const existing = grouped.get(day) ?? [];
      existing.push(workout);
      grouped.set(day, existing);
    }

    return WEEKDAY_OPTIONS.map((day) => ({ day, sessions: grouped.get(day) ?? [] }));
  }, [plan, selectedTrainingDays]);

  const analytics = useMemo(() => {
    const totalTss = plan.reduce((sum, session) => sum + session.tss, 0);
    const totalSeconds = plan.reduce(
      (sum, session) => sum + session.intervals.reduce((inner, interval) => inner + interval.duration_seconds, 0),
      0,
    );
    const completedCount = plan.reduce((count, session) => {
      const key = buildSessionKey(session.week, session.sessionInWeek);
      return completedSessions[key] ? count + 1 : count;
    }, 0);

    const zoneMinutes = {
      z1: 0,
      z2: 0,
      z3: 0,
      z4: 0,
      z5: 0,
      z6: 0,
    };

    for (const session of plan) {
      for (const interval of session.intervals) {
        const mins = interval.duration_seconds / 60;
        if (interval.power_percent_ftp < 56) zoneMinutes.z1 += mins;
        else if (interval.power_percent_ftp < 76) zoneMinutes.z2 += mins;
        else if (interval.power_percent_ftp < 91) zoneMinutes.z3 += mins;
        else if (interval.power_percent_ftp < 106) zoneMinutes.z4 += mins;
        else if (interval.power_percent_ftp < 121) zoneMinutes.z5 += mins;
        else zoneMinutes.z6 += mins;
      }
    }

    return {
      totalTss,
      totalMinutes: Math.round(totalSeconds / 60),
      completedCount,
      totalSessions: plan.length,
      zoneMinutes,
    };
  }, [plan, completedSessions]);

  const filteredPlan = useMemo(() => {
    const baseFiltered = planListFilter === 'All'
      ? plan
      : plan.filter((item) => {
        const sessionKey = buildSessionKey(item.week, item.sessionInWeek);
        const isCompleted = !!completedSessions[sessionKey];
        return planListFilter === 'Completed' ? isCompleted : !isCompleted;
      });

    if (!showFatiguedOnly) {
      return baseFiltered;
    }

    return baseFiltered.filter((item) => {
      if (!item.gameRideInfo) {
        return false;
      }

      return getReadinessLabel(item.gameRideInfo.readinessScore) === 'FATIGUED';
    });
  }, [plan, completedSessions, planListFilter, showFatiguedOnly]);

  const fatiguedSessions = useMemo(() => {
    return plan
      .filter((item) => item.gameRideInfo && getReadinessLabel(item.gameRideInfo.readinessScore) === 'FATIGUED')
      .sort((a, b) => a.week - b.week || a.sessionInWeek - b.sessionInWeek);
  }, [plan]);

  const readySessions = useMemo(() => {
    return plan
      .filter((item) => item.gameRideInfo && getReadinessLabel(item.gameRideInfo.readinessScore) === 'READY')
      .sort((a, b) => a.week - b.week || a.sessionInWeek - b.sessionInWeek);
  }, [plan]);

  const variedModePreview = useMemo(() => (
    VARIED_COMBOS.map((item) => item.label).join(' · ')
  ), []);

  const formatHistoryDate = useCallback((isoValue: string): string => {
    try {
      return new Date(isoValue).toLocaleString();
    } catch {
      return isoValue;
    }
  }, []);

  const exportValidation = useMemo(() => {
    if (!selectedWorkout) {
      return null;
    }

    const totalSeconds = selectedWorkout.intervals.reduce((sum, interval) => sum + interval.duration_seconds, 0);
    const hours = totalSeconds / 3600;
    const weightedPercent = totalSeconds > 0
      ? selectedWorkout.intervals.reduce((sum, interval) => sum + (interval.power_percent_ftp * interval.duration_seconds), 0) / totalSeconds
      : 0;
    const estimatedIf = Math.max(0, weightedPercent / 100);
    const zoneMinutes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };

    for (const interval of selectedWorkout.intervals) {
      const mins = interval.duration_seconds / 60;
      if (interval.power_percent_ftp < 56) zoneMinutes.z1 += mins;
      else if (interval.power_percent_ftp < 76) zoneMinutes.z2 += mins;
      else if (interval.power_percent_ftp < 91) zoneMinutes.z3 += mins;
      else if (interval.power_percent_ftp < 106) zoneMinutes.z4 += mins;
      else if (interval.power_percent_ftp < 121) zoneMinutes.z5 += mins;
      else zoneMinutes.z6 += mins;
    }

    const hardLongBlocks = selectedWorkout.intervals.filter(
      (interval) => interval.type === 'interval' && interval.power_percent_ftp >= 125 && interval.duration_seconds >= 180
    ).length;
    const recoverySeconds = selectedWorkout.intervals
      .filter((interval) => interval.type === 'recovery' || interval.type === 'cooldown')
      .reduce((sum, interval) => sum + interval.duration_seconds, 0);
    const recoveryRatio = totalSeconds > 0 ? recoverySeconds / totalSeconds : 0;

    let warning = '';
    if (hardLongBlocks >= 2) {
      warning = 'High strain detected: multiple long blocks >=125% FTP.';
    } else if (recoveryRatio < 0.18 && estimatedIf > 0.9) {
      warning = 'Low recovery ratio for this intensity. Consider easier recoveries.';
    }

    return {
      durationMinutes: Math.round(totalSeconds / 60),
      tss: selectedWorkout.tss,
      estimatedIf: Number(estimatedIf.toFixed(2)),
      zoneMinutes,
      warning,
      ftp: ftpNum > 0 ? ftpNum : undefined,
      hours: Number(hours.toFixed(2)),
    };
  }, [selectedWorkout, ftpNum]);

  const filteredExportHistory = useMemo(() => {
    const query = exportHistorySearch.trim().toLowerCase();
    const now = Date.now();

    return exportHistory.filter((entry) => {
      const createdAtTime = new Date(entry.createdAt).getTime();
      const ageMs = Number.isFinite(createdAtTime) ? now - createdAtTime : Number.POSITIVE_INFINITY;

      if (exportHistoryFilter === '24h' && ageMs > 24 * 60 * 60 * 1000) {
        return false;
      }

      if (exportHistoryFilter === '7d' && ageMs > 7 * 24 * 60 * 60 * 1000) {
        return false;
      }

      if (!query) {
        return true;
      }

      const formatLabel = EXPORT_FORMAT_LABELS[entry.format] ?? entry.format;
      return entry.label.toLowerCase().includes(query) || formatLabel.toLowerCase().includes(query);
    });
  }, [exportHistory, exportHistorySearch, exportHistoryFilter]);

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkoutDisplayName = async () => {
      try {
        const [
          storedLanguage,
          storedWorkoutDisplayName,
          storedExportName,
          storedExportFilenameTemplate,
          storedExportHistory,
          storedSessionFavorites,
          storedAdaptiveFeedback,
          storedTrainingDays,
          storedSessionExecution,
          storedPlan,
          storedSelectedPlanWorkout,
          storedCompletedSessions,
        ] = await Promise.all([
          AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY),
          AsyncStorage.getItem(WORKOUT_DISPLAY_NAME_STORAGE_KEY),
          AsyncStorage.getItem(EXPORT_NAME_STORAGE_KEY),
          AsyncStorage.getItem(EXPORT_FILENAME_TEMPLATE_STORAGE_KEY),
          AsyncStorage.getItem(EXPORT_HISTORY_STORAGE_KEY),
          AsyncStorage.getItem(SESSION_FAVORITES_STORAGE_KEY),
          AsyncStorage.getItem(ADAPTIVE_FEEDBACK_STORAGE_KEY),
          AsyncStorage.getItem(TRAINING_DAYS_STORAGE_KEY),
          AsyncStorage.getItem(SESSION_EXECUTION_LOG_STORAGE_KEY),
          AsyncStorage.getItem(PLAN_STORAGE_KEY),
          AsyncStorage.getItem(SELECTED_PLAN_WORKOUT_STORAGE_KEY),
          AsyncStorage.getItem(COMPLETED_SESSIONS_STORAGE_KEY),
        ]);

        if (!cancelled && (storedLanguage === 'ca' || storedLanguage === 'es' || storedLanguage === 'en')) {
          // L'eleccio de l'usuari mana sempre sobre la deteccio del navegador.
          setAppLanguage(storedLanguage);
        }

        if (!cancelled && typeof storedWorkoutDisplayName === 'string') {
          setWorkoutDisplayName(storedWorkoutDisplayName);
        }

        if (!cancelled && typeof storedExportName === 'string') {
          setExportName(storedExportName);
        }

        if (!cancelled && typeof storedExportFilenameTemplate === 'string' && storedExportFilenameTemplate.trim().length > 0) {
          setExportFilenameTemplate(storedExportFilenameTemplate);
        }

        if (!cancelled && typeof storedExportHistory === 'string') {
          try {
            const parsed = JSON.parse(storedExportHistory) as ExportHistoryEntry[];
            if (Array.isArray(parsed)) {
              setExportHistory(parsed.slice(0, 8).map((entry) => ({
                ...entry,
                format: EXPORT_FILE_FORMATS.includes(entry?.format as ExportFileFormat)
                  ? entry.format
                  : '.ictx',
              })));
            }
          } catch {
            setExportHistory([]);
          }
        }

        if (!cancelled && typeof storedSessionFavorites === 'string') {
          try {
            const parsed = JSON.parse(storedSessionFavorites) as SessionFavorite[];
            if (Array.isArray(parsed)) {
              setSessionFavorites(parsed.slice(0, 10));
            }
          } catch {
            setSessionFavorites([]);
          }
        }

        if (!cancelled && typeof storedAdaptiveFeedback === 'string') {
          try {
            const parsed = JSON.parse(storedAdaptiveFeedback) as AdaptiveFeedbackMap;
            if (parsed && typeof parsed === 'object') {
              setAdaptiveFeedback(parsed);
            }
          } catch {
            setAdaptiveFeedback({});
          }
        }

        if (!cancelled && typeof storedTrainingDays === 'string') {
          try {
            const parsed = JSON.parse(storedTrainingDays) as string[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedTrainingDays(parsed);
            }
          } catch {
            setSelectedTrainingDays(['Tue', 'Thu', 'Sat']);
          }
        }

        if (!cancelled && typeof storedSessionExecution === 'string') {
          try {
            const parsed = JSON.parse(storedSessionExecution) as SessionExecutionMap;
            if (parsed && typeof parsed === 'object') {
              setSessionExecutionLog(parsed);
            }
          } catch {
            setSessionExecutionLog({});
          }
        }

        if (!cancelled && typeof storedPlan === 'string') {
          try {
            const parsed = JSON.parse(storedPlan) as PlanWorkout[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPlan(parsed);
            }
          } catch {
            setPlan([]);
          }
        }

        if (!cancelled && typeof storedSelectedPlanWorkout === 'string') {
          setSelectedPlanWorkoutId(storedSelectedPlanWorkout);
        }

        if (!cancelled && typeof storedCompletedSessions === 'string') {
          try {
            const parsed = JSON.parse(storedCompletedSessions) as CompletedSessionMap;
            if (parsed && typeof parsed === 'object') {
              setCompletedSessions(parsed);
            }
          } catch {
            setCompletedSessions({});
          }
        }
      } catch (error) {
        console.warn('[HomeScreen] Could not load saved names from storage:', error);
      }
    };

    loadWorkoutDisplayName();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const savePlan = async () => {
      try {
        await AsyncStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
      } catch (error) {
        console.warn('[HomeScreen] Could not persist plan:', error);
      }
    };

    savePlan();
  }, [plan]);

  useEffect(() => {
    const saveSelectedPlanWorkout = async () => {
      try {
        await AsyncStorage.setItem(SELECTED_PLAN_WORKOUT_STORAGE_KEY, selectedPlanWorkoutId);
      } catch (error) {
        console.warn('[HomeScreen] Could not persist selected workout id:', error);
      }
    };

    saveSelectedPlanWorkout();
  }, [selectedPlanWorkoutId]);

  useEffect(() => {
    const saveCompletedSessions = async () => {
      try {
        await AsyncStorage.setItem(COMPLETED_SESSIONS_STORAGE_KEY, JSON.stringify(completedSessions));
      } catch (error) {
        console.warn('[HomeScreen] Could not persist completed sessions:', error);
      }
    };

    saveCompletedSessions();
  }, [completedSessions]);

  useEffect(() => {
    const saveLanguage = async () => {
      try {
        await AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, appLanguage);
      } catch (error) {
        console.warn('[HomeScreen] Could not persist app language:', error);
      }
    };

    saveLanguage();
  }, [appLanguage]);

  useEffect(() => {
    const saveWorkoutDisplayName = async () => {
      try {
        await AsyncStorage.setItem(WORKOUT_DISPLAY_NAME_STORAGE_KEY, workoutDisplayName);
      } catch (error) {
        console.warn('[HomeScreen] Could not persist workout display name:', error);
      }
    };

    saveWorkoutDisplayName();
  }, [workoutDisplayName]);

  useEffect(() => {
    const saveExportName = async () => {
      try {
        await AsyncStorage.setItem(EXPORT_NAME_STORAGE_KEY, exportName);
      } catch (error) {
        console.warn('[HomeScreen] Could not persist export name:', error);
      }
    };

    saveExportName();
  }, [exportName]);

  useEffect(() => {
    const saveExportFilenameTemplate = async () => {
      try {
        await AsyncStorage.setItem(EXPORT_FILENAME_TEMPLATE_STORAGE_KEY, exportFilenameTemplate);
      } catch (error) {
        console.warn('[HomeScreen] Could not persist export filename template:', error);
      }
    };

    saveExportFilenameTemplate();
  }, [exportFilenameTemplate]);

  useEffect(() => {
    const saveExportHistory = async () => {
      try {
        await AsyncStorage.setItem(EXPORT_HISTORY_STORAGE_KEY, JSON.stringify(exportHistory));
      } catch (error) {
        console.warn('[HomeScreen] Could not persist export history:', error);
      }
    };

    saveExportHistory();
  }, [exportHistory]);

  useEffect(() => {
    const saveFavorites = async () => {
      try {
        await AsyncStorage.setItem(SESSION_FAVORITES_STORAGE_KEY, JSON.stringify(sessionFavorites));
      } catch (error) {
        console.warn('[HomeScreen] Could not persist favorites:', error);
      }
    };

    saveFavorites();
  }, [sessionFavorites]);

  useEffect(() => {
    const saveAdaptiveFeedback = async () => {
      try {
        await AsyncStorage.setItem(ADAPTIVE_FEEDBACK_STORAGE_KEY, JSON.stringify(adaptiveFeedback));
      } catch (error) {
        console.warn('[HomeScreen] Could not persist adaptive feedback:', error);
      }
    };

    saveAdaptiveFeedback();
  }, [adaptiveFeedback]);

  useEffect(() => {
    const saveTrainingDays = async () => {
      try {
        await AsyncStorage.setItem(TRAINING_DAYS_STORAGE_KEY, JSON.stringify(selectedTrainingDays));
      } catch (error) {
        console.warn('[HomeScreen] Could not persist training days:', error);
      }
    };

    saveTrainingDays();
  }, [selectedTrainingDays]);

  useEffect(() => {
    const saveSessionExecutionLog = async () => {
      try {
        await AsyncStorage.setItem(SESSION_EXECUTION_LOG_STORAGE_KEY, JSON.stringify(sessionExecutionLog));
      } catch (error) {
        console.warn('[HomeScreen] Could not persist session execution log:', error);
      }
    };

    saveSessionExecutionLog();
  }, [sessionExecutionLog]);

  useEffect(() => {
    if (!selectedSessionKey) {
      setSessionRpeInput('');
      setSessionNoteInput('');
      return;
    }

    const existing = sessionExecutionLog[selectedSessionKey];
    if (!existing) {
      setSessionRpeInput('');
      setSessionNoteInput('');
      return;
    }

    setSessionRpeInput(String(existing.rpe));
    setSessionNoteInput(existing.note);
  }, [selectedSessionKey, sessionExecutionLog]);

  useEffect(() => {
    if (downloadStatus !== 'Names cleared.') {
      return;
    }

    const timer = setTimeout(() => {
      setDownloadStatus('');
    }, 2500);

    return () => {
      clearTimeout(timer);
    };
  }, [downloadStatus]);

  const showResults = useCallback(() => {
    resultOpacity.setValue(0);
    Animated.timing(resultOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [resultOpacity]);

  const generatePlanSession = useCallback(async (
    ftpValue: number,
    parsedDuration: WorkoutDuration,
    week: number,
    sessionInWeek: number,
    weeksCount: number,
    sessionsCount: number,
    isSingleWorkoutPlan: boolean,
    idSuffix: string,
    chaosOverride?: number,
    revengeBoost?: boolean,
    softRecoveryOverride?: boolean,
    hardPushOverride?: boolean,
  ): Promise<PlanWorkout> => {
    const phase = getWeeklyPhase(week, weeksCount);
    const adaptiveV2 = getAdaptiveSessionV2({
      objective: progressionObjective,
      baseDuration: parsedDuration,
      baseGoal: goal,
      baseStyle: style,
      level,
      phase,
      week,
      totalWeeks: weeksCount,
      sessionInWeek,
      sessionsPerWeek: sessionsCount,
    });
    const globalSessionIndex = ((week - 1) * sessionsCount) + (sessionInWeek - 1);
    const variedCombo = pickVariedComboForSession({
      combos: VARIED_COMBOS,
      globalSessionIndex,
      variedComboMode,
      surpriseRandomPerSessionMode,
    });
    const triFocusGoal = triFocusMode
      ? triFocusGoals[globalSessionIndex % triFocusGoals.length]
      : null;
    const durationForSession = adaptiveV2.duration || getPhaseDuration(parsedDuration, phase);
    const styleForSession = triFocusGoal
      ? getTriFocusStyle(triFocusGoal)
      : variedComboMode
      ? variedCombo.style
      : (adaptiveV2.style || getPhaseStyle(style, phase, sessionInWeek - 1));
    const goalForSession = triFocusGoal
      ? triFocusGoal
      : variedComboMode
      ? variedCombo.goal
      : (adaptiveV2.goal || getPhaseGoal(goal, phase));
    const crazyProfileLabel = getCrazyObjectiveProfileLabel(goalForSession, styleForSession);
    const sessionKey = buildSessionKey(week, sessionInWeek);
    const sessionChaos = Math.min(4, Math.max(1, Math.round(chaosOverride ?? sessionChaosMap[sessionKey] ?? 1)));
    const intensityMultiplier = getCrazyIntensityMultiplier(crazyIntensityLevel);
    const surpriseFactor = getCrazySurpriseFactor(crazySurpriseLevel);
    const effectiveChaos = Math.min(6, Math.max(1, Math.round(sessionChaos * intensityMultiplier)));
    const softenedChaos = softRecoveryOverride ? Math.max(1, effectiveChaos - 1) : effectiveChaos;
    const tunedChaos = hardPushOverride ? Math.min(6, softenedChaos + 1) : softenedChaos;
    const dayLabel = assignDayLabel(sessionInWeek - 1, selectedTrainingDays);
    const intensityAdjustment = adaptiveFeedback[sessionKey] ?? 0;
    const bkoolAdjustment = bkoolErgMode ? (bkoolConservativeMode ? -3 : -1) : 0;
    const progressionAdjustment = adaptiveV2.intensityAdjustmentPercent;
    const previousGlobalIndex = globalSessionIndex - 1;
    const previousSessionKey = previousGlobalIndex >= 0
      ? buildSessionKey(Math.floor(previousGlobalIndex / sessionsCount) + 1, (previousGlobalIndex % sessionsCount) + 1)
      : null;
    const previousExecution = previousSessionKey ? sessionExecutionLog[previousSessionKey] : undefined;
    const completedValues = Object.values(completedSessions);
    const completionRate = completedValues.length > 0
      ? completedValues.filter(Boolean).length / completedValues.length
      : 0.85;
    const previousRpe = Math.max(1, Math.min(10, previousExecution?.rpe ?? 6));
    const hrDriftPercent = clampNumber((previousRpe - 5) * 1.2 + ((adaptiveFeedback[sessionKey] ?? 0) < 0 ? 1.5 : 0.5), 1, 12);
    const cadenceStability = clampNumber((previousExecution ? 0.78 : 0.86) + ((adaptiveFeedback[sessionKey] ?? 0) > 0 ? 0.04 : -0.02), 0.45, 0.98);
    const softenedPreviousRpe = softRecoveryOverride ? Math.max(previousRpe, 9) : previousRpe;
    const softenedHrDrift = softRecoveryOverride ? Math.max(hrDriftPercent, 9) : hrDriftPercent;
    const softenedCadenceStability = softRecoveryOverride ? Math.min(cadenceStability, 0.62) : cadenceStability;
    const pushedPreviousRpe = hardPushOverride ? Math.max(1, softenedPreviousRpe - 2) : softenedPreviousRpe;
    const pushedHrDrift = hardPushOverride ? Math.max(1, softenedHrDrift - 2.5) : softenedHrDrift;
    const pushedCadenceStability = hardPushOverride ? Math.min(0.98, softenedCadenceStability + 0.12) : softenedCadenceStability;
    const recoveryBiasPercent = softRecoveryOverride ? -8 : 0;
    const pushBiasPercent = hardPushOverride ? 5 : 0;

    try {
      if (gameRideMode) {
        const gameRide = generateAdaptiveGameSession({
          duration: durationForSession,
          profile: gameRideProfile,
          signals: {
            previousRpe: pushedPreviousRpe,
            completionRate,
            hrDriftPercent: pushedHrDrift,
            cadenceStability: pushedCadenceStability,
          },
        });

        const shouldUseWeeklyBoss = !isSingleWorkoutPlan && sessionInWeek === sessionsCount;
        const aggressivePhases = gameRide.phases.filter((phaseItem) => phaseItem.branch === 'aggressive').length;
        const weaknessBase = Math.max(20, Math.min(80, Math.round((1 - completionRate) * 70 + Math.max(0, pushedPreviousRpe - 6) * 8)));
        const weaknessScores = {
          'VO2 Repeatability': weaknessBase + (goalForSession === 'VO2Max' || goalForSession === 'HIIT' ? 8 : 2),
          'Threshold Durability': weaknessBase + (goalForSession === 'Threshold' || goalForSession === 'Time Trial' ? 8 : 3),
          'Sprint Repeatability': weaknessBase + (goalForSession === 'Sprint Power' || goalForSession === 'Anaerobic Capacity' ? 8 : 2),
          'Cadence Control': weaknessBase + (goalForSession === 'Cadence Skills' ? 8 : 3),
        };

        const baseIntervals = shouldUseWeeklyBoss
          ? generateWeeklyBossWorkout({
              duration: durationForSession,
              weaknessScores,
            }).intervals
          : gameRide.intervals;

        const crazySession = applyCrazyModesToSession(baseIntervals, durationForSession * 60, {
          bossFight: bossFightMode,
          dice: diceMode,
          musicDrops: musicDropsMode,
          zigZag: zigZagMode,
          lastMinuteTwist: lastMinuteTwistMode,
          chaosFactor: tunedChaos,
          surpriseFactor,
          revengeBoost,
        }, goalForSession, styleForSession, ftpValue);

        const normalizedIntervals = normalizeIntervalSequence(crazySession.intervals, durationForSession * 60);

        const baseSummary = shouldUseWeeklyBoss
          ? `${gameRide.summary} • Weekly Boss activated`
          : gameRide.summary;
        const accurateSummary = buildAccurateWorkoutSummary(baseSummary, normalizedIntervals);

        return {
          id: `${week}-${sessionInWeek}-${Date.now()}-${idSuffix}`,
          name: isSingleWorkoutPlan ? 'Game Ride Workout' : `Week ${week} • Session ${sessionInWeek}`,
          summary: accurateSummary,
          intervals: normalizedIntervals,
          tss: calculateTSS(normalizedIntervals, ftpValue),
          tssCapped: crazySession.tssCapped,
          crazyProfileLabel,
          gameRideInfo: {
            profile: gameRideProfile,
            readinessScore: gameRide.readinessScore,
            aggressivePhases,
            totalPhases: gameRide.phases.length,
            weeklyBoss: shouldUseWeeklyBoss,
          },
          week,
          sessionInWeek,
          phase,
          dayLabel,
        };
      }

      const result = await generateWorkout({
        ftp: ftpValue,
        duration: durationForSession,
        goal: goalForSession,
        level,
        style: styleForSession,
        warmupMinutes: Math.max(1, Math.min(5, warmupMinutesNum || 5)),
        cooldownMinutes: Math.max(1, Math.min(20, cooldownMinutesNum || 6)),
        warmupPowerPercent: Math.max(40, Math.min(85, warmupPowerPercentNum || 55)),
        cooldownPowerPercent: Math.max(35, Math.min(75, cooldownPowerPercentNum || 45)),
        intensityAdjustmentPercent: intensityAdjustment + bkoolAdjustment + progressionAdjustment + recoveryBiasPercent + pushBiasPercent,
        ergSmoothMode: bkoolErgMode,
      });

      const advancedModeResult = applyAdvancedTrainingMode({
        mode: gameRideMode ? 'Off' : advancedTrainingMode,
        duration: durationForSession,
        week,
        level,
        spinStyle: spinClassStyle,
        baseIntervals: result.intervals,
        raceProfile: raceSimulatorProfile,
        blockFocus: blockPeriodizationFocus,
        signals: {
          previousRpe: pushedPreviousRpe,
          hrDriftPercent: pushedHrDrift,
          cadenceStability: pushedCadenceStability,
        },
      });

      const mixedSingleIntervals = (isSingleWorkoutPlan && singleSessionMixMode)
        ? buildSingleSessionFourComboMix(advancedModeResult.intervals, durationForSession * 60)
        : advancedModeResult.intervals;
      const variedModeIntervals = variedComboMode
        ? buildVariedComboSession(mixedSingleIntervals, durationForSession * 60, variedCombo, effectiveChaos, surpriseFactor)
        : mixedSingleIntervals;
      const crazySession = applyCrazyModesToSession(variedModeIntervals, durationForSession * 60, {
        bossFight: bossFightMode,
        dice: diceMode,
        musicDrops: musicDropsMode,
        zigZag: zigZagMode,
        lastMinuteTwist: lastMinuteTwistMode,
        chaosFactor: tunedChaos,
        surpriseFactor,
        revengeBoost,
      }, goalForSession, styleForSession, ftpValue);
      const crazyIntervals = normalizeIntervalSequence(crazySession.intervals, durationForSession * 60);

      const baseSummary = variedComboMode
        ? `${result.summary} (${variedCombo.label})${advancedModeResult.summarySuffix.length ? ` · ${advancedModeResult.summarySuffix}` : ''}`
        : (isSingleWorkoutPlan && singleSessionMixMode)
          ? `${result.summary} (Single-session mix: VO2Max + HIIT + Polarized + Cadence Skills)${advancedModeResult.summarySuffix.length ? ` · ${advancedModeResult.summarySuffix}` : ''}`
          : `${result.summary}${advancedModeResult.summarySuffix.length ? ` · ${advancedModeResult.summarySuffix}` : ''}`;
      const accurateSummary = buildAccurateWorkoutSummary(baseSummary, crazyIntervals);

      return {
        id: `${week}-${sessionInWeek}-${Date.now()}-${idSuffix}`,
        name: isSingleWorkoutPlan ? 'Workout' : `Week ${week} • Session ${sessionInWeek}`,
        summary: accurateSummary,
        intervals: crazyIntervals,
        tss: calculateTSS(crazyIntervals, ftpValue),
        tssCapped: crazySession.tssCapped,
        crazyProfileLabel,
        advancedModeLabel: advancedModeResult.label !== 'Off' ? advancedModeResult.label : undefined,
        week,
        sessionInWeek,
        phase,
        dayLabel,
      };
    } catch (sessionError) {
      console.error('[HomeScreen] Session generation failed. Using local fallback session.', {
        week,
        sessionInWeek,
        styleForSession,
        sessionError,
      });

      const localFallbackIntervals: WorkoutInterval[] = [
        { type: 'warmup', duration_seconds: 8 * 60, power_percent_ftp: 55 },
        {
          type: 'interval',
          duration_seconds: Math.max(8 * 60, durationForSession * 60 - 14 * 60),
          power_percent_ftp: Math.max(65, Math.min(120, 88 + progressionAdjustment + recoveryBiasPercent + pushBiasPercent)),
        },
        { type: 'cooldown', duration_seconds: 6 * 60, power_percent_ftp: 45 },
      ];

      const advancedFallbackResult = applyAdvancedTrainingMode({
        mode: gameRideMode ? 'Off' : advancedTrainingMode,
        duration: durationForSession,
        week,
        level,
        spinStyle: spinClassStyle,
        baseIntervals: localFallbackIntervals,
        raceProfile: raceSimulatorProfile,
        blockFocus: blockPeriodizationFocus,
        signals: {
          previousRpe: pushedPreviousRpe,
          hrDriftPercent: pushedHrDrift,
          cadenceStability: pushedCadenceStability,
        },
      });

      const mixedFallbackIntervals = (isSingleWorkoutPlan && singleSessionMixMode)
        ? buildSingleSessionFourComboMix(advancedFallbackResult.intervals, durationForSession * 60)
        : advancedFallbackResult.intervals;
      const variedFallbackIntervals = variedComboMode
        ? buildVariedComboSession(mixedFallbackIntervals, durationForSession * 60, variedCombo, effectiveChaos, surpriseFactor)
        : mixedFallbackIntervals;
      const crazyFallbackSession = applyCrazyModesToSession(variedFallbackIntervals, durationForSession * 60, {
        bossFight: bossFightMode,
        dice: diceMode,
        musicDrops: musicDropsMode,
        zigZag: zigZagMode,
        lastMinuteTwist: lastMinuteTwistMode,
        chaosFactor: tunedChaos,
        surpriseFactor,
        revengeBoost,
      }, goalForSession, styleForSession, ftpValue);
      const crazyFallbackIntervals = normalizeIntervalSequence(crazyFallbackSession.intervals, durationForSession * 60);

      const baseSummary = variedComboMode
        ? `Fallback ${goalForSession} session generated locally. (${variedCombo.label})`
        : (isSingleWorkoutPlan && singleSessionMixMode)
          ? 'Fallback varied single-session mix generated locally.'
          : `Fallback ${goalForSession} session generated locally.${advancedFallbackResult.summarySuffix.length ? ` · ${advancedFallbackResult.summarySuffix}` : ''}`;
      const accurateSummary = buildAccurateWorkoutSummary(baseSummary, crazyFallbackIntervals);

      return {
        id: `${week}-${sessionInWeek}-${Date.now()}-${idSuffix}`,
        name: isSingleWorkoutPlan ? 'Workout' : `Week ${week} • Session ${sessionInWeek}`,
        summary: accurateSummary,
        intervals: crazyFallbackIntervals,
        tss: calculateTSS(crazyFallbackIntervals, ftpValue),
        tssCapped: crazyFallbackSession.tssCapped,
        crazyProfileLabel,
        advancedModeLabel: advancedFallbackResult.label !== 'Off' ? advancedFallbackResult.label : undefined,
        week,
        sessionInWeek,
        phase,
        dayLabel,
      };
    }
  }, [
    style,
    goal,
    level,
    warmupMinutesNum,
    cooldownMinutesNum,
    warmupPowerPercentNum,
    cooldownPowerPercentNum,
    adaptiveFeedback,
    selectedTrainingDays,
    bkoolErgMode,
    bkoolConservativeMode,
    progressionObjective,
    variedComboMode,
    surpriseRandomPerSessionMode,
    singleSessionMixMode,
    advancedTrainingMode,
    raceSimulatorProfile,
    blockPeriodizationFocus,
    gameRideMode,
    gameRideProfile,
    triFocusMode,
    triFocusGoals,
    completedSessions,
    sessionExecutionLog,
    sessionChaosMap,
    bossFightMode,
    diceMode,
    musicDropsMode,
    zigZagMode,
    lastMinuteTwistMode,
    crazyIntensityLevel,
    crazySurpriseLevel,
  ]);

  useEffect(() => {
    setProgressionObjective((current) => resolveProgressionObjectiveOnGoalChange({
      currentProgression: current,
      goal,
      autoProgressionFromGoal,
    }));
  }, [goal, autoProgressionFromGoal]);

  const mutation = useMutation({
    mutationFn: async () => {
      const ftpValue = parseInt(ftp, 10);
      if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
        throw new Error('Please enter a valid FTP between 50 and 500 watts.');
      }

      const weeksCount = parseCount(planWeeks);
      const sessionsCount = parseCount(sessionsPerWeek);
      const totalSessions = weeksCount * sessionsCount;
      const isSingleWorkoutPlan = totalSessions === 1;

      if (totalSessions < 1 || totalSessions > 48) {
        throw new Error('Plan size is invalid. Try fewer weeks or sessions.');
      }

      startPulse();

      const generatedPlan: PlanWorkout[] = [];
      const parsedDuration = parseDuration(duration);

      for (let i = 0; i < totalSessions; i += 1) {
        const week = Math.floor(i / sessionsCount) + 1;
        const sessionInWeek = (i % sessionsCount) + 1;
        const generatedWorkout = await generatePlanSession(
          ftpValue,
          parsedDuration,
          week,
          sessionInWeek,
          weeksCount,
          sessionsCount,
          isSingleWorkoutPlan,
          String(i),
        );

        generatedPlan.push(generatedWorkout);
      }

      if (generatedPlan.length === 0) {
        throw new Error('Could not generate any workout sessions.');
      }

      const balancedPlan = rebalancePlanLoad(generatedPlan, ftpValue);
      return balancedPlan;
    },
    onSuccess: (generatedPlan) => {
      stopPulse();
      console.log('[HomeScreen] Plan generated successfully. Sessions:', generatedPlan.length);

      setPlan(generatedPlan);
      const validKeys = new Set(generatedPlan.map((item) => buildSessionKey(item.week, item.sessionInWeek)));
      setCompletedSessions((current) => {
        const filtered: CompletedSessionMap = {};
        for (const [key, value] of Object.entries(current)) {
          if (validKeys.has(key)) {
            filtered[key] = value;
          }
        }
        return filtered;
      });
      setSessionExecutionLog((current) => {
        const filtered: SessionExecutionMap = {};
        for (const [key, value] of Object.entries(current)) {
          if (validKeys.has(key)) {
            filtered[key] = value;
          }
        }
        return filtered;
      });
      setSessionChaosMap((current) => {
        const filtered: SessionChaosMap = {};
        for (const [key, value] of Object.entries(current)) {
          if (validKeys.has(key)) {
            filtered[key] = value;
          }
        }
        return filtered;
      });
      setSelectedPlanWorkoutId(generatedPlan[0]?.id ?? '');
      showResults();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    },
    onError: (error: Error) => {
      stopPulse();
      console.error('[HomeScreen] Generation failed:', error);
      const message = error.message?.trim() || t('generationFailedFallback');
      Alert.alert(t('generationFailedTitle'), message);
    },
  });

  const { mutate, isPending } = mutation;

  const handleGenerate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mutate();
  }, [mutate]);

  const handleRegenerateSelected = useCallback(async () => {
    if (!selectedWorkout || isPending || regeneratingWorkoutId.length > 0) {
      return;
    }

    const ftpValue = parseInt(ftp, 10);
    if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
      Alert.alert(t('invalidFtpTitle'), t('invalidFtpMessage'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRegeneratingWorkoutId(selectedWorkout.id);

    try {
      const weeksCount = parseCount(planWeeks);
      const sessionsCount = parseCount(sessionsPerWeek);
      const totalSessions = weeksCount * sessionsCount;
      const parsedDuration = parseDuration(duration);

      const regeneratedWorkout = await generatePlanSession(
        ftpValue,
        parsedDuration,
        selectedWorkout.week,
        selectedWorkout.sessionInWeek,
        weeksCount,
        sessionsCount,
        totalSessions === 1,
        'single-regenerate',
      );

      setPlan((currentPlan) => currentPlan.map((item) => (
        item.id === selectedWorkout.id
          ? {
              ...regeneratedWorkout,
              id: item.id,
            }
          : item
      )));

      setDownloadStatus(t('selectedWorkoutRegenerated'));
    } catch (error) {
      console.error('[HomeScreen] Could not regenerate selected workout:', error);
      Alert.alert(t('regenerationFailedTitle'), t('regenerationFailedMessage'));
    } finally {
      setRegeneratingWorkoutId('');
    }
  }, [
    selectedWorkout,
    isPending,
    regeneratingWorkoutId,
    ftp,
    planWeeks,
    sessionsPerWeek,
    duration,
    generatePlanSession,
  ]);

  const handleMoreChaosSelected = useCallback(async () => {
    if (!selectedWorkout || isPending || regeneratingWorkoutId.length > 0) {
      return;
    }

    const ftpValue = parseInt(ftp, 10);
    if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
      Alert.alert(t('invalidFtpTitle'), t('invalidFtpMessage'));
      return;
    }

    const weeksCount = parseCount(planWeeks);
    const sessionsCount = parseCount(sessionsPerWeek);
    const totalSessions = weeksCount * sessionsCount;
    const parsedDuration = parseDuration(duration);
    const sessionKey = buildSessionKey(selectedWorkout.week, selectedWorkout.sessionInWeek);
    const currentChaos = Math.min(4, Math.max(1, Math.round(sessionChaosMap[sessionKey] ?? 1)));
    const nextChaos = Math.min(4, currentChaos + 1);
    const shouldForceChaosBoost =
      !variedComboMode &&
      !singleSessionMixMode &&
      !bossFightMode &&
      !diceMode &&
      !musicDropsMode &&
      !zigZagMode &&
      !lastMinuteTwistMode;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRegeneratingWorkoutId(selectedWorkout.id);

    try {
      const regeneratedWorkout = await generatePlanSession(
        ftpValue,
        parsedDuration,
        selectedWorkout.week,
        selectedWorkout.sessionInWeek,
        weeksCount,
        sessionsCount,
        totalSessions === 1,
        'chaos-regenerate',
        nextChaos,
        shouldForceChaosBoost,
      );

      setSessionChaosMap((current) => ({
        ...current,
        [sessionKey]: nextChaos,
      }));

      setPlan((currentPlan) => currentPlan.map((item) => (
        item.id === selectedWorkout.id
          ? {
              ...regeneratedWorkout,
              id: item.id,
            }
          : item
      )));

      setDownloadStatus(
        shouldForceChaosBoost
          ? t('chaosLevelAutoApplied', { level: nextChaos })
          : t('chaosLevelApplied', { level: nextChaos })
      );
    } catch (error) {
      console.error('[HomeScreen] Could not apply more chaos to selected workout:', error);
      Alert.alert(t('chaosFailedTitle'), t('chaosFailedMessage'));
    } finally {
      setRegeneratingWorkoutId('');
    }
  }, [
    selectedWorkout,
    isPending,
    regeneratingWorkoutId,
    ftp,
    planWeeks,
    sessionsPerWeek,
    duration,
    sessionChaosMap,
    variedComboMode,
    singleSessionMixMode,
    bossFightMode,
    diceMode,
    musicDropsMode,
    zigZagMode,
    lastMinuteTwistMode,
    generatePlanSession,
  ]);

  const handleRevengeSelected = useCallback(async () => {
    if (!selectedWorkout || isPending || regeneratingWorkoutId.length > 0) {
      return;
    }

    const ftpValue = parseInt(ftp, 10);
    if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
      Alert.alert(t('invalidFtpTitle'), t('invalidFtpMessage'));
      return;
    }

    const weeksCount = parseCount(planWeeks);
    const sessionsCount = parseCount(sessionsPerWeek);
    const totalSessions = weeksCount * sessionsCount;
    const parsedDuration = parseDuration(duration);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRegeneratingWorkoutId(selectedWorkout.id);

    try {
      const regeneratedWorkout = await generatePlanSession(
        ftpValue,
        parsedDuration,
        selectedWorkout.week,
        selectedWorkout.sessionInWeek,
        weeksCount,
        sessionsCount,
        totalSessions === 1,
        'revenge-regenerate',
        undefined,
        true,
      );

      setPlan((currentPlan) => currentPlan.map((item) => (
        item.id === selectedWorkout.id
          ? {
              ...regeneratedWorkout,
              id: item.id,
            }
          : item
      )));

      setDownloadStatus(t('revengeApplied'));
    } catch (error) {
      console.error('[HomeScreen] Could not apply revenge mode:', error);
      Alert.alert(t('revengeFailedTitle'), t('revengeFailedMessage'));
    } finally {
      setRegeneratingWorkoutId('');
    }
  }, [
    selectedWorkout,
    isPending,
    regeneratingWorkoutId,
    ftp,
    planWeeks,
    sessionsPerWeek,
    duration,
    generatePlanSession,
  ]);

  const handleRecoverSelected = useCallback(async () => {
    if (!selectedWorkout || isPending || regeneratingWorkoutId.length > 0) {
      return;
    }

    const ftpValue = parseInt(ftp, 10);
    if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
      Alert.alert(t('invalidFtpTitle'), t('invalidFtpMessage'));
      return;
    }

    const weeksCount = parseCount(planWeeks);
    const sessionsCount = parseCount(sessionsPerWeek);
    const totalSessions = weeksCount * sessionsCount;
    const parsedDuration = parseDuration(duration);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRegeneratingWorkoutId(selectedWorkout.id);

    try {
      const regeneratedWorkout = await generatePlanSession(
        ftpValue,
        parsedDuration,
        selectedWorkout.week,
        selectedWorkout.sessionInWeek,
        weeksCount,
        sessionsCount,
        totalSessions === 1,
        'recover-regenerate',
        undefined,
        false,
        true,
      );

      setPlan((currentPlan) => currentPlan.map((item) => (
        item.id === selectedWorkout.id
          ? {
              ...regeneratedWorkout,
              id: item.id,
            }
          : item
      )));

      setDownloadStatus(t('recoveryAppliedSelected'));
    } catch (error) {
      console.error('[HomeScreen] Could not apply recovery tune:', error);
      Alert.alert(t('recoveryFailedTitle'), t('recoveryFailedMessage'));
    } finally {
      setRegeneratingWorkoutId('');
    }
  }, [
    selectedWorkout,
    isPending,
    regeneratingWorkoutId,
    ftp,
    planWeeks,
    sessionsPerWeek,
    duration,
    generatePlanSession,
  ]);

  const handleRecoverAllFatigued = useCallback(async () => {
    if (isPending || regeneratingWorkoutId.length > 0) {
      return;
    }

    if (fatiguedSessions.length === 0) {
      setDownloadStatus(t('noFatiguedSessions'));
      return;
    }

    const ftpValue = parseInt(ftp, 10);
    if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
      Alert.alert(t('invalidFtpTitle'), t('invalidFtpMessage'));
      return;
    }

    const weeksCount = parseCount(planWeeks);
    const sessionsCount = parseCount(sessionsPerWeek);
    const totalSessions = weeksCount * sessionsCount;
    const parsedDuration = parseDuration(duration);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRegeneratingWorkoutId('__bulk-recover__');

    try {
      const replacements = new Map<string, PlanWorkout>();

      for (let i = 0; i < fatiguedSessions.length; i += 1) {
        const target = fatiguedSessions[i];

        const regeneratedWorkout = await generatePlanSession(
          ftpValue,
          parsedDuration,
          target.week,
          target.sessionInWeek,
          weeksCount,
          sessionsCount,
          totalSessions === 1,
          `recover-all-${i}`,
          undefined,
          false,
          true,
        );

        replacements.set(target.id, {
          ...regeneratedWorkout,
          id: target.id,
        });
      }

      setPlan((currentPlan) => currentPlan.map((item) => replacements.get(item.id) ?? item));
      setDownloadStatus(t('recoveryAppliedCount', { count: replacements.size }));
    } catch (error) {
      console.error('[HomeScreen] Could not apply recovery tune to all fatigued sessions:', error);
      Alert.alert(t('bulkRecoveryFailedTitle'), t('bulkRecoveryFailedMessage'));
    } finally {
      setRegeneratingWorkoutId('');
    }
  }, [
    isPending,
    regeneratingWorkoutId,
    fatiguedSessions,
    ftp,
    planWeeks,
    sessionsPerWeek,
    duration,
    generatePlanSession,
  ]);

  const handlePushAllReady = useCallback(async () => {
    if (isPending || regeneratingWorkoutId.length > 0) {
      return;
    }

    if (readySessions.length === 0) {
      setDownloadStatus(t('noReadySessions'));
      return;
    }

    const ftpValue = parseInt(ftp, 10);
    if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
      Alert.alert(t('invalidFtpTitle'), t('invalidFtpMessage'));
      return;
    }

    const weeksCount = parseCount(planWeeks);
    const sessionsCount = parseCount(sessionsPerWeek);
    const totalSessions = weeksCount * sessionsCount;
    const parsedDuration = parseDuration(duration);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRegeneratingWorkoutId('__bulk-push__');

    try {
      const replacements = new Map<string, PlanWorkout>();

      for (let i = 0; i < readySessions.length; i += 1) {
        const target = readySessions[i];

        const regeneratedWorkout = await generatePlanSession(
          ftpValue,
          parsedDuration,
          target.week,
          target.sessionInWeek,
          weeksCount,
          sessionsCount,
          totalSessions === 1,
          `push-all-${i}`,
          undefined,
          false,
          false,
          true,
        );

        replacements.set(target.id, {
          ...regeneratedWorkout,
          id: target.id,
        });
      }

      setPlan((currentPlan) => currentPlan.map((item) => replacements.get(item.id) ?? item));
      setDownloadStatus(t('pushAppliedCount', { count: replacements.size }));
    } catch (error) {
      console.error('[HomeScreen] Could not apply push tune to all ready sessions:', error);
      Alert.alert(t('bulkPushFailedTitle'), t('bulkPushFailedMessage'));
    } finally {
      setRegeneratingWorkoutId('');
    }
  }, [
    isPending,
    regeneratingWorkoutId,
    readySessions,
    ftp,
    planWeeks,
    sessionsPerWeek,
    duration,
    generatePlanSession,
  ]);

  // Envia l'entrenament al reproductor Bluetooth (public/bici.html). Comparteixen origen, aixi que
  // viatja per localStorage: si el reproductor ja es obert el rep a l'instant (event 'storage') i no
  // es recarrega, perque recarregar-lo tallaria la connexio amb la bici.
  const handleRideOnBike = useCallback((workout: { name: string; intervals: WorkoutInterval[] }) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem('cc.pendingWorkout', JSON.stringify({
        name: workout.name,
        ftp: ftpNum > 0 ? ftpNum : undefined,
        intervals: workout.intervals,
        sentAt: Date.now(),
      }));

      const player = window.open('', 'cycleconnect-bici');
      if (!player) {
        window.location.href = '/bici.html';
        return;
      }

      let alreadyOpen = false;
      try {
        alreadyOpen = player.location.pathname.endsWith('/bici.html');
      } catch {
        alreadyOpen = false;
      }

      if (!alreadyOpen) {
        player.location.href = '/bici.html';
      }
      player.focus();
    } catch (error) {
      console.error('[HomeScreen] Could not send workout to the bike player:', error);
    }
  }, [ftpNum]);

  const buildWorkoutExportContent = useCallback((format: ExportSingleFileFormat, workout: PlanWorkout, workoutName: string): string => {
    if (format === '.ictx') {
      return generateIctxXml(workout.intervals, workoutName, {
        previewImageBase64: buildIctxPreviewImage(workout.intervals),
        goal,
        includePostureCues: includeSpinCuesInIctx,
        level,
        description: workout.summary,
        ftpWatts: ftpNum > 0 ? ftpNum : 250,
      });
    }

    if (format === '.zwo') {
      return generateZwoXml(workout.intervals, workoutName);
    }

    if (format === '.mrc') {
      return generateMrcText(workout.intervals, workoutName);
    }

    return generateErgText(workout.intervals, ftpNum > 0 ? ftpNum : 200, workoutName);
  }, [goal, includeSpinCuesInIctx, ftpNum, level]);

  const exportPlanFiles = useCallback(async (options?: { forcedFormat?: ExportFileFormat; forcedLabel?: string }) => {
    if (plan.length === 0) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const activeFormat = options?.forcedFormat ?? exportFileFormat;
    const activeTargets = resolveExportTargets(activeFormat);
    const customWorkoutName = (options?.forcedLabel ?? workoutDisplayName).trim();
    const goalSlug = resolveFilenameTokenValue(filenameGoalValue, sanitizeFilenamePart(goal));
    const customBaseName = sanitizeFilenamePart(exportName);
    const workoutNameSlug = sanitizeFilenamePart(customWorkoutName);
    const dateToken = resolveFilenameTokenValue(filenameDateValue, buildFilenameDateToken());
    const uniqueSuffix = buildUniqueSuffix();
    const exportStamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const sessionsCount = parseCount(sessionsPerWeek);
    const totalFilesToExport = plan.length * activeTargets.length;
    const template = exportFilenameTemplate.trim().length > 0
      ? exportFilenameTemplate.trim()
      : EXPORT_FILENAME_TEMPLATE_PRESETS[0];

    let successfulDownloads = 0;
    setDownloadStatus(t('preparingFiles', { count: totalFilesToExport }));

    for (let i = 0; i < plan.length; i += 1) {
      const workout = plan[i];
      const weekNumber = Math.floor(i / sessionsCount) + 1;
      const sessionNumber = (i % sessionsCount) + 1;

      const templateBaseName = applyFilenameTemplate(template, {
        goal: goalSlug,
        duration: resolveFilenameTokenValue(filenameDurationValue, sanitizeFilenamePart(duration.replace(/\s+/g, ''))),
        week: resolveFilenameTokenValue(filenameWeekValue, `${weekNumber}`),
        session: resolveFilenameTokenValue(filenameSessionValue, `${sessionNumber}`),
        date: dateToken,
        workout: resolveFilenameTokenValue(filenameWorkoutValue, sanitizeFilenamePart(workout.name)),
      });

      const hasCustomBaseName = customBaseName.length > 0 || workoutNameSlug.length > 0;
      const baseName = customBaseName.length > 0
        ? customBaseName
        : workoutNameSlug.length > 0
          ? workoutNameSlug
          : templateBaseName.length > 0
            ? templateBaseName
            : `cycleplan_${goalSlug}`;

      const zwoWorkoutName = customWorkoutName.length === 0
        ? plan.length === 1
          ? `${workout.name} • ${exportStamp}`
          : workout.name
        : plan.length === 1
          ? customWorkoutName
          : `${customWorkoutName} • W${weekNumber} S${sessionNumber}`;

      for (const targetFormat of activeTargets) {
        const filenameCore = plan.length === 1
          ? `${baseName}${hasCustomBaseName ? '' : `_${uniqueSuffix}`}`
          : `${baseName}_w${weekNumber}_s${sessionNumber}${hasCustomBaseName ? '' : `_${uniqueSuffix}`}`;
        const filename = `${filenameCore}${targetFormat}`;
        const fileContent = buildWorkoutExportContent(targetFormat, workout, zwoWorkoutName);
        const downloaded = await downloadZwoFile(fileContent, filename);

        if (downloaded) {
          successfulDownloads += 1;
        }

        if (Platform.OS === 'web') {
          setDownloadStatus(t('downloadedProgress', { done: successfulDownloads, total: totalFilesToExport }));
          await wait(180);
        } else {
          break;
        }
      }

      if (Platform.OS !== 'web') {
        break;
      }
    }

    if (successfulDownloads > 0) {
      const historyLabel = customWorkoutName.length > 0
        ? customWorkoutName
        : (plan.length === 1 ? getDisplayWorkoutName(plan[0]) : `${goal} plan`);

      setExportHistory((currentHistory) => [
        {
          id: `${Date.now()}-${successfulDownloads}`,
          label: historyLabel,
          files: successfulDownloads,
          createdAt: new Date().toISOString(),
          format: activeFormat,
          template,
        },
        ...currentHistory,
      ].slice(0, 8));

      if (Platform.OS === 'web') {
        setDownloadStatus(t('doneExported', { count: successfulDownloads }));
        Alert.alert(t('planDownloadedTitle'), `${successfulDownloads} workout file(s) exported.`);
      } else {
        setDownloadStatus(t('workoutExportedShare'));
        Alert.alert(t('workoutReadyTitle'), t('workoutReadyMessage'));
      }
      return;
    }

    setDownloadStatus(t('noFilesDownloaded'));
  }, [
    plan,
    exportFileFormat,
    workoutDisplayName,
    goal,
    exportName,
    sessionsPerWeek,
    duration,
    exportFilenameTemplate,
    filenameGoalValue,
    filenameDurationValue,
    filenameWeekValue,
    filenameSessionValue,
    filenameDateValue,
    filenameWorkoutValue,
    resolveFilenameTokenValue,
    ftpNum,
    buildWorkoutExportContent,
    getDisplayWorkoutName,
  ]);

  const handleDownloadPlan = useCallback(async () => {
    await exportPlanFiles();
  }, [exportPlanFiles]);

  const handleReexportHistoryEntry = useCallback(async (entry: ExportHistoryEntry) => {
    if (!plan.length) {
      return;
    }

    await exportPlanFiles({
      forcedFormat: entry.format,
      forcedLabel: entry.label,
    });
  }, [plan.length, exportPlanFiles]);

  const handleResetNames = useCallback(async () => {
    Alert.alert(
      t('clearSavedNamesTitle'),
      t('clearSavedNamesMessage'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('clear'),
          style: 'destructive',
          onPress: async () => {
            setExportName('');
            setWorkoutDisplayName('');

            try {
              await AsyncStorage.multiRemove([
                WORKOUT_DISPLAY_NAME_STORAGE_KEY,
                EXPORT_NAME_STORAGE_KEY,
              ]);
              setDownloadStatus(t('namesCleared'));
            } catch (error) {
              console.warn('[HomeScreen] Could not clear saved names:', error);
            }
          },
        },
      ]
    );
  }, []);

  const handleSaveFavorite = useCallback(() => {
    const favoriteName = `${goal} ${duration}`;

    const newFavorite: SessionFavorite = {
      id: `${Date.now()}`,
      name: favoriteName,
      duration,
      goal,
      level,
      style,
      warmupMinutes,
      cooldownMinutes,
      warmupPowerPercent,
      cooldownPowerPercent,
    };

    setSessionFavorites((current) => {
      const withoutDuplicate = current.filter((item) => item.name !== newFavorite.name);
      return [newFavorite, ...withoutDuplicate].slice(0, 10);
    });

    setDownloadStatus(t('savedFavoriteStatus', { name: favoriteName }));
  }, [
    goal,
    duration,
    level,
    style,
    warmupMinutes,
    cooldownMinutes,
    warmupPowerPercent,
    cooldownPowerPercent,
  ]);

  const applyFavorite = useCallback((favorite: SessionFavorite) => {
    setDuration(favorite.duration);
    setGoal(favorite.goal);
    setLevel(favorite.level);
    setStyle(favorite.style);
    setWarmupMinutes(String(Math.max(1, Math.min(5, parseInt(favorite.warmupMinutes, 10) || 5))));
    setCooldownMinutes(favorite.cooldownMinutes);
    setWarmupPowerPercent(favorite.warmupPowerPercent);
    setCooldownPowerPercent(favorite.cooldownPowerPercent);
    setDownloadStatus(t('loadedFavoriteStatus', { name: favorite.name }));
  }, []);

  const removeFavorite = useCallback((favoriteId: string) => {
    setSessionFavorites((current) => current.filter((item) => item.id !== favoriteId));
  }, []);

  const toggleTrainingDay = useCallback((day: string) => {
    setSelectedTrainingDays((current) => {
      if (current.includes(day)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((item) => item !== day);
      }

      return [...current, day];
    });
  }, []);

  const toggleSessionComplete = useCallback((workout: PlanWorkout) => {
    const key = buildSessionKey(workout.week, workout.sessionInWeek);
    setCompletedSessions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, []);

  const saveSelectedSessionExecution = useCallback(() => {
    if (!selectedWorkout || !selectedSessionKey) {
      return;
    }

    const rpe = parseInt(sessionRpeInput, 10);
    if (!rpe || rpe < 1 || rpe > 10) {
      Alert.alert(t('invalidRpeTitle'), t('invalidRpeMessage'));
      return;
    }

    const trimmedNote = sessionNoteInput.trim();
    if (trimmedNote.length > 180) {
      Alert.alert(t('noteTooLongTitle'), t('noteTooLongMessage'));
      return;
    }

    const entry: SessionExecutionEntry = {
      rpe,
      note: trimmedNote,
      completedAt: new Date().toISOString(),
    };

    setSessionExecutionLog((current) => ({
      ...current,
      [selectedSessionKey]: entry,
    }));
    setCompletedSessions((current) => ({
      ...current,
      [selectedSessionKey]: true,
    }));
    setDownloadStatus(t('executionSavedStatus', { week: selectedWorkout.week, session: selectedWorkout.sessionInWeek }));
  }, [selectedWorkout, selectedSessionKey, sessionRpeInput, sessionNoteInput]);

  const applyQuickModePreset = useCallback((preset: QuickModePreset) => {
    setGoal(preset.goal);
    setStyle(preset.style);
    setProgressionObjective(preset.progression);
    setAutoProgressionFromGoal(false);
    setVariedComboMode(!!preset.variedMode);
    setSurpriseRandomPerSessionMode(false);
    setSingleSessionMixMode(!!preset.singleMixMode);
    setAdvancedTrainingMode(preset.advancedTrainingMode ?? 'Off');
    setSpinClassStyle(preset.spinStyle ?? 'Rhythm');
    setRaceSimulatorProfile(preset.raceSimulatorProfile ?? 'TT');
    setBlockPeriodizationFocus(preset.blockFocus ?? 'Threshold');
    setGameRideMode(!!preset.gameRideMode);
    setGameRideProfile(preset.gameRideProfile ?? 'Technician');
    setTriFocusMode(!!preset.triFocusGoals);

    if (preset.triFocusGoals) {
      setTriFocusGoals(preset.triFocusGoals);
    }

    if (preset.forceSingleSession) {
      setPlanWeeks('1 week');
      setSessionsPerWeek('1 session');
    }

    if (preset.forceThreeDay45) {
      setDuration('45 min');
      setSessionsPerWeek('3 sessions');
      setSelectedTrainingDays(['Tue', 'Thu', 'Sat']);
    }

    setDownloadStatus(t('modeLoadedStatus', { name: preset.label }));
  }, []);

  const applyCrazyThemePack = useCallback((theme: CrazyThemePack) => {
    setCrazyThemePack(theme);

    if (theme === 'Custom') {
      setDownloadStatus(t('crazyThemeCustom'));
      return;
    }

    const preset = CRAZY_THEME_PRESETS[theme];
    setGoal(preset.goal);
    setStyle(preset.style);
    setProgressionObjective(preset.progression);
    setAutoProgressionFromGoal(false);
    setVariedComboMode(preset.variedMode);
    setSurpriseRandomPerSessionMode(false);
    setSingleSessionMixMode(preset.singleMixMode);
    setAdvancedTrainingMode('Off');
    setGameRideMode(false);
    setTriFocusMode(false);
    setBossFightMode(preset.bossFight);
    setDiceMode(preset.dice);
    setMusicDropsMode(preset.musicDrops);
    setZigZagMode(preset.zigZag);
    setLastMinuteTwistMode(preset.lastMinuteTwist);
    setCrazyIntensityLevel(preset.intensity);
    setCrazySurpriseLevel(preset.surprise);
    setDownloadStatus(t('crazyThemeLoaded', { theme }));
  }, []);

  const applySurpriseMode = useCallback(() => {
    const combo = VARIED_COMBOS[Math.floor(Math.random() * VARIED_COMBOS.length)];
    const progressionOptions: ProgressionObjective[] = ['FTP', 'Endurance', 'VO2'];
    const progression = progressionOptions[Math.floor(Math.random() * progressionOptions.length)];
    const randomDuration = DURATIONS[Math.floor(Math.random() * DURATIONS.length)] ?? '60 min';
    const randomLevel = LEVELS[Math.floor(Math.random() * LEVELS.length)] ?? 'Intermediate';

    setGoal(combo.goal);
    setStyle(combo.style);
    setProgressionObjective(progression);
    setAutoProgressionFromGoal(false);
    setDuration(randomDuration);
    setLevel(randomLevel);
    setVariedComboMode(true);
    setSurpriseRandomPerSessionMode(true);
    setSingleSessionMixMode(false);
    setAdvancedTrainingMode('Off');
    setGameRideMode(false);
    setTriFocusMode(false);

    setDownloadStatus(t('surpriseModeStatus', { duration: randomDuration, level: randomLevel }));
  }, []);

  const setSessionFeedback = useCallback((workout: PlanWorkout, feedback: -5 | 0 | 5) => {
    const key = buildSessionKey(workout.week, workout.sessionInWeek);
    setAdaptiveFeedback((current) => ({
      ...current,
      [key]: feedback,
    }));

    setDownloadStatus(
      feedback === 0
        ? t('adaptiveFeedbackOnTarget')
        : feedback < 0
          ? t('adaptiveFeedbackEasier')
          : t('adaptiveFeedbackHarder')
    );
  }, []);

  const applyPostWorkoutCheck = useCallback(() => {
    if (!selectedWorkout || plan.length === 0) {
      return;
    }

    const rpe = parseInt(postWorkoutRpe, 10);
    const fatigue = parseInt(postWorkoutFatigue, 10);
    const legs = parseInt(postWorkoutLegs, 10);

    if ([rpe, fatigue, legs].some((value) => !value || value < 1 || value > 10)) {
      Alert.alert(t('invalidCheckinTitle'), t('invalidCheckinMessage'));
      return;
    }

    const stressScore = (rpe * 0.5) + (fatigue * 0.3) + (legs * 0.2);
    let adjustment: -5 | 0 | 5 = 0;

    if (stressScore >= 7.5) {
      adjustment = -5;
    } else if (stressScore <= 4.5) {
      adjustment = 5;
    }

    const sorted = [...plan].sort((a, b) => (a.week - b.week) || (a.sessionInWeek - b.sessionInWeek));
    const currentIndex = sorted.findIndex((item) => item.id === selectedWorkout.id);
    const nextWorkout = currentIndex >= 0 ? sorted[currentIndex + 1] : undefined;

    if (!nextWorkout) {
      setDownloadStatus(t('postCheckNoNext'));
      return;
    }

    const nextKey = buildSessionKey(nextWorkout.week, nextWorkout.sessionInWeek);
    setAdaptiveFeedback((current) => ({ ...current, [nextKey]: adjustment }));
    setDownloadStatus(
      adjustment === 0
        ? t('postCheckUnchanged')
        : adjustment < 0
          ? t('postCheckEased', { week: nextWorkout.week, session: nextWorkout.sessionInWeek })
          : t('postCheckIntensified', { week: nextWorkout.week, session: nextWorkout.sessionInWeek })
    );
  }, [selectedWorkout, plan, postWorkoutRpe, postWorkoutFatigue, postWorkoutLegs]);

  const handleCreateFtpTest = useCallback(() => {
    const ftpValue = parseInt(ftp, 10);
    if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
      Alert.alert(t('invalidFtpTitle'), t('invalidFtpBeforeTest'));
      return;
    }

    const test = buildFtpTestWorkout(selectedFtpProtocol);
    const workout: PlanWorkout = {
      id: `ftp-test-${Date.now()}`,
      name: test.name,
      summary: test.summary,
      intervals: test.intervals,
      tss: calculateTSS(test.intervals, ftpValue),
      week: 1,
      sessionInWeek: 1,
      phase: 'Build',
      dayLabel: selectedTrainingDays[0] ?? 'Tue',
    };

    setPlan([workout]);
    setSelectedPlanWorkoutId(workout.id);
    setPlanWeeks('1 week');
    setSessionsPerWeek('1 session');
    setDownloadStatus(t('ftpProtocolReady', { protocol: selectedFtpProtocol }));
  }, [ftp, selectedFtpProtocol, selectedTrainingDays]);

  const handleApplyFtpFromTest = useCallback(() => {
    const avgPower = parseInt(ftpTestPowerInput, 10);
    if (!avgPower || avgPower < 80) {
      Alert.alert(t('invalidPowerTitle'), t('invalidPowerMessage'));
      return;
    }

    const factor = selectedFtpProtocol === '20-min Test' ? 0.95 : selectedFtpProtocol === '8-min x2 Test' ? 0.9 : 0.75;
    const newFtp = Math.round(avgPower * factor);
    setFtp(String(newFtp));
    setDownloadStatus(t('ftpUpdatedStatus', { ftp: newFtp, protocol: selectedFtpProtocol }));
  }, [ftpTestPowerInput, selectedFtpProtocol]);

  const buildPlanCsvSummary = useCallback((): string => {
    const header = 'week,session,day,name,tss,duration_minutes,phase\n';
    const rows = plan.map((workout) => {
      const totalSeconds = workout.intervals.reduce((sum, item) => sum + item.duration_seconds, 0);
      return [
        workout.week,
        workout.sessionInWeek,
        workout.dayLabel ?? '',
        `"${workout.name.replace(/"/g, '""')}"`,
        workout.tss,
        Math.round(totalSeconds / 60),
        workout.phase,
      ].join(',');
    }).join('\n');

    return header + rows;
  }, [plan]);

  const buildPlanJsonSummary = useCallback(() => {
    return plan.map((workout) => ({
      id: workout.id,
      name: workout.name,
      week: workout.week,
      sessionInWeek: workout.sessionInWeek,
      dayLabel: workout.dayLabel ?? '',
      phase: workout.phase,
      tss: workout.tss,
      durationMinutes: Math.round(workout.intervals.reduce((sum, item) => sum + item.duration_seconds, 0) / 60),
      intervalCount: workout.intervals.length,
    }));
  }, [plan]);

  const handleExportCsvSummary = useCallback(() => {
    if (plan.length === 0 || Platform.OS !== 'web') {
      return;
    }

    const blob = new Blob([buildPlanCsvSummary()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cycleplan_summary_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [plan, buildPlanCsvSummary]);

  const handleExportZipBundle = useCallback(async () => {
    if (plan.length === 0 || Platform.OS !== 'web') {
      return;
    }

    try {
      const activeTargets = resolveExportTargets(exportFileFormat);
      const goalSlug = sanitizeFilenamePart(goal);
      const customBaseName = sanitizeFilenamePart(exportName);
      const customWorkoutName = workoutDisplayName.trim();
      const workoutNameSlug = sanitizeFilenamePart(customWorkoutName);
      const hasCustomBaseName = customBaseName.length > 0 || workoutNameSlug.length > 0;
      const baseName = customBaseName.length > 0
        ? customBaseName
        : workoutNameSlug.length > 0
          ? workoutNameSlug
          : `cycleplan_${goalSlug}`;
      const sessionsCount = parseCount(sessionsPerWeek);
      const bundleSuffix = buildUniqueSuffix();
      const exportStamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const zip = new JSZip();
      const packEntries: Array<{ file: string; format: ExportSingleFileFormat; week: number; session: number; tss: number }> = [];

      for (let i = 0; i < plan.length; i += 1) {
        const workout = plan[i];
        const weekNumber = Math.floor(i / sessionsCount) + 1;
        const sessionNumber = (i % sessionsCount) + 1;
        const zwoWorkoutName = customWorkoutName.length === 0
          ? plan.length === 1
            ? `${workout.name} • ${exportStamp}`
            : workout.name
          : plan.length === 1
            ? customWorkoutName
            : `${customWorkoutName} • W${weekNumber} S${sessionNumber}`;

        for (const targetFormat of activeTargets) {
          const filename = plan.length === 1
            ? `${baseName}${hasCustomBaseName ? '' : `_${bundleSuffix}`}${targetFormat}`
            : `${baseName}_w${weekNumber}_s${sessionNumber}${targetFormat}`;
          const content = buildWorkoutExportContent(targetFormat, workout, zwoWorkoutName);
          zip.file(filename, content);
          packEntries.push({ file: filename, format: targetFormat, week: weekNumber, session: sessionNumber, tss: workout.tss });
        }
      }

      zip.file('summary.csv', buildPlanCsvSummary());
      zip.file('summary.json', JSON.stringify(buildPlanJsonSummary(), null, 2));
      zip.file('pack_manifest.json', JSON.stringify({
        app: 'Cycle Plan Builder',
        exportFormat: exportFileFormat,
        exportTargets: activeTargets,
        exportedAt: new Date().toISOString(),
        goal,
        sessionsPerWeek,
        files: packEntries,
      }, null, 2));
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}_bundle_${bundleSuffix}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadStatus(t('bundleExportedStatus', { count: packEntries.length }));
    } catch (error) {
      console.error('[HomeScreen] Could not export ZIP bundle:', error);
      setDownloadStatus(t('zipBundleFailed'));
    }
  }, [plan, goal, exportName, exportFileFormat, workoutDisplayName, sessionsPerWeek, buildPlanCsvSummary, buildPlanJsonSummary, buildWorkoutExportContent]);

  const handleImportZwoCompare = useCallback(() => {
    if (Platform.OS !== 'web' || !selectedWorkout) {
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.ictx,.zwo';
    fileInput.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        return;
      }

      const content = await file.text();
      const importedIntervals = parseZwoIntervals(content);
      if (importedIntervals.length === 0) {
        setComparisonStatus(t('compareParseFailed'));
        return;
      }

      const plannedDuration = selectedWorkout.intervals.reduce((sum, i) => sum + i.duration_seconds, 0);
      const importedDuration = importedIntervals.reduce((sum, i) => sum + i.duration_seconds, 0);
      const plannedAvg = Math.round(
        selectedWorkout.intervals.reduce((sum, i) => sum + i.power_percent_ftp * i.duration_seconds, 0) / plannedDuration
      );
      const importedAvg = Math.round(
        importedIntervals.reduce((sum, i) => sum + i.power_percent_ftp * i.duration_seconds, 0) / importedDuration
      );

      setComparisonStatus(
        `Compare vs plan: duration ${Math.round(importedDuration / 60)}m (${Math.round((importedDuration - plannedDuration) / 60)}m diff), avg %FTP ${importedAvg}% (${importedAvg - plannedAvg}% diff).`
      );
    };

    fileInput.click();
  }, [selectedWorkout]);

  const handleExportProfileBackup = useCallback(() => {
    if (Platform.OS !== 'web') {
      setBackupStatus(t('backupExportWebOnly'));
      return;
    }

    const payload: ProfileBackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: {
        ftp,
        duration,
        goal,
        level,
        style,
        progressionObjective,
        planWeeks,
        sessionsPerWeek,
        exportName,
        workoutDisplayName,
        maxHr,
        warmupMinutes,
        cooldownMinutes,
        warmupPowerPercent,
        cooldownPowerPercent,
        selectedTrainingDays,
        bkoolErgMode,
        bkoolConservativeMode,
        selectedFtpProtocol,
        planListFilter,
      },
      data: {
        sessionFavorites,
        adaptiveFeedback,
        completedSessions,
        sessionExecutionLog,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cycleplan_profile_backup_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setBackupStatus('Profile backup exported.');
  }, [
    ftp,
    duration,
    goal,
    level,
    style,
    progressionObjective,
    planWeeks,
    sessionsPerWeek,
    exportName,
    workoutDisplayName,
    maxHr,
    warmupMinutes,
    cooldownMinutes,
    warmupPowerPercent,
    cooldownPowerPercent,
    selectedTrainingDays,
    bkoolErgMode,
    bkoolConservativeMode,
    selectedFtpProtocol,
    planListFilter,
    sessionFavorites,
    adaptiveFeedback,
    completedSessions,
    sessionExecutionLog,
  ]);

  const handleImportProfileBackup = useCallback(() => {
    if (Platform.OS !== 'web') {
      setBackupStatus(t('backupImportWebOnly'));
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const content = await file.text();
        const parsed = JSON.parse(content) as ProfileBackupPayload;

        if (parsed?.version !== 1 || !parsed.profile || !parsed.data) {
          setBackupStatus(t('invalidBackupFile'));
          return;
        }

        const profile = parsed.profile;

        setFtp(typeof profile.ftp === 'string' ? profile.ftp : '');
        setDuration(typeof profile.duration === 'string' ? profile.duration : '60 min');
        setGoal(profile.goal);
        setLevel(profile.level);
        setStyle(profile.style);
        setProgressionObjective(profile.progressionObjective ?? getDefaultProgressionObjective(profile.goal));
        setAutoProgressionFromGoal(false);
        setPlanWeeks(typeof profile.planWeeks === 'string' ? profile.planWeeks : '4 weeks');
        setSessionsPerWeek(typeof profile.sessionsPerWeek === 'string' ? profile.sessionsPerWeek : '1 session');
        setExportName(typeof profile.exportName === 'string' ? profile.exportName : '');
        setWorkoutDisplayName(typeof profile.workoutDisplayName === 'string' ? profile.workoutDisplayName : '');
        setMaxHr(typeof profile.maxHr === 'string' ? profile.maxHr : '185');
        setWarmupMinutes(String(Math.max(1, Math.min(5, parseInt(typeof profile.warmupMinutes === 'string' ? profile.warmupMinutes : '5', 10) || 5))));
        setCooldownMinutes(typeof profile.cooldownMinutes === 'string' ? profile.cooldownMinutes : '6');
        setWarmupPowerPercent(typeof profile.warmupPowerPercent === 'string' ? profile.warmupPowerPercent : '55');
        setCooldownPowerPercent(typeof profile.cooldownPowerPercent === 'string' ? profile.cooldownPowerPercent : '45');
        setSelectedTrainingDays(Array.isArray(profile.selectedTrainingDays) && profile.selectedTrainingDays.length > 0 ? profile.selectedTrainingDays : ['Tue', 'Thu', 'Sat']);
        setBkoolErgMode(!!profile.bkoolErgMode);
        setBkoolConservativeMode(!!profile.bkoolConservativeMode);
        setSelectedFtpProtocol(profile.selectedFtpProtocol ?? '20-min Test');
        setPlanListFilter(profile.planListFilter ?? 'All');

        setSessionFavorites(Array.isArray(parsed.data.sessionFavorites) ? parsed.data.sessionFavorites.slice(0, 10) : []);
        setAdaptiveFeedback(parsed.data.adaptiveFeedback && typeof parsed.data.adaptiveFeedback === 'object' ? parsed.data.adaptiveFeedback : {});
        setCompletedSessions(parsed.data.completedSessions && typeof parsed.data.completedSessions === 'object' ? parsed.data.completedSessions : {});
        setSessionExecutionLog(parsed.data.sessionExecutionLog && typeof parsed.data.sessionExecutionLog === 'object' ? parsed.data.sessionExecutionLog : {});

        setBackupStatus(t('backupImported'));
      } catch (error) {
        console.error('[HomeScreen] Could not import profile backup:', error);
        setBackupStatus(t('backupImportFailed'));
      }
    };

    fileInput.click();
  }, []);

  const isFormValid = ftpNum >= 50 && ftpNum <= 500 && hasValidWarmupCooldown;
  const totalSessions = parseCount(planWeeks) * parseCount(sessionsPerWeek);
  const isSingleWorkoutMode = totalSessions === 1;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}> 
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroSection}>
            <View style={styles.brandRow}>
              <Image source={require('../../../assets/images/icon.png')} style={styles.brandLogo} resizeMode="contain" />
            </View>
            <View style={styles.badge}>
              <CalendarDays size={14} color={Colors.accent} />
              <Text style={styles.badgeText}>{t('badge')}</Text>
            </View>
            <Text style={styles.heroTitle}>{isSingleWorkoutMode ? t('heroSingleTitle') : t('heroPlanTitle')}</Text>
            <Text style={styles.heroSubtitle}>
              {isSingleWorkoutMode
                ? `${t('subtitleSingle')} ${EXPORT_FORMAT_LABELS[exportFileFormat]}`
                : `${t('subtitlePlan')} ${EXPORT_FORMAT_LABELS[exportFileFormat]}`}
            </Text>

            <ToggleSwitch
              label={simpleMode ? t('simpleOn') : t('simpleOff')}
              value={simpleMode}
              onValueChange={setSimpleMode}
            />
          </View>

          <View style={isTabletLayout ? styles.tabletGrid : undefined}>
            <View style={[styles.formCard, isTabletLayout ? styles.formCardTablet : undefined]}>
              <InputField
                label={t('ftpLabel')}
                value={ftp}
                onChangeText={setFtp}
                placeholder={t('ftpPlaceholder')}
                keyboardType="number-pad"
                error={ftp.length > 0 && !isFormValid ? t('ftpHint') : undefined}
                testID="ftp-input"
              />

              <InputField
                label={t('maxHrLabel')}
                value={maxHr}
                onChangeText={setMaxHr}
                placeholder={t('maxHrPlaceholder')}
                keyboardType="number-pad"
                testID="maxhr-input"
              />

              <PickerField
                label={t('durationLabel')}
                value={duration}
                options={DURATIONS}
                onSelect={setDuration}
                testID="duration-picker"
              />

              {!simpleMode && (
              <SectionCard 
                title={t('quickModesTitle')} 
                subtitle={t('quickModesSubtitle')}
                collapsible
                defaultCollapsed={false}
              >
                <Text style={styles.quickModesSectionTitle}>{t('normalModesTitle')}</Text>
                <View style={styles.quickModesGrid}>
                  {NORMAL_MODE_PRESETS.map((preset) => (
                    <QuickModeButton
                      key={preset.id}
                      label={preset.label}
                      onPress={() => applyQuickModePreset(preset)}
                    />
                  ))}
                </View>

                <Text style={[styles.quickModesSectionTitle, { marginTop: 10 }]}>{t('balancedModesTitle')}</Text>
                <View style={styles.quickModesGrid}>
                  {BALANCED_MODE_PRESETS.map((preset) => (
                    <QuickModeButton
                      key={preset.id}
                      label={preset.label}
                      onPress={() => applyQuickModePreset(preset)}
                    />
                  ))}
                </View>
                {triFocusMode && (
                  <Text style={[styles.modeHintText, { marginTop: 8 }]}>{t('triFocusActive', { goals: triFocusGoals.join(' • ') })}</Text>
                )}

                <View style={styles.spinStudioCard}>
                  <Text style={[styles.quickModesSectionTitle, { marginTop: 0 }]}>{t('spinStudioTitle')}</Text>
                  <View style={styles.quickModesGrid}>
                    {SPIN_MODE_PRESETS.map((preset) => (
                      <QuickModeButton
                        key={preset.id}
                        label={preset.label}
                        onPress={() => applyQuickModePreset(preset)}
                        variant="spin"
                      />
                    ))}
                  </View>
                </View>

                <Text style={[styles.quickModesSectionTitle, { marginTop: 10 }]}>{t('funTitle')}</Text>
                <View style={styles.quickModesGrid}>
                  {FUN_MODE_PRESETS.map((preset) => (
                    <QuickModeButton
                      key={preset.id}
                      label={preset.label}
                      onPress={() => applyQuickModePreset(preset)}
                      variant="fun"
                    />
                  ))}
                  <QuickModeButton
                    label={`${t('surpriseMe')} 🎲`}
                    onPress={applySurpriseMode}
                    variant="fun"
                    testID="surprise-mode-button"
                  />
                </View>
              </SectionCard>
              )}

              <PickerField
                label={t('goalLabel')}
                value={goal}
                options={GOALS}
                onSelect={(v) => {
                  setAutoProgressionFromGoal(true);
                  setGoal(v as TrainingGoal);
                }}
                testID="goal-picker"
              />

              {!simpleMode && (
                <>
                  <PickerField
                    label={t('progressionLabel')}
                    value={progressionObjective}
                    options={[...PROGRESSION_OBJECTIVES]}
                    onSelect={(v) => {
                      setAutoProgressionFromGoal(false);
                      setProgressionObjective(v as ProgressionObjective);
                    }}
                    testID="progression-objective-picker"
                  />
                  <Text
                    style={[
                      styles.modeHintText,
                      {
                        marginTop: 4,
                        color: autoProgressionFromGoal ? Colors.accentLight : Colors.textSecondary,
                      },
                    ]}
                    testID="progression-mode-indicator"
                  >
                    {autoProgressionFromGoal ? t('progressionModeAuto') : t('progressionModeLocked')}
                  </Text>
                </>
              )}

              <PickerField
                label={t('levelLabel')}
                value={level}
                options={LEVELS}
                onSelect={(v) => setLevel(v as FitnessLevel)}
                testID="level-picker"
              />

              {!simpleMode && (
                <PickerField
                  label={t('styleLabel')}
                  value={style}
                  options={STYLES}
                  onSelect={(v) => setStyle(v as WorkoutStyle)}
                  testID="style-picker"
                />
              )}

              {!simpleMode && (
              <PickerField
                label={t('advancedModeLabel')}
                value={advancedTrainingMode}
                options={ADVANCED_TRAINING_MODES}
                onSelect={(v) => {
                  const next = v as AdvancedTrainingMode;
                  setAdvancedTrainingMode(next);
                  if (next !== 'Off') {
                    setGameRideMode(false);
                  }
                }}
                testID="advanced-training-mode-picker"
              />
              )}
              {!simpleMode && advancedTrainingMode === 'Race Simulator' && (
                <PickerField
                  label={t('raceProfileLabel')}
                  value={raceSimulatorProfile}
                  options={RACE_SIMULATOR_PROFILES}
                  onSelect={(v) => setRaceSimulatorProfile(v as RaceSimulatorProfile)}
                  testID="race-simulator-profile-picker"
                />
              )}
              {!simpleMode && advancedTrainingMode === 'Spin Class' && (
                <PickerField
                  label={t('spinStyleLabel')}
                  value={spinClassStyle}
                  options={SPIN_CLASS_STYLES}
                  onSelect={(v) => setSpinClassStyle(v as SpinClassStyle)}
                  testID="spin-class-style-picker"
                />
              )}
              {!simpleMode && advancedTrainingMode === 'Block Periodization' && (
                <PickerField
                  label={t('blockFocusLabel')}
                  value={blockPeriodizationFocus}
                  options={BLOCK_PERIODIZATION_FOCUS_OPTIONS}
                  onSelect={(v) => setBlockPeriodizationFocus(v as BlockFocus)}
                  testID="block-periodization-focus-picker"
                />
              )}

              <PickerField
                label={t('planLengthLabel')}
                value={planWeeks}
                options={WEEKS}
                onSelect={setPlanWeeks}
                testID="plan-weeks-picker"
              />

              <PickerField
                label={t('sessionsLabel')}
                value={sessionsPerWeek}
                options={SESSIONS_PER_WEEK}
                onSelect={setSessionsPerWeek}
                testID="sessions-picker"
              />

              {!simpleMode && (
              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>{t('trainingDaysLabel')}</Text>
                <View style={styles.dayChipsRow}>
                  {WEEKDAY_OPTIONS.map((day) => {
                    const isSelected = selectedTrainingDays.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.dayChip, isSelected ? styles.dayChipActive : undefined]}
                        onPress={() => toggleTrainingDay(day)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.dayChipText, isSelected ? styles.dayChipTextActive : undefined]}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              )}

              {!simpleMode && (
              <View style={styles.formSection}>
                <TouchableOpacity
                  style={[styles.modeToggleButton, bkoolErgMode ? styles.modeToggleButtonActive : undefined]}
                  onPress={() => setBkoolErgMode((prev) => !prev)}
                  activeOpacity={0.8}
                  testID="bkool-erg-toggle"
                >
                  <Bike size={16} color={bkoolErgMode ? Colors.accentLight : Colors.textSecondary} />
                  <Text style={[styles.modeToggleText, bkoolErgMode ? styles.modeToggleTextActive : undefined]}>
                    {t('bkoolErgSmooth', { state: bkoolErgMode ? t('onLabel') : t('offLabel') })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeToggleButton, bkoolConservativeMode ? styles.modeToggleButtonActive : undefined, { marginTop: 8 }]}
                  onPress={() => setBkoolConservativeMode((prev) => !prev)}
                  activeOpacity={0.8}
                  testID="bkool-conservative-toggle"
                >
                  <Bike size={16} color={bkoolConservativeMode ? Colors.accentLight : Colors.textSecondary} />
                  <Text style={[styles.modeToggleText, bkoolConservativeMode ? styles.modeToggleTextActive : undefined]}>
                    {t('conservativeRamps', { state: bkoolConservativeMode ? t('onLabel') : t('offLabel') })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeToggleButton, includeSpinCuesInIctx ? styles.modeToggleButtonActive : undefined, { marginTop: 8 }]}
                  onPress={() => setIncludeSpinCuesInIctx((prev) => !prev)}
                  activeOpacity={0.8}
                  testID="spin-cues-ictx-toggle"
                >
                  <Bike size={16} color={includeSpinCuesInIctx ? Colors.accentLight : Colors.textSecondary} />
                  <Text style={[styles.modeToggleText, includeSpinCuesInIctx ? styles.modeToggleTextActive : undefined]}>
                    {t('spinCuesIctx', { state: includeSpinCuesInIctx ? t('onLabel') : t('offLabel') })}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.modeHintText}>
                  {t('spinCuesHint')}
                </Text>
                <TouchableOpacity
                  style={[styles.modeToggleButton, variedComboMode ? styles.modeToggleButtonActive : undefined, { marginTop: 8 }]}
                  onPress={() => {
                    setTriFocusMode(false);
                    setGameRideMode(false);
                    setSurpriseRandomPerSessionMode(false);
                    setVariedComboMode((prev) => !prev);
                  }}
                  activeOpacity={0.8}
                  testID="varied-combo-toggle"
                >
                  <Bike size={16} color={variedComboMode ? Colors.accentLight : Colors.textSecondary} />
                  <Text style={[styles.modeToggleText, variedComboMode ? styles.modeToggleTextActive : undefined]}>
                    {t('variedComboMode', { state: variedComboMode ? t('onLabel') : t('offLabel') })}
                  </Text>
                </TouchableOpacity>
                {variedComboMode && (
                  <Text style={styles.modeHintText}>
                    {surpriseRandomPerSessionMode
                      ? t('surpriseRandomHint')
                      : variedModePreview}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.modeToggleButton, gameRideMode ? styles.modeToggleButtonActive : undefined, { marginTop: 8 }]}
                  onPress={() => {
                    setTriFocusMode(false);
                    setVariedComboMode(false);
                    setSingleSessionMixMode(false);
                    setSurpriseRandomPerSessionMode(false);
                    setAdvancedTrainingMode('Off');
                    setGameRideMode((prev) => !prev);
                  }}
                  activeOpacity={0.8}
                  testID="game-ride-toggle"
                >
                  <Bike size={16} color={gameRideMode ? Colors.accentLight : Colors.textSecondary} />
                  <Text style={[styles.modeToggleText, gameRideMode ? styles.modeToggleTextActive : undefined]}>
                    {t('gameRideMode', { state: gameRideMode ? t('onLabel') : t('offLabel') })}
                  </Text>
                </TouchableOpacity>
                {gameRideMode && (
                  <>
                    <Text style={styles.modeHintText}>{t('gameRideHint')}</Text>
                    <PickerField
                      label={t('gameRideProfileLabel')}
                      value={gameRideProfile}
                      options={GAME_RIDE_PROFILES}
                      onSelect={(v) => setGameRideProfile(v as GameRideProfile)}
                      testID="game-ride-profile-picker"
                    />
                  </>
                )}
                {isSingleWorkoutMode && (
                  <>
                    <TouchableOpacity
                      style={[styles.modeToggleButton, singleSessionMixMode ? styles.modeToggleButtonActive : undefined, { marginTop: 8 }]}
                      onPress={() => {
                        setTriFocusMode(false);
                        setGameRideMode(false);
                        setSingleSessionMixMode((prev) => !prev);
                      }}
                      activeOpacity={0.8}
                      testID="single-session-mix-toggle"
                    >
                      <Bike size={16} color={singleSessionMixMode ? Colors.accentLight : Colors.textSecondary} />
                      <Text style={[styles.modeToggleText, singleSessionMixMode ? styles.modeToggleTextActive : undefined]}>
                        {t('singleSessionMix', { state: singleSessionMixMode ? t('onLabel') : t('offLabel') })}
                      </Text>
                    </TouchableOpacity>
                    {singleSessionMixMode && (
                      <Text style={styles.modeHintText}>{t('singleSessionMixHint')}</Text>
                    )}
                  </>
                )}

                <View style={styles.crazyModesCard}>
                  <Text style={styles.favoritesTitle}>{t('crazyLab')}</Text>
                  {tssCapAppliedCount > 0 && (
                    <Text style={[styles.modeHintText, { marginBottom: 8 }]}>{t('tssCapAppliedLine', { count: tssCapAppliedCount, total: plan.length, sessions: tssCapAppliedSessionsLabel })}</Text>
                  )}
                  {crazyProfileSummary.length > 0 && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={styles.modeHintText}>{t('crazyProfileMix')}</Text>
                      {crazyProfileSummary.map((entry) => (
                        <Text key={entry.label} style={styles.modeHintText}>• {entry.label}: {entry.count} session(s)</Text>
                      ))}
                    </View>
                  )}
                  <View style={[styles.formSection, { marginBottom: 4 }]}> 
                    <PickerField
                      label={t('themePackLabel')}
                      value={crazyThemePack}
                      options={[...CRAZY_THEME_PACKS]}
                      onSelect={(v) => applyCrazyThemePack(v as CrazyThemePack)}
                      testID="crazy-theme-pack-picker"
                    />
                  </View>
                  {crazyThemePack !== 'Custom' && (
                    <Text style={[styles.modeHintText, { marginBottom: 8 }]}>{CRAZY_THEME_PRESETS[crazyThemePack].description}</Text>
                  )}
                  <View style={styles.inlineFieldsRow}>
                    <View style={[styles.formSection, styles.inlineField]}>
                      <PickerField
                        label={t('crazyIntensityLabel')}
                        value={crazyIntensityLevel}
                        options={[...CRAZY_INTENSITY_LEVELS]}
                        onSelect={(v) => {
                          setCrazyThemePack('Custom');
                          setCrazyIntensityLevel(v as CrazyIntensityLevel);
                        }}
                        testID="crazy-intensity-picker"
                      />
                    </View>
                    <View style={[styles.formSection, styles.inlineField]}>
                      <PickerField
                        label={t('surpriseDensityLabel')}
                        value={crazySurpriseLevel}
                        options={[...CRAZY_SURPRISE_LEVELS]}
                        onSelect={(v) => {
                          setCrazyThemePack('Custom');
                          setCrazySurpriseLevel(v as CrazySurpriseLevel);
                        }}
                        testID="crazy-surprise-picker"
                      />
                    </View>
                  </View>
                  <View style={styles.dayChipsRow}>
                    <TouchableOpacity style={[styles.dayChip, bossFightMode ? styles.dayChipActive : undefined]} onPress={() => {
                      setCrazyThemePack('Custom');
                      setBossFightMode((prev) => !prev);
                    }}>
                      <Text style={[styles.dayChipText, bossFightMode ? styles.dayChipTextActive : undefined]}>{t('bossFight')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.dayChip, diceMode ? styles.dayChipActive : undefined]} onPress={() => {
                      setCrazyThemePack('Custom');
                      setDiceMode((prev) => !prev);
                    }}>
                      <Text style={[styles.dayChipText, diceMode ? styles.dayChipTextActive : undefined]}>{t('diceMode')} 🎲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.dayChip, musicDropsMode ? styles.dayChipActive : undefined]} onPress={() => {
                      setCrazyThemePack('Custom');
                      setMusicDropsMode((prev) => !prev);
                    }}>
                      <Text style={[styles.dayChipText, musicDropsMode ? styles.dayChipTextActive : undefined]}>{t('musicDrops')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.dayChip, zigZagMode ? styles.dayChipActive : undefined]} onPress={() => {
                      setCrazyThemePack('Custom');
                      setZigZagMode((prev) => !prev);
                    }}>
                      <Text style={[styles.dayChipText, zigZagMode ? styles.dayChipTextActive : undefined]}>{t('zigZagPower')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.dayChip, lastMinuteTwistMode ? styles.dayChipActive : undefined]} onPress={() => {
                      setCrazyThemePack('Custom');
                      setLastMinuteTwistMode((prev) => !prev);
                    }}>
                      <Text style={[styles.dayChipText, lastMinuteTwistMode ? styles.dayChipTextActive : undefined]}>{t('lastMinuteTwist')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              )}

              {!simpleMode && (
              <SectionCard title={t('guidedFtpTests')}>
                <PickerField
                  label={t('protocolLabel')}
                  value={selectedFtpProtocol}
                  options={[...FTP_TEST_PROTOCOLS]}
                  onSelect={(v) => setSelectedFtpProtocol(v as FtpTestProtocol)}
                  testID="ftp-protocol-picker"
                />
                <Button
                  variant="secondary"
                  size="small"
                  onPress={handleCreateFtpTest}
                >
                  {t('createFtpTestWorkout')}
                </Button>
                <InputField
                  label=""
                  value={ftpTestPowerInput}
                  onChangeText={setFtpTestPowerInput}
                  placeholder={t('ftpPowerPlaceholder')}
                  keyboardType="number-pad"
                  testID="ftp-test-power-input"
                />
                <Button
                  variant="secondary"
                  size="small"
                  onPress={handleApplyFtpFromTest}
                >
                  {t('applyFtpFromTest')}
                </Button>
              </SectionCard>
              )}

              {!simpleMode && (
              <View style={styles.inlineFieldsRow}>
                <InputField
                  label={t('warmupMin')}
                  value={warmupMinutes}
                  onChangeText={setWarmupMinutes}
                  placeholder={t('warmupPlaceholder')}
                  keyboardType="number-pad"
                  testID="warmup-minutes-input"
                  containerStyle={styles.inlineField}
                />
                <InputField
                  label={t('warmupPct')}
                  value={warmupPowerPercent}
                  onChangeText={setWarmupPowerPercent}
                  placeholder={t('warmupPctPlaceholder')}
                  keyboardType="number-pad"
                  testID="warmup-power-input"
                  containerStyle={styles.inlineField}
                />
              </View>
              )}

              {!simpleMode && (
              <View style={styles.inlineFieldsRow}>
                <InputField
                  label={t('cooldownMin')}
                  value={cooldownMinutes}
                  onChangeText={setCooldownMinutes}
                  placeholder={t('cooldownPlaceholder')}
                  keyboardType="number-pad"
                  testID="cooldown-minutes-input"
                  containerStyle={styles.inlineField}
                />
                <InputField
                  label={t('cooldownPct')}
                  value={cooldownPowerPercent}
                  onChangeText={setCooldownPowerPercent}
                  placeholder={t('cooldownPctPlaceholder')}
                  keyboardType="number-pad"
                  testID="cooldown-power-input"
                  containerStyle={styles.inlineField}
                />
              </View>
              )}

              {!simpleMode && !hasValidWarmupCooldown && (
                <Text style={styles.errorHint}>{t('warmupCooldownHint')}</Text>
              )}

              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>{t('saveNameLabel')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={exportName}
                  onChangeText={setExportName}
                  placeholder={t('saveNamePlaceholder')}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  returnKeyType="done"
                  testID="save-name-input"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>{t('workoutNameLabel')} ({EXPORT_FORMAT_LABELS[exportFileFormat]})</Text>
                <TextInput
                  style={styles.textInput}
                  value={workoutDisplayName}
                  onChangeText={setWorkoutDisplayName}
                  placeholder={t('workoutNamePlaceholder')}
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="done"
                  testID="workout-name-input"
                />
              </View>

              <PickerField
                label={t('exportFormatLabel')}
                value={EXPORT_FORMAT_LABELS[exportFileFormat]}
                options={EXPORT_FILE_FORMATS.map((format) => EXPORT_FORMAT_LABELS[format])}
                onSelect={(label) => {
                  const format = EXPORT_FILE_FORMATS.find((item) => EXPORT_FORMAT_LABELS[item] === label);
                  if (format) {
                    setExportFileFormat(format);
                  }
                }}
                testID="export-format-picker"
              />

              {!simpleMode && (
                <>
                  <PickerField
                    label={t('filenameTemplatePreset')}
                    value={filenameTemplatePresetLabelMap[exportFilenameTemplate] ?? exportFilenameTemplate}
                    options={filenameTemplatePresetOptions}
                    onSelect={(label) => {
                      const preset = EXPORT_FILENAME_TEMPLATE_PRESETS.find((item) => filenameTemplatePresetLabelMap[item] === label);
                      if (preset) {
                        setExportFilenameTemplate(preset);
                      }
                    }}
                    testID="export-template-preset-picker"
                  />

                  <View style={styles.formSection}>
                    <Text style={styles.inputLabel}>{t('filenameFieldsTitle')}</Text>

                    <View style={styles.inlineFieldsRow}>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('filenameFieldGoal')} ({t('optionalShort')})</Text>
                        <TextInput
                          style={styles.textInput}
                          value={filenameGoalValue}
                          onChangeText={setFilenameGoalValue}
                          placeholder={sanitizeFilenamePart(goal)}
                          placeholderTextColor={Colors.textMuted}
                          autoCapitalize="none"
                          returnKeyType="done"
                        />
                      </View>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('filenameFieldDuration')} ({t('optionalShort')})</Text>
                        <TextInput
                          style={styles.textInput}
                          value={filenameDurationValue}
                          onChangeText={setFilenameDurationValue}
                          placeholder={sanitizeFilenamePart(duration.replace(/\s+/g, ''))}
                          placeholderTextColor={Colors.textMuted}
                          autoCapitalize="none"
                          returnKeyType="done"
                        />
                      </View>
                    </View>

                    <View style={styles.inlineFieldsRow}>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('filenameFieldWeek')} ({t('optionalShort')})</Text>
                        <TextInput
                          style={styles.textInput}
                          value={filenameWeekValue}
                          onChangeText={setFilenameWeekValue}
                          placeholder="1"
                          placeholderTextColor={Colors.textMuted}
                          autoCapitalize="none"
                          returnKeyType="done"
                        />
                      </View>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('filenameFieldSession')} ({t('optionalShort')})</Text>
                        <TextInput
                          style={styles.textInput}
                          value={filenameSessionValue}
                          onChangeText={setFilenameSessionValue}
                          placeholder="1"
                          placeholderTextColor={Colors.textMuted}
                          autoCapitalize="none"
                          returnKeyType="done"
                        />
                      </View>
                    </View>

                    <View style={styles.inlineFieldsRow}>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('filenameFieldDate')} ({t('optionalShort')})</Text>
                        <TextInput
                          style={styles.textInput}
                          value={filenameDateValue}
                          onChangeText={setFilenameDateValue}
                          placeholder={buildFilenameDateToken()}
                          placeholderTextColor={Colors.textMuted}
                          autoCapitalize="none"
                          returnKeyType="done"
                        />
                      </View>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('filenameFieldWorkout')} ({t('optionalShort')})</Text>
                        <TextInput
                          style={styles.textInput}
                          value={filenameWorkoutValue}
                          onChangeText={setFilenameWorkoutValue}
                          placeholder={sanitizeFilenamePart(workoutDisplayName.trim() || 'workout')}
                          placeholderTextColor={Colors.textMuted}
                          autoCapitalize="none"
                          returnKeyType="done"
                        />
                      </View>
                    </View>

                    <Text style={styles.filenamePreviewText}>{t('filenameTemplatePreviewLabel')} {filenameTemplatePreview}</Text>
                  </View>
                </>
              )}

              <View style={styles.planMeta}>
                <Text style={styles.planMetaText}>{totalSessions} {t('totalSessions')}</Text>
              </View>

              <TouchableOpacity
                style={styles.resetNamesButton}
                onPress={handleResetNames}
                activeOpacity={0.7}
                testID="reset-names-button"
              >
                <Text style={styles.resetNamesButtonText}>{t('clearNames')}</Text>
              </TouchableOpacity>

              {!simpleMode && (
                <TouchableOpacity
                  style={styles.saveFavoriteButton}
                  onPress={handleSaveFavorite}
                  activeOpacity={0.7}
                  testID="save-favorite-button"
                >
                  <Text style={styles.saveFavoriteButtonText}>{t('saveCurrentFavorite')}</Text>
                </TouchableOpacity>
              )}

              {!simpleMode && sessionFavorites.length > 0 && (
                <View style={styles.favoritesCard}>
                  <Text style={styles.favoritesTitle}>{t('sessionFavorites')}</Text>
                  {sessionFavorites.map((favorite) => (
                    <View key={favorite.id} style={styles.favoriteItemRow}>
                      <TouchableOpacity
                        style={styles.favoriteApplyButton}
                        onPress={() => applyFavorite(favorite)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.favoriteApplyText}>{favorite.name}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.favoriteDeleteButton}
                        onPress={() => removeFavorite(favorite.id)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.favoriteDeleteText}>{t('delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Animated.View style={[{ transform: [{ scale: pulseAnim }] }, isTabletLayout ? styles.actionsTablet : undefined]}>
              <Button
                variant="primary"
                size="large"
                onPress={handleGenerate}
                disabled={!isFormValid || isPending}
                loading={isPending}
                icon={<Zap size={20} color="#FFF" fill="#FFF" />}
                testID="generate-button"
              >
                {isPending
                  ? (isSingleWorkoutMode ? t('generatingWorkout') : t('generatingPlan'))
                  : (isSingleWorkoutMode ? t('generateWorkout') : t('generatePlan'))
                }
              </Button>
            </Animated.View>
          </View>

          {selectedWorkout && (
            <Animated.View style={[styles.resultsSection, { opacity: resultOpacity }]}> 
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>{summaryWorkoutTitle}</Text>
                <Text style={styles.summaryText}>{selectedWorkout.summary}</Text>
                {selectedWorkout.gameRideInfo && (
                  <View style={styles.gameRideInfoCard}>
                    <Text style={styles.gameRideInfoTitle}>{t('adaptiveGameRideTitle')}</Text>
                    <View style={styles.gameRideReadinessRow}>
                      <Text style={[styles.gameRideInfoText, { color: getReadinessColor(selectedWorkout.gameRideInfo.readinessScore) }]}>
                        {selectedWorkout.gameRideInfo.profile} · readiness {selectedWorkout.gameRideInfo.readinessScore}/100
                      </Text>
                      <View style={[styles.readinessBadge, { borderColor: getReadinessColor(selectedWorkout.gameRideInfo.readinessScore) }]}>
                        <Text style={[styles.readinessBadgeText, { color: getReadinessColor(selectedWorkout.gameRideInfo.readinessScore) }]}>
                          {getReadinessLabel(selectedWorkout.gameRideInfo.readinessScore)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.gameRideInfoText}>
                      aggressive {selectedWorkout.gameRideInfo.aggressivePhases}/{selectedWorkout.gameRideInfo.totalPhases} · safe {selectedWorkout.gameRideInfo.totalPhases - selectedWorkout.gameRideInfo.aggressivePhases}/{selectedWorkout.gameRideInfo.totalPhases}
                    </Text>
                    {selectedWorkout.gameRideInfo.weeklyBoss && (
                      <Text style={styles.gameRideInfoText}>{t('weeklyBossActive')}</Text>
                    )}
                  </View>
                )}
                {selectedWorkout.crazyProfileLabel && (
                  <Text style={styles.modeHintText}>{t('summaryCrazyProfile', { profile: selectedWorkout.crazyProfileLabel })}</Text>
                )}
                {selectedWorkout.advancedModeLabel && (
                  <Text style={styles.modeHintText}>Advanced mode: {selectedWorkout.advancedModeLabel}</Text>
                )}
                {selectedWorkout.tssCapped && (
                  <Text style={styles.modeHintText}>{t('tssCapApplied')}</Text>
                )}
              </View>

              {mainViewTab === 'Calendar' && (
              <View style={styles.analyticsCard}>
                <Text style={styles.calendarTitle}>{t('planAnalytics')}</Text>
                <View style={styles.analyticsRow}>
                  <Text style={styles.analyticsText}>{t('analyticsTotalTss', { value: analytics.totalTss })}</Text>
                  <Text style={styles.analyticsText}>{t('analyticsMinutes', { value: analytics.totalMinutes })}</Text>
                  <Text style={styles.analyticsText}>{t('analyticsCompleted', { done: analytics.completedCount, total: analytics.totalSessions })}</Text>
                </View>
                <Text style={styles.analyticsZonesText}>
                  {t('analyticsZonesPrefix')} Z1 {Math.round(analytics.zoneMinutes.z1)} · Z2 {Math.round(analytics.zoneMinutes.z2)} · Z3 {Math.round(analytics.zoneMinutes.z3)} · Z4 {Math.round(analytics.zoneMinutes.z4)} · Z5 {Math.round(analytics.zoneMinutes.z5)} · Z6 {Math.round(analytics.zoneMinutes.z6)}
                </Text>
              </View>
              )}

              {mainViewTab === 'Calendar' && (
              <View style={styles.calendarCard}>
                <Text style={styles.calendarTitle}>{t('weeklyCalendar')}</Text>
                {planByWeek.map(({ week, sessions }) => (
                  <View key={`week-${week}`} style={styles.calendarWeekRow}>
                    <Text style={styles.calendarWeekLabel}>W{week}</Text>
                    <View style={styles.calendarSessionsRow}>
                      {sessions.map((session) => {
                        const isActive = selectedWorkout.id === session.id;

                        return (
                          <TouchableOpacity
                            key={session.id}
                            style={[styles.calendarSessionChip, isActive ? styles.calendarSessionChipActive : undefined]}
                            onPress={() => setSelectedPlanWorkoutId(session.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.calendarSessionChipText, isActive ? styles.calendarSessionChipTextActive : undefined]}>
                              S{session.sessionInWeek}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
              )}

              {mainViewTab === 'Calendar' && (
              <View style={styles.calendarCard}>
                <Text style={styles.calendarTitle}>{t('realDaysCalendar')}</Text>
                {planByDay.map(({ day, sessions }) => (
                  <View key={`day-${day}`} style={styles.calendarWeekRow}>
                    <Text style={styles.calendarWeekLabel}>{day}</Text>
                    <View style={styles.calendarSessionsRow}>
                      {sessions.length === 0 ? (
                        <Text style={styles.dayEmptyText}>{t('noSession')}</Text>
                      ) : sessions.map((session) => {
                        const isActive = selectedWorkout.id === session.id;

                        return (
                          <TouchableOpacity
                            key={`day-chip-${session.id}`}
                            style={[styles.calendarSessionChip, isActive ? styles.calendarSessionChipActive : undefined]}
                            onPress={() => setSelectedPlanWorkoutId(session.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.calendarSessionChipText, isActive ? styles.calendarSessionChipTextActive : undefined]}>
                              W{session.week}S{session.sessionInWeek}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
              )}

              {mainViewTab !== 'Calendar' && (
              <View style={isTabletLayout ? styles.tabletGrid : undefined}>
                {mainViewTab === 'Builder' && (
                <View style={[styles.planListCard, isTabletLayout ? styles.planListCardTablet : undefined]}>
                  <Text style={styles.planListTitle}>{isSingleWorkoutMode ? t('workoutTitle') : t('planSessionsTitle')}</Text>
                  <View style={styles.planFilterRow}>
                    {(['All', 'Pending', 'Completed'] as PlanListFilter[]).map((filterOption) => {
                      const isActive = planListFilter === filterOption;
                      const label = filterOption === 'All'
                        ? t('filterAll')
                        : filterOption === 'Pending'
                          ? t('filterPending')
                          : t('filterCompleted');

                      return (
                        <TouchableOpacity
                          key={filterOption}
                          style={[styles.planFilterChip, isActive ? styles.planFilterChipActive : undefined]}
                          onPress={() => setPlanListFilter(filterOption)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.planFilterChipText, isActive ? styles.planFilterChipTextActive : undefined]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[styles.planFilterChip, showFatiguedOnly ? styles.planFilterChipActive : undefined]}
                      onPress={() => setShowFatiguedOnly((prev) => !prev)}
                      activeOpacity={0.8}
                      testID="fatigued-only-filter"
                    >
                      <Text style={[styles.planFilterChipText, showFatiguedOnly ? styles.planFilterChipTextActive : undefined]}>
                        {t('fatiguedOnly')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {filteredPlan.length === 0 && (
                    <Text style={styles.emptyFilteredText}>{t('noSessionsForFilter')}</Text>
                  )}

                  {filteredPlan.map((item) => {
                    const isActive = item.id === selectedWorkout.id;
                    const sessionKey = buildSessionKey(item.week, item.sessionInWeek);
                    const isCompleted = !!completedSessions[sessionKey];
                    const feedback = adaptiveFeedback[sessionKey];
                    const execution = sessionExecutionLog[sessionKey];
                    const chaosLevel = Math.min(4, Math.max(1, Math.round(sessionChaosMap[sessionKey] ?? 1)));

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.planItem, isActive ? styles.planItemActive : undefined]}
                        onPress={() => setSelectedPlanWorkoutId(item.id)}
                        activeOpacity={0.85}
                        testID={`plan-item-${item.id}`}
                      >
                        <View style={styles.planItemHeader}>
                          <Text style={[styles.planItemTitle, isActive ? styles.planItemTitleActive : undefined]}>{getDisplayWorkoutName(item)}</Text>
                          <View style={[styles.phaseBadge, { backgroundColor: getPhaseColor(item.phase) }]}> 
                            <Text style={styles.phaseBadgeText}>{getPhaseLabel(item.phase)}</Text>
                          </View>
                        </View>
                        <Text style={styles.planItemTss}>TSS {item.tss}</Text>
                        {item.crazyProfileLabel && (
                          <Text style={styles.planItemExecutionMeta}>{t('profileShort')}: {item.crazyProfileLabel}</Text>
                        )}
                        {item.advancedModeLabel && (
                          <Text style={styles.planItemExecutionMeta}>{t('advancedShort')}: {item.advancedModeLabel}</Text>
                        )}
                        {item.gameRideInfo && (
                          <View style={styles.gameRideListRow}>
                            <Text style={[styles.planItemExecutionMeta, { color: getReadinessColor(item.gameRideInfo.readinessScore) }]}>
                              {t('gameRideShort')}: A {item.gameRideInfo.aggressivePhases}/{item.gameRideInfo.totalPhases} · R {item.gameRideInfo.readinessScore}
                            </Text>
                            <View style={[styles.readinessBadge, { borderColor: getReadinessColor(item.gameRideInfo.readinessScore) }]}>
                              <Text style={[styles.readinessBadgeText, { color: getReadinessColor(item.gameRideInfo.readinessScore) }]}>
                                {getReadinessLabel(item.gameRideInfo.readinessScore)}
                              </Text>
                            </View>
                          </View>
                        )}
                        {(variedComboMode || singleSessionMixMode) && (
                          <Text style={styles.planItemExecutionMeta}>{t('chaosShort')} {chaosLevel}/4</Text>
                        )}
                        {execution && (
                          <Text style={styles.planItemExecutionMeta}>
                            RPE {execution.rpe} · {formatHistoryDate(execution.completedAt)}
                          </Text>
                        )}
                        <View style={styles.sessionMetaRow}>
                          <TouchableOpacity
                            style={[styles.sessionMetaButton, isCompleted ? styles.sessionMetaButtonActive : undefined]}
                            onPress={() => toggleSessionComplete(item)}
                            activeOpacity={0.75}
                          >
                            <CheckCircle2 size={12} color={isCompleted ? Colors.accentLight : Colors.textSecondary} />
                            <Text style={[styles.sessionMetaButtonText, isCompleted ? styles.sessionMetaButtonTextActive : undefined]}>
                              {isCompleted ? t('completedState') : t('markDone')}
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.feedbackRow}>
                            <TouchableOpacity style={styles.feedbackChip} onPress={() => setSessionFeedback(item, -5)}>
                              <Text style={[styles.feedbackChipText, feedback < 0 ? styles.feedbackChipTextActive : undefined]}>{t('easier')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.feedbackChip} onPress={() => setSessionFeedback(item, 0)}>
                              <Text style={[styles.feedbackChipText, feedback === 0 ? styles.feedbackChipTextActive : undefined]}>{t('okay')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.feedbackChip} onPress={() => setSessionFeedback(item, 5)}>
                              <Text style={[styles.feedbackChipText, feedback > 0 ? styles.feedbackChipTextActive : undefined]}>{t('harder')}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                )}

                <View style={mainViewTab === 'Analysis' ? undefined : isTabletLayout ? styles.previewTablet : undefined}>
                  <WorkoutPreview
                    intervals={selectedWorkout.intervals}
                    tss={selectedWorkout.tss}
                    ftp={parseInt(ftp, 10) || 200}
                    maxHr={maxHrNum > 0 ? maxHrNum : undefined}
                  />

                  <TouchableOpacity
                    style={styles.editWorkoutButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: '/edit-workout', params: { id: selectedWorkout.id, ftp: ftp || '200' } });
                    }}
                    activeOpacity={0.7}
                    testID="edit-workout-button"
                  >
                    <Pencil size={16} color={Colors.accent} />
                    <Text style={styles.editWorkoutButtonText}>Edit Workout</Text>
                  </TouchableOpacity>

                  {Platform.OS === 'web' && (
                    <TouchableOpacity
                      style={styles.rideOnBikeButton}
                      onPress={() => handleRideOnBike({ name: getDisplayWorkoutName(selectedWorkout), intervals: selectedWorkout.intervals })}
                      activeOpacity={0.8}
                      testID="ride-on-bike-button"
                    >
                      <Bike size={20} color="#FFFFFF" />
                      <Text style={styles.rideOnBikeButtonText}>{t('rideOnBike')}</Text>
                    </TouchableOpacity>
                  )}

                  {exportValidation && (
                    <View style={styles.validationCard}>
                      <Text style={styles.validationTitle}>{t('validationTitle')}</Text>
                      <Text style={styles.validationText}>
                        Duration {exportValidation.durationMinutes} min · TSS {exportValidation.tss} · IF {exportValidation.estimatedIf}
                      </Text>
                      <Text style={styles.validationText}>
                        Zones (min): Z1 {Math.round(exportValidation.zoneMinutes.z1)} · Z2 {Math.round(exportValidation.zoneMinutes.z2)} · Z3 {Math.round(exportValidation.zoneMinutes.z3)} · Z4 {Math.round(exportValidation.zoneMinutes.z4)} · Z5 {Math.round(exportValidation.zoneMinutes.z5)} · Z6 {Math.round(exportValidation.zoneMinutes.z6)}
                      </Text>
                      {exportValidation.warning.length > 0 && (
                        <Text style={styles.validationWarning}>{exportValidation.warning}</Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={handleDownloadPlan}
                    activeOpacity={0.8}
                    testID="download-button"
                  >
                    <Download size={20} color={Colors.accent} />
                    <Text style={styles.downloadButtonText}>
                      {plan.length === 1 ? `${t('downloadWorkout')} (${EXPORT_FORMAT_LABELS[exportFileFormat]})` : `${t('downloadPlan')} (${EXPORT_FORMAT_LABELS[exportFileFormat]})`}
                    </Text>
                  </TouchableOpacity>

                  <AppStatusBar
                    message={downloadStatus}
                    visible={downloadStatus.length > 0}
                    type="success"
                    testID="download-status"
                  />

                  {!simpleMode && (
                  <View style={styles.integrationRow}>
                    <TouchableOpacity style={styles.integrationButton} onPress={handleImportZwoCompare} activeOpacity={0.8}>
                      <Upload size={14} color={Colors.textSecondary} />
                      <Text style={styles.integrationButtonText}>{t('importCompare')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.integrationButton} onPress={handleExportZipBundle} activeOpacity={0.8}>
                      <FileDown size={14} color={Colors.textSecondary} />
                      <Text style={styles.integrationButtonText}>{t('exportZip')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.integrationButton} onPress={handleExportCsvSummary} activeOpacity={0.8}>
                      <FileDown size={14} color={Colors.textSecondary} />
                      <Text style={styles.integrationButtonText}>{t('exportCsv')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.integrationButton} onPress={handleExportProfileBackup} activeOpacity={0.8}>
                      <FileDown size={14} color={Colors.textSecondary} />
                      <Text style={styles.integrationButtonText}>{t('exportBackup')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.integrationButton} onPress={handleImportProfileBackup} activeOpacity={0.8}>
                      <Upload size={14} color={Colors.textSecondary} />
                      <Text style={styles.integrationButtonText}>{t('importBackup')}</Text>
                    </TouchableOpacity>
                  </View>
                  )}

                  {!simpleMode && (
                    <AppStatusBar
                      message={comparisonStatus}
                      visible={comparisonStatus.length > 0}
                      type="info"
                    />
                  )}

                  {!simpleMode && (
                    <AppStatusBar
                      message={backupStatus}
                      visible={backupStatus.length > 0}
                      type="info"
                    />
                  )}

                  {!simpleMode && (
                  <>
                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={handleRegenerateSelected}
                    activeOpacity={0.7}
                    disabled={isPending || regeneratingWorkoutId.length > 0}
                    testID="regenerate-selected-button"
                  >
                    <RefreshCw size={16} color={Colors.textSecondary} />
                    <Text style={styles.secondaryActionText}>
                      {regeneratingWorkoutId.length > 0 ? t('regeneratingSelected') : t('regenerateSelected')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={handleRecoverSelected}
                    activeOpacity={0.7}
                    disabled={isPending || regeneratingWorkoutId.length > 0}
                    testID="recover-selected-button"
                  >
                    <RefreshCw size={16} color={Colors.textSecondary} />
                    <Text style={styles.secondaryActionText}>{t('recoverSelected')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={handleRecoverAllFatigued}
                    activeOpacity={0.7}
                    disabled={isPending || regeneratingWorkoutId.length > 0 || fatiguedSessions.length === 0}
                    testID="recover-all-fatigued-button"
                  >
                    <RefreshCw size={16} color={Colors.textSecondary} />
                    <Text style={styles.secondaryActionText}>
                      {regeneratingWorkoutId === '__bulk-recover__'
                        ? t('recoveringAllFatigued')
                        : t('recoverAllFatigued', { count: fatiguedSessions.length })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={handlePushAllReady}
                    activeOpacity={0.7}
                    disabled={isPending || regeneratingWorkoutId.length > 0 || readySessions.length === 0}
                    testID="push-all-ready-button"
                  >
                    <RefreshCw size={16} color={Colors.textSecondary} />
                    <Text style={styles.secondaryActionText}>
                      {regeneratingWorkoutId === '__bulk-push__'
                        ? t('pushingAllReady')
                        : t('pushAllReady', { count: readySessions.length })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={handleMoreChaosSelected}
                    activeOpacity={0.7}
                    disabled={isPending || regeneratingWorkoutId.length > 0}
                    testID="more-chaos-button"
                  >
                    <RefreshCw size={16} color={Colors.textSecondary} />
                    <Text style={styles.secondaryActionText}>{t('moreChaosSelected')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={handleRevengeSelected}
                    activeOpacity={0.7}
                    disabled={isPending || regeneratingWorkoutId.length > 0}
                    testID="revenge-button"
                  >
                    <RefreshCw size={16} color={Colors.textSecondary} />
                    <Text style={styles.secondaryActionText}>{t('revengeButton')}</Text>
                  </TouchableOpacity>

                  <View style={styles.postWorkoutCard}>
                    <Text style={styles.historyTitle}>{t('sessionExecutionLog')}</Text>
                    <View style={styles.inlineFieldsRow}>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('rpeLabel')}</Text>
                        <TextInput
                          style={styles.textInput}
                          value={sessionRpeInput}
                          onChangeText={setSessionRpeInput}
                          placeholder={t('rpePlaceholder')}
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="number-pad"
                          returnKeyType="done"
                        />
                      </View>
                    </View>
                    <View style={styles.formSection}>
                      <Text style={styles.inputLabel}>{t('sessionNoteOptional')}</Text>
                      <TextInput
                        style={[styles.textInput, styles.multilineInput]}
                        value={sessionNoteInput}
                        onChangeText={setSessionNoteInput}
                        placeholder={t('sessionNotePlaceholder')}
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        returnKeyType="done"
                      />
                    </View>
                    <TouchableOpacity style={styles.secondaryInlineButton} onPress={saveSelectedSessionExecution} activeOpacity={0.75}>
                      <Text style={styles.secondaryInlineButtonText}>{t('saveSessionExecution')}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.postWorkoutCard}>
                    <Text style={styles.historyTitle}>{t('postWorkoutCheck')}</Text>
                    <View style={styles.inlineFieldsRow}>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('rpeLabel')}</Text>
                        <TextInput
                          style={styles.textInput}
                          value={postWorkoutRpe}
                          onChangeText={setPostWorkoutRpe}
                          placeholder={t('rpePlaceholder')}
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="number-pad"
                          returnKeyType="done"
                        />
                      </View>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('fatigueLabel')}</Text>
                        <TextInput
                          style={styles.textInput}
                          value={postWorkoutFatigue}
                          onChangeText={setPostWorkoutFatigue}
                          placeholder={t('fatiguePlaceholder')}
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="number-pad"
                          returnKeyType="done"
                        />
                      </View>
                      <View style={[styles.formSection, styles.inlineField]}>
                        <Text style={styles.inputLabel}>{t('legsLabel')}</Text>
                        <TextInput
                          style={styles.textInput}
                          value={postWorkoutLegs}
                          onChangeText={setPostWorkoutLegs}
                          placeholder={t('legsPlaceholder')}
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="number-pad"
                          returnKeyType="done"
                        />
                      </View>
                    </View>
                    <TouchableOpacity style={styles.secondaryInlineButton} onPress={applyPostWorkoutCheck} activeOpacity={0.75}>
                      <Text style={styles.secondaryInlineButtonText}>{t('applyNextSession')}</Text>
                    </TouchableOpacity>
                  </View>
                  </>
                  )}

                  {!simpleMode && exportHistory.length > 0 && (
                    <View style={styles.historyCard}>
                      <Text style={styles.historyTitle}>{t('recentExports')}</Text>

                      <TextInput
                        style={styles.historySearchInput}
                        value={exportHistorySearch}
                        onChangeText={setExportHistorySearch}
                        placeholder={t('searchByNameOrFormat')}
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                        returnKeyType="search"
                      />

                      <View style={styles.historyFilterRow}>
                        {(['All', '24h', '7d'] as ExportHistoryFilter[]).map((filter) => (
                          <TouchableOpacity
                            key={filter}
                            style={[styles.historyFilterChip, exportHistoryFilter === filter ? styles.historyFilterChipActive : undefined]}
                            onPress={() => setExportHistoryFilter(filter)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.historyFilterChipText, exportHistoryFilter === filter ? styles.historyFilterChipTextActive : undefined]}>{filter}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {filteredExportHistory.length === 0 && (
                        <Text style={styles.historyItemMeta}>{t('noExportsFilter')}</Text>
                      )}

                      {filteredExportHistory.map((entry) => (
                        <View key={entry.id} style={styles.historyItem}>
                          <Text style={styles.historyItemTitle}>{entry.label}</Text>
                          <Text style={styles.historyItemMeta}>
                            {entry.files} file(s) • {EXPORT_FORMAT_LABELS[entry.format] ?? entry.format} • {formatHistoryDate(entry.createdAt)}
                          </Text>
                          <TouchableOpacity
                            style={styles.historyReexportButton}
                            onPress={() => handleReexportHistoryEntry(entry)}
                            activeOpacity={0.75}
                          >
                            <Text style={styles.historyReexportButtonText}>{t('reexport')}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.regenerateButton}
                    onPress={handleGenerate}
                    activeOpacity={0.7}
                    disabled={isPending}
                    testID="regenerate-button"
                  >
                    <RefreshCw size={16} color={Colors.textSecondary} />
                    <Text style={styles.regenerateText}>{isSingleWorkoutMode ? t('regenerateWorkout') : t('regeneratePlan')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroSection: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: Colors.text,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 22,
  },
  languageRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  languageChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  languageChipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  languageChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
  },
  languageChipTextActive: {
    color: Colors.accentLight,
  },
  mainTabsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  mainTabChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mainTabChipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  mainTabChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
  },
  mainTabChipTextActive: {
    color: Colors.accentLight,
  },
  simpleModeToggle: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  simpleModeToggleActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  simpleModeToggleText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
  },
  simpleModeToggleTextActive: {
    color: Colors.accentLight,
  },
  tabletGrid: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formCardTablet: {
    flex: 1,
    marginBottom: 0,
  },
  actionsTablet: {
    width: 280,
  },
  formSection: {
    marginBottom: 14,
  },
  quickModesCard: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    padding: 10,
  },
  quickModesTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  quickModesSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  quickModesSectionTitle: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  quickModesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickModeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  quickModeFunButton: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  spinStudioCard: {
    marginTop: 10,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: Colors.zone1,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    padding: 10,
  },
  quickModeSpinButton: {
    borderColor: Colors.zone1,
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
  },
  quickModeButtonText: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '700' as const,
  },
  dayChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dayChipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  dayChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  dayChipTextActive: {
    color: Colors.accentLight,
  },
  modeToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeToggleButtonActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  modeToggleText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  modeToggleTextActive: {
    color: Colors.accentLight,
  },
  modeHintText: {
    marginTop: 8,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  filenameHintText: {
    marginTop: 8,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  filenamePreviewText: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  ftpTestCard: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    padding: 10,
  },
  crazyModesCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    padding: 10,
  },
  secondaryInlineButton: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryInlineButtonText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  inlineFieldsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  templateCodeInput: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    letterSpacing: 0.2,
  },
  multilineInput: {
    minHeight: 72,
    paddingTop: 10,
  },
  errorHint: {
    fontSize: 11,
    color: Colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
  planMeta: {
    marginTop: 2,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  planMetaText: {
    fontSize: 13,
    color: Colors.accentLight,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  resetNamesButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  resetNamesButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  saveFavoriteButton: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    paddingVertical: 10,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  saveFavoriteButtonText: {
    fontSize: 13,
    color: Colors.accentLight,
    fontWeight: '700' as const,
  },
  favoritesCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    padding: 10,
  },
  favoritesTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  favoriteItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  favoriteApplyButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  favoriteApplyText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  favoriteDeleteButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  favoriteDeleteText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  generateButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  generateButtonDisabled: {
    backgroundColor: Colors.textMuted,
    shadowOpacity: 0,
  },
  generateButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFF',
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultsSection: {
    marginTop: 24,
  },
  summaryCard: {
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.accentLight,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  gameRideInfoCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  gameRideInfoTitle: {
    fontSize: 12,
    color: Colors.accentLight,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  gameRideInfoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  gameRideReadinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gameRideListRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  readinessBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.surface,
  },
  readinessBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  analyticsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 14,
  },
  analyticsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  analyticsText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  analyticsZonesText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  calendarCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 14,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  calendarWeekLabel: {
    width: 28,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accentLight,
  },
  dayEmptyText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  calendarSessionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  calendarSessionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  calendarSessionChipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  calendarSessionChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  calendarSessionChipTextActive: {
    color: Colors.accentLight,
  },
  planListCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  planListCardTablet: {
    width: 280,
    marginBottom: 0,
    maxHeight: 420,
  },
  planListTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  planFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  planFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  planFilterChipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  planFilterChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  planFilterChipTextActive: {
    color: Colors.accentLight,
  },
  emptyFilteredText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  planItem: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  planItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  phaseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  phaseBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  planItemActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  planItemTitle: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  planItemTitleActive: {
    color: Colors.accentLight,
  },
  planItemTss: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  planItemExecutionMeta: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  sessionMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sessionMetaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  sessionMetaButtonActive: {
    borderColor: Colors.accent,
  },
  sessionMetaButtonText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  sessionMetaButtonTextActive: {
    color: Colors.accentLight,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 4,
  },
  feedbackChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  feedbackChipText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  feedbackChipTextActive: {
    color: Colors.accentLight,
  },
  previewTablet: {
    flex: 1,
  },
  validationCard: {
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  validationTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  validationText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  validationWarning: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '700' as const,
    lineHeight: 18,
  },
  editWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed' as const,
  },
  rideOnBikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  rideOnBikeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  editWorkoutButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 16,
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.accent,
    letterSpacing: 0.2,
  },
  downloadStatusCard: {
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  downloadStatusText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  integrationRow: {
    marginTop: 10,
    gap: 8,
  },
  integrationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  integrationButtonText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  postWorkoutCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    padding: 10,
  },
  secondaryActionButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  secondaryActionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  historyCard: {
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  historyTitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  historyItem: {
    marginBottom: 8,
  },
  historySearchInput: {
    marginBottom: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  historyFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  historyFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  historyFilterChipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  historyFilterChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  historyFilterChipTextActive: {
    color: Colors.accentLight,
  },
  historyItemTitle: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  historyItemMeta: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  historyReexportButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  historyReexportButtonText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    marginTop: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  regenerateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});
