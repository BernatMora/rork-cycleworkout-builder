import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Colors from '@/constants/colors';

type StatusType = 'info' | 'success' | 'warning' | 'error';

interface StatusBarProps {
  message: string;
  type?: StatusType;
  visible?: boolean;
  duration?: number;
  onHide?: () => void;
}

function StatusBarInner({
  message,
  type = 'info',
  visible = true,
  duration = 3000,
  onHide,
}: StatusBarProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible && message) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 8,
        }),
      ]).start();

      if (duration > 0) {
        const timer = setTimeout(() => {
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: -20,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onHide?.();
          });
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      opacity.setValue(0);
      translateY.setValue(-20);
    }
  }, [visible, message, duration, opacity, translateY, onHide]);

  if (!message) return null;

  const backgroundColor = {
    info: Colors.surfaceLight,
    success: Colors.success,
    warning: Colors.warning,
    error: Colors.error,
  }[type];

  const textColor = type === 'info' ? Colors.text : '#fff';

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={[styles.message, { color: textColor }]}>{message}</Text>
    </Animated.View>
  );
}

export const StatusBar = memo(StatusBarInner);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default StatusBar;
