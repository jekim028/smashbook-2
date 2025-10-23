/**
 * Shared Storage utility for Share Extension <-> Main App communication
 * Uses App Groups to share data between the share extension and main app
 * This enables offline-first, background saving without opening the main app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { logger } from './logger';

// App Group identifier - MUST match the one in your iOS entitlements
const APP_GROUP_ID = 'group.com.esi.smashbook2';

// Storage keys
const STORAGE_KEYS = {
  PENDING_SHARES: 'pendingShares',
  PROCESSED_SHARES: 'processedShares',
  LAST_SYNC: 'lastSync',
} as const;

export interface SharedContent {
  id: string;
  type: 'url' | 'text' | 'image' | 'video';
  timestamp: number;
  caption?: string;
  data: {
    url?: string;
    text?: string;
    imageUri?: string;
    videoUri?: string;
    filename?: string;
  };
  metadata?: {
    sourceApp?: string;
    userId?: string;
  };
  processed: boolean;
}

class SharedStorage {
  private appGroupPath: string | null = null;

  constructor() {
    this.initializeAppGroup();
  }

  /**
   * Initialize App Group directory path
   */
  private async initializeAppGroup() {
    try {
      // On iOS, we need to use the App Group container
      // FileSystem.documentDirectory is the default, but for App Groups:
      this.appGroupPath = `${FileSystem.documentDirectory}../../Shared/AppGroup/${APP_GROUP_ID}/`;
      
      // Ensure the directory exists
      const dirInfo = await FileSystem.getInfoAsync(this.appGroupPath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.appGroupPath, { intermediates: true });
        logger.info('Created App Group directory', { path: this.appGroupPath });
      }
    } catch (error) {
      logger.error('Failed to initialize App Group', error);
      // Fallback to AsyncStorage only
      this.appGroupPath = null;
    }
  }

  /**
   * Save shared content from share extension
   */
  async saveSharedContent(content: Omit<SharedContent, 'id' | 'timestamp' | 'processed'>): Promise<string> {
    try {
      const id = this.generateId();
      const sharedContent: SharedContent = {
        id,
        timestamp: Date.now(),
        processed: false,
        ...content,
      };

      logger.info('Saving shared content', { id, type: content.type });

      // Get existing pending shares
      const pending = await this.getPendingShares();
      pending.push(sharedContent);

      // Save to storage
      await this.setPendingShares(pending);

      // If there's a file (image/video), copy it to shared storage
      if (content.data.imageUri || content.data.videoUri) {
        const fileUri = content.data.imageUri || content.data.videoUri;
        if (fileUri) {
          await this.copyFileToSharedStorage(fileUri, id);
        }
      }

      logger.info('Successfully saved shared content', { id });
      return id;
    } catch (error) {
      logger.error('Failed to save shared content', error);
      throw error;
    }
  }

  /**
   * Get all pending (unprocessed) shares
   */
  async getPendingShares(): Promise<SharedContent[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SHARES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('Failed to get pending shares', error);
      return [];
    }
  }

  /**
   * Update pending shares list
   */
  private async setPendingShares(shares: SharedContent[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SHARES, JSON.stringify(shares));
      logger.debug('Updated pending shares', { count: shares.length });
    } catch (error) {
      logger.error('Failed to set pending shares', error);
      throw error;
    }
  }

  /**
   * Mark a share as processed (called by main app)
   */
  async markAsProcessed(shareId: string): Promise<void> {
    try {
      const pending = await this.getPendingShares();
      const updatedPending = pending.filter(share => share.id !== shareId);
      
      const processed = await this.getProcessedShares();
      const processedShare = pending.find(share => share.id === shareId);
      
      if (processedShare) {
        processedShare.processed = true;
        processed.push(processedShare);
        
        // Keep only last 50 processed shares for reference
        if (processed.length > 50) {
          processed.shift();
        }
        
        await AsyncStorage.setItem(STORAGE_KEYS.PROCESSED_SHARES, JSON.stringify(processed));
      }
      
      await this.setPendingShares(updatedPending);
      logger.info('Marked share as processed', { shareId });
    } catch (error) {
      logger.error('Failed to mark share as processed', error);
      throw error;
    }
  }

  /**
   * Get processed shares history
   */
  async getProcessedShares(): Promise<SharedContent[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROCESSED_SHARES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('Failed to get processed shares', error);
      return [];
    }
  }

  /**
   * Clear all pending shares (use with caution)
   */
  async clearPendingShares(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_SHARES);
      logger.info('Cleared all pending shares');
    } catch (error) {
      logger.error('Failed to clear pending shares', error);
      throw error;
    }
  }

  /**
   * Copy a file to shared storage
   */
  private async copyFileToSharedStorage(sourceUri: string, id: string): Promise<string | null> {
    try {
      if (!this.appGroupPath) {
        logger.warn('App Group path not available, skipping file copy');
        return null;
      }

      const filename = sourceUri.split('/').pop() || `${id}_file`;
      const destination = `${this.appGroupPath}${id}_${filename}`;

      await FileSystem.copyAsync({
        from: sourceUri,
        to: destination,
      });

      logger.info('Copied file to shared storage', { destination });
      return destination;
    } catch (error) {
      logger.error('Failed to copy file to shared storage', error);
      return null;
    }
  }

  /**
   * Get file from shared storage
   */
  async getSharedFile(shareId: string): Promise<string | null> {
    try {
      if (!this.appGroupPath) {
        return null;
      }

      const files = await FileSystem.readDirectoryAsync(this.appGroupPath);
      const matchingFile = files.find(file => file.startsWith(shareId));
      
      if (matchingFile) {
        return `${this.appGroupPath}${matchingFile}`;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get shared file', error);
      return null;
    }
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      logger.error('Failed to update last sync', error);
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSync(): Promise<number | null> {
    try {
      const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      logger.error('Failed to get last sync', error);
      return null;
    }
  }

  /**
   * Generate unique ID for shared content
   */
  private generateId(): string {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{ pending: number; processed: number; lastSync: number | null }> {
    const pending = await this.getPendingShares();
    const processed = await this.getProcessedShares();
    const lastSync = await this.getLastSync();

    return {
      pending: pending.length,
      processed: processed.length,
      lastSync,
    };
  }
}

// Export singleton instance
export const sharedStorage = new SharedStorage();
export default sharedStorage;

