import React, { useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import StudentHeader from '../../components/(Students)/StudentHeader';

// TUP palette, same as the other screens. Consider moving this to a shared theme file.
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
  line: '#E8E2E4',
  success: '#1F7A4D'
};

// "program_chair" -> "Program Chair"
const formatRole = (role) =>
  role
    ? role
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';

function InfoRow({ icon, label, value, isLast }) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={COLORS.brand} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} selectable>{value}</Text>
      </View>
    </View>
  );
}

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

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?';
  const roleLabel = formatRole(user?.role);

  const rows = [
    { icon: 'person-outline', label: 'Name', value: user?.name || '—' },
    { icon: 'mail-outline', label: 'Email', value: user?.email || '—' },
    { icon: 'shield-checkmark-outline', label: 'Role', value: roleLabel },
    user?.program
      ? { icon: 'school-outline', label: 'Program', value: user.program }
      : null,
    user?.yearLevel
      ? { icon: 'ribbon-outline', label: 'Year level', value: user.yearLevel }
      : null,
    user?.createdAt
      ? {
          icon: 'calendar-outline',
          label: 'Joined',
          value: new Date(user.createdAt).toLocaleDateString()
        }
      : null
  ].filter(Boolean);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderIcon}>
          <Ionicons name="person" size={22} color={COLORS.brand} />
        </View>
        <View style={styles.pageHeaderText}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.pageSubtitle}>Your account details</Text>
        </View>
      </View>

      <StudentHeader activeRoute="/profile" />

      {/* Hero card with hard offset shadow */}
      <View style={styles.heroWrap}>
        <View style={styles.heroShadow} />
        <View style={styles.heroCard}>
          <Ionicons name="settings" size={170} color={COLORS.gold} style={styles.gearBig} />
          <Ionicons name="settings" size={70} color={COLORS.gold} style={styles.gearSmall} />

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.heroName} numberOfLines={2}>{user?.name || 'TUPian'}</Text>
          <Text style={styles.heroEmail} numberOfLines={1}>{user?.email || '—'}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.brandDeep} />
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
            <View style={styles.campusBadge}>
              <Ionicons name="location" size={13} color={COLORS.brandLine} />
              <Text style={styles.campusBadgeText}>TUP Taguig</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Details */}
      <Text style={styles.sectionTitle}>Account details</Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <InfoRow key={row.label} {...row} isLast={index === rows.length - 1} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, paddingTop: 48, paddingBottom: 48 },

  /* Page header */
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  pageHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pageHeaderText: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 1 },

  /* Hero */
  heroWrap: { marginBottom: 26, marginRight: 6 },
  heroShadow: {
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
  heroCard: {
    backgroundColor: COLORS.brand,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 22,
    alignItems: 'center',
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
    left: -10,
    bottom: -14,
    opacity: 0.1,
    transform: [{ rotate: '-20deg' }]
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.gold,
    borderWidth: 3,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  avatarText: { fontSize: 38, fontWeight: '900', color: COLORS.brandDeep },
  heroName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.surface,
    textAlign: 'center',
    letterSpacing: -0.3
  },
  heroEmail: { fontSize: 13, color: COLORS.brandLine, marginTop: 3, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999
  },
  roleBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.brandDeep },
  campusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.brandLine
  },
  campusBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.brandLine },

  /* Details */
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3, marginBottom: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.ink,
    paddingHorizontal: 16
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.line },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowText: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  value: { fontSize: 16, fontWeight: '600', color: COLORS.ink, marginTop: 2 }
});