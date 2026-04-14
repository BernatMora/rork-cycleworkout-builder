import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Target, Clock, Flame } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanContext, PlanWorkout } from '@/contexts/PlanContext';
import { useTranslation } from '@/hooks/useTranslation';
import { WEEKDAY_OPTIONS } from '@/constants/workout-options';

function getPhaseColor(phase: string): string {
  if (phase === 'Base') return '#0EA5A4';
  if (phase === 'Build') return '#F59E0B';
  if (phase === 'Peak') return '#F97316';
  return '#60A5FA';
}

function getReadinessColor(score: number): string {
  if (score >= 70) return Colors.success;
  if (score >= 45) return Colors.warning;
  return Colors.error;
}

function FadeInView({ delay, children }: { delay: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, delay]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { plan, selectedWorkout, setSelectedPlanWorkoutId } = usePlanContext();

  const planByWeek = useMemo(() => {
    const grouped = new Map<number, PlanWorkout[]>();
    for (const w of plan) {
      const arr = grouped.get(w.week) ?? [];
      arr.push(w);
      grouped.set(w.week, arr);
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
    for (const w of plan) {
      const day = w.dayLabel ?? 'Mon';
      const arr = grouped.get(day) ?? [];
      arr.push(w);
      grouped.set(day, arr);
    }
    return WEEKDAY_OPTIONS.map((day) => ({ day, sessions: grouped.get(day) ?? [] }));
  }, [plan]);

  const analytics = useMemo(() => {
    const totalTss = plan.reduce((s, w) => s + w.tss, 0);
    const totalSec = plan.reduce(
      (s, w) => s + w.intervals.reduce((inner, i) => inner + i.duration_seconds, 0),
      0
    );
    const zones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
    for (const w of plan) {
      for (const i of w.intervals) {
        const m = i.duration_seconds / 60;
        if (i.power_percent_ftp < 56) zones.z1 += m;
        else if (i.power_percent_ftp < 76) zones.z2 += m;
        else if (i.power_percent_ftp < 91) zones.z3 += m;
        else if (i.power_percent_ftp < 106) zones.z4 += m;
        else if (i.power_percent_ftp < 121) zones.z5 += m;
        else zones.z6 += m;
      }
    }
    return { totalTss, totalMinutes: Math.round(totalSec / 60), totalSessions: plan.length, zones };
  }, [plan]);

  const handleSelectWorkout = useCallback(
    (id: string) => {
      Haptics.selectionAsync();
      setSelectedPlanWorkoutId(id);
    },
    [setSelectedPlanWorkoutId]
  );

  if (plan.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top + 60 }]}>
        <View style={styles.emptyIconWrap}>
          <CalendarDays size={32} color={Colors.accent} />
        </View>
        <Text style={styles.emptyTitle}>No Plan Yet</Text>
        <Text style={styles.emptySubtitle}>Generate a training plan in the Builder tab first.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>{t('weeklyCalendar')}</Text>

        <FadeInView delay={0}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardAccent]}>
              <Flame size={14} color={Colors.accent} />
              <Text style={styles.statValue}>{analytics.totalTss}</Text>
              <Text style={styles.statLabel}>TSS</Text>
            </View>
            <View style={styles.statCard}>
              <Clock size={14} color={Colors.zone1} />
              <Text style={[styles.statValue, { color: Colors.zone1 }]}>{analytics.totalMinutes}m</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statCard}>
              <Target size={14} color={Colors.zone2} />
              <Text style={[styles.statValue, { color: Colors.zone2 }]}>{analytics.totalSessions}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={80}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('weeklyCalendar')}</Text>
            {planByWeek.map(({ week, sessions }, weekIdx) => (
              <View key={`w-${week}`} style={[styles.weekRow, weekIdx === planByWeek.length - 1 && styles.weekRowLast]}>
                <View style={styles.weekLabelWrap}>
                  <Text style={styles.weekLabel}>W{week}</Text>
                </View>
                <View style={styles.sessionsRow}>
                  {sessions.map((s) => {
                    const isActive = selectedWorkout?.id === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.sessionChip, isActive && styles.sessionChipActive]}
                        onPress={() => handleSelectWorkout(s.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.phaseDot, { backgroundColor: getPhaseColor(s.phase) }]} />
                        <Text style={[styles.sessionChipText, isActive && styles.sessionChipTextActive]}>
                          S{s.sessionInWeek}
                        </Text>
                        <Text style={[styles.sessionTssText, isActive && { color: Colors.accentLight }]}>{s.tss}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </FadeInView>

        <FadeInView delay={160}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('realDaysCalendar')}</Text>
            {planByDay.map(({ day, sessions }) => (
              <View key={`d-${day}`} style={styles.dayRow}>
                <View style={styles.dayLabelWrap}>
                  <Text style={[styles.dayLabel, sessions.length > 0 && styles.dayLabelActive]}>{day}</Text>
                </View>
                <View style={styles.sessionsRow}>
                  {sessions.length === 0 ? (
                    <View style={styles.emptyDaySlot}>
                      <Text style={styles.emptyDayText}>Rest</Text>
                    </View>
                  ) : (
                    sessions.map((s) => {
                      const isActive = selectedWorkout?.id === s.id;
                      return (
                        <TouchableOpacity
                          key={`dc-${s.id}`}
                          style={[styles.sessionChip, isActive && styles.sessionChipActive]}
                          onPress={() => handleSelectWorkout(s.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.phaseDot, { backgroundColor: getPhaseColor(s.phase) }]} />
                          <Text style={[styles.sessionChipText, isActive && styles.sessionChipTextActive]}>
                            W{s.week}S{s.sessionInWeek}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            ))}
          </View>
        </FadeInView>

        {selectedWorkout && (
          <FadeInView delay={0}>
            <View style={styles.selectedCard}>
              <View style={styles.selectedHeader}>
                <View style={[styles.phaseBadge, { backgroundColor: getPhaseColor(selectedWorkout.phase) }]}>
                  <Text style={styles.phaseBadgeText}>{selectedWorkout.phase}</Text>
                </View>
                <Text style={styles.selectedTss}>TSS {selectedWorkout.tss}</Text>
                {selectedWorkout.gameRideInfo && (
                  <Text style={[styles.selectedTss, { color: getReadinessColor(selectedWorkout.gameRideInfo.readinessScore) }]}>
                    R {selectedWorkout.gameRideInfo.readinessScore}
                  </Text>
                )}
              </View>
              <Text style={styles.selectedTitle}>{selectedWorkout.name}</Text>
              <Text style={styles.selectedSummary}>{selectedWorkout.summary}</Text>
            </View>
          </FadeInView>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  statCardAccent: {
    borderColor: 'rgba(249, 115, 22, 0.2)',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.accent,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginBottom: 14,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.shimmer,
  },
  weekRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  weekLabelWrap: {
    width: 36,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accentLight,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  dayLabelWrap: {
    width: 36,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  dayLabelActive: {
    color: Colors.accentLight,
    fontWeight: '700' as const,
  },
  sessionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  sessionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sessionChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  sessionChipTextActive: {
    color: Colors.accentLight,
  },
  sessionTssText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  phaseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  emptyDaySlot: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emptyDayText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  selectedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  selectedSummary: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  phaseBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  phaseBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  selectedTss: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
});
