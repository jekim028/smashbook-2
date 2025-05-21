import * as FileSystem from 'expo-file-system';

// Image cache directory
const IMAGE_CACHE_DIRECTORY = `${FileSystem.cacheDirectory}image-cache/`;

// A simple hash function that doesn't require expo-crypto
const simpleHash = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Return absolute value as hex string
  return Math.abs(hash).toString(16);
};

// Ensure cache directory exists
const ensureCacheDirectoryExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIRECTORY, {
      intermediates: true,
    });
  }
};

// Generate a hash for a URL to use as filename
const getImageFilePath = async (url: string): Promise<string> => {
  if (!url) return '';
  
  // Generate hash from URL using our simple hash function
  const hash = simpleHash(url);
  return `${IMAGE_CACHE_DIRECTORY}${hash}`;
};

// Check if image is cached
const isCached = async (url: string): Promise<boolean> => {
  try {
    if (!url) return false;
    
    const path = await getImageFilePath(url);
    const fileInfo = await FileSystem.getInfoAsync(path);
    return fileInfo.exists;
  } catch (error) {
    console.error('Failed to check if image is cached:', error);
    return false;
  }
};

// Cache an image
const cacheImage = async (url: string): Promise<string | null> => {
  try {
    if (!url) return null;
    
    // Skip caching for local file or data URI
    if (url.startsWith('file:') || url.startsWith('data:')) {
      return url;
    }
    
    await ensureCacheDirectoryExists();
    const path = await getImageFilePath(url);
    
    // Check if already cached
    const fileInfo = await FileSystem.getInfoAsync(path);
    if (fileInfo.exists) {
      return path;
    }
    
    // Only download if it's a remote URL
    if (url.startsWith('http')) {
      // Download and cache
      await FileSystem.downloadAsync(url, path);
      return path;
    }
    
    return url;
  } catch (error) {
    console.error('Failed to cache image:', error);
    return null;
  }
};

// Get cached image URI
const getCachedImageUri = async (url: string): Promise<string> => {
  try {
    if (!url) return url;
    
    // Local file or data URI doesn't need caching
    if (url.startsWith('file:') || url.startsWith('data:')) {
      return url;
    }
    
    // Try to get from cache
    await ensureCacheDirectoryExists();
    const path = await getImageFilePath(url);
    const fileInfo = await FileSystem.getInfoAsync(path);
    
    if (fileInfo.exists) {
      return path;
    }
    
    // Not cached, download first if it's a remote URL
    if (url.startsWith('http')) {
      return await cacheImage(url) || url;
    }
    
    return url;
  } catch (error) {
    console.error('Failed to get cached image:', error);
    return url;
  }
};

// Preload multiple images
const preloadImages = async (urls: string[]): Promise<void> => {
  try {
    const validUrls = urls.filter(url => url && typeof url === 'string');
    await Promise.all(validUrls.map(cacheImage));
  } catch (error) {
    console.error('Failed to preload images:', error);
  }
};

// Clean old cached images (call periodically to free space)
const clearOldCache = async (maxAgeInDays = 7): Promise<void> => {
  try {
    await ensureCacheDirectoryExists();
    const now = new Date();
    const contents = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIRECTORY);
    
    for (const file of contents) {
      const path = `${IMAGE_CACHE_DIRECTORY}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(path);
      
      if (fileInfo.exists && fileInfo.modificationTime) {
        const fileDate = new Date(fileInfo.modificationTime * 1000);
        const diffDays = (now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (diffDays > maxAgeInDays) {
          await FileSystem.deleteAsync(path);
        }
      }
    }
  } catch (error) {
    console.error('Failed to clear old cache:', error);
  }
};

export {
    cacheImage,
    clearOldCache, ensureCacheDirectoryExists, getCachedImageUri,
    isCached,
    preloadImages
};

