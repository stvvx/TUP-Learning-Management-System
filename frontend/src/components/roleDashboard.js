import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import AuthButton from '../components/AuthButton';
import StaffHeader from '../components/StaffHeader';
import DashboardBarChart from '../components/DashboardBarChart';
import { apiGetDashboardStats } from '../api/dashboardStats';

// Same TUP palette as the student dashboard. Consider moving this to a shared theme file.
const COLORS = {
  brand: '#7B1113',
  brandDeep: '#4A0A0C',
  brandSoft: '#F6E4E4',
  brandLine: '#EBC9A0',
  gold: '#F2B705',
  goldDeep: '#9A6B00',
  goldSoft: '#FFF1BF',
  paper: '#FFF9EE',
  surface: '#FFFFFF',
  ink: '#1F1416',
  inkSoft: '#EFE9EA',
  muted: '#6E6165',
  success: '#1F7A4D',
  successSoft: '#E3F4EA',
  danger: '#B42318',
  dangerSoft: '#FEF3F2'
};

const TINTS = {
  brand: { bg: COLORS.brandSoft, fg: COLORS.brand },
  gold: { bg: COLORS.goldSoft, fg: COLORS.goldDeep },
  success: { bg: COLORS.successSoft, fg: COLORS.success },
  ink: { bg: COLORS.inkSoft, fg: COLORS.ink }
};

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
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  const actions = [
    ...(role === 'programchair'
      ? [
          {
            route: '/pc-courses',
            title: 'Sections',
            text: 'Manage and create sections for your programs.',
            icon: 'layers-outline',
            tint: TINTS.brand
          },
          {
            route: '/subjects',
            title: 'Subjects',
            text: 'Create and manage available subjects.',
            icon: 'library-outline',
            tint: TINTS.gold
          },
          {
            route: '/assignments',
            title: 'Assignments',
            text: 'Assign subjects to faculty by section.',
            icon: 'git-network-outline',
            tint: TINTS.success
          }
        ]
      : []),
    role === 'superadmin'
      ? {
          route: '/users',
          title: 'Users',
          text: 'Manage user roles and access.',
          icon: 'people-outline',
          tint: TINTS.brand
        }
      : {
          route: '/lessons',
          title: 'Lessons',
          text: 'Create or upload lesson content.',
          icon: 'book-outline',
          tint: TINTS.ink
        }
  ];

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Branding Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons name="school" size={20} color={COLORS.brand} />
          </View>
          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>TUP - Taguig</Text>
            <Text style={styles.brandSubtitle}>Learning Management System</Text>
          </View>
        </View>
      </View>

      <StaffHeader role={role} activeRoute="/dashboard" />

      {/* Welcome Hero Card */}
      <View style={styles.heroWrap}>
        <View style={styles.heroShadow} />
        <View style={styles.heroCard}>
          <Ionicons name="settings" size={170} color={COLORS.gold} style={styles.gearBig} />
          <Ionicons name="settings" size={70} color={COLORS.gold} style={styles.gearSmall} />

          <View style={styles.heroHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitial}</Text>
            </View>
            <View style={styles.heroInfo}>
              <View style={styles.greetingRow}>
                <Text style={styles.greetingTitle}>Welcome back 👋</Text>
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{roleTitle}</Text>
                </View>
              </View>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.name || 'User'}
              </Text>
              {user?.email ? (
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.infoBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.brandDeep} />
              <Text style={styles.infoBadgeText}>{roleTitle}</Text>
            </View>
            <Text style={styles.heroDescription}>{description}</Text>
          </View>
        </View>
      </View>

      {/* Overview Chart */}
      {chartData.length > 0 ? (
        <View style={styles.chartSection}>
          <DashboardBarChart title="Overview" data={chartData} color={COLORS.brand} />
        </View>
      ) : null}

      {/* Quick Actions */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Jump to ⚡</Text>
          <Text style={styles.sectionSubtitle}>Your {roleTitle.toLowerCase()} tools</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.route}
            style={styles.action}
            onPress={() => router.push(action.route)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: action.tint.bg }]}>
              <Ionicons name={action.icon} size={22} color={action.tint.fg} />
            </View>
            <View style={styles.actionMeta}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionText}>{action.text}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.ink} />
          </TouchableOpacity>
        ))}
      </View>

      <AuthButton
        title={isLoggingOut ? 'Logging out...' : 'Log Out'}
        variant="outline"
        onPress={handleLogout}
        loading={isLoggingOut}
        disabled={isLoggingOut}
        style={styles.logout}
        textStyle={styles.logoutText}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { paddingHorizontal: 16, paddingTop: 36, paddingBottom: 48 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTextContainer: { flex: 1 },
  brandTitle: { fontSize: 16, fontWeight: '900', color: COLORS.brand, lineHeight: 19 },
  brandSubtitle: { fontSize: 11, color: COLORS.muted, lineHeight: 14 },

  // Hero card
  heroWrap: { marginBottom: 20, marginTop: 4 },
  heroShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: COLORS.gold,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  heroCard: {
    backgroundColor: COLORS.brand,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.ink,
    overflow: 'hidden'
  },
  gearBig: {
    position: 'absolute',
    right: -40,
    top: -30,
    opacity: 0.12,
    transform: [{ rotate: '15deg' }]
  },
  gearSmall: {
    position: 'absolute',
    right: 80,
    bottom: -10,
    opacity: 0.1,
    transform: [{ rotate: '-20deg' }]
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { color: COLORS.brandDeep, fontSize: 24, fontWeight: '900' },
  heroInfo: { flex: 1 },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2
  },
  greetingTitle: { fontSize: 12, fontWeight: '600', color: COLORS.brandLine },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  statusText: { fontSize: 10, fontWeight: '800', color: COLORS.brandDeep },
  userName: { fontSize: 19, fontWeight: '900', color: COLORS.surface, marginBottom: 2 },
  userEmail: { fontSize: 13, color: COLORS.brandLine },
  heroFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: 'rgba(242,183,5,0.5)',
    gap: 8
  },
  infoBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  infoBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.brandDeep },
  heroDescription: { fontSize: 13, lineHeight: 19, color: COLORS.brandLine },

  // Chart
  chartSection: { marginBottom: 16 },

  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6
  },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 1 },

  // Actions
  actions: { marginBottom: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: COLORS.ink,
    marginBottom: 10
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionMeta: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink, marginBottom: 2 },
  actionText: { fontSize: 12, lineHeight: 17, color: COLORS.muted },

  // Logout
  logout: {
    marginTop: 20,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft
  },
  logoutText: { color: COLORS.danger }
});
