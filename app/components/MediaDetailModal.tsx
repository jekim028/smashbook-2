import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../constants/Firebase';
import CommentsModal, { Comment } from './CommentsModal';
// Temporarily disable image caching
// import { getCachedImageUri, preloadImages } from '../utils/imageCache';

const { width, height } = Dimensions.get('window');

// Add COLORS constant
const COLORS = {
  accent: '#FF914D',
  text: '#222222',
  secondaryText: '#8E8E93',
  background: '#FFFFFF',
};

// Type definitions
interface MediaItem {
  id: string;
  type: 'photo' | 'image' | 'video' | 'link' | string;
  content: {
    uri?: string;
    url?: string;
    thumbnail?: string;
    caption?: string;
    comments?: any[];
    memoryId?: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
    exifDate?: string;
    sharedBy?: {
      photoURL: string | null;
      displayName: string | null;
    };
    previewImage?: string;
    title?: string;
  };
  isFavorite?: boolean;
  caption?: string;
  date?: any;
  comments?: any[];
  createdAt?: any;
  sharedWith?: string[];
  userId?: string;
}

interface MediaDetailModalProps {
  visible: boolean;
  mediaList: MediaItem[];
  initialIndex: number;
  onClose: () => void;
  onFavorite: (id: string) => void;
  currentUserId?: string;
  onUpdate?: (updatedMedia: MediaItem) => void;
}

interface SharedUser {
  id: string;
  photoURL: string | null;
  displayName: string | null;
}

// Temporarily simplify this function to just log rather than actually preload
const preloadImageBatch = async (mediaList: MediaItem[], currentIndex: number, batchSize = 5) => {
  // No-op for now
  console.log(`Would preload ${batchSize} images around index ${currentIndex}`);
};

