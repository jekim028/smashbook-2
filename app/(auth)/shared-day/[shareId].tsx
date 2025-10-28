import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../../constants/Firebase';

const { width } = Dimensions.get('window');

const COLORS = {
  background: '#fdfcf8',
  card: '#FFFFFF',
  text: '#1A3140',
  secondaryText: '#8E8E93',
  accent: '#FF914D',
};

interface SharedDayData {
  userId: string;
  date: string; // YYYY-MM-DD
  userName: string;
  memories: Array<{
    id: string;
    type: string;
    imageUri?: string;
  }>;
  createdAt: any;
}

export default function SharedDayScreen() {
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const router = useRouter();
  const [dayData, setDayData] = useState<SharedDayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSharedDay();
  }, [shareId]);

  const loadSharedDay = async () => {
    if (!shareId) {
      setError('Invalid share link');
      setIsLoading(false);
      return;
    }

    try {
      console.log('[SharedDay] Loading share ID:', shareId);
      
      // Get the share document from Firestore
      const shareDocRef = doc(db, 'dayShares', shareId);
      const shareDoc = await getDoc(shareDocRef);

      if (!shareDoc.exists()) {
        setError('This shared day could not be found');
        setIsLoading(false);
        return;
      }

      const data = shareDoc.data() as SharedDayData;
      setDayData(data);

      // Increment view count
      await updateDoc(shareDocRef, {
        viewCount: increment(1)
      });

      console.log('[SharedDay] Loaded day data:', data);
    } catch (err) {
      console.error('[SharedDay] Error loading shared day:', err);
      setError('Failed to load shared day');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInApp = () => {
    if (!dayData) return;
    
    // If user is logged in, navigate to the main app
    if (auth.currentUser) {
      // Navigate to home - the deep link will be handled by the app
      router.replace('/');
    } else {
      // Navigate to login
      router.replace('/login');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading shared day...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !dayData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="sad-outline" size={64} color={COLORS.secondaryText} />
          <Text style={styles.errorText}>{error || 'Day not found'}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
            <Text style={styles.buttonText}>Go to Smashbook</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="calendar-outline" size={32} color={COLORS.accent} />
          <Text style={styles.title}>{dayData.userName}'s Smashbook</Text>
          <Text style={styles.subtitle}>{formatDate(dayData.date)}</Text>
        </View>

        {/* Preview Images */}
        <View style={styles.imagesContainer}>
          {dayData.memories.slice(0, 4).map((memory, index) => (
            <View
              key={memory.id}
              style={[
                styles.imageWrapper,
                index === 0 && styles.firstImage,
                index > 0 && styles.smallImage,
              ]}
            >
              {memory.imageUri ? (
                <Image
                  source={{ uri: memory.imageUri }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.image, styles.placeholderImage]}>
                  <Ionicons name="image-outline" size={40} color={COLORS.secondaryText} />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Call to Action */}
        <View style={styles.ctaContainer}>
          <Text style={styles.ctaText}>
            {dayData.memories.length} {dayData.memories.length === 1 ? 'memory' : 'memories'} shared
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleOpenInApp}>
            <Ionicons name="open-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>View in Smashbook</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.secondaryText,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.accent,
    marginTop: 8,
    fontWeight: '600',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  imageWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  firstImage: {
    width: '100%',
    height: width - 40,
  },
  smallImage: {
    width: (width - 64) / 3,
    height: (width - 64) / 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaContainer: {
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    color: COLORS.secondaryText,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

