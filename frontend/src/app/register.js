import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import AuthButton from '../components/AuthButton';
import DropdownSelect from '../components/DropdownSelect';
import { API_BASE_URL, apiGetPrograms } from '../api/client';

export default function RegisterScreen({ onNavigate }) {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [program, setProgram] = useState(null);
  const [programsList, setProgramsList] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [profilePicture, setProfilePicture] = useState(null); // { uri, base64 }
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Fetch available programs from the database
  useEffect(() => {
    let isMounted = true;
    async function loadPrograms() {
      try {
        setLoadingPrograms(true);
        const data = await apiGetPrograms();
        if (isMounted && Array.isArray(data)) {
          setProgramsList(data);
        }
      } catch (err) {
        console.warn('Failed to load programs for registration dropdown:', err);
      } finally {
        if (isMounted) {
          setLoadingPrograms(false);
        }
      }
    }
    loadPrograms();
    return () => {
      isMounted = false;
    };
  }, []);

  const programOptions = useMemo(() => {
    if (programsList.length > 0) {
      return programsList.map((p) => ({
        label: p.name,
        value: p.name
      }));
    }
    return [
      { label: 'Bachelor of Science in Information Technology (BSIT)', value: 'BSIT' },
      { label: 'Bachelor of Science in Computer Science (BSCS)', value: 'BSCS' },
      { label: 'Bachelor of Science in Information Systems (BSIS)', value: 'BSIS' }
    ];
  }, [programsList]);

  const navigateTo = (route) => {
    if (onNavigate) {
      onNavigate(route.replace('/', ''));
    } else if (router) {
      router.push(route);
    }
  };

  const replaceTo = (route) => {
    if (onNavigate) {
      onNavigate(route.replace('/', ''));
    } else if (router) {
      router.replace(route);
    }
  };

  const goBack = () => {
    if (onNavigate) {
      onNavigate('login');
    } else if (router) {
      router.back();
    }
  };

  // ── Profile picture picker ──────────────────────────────────────────
  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS === 'web') {
        alert('Gallery permission is required to pick a profile picture.');
      } else {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to pick a profile picture.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setProfilePicture({ uri: asset.uri, base64: asset.base64 });
      if (errors.profilePicture) setErrors((prev) => ({ ...prev, profilePicture: null }));
    }
  };

  const removeImage = () => {
    setProfilePicture(null);
  };
  // ───────────────────────────────────────────────────────────────────

  const validate = () => {
    const newErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      newErrors.name = 'Please enter your full name (at least 2 characters)';
    }

    if (!trimmedEmail) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@tup\.edu\.ph$/i.test(trimmedEmail)) {
      newErrors.email = 'Please use your TUP email address ending in @tup.edu.ph';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!program || (typeof program === 'string' && !program.trim())) {
      newErrors.program = 'Please select your program';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    setServerError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        program: typeof program === 'string' ? program.trim() : program,
        profilePictureBase64: profilePicture?.base64 ?? null
      });
      replaceTo('/dashboard');
    } catch (err) {
      console.log('Registration failed:', err);
      setServerError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={goBack}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Register for your Technological University of the Philippines - Taguig student account. An administrator can change your
            role to faculty, program chair, or super admin when needed.
          </Text>
        </View>

        {/* Server Error Alert */}
        {serverError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" style={styles.errorIcon} />
            <Text style={styles.errorBannerText}>{serverError}</Text>
          </View>
        ) : null}

        {/* Form Card */}
        <View style={styles.formCard}>

          {/* ── Profile Picture ── */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              {profilePicture ? (
                <Image source={{ uri: profilePicture.uri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person-outline" size={36} color="#94A3B8" />
                </View>
              )}
              {/* Camera badge */}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarLabel}>Profile Picture</Text>
            <Text style={styles.avatarHint}>Optional · Tap to choose from gallery</Text>
            {profilePicture && (
              <TouchableOpacity onPress={removeImage} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {/* ── Text Fields ── */}
          <AuthInput
            label="Full Name"
            icon="person-outline"
            placeholder="e.g. Jerome Rosario"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              if (serverError) setServerError('');
            }}
            autoCapitalize="words"
            error={errors.name}
          />

          <AuthInput
            label="Email Address"
            icon="mail-outline"
            placeholder="you@tup.edu.ph"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
              if (serverError) setServerError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <DropdownSelect
            label="Program"
            icon="school-outline"
            placeholder={loadingPrograms ? 'Loading programs...' : 'Select your program'}
            options={programOptions}
            value={program}
            onSelect={(val) => {
              setProgram(val);
              if (errors.program) setErrors((prev) => ({ ...prev, program: null }));
              if (serverError) setServerError('');
            }}
            error={errors.program}
          />

          <AuthInput
            label="Password"
            icon="lock-closed-outline"
            placeholder="Minimum 6 characters"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
              if (serverError) setServerError('');
            }}
            isPassword
            error={errors.password}
          />

          <AuthInput
            label="Confirm Password"
            icon="shield-checkmark-outline"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: null }));
              if (serverError) setServerError('');
            }}
            isPassword
            error={errors.confirmPassword}
          />

          <AuthButton
            title="Create LMS Account"
            onPress={handleRegister}
            loading={isSubmitting}
            style={styles.submitButton}
          />
        </View>

        {/* Switch to Login */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigateTo('/login')}>
            <Text style={styles.loginLink}> Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Subtle environment status */}
        <View style={styles.envContainer}>
          <Ionicons name="server-outline" size={13} color="#94A3B8" />
          <Text style={styles.envText}>Connected to: {API_BASE_URL}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 32
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  header: {
    marginBottom: 20
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  errorIcon: {
    marginRight: 8
  },
  errorBannerText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500'
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  // Avatar section
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 10
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#DBEAFE'
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  avatarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2
  },
  avatarHint: {
    fontSize: 12,
    color: '#94A3B8'
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  removeBtnText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600'
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16
  },
  submitButton: {
    marginTop: 10
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24
  },
  footerText: {
    fontSize: 14,
    color: '#64748B'
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB'
  },
  envContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6
  },
  envText: {
    fontSize: 11,
    color: '#94A3B8'
  }
});
