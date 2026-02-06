/**
 * SpeakMate AI - Home Screen
 */
import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { Colors, getBandColor } from '@/constants/Colors';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { recentSessions, loadSessions, isLoading } = useSessionStore();

  useEffect(() => {
    loadSessions();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={loadSessions} />
      }
    >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.userName}>{user?.full_name || 'Student'}</Text>
        <Text style={styles.targetBand}>
          Target Band: {user?.target_band || 7.0}
        </Text>
      </View>

      {/* Quick Start */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Start</Text>
        <View style={styles.quickStartGrid}>
          <TouchableOpacity
            style={[styles.quickStartCard, { backgroundColor: '#ebf8ff' }]}
            onPress={() => router.push('/(tabs)/practice')}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#3182ce' }]}>
              <Ionicons name="chatbubbles" size={24} color="#fff" />
            </View>
            <Text style={styles.quickStartTitle}>Free Talk</Text>
            <Text style={styles.quickStartDesc}>Practice conversation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickStartCard, { backgroundColor: '#f0fff4' }]}
            onPress={() => router.push('/(tabs)/practice')}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#38a169' }]}>
              <Ionicons name="school" size={24} color="#fff" />
            </View>
            <Text style={styles.quickStartTitle}>IELTS Test</Text>
            <Text style={styles.quickStartDesc}>Full mock test</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Progress</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="time"
            value={`${Math.floor(
              recentSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / 60
            )}`}
            label="Minutes Practiced"
            color="#805ad5"
          />
          <StatCard
            icon="trending-up"
            value={recentSessions.length.toString()}
            label="Total Sessions"
            color="#dd6b20"
          />
          <StatCard
            icon="star"
            value={
              recentSessions[0]?.overall_scores?.overall_band?.toFixed(1) || '-'
            }
            label="Last Band Score"
            color="#38a169"
          />
        </View>
      </View>

      {/* Recent Sessions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          <Link href="/(tabs)/history" asChild>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {recentSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mic-off" size={48} color="#a0aec0" />
            <Text style={styles.emptyText}>No sessions yet</Text>
            <Text style={styles.emptySubtext}>
              Start practicing to see your history
            </Text>
          </View>
        ) : (
          recentSessions.slice(0, 3).map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onPress={() => router.push(`/results/${session.id}`)}
            >
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionTopic}>
                  {session.topic || 'General Practice'}
                </Text>
                <Text style={styles.sessionDate}>
                  {new Date(session.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.sessionMeta}>
                <Text style={styles.sessionDuration}>
                  {Math.floor(session.duration_seconds / 60)} min
                </Text>
                {session.overall_scores?.overall_band && (
                  <View
                    style={[
                      styles.bandBadge,
                      {
                        backgroundColor: getBandColor(
                          session.overall_scores.overall_band
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.bandText}>
                      {session.overall_scores.overall_band}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Tips */}
      <View style={styles.tipCard}>
        <Ionicons name="bulb" size={24} color="#d69e2e" />
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Tip of the Day</Text>
          <Text style={styles.tipText}>
            Practice speaking for at least 15 minutes daily. Consistency is more
            important than duration.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  welcomeSection: {
    backgroundColor: '#1a365d',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  targetBand: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    color: '#2563eb',
    marginBottom: 12,
  },
  quickStartGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickStartCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickStartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  quickStartDesc: {
    fontSize: 12,
    color: '#718096',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#718096',
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4a5568',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a0aec0',
    marginTop: 4,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTopic: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d3748',
  },
  sessionDate: {
    fontSize: 12,
    color: '#a0aec0',
    marginTop: 2,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDuration: {
    fontSize: 12,
    color: '#718096',
  },
  bandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bandText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  tipCard: {
    backgroundColor: '#fffff0',
    borderWidth: 1,
    borderColor: '#faf089',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#975a16',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#744210',
    lineHeight: 18,
  },
});
