import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import StaffHeader from './StaffHeader';

export default function StaffPage({ role, activeRoute, title, icon, message }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const userRole = user?.role === 'super admin' || user?.role === 'super_admin'
    ? 'superadmin'
    : user?.role === 'program_chair'
      ? 'programchair'
    : user?.role === 'faculty' || user?.role === 'instructor'
      ? 'faculty'
      : null;

  useEffect(() => {
    if (!isLoading && (!user || userRole !== role)) {
      router.replace('/dashboard');
    }
  }, [isLoading, role, router, user, userRole]);

  if (isLoading || !user || userRole !== role) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brandTitle}>Technological University of the Philippines - Taguig</Text>
      <StaffHeader role={role} activeRoute={activeRoute} />
      <View style={styles.content}>
        <Ionicons name={icon} size={40} color="#94A3B8" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20, paddingTop: 48 },
  brandTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 24 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  title: { marginTop: 14, fontSize: 20, fontWeight: '700', color: '#0F172A' },
  message: {
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B'
  }
});
