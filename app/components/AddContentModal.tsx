import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db, storage } from '../../constants/Firebase';

interface AddContentModalProps {
  visible: boolean;
  onClose: () => void;
}

type ContentType = 'photo' | 'link';

const AddContentModal: React.FC<AddContentModalProps> = ({ visible, onClose }): React.ReactElement => {
  const [contentType, setContentType] = useState<ContentType>('photo');
  const [media, setMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to access your media library to upload content.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setMedia(result.assets[0]);
        setError(null);
      }
    } catch (err) {
      setError('Failed to pick media. Please try again.');
      console.error('Error picking media:', err);
    }
  };

  const uploadContent = async () => {
    if (contentType === 'photo' && !media) {
      setError('Please select a photo to upload');
      return;
    }
    if (contentType === 'link' && !link) {
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
      if (contentType === 'photo' && media) {
        // Upload photo to Firebase Storage
        console.log('Fetching media from URI:', media.uri);
        const response = await fetch(media.uri);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch media: ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log('Blob created, size:', blob.size);
        
        // Check if file is too large (Firebase has a 5MB limit for free tier)
        if (blob.size > 5 * 1024 * 1024) {
          throw new Error('File size too large. Please select a smaller file (under 5MB).');
        }

        const filename = `content/${user.uid}/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const storageRef = ref(storage, filename);
        
        console.log('Uploading to storage:', filename);
        const metadata = {
          contentType: 'image/jpeg',
        };
        
        const uploadResult = await uploadBytes(storageRef, blob, metadata);
        console.log('Upload complete:', uploadResult);
        
        console.log('Getting download URL');
        const downloadURL = await getDownloadURL(storageRef);
        console.log('Download URL:', downloadURL);

        // Save to Firestore
        console.log('Saving to Firestore');
        const docRef = await addDoc(collection(db, 'memories'), {
          type: 'photo',
          content: {
            uri: downloadURL,
            caption: description
          },
          userId: user.uid,
          date: new Date(),
          isFavorite: false
        });
        console.log('Document written with ID:', docRef.id);
      } else if (contentType === 'link') {
        // Save link to Firestore
        console.log('Saving link to Firestore');
        const docRef = await addDoc(collection(db, 'memories'), {
          type: 'link',
          content: {
            url: link,
            caption: description
          },
          userId: user.uid,
          date: new Date(),
          isFavorite: false
        });
        console.log('Document written with ID:', docRef.id);
      }

      Alert.alert('Success', `${contentType === 'photo' ? 'Photo' : 'Link'} saved successfully!`);
      setMedia(null);
      setLink('');
      setDescription('');
      onClose();
    } catch (error: any) {
      console.error('Error saving content:', error);
      setError(`Failed to save ${contentType}: ${error.message || 'Unknown error'}`);
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
            <Text style={styles.title}>Add Content</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, contentType === 'photo' && styles.typeButtonActive]}
              onPress={() => setContentType('photo')}
            >
              <Ionicons name="image-outline" size={24} color={contentType === 'photo' ? '#fff' : '#666'} />
              <Text style={[styles.typeButtonText, contentType === 'photo' && styles.typeButtonTextActive]}>
                Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, contentType === 'link' && styles.typeButtonActive]}
              onPress={() => setContentType('link')}
            >
              <Ionicons name="link-outline" size={24} color={contentType === 'link' ? '#fff' : '#666'} />
              <Text style={[styles.typeButtonText, contentType === 'link' && styles.typeButtonTextActive]}>
                Link
              </Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {contentType === 'photo' ? (
            <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
              {media ? (
                <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
              ) : (
                <View style={styles.mediaPlaceholder}>
                  <Ionicons name="add-circle-outline" size={40} color="#666" />
                  <Text style={styles.mediaPlaceholderText}>Select Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Enter link URL..."
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              keyboardType="url"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Add a description..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.uploadButton,
              ((contentType === 'photo' && !media) || (contentType === 'link' && !link) || isUploading) &&
                styles.uploadButtonDisabled
            ]}
            onPress={uploadContent}
            disabled={
              (contentType === 'photo' && !media) || (contentType === 'link' && !link) || isUploading
            }
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>
                {contentType === 'photo' ? 'Upload Photo' : 'Save Link'}
              </Text>
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
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
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
  mediaButton: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPlaceholderText: {
    marginTop: 10,
    color: '#666',
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