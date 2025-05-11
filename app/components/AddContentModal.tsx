import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../constants/Firebase';
import { getLinkMetadata } from '../utils/linkPreview';

interface AddContentModalProps {
  visible: boolean;
  onClose: () => void;
}

const AddContentModal: React.FC<AddContentModalProps> = ({ visible, onClose }): React.ReactElement => {
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadContent = async () => {
    if (!link) {
      setError('Please enter a link');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError('You must be logged in to add content');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Fetch link metadata
      console.log('Fetching link metadata...');
      const metadata = await getLinkMetadata(link);

      // Save link to Firestore with metadata
      console.log('Saving link to Firestore');
      console.log(metadata);
      const docRef = await addDoc(collection(db, 'memories'), {
        type: 'link',
        content: {
          url: link,
          caption: description,
          title: metadata.title,
          description: metadata.description,
          previewImage: metadata.image,
          publisher: metadata.publisher || '',
          previewUrl: metadata.url
        },
        userId: user.uid,
        date: new Date(),
        isFavorite: false,
        sharedWith: [],
      });
      console.log('Document written with ID:', docRef.id);

      Alert.alert('Success', 'Link saved successfully!');
      setLink('');
      setDescription('');
      onClose();
    } catch (error: any) {
      console.error('Error saving link:', error);
      setError(`Failed to save link: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Link</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Enter link URL..."
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            keyboardType="url"
          />

          <TextInput
            style={styles.input}
            placeholder="Add a description..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity
            style={[styles.uploadButton, (!link || isUploading) && styles.uploadButtonDisabled]}
            onPress={uploadContent}
            disabled={!link || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>Save Link</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    minHeight: 50,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default AddContentModal; 