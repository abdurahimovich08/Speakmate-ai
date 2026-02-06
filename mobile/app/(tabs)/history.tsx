/**
 * SpeakMate AI - History Screen
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/stores/sessionStore';
import { Colors, getBandColor, getCategoryColor } from '@/constants/Colors';
import type { Session, SessionMode } from '@/types';

const MODE_LABELS: Record<SessionMode, string> = {
  free_speaking: 'Free Talk',
  ielts_test: 'IELTS Test',
  training: 'Training',
};

export default function HistoryScreen() {
  const { recentSessions, loadSessions, isLoading } = useSessionStore();
  const [filter, setFilter] = useState<SessionMode | 'all'>('all');

  useEffect(() => {
    loadSessions();
  }, []);

  const filteredSessions =
    filter === 'all'
      ? recentSessions
      : recentSessions.filter((s) => s.mode === filter);

  const renderSession = ({ item: session }: { item: Session }) => {
    const date = new Date(session.created_at);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => router.push(`/results/${session.id}`)}
      >
        <View style={styles.sessionHeader}>
          <View style={styles.modeBadge}>
            <Text style={styles.modeText}>
              {MODE_LABELS[session.mode] || session.mode}
            </Text>
          </View>
          <Text style={styles.sessionDate}>{formattedDate}</Text>
        </View>

        <Text style={styles.sessionTopic}>
          {session.topic || 'General Practice'}
        </Text>

        <View style={styles.sessionFooter}>
          <View style={styles.sessionMeta}>
            <Ionicons name="time-outline" size={16} color="#718096" />
            <Text style={styles.metaText}>
              {Math.floor(session.duration_seconds / 60)} min
            </Text>
          </View>

          <View style={styles.sessionMeta}>
            <Ionicons name="calendar-outline" size={16} color="#718096" />
            <Text style={styles.metaText}>{formattedTime}</Text>
          </View>

          {session.overall_scores?.overall_band && (
            <View
              style={[
                styles.bandBadge,
                {
                  backgroundColor: getBandColor(session.overall_scores.overall_band),
                },
              ]}
            >
              <Text style={styles.bandText}>
                Band {session.overall_scores.overall_band}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTab
          label="All"
          isSelected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterTab
          label="Free Talk"
          isSelected={filter === 'free_speaking'}
          onPress={() => setFilter('free_speaking')}
        />
        <FilterTab
          label="IELTS"
          isSelected={filter === 'ielts_test'}
          onPress={() => setFilter('ielts_test')}
        />
        <FilterTab
          label="Training"
          isSelected={filter === 'training'}
          onPress={() => setFilter('training')}
        />
      </View>

      {/* Sessions List */}
      <FlatList
        data={filteredSessions}
        renderItem={renderSession}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadSessions} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#a0aec0" />
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyText}>
              Start practicing to build your history
            </Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => router.push('/(tabs)/practice')}
            >
              <Text style={styles.startButtonText}>Start Practicing</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

function FilterTab({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, isSelected && styles.filterTabSelected]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterTabText,
          isSelected && styles.filterTabTextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f7fafc',
  },
  filterTabSelected: {
    backgroundColor: '#2563eb',
  },
  filterTabText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  filterTabTextSelected: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeBadge: {
    backgroundColor: '#ebf8ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modeText: {
    fontSize: 12,
    color: '#2b6cb0',
    fontWeight: '500',
  },
  sessionDate: {
    fontSize: 12,
    color: '#a0aec0',
  },
  sessionTopic: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  sessionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#718096',
  },
  bandBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bandText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a5568',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#a0aec0',
    marginTop: 8,
  },
  startButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
