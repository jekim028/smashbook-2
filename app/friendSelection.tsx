import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../constants/Firebase';

interface Friend {
  id: string;
  email: string;
  displayName?: string;
}

export default function FriendSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFriends();
    // Initialize selected friends from params if they exist
    if (params.selectedFriends) {
      setSelectedFriends(JSON.parse(params.selectedFriends as string));
    }
  }, []);

  const loadFriends = async () => {
    const user = auth.currentUser;
    if (!user) return;

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

  const handleDone = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Select Friends</Text>
        <View style={styles.placeholder} />
      </View>

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

      <TouchableOpacity
        style={styles.doneButton}
        onPress={handleDone}
      >
        <Text style={styles.doneButtonText}>
          {selectedFriends.length > 0
            ? `Done (${selectedFriends.length} selected)`
            : 'Done'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    margin: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 