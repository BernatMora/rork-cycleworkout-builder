import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanContext } from '@/contexts/PlanContext';
import { WorkoutInterval, IntervalType } from '@/types/workout';
import { formatDuration, getZoneColor } from '@/utils/zwo';

const INTERVAL_TYPES: IntervalType[] = ['warmup', 'interval', 'recovery', 'cooldown'];

interface EditableInterval extends WorkoutInterval {
  _key: string;
}

function generateKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function EditWorkoutScreen() {
  const { id, ftp: ftpParam } = useLocalSearchParams<{ id: string; ftp: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plan, updateWorkoutIntervals } = usePlanContext();

  const workout = useMemo(() => plan.find((w) => w.id === id), [plan, id]);
  const ftpValue = useMemo(() => parseInt(ftpParam ?? '200', 10) || 200, [ftpParam]);

  const [intervals, setIntervals] = useState<EditableInterval[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (workout) {
      setIntervals(
        workout.intervals.map((iv) => ({
          ...iv,
          _key: generateKey(),
        }))
      );
    }
  }, [workout]);

  const totalDuration = useMemo(
    () => intervals.reduce((s, i) => s + i.duration_seconds, 0),
    [intervals]
  );

  const maxPower = useMemo(
    () => Math.max(1, ...intervals.map((i) => i.power_percent_ftp)),
    [intervals]
  );

  const handleUpdateInterval = useCallback(
    (index: number, field: keyof WorkoutInterval, value: string) => {
      setIntervals((prev) => {
        const copy = [...prev];
        const item = { ...copy[index] };

        if (field === 'type') {
          item.type = value as IntervalType;
        } else if (field === 'duration_seconds') {
          const num = parseInt(value, 10);
          item.duration_seconds = isNaN(num) ? 0 : Math.max(0, num);
        } else if (field === 'power_percent_ftp') {
          const num = parseInt(value, 10);
          item.power_percent_ftp = isNaN(num) ? 0 : Math.max(0, Math.min(200, num));
        } else if (field === 'cadence_rpm_target') {
          const num = parseInt(value, 10);
          item.cadence_rpm_target = isNaN(num) || num <= 0 ? undefined : num;
        }

        copy[index] = item;
        return copy;
      });
      setHasChanges(true);
    },
    []
  );

  const handleAddInterval = useCallback(
    (atIndex: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIntervals((prev) => {
        const copy = [...prev];
        const newInterval: EditableInterval = {
          type: 'interval',
          duration_seconds: 120,
          power_percent_ftp: 85,
          _key: generateKey(),
        };
        copy.splice(atIndex + 1, 0, newInterval);
        return copy;
      });
      setHasChanges(true);
    },
    []
  );

  const handleRemoveInterval = useCallback(
    (index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIntervals((prev) => {
        if (prev.length <= 1) return prev;
        const copy = [...prev];
        copy.splice(index, 1);
        return copy;
      });
      setExpandedIndex(null);
      setHasChanges(true);
    },
    []
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      Haptics.selectionAsync();
      setIntervals((prev) => {
        const copy = [...prev];
        [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
        return copy;
      });
      setExpandedIndex(index - 1);
      setHasChanges(true);
    },
    []
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      setIntervals((prev) => {
        if (index >= prev.length - 1) return prev;
        Haptics.selectionAsync();
        const copy = [...prev];
        [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
        return copy;
      });
      setExpandedIndex(index + 1);
      setHasChanges(true);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!workout || !id) return;

    const hasInvalidDuration = intervals.some((i) => i.duration_seconds <= 0);
    if (hasInvalidDuration) {
      Alert.alert('Invalid Duration', 'All intervals must have a duration greater than 0.');
      return;
    }

    const cleanIntervals: WorkoutInterval[] = intervals.map(({ _key, ...rest }) => rest);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateWorkoutIntervals(id, cleanIntervals, ftpValue);
    setHasChanges(false);
    router.back();
  }, [workout, id, intervals, ftpValue, updateWorkoutIntervals, router]);

  const handleDiscard = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [hasChanges, router]);

  const toggleExpand = useCallback(
    (index: number) => {
      Haptics.selectionAsync();
      setExpandedIndex((prev) => (prev === index ? null : index));
    },
    []
  );

  if (!workout) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Workout not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: workout.name,
          headerLeft: () => (
            <TouchableOpacity onPress={handleDiscard} style={styles.headerBtn}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.headerBtn, styles.saveHeaderBtn]}
              disabled={!hasChanges}
            >
              <Save size={18} color={hasChanges ? Colors.accent : Colors.textMuted} />
              <Text
                style={[
                  styles.saveHeaderText,
                  { color: hasChanges ? Colors.accent : Colors.textMuted },
                ]}
              >
                Save
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.chartContainer}>
          <View style={styles.chart}>
            {intervals.map((iv, idx) => {
              const widthPct = totalDuration > 0 ? (iv.duration_seconds / totalDuration) * 100 : 0;
              const heightPct = Math.max(8, (iv.power_percent_ftp / (maxPower + 20)) * 100);
              const isExpanded = expandedIndex === idx;
              return (
                <TouchableOpacity
                  key={iv._key}
                  style={[
                    styles.bar,
                    {
                      width: `${Math.max(1, widthPct)}%` as unknown as number,
                      height: `${heightPct}%` as unknown as number,
                      backgroundColor: getZoneColor(iv.power_percent_ftp),
                      opacity: isExpanded ? 1 : 0.75,
                    },
                  ]}
                  onPress={() => toggleExpand(idx)}
                  activeOpacity={0.6}
                />
              );
            })}
          </View>
          <View style={styles.chartInfo}>
            <Text style={styles.chartInfoText}>
              {formatDuration(totalDuration)} total · {intervals.length} segments
            </Text>
            {hasChanges && <Text style={styles.unsavedBadge}>Unsaved changes</Text>}
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        >
          {intervals.map((iv, idx) => {
            const isExpanded = expandedIndex === idx;
            const color = getZoneColor(iv.power_percent_ftp);
            const watts = Math.round((iv.power_percent_ftp / 100) * ftpValue);
            const typeLabel = iv.type.charAt(0).toUpperCase() + iv.type.slice(1);

            return (
              <View key={iv._key}>
                <TouchableOpacity
                  style={[styles.intervalRow, isExpanded && styles.intervalRowExpanded]}
                  onPress={() => toggleExpand(idx)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.intervalDot, { backgroundColor: color }]} />
                  <View style={styles.intervalInfo}>
                    <Text style={styles.intervalType}>{typeLabel}</Text>
                    <Text style={styles.intervalDetails}>
                      {formatDuration(iv.duration_seconds)} · {iv.power_percent_ftp}% FTP · {watts}w
                    </Text>
                  </View>
                  <Text style={styles.intervalIndex}>#{idx + 1}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.editPanel}>
                    <Text style={styles.editSectionLabel}>Type</Text>
                    <View style={styles.typeRow}>
                      {INTERVAL_TYPES.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typeChip, iv.type === t && styles.typeChipActive]}
                          onPress={() => handleUpdateInterval(idx, 'type', t)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.typeChipText,
                              iv.type === t && styles.typeChipTextActive,
                            ]}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.editFieldsRow}>
                      <View style={styles.editField}>
                        <Text style={styles.editFieldLabel}>Duration (sec)</Text>
                        <TextInput
                          style={styles.editFieldInput}
                          value={String(iv.duration_seconds)}
                          onChangeText={(v) => handleUpdateInterval(idx, 'duration_seconds', v)}
                          keyboardType="number-pad"
                          selectTextOnFocus
                        />
                      </View>
                      <View style={styles.editField}>
                        <Text style={styles.editFieldLabel}>Power (%FTP)</Text>
                        <TextInput
                          style={styles.editFieldInput}
                          value={String(iv.power_percent_ftp)}
                          onChangeText={(v) => handleUpdateInterval(idx, 'power_percent_ftp', v)}
                          keyboardType="number-pad"
                          selectTextOnFocus
                        />
                      </View>
                      <View style={styles.editField}>
                        <Text style={styles.editFieldLabel}>Cadence</Text>
                        <TextInput
                          style={styles.editFieldInput}
                          value={iv.cadence_rpm_target ? String(iv.cadence_rpm_target) : ''}
                          onChangeText={(v) => handleUpdateInterval(idx, 'cadence_rpm_target', v)}
                          keyboardType="number-pad"
                          placeholder="—"
                          placeholderTextColor={Colors.textMuted}
                          selectTextOnFocus
                        />
                      </View>
                    </View>

                    <View style={styles.editActionsRow}>
                      <TouchableOpacity
                        style={styles.editActionBtn}
                        onPress={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        activeOpacity={0.6}
                      >
                        <ChevronUp size={16} color={idx === 0 ? Colors.textMuted : Colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editActionBtn}
                        onPress={() => handleMoveDown(idx)}
                        disabled={idx === intervals.length - 1}
                        activeOpacity={0.6}
                      >
                        <ChevronDown
                          size={16}
                          color={idx === intervals.length - 1 ? Colors.textMuted : Colors.text}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editActionBtn, styles.addBtn]}
                        onPress={() => handleAddInterval(idx)}
                        activeOpacity={0.6}
                      >
                        <Plus size={16} color={Colors.accent} />
                        <Text style={styles.addBtnText}>Add after</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editActionBtn, styles.deleteBtn]}
                        onPress={() => handleRemoveInterval(idx)}
                        disabled={intervals.length <= 1}
                        activeOpacity={0.6}
                      >
                        <Trash2
                          size={16}
                          color={intervals.length <= 1 ? Colors.textMuted : Colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.addIntervalButton}
            onPress={() => handleAddInterval(intervals.length - 1)}
            activeOpacity={0.7}
          >
            <Plus size={18} color={Colors.accent} />
            <Text style={styles.addIntervalText}>Add Interval</Text>
          </TouchableOpacity>
        </ScrollView>

        {hasChanges && (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
              <Save size={18} color="#FFF" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  backButtonText: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  headerBtn: {
    padding: 6,
  },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveHeaderText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  chartContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chart: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  bar: {
    borderRadius: 2,
    minWidth: 2,
  },
  chartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  chartInfoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  unsavedBadge: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '700' as const,
  },
  scrollArea: {
    flex: 1,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  intervalRowExpanded: {
    backgroundColor: 'rgba(249,115,22,0.05)',
    borderBottomColor: 'transparent',
  },
  intervalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  intervalInfo: {
    flex: 1,
  },
  intervalType: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  intervalDetails: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  intervalIndex: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600' as const,
  },
  editPanel: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  editSectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  typeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  typeChipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249,115,22,0.15)',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: Colors.accentLight,
  },
  editFieldsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  editField: {
    flex: 1,
  },
  editFieldLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  editFieldInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editActionBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249,115,22,0.08)',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  deleteBtn: {
    marginLeft: 'auto' as unknown as number,
    borderColor: Colors.error,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  addIntervalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed' as const,
    backgroundColor: 'rgba(249,115,22,0.05)',
  },
  addIntervalText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  bottomBar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
