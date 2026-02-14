/**
 * VocabularyTab — Vocabulary analysis tab content
 */
import { View, Text, StyleSheet } from 'react-native';

interface VocabSuggestion {
  id: string;
  word: string;
  type: string;
  definition: string;
  original: string;
  corrected: string;
}

interface VocabularyData {
  score: number;
  wordLevels: Record<string, number>;
  uniqueWords: number;
  totalWords: number;
  suggestions: VocabSuggestion[];
}

interface Props {
  data: VocabularyData;
}

const levelColors: Record<string, string> = {
  A1: '#22c55e',
  A2: '#4ade80',
  B1: '#facc15',
  B2: '#f59e0b',
  C1: '#3b82f6',
  C2: '#8b5cf6',
};

export function VocabularyTab({ data }: Props) {
  const ttr = data.totalWords > 0 ? (data.uniqueWords / data.totalWords * 100).toFixed(1) : '0';

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Unique Words</Text>
          <Text style={styles.statValue}>{data.uniqueWords}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Words</Text>
          <Text style={styles.statValue}>{data.totalWords}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>TTR</Text>
          <Text style={styles.statValue}>{ttr}%</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Word Level Distribution</Text>
      <View style={styles.levelBars}>
        {Object.entries(data.wordLevels).map(([level, pct]) => (
          <View key={level} style={styles.levelRow}>
            <Text style={[styles.levelLabel, { color: levelColors[level] || '#9ca3af' }]}>{level}</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: levelColors[level] || '#6b7280' }]} />
            </View>
            <Text style={styles.pctText}>{pct.toFixed(1)}%</Text>
          </View>
        ))}
      </View>

      {data.suggestions.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Word Suggestions</Text>
          {data.suggestions.map((s) => (
            <View key={s.id} style={styles.suggestionCard}>
              <Text style={styles.sugWord}>{s.word} <Text style={styles.sugType}>({s.type})</Text></Text>
              <Text style={styles.sugDef}>{s.definition}</Text>
              <Text style={styles.sugOriginal}>{s.original}</Text>
              <Text style={styles.sugCorrected}>→ {s.corrected}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#f3f4f6', marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#d1d5db', marginBottom: 10 },
  levelBars: { gap: 8 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelLabel: { width: 24, fontSize: 12, fontWeight: '700' },
  barBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  pctText: { width: 45, fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  suggestionCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  sugWord: { fontSize: 14, fontWeight: '700', color: '#f3f4f6' },
  sugType: { fontSize: 11, color: '#9ca3af', fontWeight: '400' },
  sugDef: { fontSize: 12, color: '#9ca3af', marginTop: 4, lineHeight: 18 },
  sugOriginal: { fontSize: 12, color: '#ef4444', marginTop: 8 },
  sugCorrected: { fontSize: 12, color: '#22c55e', fontWeight: '500', marginTop: 2 },
});
