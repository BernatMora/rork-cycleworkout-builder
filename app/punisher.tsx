import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Zap,
  Download,
  RefreshCw,
  ArrowLeft,
  BookOpen,
  Trash2,
  Save,
  FlameKindling,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import PickerField from '@/components/PickerField';
import {
  generatePunisherWorkout,
  PUNISHER_PRESETS,
} from '@/utils/punisher/engine';
import { generateIctxXml, downloadIctxFile, buildWorkoutStruct } from '@/utils/punisher/ictx';
import {
  PunisherFocus,
  MaxRatioClamp,
  PunisherWorkout,
  SavedSession,
  PunisherPreset,
} from '@/utils/punisher/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FOCUS_OPTIONS: PunisherFocus[] = ['CADENCE', 'TORQUE', 'MIXED', 'OVER_UNDER'];
const MAX_RATIO_OPTIONS: string[] = ['100', '110', '120', '130', '150'];
const DURATION_OPTIONS: string[] = ['30', '45', '60', '75', '90'];
const STORAGE_KEY = 'punisher_library';

// ---------------------------------------------------------------------------
// Colour helpers (re-use zone colours adapted for levelRatio)
// ---------------------------------------------------------------------------
function getRatioColor(ratio: number): string {
  if (ratio < 60) return Colors.zone1;
  if (ratio < 80) return Colors.zone2;
  if (ratio < 100) return Colors.zone3;
  if (ratio < 120) return Colors.zone4;
  if (ratio < 140) return Colors.zone5;
  return Colors.zone6;
}

function getLegTypeColor(type: string): string {
  switch (type) {
    case 'warmup': return Colors.warmup;
    case 'cooldown': return Colors.cooldown;
    case 'recovery': return Colors.recovery;
    case 'spin': return Colors.zone4;
    case 'torque': return Colors.zone5;
    default: return Colors.text;
  }
}

// ---------------------------------------------------------------------------
// Seeded randomise helper for the UI "Randomize" button
// ---------------------------------------------------------------------------
function randomSeed(): number {
  return Math.floor(Math.random() * 999999) + 1;
}

// ---------------------------------------------------------------------------
// Library persistence
// ---------------------------------------------------------------------------
async function loadLibrary(): Promise<SavedSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedSession[];
  } catch {
    return [];
  }
}

async function saveLibrary(sessions: SavedSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Cruelty slider (simple inline row buttons)
// ---------------------------------------------------------------------------
function CrueltySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={sliderStyles.row}>
      {Array.from({ length: 11 }, (_, i) => (
        <TouchableOpacity
          key={i}
          style={[sliderStyles.pip, i <= value && sliderStyles.pipActive]}
          onPress={() => onChange(i)}
          activeOpacity={0.7}
        >
          <Text style={[sliderStyles.pipText, i <= value && sliderStyles.pipTextActive]}>
            {i}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  pip: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  pipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  pipTextActive: {
    color: '#FFF',
  },
});

// ---------------------------------------------------------------------------
// Timeline bar
// ---------------------------------------------------------------------------
function TimelineBar({ workout }: { workout: PunisherWorkout }) {
  const total = workout.legs.reduce((s, l) => s + l.duration_seconds, 0);
  return (
    <View style={tlStyles.container}>
      {workout.legs.map((leg, i) => {
        const widthPct = (leg.duration_seconds / total) * 100;
        const color = getLegTypeColor(leg.type);
        return (
          <View
            key={i}
            style={[
              tlStyles.bar,
              { width: `${widthPct}%` as unknown as number, backgroundColor: color },
            ]}
          />
        );
      })}
    </View>
  );
}

const tlStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    marginVertical: 8,
  },
  bar: {
    height: '100%',
  },
});

