import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface ToggleSwitchProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
  disabled?: boolean;
  testID?: string;
}

function ToggleSwitchInner({
  label,
  value,
  onValueChange,
  description,
  disabled = false,
  testID,
}: ToggleSwitchProps) {
  const translateX = useRef(new Animated.Value(value ? 20 : 0)).current;
  const backgroundColor = useRef(
    new Animated.Value(value ? 1 : 0)
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: value ? 20 : 0,
        useNativeDriver: true,
        bounciness: 4,
      }),
      Animated.timing(backgroundColor, {
        toValue: value ? 1 : 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [value, translateX, backgroundColor]);

  const handlePress = useCallback(() => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onValueChange(!value);
    }
  }, [disabled, value, onValueChange]);

  const trackColor = backgroundColor.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.surfaceLight, Colors.accent],
  });

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={disabled}
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
    >
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

export const ToggleSwitch = memo(ToggleSwitchInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  description: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default ToggleSwitch;
