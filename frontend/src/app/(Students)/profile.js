import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import StudentHeader from '../../components/(Students)/StudentHeader';

export default function ProfileScreen() {
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
      <StudentHeader activeRoute="/profile" />
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name || '—'}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || '—'}</Text>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{user?.role || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 10 },
  value: { fontSize: 16, color: '#0F172A', marginTop: 4 }
});
