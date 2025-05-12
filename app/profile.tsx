import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../constants/Firebase';

const COLORS = {
  background: '#F8F8F8',
  card: '#FFFFFF',
  text: '#2C2C2E',
  secondaryText: '#8E8E93',
  accent: '#007AFF',
  shadow: 'rgba(0, 0, 0, 0.08)',
};

interface User {
  id: string;
  email: string;
  displayName?: string;
}

interface UserData {
  email: string;
  displayName?: string;
}

export default function Profile() {
  const router = useRouter();
  const user = auth.currentUser;
  const [friends, setFriends] = useState<User[]>([]);
  const [newFriendEmail, setNewFriendEmail] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  useEffect(() => {
    ensureUserDocument();
    loadFriends();
  }, []);

  const ensureUserDocument = async () => {
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Create user document if it doesn't exist
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          displayName: user.displayName || '',
          createdAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error ensuring user document:', error);
    }
  };

  const loadFriends = async () => {
    if (!user) return;
    
    try {
      const friendsRef = collection(db, 'friendships');
      const q = query(friendsRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const friendsList = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const friendId = docSnapshot.data().friendId;
          const friendDoc = await getDoc(doc(db, 'users', friendId));
          const friendData = friendDoc.data() as UserData;
          return { 
            id: friendId,
            email: friendData?.email || '',
            displayName: friendData?.displayName
          };
        })
      );
      
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const addFriendByEmail = async () => {
    if (!user || !newFriendEmail.trim()) return;

    try {
      // First, find the user with the given email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', newFriendEmail.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('Error', 'No user found with this email address');
        return;
      }

      const friendDoc = querySnapshot.docs[0];
      const friendId = friendDoc.id;

      // Check if friendship already exists in either direction
      const friendsRef = collection(db, 'friendships');
      const existingFriendshipQuery = query(
        friendsRef,
        where('userId', 'in', [user.uid, friendId]),
        where('friendId', 'in', [user.uid, friendId])
      );
      const existingFriendship = await getDocs(existingFriendshipQuery);

      if (!existingFriendship.empty) {
        Alert.alert('Error', 'You are already friends with this user');
        return;
      }

      // Create bidirectional friendships
      const batch = writeBatch(db);
      
      // Add friend for current user
      const friendship1Ref = doc(collection(db, 'friendships'));
      batch.set(friendship1Ref, {
        userId: user.uid,
        friendId: friendId,
        createdAt: new Date()
      });

      // Add current user as friend for the other user
      const friendship2Ref = doc(collection(db, 'friendships'));
      batch.set(friendship2Ref, {
        userId: friendId,
        friendId: user.uid,
        createdAt: new Date()
      });

      // Commit both operations
      await batch.commit();
      
      await loadFriends();
      setNewFriendEmail('');
      setIsAddingFriend(false);
      Alert.alert('Success', 'Friend added successfully!');
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      // The auth state change listener in _layout.tsx will handle the navigation
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={100} color={COLORS.accent} />
          </View>
          <Text style={styles.name}>{user?.displayName || 'User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Memories</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Links</Text>
          </View>
        </View>

        <View style={styles.friendsSection}>
          <View style={styles.friendsHeader}>
            <Text style={styles.sectionTitle}>Friends</Text>
            <TouchableOpacity 
              style={styles.addFriendButton}
              onPress={() => setIsAddingFriend(!isAddingFriend)}
            >
              <Ionicons name="person-add-outline" size={24} color={COLORS.accent} />
            </TouchableOpacity>
          </View>

          {isAddingFriend && (
            <View style={styles.addFriendContainer}>
              <TextInput
                style={styles.addFriendInput}
                placeholder="Enter friend's email"
                value={newFriendEmail}
                onChangeText={setNewFriendEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={styles.addFriendSubmit}
                onPress={addFriendByEmail}
              >
                <Text style={styles.addFriendSubmitText}>Add Friend</Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.friendItem}>
                <Ionicons name="person-circle-outline" size={40} color={COLORS.text} />
                <Text style={styles.friendName}>{item.displayName || item.email}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No friends yet. Add some friends!</Text>
            }
          />
        </View>

        <View style={styles.settingsSection}>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="settings-outline" size={24} color={COLORS.text} />
            <Text style={styles.settingText}>Settings</Text>
            <Ionicons name="chevron-forward" size={24} color={COLORS.secondaryText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="help-circle-outline" size={24} color={COLORS.text} />
            <Text style={styles.settingText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={24} color={COLORS.secondaryText} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={24} color={COLORS.text} />
            <Text style={styles.settingText}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={24} color={COLORS.secondaryText} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.shadow,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: COLORS.secondaryText,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.shadow,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 4,
  },
  settingsSection: {
    padding: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.shadow,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 12,
  },
  friendsSection: {
    flex: 1,
    padding: 20,
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  addFriendButton: {
    padding: 8,
  },
  addFriendContainer: {
    marginBottom: 16,
  },
  addFriendInput: {
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.shadow,
    marginBottom: 8,
  },
  addFriendSubmit: {
    backgroundColor: COLORS.accent,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addFriendSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    marginBottom: 8,
  },
  friendName: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.secondaryText,
    marginTop: 20,
  },
}); 