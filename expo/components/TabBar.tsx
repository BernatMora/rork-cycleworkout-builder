import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

export type TabItem<T extends string> = {
  key: T;
  label: string;
  icon?: React.ReactNode;
};

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  testID?: string;
}

function TabBarInner<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  testID,
}: TabBarProps<T>) {
  const handlePress = useCallback(
    (tab: T) => {
      if (tab !== activeTab) {
        Haptics.selectionAsync();
        onTabChange(tab);
      }
    },
    [activeTab, onTabChange]
  );

  return (
    <View style={styles.container} testID={testID}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => handlePress(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            {tab.icon && (
              <View style={styles.iconContainer}>{tab.icon}</View>
            )}
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const TabBar = memo(TabBarInner) as typeof TabBarInner;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.accent,
  },
  iconContainer: {
    opacity: 0.9,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.text,
  },
});

export default TabBar;
