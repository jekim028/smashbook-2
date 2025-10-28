import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isImageCached, markImageAsLoaded } from '../utils/imageCache';
import { getLinkMetadata } from '../utils/linkPreview';

interface MemoryCardProps {
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link';
  content: any;
  isFavorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
  onLongPress?: () => void; // Add long-press support
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

const SHARED_BUBBLE_SIZE = 32;

const MemoryCard: React.FC<MemoryCardProps> = ({
  type,
  content,
  isFavorite,
  onPress,
  onFavorite,
  onLongPress,
  style,
}) => {
  const [linkMetadata, setLinkMetadata] = useState<any>(null);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [sharedBy, setSharedBy] = useState<{ photoURL: string | null, displayName: string | null } | null>(null);
  
  // Get image URI
  const imageUri = type === 'link' 
    ? content?.previewImage 
    : content?.thumbnail || content?.uri || null;

  useEffect(() => {
    if (type === 'link' && content?.url && !content.previewImage) {
      fetchLinkMetadata();
    }
    
    // Updated image loading to include previewImage for links
    setFullImageUri(imageUri);
    
    // Check if image is already in cache - if so, mark as loaded immediately
    if (imageUri && isImageCached(imageUri)) {
      setIsLoading(false);
    } else if (!imageUri) {
      // No image to load
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setHasError(false);

    // Set shared by info if available
    if (content?.sharedBy) {
      setSharedBy({
        photoURL: content.sharedBy.photoURL || null,
        displayName: content.sharedBy.displayName || null
      });
    }
  }, [type, content, imageUri]);

  const fetchLinkMetadata = async () => {
    if (!content.url) return;
    
    try {
      const metadata = await getLinkMetadata(content.url);
      setLinkMetadata(metadata);
      // Update fullImageUri with the fetched image
      if (metadata?.image) {
        setFullImageUri(metadata.image);
      }
    } catch (error) {
      // Silently fail
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'photo':
        return 'image-outline';
      case 'note':
        return 'chatbubble-ellipses-outline';
      case 'voice':
        return 'mic-outline';
      case 'text':
        return 'chatbubble-ellipses-outline';
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

  const handleImageLoad = () => {
    // Determine which URI to cache based on the type
    const uriToCache = type === 'link' 
      ? (fullImageUri || content?.previewImage)
      : (content?.thumbnail || content?.uri);
      
    markImageAsLoaded(uriToCache || '');
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = (error?: any) => {
    setIsLoading(false);
    setHasError(true);
  };

  const renderMediaContent = () => {
    // Use the imageUri from component scope
    const mediaImageUri = content?.thumbnail || content?.uri || '';
    const cached = isImageCached(mediaImageUri);
    const showLoading = isLoading && !cached && mediaImageUri;
    
    return (
      <View style={styles.mediaContentWrapper}>
        <Image 
          source={{ uri: mediaImageUri }} 
          style={styles.image}
          resizeMode="cover"
          onLoad={handleImageLoad}
          onError={handleImageError}
          fadeDuration={0}
        />
        
        {/* Loading indicator */}
        {showLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        )}
        
        {/* Media type indicators */}
        {type === 'reel' && (
          <View style={styles.typeIndicator}>
            <Ionicons name="logo-instagram" size={20} color="#fff" />
          </View>
        )}
        
        {type === 'tiktok' && (
          <View style={styles.typeIndicator}>
            <Ionicons name="logo-tiktok" size={20} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  const renderLinkPreview = () => {
    // Use linkMetadata if available, otherwise fallback to content
    const title = linkMetadata?.title || content?.title || content?.url || 'Link';
    const description = linkMetadata?.description || content?.description || '';
    const publisher = linkMetadata?.publisher || content?.publisher || '';
    const linkImageUri = fullImageUri || content?.previewImage || '';
    const hasImage = !!linkImageUri;
    const linkCached = isImageCached(linkImageUri);
    const showLinkLoading = isLoading && !linkCached && hasImage;
    
    return (
      <View style={styles.linkContainer}>
        {/* Image Preview */}
        {hasImage ? (
          <View style={styles.linkPreviewContainer}>
            <Image 
              source={{ uri: linkImageUri }} 
              style={styles.linkPreviewImage}
              resizeMode="cover"
              onLoad={handleImageLoad}
              onError={handleImageError}
              fadeDuration={0}
            />
          </View>
        ) : (
          <View style={styles.linkIconContainer}>
            <Ionicons name="link-outline" size={32} color={COLORS.accent} />
          </View>
        )}
        
        {/* Content Overlay */}
        <View style={styles.linkContentOverlay}>
          {/* Title */}
          <Text style={styles.linkTitle} numberOfLines={2}>
            {title}
          </Text>
          
          {/* Description (if available) */}
          {description ? (
            <Text style={styles.linkDescription} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
          
        {/* Publisher or URL */}
        <Text style={styles.linkUrl} numberOfLines={1}>
          {publisher || new URL(content?.url || 'https://example.com').hostname}
        </Text>
      </View>
    </View>
  );
};

  const renderContent = () => {
    // For photo/video content
    if (['photo', 'reel', 'tiktok'].includes(type)) {
      return renderMediaContent();
    }
    
    // For link content
    if (type === 'link') {
      return renderLinkPreview();
    }
    
    // For notes, voice, text content
    if (['note', 'voice', 'text'].includes(type)) {
      return (
        <View style={styles.iconContainer}>
          <Ionicons name={getIcon()} size={32} color={COLORS.accent} />
          <Text style={styles.text}>{content?.text || content?.title || type}</Text>
        </View>
      );
    }
    
    // For restaurant
    if (type === 'restaurant') {
      return (
        <View style={styles.iconContainer}>
          <Ionicons name="restaurant-outline" size={32} color={COLORS.accent} />
          <Text style={styles.text}>{content?.name || 'Restaurant'}</Text>
        </View>
      );
    }
    
    // For location
    if (type === 'location') {
      return (
        <View style={styles.iconContainer}>
          <Ionicons name="location-outline" size={32} color={COLORS.accent} />
          <Text style={styles.text}>{content?.name || 'Location'}</Text>
        </View>
      );
    }
    
    // Default fallback
    return (
      <View style={styles.iconContainer}>
        <Ionicons name={getIcon()} size={32} color={COLORS.accent} />
        <Text style={styles.text}>{type}</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      delayLongPress={500}
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

      {/* Shared by bubble */}
      {sharedBy && (
        <View style={styles.sharedByContainer}>
          {sharedBy.photoURL ? (
            <Image 
              source={{ uri: sharedBy.photoURL }} 
              style={styles.sharedByImage}
            />
          ) : (
            <View style={styles.sharedByPlaceholder}>
              <Ionicons name="person" size={16} color={COLORS.secondaryText} />
            </View>
          )}
        </View>
      )}
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
    borderWidth: 0,
    backgroundColor: 'transparent'
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.lightAccent,
  },
  linkIconContainer: {
    flex: 1,
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
    position: 'relative',
    overflow: 'hidden',
  },
  linkPreviewImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  linkContentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(10px)',
  },
  linkTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  linkDescription: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 14,
    marginBottom: 4,
  },
  linkUrl: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightAccent,
    borderRadius: 20,
    zIndex: 1,
  },
  linkPreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  linkLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightAccent,
    zIndex: 1,
  },
  mediaContentWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sharedByContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: SHARED_BUBBLE_SIZE,
    height: SHARED_BUBBLE_SIZE,
    borderRadius: SHARED_BUBBLE_SIZE / 2,
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  sharedByImage: {
    width: '100%',
    height: '100%',
    borderRadius: SHARED_BUBBLE_SIZE / 2,
  },
  sharedByPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: SHARED_BUBBLE_SIZE / 2,
    backgroundColor: COLORS.lightAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MemoryCard; 