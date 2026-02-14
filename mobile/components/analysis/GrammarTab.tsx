/**
 * GrammarTab — Grammar analysis tab content for results screen
 */
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GrammarError {
  id: string;
  type: string;
  original: string;
  corrected: string;
  explanation: string;
}

interface GrammarData {
  score: number;
  errors: GrammarError[];
  fillerWords: number;
}

interface Props {
  data: GrammarData;
}

export function GrammarTab({ data }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Grammatical Errors</Text>
          <Text style={styles.statValue}>{data.errors.length}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Filler Words</Text>
          <Text style={styles.statValue}>{data.fillerWords}</Text>
        </View>
      </View>

      {data.errors.length === 0 ? (
        <View style={styles.noErrors}>
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
          <Text style={styles.noErrorsText}>Great job! No grammar errors detected.</Text>
        </View>
      ) : (
        data.errors.map((error, index) => (
          <View key={error.id} style={styles.errorCard}>
            <Text style={styles.errorNumber}>Error #{index + 1}</Text>
            <Text style={styles.errorType}>{error.type}</Text>
            <Text style={styles.errorOriginal}>{error.original}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.errorCorrected}>{error.corrected}</Text>
            <Text style={styles.explanation}>{error.explanation}</Text>
          </View>
        ))
      )}

      <View style={styles.fillerSection}>
        <Text style={styles.fillerTitle}>
          Filler Words: {data.fillerWords} times
        </Text>
        <Text style={styles.fillerHint}>
          {data.fillerWords === 0
            ? 'Congratulations, you did not use any filler words!'
            : 'Try to reduce filler words like "um", "uh", "like"'}
        </Text>
      </View>
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
  noErrors: { alignItems: 'center', padding: 24, gap: 12 },
  noErrorsText: { fontSize: 14, color: '#22c55e', textAlign: 'center' },
  errorCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorNumber: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  errorType: { fontSize: 12, color: '#d1d5db', fontWeight: '600', marginTop: 4 },
  errorOriginal: { fontSize: 13, color: '#ef4444', textDecorationLine: 'line-through', marginTop: 8 },
  arrow: { fontSize: 12, color: '#6b7280', marginVertical: 2 },
  errorCorrected: { fontSize: 13, color: '#22c55e', fontWeight: '500' },
  explanation: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginTop: 8, lineHeight: 18 },
  fillerSection: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  fillerTitle: { fontSize: 14, fontWeight: '600', color: '#d1d5db' },
  fillerHint: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
});
