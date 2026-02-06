/**
 * SpeakMate AI - Practice Screen
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/stores/sessionStore';
import { Colors } from '@/constants/Colors';
import type { SessionMode } from '@/types';

const TOPICS = [
  { id: 'general', label: 'General Conversation', icon: 'chatbubbles' },
  { id: 'work', label: 'Work & Career', icon: 'briefcase' },
  { id: 'education', label: 'Education', icon: 'school' },
  { id: 'travel', label: 'Travel', icon: 'airplane' },
  { id: 'technology', label: 'Technology', icon: 'phone-portrait' },
  { id: 'environment', label: 'Environment', icon: 'leaf' },
  { id: 'health', label: 'Health & Lifestyle', icon: 'fitness' },
  { id: 'hobbies', label: 'Hobbies & Free Time', icon: 'game-controller' },
];

export default function PracticeScreen() {
  const [selectedMode, setSelectedMode] = useState<SessionMode>('free_speaking');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const { startSession, isLoading } = useSessionStore();

  const handleStartSession = async () => {
    const topic = customTopic || selectedTopic || 'general';

    try {
      await startSession(selectedMode, topic);
      router.push(`/session/active`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start session');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Mode</Text>
        <View style={styles.modeGrid}>
          <ModeCard
            icon="chatbubbles"
            title="Free Speaking"
            description="Practice conversation with AI"
            isSelected={selectedMode === 'free_speaking'}
            onPress={() => setSelectedMode('free_speaking')}
            color="#3182ce"
          />
          <ModeCard
            icon="school"
            title="IELTS Test"
            description="Full mock speaking test"
            isSelected={selectedMode === 'ielts_test'}
            onPress={() => setSelectedMode('ielts_test')}
            color="#38a169"
          />
          <ModeCard
            icon="fitness"
            title="Training"
            description="Fix your common errors"
            isSelected={selectedMode === 'training'}
            onPress={() => setSelectedMode('training')}
            color="#805ad5"
          />
        </View>
      </View>

      {/* Topic Selection */}
      {selectedMode === 'free_speaking' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Topic</Text>
          <View style={styles.topicGrid}>
            {TOPICS.map((topic) => (
              <TouchableOpacity
                key={topic.id}
                style={[
                  styles.topicCard,
                  selectedTopic === topic.id && styles.topicCardSelected,
                ]}
                onPress={() => {
                  setSelectedTopic(topic.id);
                  setCustomTopic('');
                }}
              >
                <Ionicons
                  name={topic.icon as any}
                  size={24}
                  color={selectedTopic === topic.id ? '#2563eb' : '#718096'}
                />
                <Text
                  style={[
                    styles.topicLabel,
                    selectedTopic === topic.id && styles.topicLabelSelected,
                  ]}
                >
                  {topic.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Topic */}
          <View style={styles.customTopicContainer}>
            <Text style={styles.orText}>or enter your own topic</Text>
            <TextInput
              style={styles.customTopicInput}
              placeholder="Type your topic..."
              placeholderTextColor="#a0aec0"
              value={customTopic}
              onChangeText={(text) => {
                setCustomTopic(text);
                if (text) setSelectedTopic(null);
              }}
            />
          </View>
        </View>
      )}

      {/* IELTS Mode Info */}
      {selectedMode === 'ielts_test' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IELTS Speaking Test</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color="#4a5568" />
              <Text style={styles.infoText}>Part 1: 4-5 minutes (Introduction)</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="document-text" size={20} color="#4a5568" />
              <Text style={styles.infoText}>Part 2: 3-4 minutes (Cue Card)</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#4a5568" />
              <Text style={styles.infoText}>Part 3: 4-5 minutes (Discussion)</Text>
            </View>
          </View>
        </View>
      )}

      {/* Training Mode Info */}
      {selectedMode === 'training' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training Mode</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Focus on Your Weak Areas</Text>
            <Text style={styles.infoDescription}>
              Based on your previous sessions, we'll create personalized exercises
              to help you improve your most common errors.
            </Text>
          </View>
        </View>
      )}

      {/* Start Button */}
      <TouchableOpacity
        style={[styles.startButton, isLoading && styles.startButtonDisabled]}
        onPress={handleStartSession}
        disabled={isLoading}
      >
        <Ionicons name="mic" size={24} color="#fff" />
        <Text style={styles.startButtonText}>
          {isLoading ? 'Starting...' : 'Start Session'}
        </Text>
      </TouchableOpacity>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Tips for Better Practice</Text>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Find a quiet place with minimal background noise
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Speak clearly and at a natural pace
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Don't worry about mistakes - they help you learn
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function ModeCard({
  icon,
  title,
  description,
  isSelected,
  onPress,
  color,
}: {
  icon: string;
  title: string;
  description: string;
  isSelected: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.modeCard,
        isSelected && { borderColor: color, borderWidth: 2 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.modeIcon, { backgroundColor: isSelected ? color : '#e2e8f0' }]}>
        <Ionicons
          name={icon as any}
          size={24}
          color={isSelected ? '#fff' : '#718096'}
        />
      </View>
      <Text style={[styles.modeTitle, isSelected && { color }]}>{title}</Text>
      <Text style={styles.modeDescription}>{description}</Text>
    </TouchableOpacity>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  modeGrid: {
    gap: 12,
  },
  modeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  modeDescription: {
    fontSize: 12,
    color: '#718096',
    marginLeft: 'auto',
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  topicCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#ebf8ff',
  },
  topicLabel: {
    fontSize: 13,
    color: '#4a5568',
    flex: 1,
  },
  topicLabelSelected: {
    color: '#2563eb',
    fontWeight: '500',
  },
  customTopicContainer: {
    marginTop: 16,
  },
  orText: {
    fontSize: 13,
    color: '#a0aec0',
    textAlign: 'center',
    marginBottom: 8,
  },
  customTopicInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a202c',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#4a5568',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  startButtonDisabled: {
    opacity: 0.7,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  tipsContainer: {
    backgroundColor: '#f0fff4',
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#276749',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  tipBullet: {
    fontSize: 14,
    color: '#38a169',
    marginRight: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#276749',
    flex: 1,
  },
});
