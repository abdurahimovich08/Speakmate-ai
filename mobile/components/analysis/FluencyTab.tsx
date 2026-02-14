/**
 * FluencyTab — Fluency analysis tab content
 */
import { View, Text, StyleSheet } from 'react-native';

interface FluencyData {
  score: number;
  wordsPerMinute: number;
  syllablesPerMinute: number;
  awkwardPauses: number;
  improvedSpeech: string;
  speakingRate: 'slow' | 'normal' | 'fast';
}

interface Props {
  data: FluencyData;
}

function getRateInfo(wpm: number) {
  if (wpm < 100) return { text: 'Slow', color: '#f59e0b' };
  if (wpm > 160) return { text: 'Fast', color: '#ef4444' };
  return { text: 'Normal', color: '#22c55e' };
}

export function FluencyTab({ data }: Props) {
  const rate = getRateInfo(data.wordsPerMinute);

  return (
    <View style={styles.container}>
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Words/Min</Text>
          <Text style={[styles.statValue, { color: rate.color }]}>{data.wordsPerMinute}</Text>
          <Text style={[styles.statBadge, { color: rate.color }]}>{rate.text}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Syllables/Min</Text>
          <Text style={styles.statValue}>{data.syllablesPerMinute}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Awkward Pauses</Text>
          <Text style={styles.statValue}>{data.awkwardPauses}</Text>
        </View>
      </View>

      {data.improvedSpeech ? (
        <View style={styles.improvedSection}>
          <Text style={styles.sectionTitle}>Improved Version</Text>
          <Text style={styles.improvedText}>{data.improvedSpeech}</Text>
        </View>
      ) : null}

      <View style={styles.tipCard}>
        <Text style={styles.sectionTitle}>Tips</Text>
        <Text style={styles.tipText}>
          {data.wordsPerMinute < 100
            ? 'Try to speak a bit faster. Natural pace is 120-160 words/minute.'
            : data.wordsPerMinute > 160
              ? 'Slow down slightly for clarity. Aim for 120-160 words/minute.'
              : 'Great speaking pace! Keep maintaining this rhythm.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16 },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#f3f4f6', marginTop: 4 },
  statBadge: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  improvedSection: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#d1d5db', marginBottom: 8 },
  improvedText: { fontSize: 13, color: '#22c55e', lineHeight: 20 },
  tipCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
  },
  tipText: { fontSize: 13, color: '#d1d5db', lineHeight: 20 },
});
