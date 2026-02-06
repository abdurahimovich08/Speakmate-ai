/**
 * SpeakMate AI - Audio Recording Service
 */
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AUDIO_CONFIG } from '@/constants/Config';

type RecordingCallback = (audioBase64: string, isFinal: boolean) => void;

export class AudioRecordingService {
  private recording: Audio.Recording | null = null;
  private isRecording: boolean = false;
  private permissionsGranted: boolean = false;

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      this.permissionsGranted = status === 'granted';
      return this.permissionsGranted;
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  /**
   * Check if permissions are granted
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      this.permissionsGranted = status === 'granted';
      return this.permissionsGranted;
    } catch (error) {
      console.error('Error checking audio permissions:', error);
      return false;
    }
  }

  /**
   * Configure audio session
   */
  async configureAudioSession(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error configuring audio session:', error);
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<boolean> {
    if (this.isRecording) {
      console.log('Already recording');
      return false;
    }

    // Check permissions
    if (!this.permissionsGranted) {
      const granted = await this.requestPermissions();
      if (!granted) {
        console.error('Microphone permission denied');
        return false;
      }
    }

    try {
      // Configure audio
      await this.configureAudioSession();

      // Create recording
      const { recording } = await Audio.Recording.createAsync(
        AUDIO_CONFIG.RECORDING_OPTIONS as any,
        this.onRecordingStatusUpdate,
        100 // Update every 100ms
      );

      this.recording = recording;
      this.isRecording = true;

      console.log('Recording started');
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      return false;
    }
  }

  /**
   * Stop recording and get audio data
   */
  async stopRecording(): Promise<string | null> {
    if (!this.recording || !this.isRecording) {
      console.log('No active recording');
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();

      this.recording = null;
      this.isRecording = false;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (uri) {
        // Read file and convert to base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Clean up file
        await FileSystem.deleteAsync(uri, { idempotent: true });

        console.log('Recording stopped, audio data ready');
        return base64;
      }

      return null;
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.isRecording = false;
      return null;
    }
  }

  /**
   * Cancel recording without saving
   */
  async cancelRecording(): Promise<void> {
    if (!this.recording) return;

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();

      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch (error) {
      console.error('Error canceling recording:', error);
    } finally {
      this.recording = null;
      this.isRecording = false;
    }
  }

  /**
   * Recording status update callback
   */
  private onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
    if (status.isRecording) {
      // Could emit duration updates here
      // console.log('Recording duration:', status.durationMillis);
    }
  };

  /**
   * Get current recording status
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get recording duration in milliseconds
   */
  async getRecordingDuration(): Promise<number> {
    if (!this.recording) return 0;

    try {
      const status = await this.recording.getStatusAsync();
      return status.durationMillis || 0;
    } catch {
      return 0;
    }
  }
}

/**
 * Audio playback service for AI responses
 */
export class AudioPlaybackService {
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;

  /**
   * Play audio from base64 data
   */
  async playFromBase64(base64Audio: string): Promise<void> {
    try {
      // Stop any current playback
      await this.stop();

      // Create temporary file
      const tempUri = FileSystem.cacheDirectory + 'temp_audio.mp3';
      await FileSystem.writeAsStringAsync(tempUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Load and play
      const { sound } = await Audio.Sound.createAsync(
        { uri: tempUri },
        { shouldPlay: true },
        this.onPlaybackStatusUpdate
      );

      this.sound = sound;
      this.isPlaying = true;
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  /**
   * Play audio from URL
   */
  async playFromUrl(url: string): Promise<void> {
    try {
      await this.stop();

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        this.onPlaybackStatusUpdate
      );

      this.sound = sound;
      this.isPlaying = true;
    } catch (error) {
      console.error('Error playing audio from URL:', error);
    }
  }

  /**
   * Stop playback
   */
  async stop(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
    } catch (error) {
      console.error('Error stopping playback:', error);
    } finally {
      this.sound = null;
      this.isPlaying = false;
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.pauseAsync();
      this.isPlaying = false;
    } catch (error) {
      console.error('Error pausing playback:', error);
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.playAsync();
      this.isPlaying = true;
    } catch (error) {
      console.error('Error resuming playback:', error);
    }
  }

  /**
   * Playback status update callback
   */
  private onPlaybackStatusUpdate = (status: any) => {
    if (status.didJustFinish) {
      this.isPlaying = false;
      this.stop();
    }
  };

  /**
   * Get playback status
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

// Global instances
export const audioRecorder = new AudioRecordingService();
export const audioPlayer = new AudioPlaybackService();
