import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Zap, Download, RefreshCw, Pencil, Bike } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { usePlanContext, PlanWorkout } from '@/contexts/PlanContext';
import Colors from '@/constants/colors';
import PickerField from '@/components/PickerField';
import WorkoutPreview from '@/components/WorkoutPreview';
import { useTranslation } from '@/hooks/useTranslation';
import {
  WorkoutDuration,
  TrainingGoal,
  FitnessLevel,
  WorkoutStyle,
  WorkoutInterval,
  ProgressionObjective,
} from '@/types/workout';
import {
  generateZwoXml,
  generateIctxXml,
  generateMrcText,
  generateErgText,
  calculateTSS,
  downloadZwoFile,
} from '@/utils/zwo';
import { generateWorkout } from '@/utils/workout-generator';
import { getAdaptiveSessionV2, getDefaultProgressionObjective } from '@/utils/adaptive-v2';
import { rebalancePlanLoad } from '@/utils/plan-load';
import {
  DURATIONS,
  GOALS,
  LEVELS,
  STYLES,
  WEEKS,
  SESSIONS_PER_WEEK,
  EXPORT_FILE_FORMATS,
  EXPORT_FORMAT_LABELS,
  NORMAL_MODE_PRESETS,
  QuickModePreset,
} from '@/constants/workout-options';

type PlanPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';
type ExportFileFormat = (typeof EXPORT_FILE_FORMATS)[number];
type ExportSingleFileFormat = Exclude<ExportFileFormat, '.ictx+.zwo'>;

function parseDuration(label: string): WorkoutDuration {
  return parseInt(label.split(' ')[0], 10) as WorkoutDuration;
}

function parseCount(label: string): number {
  return parseInt(label.split(' ')[0], 10);
}

function getWeeklyPhase(week: number, totalWeeks: number): PlanPhase {
  if (totalWeeks <= 2) return week === totalWeeks ? 'Peak' : 'Build';
  if (week === totalWeeks) return 'Peak';
  if (week % 4 === 0) return 'Recovery';
  if (week <= Math.ceil(totalWeeks / 2)) return 'Base';
  return 'Build';
}

function getPhaseStyle(baseStyle: WorkoutStyle, phase: PlanPhase, idx: number): WorkoutStyle {
  if (phase === 'Recovery') return 'Steady';
  if (phase === 'Peak') return idx % 2 === 0 ? 'Over/Under' : 'Intervals';
  if (phase === 'Build') return idx % 3 === 0 ? 'Pyramid' : baseStyle;
  return idx % 2 === 0 ? baseStyle : 'Steady';
}

function getPhaseGoal(baseGoal: TrainingGoal, phase: PlanPhase): TrainingGoal {
  if (phase === 'Recovery') return 'Recovery Ride';
  if (phase === 'Peak' && baseGoal === 'Endurance (Z2)') return 'Time Trial';
  return baseGoal;
}

function getPhaseColor(phase: PlanPhase): string {
  if (phase === 'Base') return '#0EA5A4';
  if (phase === 'Build') return '#F59E0B';
  if (phase === 'Peak') return '#F97316';
  return '#60A5FA';
}

