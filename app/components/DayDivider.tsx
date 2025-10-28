import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../constants/Firebase';

// Theme color from the app
const BRAND_COLOR = '#FF914D'; // Orange brand color
const TEXT_COLOR = '#8E8E93'; // Secondary text color (gray)

interface DayDividerProps {
  date: Date;
  width: number;
  onPress?: () => void;
  refreshKey?: number;
}

interface DayMetadata {
  title?: string;
  caption?: string;
}

const DayDivider: React.FC<DayDividerProps> = ({ date, width, onPress, refreshKey }) => {
  const [metadata, setMetadata] = useState<DayMetadata | null>(null);

  // Format the date in a nice way
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  useEffect(() => {
    fetchMetadata();
  }, [date, refreshKey]);

  const fetchMetadata = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const metadataId = `${user.uid}_${dateString}`;
      const docRef = doc(db, 'dayMetadata', metadataId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setMetadata({
          title: data.title || '',
          caption: data.caption || '',
        });
      } else {
        setMetadata(null);
      }
    } catch (error) {
      console.error('[DayDivider] Error fetching metadata:', error);
    }
  };

  const hasMetadata = metadata && (metadata.title || metadata.caption);

  return (
    <TouchableOpacity
      style={[styles.container, { width }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.labelContainer, hasMetadata && styles.labelContainerWithMetadata]}>
        <View style={styles.contentContainer}>
          <Text style={styles.dateLabel}>{formattedDate}</Text>
          {metadata?.title && (
            <Text style={styles.titleText}>{metadata.title}</Text>
          )}
          {metadata?.caption && (
            <Text style={styles.captionText} numberOfLines={2}>
              {metadata.caption}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    marginBottom: 12,
    paddingHorizontal: 15,
    width: '100%',
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
    width: '100%',
    alignSelf: 'center',
  },
  labelContainerWithMetadata: {
    paddingVertical: 10,
  },
  contentContainer: {
  },
  dateLabel: {
    color: BRAND_COLOR,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  titleText: {
    color: '#1A3140',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 4,
    textAlign: 'center',
  },
  captionText: {
    color: TEXT_COLOR,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default DayDivider; 