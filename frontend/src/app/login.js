import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import AuthButton from '../components/AuthButton';
import { API_BASE_URL } from '../api/client';

export default function LoginScreen({ onNavigate }) {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [networkWarning, setNetworkWarning] = useState('');

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
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    setServerError('');
    setNetworkWarning('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      replaceTo('/dashboard');
    } catch (err) {
      console.log('Login failed:', err);
      const message = err?.isNetworkError || err?.message?.includes('connect')
        ? 'Unable to reach the server. Please start the backend and try again.'
        : err.message || 'Login failed. Please check your credentials.';
      setServerError(message);
      setNetworkWarning(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      'Please contact your LMS administrator or enter your email to request a reset link.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.keyboardContainer}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.badgeContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="school" size={28} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.brandTitle}>Technological University of the Philippines - Taguig</Text>
              <Text style={styles.brandSubtitle}>Learning Management Portal</Text>
            </View>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Enter your credentials to access your student or instructor account.
          </Text>
        </View>

        {/* Server Error Alert */}
        {(serverError || networkWarning) ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" style={styles.errorIcon} />
            <Text style={styles.errorBannerText}>{serverError || networkWarning}</Text>
          </View>
        ) : null}

        {/* Form Container */}
        <View style={styles.formCard}>
          <AuthInput
            label="Email Address"
            icon="mail-outline"
            placeholder="you@domain.com"
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
            placeholder="••••••••"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
              if (serverError) setServerError('');
            }}
            isPassword
            error={errors.password}
          />

          <View style={styles.forgotPasswordContainer}>
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <AuthButton
            title="Sign In"
            onPress={handleLogin}
            loading={isSubmitting}
            style={styles.submitButton}
          />
        </View>

        {/* Switch to Register */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{"Don't have an account?"}</Text>
          <TouchableOpacity onPress={() => navigateTo('/register')}>
            <Text style={styles.signUpLink}> Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Subtle environment status */}
        <View style={styles.envContainer}>
          <Ionicons name="server-outline" size={13} color="#94A3B8" />
          <Text style={styles.envText}>Connected to: {API_BASE_URL}</Text>
        </View>
    </View>
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
    paddingTop: 48,
    paddingBottom: 32
  },
  header: {
    marginBottom: 24
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500'
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
    marginTop: -4
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB'
  },
  submitButton: {
    marginTop: 4
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
  signUpLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB'
  },
  envContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6
  },
  envText: {
    fontSize: 11,
    color: '#94A3B8'
  }
});
