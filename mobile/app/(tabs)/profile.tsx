/**
 * SpeakMate AI - Profile Screen
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { Colors, getBandColor } from '@/constants/Colors';

const TARGET_BANDS = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];

export default function ProfileScreen() {
  const { user, updateProfile, signOut, isLoading } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [targetBand, setTargetBand] = useState(user?.target_band || 7.0);

  const handleSave = async () => {
    try {
      await updateProfile({ full_name: fullName, target_band: targetBand });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.full_name || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.full_name || 'Student'}</Text>
        <Text style={styles.email}>{user?.email || user?.phone}</Text>
      </View>

      {/* Edit Profile */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Profile Settings</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text style={styles.editButton}>
              {isEditing ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your name"
              />
            ) : (
              <Text style={styles.fieldValue}>{user?.full_name || '-'}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Target Band Score</Text>
            {isEditing ? (
              <View style={styles.bandSelector}>
                {TARGET_BANDS.map((band) => (
                  <TouchableOpacity
                    key={band}
                    style={[
                      styles.bandOption,
                      targetBand === band && styles.bandOptionSelected,
                    ]}
                    onPress={() => setTargetBand(band)}
                  >
                    <Text
                      style={[
                        styles.bandOptionText,
                        targetBand === band && styles.bandOptionTextSelected,
                      ]}
                    >
                      {band}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.targetBandDisplay}>
                <Text style={styles.fieldValue}>{user?.target_band || 7.0}</Text>
                <View
                  style={[
                    styles.bandBadge,
                    { backgroundColor: getBandColor(user?.target_band || 7.0) },
                  ]}
                >
                  <Text style={styles.bandBadgeText}>Target</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Native Language</Text>
            <Text style={styles.fieldValue}>
              {user?.native_language === 'uz' ? "O'zbek" : user?.native_language}
            </Text>
          </View>

          {isEditing && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isLoading}
            >
              <Text style={styles.saveButtonText}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* App Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={20} color="#718096" />
              <Text style={styles.settingLabel}>Notifications</Text>
            </View>
            <Switch value={true} onValueChange={() => {}} />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon" size={20} color="#718096" />
              <Text style={styles.settingLabel}>Dark Mode</Text>
            </View>
            <Switch value={false} onValueChange={() => {}} />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="language" size={20} color="#718096" />
              <Text style={styles.settingLabel}>App Language</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>English</Text>
              <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="help-circle" size={20} color="#718096" />
              <Text style={styles.settingLabel}>Help Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="document-text" size={20} color="#718096" />
              <Text style={styles.settingLabel}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="shield-checkmark" size={20} color="#718096" />
              <Text style={styles.settingLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out" size={20} color="#e53e3e" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>SpeakMate AI v1.0.0</Text>
    </ScrollView>
  );
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2d3748',
  },
  email: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 12,
  },
  editButton: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  field: {
    paddingVertical: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#2d3748',
  },
  input: {
    fontSize: 16,
    color: '#2d3748',
    backgroundColor: '#f7fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  bandSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  bandOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bandOptionSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  bandOptionText: {
    fontSize: 14,
    color: '#4a5568',
  },
  bandOptionTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  targetBandDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bandBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#2d3748',
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingValueText: {
    fontSize: 14,
    color: '#718096',
  },
  signOutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    marginBottom: 16,
  },
  signOutText: {
    fontSize: 16,
    color: '#e53e3e',
    fontWeight: '500',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#a0aec0',
  },
});
