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
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Zap, Download, RefreshCw, ChevronRight, CalendarDays, FlameKindling } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import PickerField from '@/components/PickerField';
import WorkoutPreview from '@/components/WorkoutPreview';
import {
  WorkoutDuration,
  TrainingGoal,
  FitnessLevel,
  WorkoutStyle,
  WorkoutInterval,
} from '@/types/workout';
import { generateZwoXml, calculateTSS, downloadZwoFile } from '@/utils/zwo';
import { generateWorkout } from '@/utils/workout-generator';

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
const WEEKS: string[] = ['1 week', '2 weeks', '3 weeks', '4 weeks', '6 weeks', '8 weeks'];
const SESSIONS_PER_WEEK: string[] = ['2 sessions', '3 sessions', '4 sessions', '5 sessions', '6 sessions'];

type PlanPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';

interface PlanWorkout {
  id: string;
  name: string;
  summary: string;
  intervals: WorkoutInterval[];
  tss: number;
  week: number;
  sessionInWeek: number;
  phase: PlanPhase;
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
  if (phase === 'Peak' || phase === 'Build') {
    if (baseDuration >= 90) {
      return 90;
    }
    return (baseDuration + 15) as WorkoutDuration;
  }

  if (phase === 'Recovery') {
    if (baseDuration <= 30) {
      return 30;
    }
    return (baseDuration - 15) as WorkoutDuration;
  }

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTabletLayout = width >= 900;
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();

  const [ftp, setFtp] = useState<string>('');
  const [duration, setDuration] = useState<string>('60 min');
  const [goal, setGoal] = useState<TrainingGoal>('Sweet Spot');
  const [level, setLevel] = useState<FitnessLevel>('Intermediate');
  const [style, setStyle] = useState<WorkoutStyle>('Intervals');
  const [planWeeks, setPlanWeeks] = useState<string>('4 weeks');
  const [sessionsPerWeek, setSessionsPerWeek] = useState<string>('3 sessions');

