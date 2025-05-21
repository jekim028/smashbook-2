import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../constants/Firebase';
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
}) => {
  console.log('MediaDetailModal rendered with:', {
    visible,
    mediaListLength: originalMediaList.length,
    initialIndex
  });

  // Reverse the media list for correct swipe direction - newest to oldest
  const mediaList = [...originalMediaList].reverse();
  
  // Adjust initialIndex to match the reversed list
  const reversedInitialIndex = originalMediaList.length - 1 - initialIndex;
  
  const [currentIndex, setCurrentIndex] = useState(reversedInitialIndex);
  const [comment, setComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comments, setComments] = useState<{[key: string]: {text: string, timestamp: number}[]}>({});
  const flatListRef = useRef<FlatList>(null);
  
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const currentMedia = mediaList[currentIndex];
  const [sharedUsers, setSharedUsers] = useState<{[key: string]: SharedUser[]}>({});
  const [showSharedWithModal, setShowSharedWithModal] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<SharedUser[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  useEffect(() => {
    if (visible && flatListRef.current && mediaList.length > 0) {
      // Small delay to ensure FlatList is ready
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: reversedInitialIndex,
          animated: false,
          viewPosition: 0.5
        });
      }, 100);
    }
  }, [visible, reversedInitialIndex, mediaList]);

  // Add effect to update currentIndex when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(reversedInitialIndex);
    }
  }, [visible, reversedInitialIndex]);

  useEffect(() => {
    // Log the data of the current media for debugging
    if (visible && __DEV__) {
      const currentItem = mediaList[currentIndex];
      if (currentItem) {
        console.log('Current media content in modal:', {
          id: currentItem.id,
          type: currentItem.type,
          content: {
            uri: currentItem.content?.uri,
            title: currentItem.content?.title,
            caption: currentItem.content?.caption
          },
          sharedWith: currentItem.sharedWith
        });
      }
    }
  }, [currentIndex, mediaList, visible]);

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
    if (!currentUserId) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const friendIds = userData.friends || [];
        
        const friendPromises = friendIds.map(async (friendId: string) => {
          const friendDoc = await getDoc(doc(db, 'users', friendId));
          if (friendDoc.exists()) {
            const friendData = friendDoc.data();
            return {
              id: friendId,
              photoURL: friendData.photoURL || null,
              displayName: friendData.displayName || null,
            };
          }
          return null;
        });
        
        const friends = (await Promise.all(friendPromises)).filter(Boolean);
        setAvailableFriends(friends);
      }
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

  // Handle end of scroll - update currentIndex with strict boundary checking
  const handleMomentumScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / width);
    
    // Only update if the index is valid and different
    if (newIndex >= 0 && newIndex < mediaList.length && newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  // Handle failed scroll to index (out of bounds)
  const handleScrollToIndexFailed = (info: {
    index: number;
    highestMeasuredFrameIndex: number;
    averageItemLength: number;
  }) => {
    // If index is out of bounds, just set to the nearest valid index
    const validIndex = Math.min(
      Math.max(0, info.index),
      mediaList.length - 1
    );
    
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({
          animated: false,
          index: validIndex
        });
      }
    }, 100);
  };

  // Handle scroll events to prevent wrapping at edges
  const handleScroll = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    
    // If attempting to scroll beyond the start (negative offset)
    if (offsetX < 0) {
      // Force snap back to the first item
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: true
      });
      return;
    }
    
    // If attempting to scroll beyond the end
    const maxOffset = (mediaList.length - 1) * width;
    if (offsetX > maxOffset) {
      // Force snap back to the last item
      flatListRef.current?.scrollToOffset({
        offset: maxOffset,
        animated: true
      });
      return;
    }
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

  const renderItem = ({ item, index }: { item: MediaItem, index: number }) => {    
    // Get comments for this specific item
    const mediaComments = getCommentsForMedia(item.id);
    
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
                  onPress={toggleCommentInput}
                >
                  <Ionicons name="chatbubble-outline" size={26} color="#222" />
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
            {item.sharedWith && item.sharedWith.length > 0 && (
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
            
            {/* Comments section */}
            <View style={styles.commentSection}>
              {/* Comment input - show when toggled or if there are comments */}
              {(showCommentInput || mediaComments.length > 0) && (
                <View style={styles.commentInputContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment..."
                    value={comment}
                    onChangeText={setComment}
                    onSubmitEditing={handleCommentSubmit}
                    returnKeyType="send"
                    autoFocus={showCommentInput}
                  />
                  <TouchableOpacity 
                    style={[
                      styles.sendButton,
                      comment.trim() ? styles.sendButtonActive : null
                    ]}
                    onPress={handleCommentSubmit}
                    disabled={!comment.trim()}
                  >
                    <Ionicons 
                      name="send" 
                      size={20} 
                      color={comment.trim() ? "#FF914D" : "#CCC"} 
                    />
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Display existing comments if any */}
              {mediaComments.length > 0 && (
                <View style={styles.commentsList}>
                  {mediaComments.map((commentItem, idx) => (
                    <View key={idx} style={styles.commentItem}>
                      <Text style={styles.commentText}>{commentItem.text}</Text>
                      <Text style={styles.commentTimestamp}>
                        {new Date(commentItem.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
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

  // Update the SharedWithModal component
  const SharedWithModal = () => {
    const currentUsers = sharedUsers[currentMedia?.id] || [];
    const isOwner = currentMedia?.userId === currentUserId;
    
    return (
      <Modal
        visible={showSharedWithModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSharedWithModal(false)}
      >
        <View style={styles.sharedWithModalContainer}>
          <View style={[styles.sharedWithModalContent, { paddingBottom: insets.bottom || 20 }]}>
            <View style={styles.sharedWithModalHeader}>
              <Text style={styles.sharedWithModalTitle}>Shared With</Text>
              <TouchableOpacity 
                onPress={() => setShowSharedWithModal(false)}
                style={styles.sharedWithModalCloseButton}
              >
                <Ionicons name="close" size={24} color="#222" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.sharedWithModalList}>
              {isOwner && (
                <View style={styles.friendSelectionContainer}>
                  <Text style={styles.sectionTitle}>Share with Friends</Text>
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
                </View>
              )}
              
              {currentUsers.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Currently Shared With</Text>
                  {currentUsers.map((user) => (
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
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
          data={mediaList} 
          horizontal
          pagingEnabled
          initialScrollIndex={reversedInitialIndex}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={width}
          snapToAlignment="center"
          decelerationRate="fast"
          onScrollToIndexFailed={handleScrollToIndexFailed}
        />
      </View>
      <SharedWithModal />
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
  commentText: {
    fontSize: 15,
    color: '#222',
    lineHeight: 20,
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
  },
  sharedWithModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sharedWithModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  sharedWithModalCloseButton: {
    padding: 8,
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
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
  },
  friendSelectionContainer: {
    padding: 16,
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
});

export default MediaDetailModal; 