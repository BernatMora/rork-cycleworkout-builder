import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Globe, Zap, Calendar, FileDown, Upload, Bike, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useTranslation } from '@/hooks/useTranslation';
import { AppLanguage } from '@/constants/translations';
import { STORAGE_KEYS, WEEKDAY_OPTIONS } from '@/constants/workout-options';

function FadeInView({ delay, children }: { delay: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useTranslation();
  const [ftp, setFtp] = useState<string>('');
  const [maxHr, setMaxHr] = useState<string>('185');
  const [trainingDays, setTrainingDays] = useState<string[]>(['Tue', 'Thu', 'Sat']);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedFtp, storedMaxHr, storedDays] = await Promise.all([
          AsyncStorage.getItem('ictrainer_ftp'),
          AsyncStorage.getItem('ictrainer_max_hr'),
          AsyncStorage.getItem(STORAGE_KEYS.TRAINING_DAYS),
        ]);
        if (storedFtp) setFtp(storedFtp);
        if (storedMaxHr) setMaxHr(storedMaxHr);
        if (storedDays) {
          const parsed = JSON.parse(storedDays);
          if (Array.isArray(parsed)) setTrainingDays(parsed);
        }
      } catch (e) {
        console.error('[Profile] Load error:', e);
      }
    };
    load();
  }, []);

  const saveFtp = useCallback(async (value: string) => {
    setFtp(value);
    await AsyncStorage.setItem('ictrainer_ftp', value);
  }, []);

  const saveMaxHr = useCallback(async (value: string) => {
    setMaxHr(value);
    await AsyncStorage.setItem('ictrainer_max_hr', value);
  }, []);

  const toggleDay = useCallback(
    (day: string) => {
      Haptics.selectionAsync();
      setTrainingDays((prev) => {
        const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
        if (next.length === 0) return prev;
        AsyncStorage.setItem(STORAGE_KEYS.TRAINING_DAYS, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const handleLanguage = useCallback(
    (lang: AppLanguage) => {
      Haptics.selectionAsync();
      setLanguage(lang);
    },
    [setLanguage]
  );

  const handleExportBackup = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'Profile backup export is currently available on web.');
      return;
    }
    try {
      const keys = Object.values(STORAGE_KEYS);
      const pairs = await AsyncStorage.multiGet(keys);
      const backup: Record<string, string | null> = {};
      for (const [key, value] of pairs) {
        backup[key] = value;
      }
      backup['ictrainer_ftp'] = ftp;
      backup['ictrainer_max_hr'] = maxHr;

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cycleplan_backup_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Alert.alert('Success', 'Profile backup exported.');
    } catch (e) {
      console.error('[Profile] Backup export error:', e);
    }
  }, [ftp, maxHr]);

  const handleImportBackup = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'Profile backup import is currently available on web.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      try {
        const content = await file.text();
        const parsed = JSON.parse(content) as Record<string, string | null>;
        const pairs: [string, string][] = Object.entries(parsed)
          .filter((entry): entry is [string, string] => entry[1] !== null);
        await AsyncStorage.multiSet(pairs);
        if (parsed['ictrainer_ftp']) setFtp(parsed['ictrainer_ftp']);
        if (parsed['ictrainer_max_hr']) setMaxHr(parsed['ictrainer_max_hr']);
        Alert.alert('Success', 'Profile backup imported. Restart the app for full effect.');
      } catch (e) {
        console.error('[Profile] Backup import error:', e);
        Alert.alert('Error', 'Could not import backup file.');
      }
    };
    input.click();
  }, []);

  const ftpNum = parseInt(ftp, 10);
  const ftpValid = !isNaN(ftpNum) && ftpNum >= 50 && ftpNum <= 500;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <FadeInView delay={0}>
          <View style={styles.heroSection}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Bike size={28} color={Colors.accent} />
              </View>
              <View style={styles.avatarRing} />
            </View>
            <Text style={styles.screenTitle}>Profile</Text>
            {ftpValid && (
              <View style={styles.ftpBadge}>
                <Zap size={12} color={Colors.accent} />
                <Text style={styles.ftpBadgeText}>{ftpNum}w FTP</Text>
              </View>
            )}
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Globe size={16} color={Colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Language</Text>
            </View>
            <View style={styles.langRow}>
              {(['ca', 'es', 'en'] as AppLanguage[]).map((lang) => {
                const isActive = language === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langChip, isActive && styles.langChipActive]}
                    onPress={() => handleLanguage(lang)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.langChipText, isActive && styles.langChipTextActive]}>
                      {lang === 'ca' ? 'Català' : lang === 'es' ? 'Español' : 'English'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={120}>
          <View style={[styles.card, styles.cardAccent]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, styles.cardIconWrapAccent]}>
                <Zap size={16} color={Colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Rider Profile</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t('ftpLabel')}</Text>
              <TextInput
                style={[styles.fieldInput, ftp.length > 0 && ftpValid && styles.fieldInputValid]}
                value={ftp}
                onChangeText={saveFtp}
                placeholder={t('ftpPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                testID="profile-ftp-input"
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t('maxHrLabel')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={maxHr}
                onChangeText={saveMaxHr}
                placeholder={t('maxHrPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                testID="profile-maxhr-input"
              />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={180}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Calendar size={16} color={Colors.zone1} />
              </View>
              <Text style={styles.cardTitle}>{t('trainingDaysLabel')}</Text>
            </View>
            <View style={styles.daysRow}>
              {WEEKDAY_OPTIONS.map((day) => {
                const isSelected = trainingDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, isSelected && styles.dayChipActive]}
                    onPress={() => toggleDay(day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.daysHint}>
              {trainingDays.length} day{trainingDays.length !== 1 ? 's' : ''} selected
            </Text>
          </View>
        </FadeInView>

        <FadeInView delay={240}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Shield size={16} color={Colors.zone2} />
              </View>
              <Text style={styles.cardTitle}>Data Management</Text>
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={handleExportBackup} activeOpacity={0.7}>
              <FileDown size={16} color={Colors.textSecondary} />
              <Text style={styles.actionButtonText}>{t('exportBackup')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleImportBackup} activeOpacity={0.7}>
              <Upload size={16} color={Colors.textSecondary} />
              <Text style={styles.actionButtonText}>{t('importBackup')}</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>

        <Text style={styles.versionText}>Cycle Planner v1.0</Text>
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
  heroSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatarRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.15)',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  ftpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    backgroundColor: Colors.accentGlow,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
  },
  ftpBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.accentLight,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardAccent: {
    borderColor: 'rgba(249, 115, 22, 0.15)',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconWrapAccent: {
    backgroundColor: Colors.accentGlow,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: 12,
    alignItems: 'center',
  },
  langChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  langChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  langChipTextActive: {
    color: Colors.accentLight,
    fontWeight: '700' as const,
  },
  fieldRow: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldInputValid: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minWidth: 48,
    alignItems: 'center',
  },
  dayChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  dayChipTextActive: {
    color: Colors.accentLight,
    fontWeight: '700' as const,
  },
  daysHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 10,
    fontWeight: '500' as const,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  versionText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 20,
    marginBottom: 10,
  },
});
