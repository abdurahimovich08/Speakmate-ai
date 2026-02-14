/**
 * ErrorCard — Reusable error display card
 */
import { View, Text, StyleSheet } from 'react-native';

interface ErrorCardProps {
  category: string;
  original: string;
  corrected: string;
  explanation?: string;
  severity?: string;
}

const severityColors: Record<string, string> = {
  major: '#ef4444',
  moderate: '#f59e0b',
  minor: '#6b7280',
};

export function ErrorCard({ category, original, corrected, explanation, severity = 'moderate' }: ErrorCardProps) {
  const borderColor = severityColors[severity] || severityColors.moderate;

  return (
    <View style={[styles.container, { borderLeftColor: borderColor }]}>
      <View style={styles.header}>
        <Text style={styles.category}>{category}</Text>
        <Text style={[styles.severity, { color: borderColor }]}>{severity}</Text>
      </View>
      <Text style={styles.original}>{original}</Text>
      <Text style={styles.arrow}>→</Text>
      <Text style={styles.corrected}>{corrected}</Text>
      {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d1d5db',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  severity: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  original: {
    fontSize: 14,
    color: '#ef4444',
    textDecorationLine: 'line-through',
  },
  arrow: {
    fontSize: 12,
    color: '#6b7280',
    marginVertical: 2,
  },
  corrected: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '500',
  },
  explanation: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
