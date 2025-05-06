import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect } from 'react';
import { ActivityIndicator, Animated, Dimensions, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../constants/Firebase';
import AddContentModal from './AddContentModal';
import MemoryCard from './MemoryCard';

interface Memory {
  id: string;
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link';
  content: any;
  date: Timestamp;
  isFavorite: boolean;
}

// Generate sample data for the last 30 days
const generateSampleMemories = (): Memory[] => {
  const memories: Memory[] = [];
  const today = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    // Generate 2-4 memories per day with different types
    const memoriesPerDay = Math.floor(Math.random() * 3) + 2;
    
    for (let j = 0; j < memoriesPerDay; j++) {
      const memoryTypes: Memory['type'][] = ['photo', 'note', 'voice', 'text', 'reel', 'tiktok', 'restaurant', 'location', 'link'];
      const type = memoryTypes[Math.floor(Math.random() * memoryTypes.length)];
      
      let content: any = {};
      switch (type) {
        case 'photo':
          content = {
            uri: `https://picsum.photos/400/400?random=${i}${j}`,
            caption: 'A beautiful moment captured'
          };
          break;
        case 'note':
          content = {
            text: 'Remember this day...',
            title: 'Daily Note'
          };
          break;
        case 'voice':
          content = {
            duration: '0:45',
            title: 'Voice Memo'
          };
          break;
        case 'text':
          content = {
            text: 'Hey! How are you?',
            sender: 'John Doe'
          };
          break;
        case 'reel':
          content = {
            uri: `https://picsum.photos/400/400?random=${i}${j}`,
            duration: '0:30',
            title: 'Instagram Reel'
          };
          break;
        case 'tiktok':
          content = {
            uri: `https://picsum.photos/400/400?random=${i}${j}`,
            duration: '0:15',
            title: 'TikTok Video'
          };
          break;
        case 'restaurant':
          content = {
            name: 'The Local Cafe',
            rating: 4.5,
            location: '123 Main St'
          };
          break;
        case 'location':
          content = {
            name: 'Central Park',
            coordinates: { lat: 40.7829, lng: -73.9654 }
          };
          break;
        case 'link':
          content = {
            url: 'https://example.com',
            title: 'Interesting Article',
            description: 'Check this out!'
          };
          break;
      }

      memories.push({
        id: `${i}-${j}`,
        type,
        content,
        date: Timestamp.fromDate(new Date(date)),
        isFavorite: Math.random() > 0.7
      });
    }
  }
  
  return memories;
};

// Pastel color palette
const COLORS = {
  background: '#F8F8F8',
  card: '#FFFFFF',
  text: '#2C2C2E',
  secondaryText: '#8E8E93',
  accent: '#007AFF',
  shadow: 'rgba(0, 0, 0, 0.08)',
  header: 'rgba(255, 255, 255, 0.8)',
  searchBackground: 'rgba(255, 255, 255, 0.9)',
};

