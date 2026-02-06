/**
 * SpeakMate AI - Root Layout
 */
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/stores/authStore';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    async function init() {
      try {
        await initialize();
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="session/[id]"
              options={{
                headerShown: true,
                headerTitle: 'Speaking Session',
                presentation: 'fullScreenModal',
              }}
            />
            <Stack.Screen
              name="results/[id]"
              options={{
                headerShown: true,
                headerTitle: 'Session Results',
                presentation: 'card',
              }}
            />
          </>
        )}
      </Stack>
    </>
  );
}
