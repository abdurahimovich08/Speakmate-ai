/**
 * PronunciationTab — Pronunciation analysis tab content
 */
import { View, Text, StyleSheet } from 'react-native';

interface WordToImprove {
  word: string;
  ipa: string;
  accuracy: number;
}

interface PronunciationData {
  score: number;
  wordsToImprove: WordToImprove[];
  overallClarity: number;
  intonation: number;
}

interface Props {
  data: PronunciationData;
}

function getAccuracyColor(accuracy: number) {
  if (accuracy >= 70) return '#22c55e';
  if (accuracy >= 40) return '#f59e0b';
  return '#ef4444';
}

export function PronunciationTab({ data }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Clarity</Text>
          <Text style={styles.statValue}>{data.overallClarity}%</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Intonation</Text>
          <Text style={styles.statValue}>{data.intonation}%</Text>
        </View>
      </View>

      {data.wordsToImprove.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Words to Improve</Text>
          {data.wordsToImprove.map((w) => (
            <View key={w.word} style={styles.wordCard}>
              <View style={styles.wordHeader}>
                <Text style={styles.word}>{w.word}</Text>
                <Text style={styles.ipa}>/{w.ipa}/</Text>
              </View>
              <View style={styles.accuracyRow}>
                <View style={styles.barBg}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${w.accuracy}%`, backgroundColor: getAccuracyColor(w.accuracy) },
                    ]}
                  />
                </View>
                <Text style={[styles.accuracyText, { color: getAccuracyColor(w.accuracy) }]}>
                  {w.accuracy}%
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {data.wordsToImprove.length === 0 && (
        <View style={styles.noIssues}>
          <Text style={styles.noIssuesText}>Great pronunciation! No major issues detected.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#f3f4f6', marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#d1d5db', marginBottom: 12 },
  wordCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  wordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  word: { fontSize: 16, fontWeight: '700', color: '#f3f4f6' },
  ipa: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },
  accuracyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  barBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  accuracyText: { fontSize: 13, fontWeight: '700', width: 45, textAlign: 'right' },
  noIssues: { padding: 24, alignItems: 'center' },
  noIssuesText: { fontSize: 14, color: '#22c55e', textAlign: 'center' },
});
