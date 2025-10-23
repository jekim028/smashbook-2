import { Ionicons } from '@expo/vector-icons';
import { close, InitialProps, openHostApp } from 'expo-share-extension';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { logger } from './utils/logger';
import { sharedStorage } from './utils/sharedStorage';

// Colors to match the fish logo theme
const COLORS = {
  background: '#fdfcf8',
  card: '#FFFFFF',
  text: '#1A3140', // Navy from fish logo
  secondaryText: '#8E8E93',
  accent: '#FF914D', // Orange from fish logo
  success: '#4CAF50',
  error: '#FF3B30',
};

type ExtensionState = 'input' | 'saving' | 'success' | 'error';

export default function ShareExtension(props: InitialProps) {
  const [state, setState] = useState<ExtensionState>('input');
  const [caption, setCaption] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Extract the shared content
  const { url, text, images } = props;
  
  const sharedContent = url || text || (images && images.length > 0 ? 'Image shared' : 'Content shared');

  // Determine content type and data
  const getContentType = (): 'url' | 'text' | 'image' | 'video' => {
    if (url) return 'url';
    if (images && images.length > 0) {
      // Check if it's a video based on file extension (basic check)
      const firstImage = images[0];
      if (firstImage && (firstImage.toLowerCase().endsWith('.mp4') || 
          firstImage.toLowerCase().endsWith('.mov') || 
          firstImage.toLowerCase().endsWith('.m4v'))) {
        return 'video';
      }
      return 'image';
    }
    return 'text';
  };

  const handleSave = async () => {
    setState('saving');
    logger.info('Starting share save', { type: getContentType(), hasCaption: !!caption });
    
    try {
      const contentType = getContentType();
      const shareData: any = {};

      // Build the data object based on content type
      if (url) {
        shareData.url = url;
      } else if (text) {
        shareData.text = text;
      } else if (images && images.length > 0) {
        if (contentType === 'video') {
          shareData.videoUri = images[0];
          shareData.filename = images[0].split('/').pop();
        } else {
          shareData.imageUri = images[0];
          shareData.filename = images[0].split('/').pop();
        }
      }

      // Save to shared storage (silently, without opening main app)
      const shareId = await sharedStorage.saveSharedContent({
        type: contentType,
        caption: caption || undefined,
        data: shareData,
        metadata: {
          sourceApp: 'ShareExtension',
        },
      });

      logger.info('Successfully saved share', { shareId });
      
      // Show success state
      setState('success');
      
      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        logger.info('Auto-dismissing share extension');
        close();
      }, 2000);
      
    } catch (error) {
      logger.error('Failed to save share', error);
      setErrorMessage('Failed to save content. Please try again.');
      setState('error');
      
      // Auto-dismiss error after 3 seconds
      setTimeout(() => {
        close();
      }, 3000);
    }
  };

  const handleOpenApp = () => {
    logger.info('User chose to open main app');
    openHostApp(''); // Opens main app without specific route
  };
  
  // SAVING STATE: Show loading spinner
  if (state === 'saving') {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.statusText}>Saving to Smashbook...</Text>
      </View>
    );
  }

  // SUCCESS STATE: Show checkmark and auto-dismiss
  if (state === 'success') {
    return (
      <View style={styles.centeredContainer}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.successText}>Saved!</Text>
        <Text style={styles.successSubtext}>Opening in Smashbook shortly...</Text>
        
        {/* Optional: Open app button (not auto-triggered) */}
        <TouchableOpacity style={styles.openAppButton} onPress={handleOpenApp}>
          <Text style={styles.openAppButtonText}>Open Smashbook Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ERROR STATE: Show error and auto-dismiss
  if (state === 'error') {
    return (
      <View style={styles.centeredContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="close" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.errorText}>Oops!</Text>
        <Text style={styles.errorSubtext}>{errorMessage}</Text>
      </View>
    );
  }

  // INPUT STATE: Show caption input form
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
          placeholder="Add a caption (optional)..."
          placeholderTextColor={COLORS.secondaryText}
          value={caption}
          onChangeText={setCaption}
          multiline
          autoFocus
        />
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={close}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save to Smashbook</Text>
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
  centeredContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  // Status states
  statusText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginBottom: 24,
  },
  openAppButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  openAppButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
}); 