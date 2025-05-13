import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../constants/Firebase';

// Colors to match the fish logo theme
const COLORS = {
  background: '#fdfcf8',
  card: '#FFFFFF',
  text: '#1A3140', // Navy from fish logo
  secondaryText: '#8E8E93',
  accent: '#FF914D', // Orange from fish logo
  error: '#FF3B30',
};

export default function CreateMemory() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { url, text, caption: initialCaption } = params;
  
  const [sharedContent, setSharedContent] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    // Set the shared content based on the URL parameters
    if (url) {
      setSharedContent(url as string);
    } else if (text) {
      setSharedContent(text as string);
    }
    
    // Set the initial caption if provided
    if (initialCaption) {
      setCaption(initialCaption as string);
    }
  }, [url, text, initialCaption]);
  
  // Function to save the content as a memory
  const saveMemory = async () => {
    if (!auth.currentUser) {
      Alert.alert('Error', 'You must be logged in to save memories');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create a new memory document
      const memoryData: any = {
        userId: auth.currentUser.uid,
        date: Timestamp.now(),
        isFavorite: false,
      };
      
      if (url) {
        // For URL content
        memoryData.type = 'link';
        memoryData.content = {
          url: url,
          caption: caption,
        };
      } else if (text) {
        // For text content
        memoryData.type = 'note';
        memoryData.content = {
          text: text,
          caption: caption,
        };
      } else {
        // Default case
        memoryData.type = 'note';
        memoryData.content = {
          caption: caption,
        };
      }
      
      // Add the document to Firestore
      await addDoc(collection(db, 'memories'), memoryData);
      
      Alert.alert('Success', 'Memory saved successfully!', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
    } catch (error) {
      console.error('Error saving memory:', error);
      Alert.alert('Error', 'Failed to save memory. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Memory</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.content}>
        {sharedContent && (
          <View style={styles.sharedContentBox}>
            <Text style={styles.sharedContentTitle}>Shared Content:</Text>
            <Text style={styles.sharedContentText}>{sharedContent}</Text>
          </View>
        )}
        
        <TextInput
          style={styles.captionInput}
          placeholder="Add a caption..."
          placeholderTextColor={COLORS.secondaryText}
          value={caption}
          onChangeText={setCaption}
          multiline
        />
      </View>
      
      <TouchableOpacity 
        style={styles.saveButton} 
        onPress={saveMemory}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.saveButtonText}>Save Memory</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  sharedContentBox: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sharedContentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  sharedContentText: {
    fontSize: 16,
    color: COLORS.text,
  },
  captionInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
}); 