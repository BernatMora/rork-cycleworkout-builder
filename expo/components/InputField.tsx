import React, { memo, useCallback, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  hint?: string;
  error?: string;
  clearable?: boolean;
  maxLength?: number;
  testID?: string;
  accessibilityLabel?: string;
}

function InputFieldInner({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  hint,
  error,
  clearable = false,
  maxLength,
  testID,
  accessibilityLabel,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = useCallback(() => {
    onChangeText('');
  }, [onChangeText]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          testID={testID}
          accessibilityLabel={accessibilityLabel || label}
        />
        {clearable && value.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear input"
          >
            <X size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export const InputField = memo(InputFieldInner);

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputContainerFocused: {
    borderColor: Colors.accent,
  },
  inputContainerError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  clearButton: {
    padding: 8,
    marginRight: 6,
  },
  hint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  error: {
    fontSize: 11,
    color: Colors.error,
    marginTop: 4,
    paddingHorizontal: 2,
  },
});

export default InputField;
