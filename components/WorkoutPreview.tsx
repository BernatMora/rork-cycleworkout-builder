import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { WorkoutInterval } from '@/types/workout';
import { formatDuration, getZoneColor, getZoneName } from '@/utils/zwo';
import Colors from '@/constants/colors';

interface WorkoutPreviewProps {
  intervals: WorkoutInterval[];
  tss: number;
  ftp: number;
}

export default function WorkoutPreview({ intervals, tss, ftp }: WorkoutPreviewProps) {
  const totalDuration = useMemo(
    () => intervals.reduce((sum, i) => sum + i.duration_seconds, 0),
    [intervals]
  );

  const maxPower = useMemo(
    () => Math.max(...intervals.map((i) => i.power_percent_ftp)),
    [intervals]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workout Preview</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{tss}</Text>
            <Text style={styles.statLabel}>Est. TSS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{intervals.length}</Text>
            <Text style={styles.statLabel}>Segments</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartContainer}>
        <View style={styles.chart}>
          {intervals.map((interval, index) => {
            const widthPercent = (interval.duration_seconds / totalDuration) * 100;
            const heightPercent = Math.max((interval.power_percent_ftp / (maxPower + 20)) * 100, 8);
            const color = getZoneColor(interval.power_percent_ftp);

            return (
              <View
                key={`bar-${index}`}
                style={[
                  styles.bar,
                  {
                    width: `${widthPercent}%` as unknown as number,
                    height: `${heightPercent}%` as unknown as number,
                    backgroundColor: color,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.chartBaseline} />
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.colType]}>Type</Text>
        <Text style={[styles.tableHeaderText, styles.colDuration]}>Duration</Text>
        <Text style={[styles.tableHeaderText, styles.colPower]}>%FTP</Text>
        <Text style={[styles.tableHeaderText, styles.colWatts]}>Watts</Text>
        <Text style={[styles.tableHeaderText, styles.colZone]}>Zone</Text>
      </View>

      <ScrollView style={styles.tableBody} nestedScrollEnabled>
        {intervals.map((interval, index) => {
          const color = getZoneColor(interval.power_percent_ftp);
          const watts = Math.round((interval.power_percent_ftp / 100) * ftp);
          const zone = getZoneName(interval.power_percent_ftp);
          const typeLabel = interval.type.charAt(0).toUpperCase() + interval.type.slice(1);

          return (
            <View key={`row-${index}`} style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
              <View style={[styles.colType, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.cellText}>{typeLabel}</Text>
              </View>
              <Text style={[styles.cellText, styles.colDuration]}>
                {formatDuration(interval.duration_seconds)}
              </Text>
              <Text style={[styles.cellText, styles.colPower, { color }]}>
                {interval.power_percent_ftp}%
              </Text>
              <Text style={[styles.cellText, styles.colWatts]}>{watts}w</Text>
              <Text style={[styles.cellText, styles.colZone, { color }]}>{zone}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    padding: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    letterSpacing: 0.3,
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
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  statLabel: {
    fontSize: 11,
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
  chartContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    height: 120,
  },
  chart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  bar: {
    borderRadius: 2,
    minWidth: 3,
  },
  chartBaseline: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  tableBody: {
    maxHeight: 240,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  colType: {
    flex: 2.5,
  },
  colDuration: {
    flex: 1.5,
  },
  colPower: {
    flex: 1.2,
    textAlign: 'right' as const,
  },
  colWatts: {
    flex: 1.2,
    textAlign: 'right' as const,
  },
  colZone: {
    flex: 1,
    textAlign: 'right' as const,
  },
});
