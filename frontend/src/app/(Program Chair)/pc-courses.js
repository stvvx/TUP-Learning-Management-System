import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import AuthInput from '../../components/AuthInput';
import AuthButton from '../../components/AuthButton';
import DropdownSelect from '../../components/DropdownSelect';
import StaffHeader from '../../components/StaffHeader';
import {
  apiGetProgramChairAcademic,
  apiPcCreateSection
} from '../../api/client';
import {
  apiDeleteProgramChairSection,
  apiUpdateProgramChairSection
} from '../../api/programChairSections';

const YEAR_LEVEL_OPTIONS = [
  { label: 'First Year', value: 'First Year' },
  { label: 'Second Year', value: 'Second Year' },
  { label: 'Third Year', value: 'Third Year' },
  { label: 'Fourth Year', value: 'Fourth Year' }
];

export default function PcCoursesScreen() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();

  const isProgramChair = user?.role === 'program_chair';

  const [data, setData] = useState({ programs: [], sections: [] });
  const [loading, setLoading] = useState(true);

  // Section form
  const [sectionName, setSectionName] = useState('');
  const [sectionYearLevel, setSectionYearLevel] = useState(null);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [sectionError, setSectionError] = useState('');
  const [sectionSuccess, setSectionSuccess] = useState('');
  const [sectionSubmitting, setSectionSubmitting] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const result = await apiGetProgramChairAcademic(token);
      setData({ programs: result.programs || [], sections: result.sections || [] });
    } catch (err) {
      console.error('Failed to load academic data:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    if (!isProgramChair) {
      router.replace('/dashboard');
      return;
    }
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [isLoading, isProgramChair, load, router]);

  const handleAddSection = async () => {
    setSectionError('');
    setSectionSuccess('');
    if (!sectionName.trim()) {
      setSectionError('Section name is required.');
      return;
    }
    if (!sectionYearLevel) {
      setSectionError('Please select a year level.');
      return;
    }
    if (!selectedProgramId) {
      setSectionError('Please select a program.');
      return;
    }
    setSectionSubmitting(true);
    try {
      if (editingSectionId) {
        await apiUpdateProgramChairSection(token, editingSectionId, {
          name: sectionName.trim(),
          yearLevel: sectionYearLevel,
          programId: selectedProgramId
        });
      } else {
        await apiPcCreateSection(token, sectionName.trim(), sectionYearLevel, selectedProgramId);
      }
      setSectionName('');
      setSectionYearLevel(null);
      setSelectedProgramId(null);
      setEditingSectionId(null);
      setSectionSuccess(editingSectionId ? 'Section updated successfully!' : 'Section added successfully!');
      await load();
    } catch (err) {
      setSectionError(err.message || 'Failed to add section.');
    } finally {
      setSectionSubmitting(false);
    }
  };

  const startEditSection = (section) => {
    setEditingSectionId(section.id || section._id);
    setSectionName(section.name);
    setSectionYearLevel(section.yearLevel);
    setSelectedProgramId(section.programId?.toString() || section.courseId?.toString() || null);
    setSectionError('');
    setSectionSuccess('');
  };

  const deleteSection = (sectionId) => {
    Alert.alert('Delete section', 'Students in this section will become unassigned, and faculty assignments for it will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteProgramChairSection(token, sectionId);
            setSectionSuccess('Section deleted successfully!');
            await load();
          } catch (err) {
            setSectionError(err.message || 'Failed to delete section.');
          }
        }
      }
    ]);
  };

  // Build program options for section dropdown
  const programOptions = data.programs.map((p) => ({
    label: p.name,
    value: p._id?.toString() || p.id
  }));

  if (isLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!isProgramChair) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Text style={styles.brand}>Technological University of the Philippines - Taguig</Text>
      <StaffHeader role="programchair" activeRoute="/pc-courses" />

      <Text style={styles.pageTitle}>Sections</Text>
      <Text style={styles.pageSubtitle}>
        Add and manage sections for your programs.
      </Text>

      {/* ── Add Section ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="people-outline" size={20} color="#2563EB" />
          </View>
          <Text style={styles.cardTitle}>{editingSectionId ? 'Update Section' : 'Add Section'}</Text>
        </View>

        {sectionError ? (
          <View style={styles.alertBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.alertText}>{sectionError}</Text>
          </View>
        ) : null}
        {sectionSuccess ? (
          <View style={[styles.alertBanner, styles.successBanner]}>
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
            <Text style={[styles.alertText, styles.successText]}>{sectionSuccess}</Text>
          </View>
        ) : null}

        <AuthInput
          label="Section Name"
          icon="list-outline"
          placeholder="e.g. BSIT-1A"
          value={sectionName}
          onChangeText={(t) => { setSectionName(t); setSectionError(''); setSectionSuccess(''); }}
          autoCapitalize="characters"
        />

        <DropdownSelect
          label="Year Level"
          icon="layers-outline"
          placeholder="Select year level"
          options={YEAR_LEVEL_OPTIONS}
          value={sectionYearLevel}
          onSelect={(val) => { setSectionYearLevel(val); setSectionError(''); }}
        />

        <DropdownSelect
          label="Program"
          icon="school-outline"
          placeholder={data.programs.length === 0 ? 'No programs available' : 'Select program'}
          options={programOptions}
          value={selectedProgramId}
          onSelect={(val) => { setSelectedProgramId(val); setSectionError(''); }}
        />

        <AuthButton
          title={editingSectionId ? 'Update Section' : 'Add Section'}
          onPress={handleAddSection}
          loading={sectionSubmitting}
          disabled={data.programs.length === 0}
          style={styles.submitBtn}
        />
        {editingSectionId ? (
          <AuthButton
            title="Cancel Edit"
            onPress={() => {
              setEditingSectionId(null);
              setSectionName('');
              setSectionYearLevel(null);
              setSelectedProgramId(null);
            }}
            variant="outline"
          />
        ) : null}
      </View>

      {/* ── Existing Sections List ── */}
      <View style={styles.listSection}>
        <Text style={styles.listTitle}>Sections ({data.sections.length})</Text>
        {data.sections.length === 0 ? (
          <Text style={styles.emptyText}>No sections added yet.</Text>
        ) : (
          data.sections.map((s) => (
            <View key={s._id || s.id} style={styles.listItem}>
              <Ionicons name="people-outline" size={16} color="#7C3AED" style={styles.listIcon} />
              <View style={styles.listItemContent}>
                <Text style={styles.listItemText}>{s.name}</Text>
                <Text style={styles.listItemSub}>
                  {s.yearLevel}{s.programName ? ` · ${s.programName}` : ''}
                </Text>
              </View>
              <View style={styles.sectionActions}>
                <AuthButton title="Edit" onPress={() => startEditSection(s)} variant="outline" style={styles.smallButton} />
                <AuthButton title="Delete" onPress={() => deleteSection(s.id || s._id)} variant="outline" style={[styles.smallButton, styles.deleteButton]} textStyle={styles.deleteText} />
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC'
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  content: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 48
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 20,
    marginBottom: 4
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A'
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8
  },
  alertText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
    fontWeight: '500'
  },
  successBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  successText: {
    color: '#059669'
  },
  submitBtn: {
    marginTop: 6
  },
  listSection: {
    marginBottom: 20
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10
  },
  listIcon: {
    marginRight: 12
  },
  listItemContent: {
    flex: 1
  },
  listItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B'
  },
  listItemSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2
  },
  sectionActions: {
    width: 86,
    marginLeft: 8
  },
  smallButton: {
    height: 36,
    marginVertical: 2,
    paddingHorizontal: 6
  },
  deleteButton: {
    borderColor: '#FCA5A5'
  },
  deleteText: {
    color: '#B91C1C',
    fontSize: 12
  }
});
