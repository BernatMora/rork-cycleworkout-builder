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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  testID?: string;
  accentBorder?: boolean;
}

function SectionCardInner({
  title,
  subtitle,
  icon,
  collapsible = false,
  defaultExpanded = true,
  defaultCollapsed,
  children,
  headerRight,
  testID,
  accentBorder = false,
}: SectionCardProps) {
  const initialExpanded = defaultCollapsed !== undefined ? !defaultCollapsed : defaultExpanded;
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

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
    <View
      style={[
        styles.container,
        accentBorder && styles.containerAccent,
      ]}
      testID={testID}
    >
      {accentBorder && <View style={styles.accentStripe} />}
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
  containerAccent: {
    borderColor: 'rgba(249, 115, 22, 0.2)',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  accentStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.accent,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
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
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
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
