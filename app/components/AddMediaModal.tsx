import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { auth, db } from '../../constants/Firebase';

// Colors to match the fish logo theme
const COLORS = {
  background: '#fdfcf8',
  card: '#FFFFFF',
  text: '#1A3140',
  secondaryText: '#8E8E93',
  accent: '#FF914D',
  error: '#FF3B30',
};

interface AddMediaModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Improved image picker options with better quality/size balance
const getImagePickerOptions = (type: 'photo' | 'video'): ImagePicker.ImagePickerOptions => {
  return {
    mediaTypes: type === 'photo' 
      ? ImagePicker.MediaTypeOptions.Images
      : ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: false,
    quality: 0.8, // Higher quality (0.8 instead of 0.5)
    base64: true,
    exif: true,
  };
};

// Helper to create a thumbnail with reasonable quality
const createThumbnail = async (uri: string): Promise<string | undefined> => {
  try {
    // Use expo-image-manipulator in a real implementation
    // For now, we'll just return the original URI
    return uri;
  } catch (error) {
    console.log('Error creating thumbnail:', error);
    return undefined;
  }
};

// Function to safely extract EXIF date from image metadata
const extractExifDate = (exif: any): string | undefined => {
  if (!exif) return undefined;
  
  // Try different EXIF date fields in order of preference
  const dateFields = [
    'DateTimeOriginal',
    'DateTime',
    'DateTimeDigitized',
    'creationTime',
    'modificationTime'
  ];
  
  for (const field of dateFields) {
    if (exif[field]) {
      try {
        return exif[field]; // Just return the first valid date we find
      } catch (e) {
        console.log(`Error parsing EXIF date field ${field}:`, e);
      }
    }
  }
  
  return undefined;
};

interface Friend {
  id: string;
  email: string;
  displayName?: string;
}

