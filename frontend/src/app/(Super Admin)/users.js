import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiGetAcademicStructure, apiGetUsers, apiUpdateStudentPlacement, apiUpdateUserRole } from '../../api/client';
import AuthInput from '../../components/AuthInput';
import AuthButton from '../../components/AuthButton';
import StaffHeader from '../../components/StaffHeader';

const ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'program_chair', label: 'Program Chair' },
  { value: 'super_admin', label: 'Super Admin' }
];

export default function UsersScreen() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [sections, setSections] = useState([]);
  const [placements, setPlacements] = useState({});

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Users</Text>
      <StaffHeader role="superadmin" activeRoute="/users" />
      <Text style={styles.subtitle}>Assign Student, Faculty, Program Chair, or Super Admin roles.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {loadingUsers ? (
        <ActivityIndicator size="large" color="#2563EB" />
      ) : users.length === 0 ? (
        <Text style={styles.empty}>No registered users found.</Text>
      ) : (
        users.map((listedUser) => (
          <View key={listedUser.id} style={styles.userCard}>
            <Text style={styles.name}>{listedUser.name}</Text>
            <Text style={styles.email}>{listedUser.email}</Text>
            <View style={styles.roles}>
              {ROLES.map((role) => (
                <Text
                  key={role.value}
                  onPress={() => updateRole(listedUser.id, role.value)}
                  style={[styles.role, listedUser.role === role.value && styles.roleSelected]}
                >
                  {updatingId === listedUser.id && listedUser.role !== role.value ? '...' : role.label}
                </Text>
              ))}
            </View>
            {listedUser.role === 'student' ? (
              <View>
                <AuthInput
                  label="Year Level"
                  placeholder="e.g. 1st Year"
                  value={placements[listedUser.id]?.yearLevel || ''}
                  onChangeText={(value) => setPlacements((current) => ({
                    ...current,
                    [listedUser.id]: { ...current[listedUser.id], yearLevel: value }
                  }))}
                />
                {sections.map((section) => (
                  <TouchableOpacity
                    key={section.id || section._id}
                    onPress={() => setPlacements((current) => ({
                      ...current,
                      [listedUser.id]: { ...current[listedUser.id], sectionId: section.id || section._id }
                    }))}
                    style={styles.sectionOption}
                  >
                    <Text>{section.name} · Year {section.yearLevel}</Text>
                  </TouchableOpacity>
                ))}
                <AuthButton title="Save Student Placement" onPress={() => updatePlacement(listedUser.id)} />
              </View>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  error: { color: '#B91C1C', marginBottom: 12 },
  message: { color: '#047857', marginBottom: 12 },
  empty: { color: '#64748B', textAlign: 'center', marginTop: 30 },
  userCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  email: { fontSize: 13, color: '#64748B', marginTop: 4 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  role: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: '600' },
  roleSelected: { backgroundColor: '#DBEAFE', color: '#1D4ED8' }
  ,sectionOption: { padding: 10, borderRadius: 8, backgroundColor: '#F1F5F9', marginBottom: 8 }
});
