import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function IndexScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Ionicons name="school" size={44} color="#2563EB" />
      </View>
      <Text style={styles.appName}>Technological University of the Philippines - Taguig</Text>
      <Text style={styles.tagline}>Learning Management System</Text>
      <ActivityIndicator size="large" color="#2563EB" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#DBEAFE'
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5
  },
  tagline: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4
  },
  loader: {
    marginTop: 32
  }
});
