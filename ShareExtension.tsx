import { Ionicons } from '@expo/vector-icons';
import { close, InitialProps, openHostApp } from 'expo-share-extension';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Colors to match the fish logo theme
const COLORS = {
  background: '#fdfcf8',
  card: '#FFFFFF',
  text: '#1A3140', // Navy from fish logo
  secondaryText: '#8E8E93',
  accent: '#FF914D', // Orange from fish logo
  error: '#FF3B30',
};

export default function ShareExtension(props: InitialProps) {
  const [caption, setCaption] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Extract the shared content
  const { url, text, images } = props;
  
  const sharedContent = url || text || (images && images.length > 0 ? 'Image shared' : 'Content shared');
  
  const handleSave = () => {
    setIsLoading(true);
    
    // We can use a timeout to simulate processing
    setTimeout(() => {
      // Open the host app and pass the shared content
      // You could encode this data and pass it as URL parameters
      if (url) {
        openHostApp(`create?url=${encodeURIComponent(url)}&caption=${encodeURIComponent(caption)}`);
      } else if (text) {
        openHostApp(`create?text=${encodeURIComponent(text)}&caption=${encodeURIComponent(caption)}`);
      } else if (images && images.length > 0) {
        // For images, we might need a different approach since we can't easily pass image data in URL
        // This would require more advanced implementation with shared storage
        openHostApp('create');
      } else {
        openHostApp('create');
      }
    }, 500);
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add to Smashbook</Text>
        <TouchableOpacity onPress={close} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.sharedContentBox}>
          <Text style={styles.sharedContentTitle}>Shared Content:</Text>
          <Text style={styles.sharedContentText} numberOfLines={3}>{sharedContent}</Text>
        </View>
        
        <TextInput
          style={styles.captionInput}
          placeholder="Add a caption..."
          placeholderTextColor={COLORS.secondaryText}
          value={caption}
          onChangeText={setCaption}
          multiline
        />
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={close}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save to Smashbook</Text>
          )}
        </TouchableOpacity>
      </View>
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
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
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
    minHeight: 100,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.secondaryText,
  },
  saveButton: {
    flex: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
}); 