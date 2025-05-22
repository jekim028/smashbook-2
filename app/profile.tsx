import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../constants/Firebase';

// Logo colors for the app
const COLORS = {
  background: '#fdfcf8', // Same as login page
  card: '#FFFFFF',
  text: '#1A3140', // Navy from fish logo
  secondaryText: '#8E8E93',
  accent: '#FF914D', // Orange from fish logo
  shadow: 'rgba(0, 0, 0, 0.08)',
  lightAccent: '#FFF0E6', // Lighter version of accent
};

interface User {
  id: string;
  email: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
}

interface Memory {
  id: string;
  caption?: string;
  imageURL?: string;
  createdAt: any;
  content?: {
    uri?: string;
    caption?: string;
    thumbnail?: string;
  };
  isFavorite?: boolean;
  type?: string;
}

export default function Profile() {
  const router = useRouter();
  const user = auth.currentUser;
  const [friends, setFriends] = useState<User[]>([]);
  const [newFriend, setNewFriend] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [searchResults, setSearchResults] = useState<{id: string, displayName: string, username?: string, email: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileData, setProfileData] = useState<{
    displayName: string;
    username: string;
    photoURL: string | null;
    avatarType?: string;
    avatarInitials?: string;
    avatarColor?: string;
  }>({
    displayName: user?.displayName || 'User',
    username: '',
    photoURL: null,
    avatarType: 'default',
    avatarInitials: ''
  });
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [quickSmashbookKey, setQuickSmashbookKey] = useState(0);

  useEffect(() => {
    ensureUserDocument();
    loadUserProfile();
    loadFriends();
    loadMemories();
    loadFavoritesCount();
  }, []);

  // Add this useEffect to reshuffle the Quick Smashbook
  useEffect(() => {
    // Reshuffle the Quick Smashbook every 10 seconds
    const interval = setInterval(() => {
      setQuickSmashbookKey(prev => {
        console.log('Reshuffling Quick Smashbook...', prev + 1);
        return prev + 1;
      });
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Debug useEffect to log memory content when it changes
  useEffect(() => {
    if (memories.length > 0) {
      console.log(`Memories available for QuickSmashbook: ${memories.length}`);
      console.log('Sample memory types:', memories.map(m => m.type).join(', '));
      
      // Check available image sources
      memories.forEach((memory, index) => {
        if (index < 3) { // Log first 3 memories only
          console.log(`Memory ${index} image sources:`, {
            imageURL: memory.imageURL ? 'present' : 'missing',
            contentUri: memory.content?.uri ? 'present' : 'missing',
            contentThumbnail: memory.content?.thumbnail ? 'present' : 'missing'
          });
        }
      });
    }
  }, [memories]);

  const ensureUserDocument = async () => {
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Create user document if it doesn't exist
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          displayName: user.displayName || '',
          username: '',
          photoURL: '',
          createdAt: new Date()
        });
      } else if (!userDoc.data().username) {
        // If the user doc exists but doesn't have a username field
        await updateDoc(doc(db, 'users', user.uid), {
          username: '',
          photoURL: userDoc.data().photoURL || ''
        });
      }
    } catch (error) {
      console.error('Error ensuring user document:', error);
    }
  };

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfileData({
          displayName: data.displayName || user.displayName || 'User',
          username: data.username || '',
          photoURL: data.photoURL || null,
          avatarType: data.avatarType || 'default',
          avatarInitials: data.avatarInitials || '',
          avatarColor: data.avatarColor || COLORS.accent
        });
        setNewUsername(data.username || '');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
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
          const friendData = friendDoc.data();
          return { 
            id: friendId,
            email: friendData?.email || '',
            displayName: friendData?.displayName,
            username: friendData?.username,
            photoURL: friendData?.photoURL
          };
        })
      );
      
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadMemories = async () => {
    if (!user) return;
    
    try {
      const memoriesRef = collection(db, 'memories');
      const q = query(memoriesRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const memoriesList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          caption: data.caption || 'No caption',
          imageURL: data.imageURL || null,
          createdAt: data.createdAt || data.date || null,
          content: data.content || {},
          isFavorite: data.isFavorite || false,
          type: data.type || 'photo',
          // Add any other fields you need
        };
      });
      
      // Sort by most recent if the date is available
      memoriesList.sort((a, b) => {
        if (!a.createdAt) return 1;  // Push items without dates to the end
        if (!b.createdAt) return -1;
        return b.createdAt.toDate() - a.createdAt.toDate();
      });
      
      console.log('Loaded memories count:', memoriesList.length);
      setMemories(memoriesList);
    } catch (error) {
      console.error('Error loading memories:', error);
    }
  };

  const loadFavoritesCount = async () => {
    if (!user) return;
    
    try {
      const memoriesRef = collection(db, 'memories');
      const q = query(
        memoriesRef,
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      
      // Count the favorites locally instead of in the query
      const favorites = querySnapshot.docs.filter(doc => doc.data().isFavorite === true);
      setFavoritesCount(favorites.length);
    } catch (error) {
      console.error('Error loading favorites count:', error);
      setFavoritesCount(0);
    }
  };

  const addFriendByUsername = async () => {
    if (!user || !newFriend.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      
      // Get all users to search through
      const usersRef = collection(db, 'users');
      const allUsersSnapshot = await getDocs(usersRef);
      
      // Find users that match the search term (case insensitive)
      const searchTerm = newFriend.trim().toLowerCase();
      const matchingUsers = allUsersSnapshot.docs.filter(doc => {
        const userData = doc.data();
        // Skip the current user
        if (doc.id === user.uid) return false;
        
        // Check for partial matches in username or display name
        const username = (userData.username || '').toLowerCase();
        const displayName = (userData.displayName || '').toLowerCase();
        const email = (userData.email || '').toLowerCase();
        
        return username.includes(searchTerm) || 
               displayName.includes(searchTerm) || 
               email.includes(searchTerm);
      });
      
      // Format the search results
      const formattedResults = matchingUsers.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || 'User',
          username: data.username || '',
          email: data.email || ''
        };
      });
      
      // Update the search results state
      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Error searching for friends:', error);
      Alert.alert('Error', 'Failed to search for users. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const pickProfileImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.1, // Use very low quality to keep base64 size small
        base64: true, // Request base64 data
      });
    
      if (!result.canceled && result.assets[0].uri && result.assets[0].base64) {
        uploadBase64Image(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadBase64Image = async (base64Data: string) => {
    if (!user) return;
    
    try {
      setUploadingImage(true);
      
      // Check if the base64 data is too large (Firestore has limits)
      // A very conservative limit - might need to adjust based on your Firebase plan
      const sizeInBytes = base64Data.length * 0.75; // approximate size in bytes
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      if (sizeInMB > 0.5) { // If larger than 500KB (Firestore has 1MB limit for docs)
        console.log(`Image too large: ${sizeInMB.toFixed(2)}MB, using initial avatar instead`);
        await setInitialsAvatar();
        return;
      }
      
      // Prefix with data URL scheme
      const imageUri = `data:image/jpeg;base64,${base64Data}`;
      
      try {
        // Update user document directly with base64 image
        await updateDoc(doc(db, 'users', user.uid), {
          photoURL: imageUri
        });
        
        // Update local state
        setProfileData(prev => ({
          ...prev,
          photoURL: imageUri
        }));
        
        Alert.alert('Success', 'Profile picture updated successfully!');
      } catch (firestoreError) {
        console.error('Error with base64 update:', firestoreError);
        // If base64 approach fails (possibly due to size limits)
        await setInitialsAvatar();
      }
    } catch (error) {
      console.error('Error updating profile image:', error);
      Alert.alert('Error', 'Failed to update profile image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Alternative approach that just stores user initials
  const setInitialsAvatar = async () => {
    if (!user) return;
    
    try {
      // Generate and save user's initials as avatar type
      const displayName = user.displayName || profileData.displayName || 'User';
      const initials = displayName
        .split(' ')
        .map(name => name.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
        
      // Update with initials and avatar type
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: null,
        avatarType: 'initials',
        avatarInitials: initials,
        avatarColor: COLORS.accent // Store color for consistency
      });
      
      // Update local state to show default avatar
      setProfileData(prev => ({
        ...prev,
        photoURL: null
      }));
      
      Alert.alert('Notice', 'Using initials avatar instead. The image may have been too large.');
    } catch (error) {
      console.error('Error setting initials avatar:', error);
    }
  };

  const updateUsername = async () => {
    if (!user || !newUsername.trim()) return;
    
    try {
      // Check if username is already taken
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', newUsername.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty && querySnapshot.docs[0].id !== user.uid) {
        Alert.alert('Username taken', 'This username is already taken. Please choose another one.');
        return;
      }
      
      // Update username in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        username: newUsername.trim()
      });
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        username: newUsername.trim()
      }));
      
      setEditingUsername(false);
      Alert.alert('Success', 'Username updated successfully!');
    } catch (error) {
      console.error('Error updating username:', error);
      Alert.alert('Error', 'Failed to update username. Please try again.');
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

  const memoriesCount = memories.length;
  
  // Add a function to shuffle and limit memories for the sticker wall
  const getRandomMemories = (allMemories: Memory[], count: number = 6) => {
    // First filter to only include memories with actual images
    const memoriesWithImages = allMemories.filter(memory => 
      memory.imageURL || memory.content?.thumbnail || memory.content?.uri
    );
    
    // If we don't have enough memories with images, return all we have
    if (memoriesWithImages.length <= count) {
      return memoriesWithImages;
    }
    
    // Create a copy to avoid modifying the original array
    const shuffled = [...memoriesWithImages];
    
    // Fisher-Yates shuffle algorithm
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Return a limited number of items
    return shuffled.slice(0, count);
  };

  // Function to add a friend by their ID
  const addFriend = async (friendId: string) => {
    if (!user) return;
    
    try {
      // Check if already friends
      const friendshipRef = collection(db, 'friendships');
      const friendshipQ = query(
        friendshipRef, 
        where('userId', '==', user.uid),
        where('friendId', '==', friendId)
      );
      const existingFriendship = await getDocs(friendshipQ);
      
      if (!existingFriendship.empty) {
        Alert.alert('Already friends', 'You are already friends with this user.');
        return;
      }
      
      // Add friendship (both ways for simplicity)
      const batch = writeBatch(db);
      
      // User -> Friend
      batch.set(doc(friendshipRef), {
        userId: user.uid,
        friendId: friendId,
        createdAt: new Date()
      });
      
      // Friend -> User (optional, makes it bidirectional)
      batch.set(doc(friendshipRef), {
        userId: friendId,
        friendId: user.uid,
        createdAt: new Date()
      });
      
      await batch.commit();
      
      // Reset and reload
      setNewFriend('');
      setSearchResults([]);
      setIsAddingFriend(false);
      loadFriends();
      Alert.alert('Success', 'Friend added successfully!');
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend. Please try again.');
    }
  };
  
  // Function to show a selection dialog when multiple users match the search
  const showFriendSelectionDialog = (users: any[]) => {
    // Format the list of users for the alert
    const userOptions = users.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        label: data.displayName || data.username || data.email,
        username: data.username ? `@${data.username}` : '',
        email: data.email
      };
    });
    
    // Show the alert with options
    Alert.alert(
      'Select a user',
      'Multiple users found. Please select one:',
      [
        ...userOptions.map(user => ({
          text: `${user.label}${user.username ? ` ${user.username}` : ''}`,
          onPress: () => {
            addFriend(user.id);
            // Clear the search field to allow a new search immediately
            setNewFriend('');
            setSearchResults([]);
          }
        })),
        {
          text: 'Cancel',
          style: 'cancel' as 'cancel'
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={pickProfileImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <View style={styles.loadingAvatar}>
                  <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
              ) : profileData.photoURL ? (
                <Image 
                  source={
                    profileData.photoURL.startsWith('data:') 
                      ? { uri: profileData.photoURL } 
                      : { uri: profileData.photoURL }
                  } 
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                />
              ) : profileData.avatarType === 'initials' && profileData.avatarInitials ? (
                <View style={[styles.defaultAvatar, {backgroundColor: profileData.avatarColor || COLORS.accent}]}>
                  <Text style={styles.avatarInitials}>{profileData.avatarInitials}</Text>
                </View>
              ) : (
                <View style={styles.defaultAvatar}>
                  <Ionicons name="person" size={50} color="#fff" />
                </View>
              )}
              <View style={styles.editAvatarBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{profileData.displayName}</Text>
              
              {editingUsername ? (
                <View style={styles.usernameEditContainer}>
                  <TextInput
                    style={styles.usernameInput}
                    value={newUsername}
                    onChangeText={setNewUsername}
                    placeholder="Set username"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity 
                    style={styles.saveUsernameButton}
                    onPress={updateUsername}
                  >
                    <Text style={styles.saveUsernameText}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.usernameContainer}
                  onPress={() => setEditingUsername(true)}
                >
                  <Text style={styles.username}>
                    {profileData.username ? `@${profileData.username}` : 'Set username'}
                  </Text>
                  <Ionicons name="create-outline" size={16} color={COLORS.secondaryText} />
                </TouchableOpacity>
              )}
              
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{memoriesCount}</Text>
            <Text style={styles.statLabel}>Memories</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{friends.length}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{favoritesCount}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Smashbook</Text>
          </View>
          
          {memories.length > 0 ? (
            <View style={styles.stickerWall} key={quickSmashbookKey}>
              {getRandomMemories(memories).map((item) => (
                <View key={item.id} style={styles.stickerItem}>
                  {item.imageURL || (item.content && (item.content.uri || item.content.thumbnail)) ? (
                    <Image 
                      source={{ uri: item.imageURL || item.content?.thumbnail || item.content?.uri || '' }} 
                      style={[
                        styles.stickerImage,
                        { transform: [{ rotate: `${Math.floor(Math.random() * 10 - 5)}deg` }] }
                      ]} 
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={[
                      styles.emptySticker,
                      { transform: [{ rotate: `${Math.floor(Math.random() * 10 - 5)}deg` }] }
                    ]}>
                      <Ionicons name="images-outline" size={24} color={COLORS.secondaryText} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={48} color={COLORS.secondaryText} />
              <Text style={styles.emptyText}>No memories yet. Start capturing!</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Friends</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setIsAddingFriend(!isAddingFriend)}
            >
              <Ionicons name={isAddingFriend ? "close-outline" : "person-add-outline"} size={22} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
          
          {isAddingFriend && (
            <View style={styles.addFriendContainer}>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.addFriendInput}
                  placeholder={searchResults.length === 0 && newFriend.trim().length > 0 ? "No users found" : "Enter name, username or email"}
                  value={newFriend}
                  onChangeText={(text) => {
                    setNewFriend(text);
                    if (text.trim().length > 0) {
                      addFriendByUsername();
                    } else {
                      setSearchResults([]);
                    }
                  }}
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  style={styles.addFriendButton}
                  onPress={addFriendByUsername}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="search" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              
              {/* Search results dropdown */}
              {newFriend.trim().length > 0 && searchResults.length > 0 && (
                <View style={styles.searchResultsContainer}>
                  {searchResults.map((result) => (
                    <TouchableOpacity
                      key={result.id}
                      style={styles.searchResultItem}
                      onPress={() => {
                        addFriend(result.id);
                        // Clear search after selecting
                        setNewFriend('');
                        setSearchResults([]);
                      }}
                    >
                      <View style={styles.searchResultAvatar}>
                        <Ionicons name="person" size={14} color="#fff" />
                      </View>
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName}>{result.displayName}</Text>
                        {result.username && (
                          <Text style={styles.searchResultUsername}>@{result.username}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.addSearchResultButton}
                        onPress={() => {
                          addFriend(result.id);
                          // Clear search after selecting
                          setNewFriend('');
                          setSearchResults([]);
                        }}
                      >
                        <Ionicons name="add" size={18} color="#fff" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          
          {friends.length > 0 ? (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.friendItem}>
                  {item.photoURL ? (
                    <Image 
                      source={
                        item.photoURL.startsWith('data:') 
                          ? { uri: item.photoURL } 
                          : { uri: item.photoURL }
                      } 
                      style={styles.friendAvatar} 
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={styles.friendDefaultAvatar}>
                      <Ionicons name="person" size={20} color="#fff" />
                    </View>
                  )}
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{item.displayName || 'User'}</Text>
                    {item.username && (
                      <Text style={styles.friendUsername}>@{item.username}</Text>
                    )}
                  </View>
                </View>
              )}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={COLORS.secondaryText} />
              <Text style={styles.emptyText}>No friends yet. Add some friends!</Text>
            </View>
          )}
        </View>

        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="settings-outline" size={24} color={COLORS.text} />
            <Text style={styles.settingText}>Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondaryText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="help-circle-outline" size={24} color={COLORS.text} />
            <Text style={styles.settingText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondaryText} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.settingItem, styles.lastSettingItem]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            <Text style={[styles.settingText, { color: '#FF3B30' }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondaryText} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  profileCard: {
    margin: 16,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lightAccent,
  },
  defaultAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lightAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginRight: 4,
  },
  usernameEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  usernameInput: {
    flex: 1,
    fontSize: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
    paddingVertical: 4,
    marginRight: 8,
  },
  saveUsernameButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  saveUsernameText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 12,
  },
  email: {
    fontSize: 14,
    color: COLORS.secondaryText,
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F0F0F0',
    height: '80%',
    alignSelf: 'center',
  },
  sectionCard: {
    margin: 16,
    marginTop: 8,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  addButton: {
    padding: 8,
  },
  memoryItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  memoryImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
  },
  memoryNoImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: COLORS.lightAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memoryContent: {
    flex: 1,
    justifyContent: 'center',
  },
  memoryCaption: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  memoryDate: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  addFriendContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addFriendInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginRight: 8,
  },
  addFriendButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addFriendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 50, // Position below the search input
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
    width: '100%',
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  searchResultUsername: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  addSearchResultButton: {
    backgroundColor: COLORS.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: COLORS.secondaryText,
  },
  noResultsSubtext: {
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 4,
    fontStyle: 'italic',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  friendUsername: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 8,
    textAlign: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.accent,
    marginRight: 4,
    fontWeight: '500',
  },
  settingsCard: {
    margin: 16,
    marginTop: 8,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 12,
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 1,
  },
  stickerWall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    padding: 8,
  },
  stickerItem: {
    width: '30%', // Around 3 per row
    aspectRatio: 1,
    padding: 4,
    marginBottom: 12,
  },
  stickerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: COLORS.lightAccent,
    objectFit: 'cover',
  },
  emptySticker: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: COLORS.lightAccent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  friendDefaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
}); 