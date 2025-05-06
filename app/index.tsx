import React from 'react';
import { StyleSheet } from 'react-native';
import MemoryFeed from './components/MemoryFeed';

export default function Index() {
  return <MemoryFeed />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
}); 