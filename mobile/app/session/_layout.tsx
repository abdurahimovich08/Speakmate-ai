/**
 * SpeakMate AI - Session Layout
 */
import { Stack } from 'expo-router';

export default function SessionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'fullScreenModal',
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen name="[id]" />
      <Stack.Screen name="active" />
    </Stack>
  );
}
