import { Ionicons } from '@expo/vector-icons';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { db } from '../../constants/Firebase';

// Colors to match the fish logo theme
const COLORS = {
  background: '#fdfcf8',
  card: '#FFFFFF',
  text: '#1A3140',
  secondaryText: '#8E8E93',
  accent: '#FF914D',
  error: '#FF3B30',
};

interface MemoryOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  memoryId: string;
  currentCaption?: string;
  onSuccess: () => void; // Called after successful deletion or update to refresh the feed
  onDelete?: (memoryId: string) => void; // Called immediately for optimistic deletion
}

const MemoryOptionsModal: React.FC<MemoryOptionsModalProps> = ({ 
  visible, 
  onClose, 
  memoryId, 
  currentCaption = '',
  onSuccess,
  onDelete
}) => {
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [caption, setCaption] = useState(currentCaption);
  const [isLoading, setIsLoading] = useState(false);

  // Log when modal is rendered
  console.log('[MemoryOptionsModal] RENDER - visible:', visible, 'memoryId:', memoryId);

  const handleClose = () => {
    // Reset state when closing
    setIsEditingCaption(false);
    setCaption(currentCaption);
    onClose();
  };

  const handleDelete = () => {
    console.log('[MemoryOptionsModal] handleDelete called for memoryId:', memoryId);
    Alert.alert(
      'Delete Memory',
      'Are you sure you want to delete this memory? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('[MemoryOptionsModal] Delete cancelled'),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('[MemoryOptionsModal] Delete confirmed, calling deleteMemory()');
            deleteMemory();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const deleteMemory = async () => {
    console.log('[MemoryOptionsModal] ========== DELETE STARTED ==========');
    console.log('[MemoryOptionsModal] memoryId:', memoryId);
    console.log('[MemoryOptionsModal] onDelete function exists:', !!onDelete);
    console.log('[MemoryOptionsModal] onSuccess function exists:', !!onSuccess);
    
    if (!memoryId) {
      console.error('[MemoryOptionsModal] ❌ No memoryId provided');
      return;
    }

    // Close modal immediately for instant feedback
    console.log('[MemoryOptionsModal] Step 1: Closing modal...');
    handleClose();
    
    // Optimistically remove from UI immediately
    console.log('[MemoryOptionsModal] Step 2: Calling optimistic delete...');
    if (onDelete) {
      console.log('[MemoryOptionsModal] → Calling onDelete(' + memoryId + ')');
      onDelete(memoryId);
      console.log('[MemoryOptionsModal] → onDelete() returned');
    } else {
      console.warn('[MemoryOptionsModal] ⚠️ onDelete not provided, UI won\'t update optimistically!');
    }
    
    // Delete from Firebase in background
    console.log('[MemoryOptionsModal] Step 3: Starting Firebase deletion...');
    try {
      const memoryRef = doc(db, 'memories', memoryId);
      console.log('[MemoryOptionsModal] → Firebase path:', memoryRef.path);
      await deleteDoc(memoryRef);
      console.log('[MemoryOptionsModal] ✅ Memory deleted successfully from Firebase');
    } catch (error: any) {
      console.error('[MemoryOptionsModal] ❌ Firebase deletion failed:', error);
      console.error('[MemoryOptionsModal] Error code:', error?.code);
      console.error('[MemoryOptionsModal] Error message:', error?.message);
      
      // Only show error if deletion failed
      Alert.alert('Error', `Failed to delete memory: ${error?.message || 'Unknown error'}`);
      
      // Refresh to restore from Firebase if delete failed
      console.log('[MemoryOptionsModal] Calling onSuccess to refresh from Firebase...');
      onSuccess();
    }
    
    console.log('[MemoryOptionsModal] ========== DELETE COMPLETE ==========');
  };

  const saveCaption = async () => {
    if (!memoryId) return;

    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'memories', memoryId), {
        'content.caption': caption
      });
      Alert.alert('Success', 'Caption updated successfully');
      onSuccess(); // Refresh the feed
      handleClose();
    } catch (error) {
      console.error('Error updating caption:', error);
      Alert.alert('Error', 'Failed to update caption. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <Text style={styles.title}>Memory Options</Text>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
              ) : isEditingCaption ? (
                <View style={styles.editContainer}>
                  <Text style={styles.label}>Edit Caption</Text>
                  <TextInput
                    style={styles.captionInput}
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    placeholder="Add a caption..."
                    placeholderTextColor={COLORS.secondaryText}
                    autoFocus
                  />
                  <View style={styles.buttonRow}>
                    <TouchableOpacity 
                      style={[styles.button, styles.cancelButton]} 
                      onPress={() => {
                        setIsEditingCaption(false);
                        setCaption(currentCaption);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.button, styles.saveButton]}
                      onPress={saveCaption}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.optionsContainer}>
                  <TouchableOpacity style={styles.option} onPress={() => setIsEditingCaption(true)}>
                    <Ionicons name="create-outline" size={24} color={COLORS.text} style={styles.optionIcon} />
                    <Text style={styles.optionText}>Edit Caption</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.option} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={24} color={COLORS.error} style={styles.optionIcon} />
                    <Text style={[styles.optionText, styles.deleteText]}>Delete Memory</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  optionsContainer: {
    marginTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionIcon: {
    marginRight: 16,
    width: 24,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  deleteText: {
    color: COLORS.error,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  editContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  captionInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  saveButton: {
    backgroundColor: COLORS.accent,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondaryText,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

export default MemoryOptionsModal; 