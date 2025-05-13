import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../constants/Firebase';
import { getLinkMetadata } from '../utils/linkPreview';

interface AddContentModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Friend {
  id: string;
  email: string;
  displayName?: string;
}

const AddContentModal: React.FC<AddContentModalProps> = ({ visible, onClose }): React.ReactElement => {
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isFriendSelection, setIsFriendSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
        sharedWith: selectedFriends,
      });
      console.log('Document written with ID:', docRef.id);

      Alert.alert('Success', 'Link saved successfully!');
      setLink('');
      setDescription('');
      setSelectedFriends([]);
      onClose();
    } catch (error: any) {
      console.error('Error saving link:', error);
      setError(`Failed to save link: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const renderFriendSelection = () => (
    <View style={styles.modalContent}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setIsFriendSelection(false)}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Select Friends</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
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

  const renderLinkInput = () => (
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
        style={styles.friendSelectionButton}
        onPress={() => setIsFriendSelection(true)}
      >
        <Ionicons name="people-outline" size={20} color="#007AFF" />
        <Text style={styles.friendSelectionButtonText}>
          {selectedFriends.length > 0
            ? `${selectedFriends.length} friend${selectedFriends.length === 1 ? '' : 's'} selected`
            : 'Share with friends'}
        </Text>
      </TouchableOpacity>

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
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {isFriendSelection ? renderFriendSelection() : renderLinkInput()}
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
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
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
  friendSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    marginBottom: 20,
  },
  friendSelectionButtonText: {
    color: '#007AFF',
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
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  friendName: {
    fontSize: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  doneButton: {
    backgroundColor: '#007AFF',
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