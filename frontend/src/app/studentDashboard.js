import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import AuthButton from '../components/AuthButton';
import StudentHeader from '../components/(Students)/StudentHeader';
import AdminDashboard from '../components/(Super Admin)/adminDashboard';
import FacultyDashboard from '../components/(Faculty)/facultyDashboard';
import PcDashboard from '../components/(Program Chair)/pcDashboard';
import DashboardBarChart from '../components/DashboardBarChart';
import { apiGetDashboardStats } from '../api/dashboardStats';

export default function DashboardScreen({ onNavigate }) {
  const router = useRouter();
  const { user, token, logout, refreshUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [stats, setStats] = useState({ chart: [], totals: {} });

  useEffect(() => {
    if (!token || user?.role !== 'student') return undefined;
    const loadStats = async () => {
      try {
        setStats(await apiGetDashboardStats(token));
      } catch (error) {
        console.error('Failed to load student dashboard statistics:', error);
      }
    };
    const timer = setTimeout(loadStats, 0);
    return () => clearTimeout(timer);
  }, [token, user?.role]);

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      if (onNavigate) {
        onNavigate('login');
      } else {
        router.replace('/login');
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to log out of your Technological University of the Philippines - Taguig account?')) {
        performLogout();
      }
      return;
    }

    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your Technological University of the Philippines - Taguig account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: performLogout
        }
      ]
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUser();
    setIsRefreshing(false);
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const normalizedRole = user?.role === 'super admin' || user?.role === 'super_admin'
    ? 'superadmin'
    : user?.role === 'program_chair'
      ? 'programchair'
    : user?.role === 'faculty' || user?.role === 'instructor'
      ? 'faculty'
      : 'student';
  const roleLabel = normalizedRole === 'superadmin'
    ? 'Super Admin'
    : normalizedRole === 'programchair'
      ? 'Program Chair'
    : normalizedRole === 'faculty'
      ? 'Faculty'
      : 'Student';

  if (normalizedRole !== 'student') {
    if (normalizedRole === 'superadmin') return <AdminDashboard />;
    if (normalizedRole === 'programchair') return <PcDashboard />;
    return <FacultyDashboard />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons name="school" size={20} color="#2563EB" />
          </View>
          <Text style={styles.brandTitle}>Technological University of the Philippines - Taguig</Text>
        </View>

        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={isRefreshing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color="#64748B" />
          )}
        </TouchableOpacity>
      </View>

      {user?.role === 'student' && (
        <StudentHeader activeRoute="/dashboard" />
      )}

      {/* User Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userInitial}</Text>
        </View>

        {stats.chart.length > 0 ? (
          <DashboardBarChart title="Enrollment by term" data={stats.chart} />
        ) : null}

        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <View style={[styles.roleBadge, normalizedRole !== 'student' && styles.roleBadgeInstructor]}>
              <Text style={[styles.roleText, normalizedRole !== 'student' && styles.roleTextInstructor]}>
                {roleLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.userEmail}>{user?.email || 'N/A'}</Text>
          <Text style={styles.joinedDate}>
            Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Today'}
          </Text>
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.actionsContainer}>
        <AuthButton
          title="Log Out"
          variant="outline"
          onPress={handleLogout}
          loading={isLoggingOut}
          disabled={isLoggingOut}
          style={styles.logoutButton}
          textStyle={styles.logoutButtonText}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 40
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
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
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800'
  },
  profileInfo: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A'
  },
  roleBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  roleBadgeInstructor: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A'
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8'
  },
  roleTextInstructor: {
    color: '#B45309'
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2
  },
  joinedDate: {
    fontSize: 11,
    color: '#94A3B8'
  },
  actionsContainer: {
    marginTop: 'auto'
  },
  logoutButton: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2'
  },
  logoutButtonText: {
    color: '#DC2626'
  }
});
