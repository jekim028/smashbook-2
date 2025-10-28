import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * Catch-all route for shared day links
 * Redirects to home page
 */
export default function SharedDayRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home immediately
    router.replace('/');
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fdfcf8' }}>
      <ActivityIndicator size="large" color="#FF914D" />
    </View>
  );
}

