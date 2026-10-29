import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import AuthButton from '../components/AuthButton';
import { API_BASE_URL } from '../api/client';

// TUP palette: deep maroon + gold on warm cream. Chunky ink outlines for the campus-zine feel.
const COLORS = {
  brand: '#7B1113',      // TUP maroon
  brandDeep: '#4A0A0C',
  brandSoft: '#F6E4E4',
  brandLine: '#EBC9A0',  // warm sand text on maroon
  gold: '#F2B705',
  goldSoft: '#FFF1BF',
  paper: '#FFF9EE',      // cream
  surface: '#FFFFFF',
  ink: '#1F1416',
  muted: '#6E6165',
  faint: '#A39A9E',
  line: '#E8E2E4',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  dangerLine: '#FECDCA'
};

export default function LoginScreen({ onNavigate }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

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

  const validate = () => {
    const newErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newErrors.email = 'Enter your email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Enter your password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    setServerError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      replaceTo('/dashboard');
    } catch (err) {
      console.log('Login failed:', err);
      const message =
        err?.isNetworkError || err?.message?.includes('connect')
          ? 'Unable to reach the server. Check your connection and try again.'
          : err.message || 'Login failed. Check your email and password.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot your password? 😅',
      "It happens to the best of us. Message your LMS administrator and they'll reset it for you.",
      [{ text: 'Got it' }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brand} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Brand panel */}
        <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
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

          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="school" size={24} color={COLORS.brand} />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.brandTitle} numberOfLines={2}>
                Technological University of the Philippines
              </Text>
            </View>
          </View>

          <View style={styles.campusSticker}>
            <Ionicons name="location" size={12} color={COLORS.brandDeep} />
            <Text style={styles.campusStickerText}>TAGUIG CAMPUS</Text>
          </View>

          <Text style={styles.title}>Hey, TUPian! 👋</Text>
          <Text style={styles.subtitle}>
            Log in to check your courses, deadlines, and what your profs
            posted. Time to lock in. 🔒
          </Text>
        </View>

        {/* Form card with hard offset shadow */}
        <View style={styles.formWrap}>
          <View style={styles.formShadow} />
          <View style={styles.formCard}>
            {serverError ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color={COLORS.danger}
                  style={styles.errorIcon}
                />
                <Text style={styles.errorBannerText}>{serverError}</Text>
              </View>
            ) : null}

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

            <AuthInput
              label="Password"
              icon="lock-closed-outline"
              placeholder="Your secret password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password)
                  setErrors((prev) => ({ ...prev, password: null }));
                if (serverError) setServerError('');
              }}
              isPassword
              error={errors.password}
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPassword}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <AuthButton
              title="Sign in"
              onPress={handleLogin}
              loading={isSubmitting}
              style={styles.submitButton}
            />
          </View>
        </View>

        {/* Switch to register */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>New here?</Text>
          <TouchableOpacity
            onPress={() => navigateTo('/register')}
            style={styles.joinChip}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="button"
          >
            <Text style={styles.signUpLink}>Sign up</Text>
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
    paddingBottom: 64,
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20
  },
  logoBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface
  },
  brandText: {
    flex: 1
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.surface,
    lineHeight: 17
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
    marginBottom: 18,
    transform: [{ rotate: '-2deg' }]
  },
  campusStickerText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.brandDeep
  },
  title: {
    fontSize: 34,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 18
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brand
  },
  submitButton: {
    marginTop: 2
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
  joinChip: {
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
  signUpLink: {
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