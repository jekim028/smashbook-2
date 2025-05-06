import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MemoryCardProps {
  type: 'photo' | 'note' | 'voice' | 'text' | 'reel' | 'tiktok' | 'restaurant' | 'location' | 'link';
  content: any;
  isFavorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 48) / 2; // 2 columns with proper padding
const CARD_HEIGHT = CARD_WIDTH * 1.5; // Fixed height ratio for all cards

// Pastel color palette
const COLORS = {
  background: '#F8F8F8',
  card: '#FFFFFF',
  text: '#2C2C2E',
  secondaryText: '#8E8E93',
  accent: '#007AFF',
  shadow: 'rgba(0, 0, 0, 0.08)',
  favorite: '#FF2D55',
  favoriteBackground: 'rgba(255, 45, 85, 0.1)',
};

const MemoryCard: React.FC<MemoryCardProps> = ({
  type,
  content,
  isFavorite,
  onPress,
  onFavorite,
}) => {
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
        return (
          <>
            <Image 
              source={{ uri: content.uri }} 
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.mediaOverlay}>
              {type === 'reel' && <Ionicons name="logo-instagram" size={20} color={COLORS.card} />}
              {type === 'tiktok' && <Ionicons name="logo-tiktok" size={20} color={COLORS.card} />}
              {content.duration && (
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
              <Ionicons name="star" size={16} color="#FFD700" />
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
            <Ionicons name="link-outline" size={32} color={COLORS.accent} />
            <Text style={styles.linkTitle}>{content.title}</Text>
            <Text style={styles.linkDescription}>{content.description}</Text>
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
      style={[styles.container]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {renderContent()}
      
      <TouchableOpacity 
        style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
        onPress={onFavorite}
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
    borderRadius: 16,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 2,
  },
  text: {
    fontSize: 15,
    fontFamily: 'System',
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
    padding: 16,
    lineHeight: 20,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
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
    backgroundColor: COLORS.background,
  },
  voiceDuration: {
    marginTop: 8,
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  textContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.background,
  },
  sender: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
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
    backgroundColor: COLORS.background,
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
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  locationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 16,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
    textAlign: 'center',
  },
  linkDescription: {
    fontSize: 13,
    color: COLORS.secondaryText,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default MemoryCard; 