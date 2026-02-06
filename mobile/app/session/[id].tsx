/**
 * SpeakMate AI - Active Session Screen
 */
import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/stores/sessionStore';
import { audioRecorder, audioPlayer } from '@/services/audio';
import { Colors } from '@/constants/Colors';
import type { ChatMessage } from '@/types';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentSession,
    messages,
    isAiTyping,
    currentTranscription,
    isConnected,
    isSessionActive,
    errors,
    scores,
    endSession,
    sendMessage,
    clearSession,
  } = useSessionStore();

  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (isSessionActive) {
        setSessionDuration((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isSessionActive]);

  // Recording animation
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Handle session end navigation - go to Stimuler-style analysis
  useEffect(() => {
    if (!isSessionActive && scores) {
      // Navigate to the new analysis screen with session ID
      router.replace({
        pathname: '/results/analysis',
        params: { sessionId: currentSession?.id },
      });
    }
  }, [isSessionActive, scores]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    const hasPermission = await audioRecorder.requestPermissions();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Please allow microphone access to record your speech.'
      );
      return;
    }

    const started = await audioRecorder.startRecording();
    if (started) {
      setIsRecording(true);

      // Recording duration timer
      const timer = setInterval(async () => {
        const duration = await audioRecorder.getRecordingDuration();
        setRecordingDuration(Math.floor(duration / 1000));
      }, 100);

      // Store timer to clear later
      (audioRecorder as any).durationTimer = timer;
    }
  };

  const handleStopRecording = async () => {
    // Clear duration timer
    if ((audioRecorder as any).durationTimer) {
      clearInterval((audioRecorder as any).durationTimer);
    }

    setIsRecording(false);
    setRecordingDuration(0);

    const audioData = await audioRecorder.stopRecording();
    if (audioData) {
      // Send audio to backend via WebSocket
      const { socket } = useSessionStore.getState();
      if (socket && isConnected) {
        socket.sendAudioChunk(audioData, true);
      }
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;

    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            await endSession();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: isConnected ? '#38a169' : '#e53e3e' },
            ]}
          />
          <Text style={styles.topicText}>
            {currentSession?.topic || 'Free Speaking'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={16} color="#4a5568" />
            <Text style={styles.timerText}>{formatDuration(sessionDuration)}</Text>
          </View>
          <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
            <Text style={styles.endButtonText}>End</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Current transcription */}
        {currentTranscription && (
          <View style={[styles.messageBubble, styles.userMessage, styles.transcribing]}>
            <Text style={styles.messageTextUser}>{currentTranscription}...</Text>
          </View>
        )}

        {/* AI typing indicator */}
        {isAiTyping && (
          <View style={[styles.messageBubble, styles.aiMessage]}>
            <View style={styles.typingIndicator}>
              <View style={styles.typingDot} />
              <View style={[styles.typingDot, { animationDelay: '0.2s' }]} />
              <View style={[styles.typingDot, { animationDelay: '0.4s' }]} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        {/* Text Input */}
        <View style={styles.textInputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#a0aec0"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isRecording}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendText}
            disabled={!inputText.trim() || isRecording}
          >
            <Ionicons name="send" size={20} color={inputText.trim() ? '#fff' : '#a0aec0'} />
          </TouchableOpacity>
        </View>

        {/* Recording Button */}
        <View style={styles.recordingArea}>
          {isRecording && (
            <Text style={styles.recordingDuration}>
              Recording: {formatDuration(recordingDuration)}
            </Text>
          )}

          <TouchableOpacity
            style={styles.micButtonContainer}
            onPressIn={handleStartRecording}
            onPressOut={handleStopRecording}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.micButton,
                isRecording && styles.micButtonRecording,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={32}
                color="#fff"
              />
            </Animated.View>
          </TouchableOpacity>

          <Text style={styles.micHint}>
            {isRecording ? 'Release to send' : 'Hold to speak'}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View
      style={[
        styles.messageBubble,
        isUser ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <Text style={isUser ? styles.messageTextUser : styles.messageTextAi}>
        {message.content}
      </Text>
      <Text style={[styles.messageTime, isUser && styles.messageTimeUser]}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topicText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f7fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4a5568',
  },
  endButton: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  endButtonText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transcribing: {
    opacity: 0.7,
  },
  messageTextUser: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextAi: {
    color: '#2d3748',
    fontSize: 16,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 10,
    color: '#a0aec0',
    marginTop: 4,
  },
  messageTimeUser: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a0aec0',
  },
  inputContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 16,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: '#2d3748',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  recordingArea: {
    alignItems: 'center',
  },
  recordingDuration: {
    fontSize: 14,
    color: '#e53e3e',
    fontWeight: '500',
    marginBottom: 8,
  },
  micButtonContainer: {
    marginBottom: 8,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonRecording: {
    backgroundColor: '#e53e3e',
  },
  micHint: {
    fontSize: 12,
    color: '#a0aec0',
  },
});
