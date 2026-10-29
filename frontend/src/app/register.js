import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import AuthButton from '../components/AuthButton';
import DropdownSelect from '../components/DropdownSelect';
import { API_BASE_URL, apiGetPrograms } from '../api/client';

// Same TUP palette as LoginScreen: maroon + gold on cream, chunky ink outlines.
// Consider moving this to a shared theme file.
const COLORS = {
  brand: '#7B1113',
  brandDeep: '#4A0A0C',
  brandSoft: '#F6E4E4',
  brandLine: '#EBC9A0',
  gold: '#F2B705',
  goldSoft: '#FFF1BF',
  paper: '#FFF9EE',
  surface: '#FFFFFF',
  ink: '#1F1416',
  muted: '#6E6165',
  faint: '#A39A9E',
  line: '#E8E2E4',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  dangerLine: '#FECDCA'
};

export default function RegisterScreen({ onNavigate }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [networkWarning, setNetworkWarning] = useState('');

  // Fetch available programs from the database
  useEffect(() => {
    let isMounted = true;
    async function loadPrograms() {
      try {
        setLoadingPrograms(true);
        setNetworkWarning('');
        const data = await apiGetPrograms();
        if (isMounted && Array.isArray(data)) {
          setProgramsList(data);
        }
      } catch (err) {
        console.warn('Failed to load programs for registration dropdown:', err);
        if (isMounted) {
          setNetworkWarning(
            err?.isNetworkError || err?.message?.includes('connect')
              ? 'Unable to reach the server. Check your connection and try again.'
              : 'Unable to load programs right now. Try again later.'
          );
        }
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS === 'web') {
        alert('Allow access to your gallery to choose a profile picture.');
      } else {
        Alert.alert(
          'Photo access needed 📸',
          'Allow access to your photo library to choose a profile picture.',
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
      newErrors.name = 'Enter your full name (at least 2 characters)';
    }

    if (!trimmedEmail) {
      newErrors.email = 'Enter your email address';
    } else if (!/^[^\s@]+@tup\.edu\.ph$/i.test(trimmedEmail)) {
      newErrors.email = 'Use your TUP email ending in @tup.edu.ph';
    }

    if (!password) {
      newErrors.password = 'Enter a password';
    } else if (password.length < 6) {
      newErrors.password = 'Use at least 6 characters';
    }

    if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!program || (typeof program === 'string' && !program.trim())) {
      newErrors.program = 'Select your program';
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
      setServerError(err.message || 'Registration failed. Check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bannerMessage = serverError || networkWarning;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brand} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Brand panel */}
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          {/* Gear motifs: TUP's technological identity */}
          <Ionicons
            name="settings"
            size={190}
            color={COLORS.gold}
            style={styles.gearBig}
          />
          <Ionicons
            name="settings"
            size={80}
            color={COLORS.gold}
            style={styles.gearSmall}
          />

          <TouchableOpacity
            onPress={goBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.brandDeep} />
          </TouchableOpacity>

          <View style={styles.campusSticker}>
            <Ionicons name="location" size={12} color={COLORS.brandDeep} />
            <Text style={styles.campusStickerText}>TUP TAGUIG</Text>
          </View>

          <Text style={styles.title}>Join the squad 🎓</Text>
          <Text style={styles.subtitle}>
            Sign up with your TUP email to get into the Taguig campus learning
            portal. Takes a minute, promise.
          </Text>
        </View>

        {/* Form card with hard offset shadow */}
        <View style={styles.formWrap}>
          <View style={styles.formShadow} />
          <View style={styles.formCard}>
            {bannerMessage ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color={COLORS.danger}
                  style={styles.errorIcon}
                />
                <Text style={styles.errorBannerText}>{bannerMessage}</Text>
              </View>
            ) : null}

            {/* Profile picture */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarWrap}
                onPress={pickImage}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Choose profile picture"
              >
                {profilePicture ? (
                  <Image source={{ uri: profilePicture.uri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person-outline" size={34} color={COLORS.brand} />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={14} color={COLORS.brandDeep} />
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarLabel}>Profile picture</Text>
              <Text style={styles.avatarHint}>Optional. Show your best angle</Text>
              {profilePicture && (
                <TouchableOpacity
                  onPress={removeImage}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                  <Text style={styles.removeBtnText}>Remove photo</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            {/* Fields */}
            <AuthInput
              label="Full name"
              icon="person-outline"
              placeholder="e.g. Juan Dela Cruz"
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
              label="School email"
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
              placeholder={loadingPrograms ? 'Loading programs...' : 'Pick your program'}
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
              placeholder="At least 6 characters"
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
              label="Confirm password"
              icon="shield-checkmark-outline"
              placeholder="Type it again"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword)
                  setErrors((prev) => ({ ...prev, confirmPassword: null }));
                if (serverError) setServerError('');
              }}
              isPassword
              error={errors.confirmPassword}
            />

            <AuthButton
              title="Sign up"
              onPress={handleRegister}
              loading={isSubmitting}
              style={styles.submitButton}
            />
          </View>
        </View>

        {/* Switch to login */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already a TUPian?</Text>
          <TouchableOpacity
            onPress={() => navigateTo('/login')}
            style={styles.loginChip}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="button"
          >
            <Text style={styles.loginLink}>Sign in</Text>
            <Ionicons name="arrow-forward" size={14} color={COLORS.brandDeep} />
          </TouchableOpacity>
        </View>

        {/* Server address, shown only in development builds */}
        {__DEV__ ? (
          <View style={styles.envPill}>
            <Ionicons name="server-outline" size={12} color={COLORS.faint} />
            <Text style={styles.envText} numberOfLines={1}>
              {API_BASE_URL}
            </Text>
          </View>
        ) : null}

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.paper
  },
  scrollContent: {
    flexGrow: 1
  },

  /* Brand panel */
  hero: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 24,
    paddingBottom: 60,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    borderBottomWidth: 4,
    borderBottomColor: COLORS.gold
  },
  gearBig: {
    position: 'absolute',
    right: -50,
    top: -30,
    opacity: 0.12,
    transform: [{ rotate: '15deg' }]
  },
  gearSmall: {
    position: 'absolute',
    right: 90,
    bottom: 8,
    opacity: 0.1,
    transform: [{ rotate: '-20deg' }]
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  campusSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 16,
    transform: [{ rotate: '-2deg' }]
  },
  campusStickerText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.brandDeep
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.surface,
    letterSpacing: -0.8,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.brandLine,
    maxWidth: 340
  },

  /* Form */
  formWrap: {
    marginHorizontal: 20,
    marginTop: -36
  },
  formShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: COLORS.gold,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 22,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerLine,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  errorIcon: {
    marginRight: 8,
    marginTop: 1
  },
  errorBannerText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500'
  },

  /* Avatar */
  avatarSection: {
    alignItems: 'center',
    paddingTop: 4
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
    borderColor: COLORS.gold
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2
  },
  avatarHint: {
    fontSize: 12,
    color: COLORS.muted
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerLine
  },
  removeBtnText: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '600'
  },
  divider: {
    height: 2,
    backgroundColor: COLORS.goldSoft,
    marginVertical: 20,
    borderRadius: 1
  },
  submitButton: {
    marginTop: 8
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 36
  },
  footerText: {
    fontSize: 14,
    color: COLORS.muted
  },
  loginChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 2,
    borderColor: COLORS.ink,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.brandDeep
  },
  envPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    maxWidth: '85%'
  },
  envText: {
    fontSize: 11,
    color: COLORS.faint
  }
});