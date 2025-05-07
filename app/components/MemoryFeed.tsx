import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { ActivityIndicator, Animated, Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MemoryCard from './MemoryCard';
import { WebView } from 'react-native-webview';

interface Memory {
  id: string;
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link' | 'instagram';
  content: any;
  date: Date;
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
            case 'instagram':
              // Alternate between a post and a reel
              const isReel = Math.random() > 0.5;
              content = {
                uri: isReel 
                  ? 'https://www.instagram.com/reel/C5xRgKSPzZI/' 
                  : 'https://www.instagram.com/p/C5tZy9RM1vQ/',
                title: isReel ? 'Instagram Reel' : 'Instagram Photo',
                type: isReel ? 'video' : 'photo'
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
        date: new Date(date),
        isFavorite: Math.random() > 0.7
      });
    }
  }
  // Add hardcoded Instagram reel memory
memories.unshift({
  id: 'reel-custom',
  type: 'instagram',
  content: {
    uri: 'https://www.instagram.com/reel/DItkhvdIOQh/?igsh=NTc4MTIwNjQ2YQ%3D%3D',
    title: 'My Instagram Reel',
    type: 'video',
  },
  date: new Date(),
  isFavorite: true,
});

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
  favorite: '#FF2D55',
  favoriteBackground: 'rgba(255, 45, 85, 0.1)',
};

const MemoryFeed: React.FC = () => {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<'day' | 'month'>('day');
  const [memories, setMemories] = React.useState<Memory[]>(generateSampleMemories());
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const searchBarWidth = React.useRef(new Animated.Value(0)).current;
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { height: screenHeight } = Dimensions.get('window');
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);


  // Group memories by date and sort them
  const filteredMemoriesByDate = React.useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase().trim();
  
    let filtered = memories;
  
    if (showFavoritesOnly) {
      filtered = filtered.filter(m => m.isFavorite);
    }
  
    if (searchQuery !== '') {
      filtered = filtered.filter((memory) => {
        const searchableContent = JSON.stringify(memory.content).toLowerCase();
        return searchableContent.includes(lowerQuery);
      });
    }
  
    // Sort by date (newest first)
    filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
  
    const grouped: { [key: string]: Memory[] } = {};
    filtered.forEach(memory => {
      const dateKey = memory.date.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(memory);
    });
  
    return grouped;
  }, [memories, searchQuery, showFavoritesOnly]);
    
    // Sort the dates in reverse chronological order (newest first)
    
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
    const offsetY = event.nativeEvent.contentOffset.y;
    const dateIndex = Math.floor(offsetY / screenHeight);
    const newDate = new Date();
    newDate.setDate(newDate.getDate() - dateIndex);
    setCurrentDate(newDate);
  };

  const loadMoreContent = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const oldestDate = new Date(Math.min(...memories.map(m => m.date.getTime())));
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
          date: new Date(date),
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
    console.log('Memory pressed:', memory);
  };

  const handleFavorite = (memoryId: string) => {
    setMemories(memories.map(memory => 
      memory.id === memoryId 
        ? { ...memory, isFavorite: !memory.isFavorite }
        : memory
    ));
  };

  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  // Scroll to today's content when component mounts
  React.useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

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
            <TouchableOpacity 
  style={styles.headerButton}
  onPress={() => setShowFavoritesOnly(prev => !prev)}
>
  <Ionicons 
    name={showFavoritesOnly ? 'heart' : 'heart-outline'} 
    size={24} 
    color={showFavoritesOnly ? COLORS.favorite : COLORS.text} 
  />
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
          {Object.entries(filteredMemoriesByDate).map(([dateKey, dayMemories]) => (
            <View
            key={dateKey}
            style={[
              styles.dayContainer,
              searchQuery === '' && !showFavoritesOnly ? { minHeight: screenHeight } : null
            ]}
          >               
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
          ))}
          
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
          )}
        </ScrollView>

        {/* Scroll to Today Button */}
        <TouchableOpacity 
          style={styles.scrollToTodayButton}
          onPress={scrollToToday}
        >
          <Ionicons name="today-outline" size={24} color={COLORS.card} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  webview: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
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
  gridContainer: {
    flex: 1,
  },
  dayContainer: {
    paddingBottom: 20,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  dateHeaderText: {
    fontSize: 17,
    fontFamily: 'System',
    fontWeight: '600',
    color: COLORS.secondaryText,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  scrollToTodayButton: {
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
});

export default MemoryFeed; 