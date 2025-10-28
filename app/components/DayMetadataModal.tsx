import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { shareDayViaSheet } from '../utils/daySharing';

const COLORS = {
  background: '#fdfcf8',
  card: '#FFFFFF',
  text: '#1A3140',
  secondaryText: '#8E8E93',
  accent: '#FF914D',
  error: '#FF3B30',
};

interface DayMetadataModalProps {
  visible: boolean;
  onClose: () => void;
  date: Date;
  onSuccess: () => void;
}

export interface DayMetadata {
  id: string;
  userId: string;
  dateString: string; // Format: YYYY-MM-DD
  title: string;
  caption: string;
  sharedWith: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const DayMetadataModal: React.FC<DayMetadataModalProps> = ({
  visible,
  onClose,
  date,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [existingMetadata, setExistingMetadata] = useState<DayMetadata | null>(null);

  const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

  useEffect(() => {
    if (visible) {
      fetchDayMetadata();
    }
  }, [visible, dateString]);

  const fetchDayMetadata = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsFetching(true);
    try {
      const metadataId = `${user.uid}_${dateString}`;
      const docRef = doc(db, 'dayMetadata', metadataId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as DayMetadata;
        setExistingMetadata(data);
        setTitle(data.title || '');
        setCaption(data.caption || '');
      } else {
        setExistingMetadata(null);
        setTitle('');
        setCaption('');
      }
    } catch (error) {
      console.error('[DayMetadataModal] Error fetching metadata:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsLoading(true);
    try {
      const metadataId = `${user.uid}_${dateString}`;
      const docRef = doc(db, 'dayMetadata', metadataId);

      const data: Partial<DayMetadata> = {
        userId: user.uid,
        dateString,
        title: title.trim(),
        caption: caption.trim(),
        updatedAt: Timestamp.now(),
      };

      if (existingMetadata) {
        // Update existing
        await setDoc(docRef, data, { merge: true });
      } else {
        // Create new
        await setDoc(docRef, {
          ...data,
          sharedWith: [],
          createdAt: Timestamp.now(),
        });
      }

      Alert.alert('Success', 'Day details saved successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('[DayMetadataModal] Error saving metadata:', error);
      Alert.alert('Error', 'Failed to save day details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareDayViaSheet(
        dateString,
        title.trim() || undefined,
        caption.trim() || undefined
      );
    } catch (error) {
      console.error('[DayMetadataModal] Error sharing day:', error);
      Alert.alert('Error', 'Failed to share day. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setCaption('');
    onClose();
  };

  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Day Details</Text>
                  <Text style={styles.dateText}>{formattedDate}</Text>
                </View>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {isFetching ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
              ) : (
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                  {/* Title Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Title</Text>
                    <TextInput
                      style={styles.titleInput}
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Give this day a title..."
                      placeholderTextColor={COLORS.secondaryText}
                      autoCapitalize="sentences"
                    />
                  </View>

                  {/* Caption Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Caption</Text>
                    <TextInput
                      style={styles.captionInput}
                      value={caption}
                      onChangeText={setCaption}
                      placeholder="Add a description or note about this day..."
                      placeholderTextColor={COLORS.secondaryText}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      autoCapitalize="sentences"
                    />
                  </View>

                  {/* Share Section */}
                  <View style={styles.shareSection}>
                    <Text style={styles.label}>Share this Day</Text>
                    <TouchableOpacity
                      style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
                      onPress={handleShare}
                      disabled={isSharing}
                    >
                      {isSharing ? (
                        <>
                          <ActivityIndicator size="small" color={COLORS.accent} />
                          <Text style={[styles.shareButtonText, { marginLeft: 12 }]}>Sharing...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="share-outline" size={20} color={COLORS.accent} />
                          <Text style={styles.shareButtonText}>Share with others</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}

              {/* Save Button */}
              {!isFetching && (
                <TouchableOpacity
                  style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  captionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  shareSection: {
    marginBottom: 20,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.accent,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
});

export default DayMetadataModal;