function resolveExportTargets(format: ExportFileFormat): ExportSingleFileFormat[] {
  if (format === '.ictx+.zwo') return ['.ictx', '.zwo'];
  return [format];
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildFilenameDateToken(): string {
  const d = new Date();
  return `${d.getFullYear()}${`${d.getMonth() + 1}`.padStart(2, '0')}${`${d.getDate()}`.padStart(2, '0')}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { t } = useTranslation();
  const router = useRouter();

  const [ftp, setFtp] = useState<string>('');
  const [duration, setDuration] = useState<string>('60 min');
  const [goal, setGoal] = useState<TrainingGoal>('Sweet Spot');
  const [level, setLevel] = useState<FitnessLevel>('Intermediate');
  const [style, setStyle] = useState<WorkoutStyle>('Intervals');
  const [planWeeks, setPlanWeeks] = useState<string>('1 week');
  const [sessionsPerWeek, setSessionsPerWeek] = useState<string>('1 session');
  const [exportFileFormat, setExportFileFormat] = useState<ExportFileFormat>('.zwo');
  const [downloadStatus, setDownloadStatus] = useState<string>('');

  const { plan, setPlan, selectedPlanWorkoutId, setSelectedPlanWorkoutId, selectedWorkout: ctxSelectedWorkout } = usePlanContext();

  const resultOpacity = useRef(new Animated.Value(0)).current;
  const ftpNum = parseInt(ftp, 10);
  const totalSessions = parseCount(planWeeks) * parseCount(sessionsPerWeek);
  const isSingleWorkout = totalSessions === 1;

  const selectedWorkout = useMemo(() => {
    if (plan.length === 0) return null;
    return plan.find((w) => w.id === selectedPlanWorkoutId) ?? plan[0];
  }, [plan, selectedPlanWorkoutId]);

  const showResults = useCallback(() => {
    resultOpacity.setValue(0);
    Animated.timing(resultOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [resultOpacity]);

  const applyQuickMode = useCallback((preset: QuickModePreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGoal(preset.goal);
    setStyle(preset.style);
    setDownloadStatus(`${preset.label}`);
    console.log('[Builder] Quick mode applied:', preset.label);
  }, []);

  const generatePlanSession = useCallback(async (
    ftpValue: number,
    parsedDuration: WorkoutDuration,
    week: number,
    sessionInWeek: number,
    weeksCount: number,
    sessionsCount: number,
    single: boolean,
    idSuffix: string,
  ): Promise<PlanWorkout> => {
    const phase = getWeeklyPhase(week, weeksCount);
    const progression: ProgressionObjective = getDefaultProgressionObjective(goal);
    const adaptive = getAdaptiveSessionV2({
      objective: progression,
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

    const goalForSession = adaptive.goal || getPhaseGoal(goal, phase);
    const styleForSession = adaptive.style || getPhaseStyle(style, phase, sessionInWeek - 1);
    const durationForSession = adaptive.duration || parsedDuration;

    try {
      const result = await generateWorkout({
        ftp: ftpValue,
        duration: durationForSession,
        goal: goalForSession,
        level,
        style: styleForSession,
        warmupMinutes: 5,
        cooldownMinutes: 6,
        warmupPowerPercent: 55,
        cooldownPowerPercent: 45,
        intensityAdjustmentPercent: adaptive.intensityAdjustmentPercent,
        ergSmoothMode: true,
      });

      return {
        id: `${week}-${sessionInWeek}-${Date.now()}-${idSuffix}`,
        name: single ? 'Workout' : `Week ${week} · Session ${sessionInWeek}`,
        summary: result.summary,
        intervals: result.intervals,
        tss: calculateTSS(result.intervals, ftpValue),
        week,
        sessionInWeek,
        phase,
      };
    } catch (err) {
      console.error('[Builder] Session generation failed, using fallback:', err);
      const fallback: WorkoutInterval[] = [
        { type: 'warmup', duration_seconds: 5 * 60, power_percent_ftp: 55 },
        { type: 'interval', duration_seconds: Math.max(8 * 60, durationForSession * 60 - 11 * 60), power_percent_ftp: 88 },
        { type: 'cooldown', duration_seconds: 6 * 60, power_percent_ftp: 45 },
      ];
      return {
        id: `${week}-${sessionInWeek}-${Date.now()}-${idSuffix}`,
        name: single ? 'Workout' : `Week ${week} · Session ${sessionInWeek}`,
        summary: `Fallback ${goalForSession} session.`,
        intervals: fallback,
        tss: calculateTSS(fallback, ftpValue),
        week,
        sessionInWeek,
        phase,
      };
    }
  }, [goal, style, level]);

  const mutation = useMutation({
    mutationFn: async () => {
      const ftpValue = parseInt(ftp, 10);
      if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
        throw new Error(t('invalidFtpMessage'));
      }

      const weeksCount = parseCount(planWeeks);
      const sessionsCount = parseCount(sessionsPerWeek);
      const total = weeksCount * sessionsCount;
      const parsedDur = parseDuration(duration);
      const generated: PlanWorkout[] = [];

      for (let i = 0; i < total; i += 1) {
        const week = Math.floor(i / sessionsCount) + 1;
        const session = (i % sessionsCount) + 1;
        generated.push(await generatePlanSession(ftpValue, parsedDur, week, session, weeksCount, sessionsCount, total === 1, String(i)));
      }

      if (generated.length === 0) throw new Error('Could not generate any workout sessions.');
      return rebalancePlanLoad(generated, ftpValue);
    },
    onSuccess: (generated) => {
      console.log('[Builder] Plan generated:', generated.length, 'sessions');
      setPlan(generated);
      setSelectedPlanWorkoutId(generated[0]?.id ?? '');
      showResults();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    },
    onError: (error: Error) => {
      console.error('[Builder] Generation failed:', error);
      Alert.alert(t('generationFailedTitle'), error.message || t('generationFailedFallback'));
    },
  });

  const handleGenerate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mutation.mutate();
  }, [mutation]);

  const handleRegenerate = useCallback(async () => {
    if (!selectedWorkout || mutation.isPending) return;
    const ftpValue = parseInt(ftp, 10);
    if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
      Alert.alert(t('invalidFtpTitle'), t('invalidFtpMessage'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const weeksCount = parseCount(planWeeks);
      const sessionsCount = parseCount(sessionsPerWeek);
      const regen = await generatePlanSession(ftpValue, parseDuration(duration), selectedWorkout.week, selectedWorkout.sessionInWeek, weeksCount, sessionsCount, totalSessions === 1, 'regen');
      setPlan((prev) => prev.map((w) => w.id === selectedWorkout.id ? { ...regen, id: w.id } : w));
      setDownloadStatus(t('selectedWorkoutRegenerated'));
    } catch (err) {
      console.error('[Builder] Regeneration failed:', err);
      Alert.alert(t('regenerationFailedTitle'), t('regenerationFailedMessage'));
    }
  }, [selectedWorkout, mutation.isPending, ftp, planWeeks, sessionsPerWeek, duration, totalSessions, generatePlanSession, setPlan, t]);

  const handleDownload = useCallback(async () => {
    if (!selectedWorkout) return;
    const ftpValue = parseInt(ftp, 10) || 200;
    const targets = resolveExportTargets(exportFileFormat);
    let downloaded = 0;

    setDownloadStatus(t('preparingFiles', { count: plan.length * targets.length }));

    for (const workout of (plan.length === 1 ? [selectedWorkout] : plan)) {
      for (const format of targets) {
        const goalLabel = sanitizeFilenamePart(workout.name || goal);
        const dateLabel = buildFilenameDateToken();
        const filename = `${goalLabel}_${dateLabel}${format}`;

        let content = '';
        if (format === '.zwo') content = generateZwoXml(workout.intervals, ftpValue, workout.name);
        else if (format === '.ictx') content = generateIctxXml(workout.intervals, ftpValue, { workoutName: workout.name });
        else if (format === '.mrc') content = generateMrcText(workout.intervals, ftpValue);
        else if (format === '.erg') content = generateErgText(workout.intervals, ftpValue);

        if (content) {
          await downloadZwoFile(content, filename);
          downloaded += 1;
        }
      }
    }

    if (downloaded > 0) {
      setDownloadStatus(t('doneExported', { count: downloaded }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setDownloadStatus(t('noFilesDownloaded'));
    }
  }, [selectedWorkout, ftp, exportFileFormat, plan, goal, t]);

  const handleEditWorkout = useCallback(() => {
    if (!selectedWorkout) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/edit-workout', params: { id: selectedWorkout.id, ftp: ftp || '200' } });
  }, [selectedWorkout, ftp, router]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Bike size={16} color={Colors.accent} />
              <Text style={styles.heroBadgeText}>{t('badge')}</Text>
            </View>
            <Text style={styles.heroTitle}>
              {isSingleWorkout ? t('heroSingleTitle') : t('heroPlanTitle')}
            </Text>
          </View>

          {/* Quick Modes */}
          <View style={styles.quickModesRow}>
            {NORMAL_MODE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[styles.quickChip, goal === preset.goal && style === preset.style && styles.quickChipActive]}
                onPress={() => applyQuickMode(preset)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickChipText, goal === preset.goal && style === preset.style && styles.quickChipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* FTP */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t('ftpLabel')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={ftp}
              onChangeText={setFtp}
              placeholder={t('ftpPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              testID="ftp-input"
            />
          </View>

          {/* Workout Settings */}
          <View style={styles.card}>
            <PickerField label={t('durationLabel')} value={duration} options={DURATIONS} onSelect={setDuration} />
            <PickerField label={t('goalLabel')} value={goal} options={GOALS} onSelect={setGoal} />
            <PickerField label={t('levelLabel')} value={level} options={LEVELS} onSelect={setLevel} />
            <PickerField label={t('styleLabel')} value={style} options={STYLES} onSelect={setStyle} />
          </View>

          {/* Plan Settings */}
          <View style={styles.card}>
            <PickerField label={t('planLengthLabel')} value={planWeeks} options={WEEKS} onSelect={setPlanWeeks} />
            <PickerField label={t('sessionsLabel')} value={sessionsPerWeek} options={SESSIONS_PER_WEEK} onSelect={setSessionsPerWeek} />
            <Text style={styles.totalLabel}>
              {totalSessions} {t('totalSessions')}
            </Text>
          </View>

          {/* Export Format */}
          <View style={styles.card}>
            <PickerField
              label={t('exportFormatLabel')}
              value={EXPORT_FORMAT_LABELS[exportFileFormat]}
              options={EXPORT_FILE_FORMATS.map((f) => EXPORT_FORMAT_LABELS[f])}
              onSelect={(label) => {
                const found = EXPORT_FILE_FORMATS.find((f) => EXPORT_FORMAT_LABELS[f] === label);
                if (found) setExportFileFormat(found);
              }}
            />
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateButton, mutation.isPending && styles.generateButtonDisabled]}
            onPress={handleGenerate}
            disabled={mutation.isPending}
            activeOpacity={0.8}
            testID="generate-button"
          >
            {mutation.isPending ? (
              <>
                <ActivityIndicator color="#FFF" size="small" />
                <Text style={styles.generateButtonText}>
                  {isSingleWorkout ? t('generatingWorkout') : t('generatingPlan')}
                </Text>
              </>
            ) : (
              <>
                <Zap size={20} color="#FFF" />
                <Text style={styles.generateButtonText}>
                  {isSingleWorkout ? t('generateWorkout') : t('generatePlan')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Results */}
          {plan.length > 0 && selectedWorkout && (
            <Animated.View style={{ opacity: resultOpacity }}>
              {/* Plan Session Selector */}
              {plan.length > 1 && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>{t('planSessionsTitle')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionScroll}>
                    {plan.map((w) => {
                      const isActive = w.id === selectedWorkout.id;
                      return (
                        <TouchableOpacity
                          key={w.id}
                          style={[styles.sessionChip, isActive && styles.sessionChipActive]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedPlanWorkoutId(w.id);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.phaseDot, { backgroundColor: getPhaseColor(w.phase) }]} />
                          <Text style={[styles.sessionChipText, isActive && styles.sessionChipTextActive]}>
                            W{w.week}S{w.sessionInWeek}
                          </Text>
                          <Text style={styles.sessionTssLabel}>{w.tss}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Selected Workout Info */}
              <View style={styles.selectedCard}>
                <Text style={styles.selectedTitle}>{selectedWorkout.name}</Text>
                <Text style={styles.selectedSummary}>{selectedWorkout.summary}</Text>
                {selectedWorkout.phase && (
                  <View style={[styles.phaseBadge, { backgroundColor: getPhaseColor(selectedWorkout.phase) }]}>
                    <Text style={styles.phaseBadgeText}>{selectedWorkout.phase} · TSS {selectedWorkout.tss}</Text>
                  </View>
                )}
              </View>

              {/* Preview */}
              <WorkoutPreview
                intervals={selectedWorkout.intervals}
                tss={selectedWorkout.tss}
                ftp={ftpNum || 200}
              />

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionButton} onPress={handleRegenerate} activeOpacity={0.7}>
                  <RefreshCw size={16} color={Colors.textSecondary} />
                  <Text style={styles.actionButtonText}>{t('regenerateSelected')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleEditWorkout} activeOpacity={0.7}>
                  <Pencil size={16} color={Colors.textSecondary} />
                  <Text style={styles.actionButtonText}>{t('editWorkout')}</Text>
                </TouchableOpacity>
              </View>

              {/* Download Button */}
              <TouchableOpacity style={styles.downloadButton} onPress={handleDownload} activeOpacity={0.8}>
                <Download size={20} color="#FFF" />
                <Text style={styles.downloadButtonText}>
                  {isSingleWorkout ? t('downloadWorkout') : t('downloadPlan')}
                </Text>
              </TouchableOpacity>

              {downloadStatus.length > 0 && (
                <Text style={styles.statusText}>{downloadStatus}</Text>
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  hero: {
    marginTop: 12,
    marginBottom: 20,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  quickModesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249,115,22,0.12)',
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  quickChipTextActive: {
    color: Colors.accentLight,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 4,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sessionScroll: {
    flexDirection: 'row',
  },
  sessionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  sessionChipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249,115,22,0.15)',
  },
  sessionChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  sessionChipTextActive: {
    color: Colors.accentLight,
  },
  sessionTssLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  selectedCard: {
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.accentLight,
    marginBottom: 4,
  },
  selectedSummary: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  phaseBadge: {
    alignSelf: 'flex-start' as const,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  phaseBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accentDark,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 8,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 4,
    marginBottom: 8,
  },
});
