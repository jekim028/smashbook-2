import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Keyboard,
    Modal,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../constants/Firebase';

const { height, width } = Dimensions.get('window');
const MODAL_HEIGHT = height * 0.7;

// COLORS to match existing theme
const COLORS = {
  accent: '#FF914D',
  text: '#222222',
  secondaryText: '#8E8E93',
  background: '#FFFFFF',
  lightGray: '#F2F2F2',
  separator: '#E5E5E5',
};

// Comment interface
export interface Comment {
  id: string;
  text: string;
  userId: string;
  username: string;
  userPhotoURL?: string | null;
  timestamp: Timestamp;
  likes?: string[];
}

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  mediaId: string;
  comments: Comment[];
  onCommentAdded: (comment: Comment) => void;
  onCommentsUpdated?: (comments: Comment[]) => void;
}

const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  onClose,
  mediaId,
  comments,
  onCommentAdded,
  onCommentsUpdated
}) => {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const inputTranslateY = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  
  // Set up pan responder for drag-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
          // Dismiss keyboard when dragging down
          Keyboard.dismiss();
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > MODAL_HEIGHT / 4) {
          // If dragged down significantly, close the modal
          closeModal();
        } else {
          // Otherwise, snap back to open position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  // Keyboard event listeners
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates.height);
        
        // Animate input bar to slide up above keyboard
        Animated.timing(inputTranslateY, {
          toValue: -event.endCoordinates.height,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        
        // Animate input bar back down
        Animated.timing(inputTranslateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Fetch current user on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setCurrentUser({
              id: user.uid,
              ...userDoc.data()
            });
          }
        } catch (error) {
          console.error('Error fetching current user:', error);
        }
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Open animation when modal becomes visible
  useEffect(() => {
    if (visible) {
      translateY.setValue(MODAL_HEIGHT);
      opacity.setValue(0);
      
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Close the modal with animation
  const closeModal = () => {
    Keyboard.dismiss();
    
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: MODAL_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      setCommentText('');
    });
  };

  // Submit a new comment
  const handleSubmitComment = async () => {
    if (!commentText.trim() || !mediaId || !currentUser) return;
    
    // Dismiss keyboard when submitting
    Keyboard.dismiss();
    
    setIsSubmitting(true);
    try {
      const newCommentId = `comment_${Date.now()}`;
      const newComment: Comment = {
        id: newCommentId,
        text: commentText.trim(),
        userId: auth.currentUser!.uid,
        username: 'julia',
        userPhotoURL: currentUser.photoURL || null,
        timestamp: Timestamp.now(),
        likes: []
      };
      
      // Update Firestore
      const mediaRef = doc(db, 'memories', mediaId);
      
      // First get current comments to ensure we have the latest
      const mediaDoc = await getDoc(mediaRef);
      if (mediaDoc.exists()) {
        const currentComments = mediaDoc.data().comments || [];
        
        // Add the new comment at the beginning (most recent first)
        const updatedComments = [newComment, ...currentComments];
        
        // Update Firestore
        await updateDoc(mediaRef, {
          comments: updatedComments
        });
        
        // Update the parent component with the new comments array
        if (onCommentsUpdated) {
          onCommentsUpdated(updatedComments);
        }
        
        // Clear the input
        setCommentText('');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format timestamp to readable text
  const formatTimestamp = (timestamp: Timestamp) => {
    const now = new Date();
    const commentDate = timestamp.toDate();
    const diffInSeconds = Math.floor((now.getTime() - commentDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h`;
    } else if (diffInSeconds < 604800) {
      return `${Math.floor(diffInSeconds / 86400)}d`;
    } else {
      return commentDate.toLocaleDateString();
    }
  };

  // Render a comment item
  const renderCommentItem = ({ item }: { item: Comment }) => {
    return (
      <View style={styles.commentItem}>
        {/* User Avatar */}
        {item.userPhotoURL ? (
          <Image source={{ uri: item.userPhotoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={16} color={COLORS.secondaryText} />
          </View>
        )}
        
        {/* Comment Content */}
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
          </View>
          
          <Text style={styles.commentText}>{item.text}</Text>
          
          <View style={styles.commentActions}>
            <Text style={styles.likeButton}>Like</Text>
            <Text style={styles.replyButton}>Reply</Text>
          </View>
        </View>
        
        {/* Like Button */}
        <TouchableOpacity style={styles.likeIcon}>
          <Ionicons 
            name="heart-outline" 
            size={18} 
            color={COLORS.secondaryText} 
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeModal}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={closeModal}>
        <Animated.View 
          style={[
            styles.backdrop, 
            { opacity }
          ]} 
        />
      </TouchableWithoutFeedback>
      
      {/* Modal Container */}
      <Animated.View 
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY }],
            paddingBottom: insets.bottom || 20,
          }
        ]}
      >
        {/* Drag Handle */}
        <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments</Text>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={closeModal}
          >
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        {/* Comments List */}
        <FlatList
          data={comments}
          renderItem={renderCommentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.commentsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No comments yet</Text>
              <Text style={styles.emptySubText}>Be the first to comment</Text>
            </View>
          }
        />
        
        {/* Input Bar - Animated to move with keyboard */}
        <Animated.View 
          style={[
            styles.inputContainer,
            { transform: [{ translateY: inputTranslateY }] }
          ]}
        >
          {/* Comment Input */}
          <View style={styles.inputRow}>
            {currentUser?.photoURL ? (
              <Image 
                source={{ uri: currentUser.photoURL }} 
                style={styles.inputAvatar} 
              />
            ) : (
              <View style={styles.inputAvatarPlaceholder}>
                <Ionicons name="person" size={14} color={COLORS.secondaryText} />
              </View>
            )}
            
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={COLORS.secondaryText}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              returnKeyType="send"
              blurOnSubmit={true}
              onSubmitEditing={handleSubmitComment}
            />
            
            {isSubmitting ? (
              <ActivityIndicator 
                size="small" 
                color={COLORS.accent} 
                style={styles.sendButton}
              />
            ) : (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !commentText.trim() && styles.sendButtonDisabled
                ]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim()}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={commentText.trim() ? COLORS.accent : COLORS.secondaryText}
                />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MODAL_HEIGHT,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  dragHandleContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.lightGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
    marginRight: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
    marginBottom: 6,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    fontSize: 12,
    color: COLORS.secondaryText,
    fontWeight: '500',
    marginRight: 16,
  },
  replyButton: {
    fontSize: 12,
    color: COLORS.secondaryText,
    fontWeight: '500',
  },
  likeIcon: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.secondaryText,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.separator,
    backgroundColor: COLORS.background,
    paddingBottom: 8,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  inputAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    color: COLORS.text,
  },
  sendButton: {
    padding: 8,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default CommentsModal; 