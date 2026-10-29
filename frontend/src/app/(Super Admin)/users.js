import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiGetAcademicStructure, apiGetUsers, apiUpdateStudentPlacement, apiUpdateUserRole } from '../../api/client';
import AuthInput from '../../components/AuthInput';
import AuthButton from '../../components/AuthButton';
import StaffHeader from '../../components/StaffHeader';

// TUP palette, same as the other screens. Consider moving this to a shared theme file.
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
  muted: '#6E6165',
  faint: '#A39A9E',
  line: '#E8E2E4',
  success: '#1F7A4D',
  successSoft: '#E3F4EA',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  dangerLine: '#FECDCA'
};

const ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'program_chair', label: 'Program Chair' },
  { value: 'super_admin', label: 'Super Admin' }
];

const initialOf = (name = '') => (name.trim().charAt(0) || '?').toUpperCase();

function Banner({ kind, children }) {
  const isError = kind === 'error';
  const color = isError ? COLORS.danger : COLORS.success;
  return (
    <View style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]} accessibilityRole="alert">
      <Ionicons name={isError ? 'alert-circle' : 'checkmark-circle'} size={20} color={color} />
      <Text style={[styles.bannerText, { color }]}>{children}</Text>
    </View>
  );
}

export default function UsersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, token, isLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [sections, setSections] = useState([]);
  const [placements, setPlacements] = useState({});
  const [openPlacements, setOpenPlacements] = useState({});
  const [query, setQuery] = useState('');

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoadingUsers(true);
    setError('');
    try {
      const [listedUsers, academic] = await Promise.all([
        apiGetUsers(token),
        apiGetAcademicStructure(token)
      ]);
      setUsers(listedUsers);
      setSections(academic.sections);
    } catch (err) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  useEffect(() => {
    const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'super admin';
    if (!isLoading && (!user || !isSuperAdmin)) {
      router.replace('/dashboard');
      return;
    }
    if (!isLoading && user) {
      const loadTimer = setTimeout(loadUsers, 0);
      return () => clearTimeout(loadTimer);
    }
  }, [isLoading, loadUsers, router, user]);

  const updateRole = async (userId, role) => {
    setUpdatingId(userId);
    setError('');
    try {
      const updatedUser = await apiUpdateUserRole(token, userId, role);
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id ? updatedUser : currentUser
        )
      );
    } catch (err) {
      setError(err.message || 'Failed to update user role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const updatePlacement = async (studentId) => {
    const placement = placements[studentId] || {};
    setError('');
    setMessage('');
    try {
      await apiUpdateStudentPlacement(token, studentId, placement.yearLevel, placement.sectionId);
      setMessage('Student placement updated.');
    } catch (err) {
      setError(err.message || 'Failed to update student placement.');
    }
  };

  if (isLoading || !user || (user.role !== 'super_admin' && user.role !== 'super admin')) {
    return null;
  }

  const isWide = width >= 900;
  const needle = query.trim().toLowerCase();
  const visibleUsers = needle
    ? users.filter((u) => `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(needle))
    : users;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderIcon}>
          <Ionicons name="people" size={22} color={COLORS.brand} />
        </View>
        <View style={styles.pageHeaderText}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.pageSubtitle}>Assign Student, Faculty, Program Chair, or Super Admin roles</Text>
        </View>
        {!loadingUsers ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{users.length}</Text>
          </View>
        ) : null}
      </View>

      <StaffHeader role="superadmin" activeRoute="/users" />

      {error ? <Banner kind="error">{error}</Banner> : null}
      {message ? <Banner kind="success">{message}</Banner> : null}

      {!loadingUsers && users.length > 0 ? (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.muted} />
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or email"
            placeholderTextColor={COLORS.faint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={COLORS.faint} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {loadingUsers ? (
        <ActivityIndicator size="large" color={COLORS.brand} style={styles.loader} />
      ) : users.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={30} color={COLORS.faint} />
          <Text style={styles.empty}>No registered users found.</Text>
        </View>
      ) : visibleUsers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="search-outline" size={30} color={COLORS.faint} />
          <Text style={styles.empty}>No users match “{query.trim()}”.</Text>
        </View>
      ) : (
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {visibleUsers.map((listedUser) => {
            const placement = placements[listedUser.id] || {};
            const isOpen = Boolean(openPlacements[listedUser.id]);
            return (
              <View key={listedUser.id} style={[styles.userCard, isWide && styles.userCardWide]}>
                <View style={styles.userTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initialOf(listedUser.name)}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.name} numberOfLines={1}>{listedUser.name}</Text>
                    <Text style={styles.email} numberOfLines={1}>{listedUser.email}</Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>ROLE</Text>
                <View style={styles.roles}>
                  {ROLES.map((role) => {
                    const selected = listedUser.role === role.value;
                    return (
                      <TouchableOpacity
                        key={role.value}
                        onPress={() => updateRole(listedUser.id, role.value)}
                        disabled={updatingId === listedUser.id}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[styles.role, selected && styles.roleSelected]}
                      >
                        <Text style={[styles.roleText, selected && styles.roleTextSelected]}>
                          {updatingId === listedUser.id && !selected ? '...' : role.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {listedUser.role === 'student' ? (
                  <View style={styles.placementBox}>
                    <TouchableOpacity
                      style={[styles.placementTitleRow, isOpen && styles.placementTitleRowOpen]}
                      onPress={() => setOpenPlacements((current) => ({ ...current, [listedUser.id]: !current[listedUser.id] }))}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      accessibilityLabel="Toggle student placement"
                    >
                      <Ionicons name="school-outline" size={16} color={COLORS.brand} />
                      <Text style={styles.placementTitle}>Student placement</Text>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.brand} />
                    </TouchableOpacity>
                    {isOpen ? (
                    <>
                    <AuthInput
                      label="Year Level"
                      placeholder="e.g. 1st Year"
                      value={placement.yearLevel || ''}
                      onChangeText={(value) => setPlacements((current) => ({
                        ...current,
                        [listedUser.id]: { ...current[listedUser.id], yearLevel: value }
                      }))}
                    />
                    <Text style={styles.fieldLabel}>SECTION</Text>
                    {sections.length === 0 ? (
                      <Text style={styles.noSections}>No sections available.</Text>
                    ) : (
                      sections.map((section) => {
                        const sectionId = section.id || section._id;
                        const selected = placement.sectionId === sectionId;
                        return (
                          <TouchableOpacity
                            key={sectionId}
                            onPress={() => setPlacements((current) => ({
                              ...current,
                              [listedUser.id]: { ...current[listedUser.id], sectionId }
                            }))}
                            activeOpacity={0.85}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            style={[styles.sectionOption, selected && styles.sectionOptionSelected]}
                          >
                            <View style={[styles.radio, selected && styles.radioOn]}>
                              {selected ? <Ionicons name="checkmark" size={13} color={COLORS.brandDeep} /> : null}
                            </View>
                            <Text style={styles.sectionOptionText}>{section.name} · Year {section.yearLevel}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                    <View style={styles.saveWrap}>
                      <AuthButton title="Save Student Placement" onPress={() => updatePlacement(listedUser.id)} />
                    </View>
                    </>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
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
  countPill: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: COLORS.brand,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  countPillText: { color: COLORS.surface, fontWeight: '800', fontSize: 14 },

  /* Banners */
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1
  },
  bannerError: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.dangerLine },
  bannerSuccess: { backgroundColor: COLORS.successSoft, borderColor: '#B7E1C8' },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },

  loader: { paddingVertical: 28 },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14
  },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.ink, outlineStyle: 'none' },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    padding: 24
  },
  empty: { color: COLORS.muted, textAlign: 'center', fontSize: 13 },

  /* User cards: 1 column on phone, 2 on desktop */
  grid: { gap: 12 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  userCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  userCardWide: { width: '49%' },
  userTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { fontSize: 18, fontWeight: '900', color: COLORS.brandDeep },
  userInfo: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  email: { fontSize: 13, color: COLORS.muted, marginTop: 2 },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8
  },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  role: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.paper,
    borderWidth: 1.5,
    borderColor: COLORS.line
  },
  roleSelected: { backgroundColor: COLORS.brand, borderColor: COLORS.ink },
  roleText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  roleTextSelected: { color: COLORS.surface },

  /* Student placement */
  placementBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.paper,
    borderWidth: 2,
    borderColor: COLORS.goldSoft
  },
  placementTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  placementTitleRowOpen: { marginBottom: 8 },
  placementTitle: { flex: 1, fontSize: 14, fontWeight: '900', color: COLORS.ink },
  noSections: { color: COLORS.muted, fontSize: 13, marginBottom: 8 },
  sectionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    marginBottom: 8
  },
  sectionOptionSelected: { backgroundColor: COLORS.goldSoft, borderColor: COLORS.ink },
  sectionOptionText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.ink },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.faint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioOn: { backgroundColor: COLORS.gold, borderColor: COLORS.ink },
  saveWrap: { marginTop: 6 }
});