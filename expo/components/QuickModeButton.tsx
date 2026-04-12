import React, { memo, useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

type QuickModeVariant = 'default' | 'spin' | 'fun';

interface QuickModeButtonProps {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  selected?: boolean;
  compact?: boolean;
  variant?: QuickModeVariant;
  testID?: string;
}

function QuickModeButtonInner({
  label,
  description,
  icon,
  onPress,
  selected = false,
  compact = false,
  variant = 'default',
  testID,
}: QuickModeButtonProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const variantStyle = variant === 'spin' ? styles.spin : variant === 'fun' ? styles.fun : undefined;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        compact && styles.compact,
        selected && styles.selected,
        variantStyle,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <View style={styles.textContainer}>
        <Text
          style={[styles.label, selected && styles.labelSelected]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {description && !compact && (
          <Text style={styles.description} numberOfLines={1}>
            {description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export const QuickModeButton = memo(QuickModeButtonInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compact: {
    padding: 10,
    paddingHorizontal: 14,
  },
  selected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  spin: {
    borderColor: 'rgba(168, 85, 247, 0.3)',
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
  },
  fun: {
    borderColor: 'rgba(234, 179, 8, 0.3)',
    backgroundColor: 'rgba(234, 179, 8, 0.06)',
  },
  iconContainer: {
    marginRight: 10,
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  labelSelected: {
    color: Colors.accent,
  },
  description: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

export default QuickModeButton;
