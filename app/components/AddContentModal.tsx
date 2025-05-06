import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { addDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db, storage } from '../../constants/Firebase';

interface AddContentModalProps {
  visible: boolean;
  onClose: () => void;
}

const AddContentModal: React.FC<AddContentModalProps> = ({ visible, onClose }): React.ReactElement => {
  const [media, setMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setMedia(result.assets[0]);
    }
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    setLocation(location);
  };

  const uploadContent = async () => {
    if (!media) return;

    setIsUploading(true);
    try {
      // Upload media to Firebase Storage
      const response = await fetch(media.uri);
      const blob = await response.blob();
      const filename = `content/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      // Save metadata to Firestore
      await addDoc(collection(db, 'memories'), {
        type: media.type === 'image' ? 'photo' : 'video',
        content: {
          uri: downloadURL,
          caption: description
        },
        location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        } : null,
        date: new Date(),
        isFavorite: false
      });

      onClose();
    } catch (error) {
      console.error('Error uploading content:', error);
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

          <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
            {media ? (
              <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="add-circle-outline" size={40} color="#666" />
                <Text style={styles.mediaPlaceholderText}>Select Media</Text>
              </View>
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Add a description..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity style={styles.locationButton} onPress={getLocation}>
            <Ionicons name="location-outline" size={24} color="#666" />
            <Text style={styles.locationButtonText}>
              {location ? 'Location Added' : 'Add Location'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadButton, (!media || isUploading) && styles.uploadButtonDisabled]}
            onPress={uploadContent}
            disabled={!media || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>Upload</Text>
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginBottom: 20,
  },
  locationButtonText: {
    marginLeft: 10,
    color: '#666',
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