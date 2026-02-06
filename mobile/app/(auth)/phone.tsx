/**
 * SpeakMate AI - Phone Login Screen
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function PhoneLoginScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const { signInWithPhone, verifyOtp, isLoading } = useAuthStore();

  const handleSendCode = async () => {
    if (!phone) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    // Format phone number
    let formattedPhone = phone;
    if (!phone.startsWith('+')) {
      formattedPhone = `+998${phone.replace(/\D/g, '')}`;
    }

    try {
      await signInWithPhone(formattedPhone);
      setStep('code');
      Alert.alert('Code Sent', 'Please check your phone for the verification code');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    let formattedPhone = phone;
    if (!phone.startsWith('+')) {
      formattedPhone = `+998${phone.replace(/\D/g, '')}`;
    }

    try {
      await verifyOtp(formattedPhone, code);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (step === 'code') {
              setStep('phone');
              setCode('');
            } else {
              router.back();
            }
          }}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'phone' ? 'Enter Phone Number' : 'Verify Code'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'We will send you a verification code'
              : `Enter the code sent to ${phone}`}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {step === 'phone' ? (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneInputContainer}>
                <Text style={styles.countryCode}>+998</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="90 123 45 67"
                  placeholderTextColor="#a0aec0"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={12}
                />
              </View>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="000000"
                placeholderTextColor="#a0aec0"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={step === 'phone' ? handleSendCode : handleVerifyCode}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {step === 'phone' ? 'Send Code' : 'Verify'}
              </Text>
            )}
          </TouchableOpacity>

          {step === 'code' && (
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleSendCode}
              disabled={isLoading}
            >
              <Text style={styles.resendButtonText}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  backButton: {
    marginTop: 20,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2563eb',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: 8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#4a5568',
    backgroundColor: '#edf2f7',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#1a202c',
  },
  codeInput: {
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    color: '#1a202c',
    letterSpacing: 8,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendButtonText: {
    color: '#2563eb',
    fontSize: 14,
  },
});
