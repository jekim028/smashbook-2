import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, DocumentData, getDoc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, FlatList, Linking, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../constants/Firebase';
import AddContentModal from './AddContentModal';
import AddMediaModal from './AddMediaModal';
import MediaDetailModal from './MediaDetailModal';
import MemoryCard from './MemoryCard';
import MemoryOptionsModal from './MemoryOptionsModal';

interface Memory {
  id: string;
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link';
  content: any;
  date: Timestamp;
  isFavorite: boolean;
  sharedWith?: string[]; // Add sharedWith field as optional array of strings
  userId: string; // Add userId field
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

const CARD_WIDTH = (Dimensions.get('window').width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.3;

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
  const [isMediaDetailVisible, setIsMediaDetailVisible] = useState(false);
  const [mediaDetailIndex, setMediaDetailIndex] = useState(0);

  // Refs for each date section
  const sectionRefs = React.useRef<{ [key: string]: View | null }>({});

  // Store Y offsets for each section
  const sectionOffsets = React.useRef<{ [key: string]: number }>({});

  // Helper to flatten all media into a single array for swiping
  const allMedia = memories.filter(m => ['photo', 'video', 'link'].includes(m.type));

  // Sort memories oldest to newest (oldest at top, newest at bottom)
  const sortedMemories = React.useMemo(() => {
    return [...memories].sort((a, b) => {
      const dateA = a.date.toDate().getTime();
      const dateB = b.date.toDate().getTime();
      return dateA - dateB; // oldest first
    });
  }, [memories]);

  // Calculate dimensions
  const numColumns = 2;
  const screenWidth = Dimensions.get('window').width;
  const itemMargin = 6;
  const itemWidth = (screenWidth - (numColumns + 1) * itemMargin * 2) / numColumns;

  // For tracking layout completion
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  // FlatList ref for scrolling
  const flatListRef = React.useRef<FlatList>(null);

  // Scroll to bottom after content has loaded and laid out
  // This is more reliable than using useEffect with a timeout
  useEffect(() => {
    if (
      flatListRef.current &&
      contentHeight > 0 &&
      containerHeight > 0 &&
      !hasScrolledToBottom &&
      sortedMemories.length > 0
    ) {
      // Calculate position to scroll to (bottom)
      const scrollToY = Math.max(0, contentHeight - containerHeight);
      
      // Add a small delay to ensure rendering is complete
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: scrollToY,
          animated: false,
        });
        setHasScrolledToBottom(true);
      }, 50);
    }
  }, [contentHeight, containerHeight, sortedMemories.length, hasScrolledToBottom]);

  // Reset scroll state when data changes significantly
  useEffect(() => {
    if (sortedMemories.length > 0) {
      setHasScrolledToBottom(false);
    }
  }, [sortedMemories.length]);

  // Prepare data for FlatList
  const renderItem = ({ item, index }: { item: Memory, index: number }) => {
    // Calculate height based on content type
    const itemHeight = item.type === 'photo' && item.content?.aspectRatio
      ? itemWidth * (item.content.aspectRatio || 1)
      : itemWidth * 1.3;
    
    return (
      <MemoryCard
        key={item.id}
        type={item.type}
        content={item.content}
        isFavorite={item.isFavorite}
        onPress={() => handleMemoryPress(item)}
        onFavorite={() => handleFavorite(item.id)}
        style={{
          margin: itemMargin,
          width: itemWidth,
          height: itemHeight,
          borderRadius: 16,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
          backgroundColor: COLORS.card,
        }}
      />
    );
  };

  // Helper function to get item layout for optimized scrolling
  const getItemLayout = (data: any, index: number) => {
    // Use average height for faster calculation
    const averageHeight = CARD_HEIGHT;
    // Calculate position based on grid layout (2 columns)
    const row = Math.floor(index / numColumns);
    return {
      length: averageHeight,
      offset: averageHeight * row,
      index,
    };
  };

  // Modified loadMoreContent to do nothing (no placeholder content)
  const handleLoadMore = async () => {
    // Do nothing - we don't want to load placeholder content
    // Just using real content from Firebase
    return;
  };

  // FlatList viewability config
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 10,
  };

  // Update header date based on visible items
  const onViewableItemsChanged = React.useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems && viewableItems.length > 0) {
      // Find the bottommost visible item (highest index)
      const bottomItem = viewableItems.reduce((prev, curr) => 
        prev.index > curr.index ? prev : curr
      );
      
      if (bottomItem.item && bottomItem.item.date) {
        setCurrentDate(bottomItem.item.date.toDate());
      }
    }
  }).current;

  // Fetch memories from Firebase
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setMemories([]);
      setIsLoading(false);
      return;
    }

    // Create a map to store all memories by ID to prevent duplicates
    let allMemoriesMap = new Map();

    const memoriesRef = collection(db, 'memories');
    const q = query(
      memoriesRef,
      where('userId', '==', user.uid)
    );

    // Set up real-time listener for user's own memories
    const ownMemoriesUnsubscribe = onSnapshot(q, 
      (snapshot) => {
        snapshot.forEach((doc) => {
          allMemoriesMap.set(doc.id, { id: doc.id, ...doc.data() } as Memory);
        });
        
        // Update memories state with all memories from the map
        const allMemories = Array.from(allMemoriesMap.values());
        setMemories(allMemories.sort((a, b) => {
          const dateA = a.date.toDate().getTime();
          const dateB = b.date.toDate().getTime();
          return dateB - dateA; // descending order (newest first)
        }));
      },
      (error) => {
        console.error('Error fetching own memories:', error);
        setIsLoading(false);
      }
    );

    // Set up real-time listener for shared memories
    const sharedMemoriesRef = collection(db, 'memories');
    const sharedQ = query(
      sharedMemoriesRef,
      where('sharedWith', 'array-contains', user.uid)
    );

    const sharedMemoriesUnsubscribe = onSnapshot(sharedQ,
      async (snapshot) => {
        // Process each shared memory
        const sharedMemoryPromises = snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          const memory = { id: docSnapshot.id, ...data } as Memory;
          
          // If this is a shared memory, get the user info of who shared it
          if (data.userId) {
            try {
              const userDocRef = doc(db, 'users', data.userId);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                const userData = userDoc.data() as DocumentData;
                memory.content = {
                  ...memory.content,
                  sharedBy: {
                    photoURL: userData.photoURL || null,
                    displayName: userData.displayName || null
                  }
                };
              }
            } catch (error) {
              console.error('Error fetching user info for shared memory:', error);
            }
          }
          
          return memory;
        });

        // Wait for all shared memory data to be processed
        const sharedMemories = await Promise.all(sharedMemoryPromises);
        
        // Add shared memories to the map
        sharedMemories.forEach(memory => {
          allMemoriesMap.set(memory.id, memory);
        });

        // Update memories state with all memories from the map
        const allMemories = Array.from(allMemoriesMap.values());
        setMemories(allMemories.sort((a, b) => {
          const dateA = a.date.toDate().getTime();
          const dateB = b.date.toDate().getTime();
          return dateB - dateA; // descending order (newest first)
        }));
        
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching shared memories:', error);
        setIsLoading(false);
      }
    );

    // Store both unsubscribe functions
    unsubscribeRef.current = () => {
      ownMemoriesUnsubscribe();
      sharedMemoriesUnsubscribe();
    };

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
    const mediaTypes = ['photo', 'video', 'link'];
    if (mediaTypes.includes(memory.type)) {
      // Sort the array the same way we do for the MediaDetailModal
      const sortedMedia = [...allMedia].sort((a, b) => {
        const dateA = a.date.toDate().getTime();
        const dateB = b.date.toDate().getTime();
        return dateA - dateB; // oldest first
      });
      
      // Find the index in the sorted array
      const index = sortedMedia.findIndex(m => m.id === memory.id);
      setMediaDetailIndex(index);
      setIsMediaDetailVisible(true);
    } else {
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

    // Create a map to store all memories by ID to prevent duplicates
    let allMemoriesMap = new Map();

    // Set up real-time listener for user's own memories
    const memoriesRef = collection(db, 'memories');
    const q = query(
      memoriesRef,
      where('userId', '==', user.uid)
    );

    const ownMemoriesUnsubscribe = onSnapshot(q, 
      (snapshot) => {
        snapshot.forEach((doc) => {
          allMemoriesMap.set(doc.id, { id: doc.id, ...doc.data() } as Memory);
        });
        
        // Update memories state with all memories from the map
        const allMemories = Array.from(allMemoriesMap.values());
        setMemories(allMemories.sort((a, b) => {
          const dateA = a.date.toDate().getTime();
          const dateB = b.date.toDate().getTime();
          return dateB - dateA; // descending order (newest first)
        }));
      },
      (error) => {
        console.error('Error fetching own memories:', error);
        setIsLoading(false);
      }
    );

    // Set up real-time listener for shared memories
    const sharedMemoriesRef = collection(db, 'memories');
    const sharedQ = query(
      sharedMemoriesRef,
      where('sharedWith', 'array-contains', user.uid)
    );

    const sharedMemoriesUnsubscribe = onSnapshot(sharedQ,
      async (snapshot) => {
        // Process each shared memory
        const sharedMemoryPromises = snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          const memory = { id: docSnapshot.id, ...data } as Memory;
          
          // If this is a shared memory, get the user info of who shared it
          if (data.userId) {
            try {
              const userDocRef = doc(db, 'users', data.userId);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                const userData = userDoc.data() as DocumentData;
                memory.content = {
                  ...memory.content,
                  sharedBy: {
                    photoURL: userData.photoURL || null,
                    displayName: userData.displayName || null
                  }
                };
              }
            } catch (error) {
              console.error('Error fetching user info for shared memory:', error);
            }
          }
          
          return memory;
        });

        // Wait for all shared memory data to be processed
        const sharedMemories = await Promise.all(sharedMemoryPromises);
        
        // Add shared memories to the map
        sharedMemories.forEach(memory => {
          allMemoriesMap.set(memory.id, memory);
        });

        // Update memories state with all memories from the map
        const allMemories = Array.from(allMemoriesMap.values());
        setMemories(allMemories.sort((a, b) => {
          const dateA = a.date.toDate().getTime();
          const dateB = b.date.toDate().getTime();
          return dateB - dateA; // descending order (newest first)
        }));
        
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching shared memories:', error);
        setIsLoading(false);
      }
    );

    // Store both unsubscribe functions
    unsubscribeRef.current = () => {
      ownMemoriesUnsubscribe();
      sharedMemoriesUnsubscribe();
    };
  };

  const handleContentSizeChange = (width: number, height: number) => {
    setContentHeight(height);
  };

  const handleLayout = (event: any) => {
    setContainerHeight(event.nativeEvent.layout.height);
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

        <FlatList
          ref={flatListRef}
          data={sortedMemories}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContentContainer}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          getItemLayout={getItemLayout}
          initialNumToRender={30} // Render more items initially to ensure content fills the screen
        />

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

        <MediaDetailModal
          visible={isMediaDetailVisible}
          mediaList={allMedia
            // Sort from oldest (index 0) to newest (last index)
            // This makes swiping right show newer content
            .sort((a, b) => {
              const dateA = a.date.toDate().getTime();
              const dateB = b.date.toDate().getTime();
              return dateA - dateB; // oldest first
            })
            .map(m => ({
              id: m.id,
              type: m.type === 'reel' ? 'video' : m.type, // treat 'reel' as 'video'
              content: {
                ...m.content,
                sharedBy: m.content?.sharedBy || null,
                previewImage: m.content?.previewImage || null,
                title: m.content?.title || null,
                url: m.content?.url || null
              },
              isFavorite: m.isFavorite,
              caption: m.content?.caption || '',
              comments: m.content?.comments || [],
              date: m.date,
              sharedWith: m.sharedWith || [],
              userId: m.userId, // Add this field
            }))}
          initialIndex={mediaDetailIndex}
          onClose={() => setIsMediaDetailVisible(false)}
          onFavorite={handleFavorite}
          currentUserId={auth.currentUser?.uid} // Add this prop
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
  gridContentContainer: {
    paddingBottom: 24,
    paddingHorizontal: 8,
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
});

export default MemoryFeed; 