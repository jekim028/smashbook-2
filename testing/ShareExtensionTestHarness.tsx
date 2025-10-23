/**
 * Share Extension Test Harness
 * Use this component to test your share extension UI and functionality
 * without having to actually share from other apps
 */

import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { logger } from '../utils/logger';
import { SharedContent, sharedStorage } from '../utils/sharedStorage';

const COLORS = {
  background: '#fdfcf8',
  card: '#FFFFFF',
  text: '#1A3140',
  secondaryText: '#8E8E93',
  accent: '#FF914D',
  success: '#34C759',
  error: '#FF3B30',
  border: '#E5E5EA',
};

export default function ShareExtensionTestHarness() {
  const [pendingShares, setPendingShares] = useState<SharedContent[]>([]);
  const [testUrl, setTestUrl] = useState('https://www.example.com/article');
  const [testText, setTestText] = useState('Check out this interesting article!');
  const [stats, setStats] = useState({ pending: 0, processed: 0, lastSync: null as number | null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const pending = await sharedStorage.getPendingShares();
      setPendingShares(pending);
      
      const storageStats = await sharedStorage.getStorageStats();
      setStats(storageStats);
      
      logger.info('Loaded test harness data', { pending: pending.length });
    } catch (error) {
      logger.error('Failed to load test harness data', error);
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const simulateUrlShare = async () => {
    try {
      logger.info('Simulating URL share', { url: testUrl });
      
      const id = await sharedStorage.saveSharedContent({
        type: 'url',
        caption: 'Test URL share from harness',
        data: { url: testUrl },
        metadata: { sourceApp: 'TestHarness' },
      });

      Alert.alert('Success', `Saved URL share with ID: ${id}`);
      await loadData();
    } catch (error) {
      logger.error('Failed to simulate URL share', error);
      Alert.alert('Error', 'Failed to save URL share');
    }
  };

  const simulateTextShare = async () => {
    try {
      logger.info('Simulating text share', { text: testText });
      
      const id = await sharedStorage.saveSharedContent({
        type: 'text',
        caption: 'Test text share from harness',
        data: { text: testText },
        metadata: { sourceApp: 'TestHarness' },
      });

      Alert.alert('Success', `Saved text share with ID: ${id}`);
      await loadData();
    } catch (error) {
      logger.error('Failed to simulate text share', error);
      Alert.alert('Error', 'Failed to save text share');
    }
  };

  const simulateImageShare = async () => {
    try {
      logger.info('Simulating image share');
      
      const id = await sharedStorage.saveSharedContent({
        type: 'image',
        caption: 'Test image share from harness',
        data: { 
          imageUri: 'file:///path/to/test/image.jpg',
          filename: 'test-image.jpg',
        },
        metadata: { sourceApp: 'TestHarness' },
      });

      Alert.alert('Success', `Saved image share with ID: ${id}`);
      await loadData();
    } catch (error) {
      logger.error('Failed to simulate image share', error);
      Alert.alert('Error', 'Failed to save image share');
    }
  };

  const markShareProcessed = async (shareId: string) => {
    try {
      await sharedStorage.markAsProcessed(shareId);
      Alert.alert('Success', 'Share marked as processed');
      await loadData();
    } catch (error) {
      logger.error('Failed to mark share as processed', error);
      Alert.alert('Error', 'Failed to mark as processed');
    }
  };

  const clearAllPending = async () => {
    Alert.alert(
      'Clear All Pending',
      'Are you sure you want to clear all pending shares?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await sharedStorage.clearPendingShares();
              Alert.alert('Success', 'Cleared all pending shares');
              await loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear pending shares');
            }
          },
        },
      ]
    );
  };

  const viewLogs = () => {
    const logs = logger.getLogsAsString();
    Alert.alert('Debug Logs', logs || 'No logs available', [{ text: 'OK' }]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Share Extension Test Harness</Text>
        <Text style={styles.subtitle}>Test share functionality without leaving the app</Text>
      </View>

      {/* Storage Stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Storage Statistics</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Pending Shares:</Text>
          <Text style={styles.statsValue}>{stats.pending}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Processed Shares:</Text>
          <Text style={styles.statsValue}>{stats.processed}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Last Sync:</Text>
          <Text style={styles.statsValue}>
            {stats.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never'}
          </Text>
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={loadData}>
          <Text style={styles.secondaryButtonText}>Refresh Stats</Text>
        </TouchableOpacity>
      </View>

      {/* Simulate Shares */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Simulate Shares</Text>
        
        <Text style={styles.inputLabel}>URL to Share:</Text>
        <TextInput
          style={styles.input}
          value={testUrl}
          onChangeText={setTestUrl}
          placeholder="https://example.com"
          placeholderTextColor={COLORS.secondaryText}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={simulateUrlShare}>
          <Text style={styles.primaryButtonText}>Share URL</Text>
        </TouchableOpacity>

        <Text style={styles.inputLabel}>Text to Share:</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={testText}
          onChangeText={setTestText}
          placeholder="Enter text to share..."
          placeholderTextColor={COLORS.secondaryText}
          multiline
        />
        <TouchableOpacity style={styles.primaryButton} onPress={simulateTextShare}>
          <Text style={styles.primaryButtonText}>Share Text</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={simulateImageShare}>
          <Text style={styles.primaryButtonText}>Share Mock Image</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Shares List */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Pending Shares ({pendingShares.length})</Text>
          {pendingShares.length > 0 && (
            <TouchableOpacity onPress={clearAllPending}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {pendingShares.length === 0 ? (
          <Text style={styles.emptyText}>No pending shares</Text>
        ) : (
          pendingShares.map((share) => (
            <View key={share.id} style={styles.shareItem}>
              <View style={styles.shareInfo}>
                <Text style={styles.shareType}>{share.type.toUpperCase()}</Text>
                <Text style={styles.shareTime}>
                  {new Date(share.timestamp).toLocaleTimeString()}
                </Text>
                <Text style={styles.shareData} numberOfLines={2}>
                  {share.data.url || share.data.text || share.data.filename || 'No data'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.processButton}
                onPress={() => markShareProcessed(share.id)}
              >
                <Text style={styles.processButtonText}>Mark Processed</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Debug Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Debug Actions</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={viewLogs}>
          <Text style={styles.secondaryButtonText}>View Debug Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => logger.clearLogs()}>
          <Text style={styles.secondaryButtonText}>Clear Logs</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.secondaryText,
  },
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statsLabel: {
    fontSize: 14,
    color: COLORS.secondaryText,
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  clearText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
    paddingVertical: 20,
  },
  shareItem: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  shareInfo: {
    marginBottom: 8,
  },
  shareType: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: 4,
  },
  shareTime: {
    fontSize: 11,
    color: COLORS.secondaryText,
    marginBottom: 4,
  },
  shareData: {
    fontSize: 13,
    color: COLORS.text,
  },
  processButton: {
    backgroundColor: COLORS.success,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  processButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    height: 40,
  },
});

