/**
 * ScoreCard — Reusable IELTS score display card
 */
import { View, Text, StyleSheet } from 'react-native';

interface ScoreCardProps {
  label: string;
  score: number;
  maxScore?: number;
  color?: string;
}

export function ScoreCard({ label, score, maxScore = 9, color = '#2563eb' }: ScoreCardProps) {
  const percentage = Math.min(score / maxScore, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.score, { color }]}>{score.toFixed(1)}</Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${percentage * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  score: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
