/**
 * Hook to process shared content from the share extension
 * Checks App Groups storage for pending shares and imports them
 */

import * as FileSystem from 'expo-file-system/legacy';
import { addDoc, collection, getDocs, limit, query, Timestamp, where } from 'firebase/firestore';
import { useEffect } from 'react';
import { auth, db } from '../constants/Firebase';
import { sharedStorage } from '../utils/sharedStorage';

// Track processing shares to prevent duplicates
const processingShares = new Set<string>();
// Track processed share IDs to prevent duplicates even across app restarts
const processedShareIds = new Set<string>();

export const useSharedContent = () => {
  useEffect(() => {
    const processPendingShares = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        console.log('[useSharedContent] Checking for pending shares...');
        const pendingShares = await sharedStorage.getPendingShares();
        
        if (pendingShares.length === 0) {
          console.log('[useSharedContent] No pending shares found');
          return;
        }

        console.log(`[useSharedContent] Found ${pendingShares.length} pending shares`);

        for (const share of pendingShares) {
          // Skip already processed shares
          if (share.processed) {
            console.log(`[useSharedContent] Skipping already processed share: ${share.id}`);
            continue;
          }
          
          // Skip if we've already processed this share ID in this session
          if (processedShareIds.has(share.id)) {
            console.log(`[useSharedContent] Share ${share.id} was already processed in this session, removing from queue`);
            await sharedStorage.markAsProcessed(share.id);
            continue;
          }
          
          // Skip if currently being processed
          if (processingShares.has(share.id)) {
            console.log(`[useSharedContent] Share ${share.id} is already being processed, skipping`);
            continue;
          }
          
          try {
            console.log(`[useSharedContent] Processing share: ${share.id}`);
            processingShares.add(share.id);
            processedShareIds.add(share.id);
            await processShare(share, user.uid);
            await sharedStorage.markAsProcessed(share.id);
            processingShares.delete(share.id);
            console.log(`[useSharedContent] Successfully processed share ${share.id}`);
          } catch (error) {
            processingShares.delete(share.id);
            processedShareIds.delete(share.id); // Remove from processed if failed
            console.error(`[useSharedContent] Error processing share ${share.id}:`, error);
          }
        }
      } catch (error) {
        console.error('[useSharedContent] Error checking pending shares:', error);
      }
    };

    // Check immediately
    processPendingShares();

    // Check every 30 seconds while app is open
    const interval = setInterval(processPendingShares, 30000);

    return () => {
      clearInterval(interval);
      // Don't clear processingShares and processedShareIds on unmount
      // to prevent duplicates if component remounts quickly
    };
  }, []);
};

async function processShare(share: any, userId: string) {
  const { type, data } = share;
  
  console.log('[useSharedContent] Processing share:', { type, data });

  switch (type) {
    case 'url':
      await saveUrlToFirestore(data.url, userId);
      break;
    case 'text':
      await saveTextToFirestore(data.text, userId);
      break;
    case 'image':
      // Swift saves as 'imageUri', not 'uri'
      const imageUri = data.imageUri || data.uri;
      if (imageUri) {
        await saveImageToFirestore(imageUri, userId);
      } else {
        console.error('[useSharedContent] No imageUri found in data:', data);
      }
      break;
    default:
      console.warn(`[useSharedContent] Unknown share type: ${type}`);
  }
}

