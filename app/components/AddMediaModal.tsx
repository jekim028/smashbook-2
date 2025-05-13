import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, Timestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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

const AddMediaModal: React.FC<AddMediaModalProps> = ({ visible, onClose, onSuccess }) => {
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
    base64?: string;
  } | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const captionInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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

  const selectMedia = async (type: 'photo' | 'video') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your media library');
      return;
    }
    
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: type === 'photo' 
          ? ImagePicker.MediaTypeOptions.Images
          : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3, // Lower quality to reduce size
        base64: true,
      };

      const result = await ImagePicker.launchImageLibraryAsync(options);
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedMedia({
          uri: asset.uri,
          type: type,
          base64: asset.base64 || undefined
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
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3, // Lower quality to reduce size
        base64: true,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedMedia({
          uri: asset.uri,
          type: 'photo',
          base64: asset.base64 || undefined
        });
        setMediaType('photo');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadMedia = async () => {
    if (!selectedMedia || !auth.currentUser) {
      Alert.alert('Error', 'No media selected or user not logged in');
      return;
    }

    setIsUploading(true);

    try {
      // Create base64 data URL
      const base64Data = selectedMedia.base64;
      if (!base64Data) {
        throw new Error('No base64 data available');
      }

      // Store image with thumbnail only in Firestore to avoid size limits
      const docRef = await addDoc(collection(db, 'memories'), {
        type: selectedMedia.type === 'photo' ? 'photo' : 'reel',
        date: Timestamp.now(),
        isFavorite: false,
        userId: auth.currentUser.uid,
        createdAt: Timestamp.now(),
        // Create a proper content object with embedded thumbnail
        content: {
          uri: `data:image/jpeg;base64,${base64Data.substring(0, 100)}...`,
          caption: caption,
          hasFullImage: false, // We're not using the fullImageData approach anymore
        }
      });
      
      // Store a thumbnail version only, but with enough quality to display well
      const truncatedBase64 = base64Data.length > 700000 
        ? base64Data.substring(0, 700000) // Limit to ~700KB to stay under Firestore's ~1MB limit
        : base64Data;
        
      // Update the content with a usable thumbnail and memoryId
      await updateDoc(docRef, {
        'content.thumbnail': `data:image/jpeg;base64,${truncatedBase64}`,
        'content.memoryId': docRef.id,
      });

      Alert.alert('Success', 'Media uploaded successfully!');
      resetForm();
      if (onSuccess) onSuccess();
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
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleCaptionSubmit = () => {
    dismissKeyboard();
  };

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
                <View style={styles.mediaPreviewContainer}>
                  <Image 
                    source={{ uri: selectedMedia.uri }} 
                    style={styles.mediaPreview} 
                    resizeMode="cover" 
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
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
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
});

export default AddMediaModal; 