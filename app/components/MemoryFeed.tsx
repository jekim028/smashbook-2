import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Linking, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../constants/Firebase';
import AddContentModal from './AddContentModal';
import AddMediaModal from './AddMediaModal';
import MemoryCard from './MemoryCard';
import MemoryOptionsModal from './MemoryOptionsModal';

interface Memory {
  id: string;
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link';
  content: any;
  date: Timestamp;
  isFavorite: boolean;
}

// Updated colors to match the fish logo theme used in the profile page
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

export const MemoryFeed: React.FC = () => {
  const router = useRouter();
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
  const unsubscribeRef = React.useRef<(() => void) | null>(null);
  const [isFanMenuOpen, setIsFanMenuOpen] = useState(false);
  const [isAddMediaModalVisible, setIsAddMediaModalVisible] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isMemoryOptionsModalVisible, setIsMemoryOptionsModalVisible] = useState(false);

  // Refs for each date section
  const sectionRefs = React.useRef<{ [key: string]: View | null }>({});

  // Store Y offsets for each section
  const sectionOffsets = React.useRef<{ [key: string]: number }>({});

  // Fetch memories from Firebase
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setMemories([]);
      setIsLoading(false);
      return;
    }

    const memoriesRef = collection(db, 'memories');
    const q = query(
      memoriesRef,
      where('userId', '==', user.uid)
    );

    unsubscribeRef.current = onSnapshot(q, 
      (snapshot) => {
        const memoryList: Memory[] = [];
        snapshot.forEach((doc) => {
          memoryList.push({ id: doc.id, ...doc.data() } as Memory);
        });
        
        // Sort locally instead of using orderBy in the query
        memoryList.sort((a, b) => {
          const dateA = a.date.toDate().getTime();
          const dateB = b.date.toDate().getTime();
          return dateB - dateA; // descending order (newest first)
        });
        
        setMemories(memoryList);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching memories:', error);
        setIsLoading(false);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
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

  // On mount, scroll to the bottom (show newest content)
  React.useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [memoriesByDate]);

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
    } else {
      // Open the memory options modal
      setSelectedMemory(memory);
      setIsMemoryOptionsModalVisible(true);
    }
  };

  const handleFavorite = (memoryId: string) => {
    if (!auth.currentUser) return;

    // Find the memory to toggle its favorite status
    const memory = memories.find(m => m.id === memoryId);
    if (!memory) return;

    // Update the favorite status in state
    setMemories(memories.map(memory => 
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
      }).catch(error => {
        console.error('Error updating favorite status:', error);
        // Revert local state if Firestore update fails
        setMemories(memories.map(memory => 
          memory.id === memoryId 
            ? { ...memory, isFavorite: !newIsFavorite }
            : memory
        ));
      });
    } catch (error) {
      console.error('Error updating favorite status:', error);
    }
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

  const handleSharePress = async () => {
    try {
      await Share.share({
        message: 'Check out my memories on Smashbook!',
        title: 'Smashbook Memories',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const navigateToFavorites = () => {
    router.push('/favorites' as any);
  };

  const toggleFanMenu = () => {
    setIsFanMenuOpen(!isFanMenuOpen);
  };

  const handleAddLink = () => {
    setIsFanMenuOpen(false);
    setIsAddContentModalVisible(true);
  };

  const handleAddMedia = () => {
    setIsFanMenuOpen(false);
    setIsAddMediaModalVisible(true);
  };

  const refreshMemories = () => {
    // This will be triggered after successful upload to refresh the memories list
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    setIsLoading(true);
    
    const user = auth.currentUser;
    if (!user) {
      setMemories([]);
      setIsLoading(false);
      return;
    }

    const memoriesRef = collection(db, 'memories');
    const q = query(
      memoriesRef,
      where('userId', '==', user.uid)
    );

    unsubscribeRef.current = onSnapshot(q, 
      (snapshot) => {
        const memoryList: Memory[] = [];
        snapshot.forEach((doc) => {
          memoryList.push({ id: doc.id, ...doc.data() } as Memory);
        });
        
        // Sort locally instead of using orderBy in the query
        memoryList.sort((a, b) => {
          const dateA = a.date.toDate().getTime();
          const dateB = b.date.toDate().getTime();
          return dateB - dateA; // descending order (newest first)
        });
        
        setMemories(memoryList);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching memories:', error);
        setIsLoading(false);
      }
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const renderMemory = (memory: Memory) => {
    switch (memory.type) {
      case 'link':
        if (!memory.content || !memory.content.url) {
          return null;
        }
        
        return (
          <TouchableOpacity
            key={memory.id}
            style={styles.memoryCard}
            onPress={() => handleLinkPress(memory.content.url)}
          >
            <View style={styles.memoryHeader}>
              <Ionicons name="link" size={24} color={COLORS.accent} />
              <Text style={styles.date}>
                {memory.date instanceof Timestamp ? memory.date.toDate().toLocaleDateString() : new Date(memory.date).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.url} numberOfLines={1}>
              {memory.content.url}
            </Text>
            {memory.content.caption && (
              <Text style={styles.caption} numberOfLines={2}>
                {memory.content.caption}
              </Text>
            )}
          </TouchableOpacity>
        );
      case 'photo':
        if (!memory.content) {
          return null;
        }
        
        // Pass the memory ID and ensure we're including the thumbnail
        const photoContent = {
          ...memory.content,
          memoryId: memory.id,
        };
        
        return (
          <TouchableOpacity
            key={memory.id}
            style={styles.memoryCard}
            onPress={() => handleMemoryPress(memory)}
          >
            <View style={styles.memoryHeader}>
              <Ionicons name="image" size={24} color={COLORS.accent} />
              <Text style={styles.date}>
                {memory.date instanceof Timestamp ? memory.date.toDate().toLocaleDateString() : new Date(memory.date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.photoContainer}>
              <MemoryCard
                type="photo"
                content={photoContent}
                isFavorite={memory.isFavorite}
                onPress={() => handleMemoryPress(memory)}
                onFavorite={() => handleFavorite(memory.id)}
              />
            </View>
            {memory.content.caption && (
              <Text style={styles.caption} numberOfLines={2}>
                {memory.content.caption}
              </Text>
            )}
          </TouchableOpacity>
        );
      default:
        return null;
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
        {/* Updated Header - Connected to Content */}
        <View style={[
          styles.header, 
          { 
            borderBottomLeftRadius: isSearchExpanded ? 0 : 16,
            borderBottomRightRadius: isSearchExpanded ? 0 : 16 
          }
        ]}>
          <View style={styles.headerLeft}>
            <Text style={styles.logoText}>Smashbook</Text>
            <Text style={styles.dateText}>
              {currentDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerButton} onPress={navigateToFavorites}>
              <Ionicons name="heart" size={24} color={COLORS.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleSharePress}>
              <Ionicons name="share-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={toggleSearch}>
              <Ionicons name="search-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => router.push('/profile')}
            >
              <View style={styles.profileButton}>
                <Ionicons name="person" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

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
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={18} color={COLORS.secondaryText} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search memories..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={COLORS.secondaryText}
            />
          </View>
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
          contentContainerStyle={styles.gridContentContainer}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
          ) : memories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={60} color={COLORS.secondaryText} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No memories yet. Start capturing!</Text>
              <TouchableOpacity 
                style={styles.emptyAddButton}
                onPress={() => setIsAddContentModalVisible(true)}
              >
                <Text style={styles.emptyAddButtonText}>Add Memory</Text>
              </TouchableOpacity>
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

        {/* Fan-out menu */}
        {isFanMenuOpen && (
          <View style={styles.fanMenuOverlay}>
            <TouchableOpacity 
              style={styles.fanMenuOption}
              onPress={handleAddLink}
            >
              <View style={[styles.fanMenuButton, { backgroundColor: '#4A90E2' }]}>
                <Ionicons name="link" size={22} color="#fff" />
              </View>
              <Text style={styles.fanMenuText}>Add Link</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.fanMenuOption}
              onPress={handleAddMedia}
            >
              <View style={[styles.fanMenuButton, { backgroundColor: '#50C878' }]}>
                <Ionicons name="image" size={22} color="#fff" />
              </View>
              <Text style={styles.fanMenuText}>Upload Media</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add Content Button with Fan-out menu */}
        <TouchableOpacity 
          style={styles.addContentButton}
          onPress={toggleFanMenu}
        >
          <Ionicons name={isFanMenuOpen ? "close" : "add"} size={24} color="#fff" />
        </TouchableOpacity>

        <AddContentModal
          visible={isAddContentModalVisible}
          onClose={() => setIsAddContentModalVisible(false)}
        />

        <AddMediaModal
          visible={isAddMediaModalVisible}
          onClose={() => setIsAddMediaModalVisible(false)}
          onSuccess={refreshMemories}
        />

        {selectedMemory && (
          <MemoryOptionsModal
            visible={isMemoryOptionsModalVisible}
            onClose={() => setIsMemoryOptionsModalVisible(false)}
            memoryId={selectedMemory.id}
            currentCaption={selectedMemory.content?.caption || ''}
            onSuccess={refreshMemories}
          />
        )}
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
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.secondaryText,
  },
  searchContainer: {
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: COLORS.text,
  },
  closeSearchButton: {
    position: 'absolute',
    right: 28,
    top: 17,
    padding: 4,
  },
  gridContainer: {
    flex: 1,
  },
  gridContentContainer: {
    paddingBottom: 24,
  },
  dayContainer: {
    marginBottom: 16,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  dateHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    justifyContent: 'space-between',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 300,
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  fanMenuOverlay: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    alignItems: 'flex-end',
    zIndex: 99,
  },
  fanMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fanMenuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fanMenuText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyAddButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  memoryCard: {
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  photoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
});

export default MemoryFeed; 