const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  visible,
  mediaList: originalMediaList,
  initialIndex,
  onClose,
  onFavorite,
  currentUserId,
  onUpdate,
}) => {
  console.log('MediaDetailModal rendered with:', {
    visible,
    mediaListLength: originalMediaList.length,
    initialIndex
  });

  // Use the original media list and index directly - no reversal
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [comment, setComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comments, setComments] = useState<{[key: string]: {text: string, timestamp: number}[]}>({});
  const flatListRef = useRef<FlatList>(null);
  
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const currentMedia = originalMediaList[currentIndex];
  const [sharedUsers, setSharedUsers] = useState<{[key: string]: SharedUser[]}>({});
  const [showSharedWithModal, setShowSharedWithModal] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<SharedUser[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [showFriendSelection, setShowFriendSelection] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  // New state for comments functionality
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [mediaComments, setMediaComments] = useState<{[key: string]: Comment[]}>({});
  const [commentCount, setCommentCount] = useState<{[key: string]: number}>({});

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          // If dragged down more than 50 units, close the modal
          Animated.timing(translateY, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setShowFriendSelection(false);
            setShowSharedWithModal(false);
            translateY.setValue(0);
          });
        } else {
          // If not dragged enough, snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 10,
          }).start();
        }
      },
    })
  ).current;

  // Update the initialization approach to ensure the correct initial rendering
  useEffect(() => {
    // Only run this effect when the modal becomes visible
    if (!visible) return;

    console.log(`Modal visible - target index: ${initialIndex}`);
    
    // Set current index immediately
    setCurrentIndex(initialIndex);
    
    // Give the FlatList time to render before attempting to scroll
    const timer = setTimeout(() => {
      if (flatListRef.current) {
        try {
          console.log(`Scrolling FlatList to index ${initialIndex}`);
          flatListRef.current.scrollToIndex({
            index: initialIndex,
            animated: false,
            viewPosition: 0.5
          });
        } catch (error) {
          console.error("Failed to scroll to index:", error);
          
          // Emergency fallback - try once more after a longer delay
          setTimeout(() => {
            try {
              flatListRef.current?.scrollToIndex({
                index: initialIndex,
                animated: false,
                viewPosition: 0.5
              });
            } catch (e) {
              console.error("Failed final attempt to scroll:", e);
            }
          }, 300);
        }
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [visible, initialIndex]);

  // Add back the friend selection reset effect
  useEffect(() => {
    if (showSharedWithModal) {
      setShowFriendSelection(false);
    }
  }, [showSharedWithModal]);

  // Update debugging log
  useEffect(() => {
    if (visible && __DEV__) {
      const currentItem = originalMediaList[currentIndex];
      if (currentItem) {
        console.log('Current media content in modal:', {
          id: currentItem.id,
          type: currentItem.type,
          index: currentIndex,
          totalItems: originalMediaList.length,
          content: {
            uri: currentItem.content?.uri,
            title: currentItem.content?.title,
            caption: currentItem.content?.caption
          }
        });
      }
    }
  }, [currentIndex, originalMediaList, visible]);

  // Add function to fetch user data
  const fetchUserData = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          id: userId,
          photoURL: userData.photoURL || null,
          displayName: userData.displayName || null
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Add effect to fetch user data when media changes
  useEffect(() => {
    const fetchSharedUsers = async () => {
      if (!currentMedia?.sharedWith) return;

      const newSharedUsers: SharedUser[] = [];
      for (const userId of currentMedia.sharedWith) {
        const userData = await fetchUserData(userId);
        if (userData) {
          newSharedUsers.push(userData);
        }
      }
      
      setSharedUsers(prev => ({
        ...prev,
        [currentMedia.id]: newSharedUsers
      }));
    };

    fetchSharedUsers();
  }, [currentMedia?.id, currentMedia?.sharedWith]);

  // Add function to fetch available friends
  const fetchAvailableFriends = async () => {
    if (!currentUserId || !currentMedia) return;
    
    try {
      // Get current shared users
      const currentSharedWith = currentMedia.sharedWith || [];
      
      // Get user's friends from friendships collection
      const friendsRef = collection(db, 'friendships');
      const q = query(friendsRef, where('userId', '==', currentUserId));
      const querySnapshot = await getDocs(q);
      
      const friendPromises = querySnapshot.docs.map(async (docSnapshot) => {
        const friendId = docSnapshot.data().friendId;
        
        // Skip if friend is already shared with
        if (currentSharedWith.includes(friendId)) {
          return null;
        }
        
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        if (friendDoc.exists()) {
          const friendData = friendDoc.data();
          return {
            id: friendId,
            photoURL: friendData.photoURL || null,
            displayName: friendData.displayName || null,
          } as SharedUser;
        }
        return null;
      });
      
      const friends = (await Promise.all(friendPromises))
        .filter((friend): friend is SharedUser => friend !== null);
      setAvailableFriends(friends);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // Add function to handle sharing with selected friends
  const handleShareWithFriends = async () => {
    if (!currentMedia || !currentUserId) return;
    
    try {
      const memoryRef = doc(db, 'memories', currentMedia.id);
      const currentSharedWith = currentMedia.sharedWith || [];
      const newSharedWith = [...new Set([...currentSharedWith, ...selectedFriends])];
      
      await updateDoc(memoryRef, {
        sharedWith: newSharedWith
      });
      
      // Reset selected friends after sharing
      setSelectedFriends([]);
      
      // Refresh the shared users list
      if (currentMedia.sharedWith) {
        const newSharedUsers: SharedUser[] = [];
        for (const userId of newSharedWith) {
          const userData = await fetchUserData(userId);
          if (userData) {
            newSharedUsers.push(userData);
          }
        }
        setSharedUsers(prev => ({
          ...prev,
          [currentMedia.id]: newSharedUsers
        }));
      }

      // Close both modals
      setShowFriendSelection(false);
      setShowSharedWithModal(false);
    } catch (error) {
      console.error('Error sharing memory:', error);
    }
  };

  // Add effect to fetch friends when modal opens
  useEffect(() => {
    if (visible && currentUserId) {
      fetchAvailableFriends();
    }
  }, [visible, currentUserId]);

  // Change goHome function to simply close the modal instead of navigating
  const goHome = () => {
    // Navigation to 'Home' is causing errors - just use onClose instead
    onClose();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: currentMedia.content.uri || 'Check out this media from Smashbook!',
        url: currentMedia.content.uri,
        title: currentMedia.caption,
      });
    } catch (e) {
      alert('Error sharing: ' + (e as Error).message);
    }
  };

  // Simplify and make the scroll handling more robust
  const handleMomentumScrollEnd = (e: any) => {
    if (!flatListRef.current) return;
    
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.floor(offsetX / width + 0.5); // More accurate calculation
    
    // Ensure index is within bounds
    if (newIndex >= 0 && newIndex < originalMediaList.length) {
      if (newIndex !== currentIndex) {
        console.log(`Scrolled to index ${newIndex}`);
        setCurrentIndex(newIndex);
      }
    } else {
      // If somehow we got an out-of-bounds index, correct it
      const validIndex = Math.min(Math.max(0, newIndex), originalMediaList.length - 1);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: validIndex,
          animated: true
        });
        setCurrentIndex(validIndex);
      }, 100);
    }
  };

  // Prevent scrolling beyond list boundaries with better bounce behavior
  const handleScroll = (e: any) => {
    // Only do heavy correction in extreme cases
    // Most of the time, let the native bounce handle it
    const offsetX = e.nativeEvent.contentOffset.x;
    const velocity = e.nativeEvent.velocity?.x || 0;
    
    // First item - prevent over-scroll
    if (offsetX < 0 && Math.abs(offsetX) > width / 2) {
      console.log("Correcting overscroll at beginning");
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: true
      });
    }
    
    // Last item - prevent over-scroll
    const maxOffset = (originalMediaList.length - 1) * width;
    if (offsetX > maxOffset && offsetX - maxOffset > width / 2) {
      console.log("Correcting overscroll at end");
      flatListRef.current?.scrollToOffset({
        offset: maxOffset,
        animated: true
      });
    }
  };

  // Simplified handler for scroll-to-index failures
  const handleScrollToIndexFailed = (info: {
    index: number;
    highestMeasuredFrameIndex: number;
    averageItemLength: number;
  }) => {
    console.log(`Failed to scroll to index ${info.index}. Attempting recovery...`);
    
    // If index is out of bounds, use a valid index
    const validIndex = Math.min(
      Math.max(0, info.index),
      originalMediaList.length - 1
    );
    
    // Use a longer timeout to ensure rendering is complete
    setTimeout(() => {
      if (flatListRef.current) {
        // First scroll to nearest valid rendered index
        const nearestRenderedIndex = Math.min(validIndex, info.highestMeasuredFrameIndex);
        
        flatListRef.current.scrollToIndex({
          animated: false,
          index: nearestRenderedIndex
        });
        
        // Then after a short delay, try scrolling to the actual target index
        if (nearestRenderedIndex !== validIndex) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              animated: true,
              index: validIndex
            });
          }, 150);
        }
        
        // Update currentIndex regardless
        setCurrentIndex(validIndex);
      }
    }, 100);
  };

  // Handle comment submission
  const handleCommentSubmit = () => {
    if (!comment.trim()) return;
    
    const mediaId = currentMedia.id;
    const newComment = {
      text: comment.trim(),
      timestamp: Date.now()
    };
    
    // Add comment to local state
    setComments(prevComments => {
      const mediaComments = prevComments[mediaId] || [];
      return {
        ...prevComments,
        [mediaId]: [...mediaComments, newComment]
      };
    });
    
    // Clear the comment input
    setComment('');
    
    // Log for debugging
    console.log(`Added comment: "${comment}" for media ${mediaId}`);
  };
  
  // Toggle comment input visibility
  const toggleCommentInput = () => {
    setShowCommentInput(prev => !prev);
  };
  
  // Get comments for a media item
  const getCommentsForMedia = (mediaId: string) => {
    return comments[mediaId] || [];
  };

  // Add function to handle unsharing with a friend
  const handleUnshare = async (friendId: string, friendName: string) => {
    if (!currentMedia || !currentUserId) return;
    
    // Show confirmation alert
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${friendName || 'this user'} from this memory?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const memoryRef = doc(db, 'memories', currentMedia.id);
              const currentSharedWith = currentMedia.sharedWith || [];
              const newSharedWith = currentSharedWith.filter(id => id !== friendId);
              
              await updateDoc(memoryRef, {
                sharedWith: newSharedWith
              });
              
              // Create updated media item
              const updatedMedia = {
                ...currentMedia,
                sharedWith: newSharedWith
              };

              // Update local states
              setSharedUsers(prev => ({
                ...prev,
                [currentMedia.id]: prev[currentMedia.id]?.filter(user => user.id !== friendId) || []
              }));

              // Update the mediaList item
              const currentIndex = originalMediaList.findIndex(item => item.id === currentMedia.id);
              if (currentIndex !== -1) {
                originalMediaList[currentIndex] = updatedMedia;
              }

              // Notify parent component of the update
              if (onUpdate) {
                onUpdate(updatedMedia);
              }

            } catch (error) {
              console.error('Error unsharing memory:', error);
            }
          }
        }
      ]
    );
  };

  // Fetch comments when media changes
  useEffect(() => {
    if (!visible || !currentMedia?.id) return;
    
    const fetchComments = async () => {
      try {
        const mediaRef = doc(db, 'memories', currentMedia.id);
        const mediaDoc = await getDoc(mediaRef);
        
        if (mediaDoc.exists()) {
          const data = mediaDoc.data();
          if (data.comments) {
            setMediaComments(prev => ({
              ...prev,
              [currentMedia.id]: data.comments
            }));
            setCommentCount(prev => ({
              ...prev,
              [currentMedia.id]: data.comments.length
            }));
          } else {
            // Initialize with empty array if no comments exist
            setMediaComments(prev => ({
              ...prev,
              [currentMedia.id]: []
            }));
            setCommentCount(prev => ({
              ...prev,
              [currentMedia.id]: 0
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    };
    
    fetchComments();
  }, [visible, currentMedia?.id]);
  
  // Toggle comment modal
  const toggleCommentsModal = () => {
    setShowCommentsModal(!showCommentsModal);
  };
  
  // Handle new comment added
  const handleCommentAdded = (newComment: Comment) => {
    if (!currentMedia?.id) return;
    
    // Optimistically update UI
    setMediaComments(prev => {
      const currentComments = prev[currentMedia.id] || [];
      const updatedComments = [newComment, ...currentComments];
      
      return {
        ...prev,
        [currentMedia.id]: updatedComments
      };
    });
    
    // Update comment count
    setCommentCount(prev => ({
      ...prev,
      [currentMedia.id]: (prev[currentMedia.id] || 0) + 1
    }));
  };
  
  // Get comments for the current media
  const getCurrentMediaComments = () => {
    return currentMedia?.id ? (mediaComments[currentMedia.id] || []) : [];
  };
  
  // Get comment count for specific media
  const getCommentCountForMedia = (mediaId: string) => {
    return commentCount[mediaId] || 0;
  };

  const renderItem = ({ item, index }: { item: MediaItem, index: number }) => {    
    // Get comments for this specific item
    const itemComments = mediaComments[item.id] || [];
    const count = getCommentCountForMedia(item.id);
    
    return (
      <View style={styles.mediaItemContainer}>
        <ScrollView 
          style={styles.mediaScrollContainer}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Media Content (Photo, Video, etc.) */}
          {renderMedia(item)}
          
          {/* Controls directly below media */}
          <View style={styles.controlsContainer}>
            {/* Action row with original layout */}
            <View style={styles.actionRow}>
              <Text style={styles.dateText}>
                {getDisplayDate(item)}
              </Text>
              <View style={styles.iconRow}>
                <TouchableOpacity
                  onPress={() => onFavorite(item.id)}
                  style={styles.iconButton}
                >
                  <Ionicons
                    name={item.isFavorite ? 'heart' : 'heart-outline'}
                    size={28}
                    color="#FFCC4D"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  style={styles.iconButton}
                >
                  <Ionicons name="share-outline" size={26} color="#222" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={toggleCommentsModal}
                >
                  <View style={styles.commentIconContainer}>
                    <Ionicons name="chatbubble-outline" size={26} color="#222" />
                    {count > 0 && (
                      <Text style={styles.commentCount}>{count}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Shared by section */}
            {item.content?.sharedBy && (
              <View style={styles.sharedByContainer}>
                {item.content.sharedBy.photoURL ? (
                  <Image 
                    source={{ uri: item.content.sharedBy.photoURL }} 
                    style={styles.sharedByImage}
                  />
                ) : (
                  <View style={styles.sharedByPlaceholder}>
                    <Ionicons name="person" size={16} color="#8E8E93" />
                  </View>
                )}
                <Text style={styles.sharedByText}>
                  From {item.content.sharedBy.displayName || 'Someone'}
                </Text>
              </View>
            )}

            {/* Update Shared With section */}
            {((item.sharedWith && item.sharedWith.length > 0) || item.userId === currentUserId) && (
              <TouchableOpacity 
                onPress={() => setShowSharedWithModal(true)}
                style={styles.sharedWithList}
              >
                {sharedUsers[item.id]?.map((user, index) => (
                  <View 
                    key={user.id} 
                    style={[
                      styles.sharedWithAvatar,
                      { marginLeft: index > 0 ? -16 : 0 }
                    ]}
                  >
                    {user.photoURL ? (
                      <Image 
                        source={{ uri: user.photoURL }} 
                        style={styles.sharedWithAvatarInner}
                      />
                    ) : (
                      <View style={styles.sharedWithAvatarInner}>
                        <Ionicons name="person" size={20} color="#8E8E93" />
                      </View>
                    )}
                  </View>
                ))}
                {item.userId === currentUserId && (
                  <TouchableOpacity 
                    style={[
                      styles.sharedWithAvatar,
                      styles.addShareButton,
                      { marginLeft: sharedUsers[item.id]?.length > 0 ? -16 : 0 }
                    ]}
                    onPress={() => setShowSharedWithModal(true)}
                  >
                    <Ionicons name="add" size={24} color={COLORS.accent} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}

            {/* Caption - ensure it's visible when present */}
            {(item.caption || item.content?.caption) && (
              <Text style={styles.caption}>
                {item.caption || item.content?.caption}
              </Text>
            )}
            
            {/* Comments preview */}
            {itemComments.length > 0 && (
              <View style={styles.commentsPreviewContainer}>
                {/* Show up to 2 most recent comments */}
                {itemComments.slice(0, 2).map((comment, idx) => (
                  <View key={comment.id} style={styles.previewCommentItem}>
                    <Text style={styles.previewCommentText}>
                      <Text style={styles.previewUsername}>{comment.username}</Text>{' '}
                      {comment.text}
                    </Text>
                  </View>
                ))}
                
                {/* "View all comments" link if there are more than 2 comments */}
                {itemComments.length > 2 && (
                  <TouchableOpacity onPress={toggleCommentsModal}>
                    <Text style={styles.viewAllCommentsLink}>
                      View all {itemComments.length} comments
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Completely simplified renderMedia function
  const renderMedia = (item: MediaItem) => {

    // Get image URI - focus on thumbnail first, then fall back to uri
    const imageUri = item.content?.thumbnail || item.content?.uri || '';
    
    if (item.type === 'photo' || item.type === 'image') {
      if (imageUri) {
        return (
          <TouchableOpacity 
            onPress={() => item.content?.url && Linking.openURL(item.content.url)}
            activeOpacity={0.9}
          >
            <View style={{
              width: width,
              height: width,
              backgroundColor: '#fff',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: width * 0.9,
                  height: width * 0.9,
                  backgroundColor: 'transparent'
                }}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        );
      }
    }
    
    if (item.type === 'link') {
      return (
        <TouchableOpacity 
          onPress={() => item.content?.url && Linking.openURL(item.content.url)}
          activeOpacity={0.9}
        >
          <View style={{
            width: width,
            height: width,
            backgroundColor: '#fff',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16
          }}>
            {item.content?.previewImage ? (
              <Image
                source={{ uri: item.content.previewImage }}
                style={{
                  width: width * 0.9,
                  height: width * 0.6,
                  borderRadius: 12,
                  marginBottom: 16
                }}
                resizeMode="cover"
              />
            ) : (
              <View style={{
                width: width * 0.9,
                height: width * 0.6,
                backgroundColor: '#f8f8f8',
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16
              }}>
                <Ionicons name="link-outline" size={48} color="#ddd" />
              </View>
            )}
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#222',
              marginBottom: 8,
              textAlign: 'center'
            }}>
              {item.content?.title || 'Link'}
            </Text>
            <Text style={{
              fontSize: 14,
              color: '#666',
              textAlign: 'center'
            }}>
              {item.content?.url}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    if (item.type === 'video') {
      return (
        <TouchableOpacity 
          onPress={() => item.content?.url && Linking.openURL(item.content.url)}
          activeOpacity={0.9}
        >
          <View style={{
            width: width,
            height: width,
            backgroundColor: '#fff',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Ionicons name="videocam" size={80} color="#ddd" />
            <Text style={{ marginTop: 12, color: '#888' }}>Video Content</Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    // Default fallback
    return (
      <TouchableOpacity 
        onPress={() => item.content?.url && Linking.openURL(item.content.url)}
        activeOpacity={0.9}
      >
        <View style={{
          width: width,
          height: width,
          backgroundColor: '#fff',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Ionicons name="document-outline" size={80} color="#ddd" />
          <Text style={{ marginTop: 12, color: '#888' }}>{item.type} Content</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Function to get the most accurate date for display
  const getDisplayDate = (item: MediaItem) => {
    // Try to use EXIF date if available
    if (item.content.exifDate) {
      try {
        // EXIF dates are usually in format: "YYYY:MM:DD HH:MM:SS"
        // We need to convert to a proper date format
        const exifDateStr = item.content.exifDate.replace(/:/g, '-').replace(/-/g, '/');
        const parsedDate = new Date(exifDateStr);
        
        // Check if the parsed date is valid
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch (e) {
        console.log('Error parsing EXIF date in display:', e);
        // Fall through to next date option
      }
    }
    
    // Use Firestore timestamp from date field
    if (item.date) {
      try {
        // Handle Firestore Timestamp
        if (typeof item.date === 'object' && item.date.toDate) {
          return item.date.toDate().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
        }
        
        // Handle regular Date or string
        const date = new Date(item.date);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch (e) {
        console.log('Error parsing date field:', e);
        // Fall through to next date option
      }
    }
    
    // Fallback - check for createdAt field
    if (item.createdAt) {
      try {
        // Handle Firestore Timestamp
        if (typeof item.createdAt === 'object' && item.createdAt.toDate) {
          return item.createdAt.toDate().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
        }
        
        // Handle regular Date or string
        const date = new Date(item.createdAt);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch (e) {
        console.log('Error parsing createdAt field:', e);
      }
    }
    
    return 'No date available';
  };

  const renderFriendSelection = () => (
    <View style={styles.modalContent}>
      <View style={styles.sharedWithModalHeader}>
        <View style={styles.modalHandle} />
        <View style={styles.headerTitleRow}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowFriendSelection(false)}
          >
            <Ionicons name="arrow-back" size={24} color="#222" />
          </TouchableOpacity>
          <Text style={styles.sharedWithModalTitle}>Select Friends</Text>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowSharedWithModal(false)}
          >
            <Ionicons name="close" size={24} color="#222" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.sharedWithModalList}>
        <View style={styles.friendsList}>
          {availableFriends.map((friend) => (
            <TouchableOpacity
              key={friend.id}
              style={[
                styles.friendItem,
                selectedFriends.includes(friend.id) && styles.selectedFriend
              ]}
              onPress={() => {
                setSelectedFriends(prev => 
                  prev.includes(friend.id)
                    ? prev.filter(id => id !== friend.id)
                    : [...prev, friend.id]
                );
              }}
            >
              {friend.photoURL ? (
                <Image 
                  source={{ uri: friend.photoURL }} 
                  style={styles.friendAvatar}
                />
              ) : (
                <View style={styles.friendAvatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#8E8E93" />
                </View>
              )}
              <Text style={styles.friendName}>
                {friend.displayName || 'Unknown User'}
              </Text>
              {selectedFriends.includes(friend.id) && (
                <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        {selectedFriends.length > 0 && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareWithFriends}
          >
            <Text style={styles.shareButtonText}>
              Share with Selected Friends
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  const renderSharedWithList = () => {
    const currentUsers = sharedUsers[currentMedia?.id] || [];
    const isOwner = currentMedia?.userId === currentUserId;
    
    return (
      <View style={styles.modalContent}>
        <View style={styles.sharedWithModalHeader}>
          <View style={styles.modalHandle} />
          <View style={styles.headerTitleRow}>
            <View style={styles.headerButton} />
            <Text style={styles.sharedWithModalTitle}>Shared With</Text>
            {isOwner ? (
              <TouchableOpacity 
                onPress={() => setShowFriendSelection(true)}
                style={styles.headerButton}
              >
                <Ionicons name="person-add-outline" size={24} color={COLORS.accent} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerButton} />
            )}
          </View>
        </View>
        
        <ScrollView style={styles.sharedWithModalList}>
          {currentUsers.length > 0 ? (
            currentUsers.map((user) => (
              <View key={user.id} style={styles.sharedWithModalItem}>
                {user.photoURL ? (
                  <Image 
                    source={{ uri: user.photoURL }} 
                    style={styles.sharedWithModalAvatar}
                  />
                ) : (
                  <View style={styles.sharedWithModalAvatarPlaceholder}>
                    <Ionicons name="person" size={20} color="#8E8E93" />
                  </View>
                )}
                <Text style={styles.sharedWithModalName}>
                  {user.displayName || 'Unknown User'}
                </Text>
                {isOwner && (
                  <TouchableOpacity
                    style={styles.unshareButton}
                    onPress={() => handleUnshare(user.id, user.displayName || 'Unknown User')}
                  >
                    <Ionicons name="close" size={24} color="#222" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noSharedUsersText}>
              {isOwner ? 'Share this memory with your friends!' : 'No users to display'}
            </Text>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Back button */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 10, left: 20 }]}
          onPress={goHome}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>

        {/* Main media carousel with itemized controls */}
        <FlatList
          ref={flatListRef}
          data={originalMediaList} 
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(data, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={handleScroll}
          scrollEventThrottle={32}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={width}
          snapToAlignment="center"
          decelerationRate={0.992}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          bounces={true}
          bouncesZoom={true}
          alwaysBounceHorizontal={true}
          removeClippedSubviews={false}
          windowSize={3}
          maxToRenderPerBatch={3}
          initialNumToRender={3}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10
          }}
        />
      </View>

      {/* Comments Modal */}
      {currentMedia && (
        <CommentsModal 
          visible={showCommentsModal}
          onClose={() => setShowCommentsModal(false)}
          mediaId={currentMedia.id}
          comments={getCurrentMediaComments()}
          onCommentAdded={handleCommentAdded}
          onCommentsUpdated={(updatedComments) => {
            if (!currentMedia?.id) return;
            setMediaComments(prev => ({
              ...prev,
              [currentMedia.id]: updatedComments
            }));
            setCommentCount(prev => ({
              ...prev,
              [currentMedia.id]: updatedComments.length
            }));
          }}
        />
      )}
      
      <Modal
        visible={showSharedWithModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowFriendSelection(false);
          setShowSharedWithModal(false);
        }}
      >
        <TouchableOpacity 
          style={styles.sharedWithModalContainer} 
          activeOpacity={1}
          onPress={() => {
            setShowFriendSelection(false);
            setShowSharedWithModal(false);
          }}
        >
          <View 
            style={[styles.sharedWithModalContent, { paddingBottom: insets.bottom || 20 }]}
          >
            <View style={styles.modalContent}>
              {showFriendSelection ? renderFriendSelection() : renderSharedWithList()}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 22,
    padding: 10,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mediaItemContainer: {
    width: width,
    height: '100%',
    backgroundColor: '#fff',
  },
  mediaScrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mediaContentContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  controlsContainer: {
    width: '100%',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconButton: {
    marginLeft: 16,
    padding: 4,
  },
  caption: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 12,
    color: '#222',
    lineHeight: 22,
  },
  commentSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  commentInput: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    marginRight: 8,
    fontSize: 15,
  },
  sendButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
  },
  commentItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  noComments: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    padding: 16,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
  },
  commentText: {
    fontSize: 15,
    color: '#222',
    lineHeight: 20,
  },
  commentsList: {
    marginTop: 16,
    padding: 16,
  },
  commentTimestamp: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: '#FF914D',
  },
  sharedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 12,
  },
  sharedByImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  sharedByPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  sharedByText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '400',
  },
  sharedWithList: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  sharedWithAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sharedWithAvatarInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sharedWithModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sharedWithModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: height * 0.5,
    maxHeight: height * 0.7,
    overflow: 'hidden',
  },
  sharedWithModalHeader: {
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitleRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 16,
  },
  sharedWithModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    flex: 1,
    textAlign: 'center',
  },
  sharedWithModalShareButton: {
    padding: 8,
  },
  noSharedUsersText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 16,
    marginTop: 24,
  },
  sharedWithModalList: {
    padding: 16,
  },
  sharedWithModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sharedWithModalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  sharedWithModalAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  sharedWithModalName: {
    flex: 1,
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
  },
  friendSelectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
  },
  friendsList: {
    marginBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
  },
  selectedFriend: {
    backgroundColor: '#FFF0E6',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  friendAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendName: {
    flex: 1,
    fontSize: 16,
    color: '#222',
  },
  shareButton: {
    backgroundColor: COLORS.accent,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addShareButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderStyle: 'dashed',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  unshareButton: {
    padding: 8,
  },
  friendSelectionBackButton: {
    position: 'absolute',
    left: 16,
    top: 40,
    padding: 8,
  },
  commentIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentCount: {
    fontSize: 12,
    color: COLORS.text,
    marginLeft: 4,
    fontWeight: '500',
  },
  commentsPreviewContainer: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  previewCommentItem: {
    marginBottom: 6,
  },
  previewCommentText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 18,
  },
  previewUsername: {
    fontWeight: '600',
  },
  viewAllCommentsLink: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 4,
  },
});

export default MediaDetailModal; 