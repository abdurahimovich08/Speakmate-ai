/**
 * SpeakMate AI - Session Results Screen
 */
import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/stores/sessionStore';
import { api } from '@/services/api';
import { Colors, getBandColor, getCategoryColor } from '@/constants/Colors';
import type { DetectedError, ErrorCategory } from '@/types';

const CATEGORY_ICONS: Record<ErrorCategory, string> = {
  pronunciation: 'volume-high',
  grammar: 'document-text',
  vocabulary: 'book',
  fluency: 'pulse',
};

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  pronunciation: 'Pronunciation',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  fluency: 'Fluency',
};

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    feedback,
    errors,
    scores,
    loadSessionFeedback,
    isLoading,
    clearSession,
  } = useSessionStore();

  useEffect(() => {
    if (id) {
      loadSessionFeedback(id);
    }
  }, [id]);

  useEffect(() => {
    return () => {
      clearSession();
    };
  }, []);

  const handleGeneratePdf = async () => {
    try {
      const result = await api.generatePdfReport(id!, true);
      Alert.alert('Success', 'PDF report generated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate PDF');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I scored Band ${scores?.overall_band || '-'} in my IELTS speaking practice on SpeakMate AI!`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handlePracticeAgain = () => {
    router.replace('/(tabs)/practice');
  };

  // Group errors by category
  const errorsByCategory = errors.reduce((acc, error) => {
    const cat = error.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(error);
    return acc;
  }, {} as Record<ErrorCategory, DetectedError[]>);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Score Summary */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Overall Band Score</Text>
        <View
          style={[
            styles.scoreBadge,
            { backgroundColor: getBandColor(scores?.overall_band || 0) },
          ]}
        >
          <Text style={styles.scoreValue}>{scores?.overall_band || '-'}</Text>
        </View>
        <Text style={styles.scoreHint}>
          {getScoreMessage(scores?.overall_band || 0)}
        </Text>
      </View>

      {/* Detailed Scores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Score Breakdown</Text>
        <View style={styles.scoresGrid}>
          <ScoreItem
            label="Fluency & Coherence"
            score={scores?.fluency_coherence}
            icon="pulse"
          />
          <ScoreItem
            label="Lexical Resource"
            score={scores?.lexical_resource}
            icon="book"
          />
          <ScoreItem
            label="Grammar"
            score={scores?.grammatical_range}
            icon="document-text"
          />
          <ScoreItem
            label="Pronunciation"
            score={scores?.pronunciation}
            icon="volume-high"
          />
        </View>
      </View>

      {/* Error Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Errors Detected ({errors.length})
        </Text>

        {errors.length === 0 ? (
          <View style={styles.noErrors}>
            <Ionicons name="checkmark-circle" size={48} color="#38a169" />
            <Text style={styles.noErrorsText}>Great job! No major errors detected.</Text>
          </View>
        ) : (
          <View style={styles.errorCategories}>
            {Object.entries(errorsByCategory).map(([category, catErrors]) => (
              <TouchableOpacity
                key={category}
                style={styles.categoryCard}
                onPress={() => {
                  // Could expand to show details
                }}
              >
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: getCategoryColor(category) + '20' },
                  ]}
                >
                  <Ionicons
                    name={CATEGORY_ICONS[category as ErrorCategory] as any}
                    size={24}
                    color={getCategoryColor(category)}
                  />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>
                    {CATEGORY_LABELS[category as ErrorCategory]}
                  </Text>
                  <Text style={styles.categoryCount}>
                    {catErrors.length} {catErrors.length === 1 ? 'error' : 'errors'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Top Errors */}
      {errors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Corrections</Text>
          {errors.slice(0, 5).map((error, index) => (
            <ErrorCard key={error.id || index} error={error} />
          ))}
          {errors.length > 5 && (
            <Text style={styles.moreErrors}>
              + {errors.length - 5} more errors in detailed report
            </Text>
          )}
        </View>
      )}

      {/* Recommendations */}
      {feedback?.recommendations && feedback.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          <View style={styles.recommendationsCard}>
            {feedback.recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendation}>
                <Ionicons name="bulb" size={20} color="#d69e2e" />
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={handlePracticeAgain}>
          <Ionicons name="mic" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Practice Again</Text>
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleGeneratePdf}>
            <Ionicons name="document" size={20} color="#2563eb" />
            <Text style={styles.secondaryButtonText}>Get PDF Report</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#2563eb" />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function ScoreItem({
  label,
  score,
  icon,
}: {
  label: string;
  score?: number;
  icon: string;
}) {
  return (
    <View style={styles.scoreItem}>
      <Ionicons name={icon as any} size={20} color={getBandColor(score || 0)} />
      <Text style={styles.scoreItemLabel}>{label}</Text>
      <Text
        style={[styles.scoreItemValue, { color: getBandColor(score || 0) }]}
      >
        {score?.toFixed(1) || '-'}
      </Text>
    </View>
  );
}

function ErrorCard({ error }: { error: DetectedError }) {
  return (
    <View style={styles.errorCard}>
      <View style={styles.errorHeader}>
        <View
          style={[
            styles.errorCategoryBadge,
            { backgroundColor: getCategoryColor(error.category) + '20' },
          ]}
        >
          <Text
            style={[
              styles.errorCategoryText,
              { color: getCategoryColor(error.category) },
            ]}
          >
            {CATEGORY_LABELS[error.category]}
          </Text>
        </View>
      </View>

      <View style={styles.errorContent}>
        <View style={styles.errorRow}>
          <Ionicons name="close-circle" size={16} color="#e53e3e" />
          <Text style={styles.errorOriginal}>{error.original_text}</Text>
        </View>

        <View style={styles.errorRow}>
          <Ionicons name="checkmark-circle" size={16} color="#38a169" />
          <Text style={styles.errorCorrected}>{error.corrected_text}</Text>
        </View>

        {error.explanation && (
          <Text style={styles.errorExplanation}>{error.explanation}</Text>
        )}
      </View>
    </View>
  );
}

function getScoreMessage(band: number): string {
  if (band >= 8) return 'Excellent! Expert user level';
  if (band >= 7) return 'Very good! Effective operational proficiency';
  if (band >= 6) return 'Good! Competent user level';
  if (band >= 5) return 'Modest! Limited but effective';
  if (band >= 4) return 'Keep practicing! Limited proficiency';
  return 'Start building your foundation!';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  scoreCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 12,
  },
  scoreBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoreHint: {
    fontSize: 14,
    color: '#4a5568',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  scoresGrid: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f7fafc',
  },
  scoreItemLabel: {
    flex: 1,
    fontSize: 14,
    color: '#4a5568',
    marginLeft: 12,
  },
  scoreItemValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  noErrors: {
    backgroundColor: '#f0fff4',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  noErrorsText: {
    fontSize: 16,
    color: '#276749',
    marginTop: 12,
  },
  errorCategories: {
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d3748',
  },
  categoryCount: {
    fontSize: 13,
    color: '#718096',
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  errorHeader: {
    marginBottom: 12,
  },
  errorCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  errorCategoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorContent: {
    gap: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorOriginal: {
    flex: 1,
    fontSize: 14,
    color: '#c53030',
    textDecorationLine: 'line-through',
  },
  errorCorrected: {
    flex: 1,
    fontSize: 14,
    color: '#276749',
    fontWeight: '500',
  },
  errorExplanation: {
    fontSize: 13,
    color: '#718096',
    fontStyle: 'italic',
    marginTop: 4,
    paddingLeft: 24,
  },
  moreErrors: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
  },
  recommendationsCard: {
    backgroundColor: '#fffff0',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#744210',
    lineHeight: 20,
  },
  actions: {
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
});
