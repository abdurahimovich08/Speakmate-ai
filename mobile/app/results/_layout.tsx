/**
 * Results Layout - Analysis screens
 */
import { Stack } from 'expo-router';

export default function ResultsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#111827' },
      }}
    >
      <Stack.Screen name="analysis" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