async function saveUrlToFirestore(url: string, userId: string) {
  console.log('[useSharedContent] Fetching metadata for URL:', url);
  
  // Check if this URL was already saved recently (within last 60 seconds)
  try {
    const now = Timestamp.now();
    const sixtySecondsAgo = Timestamp.fromMillis(now.toMillis() - 60000);
    
    const recentMemoriesQuery = query(
      collection(db, 'memories'),
      where('userId', '==', userId),
      where('type', '==', 'link'),
      where('date', '>', sixtySecondsAgo),
      limit(10) // Get recent links from last 60 seconds
    );
    
    const recentDocs = await getDocs(recentMemoriesQuery);
    
    // Check if any of these recent docs have the same URL
    const hasDuplicate = recentDocs.docs.some(doc => {
      const data = doc.data();
      return data.content?.url === url;
    });
    
    if (hasDuplicate) {
      console.log('[useSharedContent] URL was already saved recently, skipping duplicate');
      return;
    }
  } catch (error) {
    console.error('[useSharedContent] Error checking for duplicates:', error);
    // Continue with save if check fails
  }
  
  // Fetch Open Graph metadata
  let metadata = {
    title: url,
    description: '',
    image: '',
    publisher: ''
  };
  
  try {
    const { getLinkMetadata } = await import('../app/utils/linkPreview');
    const fetchedMetadata = await getLinkMetadata(url);
    console.log('[useSharedContent] Metadata fetched:', fetchedMetadata);
    
    if (fetchedMetadata) {
      metadata = {
        title: fetchedMetadata.title || url,
        description: fetchedMetadata.description || '',
        image: fetchedMetadata.image || '',
        publisher: fetchedMetadata.publisher || ''
      };
    }
  } catch (error) {
    console.error('[useSharedContent] Failed to fetch metadata:', error);
  }
  
  await addDoc(collection(db, 'memories'), {
    type: 'link',
    content: {
      url,
      title: metadata.title,
      description: metadata.description,
      previewImage: metadata.image,
      publisher: metadata.publisher,
    },
    date: Timestamp.now(),
    isFavorite: false,
    userId,
    sharedWith: [],
  });
  console.log('[useSharedContent] Saved URL with metadata to Firestore');
}

async function saveTextToFirestore(text: string, userId: string) {
  await addDoc(collection(db, 'memories'), {
    type: 'note',
    content: {
      text,
    },
    date: Timestamp.now(),
    isFavorite: false,
    userId,
    sharedWith: [],
  });
  console.log('[useSharedContent] Saved text to Firestore');
}

async function saveImageToFirestore(localUri: string, userId: string) {
  try {
    console.log('[useSharedContent] saveImageToFirestore called with:', localUri);
    
    // Ensure the URI has the file:// protocol
    let fileUri = localUri;
    if (!fileUri.startsWith('file://')) {
      fileUri = `file://${fileUri}`;
      console.log('[useSharedContent] Added file:// protocol:', fileUri);
    }
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    console.log('[useSharedContent] File info:', fileInfo);
    
    if (!fileInfo.exists) {
      console.error('[useSharedContent] Image file not found:', fileUri);
      return;
    }

    console.log('[useSharedContent] Saving image locally for instant access...');

    // Save to permanent local storage (DocumentDirectory)
    const permanentDir = `${FileSystem.documentDirectory}smashbook_images/`;
    
    // Create directory if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(permanentDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(permanentDir, { intermediates: true });
      console.log('[useSharedContent] Created permanent storage directory');
    }
    
    // Generate permanent filename
    const filename = `shared_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const permanentUri = `${permanentDir}${filename}`;
    
    // Copy to permanent location
    await FileSystem.copyAsync({
      from: fileUri,
      to: permanentUri
    });
    console.log('[useSharedContent] Copied to permanent storage:', permanentUri);

    // Save to Firestore with LOCAL path (instant loading!)
    await addDoc(collection(db, 'memories'), {
      type: 'photo',
      content: {
        uri: permanentUri,           // Local file path - instant access!
        caption: 'Shared from another app',
        width: null,
        height: null,
        aspectRatio: null,
        thumbnail: permanentUri,     // Same local path
      },
      date: Timestamp.now(),
      isFavorite: false,
      userId,
      sharedWith: [],
    });

    console.log('[useSharedContent] Saved to Firestore with local path:', permanentUri);

    // Clean up temporary shared file (keep permanent copy)
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      console.log('[useSharedContent] Cleaned up temporary file');
    } catch (cleanupError) {
      console.warn('[useSharedContent] Could not delete temp file:', cleanupError);
    }
  } catch (error) {
    console.error('[useSharedContent] Error saving image:', error);
    throw error;
  }
}

