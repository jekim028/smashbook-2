import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getLinkMetadata } from '../utils/linkPreview';

interface MemoryCardProps {
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link';
  content: any;
  isFavorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
  style?: any; // Allow custom styles to be passed
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 48) / 2; // 2 columns with proper padding
const CARD_HEIGHT = CARD_WIDTH * 1.3; // Adjusted height ratio for a more compact look

// Updated colors to match the fish logo theme used in profile page
const COLORS = {
  background: '#fdfcf8', // Same as login page
  card: '#FFFFFF',
  text: '#1A3140', // Navy from fish logo
  secondaryText: '#8E8E93',
  accent: '#FF914D', // Orange from fish logo
  shadow: 'rgba(0, 0, 0, 0.08)',
  favorite: '#FF914D', // Using accent color for consistency
  favoriteBackground: 'rgba(255, 145, 77, 0.1)', // Semi-transparent accent
  cardBackground: '#FFFFFF',
  cardBorder: 'rgba(0, 0, 0, 0.05)',
  lightAccent: '#FFF0E6', // Lighter version of accent
};

const MemoryCard: React.FC<MemoryCardProps> = ({
  type,
  content,
  isFavorite,
  onPress,
  onFavorite,
  style,
}) => {
  const [linkMetadata, setLinkMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (type === 'link' && content?.url && !content.previewImage) {
      fetchLinkMetadata();
    }
    
    // We don't need to fetch the full image anymore as we're using thumbnails
    // directly stored in the content object
    if (content?.thumbnail) {
      setFullImageUri(content.thumbnail);
    }
  }, [type, content]);

  const fetchLinkMetadata = async () => {
    if (!content.url) return;
    
    setIsLoading(true);
    try {
      const metadata = await getLinkMetadata(content.url);
      setLinkMetadata(metadata);
    } catch (error) {
      console.error('Error fetching link metadata:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'photo':
        return 'image-outline';
      case 'note':
        return 'document-text-outline';
      case 'voice':
        return 'mic-outline';
      case 'text':
        return 'chatbubble-outline';
      case 'reel':
        return 'videocam-outline';
      case 'tiktok':
        return 'logo-tiktok';
      case 'restaurant':
        return 'restaurant-outline';
      case 'location':
        return 'location-outline';
      case 'link':
        return 'link-outline';
      default:
        return 'document-outline';
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'photo':
      case 'reel':
      case 'tiktok':
        if (!content) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.loadingText}>Loading image...</Text>
            </View>
          );
        }
        
        const imageUri = content.thumbnail || content.uri || '';
        return (
          <>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.accent} />
              </View>
            ) : (
              <Image 
                source={{ uri: imageUri }} 
                style={styles.image}
                resizeMode="cover"
              />
            )}
            <View style={styles.mediaOverlay}>
              {type === 'reel' && <Ionicons name="logo-instagram" size={20} color={COLORS.card} />}
              {type === 'tiktok' && <Ionicons name="logo-tiktok" size={20} color={COLORS.card} />}
              {content?.duration && (
                <Text style={styles.duration}>{content.duration}</Text>
              )}
            </View>
          </>
        );
      case 'voice':
        return (
          <View style={styles.voiceContainer}>
            <Ionicons name="mic-outline" size={32} color={COLORS.accent} />
            <Text style={styles.voiceDuration}>{content.duration}</Text>
          </View>
        );
      case 'text':
        return (
          <View style={styles.textContainer}>
            <Text style={styles.sender}>{content.sender}</Text>
            <Text style={styles.messageText}>{content.text}</Text>
          </View>
        );
      case 'restaurant':
        return (
          <View style={styles.restaurantContainer}>
            <Ionicons name="restaurant-outline" size={32} color={COLORS.accent} />
            <Text style={styles.restaurantName}>{content.name}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color={COLORS.accent} />
              <Text style={styles.rating}>{content.rating}</Text>
            </View>
          </View>
        );
      case 'location':
        return (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={32} color={COLORS.accent} />
            <Text style={styles.locationName}>{content.name}</Text>
          </View>
        );
      case 'link':
        return (
          <View style={styles.linkContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.accent} />
              </View>
            ) : (content.previewImage || linkMetadata?.image) ? (
              <Image 
                source={{ uri: content.previewImage || linkMetadata?.image }} 
                style={styles.linkPreviewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.linkIconContainer}>
                <Ionicons name="link-outline" size={32} color={COLORS.accent} />
              </View>
            )}
            <Text style={styles.linkTitle} numberOfLines={1}>
              {content.title || linkMetadata?.title || 'Link'}
            </Text>
            <Text style={styles.linkUrl} numberOfLines={1}>
              {content.url}
            </Text>
            {(content.description || linkMetadata?.description) && (
              <Text style={styles.linkDescription} numberOfLines={2}>
                {content.description || linkMetadata?.description}
              </Text>
            )}
          </View>
        );
      default:
        return (
          <View style={styles.iconContainer}>
            <Ionicons name={getIcon()} size={32} color={COLORS.accent} />
            <Text style={styles.text}>{content.text || content.title || type}</Text>
          </View>
        );
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={onPress}
      activeOpacity={0.85}
    >
      {renderContent()}
      
      <TouchableOpacity 
        style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
        onPress={onFavorite}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <Ionicons 
          name={isFavorite ? 'heart' : 'heart-outline'} 
          size={20} 
          color={isFavorite ? COLORS.favorite : COLORS.secondaryText} 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    margin: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.lightAccent,
  },
  linkIconContainer: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightAccent,
    borderRadius: 12,
    marginBottom: 8,
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  favoriteButtonActive: {
    backgroundColor: COLORS.favoriteBackground,
  },
  mediaOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 12,
  },
  duration: {
    color: COLORS.card,
    fontSize: 12,
    marginLeft: 4,
  },
  voiceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightAccent,
    padding: 16,
  },
  voiceDuration: {
    marginTop: 8,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  textContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.lightAccent,
  },
  sender: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
  },
  restaurantContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightAccent,
    padding: 16,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rating: {
    marginLeft: 4,
    color: COLORS.text,
    fontSize: 14,
  },
  locationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightAccent,
    padding: 16,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
    textAlign: 'center',
  },
  linkContainer: {
    flex: 1,
    padding: 12,
    justifyContent: 'flex-start',
    backgroundColor: COLORS.cardBackground,
  },
  linkPreviewImage: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    marginBottom: 8,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  linkUrl: {
    fontSize: 12,
    color: COLORS.accent,
    marginBottom: 4,
  },
  linkDescription: {
    fontSize: 12,
    color: COLORS.secondaryText,
    lineHeight: 16,
  },
  loadingContainer: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightAccent,
    borderRadius: 12,
    marginBottom: 8,
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.secondaryText,
    fontSize: 14,
  },
});

export default MemoryCard; 