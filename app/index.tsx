import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import MemoryFeed from './components/MemoryFeed';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <MemoryFeed />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
}); 