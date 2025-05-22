import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../constants/Firebase';
import MemoryCard from './components/MemoryCard';

interface Memory {
  id: string;
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link';
  content: any;
  date: Timestamp;
  isFavorite: boolean;
}

// Updated colors to match the fish logo theme
const COLORS = {
  background: '#fdfcf8', // Same as login page
  card: '#FFFFFF',
  text: '#1A3140', // Navy from fish logo
  secondaryText: '#8E8E93',
  accent: '#FF914D', // Orange from fish logo
  shadow: 'rgba(0, 0, 0, 0.08)',
  header: 'rgba(255, 255, 255, 0.8)',
  searchBackground: 'rgba(255, 255, 255, 0.9)',
  lightAccent: '#FFF0E6', // Lighter version of accent
};

export default function FavoritesScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }

    const memoriesRef = collection(db, 'memories');
    const q = query(
      memoriesRef,
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const allMemories: Memory[] = [];
        snapshot.forEach((doc) => {
          allMemories.push({ id: doc.id, ...doc.data() } as Memory);
        });
        
        // Filter favorites locally
        const favoritesList = allMemories.filter(memory => memory.isFavorite);
        
        // Sort by date
        favoritesList.sort((a, b) => {
          const dateA = a.date.toDate().getTime();
          const dateB = b.date.toDate().getTime();
          return dateB - dateA; // newest first
        });
        
        setFavorites(favoritesList);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching favorites:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleMemoryPress = (memory: Memory) => {
    if (memory.type === 'link') {
      handleLinkPress(memory.content.url);
    }
  };

  const handleLinkPress = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'Could not open this link');
    }
  };

  const handleFavorite = (memoryId: string) => {
    if (!auth.currentUser) return;

    // Find the memory to toggle its favorite status
    const memory = favorites.find(m => m.id === memoryId);
    if (!memory) return;

    // Update the favorite status in local state
    setFavorites(favorites.map(memory => 
      memory.id === memoryId 
        ? { ...memory, isFavorite: !memory.isFavorite }
        : memory
    ));

    // Update in Firestore
    const newIsFavorite = !memory.isFavorite;
    try {
      const memoryRef = doc(db, 'memories', memoryId);
      updateDoc(memoryRef, {
        isFavorite: newIsFavorite
      }).then(() => {
        console.log(`Memory ${memoryId} favorite status updated to ${newIsFavorite}`);
        
        // Remove from favorites list if unfavorited
        if (!newIsFavorite) {
          setFavorites(favorites.filter(m => m.id !== memoryId));
        }
      }).catch(error => {
        console.error('Error updating favorite status:', error);
        // Revert local state if Firestore update fails
        setFavorites(favorites.map(memory => 
          memory.id === memoryId 
            ? { ...memory, isFavorite: !newIsFavorite }
            : memory
        ));
      });
    } catch (error) {
      console.error('Error updating favorite status:', error);
    }
  };

  const renderItem = ({ item }: { item: Memory }) => (
    <View style={styles.cardContainer}>
      <MemoryCard
        type={item.type}
        content={item.content}
        isFavorite={item.isFavorite}
        onPress={() => handleMemoryPress(item)}
        onFavorite={() => handleFavorite(item.id)}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={60} color={COLORS.secondaryText} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No favorites yet</Text>
          <Text style={styles.emptySubText}>Items you heart will appear here</Text>
          <TouchableOpacity 
            style={styles.browseButton}
            onPress={() => router.back()}
          >
            <Text style={styles.browseButtonText}>Browse Memories</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          numColumns={2}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  listContent: {
    padding: 8,
  },
  cardContainer: {
    width: '50%', // Two columns
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
}); 