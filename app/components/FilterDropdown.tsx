import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

const COLORS = {
  background: '#fdfcf8',
  card: '#FFFFFF',
  text: '#1A3140',
  secondaryText: '#8E8E93',
  accent: '#FF914D',
  border: '#E5E5EA',
};

export type FilterType = 'photo' | 'note' | 'instagram' | 'tiktok' | 'link' | 'text';

interface FilterOption {
  type: FilterType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
}

interface FilterDropdownProps {
  visible: boolean;
  onClose: () => void;
  availableFilters: FilterOption[];
  selectedFilters: FilterType[];
  onFilterChange: (filters: FilterType[]) => void;
  buttonPosition: { x: number; y: number; width: number; height: number };
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  visible,
  onClose,
  availableFilters,
  selectedFilters,
  onFilterChange,
  buttonPosition,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const toggleFilter = (type: FilterType) => {
    if (selectedFilters.includes(type)) {
      onFilterChange(selectedFilters.filter(f => f !== type));
    } else {
      onFilterChange([...selectedFilters, type]);
    }
  };

  const clearAllFilters = () => {
    onFilterChange([]);
  };

  const selectAllFilters = () => {
    onFilterChange(availableFilters.map(f => f.type));
  };

  const dropdownTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.dropdown,
                {
                  top: buttonPosition.y + buttonPosition.height + 8,
                  right: 16,
                  opacity: fadeAnim,
                  transform: [{ translateY: dropdownTranslateY }],
                },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Filter by Type</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={selectAllFilters}
                >
                  <Text style={styles.quickActionText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={clearAllFilters}
                >
                  <Text style={styles.quickActionText}>Clear All</Text>
                </TouchableOpacity>
              </View>

              {/* Filter Options */}
              <ScrollView
                style={styles.optionsList}
                showsVerticalScrollIndicator={false}
              >
                {availableFilters.map((filter) => {
                  const isSelected = selectedFilters.includes(filter.type);
                  return (
                    <TouchableOpacity
                      key={filter.type}
                      style={[
                        styles.filterOption,
                        isSelected && styles.filterOptionSelected,
                      ]}
                      onPress={() => toggleFilter(filter.type)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.filterIconContainer}>
                        <Ionicons
                          name={filter.icon}
                          size={20}
                          color={isSelected ? COLORS.accent : COLORS.text}
                        />
                      </View>
                      <View style={styles.filterContent}>
                        <Text
                          style={[
                            styles.filterLabel,
                            isSelected && styles.filterLabelSelected,
                          ]}
                        >
                          {filter.label}
                        </Text>
                        <Text style={styles.filterCount}>
                          {filter.count} {filter.count === 1 ? 'item' : 'items'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  dropdown: {
    position: 'absolute',
    width: 280,
    maxHeight: 400,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  quickActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },
  optionsList: {
    maxHeight: 280,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterOptionSelected: {
    backgroundColor: 'rgba(255, 145, 77, 0.05)',
  },
  filterIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 145, 77, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  filterContent: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  filterLabelSelected: {
    color: COLORS.accent,
  },
  filterCount: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
});

export default FilterDropdown;