// ---------------------------------------------------------------------------
// Power chart
// ---------------------------------------------------------------------------
function PowerChart({ workout }: { workout: PunisherWorkout }) {
  const total = workout.legs.reduce((s, l) => s + l.duration_seconds, 0);
  const maxR = Math.max(...workout.legs.map((l) => l.levelRatio));
  return (
    <View style={pcStyles.container}>
      <View style={pcStyles.chart}>
        {workout.legs.map((leg, i) => {
          const widthPct = (leg.duration_seconds / total) * 100;
          const heightPct = Math.max((leg.levelRatio / (maxR + 20)) * 100, 6);
          const color = getRatioColor(leg.levelRatio);
          return (
            <View
              key={i}
              style={[
                pcStyles.bar,
                {
                  width: `${widthPct}%` as unknown as number,
                  height: `${heightPct}%` as unknown as number,
                  backgroundColor: color,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={pcStyles.baseline} />
    </View>
  );
}

const pcStyles = StyleSheet.create({
  container: {
    height: 100,
    paddingHorizontal: 0,
    marginVertical: 8,
  },
  chart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  bar: {
    borderRadius: 2,
    minWidth: 2,
  },
  baseline: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 2,
  },
});

// ---------------------------------------------------------------------------
// Duration formatter
// ---------------------------------------------------------------------------
function fmtSecs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function PunisherScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // --- Form state ---
  const [ftp, setFtp] = useState('250');
  const [duration, setDuration] = useState('45');
  const [focus, setFocus] = useState<PunisherFocus>('MIXED');
  const [cruelty, setCruelty] = useState(9);
  const [seed, setSeed] = useState(String(randomSeed()));
  const [maxRatio, setMaxRatio] = useState('120');

  // --- Generated workout ---
  const [workout, setWorkout] = useState<PunisherWorkout | null>(null);

  // --- Library ---
  const [library, setLibrary] = useState<SavedSession[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');

  // --- UI ---
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadLibrary().then(setLibrary);
  }, []);

  const ftpNum = parseInt(ftp, 10);
  const isFormValid = ftpNum >= 50 && ftpNum <= 500;
  const seedNum = parseInt(seed, 10) || 1;

  // --- Generate ---
  const handleGenerate = useCallback(() => {
    if (!isFormValid) return;
    const result = generatePunisherWorkout({
      ftp: ftpNum,
      duration: parseInt(duration, 10),
      focus,
      cruelty,
      seed: seedNum,
      maxRatio: parseInt(maxRatio, 10) as MaxRatioClamp,
    });
    setWorkout(result);
  }, [isFormValid, ftpNum, duration, focus, cruelty, seedNum, maxRatio]);

  // --- Randomize seed ---
  const handleRandomize = useCallback(() => {
    const s = String(randomSeed());
    setSeed(s);
  }, []);

  // --- Apply preset ---
  const handlePreset = useCallback((preset: PunisherPreset) => {
    const p = preset.params;
    if (p.duration) setDuration(String(p.duration));
    if (p.focus) setFocus(p.focus);
    if (p.cruelty !== undefined) setCruelty(p.cruelty);
    if (p.maxRatio) setMaxRatio(String(p.maxRatio));
  }, []);

  // --- Export ---
  const handleExport = useCallback(async () => {
    if (!workout) return;
    setIsExporting(true);
    try {
      const xml = generateIctxXml(workout);
      const safeName = workout.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await downloadIctxFile(xml, `${safeName}.ictx`);
    } finally {
      setIsExporting(false);
    }
  }, [workout]);

  // --- Save to library ---
  const handleSave = useCallback(async () => {
    if (!workout) return;
    const label = saveLabel.trim() || workout.name;
    const session: SavedSession = {
      id: String(Date.now()),
      name: label,
      workout,
      createdAt: Date.now(),
    };
    const updated = [session, ...library];
    setLibrary(updated);
    await saveLibrary(updated);
    setSaveLabel('');
    Alert.alert('Saved', `"${label}" saved to library.`);
  }, [workout, library, saveLabel]);

  // --- Load from library ---
  const handleLoadSession = useCallback(
    (session: SavedSession) => {
      const p = session.workout.params;
      setFtp(String(p.ftp));
      setDuration(String(p.duration));
      setFocus(p.focus);
      setCruelty(p.cruelty);
      setSeed(String(p.seed));
      setMaxRatio(String(p.maxRatio));
      setWorkout(session.workout);
      setShowLibrary(false);
    },
    [],
  );

  // --- Delete from library ---
  const handleDeleteSession = useCallback(
    async (id: string) => {
      const updated = library.filter((s) => s.id !== id);
      setLibrary(updated);
      await saveLibrary(updated);
    },
    [library],
  );

  // --- Stats ---
  const stats = useMemo(() => {
    if (!workout) return null;
    const total = workout.legs.reduce((s, l) => s + l.duration_seconds, 0);
    const avgRatio = Math.round(
      workout.legs.reduce((s, l) => s + l.levelRatio * l.duration_seconds, 0) / total,
    );
    const peakRatio = Math.max(...workout.legs.map((l) => l.levelRatio));
    const workLegs = workout.legs.filter((l) => l.type === 'spin' || l.type === 'torque');
    return { total, avgRatio, peakRatio, segments: workout.legs.length, intervals: workLegs.length };
  }, [workout]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <FlameKindling size={18} color={Colors.accent} />
            <Text style={styles.headerTitle}>ICTX Punisher</Text>
          </View>
          <TouchableOpacity
            style={styles.libraryBtn}
            onPress={() => setShowLibrary(!showLibrary)}
            activeOpacity={0.7}
          >
            <BookOpen size={20} color={showLibrary ? Colors.accent : Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Generate brutal{'\n'}ICTX workouts</Text>
            <Text style={styles.heroSubtitle}>
              Aggressive spin/torque intervals exported as .ictx for ICTraining
            </Text>
          </View>

          {/* Presets */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Bkool Baselines</Text>
            <View style={styles.presetsRow}>
              {PUNISHER_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={styles.presetBtn}
                  onPress={() => handlePreset(preset)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetLabel}>{preset.label}</Text>
                  <Text style={styles.presetDesc}>{preset.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Parameters</Text>

            {/* FTP */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>FTP (Watts)</Text>
              <TextInput
                style={styles.textInput}
                value={ftp}
                onChangeText={setFtp}
                placeholder="e.g. 250"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                returnKeyType="done"
                testID="punisher-ftp-input"
              />
              {ftp.length > 0 && !isFormValid && (
                <Text style={styles.errorHint}>Enter a value between 50–500</Text>
              )}
            </View>

            <PickerField
              label="Duration (minutes)"
              value={duration}
              options={DURATION_OPTIONS}
              onSelect={setDuration}
              testID="punisher-duration-picker"
            />

            <PickerField
              label="Focus"
              value={focus}
              options={FOCUS_OPTIONS}
              onSelect={(v) => setFocus(v as PunisherFocus)}
              testID="punisher-focus-picker"
            />

            {/* Cruelty */}
            <View style={styles.field}>
              <View style={styles.crueltyRow}>
                <Text style={styles.fieldLabel}>Cruelty</Text>
                <View style={styles.crueltySeverityBadge}>
                  <Text style={styles.crueltySeverityText}>
                    {cruelty <= 3 ? 'Moderate' : cruelty <= 6 ? 'Hard' : cruelty <= 8 ? 'Brutal' : 'INSANE'}
                  </Text>
                </View>
              </View>
              <CrueltySlider value={cruelty} onChange={setCruelty} />
            </View>

            {/* Seed + Randomize */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Seed</Text>
              <View style={styles.seedRow}>
                <TextInput
                  style={[styles.textInput, styles.seedInput]}
                  value={seed}
                  onChangeText={setSeed}
                  placeholder="e.g. 42"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  testID="punisher-seed-input"
                />
                <TouchableOpacity
                  style={styles.randomizeBtn}
                  onPress={handleRandomize}
                  activeOpacity={0.7}
                  testID="punisher-randomize-btn"
                >
                  <RefreshCw size={16} color={Colors.accent} />
                  <Text style={styles.randomizeBtnText}>Randomize</Text>
                </TouchableOpacity>
              </View>
            </View>

            <PickerField
              label="ICTX Max Ratio Clamp"
              value={maxRatio}
              options={MAX_RATIO_OPTIONS}
              onSelect={setMaxRatio}
              testID="punisher-maxratio-picker"
            />
          </View>

          {/* Generate button */}
          <TouchableOpacity
            style={[styles.generateButton, !isFormValid && styles.generateButtonDisabled]}
            onPress={handleGenerate}
            activeOpacity={0.8}
            disabled={!isFormValid}
            testID="punisher-generate-btn"
          >
            <Zap size={20} color="#FFF" fill="#FFF" />
            <Text style={styles.generateButtonText}>Generate Punisher Workout</Text>
          </TouchableOpacity>

          {/* Preview */}
          {workout && stats && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Workout Preview</Text>
              <Text style={styles.workoutName}>{workout.name}</Text>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{fmtSecs(stats.total)}</Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{stats.segments}</Text>
                  <Text style={styles.statLabel}>Segments</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{stats.avgRatio}%</Text>
                  <Text style={styles.statLabel}>Avg Ratio</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: Colors.zone5 }]}>{stats.peakRatio}%</Text>
                  <Text style={styles.statLabel}>Peak Ratio</Text>
                </View>
              </View>

              {/* Timeline bar */}
              <Text style={styles.chartLabel}>Segment timeline</Text>
              <TimelineBar workout={workout} />

              {/* Legend */}
              <View style={styles.legendRow}>
                {(['warmup', 'spin', 'torque', 'recovery', 'cooldown'] as const).map((t) => (
                  <View key={t} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: getLegTypeColor(t) }]} />
                    <Text style={styles.legendText}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                  </View>
                ))}
              </View>

              {/* Power chart */}
              <Text style={styles.chartLabel}>Power ratio chart</Text>
              <PowerChart workout={workout} />

              {/* Table */}
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colType]}>Type</Text>
                <Text style={[styles.th, styles.colDuration]}>Dur</Text>
                <Text style={[styles.th, styles.colRatio]}>Ratio%</Text>
                <Text style={[styles.th, styles.colRpm]}>RPM</Text>
              </View>
              <ScrollView style={styles.tableBody} nestedScrollEnabled>
                {workout.legs.map((leg, i) => {
                  const tc = getLegTypeColor(leg.type);
                  return (
                    <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                      <View style={[styles.colType, styles.typeCell]}>
                        <View style={[styles.typeDot, { backgroundColor: tc }]} />
                        <Text style={styles.cellText}>{leg.type}</Text>
                      </View>
                      <Text style={[styles.cellText, styles.colDuration]}>
                        {fmtSecs(leg.duration_seconds)}
                      </Text>
                      <Text style={[styles.cellText, styles.colRatio, { color: getRatioColor(leg.levelRatio) }]}>
                        {leg.levelRatio}%
                      </Text>
                      <Text style={[styles.cellText, styles.colRpm]}>{leg.rpm}</Text>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Export */}
              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleExport}
                activeOpacity={0.8}
                disabled={isExporting}
                testID="punisher-export-btn"
              >
                {isExporting ? (
                  <ActivityIndicator color={Colors.accent} size="small" />
                ) : (
                  <Download size={18} color={Colors.accent} />
                )}
                <Text style={styles.exportButtonText}>Export .ICTX</Text>
              </TouchableOpacity>

              {/* Save to library */}
              <View style={styles.saveRow}>
                <TextInput
                  style={[styles.textInput, styles.saveInput]}
                  value={saveLabel}
                  onChangeText={setSaveLabel}
                  placeholder="Session label (optional)"
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="done"
                  testID="punisher-save-label-input"
                />
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  activeOpacity={0.7}
                  testID="punisher-save-btn"
                >
                  <Save size={16} color="#FFF" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Library */}
          {showLibrary && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Saved Sessions ({library.length})</Text>
              {library.length === 0 ? (
                <Text style={styles.emptyText}>No saved sessions yet.</Text>
              ) : (
                library.map((session) => (
                  <View key={session.id} style={styles.libraryItem}>
                    <TouchableOpacity
                      style={styles.libraryItemMain}
                      onPress={() => handleLoadSession(session)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.libraryItemName}>{session.name}</Text>
                      <Text style={styles.libraryItemMeta}>
                        {session.workout.params.duration}' · Cruelty {session.workout.params.cruelty} · {session.workout.params.focus}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.libraryDeleteBtn}
                      onPress={() => handleDeleteSession(session.id)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  libraryBtn: {
    padding: 4,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },

  // Hero
  heroSection: {
    paddingVertical: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    lineHeight: 34,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.9,
  },

  // Presets
  presetsRow: {
    gap: 8,
  },
  presetBtn: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
    marginBottom: 2,
  },
  presetDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Form fields
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorHint: {
    fontSize: 11,
    color: Colors.error,
    marginTop: 2,
  },

  // Cruelty
  crueltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  crueltySeverityBadge: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  crueltySeverityText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },

  // Seed row
  seedRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  seedInput: {
    flex: 1,
  },
  randomizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  randomizeBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },

  // Generate button
  generateButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  generateButtonDisabled: {
    opacity: 0.4,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // Preview
  workoutName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    padding: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },

  // Charts
  chartLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: 2,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  th: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  tableBody: {
    maxHeight: 220,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cellText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  typeCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  colType: { flex: 2 },
  colDuration: { flex: 1.2 },
  colRatio: { flex: 1, textAlign: 'right' as const },
  colRpm: { flex: 0.8, textAlign: 'right' as const },

  // Export
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.accent,
    letterSpacing: 0.3,
  },

  // Save row
  saveRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  saveInput: {
    flex: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFF',
  },

  // Library
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    paddingVertical: 8,
  },
  libraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  libraryItemMain: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  libraryItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  libraryItemMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  libraryDeleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
