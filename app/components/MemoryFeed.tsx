import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, DocumentData, getDoc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, FlatList, Linking, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../constants/Firebase';
import AddContentModal from './AddContentModal';
import AddMediaModal from './AddMediaModal';
import DayDivider from './DayDivider';
import MediaDetailModal from './MediaDetailModal';
import MemoryCard from './MemoryCard';
import MemoryOptionsModal from './MemoryOptionsModal';

// Helper function to get date string in a consistent format for grouping
const getDateString = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

// Helper function to create a date from date string with proper timezone handling
const createDateFromString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // Set to noon to avoid timezone issues
};

// Define our data structures for feed items
interface Memory {
  id: string;
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link';
  content: any;
  date: Timestamp;
  isFavorite: boolean;
  sharedWith?: string[];
  userId: string;
}

// Group of memories by date
interface MemoryGroup {
  type: 'group';
  date: Date;
  dateString: string;
  memories: Memory[];
  id: string;
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
  divider: '#FF914D', // Divider color (brand orange)
};

const CARD_WIDTH = (Dimensions.get('window').width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.3;

export const MemoryFeed: React.FC = () => {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return today;
  });
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const searchBarWidth = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  const [isAddContentModalVisible, setIsAddContentModalVisible] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [isFanMenuOpen, setIsFanMenuOpen] = useState(false);
  const [isAddMediaModalVisible, setIsAddMediaModalVisible] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isMemoryOptionsModalVisible, setIsMemoryOptionsModalVisible] = useState(false);
  const [isMediaDetailVisible, setIsMediaDetailVisible] = useState(false);
  const [mediaDetailIndex, setMediaDetailIndex] = useState(0);
  
  // State for floating date header
  const [floatingDate, setFloatingDate] = useState<Date | null>(null);
  const floatingDateOpacity = useRef(new Animated.Value(1)).current;

  // For tracking layout completion and loading states
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Getting everything ready...");

  // Array of fun loading messages
  const loadingMessages = [
    "Getting everything ready...",
    "Fishing for memories...",
    "Sorting your special moments...",
    "Washing the dishes...",
    "Polishing your memories...",
    "Finding the perfect spot...",
    "Organizing your treasures...",
    "Preparing your timeline...",
    "Making everything look pretty...",
    "Almost there..."
  ];

  // Helper to flatten all media into a single array for swiping
  const allMedia = memories.filter(m => ['photo', 'video', 'link'].includes(m.type));

  // Group memories by date for our feed
  const memoryGroups = React.useMemo(() => {
    // Group memories by date
    const groups: { [dateKey: string]: Memory[] } = {};
    
    memories.forEach(memory => {
      const dateKey = getDateString(memory.date);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(memory);
    });
    
    // Convert to array of date groups
    return Object.entries(groups).map(([dateString, mems]) => ({
      type: 'group' as const,
      date: createDateFromString(dateString),
      dateString,
      memories: mems.sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime()), // Sort within group
      id: `group-${dateString}`
    })).sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort groups oldest to newest
  }, [memories]);

  // Set initial floating date to the newest date when memory groups change
  useEffect(() => {
    if (memoryGroups.length > 0) {
      // Set the newest date (last item) as the initial floating date
      const newestGroup = memoryGroups[memoryGroups.length - 1];
      setFloatingDate(newestGroup.date);
      console.log("Set initial floating date to", newestGroup.date.toLocaleDateString());
    }
  }, [memoryGroups]);

  // Debug loading states
  useEffect(() => {
    console.log(`Loading state changed: isLoading=${isLoading}, isFullyLoaded=${isFullyLoaded}, hasScrolledToBottom=${hasScrolledToBottom}, groups=${memoryGroups.length}`);
  }, [isLoading, isFullyLoaded, hasScrolledToBottom, memoryGroups.length]);

  // Calculate dimensions
  const numColumns = 2;
  const itemMargin = 6;
  const itemWidth = (screenWidth - (numColumns + 1) * itemMargin * 2) / numColumns;

  // Render a memory item in our grid
  const renderMemoryItem = (memory: Memory, gridIndex: number) => {
    // Calculate height based on content type
    const itemHeight = memory.type === 'photo' && memory.content?.aspectRatio
      ? itemWidth * (memory.content.aspectRatio || 1)
      : itemWidth * 1.3;
    
    return (
      <MemoryCard
        key={memory.id}
        type={memory.type}
        content={memory.content}
        isFavorite={memory.isFavorite}
        onPress={() => handleMemoryPress(memory)}
        onFavorite={() => handleFavorite(memory.id)}
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

  // Render an entire memory group with its divider
  const renderMemoryGroup = ({ item }: { item: MemoryGroup }) => {
    const { memories: groupMemories, date } = item;
    
    // Chunk memories into pairs for the grid
    const rows = [];
    for (let i = 0; i < groupMemories.length; i += numColumns) {
      const rowMemories = groupMemories.slice(i, i + numColumns);
      rows.push(rowMemories);
    }
    
    return (
      <View style={styles.memoryGroup}>
        {/* Add the date divider at the TOP of the group */}
        <DayDivider date={date} width={screenWidth} />
        
        {/* Render the memories in a grid */}
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.memoryRow}>
            {row.map((memory, memIndex) => renderMemoryItem(memory, rowIndex * numColumns + memIndex))}
            {/* Add empty space if the row isn't complete */}
            {row.length < numColumns && Array.from({ length: numColumns - row.length }).map((_, i) => (
              <View key={`empty-${i}`} style={{ width: itemWidth, margin: itemMargin }} />
            ))}
          </View>
        ))}
      </View>
    );
  };

  // Cycle through loading messages
  useEffect(() => {
    if (isLoading) {
      const messageInterval = setInterval(() => {
        setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
      }, 1500);
      
      return () => clearInterval(messageInterval);
    }
  }, [isLoading]);

  // FlatList ref for scrolling
  const flatListRef = useRef<FlatList>(null);
  
  // Scroll to bottom after content has loaded and laid out
  useEffect(() => {
    if (
      !isLoading &&
      !isFullyLoaded &&
      memoryGroups.length > 0
    ) {
      console.log("Setting isFullyLoaded to true directly");
      // Use a short timeout to ensure the state changes are processed
      setTimeout(() => {
        setIsFullyLoaded(true);
      }, 1000);
    }
  }, [isLoading, isFullyLoaded, memoryGroups.length]);

  // Simple force exit loading after a maximum time
  useEffect(() => {
    const forceExitTimer = setTimeout(() => {
      if (!isFullyLoaded) {
        console.log("Force exiting loading screen after timeout");
        setIsFullyLoaded(true);
      }
    }, 5000); // Force exit after 5 seconds no matter what
    
    return () => clearTimeout(forceExitTimer);
  }, []);

  // FlatList viewability config
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 10,
  };

  // Update floating date header based on visible items
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems && viewableItems.length > 0) {
      // Find the topmost visible group by selecting the one with the smallest viewableItem.index
      const topmostItem = viewableItems.reduce((topmost, current) => {
        return (topmost.index < current.index) ? topmost : current;
      });
      
      const dateGroup = topmostItem?.item as MemoryGroup;
      if (dateGroup?.date) {
        // Only update and animate if the date is changing
        if (!floatingDate || 
            floatingDate.getDate() !== dateGroup.date.getDate() || 
            floatingDate.getMonth() !== dateGroup.date.getMonth() || 
            floatingDate.getFullYear() !== dateGroup.date.getFullYear()) {
          
          // Fade out and back in when changing dates
          Animated.sequence([
            Animated.timing(floatingDateOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true
            }),
            Animated.timing(floatingDateOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true
            })
          ]).start();
          
          setFloatingDate(dateGroup.date);
        }
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
        
        // Simply end loading state and set fully loaded to true
        console.log("Memories loaded, ending loading state");
        setTimeout(() => {
          setIsLoading(false);
          setIsFullyLoaded(true); // Directly set to true to exit loading screen
        }, 1500); // Allow time for the animation
      },
      (error) => {
        console.error('Error fetching shared memories:', error);
        setIsLoading(false);
        setIsFullyLoaded(true);
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
  useEffect(() => {
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

  const handleMemoryPress = (memory: Memory) => {
    const mediaTypes = ['photo', 'video', 'link'];
    if (mediaTypes.includes(memory.type)) {
      // Prepare the exact same sorted array as we'll use for the modal
      const mediaItems = memories
        .filter(m => ['photo', 'video', 'link'].includes(m.type))
        .sort((a, b) => {
          const dateA = a.date.toDate().getTime();
          const dateB = b.date.toDate().getTime();
          return dateA - dateB; // oldest to newest
        });
      
      // Find the index of the clicked memory in the sorted array
      const index = mediaItems.findIndex(m => m.id === memory.id);
      
      if (index !== -1) {
        console.log(`Opening MediaDetailModal for memory ${memory.id} at index ${index} of ${mediaItems.length} items`);
        
        // Set the state and then show the modal with a small delay to ensure the state is updated
        setMediaDetailIndex(index);
        setTimeout(() => {
          setIsMediaDetailVisible(true);
        }, 50);
      } else {
        console.error('Memory not found in media list');
      }
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
      // Instead of trying to use section offsets, just scroll to the beginning
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, [memories.length]);

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
    // No need to do anything since Firebase listener will update automatically
  };

  const handleContentSizeChange = (width: number, height: number) => {
    setContentHeight(height);
  };

  const handleLayout = (event: any) => {
    setContainerHeight(event.nativeEvent.layout.height);
  };

  if (isLoading || !isFullyLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <View style={styles.logoContainer}>
            <Ionicons name="fish" size={40} color={COLORS.accent} />
          </View>
          <ActivityIndicator size="large" color={COLORS.accent} style={styles.loadingIndicator} />
          <Text style={styles.loadingText}>{loadingMessage}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Updated Header with floating date */}
        <View style={[
          styles.header, 
          { 
            borderBottomLeftRadius: isSearchExpanded ? 0 : 16,
            borderBottomRightRadius: isSearchExpanded ? 0 : 16 
          }
        ]}>
          <View style={styles.headerLeft}>
            <Text style={styles.logoText}>Smashbook</Text>
            {/* Animated floating date with fade transition */}
            <Animated.Text 
              style={[
                styles.dateText, 
                { 
                  opacity: floatingDateOpacity,
                  transform: [{ translateY: floatingDateOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [5, 0]
                  })}]
                }
              ]}
            >
              {floatingDate?.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              }) || currentDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric'
              })}
            </Animated.Text>
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

        {/* Memory groups with dividers */}
        <FlatList
          ref={flatListRef}
          data={memoryGroups}
          renderItem={renderMemoryGroup}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          maxToRenderPerBatch={5}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          initialNumToRender={5}
          initialScrollIndex={memoryGroups.length > 2 ? Math.max(0, memoryGroups.length - 1) : undefined}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 0
          }}
          // Use getItemLayout for smoother scrolling
          getItemLayout={(data, index) => {
            // Estimate average height for each group
            // This helps FlatList optimize rendering
            const averageHeight = 250; // Adjust based on your typical group size
            return {
              length: averageHeight,
              offset: averageHeight * index,
              index
            };
          }}
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

        {/* All required modals */}
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
          mediaList={memories
            .filter(m => ['photo', 'video', 'link'].includes(m.type))
            .sort((a, b) => {
              const dateA = a.date.toDate().getTime();
              const dateB = b.date.toDate().getTime();
              return dateA - dateB; // oldest first
            })
            .map(m => ({
              id: m.id,
              type: m.type === 'reel' ? 'video' : m.type,
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
              userId: m.userId,
            }))}
          initialIndex={mediaDetailIndex}
          onClose={() => setIsMediaDetailVisible(false)}
          onFavorite={handleFavorite}
          currentUserId={auth.currentUser?.uid}
          onUpdate={(updatedMedia) => {
            // Update the memory in our local state if we can find it
            const memoryToUpdate = memories.find(m => m.id === updatedMedia.id);
            if (memoryToUpdate) {
              // Only update the sharedWith field which is what changes in the modal
              setMemories(prev => 
                prev.map(m => m.id === updatedMedia.id 
                  ? {...m, sharedWith: updatedMedia.sharedWith} 
                  : m
                )
              );
            }
          }}
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
    fontSize: 15,
    color: COLORS.secondaryText,
    fontWeight: '600',
    marginTop: 4,
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
  contentContainer: {
    paddingBottom: 80, // Allow space for the add button
  },
  memoryGroup: {
    marginBottom: 20, // More space between groups
  },
  memoryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginHorizontal: 6, // Use hardcoded value instead of referencing itemMargin
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingContent: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 24,
    paddingHorizontal: 30,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingIndicator: {
    marginBottom: 16,
    height: 50,
    width: 50,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
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
  logoContainer: {
    marginBottom: 20,
    backgroundColor: 'white',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default MemoryFeed; 