export const MemoryFeed: React.FC = () => {
  // Initialize currentDate with the most recent date from memories
  const [currentDate, setCurrentDate] = React.useState(() => {
    const today = new Date();
    return today;
  });
  const [viewMode, setViewMode] = React.useState<'day' | 'month'>('day');
  const [memories, setMemories] = React.useState<Memory[]>([]);
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const searchBarWidth = React.useRef(new Animated.Value(0)).current;
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { height: screenHeight } = Dimensions.get('window');
  const [isAddContentModalVisible, setIsAddContentModalVisible] = React.useState(false);

  // Refs for each date section
  const sectionRefs = React.useRef<{ [key: string]: View | null }>({});

  // Store Y offsets for each section
  const sectionOffsets = React.useRef<{ [key: string]: number }>({});

  // Fetch memories from Firebase
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const memoriesRef = collection(db, 'memories');
    const q = query(
      memoriesRef,
      where('userId', '==', user.uid),
      where('type', '==', 'link'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memoryList: Memory[] = [];
      snapshot.forEach((doc) => {
        memoryList.push({ id: doc.id, ...doc.data() } as Memory);
      });
      setMemories(memoryList);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update currentDate when memories change to match the most recent content
  React.useEffect(() => {
    if (memories.length > 0) {
      const mostRecentDate = new Date(Math.max(...memories.map(m => m.date.toDate().getTime())));
      setCurrentDate(mostRecentDate);
    }
  }, [memories]);

  // Group memories by date and sort them
  const memoriesByDate = React.useMemo(() => {
    const grouped: { [key: string]: Memory[] } = {};
    memories.forEach(memory => {
      const dateKey = memory.date.toDate().toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(memory);
    });
    
    // Sort the dates in chronological order (oldest first)
    return Object.fromEntries(
      Object.entries(grouped).sort(([dateA], [dateB]) => 
        new Date(dateA).getTime() - new Date(dateB).getTime()
      )
    );
  }, [memories]);

  const toggleSearch = () => {
    const toValue = isSearchExpanded ? 0 : 1;
    Animated.spring(searchBarWidth, {
      toValue,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
    setIsSearchExpanded(!isSearchExpanded);
  };

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    let closestKey: string | null = null;
    let closestOffset = -Infinity;
    Object.entries(sectionOffsets.current).forEach(([dateKey, offset]) => {
      if (offset <= scrollY && offset > closestOffset) {
        closestOffset = offset;
        closestKey = dateKey;
      }
    });
    if (closestKey) {
      setCurrentDate(new Date(closestKey));
    }
  };

  const loadMoreContent = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const oldestDate = new Date(Math.min(...memories.map(m => m.date.toDate().getTime())));
    const newMemories: Memory[] = [];
    
    // Generate 10 more days of content
    for (let i = 1; i <= 10; i++) {
      const date = new Date(oldestDate);
      date.setDate(date.getDate() - i);
      
      const memoriesPerDay = Math.floor(Math.random() * 3) + 2;
      for (let j = 0; j < memoriesPerDay; j++) {
        newMemories.push({
          id: `${date.getTime()}-${j}`,
          type: Math.random() > 0.5 ? 'photo' : 'note',
          content: {
            uri: `https://picsum.photos/400/400?random=${date.getTime()}${j}`,
            text: `Memory from ${date.toLocaleDateString()}`
          },
          date: Timestamp.fromDate(new Date(date)),
          isFavorite: Math.random() > 0.7
        });
      }
    }
    
    setMemories(prev => [...prev, ...newMemories]);
    setIsLoading(false);
  };

  const scrollToToday = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const scrollToDate = (date: Date) => {
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const y = diffDays * screenHeight;
    scrollViewRef.current?.scrollTo({ y, animated: true });
  };

  const handleMemoryPress = (memory: Memory) => {
    if (memory.type === 'link') {
      handleLinkPress(memory.content.url);
    }
  };

  const handleFavorite = (memoryId: string) => {
    setMemories(memories.map(memory => 
      memory.id === memoryId 
        ? { ...memory, isFavorite: !memory.isFavorite }
        : memory
    ));
  };

  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });
  };

  // Scroll to the top of the 'today' section (most recent date) when component mounts
  React.useEffect(() => {
    if (scrollViewRef.current && memories.length > 0) {
      // Find the offset for the most recent date (today)
      const dateKeys = Object.keys(memoriesByDate);
      const todayKey = dateKeys[dateKeys.length - 1];
      const offset = sectionOffsets.current[todayKey] || 0;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
      }, 100);
    }
  }, [memoriesByDate]);

  const handleLinkPress = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <BlurView intensity={80} tint="light" style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateText}>
              {currentDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerButton} onPress={toggleSearch}>
              <Ionicons name="search-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="heart-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="share-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="person-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Search Bar */}
        <Animated.View style={[
          styles.searchContainer,
          {
            height: searchBarWidth.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 48]
            }),
            opacity: searchBarWidth
          }
        ]}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search memories..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.secondaryText}
          />
          {isSearchExpanded && (
            <TouchableOpacity 
              style={styles.closeSearchButton}
              onPress={toggleSearch}
            >
              <Ionicons name="close" size={20} color={COLORS.secondaryText} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Memory Grid */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
          ) : memories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No links saved yet. Add some links to see them here!</Text>
            </View>
          ) : (
            Object.entries(memoriesByDate).map(([dateKey, dayMemories]) => (
              <View key={dateKey} style={styles.dayContainer}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>
                    {formatDateHeader(new Date(dateKey))}
                  </Text>
                </View>
                <View style={styles.grid}>
                  {dayMemories.map((memory) => (
                    <MemoryCard
                      key={memory.id}
                      type={memory.type}
                      content={memory.content}
                      isFavorite={memory.isFavorite}
                      onPress={() => handleMemoryPress(memory)}
                      onFavorite={() => handleFavorite(memory.id)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Add Content Button */}
        <TouchableOpacity 
          style={styles.addContentButton}
          onPress={() => setIsAddContentModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={COLORS.card} />
        </TouchableOpacity>

        <AddContentModal
          visible={isAddContentModalVisible}
          onClose={() => setIsAddContentModalVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.shadow,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  dateText: {
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '600',
    color: COLORS.text,
  },
  searchContainer: {
    overflow: 'hidden',
    backgroundColor: COLORS.searchBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.shadow,
  },
  searchInput: {
    height: 48,
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: 'System',
    color: COLORS.text,
  },
  closeSearchButton: {
    position: 'absolute',
    right: 16,
    top: 14,
    padding: 4,
  },
  scrollContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  gridContainer: {
    flex: 1,
  },
  dayContainer: {
    marginBottom: 16,
  },
  dayContainerWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.shadow,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondaryText,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  gridItem: {
    width: '50%',
    padding: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  addContentButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  memoryCard: {
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 160,
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  url: {
    fontSize: 14,
    color: COLORS.accent,
    marginBottom: 4,
  },
  caption: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  date: {
    fontSize: 10,
    color: COLORS.secondaryText,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: COLORS.secondaryText,
  },
});

export default MemoryFeed; 