import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { WorkoutInterval } from '@/types/workout';
import { formatDuration, getZoneColor, getZoneName, getHrRangeFromPower, getRpeFromPower } from '@/utils/zwo';
import Colors from '@/constants/colors';

interface WorkoutPreviewProps {
  intervals: WorkoutInterval[];
  tss: number;
  ftp: number;
  maxHr?: number;
}

function AnimatedBar({
  widthPercent,
  heightPercent,
  color,
  index,
}: {
  widthPercent: number;
  heightPercent: number;
  color: string;
  index: number;
}) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 400,
      delay: index * 25,
      useNativeDriver: false,
    }).start();
  }, [animValue, index]);

  const animatedHeight = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%' as unknown as number, `${heightPercent}%` as unknown as number],
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: `${widthPercent}%` as unknown as number,
          height: animatedHeight,
          backgroundColor: color,
        },
      ]}
    />
  );
}

export default function WorkoutPreview({ intervals, tss, ftp, maxHr }: WorkoutPreviewProps) {
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
            <Text style={[styles.statValue, styles.statValueAccent]}>{tss}</Text>
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
        <View style={styles.chartGrid}>
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
        </View>
        <View style={styles.chart}>
          {intervals.map((interval, index) => {
            const widthPercent = (interval.duration_seconds / totalDuration) * 100;
            const heightPercent = Math.max((interval.power_percent_ftp / (maxPower + 20)) * 100, 8);
            const color = getZoneColor(interval.power_percent_ftp);

            return (
              <AnimatedBar
                key={`bar-${index}`}
                widthPercent={widthPercent}
                heightPercent={heightPercent}
                color={color}
                index={index}
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
        <Text style={[styles.tableHeaderText, styles.colCadence]}>Cad</Text>
        <Text style={[styles.tableHeaderText, styles.colZone]}>Zone</Text>
        <Text style={[styles.tableHeaderText, styles.colHr]}>HR</Text>
        <Text style={[styles.tableHeaderText, styles.colRpe]}>RPE</Text>
      </View>

      <ScrollView style={styles.tableBody} nestedScrollEnabled>
        {intervals.map((interval, index) => {
          const color = getZoneColor(interval.power_percent_ftp);
          const watts = Math.round((interval.power_percent_ftp / 100) * ftp);
          const zone = getZoneName(interval.power_percent_ftp);
          const hrRange = maxHr && maxHr > 0 ? getHrRangeFromPower(interval.power_percent_ftp, maxHr) : null;
          const rpe = getRpeFromPower(interval.power_percent_ftp);
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
              <Text style={[styles.cellText, styles.colCadence]}>{interval.cadence_rpm_target ? `${interval.cadence_rpm_target}` : '--'}</Text>
              <Text style={[styles.cellText, styles.colZone, { color }]}>{zone}</Text>
              <Text style={[styles.cellText, styles.colHr]}>
                {hrRange ? `${hrRange.low}-${hrRange.high}` : '--'}
              </Text>
              <Text style={[styles.cellText, styles.colRpe]}>{rpe}</Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
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
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statValueAccent: {
    color: Colors.accent,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 3,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    fontWeight: '600' as const,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  chartContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    height: 130,
    position: 'relative',
  },
  chartGrid: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    bottom: 12,
    justifyContent: 'space-evenly',
  },
  gridLine: {
    height: 1,
    backgroundColor: Colors.shimmer,
  },
  chart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  bar: {
    borderRadius: 3,
    minWidth: 3,
  },
  chartBaseline: {
    height: 2,
    backgroundColor: Colors.border,
    marginTop: 2,
    borderRadius: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '700' as const,
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
    backgroundColor: Colors.shimmer,
  },
  cellText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
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
  colCadence: {
    flex: 1,
    textAlign: 'right' as const,
  },
  colZone: {
    flex: 0.9,
    textAlign: 'right' as const,
  },
  colHr: {
    flex: 1.1,
    textAlign: 'right' as const,
  },
  colRpe: {
    flex: 0.9,
    textAlign: 'right' as const,
  },
});
