import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import MemoryCard from './MemoryCard';

const COLORS = {
  shadow: '#000000',
};

interface Memory {
  id: string;
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link';
  content: any;
  isFavorite: boolean;
  date: any;
}

interface DraggableMemoryGridProps {
  memories: Memory[];
  onPress: (memory: Memory) => void;
  onFavorite: (memoryId: string) => void;
  onMemoryLongPress: (memory: Memory) => void;
}

const DraggableMemoryGrid: React.FC<DraggableMemoryGridProps> = ({
  memories,
  onPress,
  onFavorite,
  onMemoryLongPress,
}) => {
  const { width: screenWidth } = Dimensions.get('window');
  const itemMargin = 8;
  const itemWidth = (screenWidth - 48) / 2;

  const getItemHeight = (memory: Memory) => {
    if (memory.type === 'photo' && memory.content?.aspectRatio) {
      return itemWidth * (memory.content.aspectRatio || 1);
    }
    return itemWidth * 1.3;
  };

  const rows: Memory[][] = [];
  for (let i = 0; i < memories.length; i += 2) {
    rows.push(memories.slice(i, i + 2));
  }

  return (
    <View style={styles.gridContainer}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.memoryRow}>
          {row.map((memory) => {
            const itemHeight = getItemHeight(memory);
            return (
              <MemoryCard
                key={memory.id}
                type={memory.type}
                content={memory.content}
                isFavorite={memory.isFavorite}
                onPress={() => onPress(memory)}
                onFavorite={() => onFavorite(memory.id)}
                onLongPress={() => onMemoryLongPress(memory)}
                style={{
                  margin: itemMargin,
                  width: itemWidth,
                  height: itemHeight,
                  borderRadius: 16,
                  shadowColor: COLORS.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                }}
              />
            );
          })}
          {/* Add empty space if the row isn't complete */}
          {row.length < 2 && (
            <View style={{ width: itemWidth, margin: itemMargin }} />
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    width: '100%',
    alignItems: 'center',
  },
  memoryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});

export default DraggableMemoryGrid;

