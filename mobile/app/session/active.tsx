/**
 * SpeakMate AI - Active Session (Redirect to dynamic route)
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useSessionStore } from '@/stores/sessionStore';

export default function ActiveSessionRedirect() {
  const { currentSession } = useSessionStore();

  useEffect(() => {
    if (currentSession?.id) {
      router.replace(`/session/${currentSession.id}`);
    } else {
      router.replace('/(tabs)/practice');
    }
  }, [currentSession]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
  },
});
