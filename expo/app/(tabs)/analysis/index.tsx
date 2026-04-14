import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, TrendingUp, Activity, Layers } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlanContext } from '@/contexts/PlanContext';

function getZoneColor(zone: string): string {
  const map: Record<string, string> = {
    Z1: Colors.zone1,
    Z2: Colors.zone2,
    Z3: Colors.zone3,
    Z4: Colors.zone4,
    Z5: Colors.zone5,
    Z6: Colors.zone6,
  };
  return map[zone] ?? Colors.textMuted;
}

function AnimatedBarFill({
  percent,
  color,
  delay,
}: {
  percent: number;
  color: string;
  delay: number;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percent,
      duration: 600,
      delay,
      useNativeDriver: false,
    }).start();
  }, [widthAnim, percent, delay]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%' as unknown as number, '100%' as unknown as number],
  });

  return (
    <Animated.View
      style={[
        styles.barFill,
        {
          width: animatedWidth,
          backgroundColor: color,
        },
      ]}
    />
  );
}

function FadeInView({ delay, children }: { delay: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
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

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { plan } = usePlanContext();

  const analytics = useMemo(() => {
    const totalTss = plan.reduce((s, w) => s + w.tss, 0);
    const totalSec = plan.reduce(
      (s, w) => s + w.intervals.reduce((inner, i) => inner + i.duration_seconds, 0),
      0
    );
    const zones = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, Z6: 0 };
    for (const w of plan) {
      for (const i of w.intervals) {
        const m = i.duration_seconds / 60;
        if (i.power_percent_ftp < 56) zones.Z1 += m;
        else if (i.power_percent_ftp < 76) zones.Z2 += m;
        else if (i.power_percent_ftp < 91) zones.Z3 += m;
        else if (i.power_percent_ftp < 106) zones.Z4 += m;
        else if (i.power_percent_ftp < 121) zones.Z5 += m;
        else zones.Z6 += m;
      }
    }
    return { totalTss, totalMinutes: Math.round(totalSec / 60), totalSessions: plan.length, zones };
  }, [plan]);

  const weeklyTss = useMemo(() => {
    const map = new Map<number, number>();
    for (const w of plan) {
      map.set(w.week, (map.get(w.week) ?? 0) + w.tss);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [plan]);

  const maxWeeklyTss = useMemo(() => Math.max(1, ...weeklyTss.map(([, tss]) => tss)), [weeklyTss]);

  const zoneEntries = useMemo(() => {
    const total = Object.values(analytics.zones).reduce((s, v) => s + v, 0);
    return Object.entries(analytics.zones).map(([zone, minutes]) => ({
      zone,
      minutes: Math.round(minutes),
      percent: total > 0 ? Math.round((minutes / total) * 100) : 0,
    }));
  }, [analytics.zones]);

  const maxZoneMinutes = useMemo(() => Math.max(1, ...zoneEntries.map((e) => e.minutes)), [zoneEntries]);

  if (plan.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top + 60 }]}>
        <View style={styles.emptyIconWrap}>
          <BarChart3 size={32} color={Colors.accent} />
        </View>
        <Text style={styles.emptyTitle}>No Data Yet</Text>
        <Text style={styles.emptySubtitle}>Generate a training plan to see analytics.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Plan Analytics</Text>

        <FadeInView delay={0}>
          <View style={styles.statsGrid}>
            <View style={[styles.bigStatCard, styles.bigStatCardHighlight]}>
              <View style={styles.statIconRow}>
                <TrendingUp size={16} color={Colors.accent} />
              </View>
              <Text style={styles.bigStatValue}>{analytics.totalTss}</Text>
              <Text style={styles.bigStatLabel}>Total TSS</Text>
            </View>
            <View style={styles.bigStatCard}>
              <View style={styles.statIconRow}>
                <Activity size={16} color={Colors.zone2} />
              </View>
              <Text style={[styles.bigStatValue, { color: Colors.zone2 }]}>{analytics.totalMinutes}</Text>
              <Text style={styles.bigStatLabel}>Total Minutes</Text>
            </View>
            <View style={styles.bigStatCard}>
              <View style={styles.statIconRow}>
                <Layers size={16} color={Colors.zone1} />
              </View>
              <Text style={[styles.bigStatValue, { color: Colors.zone1 }]}>{analytics.totalSessions}</Text>
              <Text style={styles.bigStatLabel}>Sessions</Text>
            </View>
            <View style={styles.bigStatCard}>
              <View style={styles.statIconRow}>
                <BarChart3 size={16} color={Colors.zone3} />
              </View>
              <Text style={[styles.bigStatValue, { color: Colors.zone3 }]}>
                {analytics.totalSessions > 0 ? Math.round(analytics.totalTss / analytics.totalSessions) : 0}
              </Text>
              <Text style={styles.bigStatLabel}>Avg TSS/Session</Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={100}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weekly TSS Distribution</Text>
            {weeklyTss.map(([week, tss], idx) => (
              <View key={`wt-${week}`} style={styles.barRow}>
                <Text style={styles.barLabel}>W{week}</Text>
                <View style={styles.barTrack}>
                  <AnimatedBarFill
                    percent={Math.max(2, (tss / maxWeeklyTss) * 100)}
                    color={Colors.accent}
                    delay={idx * 80}
                  />
                </View>
                <Text style={styles.barValue}>{tss}</Text>
              </View>
            ))}
          </View>
        </FadeInView>

        <FadeInView delay={200}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Power Zone Distribution</Text>
            {zoneEntries.map((entry, idx) => (
              <View key={entry.zone} style={styles.barRow}>
                <View style={styles.zoneLabelWrap}>
                  <View style={[styles.zoneDot, { backgroundColor: getZoneColor(entry.zone) }]} />
                  <Text style={[styles.barLabel, { color: getZoneColor(entry.zone), width: 'auto' as unknown as number }]}>{entry.zone}</Text>
                </View>
                <View style={styles.barTrack}>
                  <AnimatedBarFill
                    percent={Math.max(2, (entry.minutes / maxZoneMinutes) * 100)}
                    color={getZoneColor(entry.zone)}
                    delay={idx * 80 + 100}
                  />
                </View>
                <Text style={styles.barValue}>{entry.minutes}m</Text>
                <Text style={styles.barPercent}>{entry.percent}%</Text>
              </View>
            ))}
          </View>
        </FadeInView>

        <FadeInView delay={300}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Phase Breakdown</Text>
            {(() => {
              const phases = new Map<string, number>();
              for (const w of plan) {
                phases.set(w.phase, (phases.get(w.phase) ?? 0) + 1);
              }
              const totalPhases = plan.length;
              return Array.from(phases.entries()).map(([phase, count]) => {
                const phaseColor = phase === 'Base' ? '#0EA5A4' : phase === 'Build' ? '#F59E0B' : phase === 'Peak' ? '#F97316' : '#60A5FA';
                const pct = totalPhases > 0 ? Math.round((count / totalPhases) * 100) : 0;
                return (
                  <View key={phase} style={styles.phaseRow}>
                    <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
                    <Text style={styles.phaseLabel}>{phase}</Text>
                    <View style={styles.phaseBarTrack}>
                      <View style={[styles.phaseBarFill, { width: `${pct}%` as unknown as number, backgroundColor: phaseColor }]} />
                    </View>
                    <Text style={styles.phaseCount}>{count}</Text>
                    <Text style={styles.phasePercent}>{pct}%</Text>
                  </View>
                );
              });
            })()}
          </View>
        </FadeInView>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  bigStatCard: {
    width: '47%' as unknown as number,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bigStatCardHighlight: {
    borderColor: 'rgba(249, 115, 22, 0.25)',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconRow: {
    marginBottom: 8,
  },
  bigStatValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  bigStatLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    marginTop: 2,
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
    marginBottom: 16,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  zoneLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: 38,
  },
  zoneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  barLabel: {
    width: 28,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accentLight,
  },
  barTrack: {
    flex: 1,
    height: 18,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 9,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%' as unknown as number,
    borderRadius: 9,
  },
  barValue: {
    width: 40,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'right' as const,
  },
  barPercent: {
    width: 32,
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textAlign: 'right' as const,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  phaseLabel: {
    width: 60,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  phaseBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  phaseBarFill: {
    height: '100%' as unknown as number,
    borderRadius: 4,
  },
  phaseCount: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
    width: 24,
    textAlign: 'right' as const,
  },
  phasePercent: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    width: 30,
    textAlign: 'right' as const,
  },
});