const AddMediaModal: React.FC<AddMediaModalProps> = ({ visible, onClose, onSuccess }) => {
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
    base64?: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
    exifDate?: string;
    thumbnail?: string;
  } | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const captionInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isFriendSelection, setIsFriendSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        // Scroll to the caption input when keyboard appears
        if (scrollViewRef.current) {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (visible && isFriendSelection) {
      loadFriends();
    }
  }, [visible, isFriendSelection]);

  const loadFriends = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsLoading(true);
    try {
      console.log('Loading friends for user:', user.uid);
      const friendsRef = collection(db, 'friendships');
      const q = query(friendsRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      console.log('Found friendships:', querySnapshot.docs.length);
      
      const friendsList = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const friendId = docSnapshot.data().friendId;
          console.log('Fetching friend data for ID:', friendId);
          const friendDoc = await getDoc(doc(db, 'users', friendId));
          const friendData = friendDoc.data();
          console.log('Friend data:', friendData);
          return { 
            id: friendId,
            email: friendData?.email || '',
            displayName: friendData?.displayName
          };
        })
      );
      
      console.log('Final friends list:', friendsList);
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const selectMedia = async (type: 'photo' | 'video') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your media library');
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync(getImagePickerOptions(type));
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        const imageWidth = asset.width;
        const imageHeight = asset.height;
        const aspectRatio = imageHeight / imageWidth;
        
        // Extract EXIF date using helper function
        const exifDate = extractExifDate(asset.exif);
        
        if (exifDate) {
          console.log('EXIF date extracted successfully:', exifDate);
        }
        
        // Create a thumbnail for the selected media
        const thumbnailUri = await createThumbnail(asset.uri);
        
        setSelectedMedia({
          uri: asset.uri,
          type: type,
          base64: asset.base64 || undefined,
          width: imageWidth,
          height: imageHeight,
          aspectRatio: aspectRatio,
          exifDate: exifDate,
          thumbnail: thumbnailUri || undefined
        });
        setMediaType(type);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to select media');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your camera');
      return;
    }
    
    try {
      const result = await ImagePicker.launchCameraAsync(getImagePickerOptions('photo'));
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        const imageWidth = asset.width;
        const imageHeight = asset.height;
        const aspectRatio = imageHeight / imageWidth;
        
        // Extract EXIF date using helper function
        const exifDate = extractExifDate(asset.exif);
        
        if (exifDate) {
          console.log('Camera EXIF date extracted successfully:', exifDate);
        }
        
        // Create a thumbnail for the captured photo
        const thumbnailUri = await createThumbnail(asset.uri);
        
        setSelectedMedia({
          uri: asset.uri,
          type: 'photo',
          base64: asset.base64 || undefined,
          width: imageWidth,
          height: imageHeight,
          aspectRatio: aspectRatio,
          exifDate: exifDate,
          thumbnail: thumbnailUri || undefined
        });
        setMediaType('photo');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Simplified file size check
  const checkFileSize = async (uri: string): Promise<void> => {
    if (uri.startsWith('file://')) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          // Just log that we checked, no complex processing
          console.log(`File exists at: ${uri}`);
        }
      } catch (error) {
        console.error('Error checking file:', error);
      }
    }
  };

  const uploadMedia = async () => {
    if (!selectedMedia || !auth.currentUser) {
      Alert.alert('Error', 'No media selected or user not logged in');
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Simple file check
      await checkFileSize(selectedMedia.uri);
      
      // Create the memory document with simpler structure
      const memoryRef = await addDoc(collection(db, 'memories'), {
        userId: auth.currentUser.uid,
        type: selectedMedia.type,
        caption: caption,
        isFavorite: false,
        content: {
          uri: selectedMedia.uri,
          thumbnail: selectedMedia.uri, // Use same URI for thumbnail
          width: selectedMedia.width,
          height: selectedMedia.height,
          aspectRatio: selectedMedia.aspectRatio,
          exifDate: selectedMedia.exifDate
        },
        date: Timestamp.now(),
        createdAt: Timestamp.now(),
        sharedWith: selectedFriends,
      });
      
      console.log('Media uploaded successfully with ID:', memoryRef.id);
      
      // Update with just the memory ID
      await updateDoc(memoryRef, {
        'content.memoryId': memoryRef.id
      });
      
      resetForm();
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
      
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Upload Failed', 'There was an error uploading your media. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedMedia(null);
    setCaption('');
    setSelectedFriends([]);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleCaptionSubmit = () => {
    dismissKeyboard();
  };

  const renderFriendSelection = () => (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setIsFriendSelection(false)}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Select Friends</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.friendItem,
                selectedFriends.includes(item.id) && styles.friendItemSelected
              ]}
              onPress={() => toggleFriendSelection(item.id)}
            >
              <Text style={styles.friendName}>
                {item.displayName || item.email}
              </Text>
              {selectedFriends.includes(item.id) && (
                <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No friends found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => setIsFriendSelection(false)}
      >
        <Text style={styles.doneButtonText}>
          {selectedFriends.length > 0
            ? `Done (${selectedFriends.length} selected)`
            : 'Done'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={() => {
        dismissKeyboard();
        onClose();
      }}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.centeredView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.modalView}>
            {isFriendSelection ? (
              renderFriendSelection()
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Media</Text>
                  <TouchableOpacity 
                    style={styles.closeButton} 
                    onPress={() => {
                      dismissKeyboard();
                      onClose();
                    }}
                  >
                    <Ionicons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  ref={scrollViewRef}
                  style={styles.modalContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {selectedMedia ? (
                    <View style={[
                      styles.mediaPreviewContainer,
                      selectedMedia.aspectRatio ? {
                        height: undefined, 
                        aspectRatio: 1 / selectedMedia.aspectRatio
                      } : null
                    ]}>
                      <Image 
                        source={{ uri: selectedMedia.uri }} 
                        style={styles.mediaPreview} 
                        resizeMode="contain" 
                      />
                      <TouchableOpacity 
                        style={styles.removeMediaButton}
                        onPress={() => setSelectedMedia(null)}
                      >
                        <Ionicons name="close-circle" size={28} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.mediaSelectionContainer}>
                      <TouchableOpacity 
                        style={styles.mediaOption}
                        onPress={() => selectMedia('photo')}
                      >
                        <View style={styles.mediaOptionIcon}>
                          <Ionicons name="images" size={28} color={COLORS.accent} />
                        </View>
                        <Text style={styles.mediaOptionText}>Gallery</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.mediaOption}
                        onPress={takePhoto}
                      >
                        <View style={styles.mediaOptionIcon}>
                          <Ionicons name="camera" size={28} color={COLORS.accent} />
                        </View>
                        <Text style={styles.mediaOptionText}>Camera</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.captionContainer}>
                    <Text style={styles.captionLabel}>Caption</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        ref={captionInputRef}
                        style={styles.captionInput}
                        placeholder="Add a caption..."
                        value={caption}
                        onChangeText={setCaption}
                        multiline
                        numberOfLines={4}
                        maxLength={500}
                        returnKeyType="done"
                        blurOnSubmit={true}
                        onSubmitEditing={handleCaptionSubmit}
                      />
                    </View>
                    <Text style={styles.characterCount}>{caption.length}/500</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.friendSelectionButton}
                    onPress={() => setIsFriendSelection(true)}
                  >
                    <Ionicons name="people-outline" size={20} color={COLORS.accent} />
                    <Text style={styles.friendSelectionButtonText}>
                      {selectedFriends.length > 0
                        ? `${selectedFriends.length} friend${selectedFriends.length === 1 ? '' : 's'} selected`
                        : 'Share with friends'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      styles.uploadButton, 
                      (!selectedMedia || isUploading) && styles.disabledButton
                    ]}
                    onPress={() => {
                      dismissKeyboard();
                      uploadMedia();
                    }}
                    disabled={!selectedMedia || isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.uploadButtonText}>Upload</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.bottomSpacer} />
                </ScrollView>

                {keyboardVisible && Platform.OS === 'ios' && (
                  <View style={styles.keyboardAccessory}>
                    <TouchableOpacity 
                      style={styles.keyboardDoneButton}
                      onPress={dismissKeyboard}
                    >
                      <Text style={styles.keyboardDoneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  mediaSelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  mediaOption: {
    alignItems: 'center',
  },
  mediaOptionIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 8,
  },
  mediaOptionText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  mediaPreviewContainer: {
    position: 'relative',
    width: '100%',
    minHeight: 200,
    maxHeight: 400,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: 'transparent'
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 4,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
  },
  captionContainer: {
    marginBottom: 20,
    width: '100%',
  },
  captionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  captionInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 4,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
  },
  characterCount: {
    fontSize: 12,
    color: COLORS.secondaryText,
    textAlign: 'right',
    marginRight: 4,
  },
  uploadButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.secondaryText,
    opacity: 0.7,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 100, // Add extra space at the bottom for scrolling
  },
  keyboardAccessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f1f1f1',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  keyboardDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  keyboardDoneButtonText: {
    color: COLORS.accent,
    fontWeight: '600',
    fontSize: 16,
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  friendSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 10,
    marginBottom: 20,
  },
  friendSelectionButtonText: {
    color: COLORS.accent,
    marginLeft: 10,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendItemSelected: {
    backgroundColor: 'rgba(255, 145, 77, 0.1)',
  },
  friendName: {
    fontSize: 16,
    color: COLORS.text,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.secondaryText,
  },
  doneButton: {
    backgroundColor: COLORS.accent,
    padding: 16,
    marginTop: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddMediaModal; 