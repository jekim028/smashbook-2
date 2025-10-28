// Global image load cache shared across all components
// This ensures images only load once and persist throughout the app
export const imageLoadCache = new Map<string, boolean>();

// Mark an image as loaded in the cache
export const markImageAsLoaded = (uri: string) => {
  if (uri) {
    imageLoadCache.set(uri, true);
    console.log('[ImageCache] Cached image:', uri.substring(0, 50));
  }
};

// Check if an image is already loaded
export const isImageCached = (uri: string | null | undefined): boolean => {
  if (!uri) return false;
  const cached = imageLoadCache.get(uri) || false;
  if (cached) {
    console.log('[ImageCache] Hit:', uri.substring(0, 50));
  }
  return cached;
};

// Clear the entire cache (useful for logout or memory management)
export const clearImageCache = () => {
  imageLoadCache.clear();
  console.log('[ImageCache] Cache cleared');
};
