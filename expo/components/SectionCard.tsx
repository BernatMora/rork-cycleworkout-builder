import React, { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  testID?: string;
}

function SectionCardInner({
  title,
  subtitle,
  icon,
  collapsible = false,
  defaultExpanded = true,
  children,
  headerRight,
  testID,
}: SectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.selectionAsync();
    setIsExpanded((prev) => !prev);
  }, []);

  const HeaderComponent = collapsible ? TouchableOpacity : View;
  const headerProps = collapsible
    ? { onPress: toggleExpanded, activeOpacity: 0.7 }
    : {};

  return (
    <View style={styles.container} testID={testID}>
      <HeaderComponent style={styles.header} {...headerProps}>
        <View style={styles.headerLeft}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        <View style={styles.headerRight}>
          {headerRight}
          {collapsible && (
            <View style={styles.chevron}>
              {isExpanded ? (
                <ChevronUp size={18} color={Colors.textSecondary} />
              ) : (
                <ChevronDown size={18} color={Colors.textSecondary} />
              )}
            </View>
          )}
        </View>
      </HeaderComponent>
      {(!collapsible || isExpanded) && (
        <View style={styles.content}>{children}</View>
      )}
    </View>
  );
}

export const SectionCard = memo(SectionCardInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: 12,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    marginLeft: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

export default SectionCard;
