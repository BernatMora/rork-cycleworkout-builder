import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface PickerFieldProps<T extends string> {
  label: string;
  value: T;
  options: T[];
  onSelect: (value: T) => void;
  testID?: string;
}

export default function PickerField<T extends string>({
  label,
  value,
  options,
  onSelect,
  testID,
}: PickerFieldProps<T>) {
  const [visible, setVisible] = useState(false);

  const handleSelect = useCallback(
    (item: T) => {
      onSelect(item);
      setVisible(false);
    },
    [onSelect]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        testID={testID}
      >
        <Text style={styles.fieldText}>{value}</Text>
        <ChevronDown size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item === value && styles.optionSelected]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.optionText, item === value && styles.optionTextSelected]}
                  >
                    {item}
                  </Text>
                  {item === value && <Check size={18} color={Colors.accent} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: 400,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  optionSelected: {
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  optionText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  optionTextSelected: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
});
