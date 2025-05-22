import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Theme color from the app
const BRAND_COLOR = '#FF914D'; // Orange brand color
const TEXT_COLOR = '#8E8E93'; // Secondary text color (gray)

interface DayDividerProps {
  date: Date;
  width: number;
}

const DayDivider: React.FC<DayDividerProps> = ({ date, width }) => {
  // Format the date in a nice way
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={[styles.container, { width }]}>
      {/* Date label pill */}
      <View style={styles.labelContainer}>
        <Text style={styles.dateLabel}>{formattedDate}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    marginBottom: 12,
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  labelContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${BRAND_COLOR}15`, // 15% opacity border
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateLabel: {
    color: BRAND_COLOR,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default DayDivider; 