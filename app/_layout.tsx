import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { auth } from '../constants/Firebase';

import { useColorScheme } from '@/hooks/useColorScheme';

// Simpler version until we fix all issues
const initializeImageCache = async () => {
  try {
    // Basic directory creation only
    const cacheDir = `${FileSystem.cacheDirectory}image-cache/`;
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, {
        intermediates: true,
      });
    }
    
    return true;
  } catch (error) {
    // Return true anyway to not block app loading
    return true;
  }
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isCacheInitialized, setIsCacheInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // Initialize the image cache system just once
  useEffect(() => {
    let isMounted = true;
    
    const initCache = async () => {
      if (!isCacheInitialized) {
        const success = await initializeImageCache();
        if (isMounted) {
          setIsCacheInitialized(success);
        }
      }
    };
    
    initCache();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [isCacheInitialized]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated === null) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else {
      router.replace('/');
    }
  }, [isAuthenticated]);

  // Show nothing while loading fonts or checking authentication
  if (!loaded || isAuthenticated === null) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
