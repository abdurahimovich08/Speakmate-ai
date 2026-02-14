/**
 * CoachingTipBubble — Real-time coaching tip in session
 */
import { View, Text, StyleSheet } from 'react-native';

interface CoachingTipBubbleProps {
  category: string;
  original: string;
  corrected: string;
  tip: string;
  severity: string;
  strategy: string;
}

export function CoachingTipBubble({ category, original, corrected, tip, severity, strategy }: CoachingTipBubbleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.bulb}>💡</Text>
        <Text style={styles.label}>Coaching Tip</Text>
        <Text style={styles.badge}>{strategy}</Text>
      </View>
      {original ? (
        <View style={styles.correction}>
          <Text style={styles.original}>{original}</Text>
          <Text style={styles.arrow}> → </Text>
          <Text style={styles.corrected}>{corrected}</Text>
        </View>
      ) : null}
      <Text style={styles.tipText}>{tip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    borderColor: 'rgba(234, 179, 8, 0.3)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginVertical: 6,
    marginHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  bulb: {
    fontSize: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#eab308',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  badge: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ca8a04',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  correction: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 6,
  },
  original: {
    fontSize: 13,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  arrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  corrected: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
  },
  tipText: {
    fontSize: 12,
    color: '#d1d5db',
    lineHeight: 18,
  },
});
