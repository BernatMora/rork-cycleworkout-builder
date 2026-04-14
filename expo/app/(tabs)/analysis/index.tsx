import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3 } from 'lucide-react-native';
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
        <BarChart3 size={48} color={Colors.textMuted} />
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

        <View style={styles.statsGrid}>
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatValue}>{analytics.totalTss}</Text>
            <Text style={styles.bigStatLabel}>Total TSS</Text>
          </View>
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatValue}>{analytics.totalMinutes}</Text>
            <Text style={styles.bigStatLabel}>Total Minutes</Text>
          </View>
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatValue}>{analytics.totalSessions}</Text>
            <Text style={styles.bigStatLabel}>Sessions</Text>
          </View>
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatValue}>
              {analytics.totalSessions > 0 ? Math.round(analytics.totalTss / analytics.totalSessions) : 0}
            </Text>
            <Text style={styles.bigStatLabel}>Avg TSS/Session</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly TSS Distribution</Text>
          {weeklyTss.map(([week, tss]) => (
            <View key={`wt-${week}`} style={styles.barRow}>
              <Text style={styles.barLabel}>W{week}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.max(2, (tss / maxWeeklyTss) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{tss}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Power Zone Distribution</Text>
          {zoneEntries.map((entry) => (
            <View key={entry.zone} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: getZoneColor(entry.zone) }]}>{entry.zone}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.max(2, (entry.minutes / maxZoneMinutes) * 100)}%`,
                      backgroundColor: getZoneColor(entry.zone),
                    },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{entry.minutes}m</Text>
              <Text style={styles.barPercent}>{entry.percent}%</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phase Breakdown</Text>
          {(() => {
            const phases = new Map<string, number>();
            for (const w of plan) {
              phases.set(w.phase, (phases.get(w.phase) ?? 0) + 1);
            }
            return Array.from(phases.entries()).map(([phase, count]) => (
              <View key={phase} style={styles.phaseRow}>
                <View style={[styles.phaseDot, { backgroundColor: phase === 'Base' ? '#0EA5A4' : phase === 'Build' ? '#F59E0B' : phase === 'Peak' ? '#F97316' : '#60A5FA' }]} />
                <Text style={styles.phaseLabel}>{phase}</Text>
                <Text style={styles.phaseCount}>{count} session{count !== 1 ? 's' : ''}</Text>
              </View>
            ));
          })()}
        </View>
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
    gap: 12,
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
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bigStatValue: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.accent,
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
    borderRadius: 14,
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
    letterSpacing: 0.5,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  barLabel: {
    width: 28,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accentLight,
  },
  barTrack: {
    flex: 1,
    height: 14,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%' as unknown as number,
    backgroundColor: Colors.accent,
    borderRadius: 7,
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
    marginBottom: 10,
  },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  phaseLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  phaseCount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
