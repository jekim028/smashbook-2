import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FilterType } from './FilterDropdown';

const COLORS = {
  accent: '#FF914D',
  text: '#1A3140',
  card: '#FFFFFF',
};

const FILTER_LABELS: Record<FilterType, string> = {
  photo: 'Photos',
  note: 'Notes',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  link: 'Links',
  text: 'Text',
};

interface FilterChipsProps {
  selectedFilters: FilterType[];
  onRemoveFilter: (filter: FilterType) => void;
  onClearAll: () => void;
}

const FilterChips: React.FC<FilterChipsProps> = ({
  selectedFilters,
  onRemoveFilter,
  onClearAll,
}) => {
  if (selectedFilters.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {selectedFilters.map((filter) => (
          <View key={filter} style={styles.chip}>
            <Text style={styles.chipText}>{FILTER_LABELS[filter]}</Text>
            <TouchableOpacity
              onPress={() => onRemoveFilter(filter)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={16} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.clearButton} onPress={onClearAll}>
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  scrollContent: {
    alignItems: 'center',
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 145, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 145, 77, 0.3)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
    marginRight: 6,
  },
  clearButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },
});

export default FilterChips;