  const [plan, setPlan] = useState<PlanWorkout[]>([]);
  const [selectedPlanWorkoutId, setSelectedPlanWorkoutId] = useState<string>('');
  const [downloadStatus, setDownloadStatus] = useState<string>('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  const selectedWorkout = useMemo(() => {
    if (plan.length === 0) {
      return null;
    }

    return plan.find((item) => item.id === selectedPlanWorkoutId) ?? plan[0];
  }, [plan, selectedPlanWorkoutId]);

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

  const showResults = useCallback(() => {
    resultOpacity.setValue(0);
    Animated.timing(resultOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [resultOpacity]);

  const mutation = useMutation({
    mutationFn: async () => {
      const ftpValue = parseInt(ftp, 10);
      if (!ftpValue || ftpValue < 50 || ftpValue > 500) {
        throw new Error('Please enter a valid FTP between 50 and 500 watts.');
      }

      const weeksCount = parseCount(planWeeks);
      const sessionsCount = parseCount(sessionsPerWeek);
      const totalSessions = weeksCount * sessionsCount;

      if (totalSessions < 1 || totalSessions > 48) {
        throw new Error('Plan size is invalid. Try fewer weeks or sessions.');
      }

      startPulse();

      const generatedPlan: PlanWorkout[] = [];
      const parsedDuration = parseDuration(duration);

      for (let i = 0; i < totalSessions; i += 1) {
        const week = Math.floor(i / sessionsCount) + 1;
        const sessionInWeek = (i % sessionsCount) + 1;
        const phase = getWeeklyPhase(week, weeksCount);
        const durationForSession = getPhaseDuration(parsedDuration, phase);
        const styleForSession = getPhaseStyle(style, phase, sessionInWeek - 1);
        const goalForSession = getPhaseGoal(goal, phase);

        try {
          const result = await generateWorkout({
            ftp: ftpValue,
            duration: durationForSession,
            goal: goalForSession,
            level,
            style: styleForSession,
          });

          generatedPlan.push({
            id: `${week}-${sessionInWeek}-${Date.now()}-${i}`,
            name: `Week ${week} • Session ${sessionInWeek}`,
            summary: result.summary,
            intervals: result.intervals,
            tss: calculateTSS(result.intervals, ftpValue),
            week,
            sessionInWeek,
            phase,
          });
        } catch (sessionError) {
          console.error('[HomeScreen] Session generation failed. Using local fallback session.', {
            week,
            sessionInWeek,
            styleForSession,
            sessionError,
          });

          const localFallbackIntervals: WorkoutInterval[] = [
            { type: 'warmup', duration_seconds: 8 * 60, power_percent_ftp: 55 },
            { type: 'interval', duration_seconds: Math.max(8 * 60, parsedDuration * 60 - 14 * 60), power_percent_ftp: 88 },
            { type: 'cooldown', duration_seconds: 6 * 60, power_percent_ftp: 45 },
          ];

          generatedPlan.push({
            id: `${week}-${sessionInWeek}-${Date.now()}-${i}`,
            name: `Week ${week} • Session ${sessionInWeek}`,
            summary: `Fallback ${goalForSession} session generated locally.`,
            intervals: localFallbackIntervals,
            tss: calculateTSS(localFallbackIntervals, ftpValue),
            week,
            sessionInWeek,
            phase,
          });
        }
      }

      if (generatedPlan.length === 0) {
        throw new Error('Could not generate any workout sessions.');
      }

      return generatedPlan;
    },
    onSuccess: (generatedPlan) => {
      stopPulse();
      console.log('[HomeScreen] Plan generated successfully. Sessions:', generatedPlan.length);

      setPlan(generatedPlan);
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
      const message = error.message?.trim() || 'Workout generation failed. Try again.';
      Alert.alert('Generation Failed', message);
    },
  });

  const { mutate, isPending } = mutation;

  const handleGenerate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mutate();
  }, [mutate]);

  const handleDownloadPlan = useCallback(async () => {
    if (plan.length === 0) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const goalSlug = goal.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    let successfulDownloads = 0;
    setDownloadStatus(`Preparing ${plan.length} files...`);

    for (let i = 0; i < plan.length; i += 1) {
      const workout = plan[i];
      const filename = `ictrainer_${goalSlug}_w${Math.floor(i / parseCount(sessionsPerWeek)) + 1}_s${(i % parseCount(sessionsPerWeek)) + 1}.zwo`;
      const xml = generateZwoXml(workout.intervals, workout.name);
      const downloaded = await downloadZwoFile(xml, filename);

      if (downloaded) {
        successfulDownloads += 1;
      }

      if (Platform.OS === 'web') {
        setDownloadStatus(`Downloaded ${successfulDownloads}/${plan.length} files...`);
        await wait(180);
      } else {
        break;
      }
    }

    if (successfulDownloads > 0) {
      if (Platform.OS === 'web') {
        setDownloadStatus(`Done: ${successfulDownloads} workout files exported.`);
        Alert.alert('Plan downloaded', `${successfulDownloads} workout files exported.`);
      } else {
        setDownloadStatus('Workout exported. Open share sheet to save to Files.');
        Alert.alert('Workout ready', 'Workout file created. You can now save or share it from the iOS sheet.');
      }
      return;
    }

    setDownloadStatus('No files were downloaded. Please try again.');
  }, [plan, goal, sessionsPerWeek]);

  const ftpNum = parseInt(ftp, 10);
  const isFormValid = ftpNum >= 50 && ftpNum <= 500;
  const totalSessions = parseCount(planWeeks) * parseCount(sessionsPerWeek);

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
            <View style={styles.badge}>
              <CalendarDays size={14} color={Colors.accent} />
              <Text style={styles.badgeText}>Training Planner</Text>
            </View>
            <Text style={styles.heroTitle}>ICTrainer{`\n`}Plan Builder</Text>
            <Text style={styles.heroSubtitle}>Create full training plans and download every session as .zwo</Text>
            <TouchableOpacity
              style={styles.punisherBannerBtn}
              onPress={() => router.push('/punisher')}
              activeOpacity={0.8}
              testID="go-to-punisher-btn"
            >
              <FlameKindling size={16} color={Colors.accent} />
              <Text style={styles.punisherBannerText}>Try ICTX Punisher — brutal spin/torque intervals</Text>
              <ChevronRight size={16} color={Colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={isTabletLayout ? styles.tabletGrid : undefined}>
            <View style={[styles.formCard, isTabletLayout ? styles.formCardTablet : undefined]}>
              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>Your FTP (Watts)</Text>
                <TextInput
                  style={styles.textInput}
                  value={ftp}
                  onChangeText={setFtp}
                  placeholder="e.g. 250"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  testID="ftp-input"
                />
                {ftp.length > 0 && !isFormValid && (
                  <Text style={styles.errorHint}>Enter a value between 50–500</Text>
                )}
              </View>

              <PickerField
                label="Workout Duration"
                value={duration}
                options={DURATIONS}
                onSelect={setDuration}
                testID="duration-picker"
              />

              <PickerField
                label="Training Goal"
                value={goal}
                options={GOALS}
                onSelect={(v) => setGoal(v as TrainingGoal)}
                testID="goal-picker"
              />

              <PickerField
                label="Fitness Level"
                value={level}
                options={LEVELS}
                onSelect={(v) => setLevel(v as FitnessLevel)}
                testID="level-picker"
              />

              <PickerField
                label="Base Workout Style"
                value={style}
                options={STYLES}
                onSelect={(v) => setStyle(v as WorkoutStyle)}
                testID="style-picker"
              />

              <PickerField
                label="Plan Length"
                value={planWeeks}
                options={WEEKS}
                onSelect={setPlanWeeks}
                testID="plan-weeks-picker"
              />

              <PickerField
                label="Sessions Per Week"
                value={sessionsPerWeek}
                options={SESSIONS_PER_WEEK}
                onSelect={setSessionsPerWeek}
                testID="sessions-picker"
              />

              <View style={styles.planMeta}>
                <Text style={styles.planMetaText}>{totalSessions} total sessions</Text>
              </View>
            </View>

            <Animated.View style={[{ transform: [{ scale: pulseAnim }] }, isTabletLayout ? styles.actionsTablet : undefined]}>
              <TouchableOpacity
                style={[styles.generateButton, !isFormValid && styles.generateButtonDisabled]}
                onPress={handleGenerate}
                activeOpacity={0.8}
                disabled={!isFormValid || isPending}
                testID="generate-button"
              >
                {isPending ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.generateButtonText}>Generating Plan...</Text>
                  </View>
                ) : (
                  <View style={styles.loadingRow}>
                    <Zap size={20} color="#FFF" fill="#FFF" />
                    <Text style={styles.generateButtonText}>Generate Plan</Text>
                    <ChevronRight size={18} color="rgba(255,255,255,0.6)" />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {selectedWorkout && (
            <Animated.View style={[styles.resultsSection, { opacity: resultOpacity }]}> 
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>{selectedWorkout.name}</Text>
                <Text style={styles.summaryText}>{selectedWorkout.summary}</Text>
              </View>

              <View style={isTabletLayout ? styles.tabletGrid : undefined}>
                <View style={[styles.planListCard, isTabletLayout ? styles.planListCardTablet : undefined]}>
                  <Text style={styles.planListTitle}>Plan Sessions</Text>
                  {plan.map((item) => {
                    const isActive = item.id === selectedWorkout.id;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.planItem, isActive ? styles.planItemActive : undefined]}
                        onPress={() => setSelectedPlanWorkoutId(item.id)}
                        activeOpacity={0.85}
                        testID={`plan-item-${item.id}`}
                      >
                        <View style={styles.planItemHeader}>
                          <Text style={[styles.planItemTitle, isActive ? styles.planItemTitleActive : undefined]}>{item.name}</Text>
                          <View style={[styles.phaseBadge, { backgroundColor: getPhaseColor(item.phase) }]}> 
                            <Text style={styles.phaseBadgeText}>{getPhaseLabel(item.phase)}</Text>
                          </View>
                        </View>
                        <Text style={styles.planItemTss}>TSS {item.tss}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={isTabletLayout ? styles.previewTablet : undefined}>
                  <WorkoutPreview
                    intervals={selectedWorkout.intervals}
                    tss={selectedWorkout.tss}
                    ftp={parseInt(ftp, 10) || 200}
                  />

                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={handleDownloadPlan}
                    activeOpacity={0.8}
                    testID="download-button"
                  >
                    <Download size={20} color={Colors.accent} />
                    <Text style={styles.downloadButtonText}>Download Full Plan (.zwo)</Text>
                  </TouchableOpacity>

                  {downloadStatus.length > 0 && (
                    <View style={styles.downloadStatusCard} testID="download-status">
                      <Text style={styles.downloadStatusText}>{downloadStatus}</Text>
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
                    <Text style={styles.regenerateText}>Regenerate Plan</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
  punisherBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  punisherBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accent,
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
  previewTablet: {
    flex: 1,
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
