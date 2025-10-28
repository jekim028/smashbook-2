/**
 * Shared Storage utility for Share Extension <-> Main App communication
 * Uses App Groups to share data between the share extension and main app
 * This enables offline-first, background saving without opening the main app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { NativeModules, Platform } from 'react-native';
import { logger } from './logger';

// App Group identifier - MUST match the one in your iOS entitlements
const APP_GROUP_ID = 'group.com.juliarhee.smashbook2';

const { AppGroupBridge } = NativeModules;

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
      console.log('[sharedStorage] Initializing App Group...');
      
      if (Platform.OS !== 'ios') {
        console.log('[sharedStorage] Not on iOS, skipping App Group');
        this.appGroupPath = null;
        return;
      }
      
      if (!AppGroupBridge) {
        console.error('[sharedStorage] AppGroupBridge native module not found!');
        this.appGroupPath = null;
        return;
      }
      
      // Use native module to get the ACTUAL App Group container path
      const nativePath = await AppGroupBridge.getAppGroupPath(APP_GROUP_ID);
      console.log('[sharedStorage] Native App Group path:', nativePath);
      
      // Ensure path ends with /
      this.appGroupPath = nativePath.endsWith('/') ? nativePath : `${nativePath}/`;
      console.log('[sharedStorage] Set appGroupPath:', this.appGroupPath);
      
      // Verify the directory exists
      const dirInfo = await FileSystem.getInfoAsync(this.appGroupPath);
      console.log('[sharedStorage] Directory info:', dirInfo);
      
      if (dirInfo.exists) {
        console.log('[sharedStorage] ✅ App Group directory verified');
        logger.info('App Group initialized', { path: this.appGroupPath });
      } else {
        console.warn('[sharedStorage] ⚠️ App Group path does not exist');
        this.appGroupPath = null;
      }
    } catch (error) {
      console.error('[sharedStorage] ❌ Failed to initialize App Group:', error);
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
   * Reads from the JSON file that the Swift share extension writes to
   */
  async getPendingShares(): Promise<SharedContent[]> {
    try {
      console.log('[sharedStorage] getPendingShares called');
      console.log('[sharedStorage] appGroupPath:', this.appGroupPath);
      
      if (!this.appGroupPath) {
        console.log('[sharedStorage] No appGroupPath, using AsyncStorage fallback');
        // Fallback to AsyncStorage if App Group isn't available
        const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SHARES);
        return data ? JSON.parse(data) : [];
      }

      // Read from the JSON file that Swift writes to
      const pendingSharesFile = `${this.appGroupPath}pending_shares.json`;
      console.log('[sharedStorage] Looking for file at:', pendingSharesFile);
      
      const fileInfo = await FileSystem.getInfoAsync(pendingSharesFile);
      console.log('[sharedStorage] File info:', fileInfo);
      
      if (!fileInfo.exists) {
        console.log('[sharedStorage] File does not exist');
        logger.debug('No pending shares file found');
        return [];
      }

      const content = await FileSystem.readAsStringAsync(pendingSharesFile);
      console.log('[sharedStorage] File content length:', content.length);
      const shares = JSON.parse(content);
      console.log('[sharedStorage] Parsed shares count:', shares.length);
      
      logger.debug('Read pending shares from file', { count: shares.length });
      return shares;
    } catch (error) {
      console.error('[sharedStorage] Error in getPendingShares:', error);
      logger.error('Failed to get pending shares', error);
      return [];
    }
  }

  /**
   * Update pending shares list
   * Writes to the same JSON file that Swift reads from
   */
  private async setPendingShares(shares: SharedContent[]): Promise<void> {
    try {
      if (!this.appGroupPath) {
        // Fallback to AsyncStorage
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SHARES, JSON.stringify(shares));
        return;
      }

      // Write to the JSON file that Swift uses
      const pendingSharesFile = `${this.appGroupPath}pending_shares.json`;
      await FileSystem.writeAsStringAsync(
        pendingSharesFile,
        JSON.stringify(shares, null, 2)
      );
      
      logger.debug('Updated pending shares file', { count: shares.length });
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

