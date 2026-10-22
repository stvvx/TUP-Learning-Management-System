import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import StudentHeader from './StudentHeader';

export default function StudentPage({ activeRoute, title, icon, message }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, router, user]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}>
          <Ionicons name="school" size={20} color="#2563EB" />
        </View>
        <Text style={styles.brandTitle}>Technological University of the Philippines - Taguig</Text>
      </View>
      <StudentHeader activeRoute={activeRoute} />
      <View style={styles.content}>
        <Ionicons name={icon} size={38} color="#94A3B8" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingTop: 48
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A'
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80
  },
  title: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A'
  },
  message: {
    marginTop: 8,
    maxWidth: 300,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B'
  }
});
