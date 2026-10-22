import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AuthButton from '../../components/AuthButton';
import AuthInput from '../../components/AuthInput';
import StaffHeader from '../../components/StaffHeader';
import DropdownSelect from '../../components/DropdownSelect';
import {
  apiCreateProgram,
  apiCreateSection,
  apiGetAcademicStructure
} from '../../api/client';

const YEAR_LEVEL_OPTIONS = [
  { label: 'First Year', value: 'First Year' },
  { label: 'Second Year', value: 'Second Year' },
  { label: 'Third Year', value: 'Third Year' },
  { label: 'Fourth Year', value: 'Fourth Year' }
];

export default function AcademicScreen() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [data, setData] = useState({ programs: [], sections: [] });
  const [program, setProgram] = useState('');
  const [section, setSection] = useState('');
  const [yearLevel, setYearLevel] = useState(null);
  const [programId, setProgramId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'super admin';
  const load = useCallback(async () => {
    if (token) setData(await apiGetAcademicStructure(token));
  }, [token]);

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      router.replace('/dashboard');
      return;
    }
    if (!isLoading && isSuperAdmin) {
      const timer = setTimeout(load, 0);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isSuperAdmin, load, router]);

  const run = async (action, success) => {
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      setMessage(success);
    } catch (err) {
      setError(err.message || 'Unable to save academic structure.');
    }
  };

  const handleAddProgram = async () => {
    if (!program.trim()) {
      setError('Program name is required.');
      return;
    }
    await run(async () => {
      await apiCreateProgram(token, program.trim());
      setProgram('');
    }, 'Program added successfully.');
  };

  const handleAddSection = async () => {
    if (!section.trim()) {
      setError('Section name is required.');
      return;
    }
    if (!yearLevel) {
      setError('Please select a year level.');
      return;
    }
    if (!programId) {
      setError('Please select a program.');
      return;
    }
    await run(async () => {
      await apiCreateSection(token, section.trim(), yearLevel, programId);
      setSection('');
      setYearLevel(null);
      setProgramId(null);
    }, 'Section added successfully.');
  };

  const programOptions = data.programs.map((p) => ({
    label: p.name,
    value: p.id || p._id
  }));

  if (isLoading || !isSuperAdmin) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Programs & Sections</Text>
      <StaffHeader role="superadmin" activeRoute="/academic" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {/* Add Program */}
      <View style={styles.card}>
        <Text style={styles.heading}>Add Program</Text>
        <AuthInput
          label="Program Name"
          placeholder="e.g. Bachelor of Science in Information Technology"
          value={program}
          onChangeText={(t) => { setProgram(t); setError(''); }}
        />
        <AuthButton
          title="Add Program"
          onPress={handleAddProgram}
        />
      </View>

      {/* Add Section */}
      <View style={styles.card}>
        <Text style={styles.heading}>Add Section</Text>
        <AuthInput
          label="Section Name"
          placeholder="e.g. BSIT-1A"
          value={section}
          onChangeText={(t) => { setSection(t); setError(''); }}
          autoCapitalize="characters"
        />
        <DropdownSelect
          label="Year Level"
          placeholder="Select year level"
          options={YEAR_LEVEL_OPTIONS}
          value={yearLevel}
          onSelect={(val) => { setYearLevel(val); setError(''); }}
        />
        <DropdownSelect
          label="Program"
          placeholder={data.programs.length === 0 ? 'No programs available' : 'Select program'}
          options={programOptions}
          value={programId}
          onSelect={(val) => { setProgramId(val); setError(''); }}
        />
        <AuthButton
          title="Add Section"
          onPress={handleAddSection}
          disabled={data.programs.length === 0}
        />
      </View>

      <Text style={styles.heading}>Existing Sections</Text>
      {data.sections.length === 0 ? (
        <Text style={styles.empty}>No sections added yet.</Text>
      ) : (
        data.sections.map((item) => (
          <Text key={item.id || item._id} style={styles.listItem}>
            {item.name} · {item.yearLevel}{item.programName ? ` · ${item.programName}` : ''}
          </Text>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  heading: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  listItem: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, marginBottom: 8, color: '#475569', borderWidth: 1, borderColor: '#E2E8F0' },
  empty: { color: '#94A3B8', fontStyle: 'italic', marginBottom: 16 },
  error: { color: '#B91C1C', marginBottom: 12 },
  message: { color: '#047857', marginBottom: 12 }
});
