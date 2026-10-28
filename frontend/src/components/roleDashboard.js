import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import AuthButton from './AuthButton';
import StaffHeader from './StaffHeader';
import DashboardBarChart from './DashboardBarChart';
import { apiGetDashboardStats } from '../api/dashboardStats';

export default function RoleDashboard({ role }) {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [stats, setStats] = useState({ chart: [] });
  const chartData = Array.isArray(stats?.chart) ? stats.chart : [];
  const roleTitle = role === 'superadmin' ? 'Super Admin' : role === 'programchair' ? 'Program Chair' : 'Faculty';
  const description = role === 'superadmin'
    ? 'Manage subjects and user access.'
    : role === 'programchair'
      ? 'Create subjects and assign faculty by section.'
      : 'Manage lessons, exams, and student grades.';

  useEffect(() => {
    if (!token) return undefined;
    const loadStats = async () => {
      try {
        setStats(await apiGetDashboardStats(token));
      } catch (error) {
        console.error('Failed to load dashboard statistics:', error);
      }
    };
    const timer = setTimeout(loadStats, 0);
    return () => clearTimeout(timer);
  }, [token]);

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to log out?')) performLogout();
      return;
    }
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: performLogout }
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.brandTitle}>Technological University of the Philippines - Taguig</Text>
      <StaffHeader role={role} activeRoute="/dashboard" />
      <View style={styles.card}>
        <Text style={styles.greeting}>Welcome, {user?.name || 'User'}</Text>
        <Text style={styles.role}>{roleTitle}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {chartData.length > 0 ? (
        <DashboardBarChart
          title="Overview"
          data={chartData}
          color={role === 'programchair' ? '#7C3AED' : role === 'superadmin' ? '#059669' : '#2563EB'}
        />
      ) : null}
      <View style={styles.actions}>
        {role === 'programchair' && (
          <>
            <TouchableOpacity style={styles.action} onPress={() => router.push('/pc-courses')}>
              <Text style={styles.actionTitle}>Sections</Text>
              <Text style={styles.actionText}>Manage and create sections for your programs.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => router.push('/subjects')}>
              <Text style={styles.actionTitle}>Subjects</Text>
              <Text style={styles.actionText}>Create and manage available subjects.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => router.push('/assignments')}>
              <Text style={styles.actionTitle}>Assignments</Text>
              <Text style={styles.actionText}>Assign subjects to faculty by section.</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.action} onPress={() => router.push(role === 'superadmin' ? '/users' : '/lessons')}>
          <Text style={styles.actionTitle}>{role === 'superadmin' ? 'Users' : 'Lessons'}</Text>
          <Text style={styles.actionText}>{role === 'superadmin' ? 'Manage user roles and access.' : 'Create or upload lesson content.'}</Text>
        </TouchableOpacity>
      </View>
      <AuthButton title={isLoggingOut ? 'Logging out...' : 'Log Out'} variant="outline" onPress={handleLogout} loading={isLoggingOut} style={styles.logout} textStyle={styles.logoutText} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  brandTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  role: { fontSize: 13, fontWeight: '700', color: '#2563EB', marginTop: 6 },
  description: { fontSize: 14, color: '#64748B', marginTop: 8 },
  actions: { gap: 12 },
  action: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  actionText: { fontSize: 13, color: '#64748B', marginTop: 5 },
  logout: { marginTop: 28, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  logoutText: { color: '#DC2626' }
});
