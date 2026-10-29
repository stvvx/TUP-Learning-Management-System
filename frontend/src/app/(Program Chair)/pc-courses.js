import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
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
  faint: '#A39A9E',
  line: '#E8E2E4',
  success: '#1F7A4D',
  successSoft: '#E3F4EA',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  dangerLine: '#FECDCA'
};

const YEAR_LEVEL_OPTIONS = [
  { label: 'First Year', value: 'First Year' },
  { label: 'Second Year', value: 'Second Year' },
  { label: 'Third Year', value: 'Third Year' },
  { label: 'Fourth Year', value: 'Fourth Year' }
];

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

export default function PcCoursesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
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

  const resetForm = () => {
    setSectionName('');
    setSectionYearLevel(null);
    setSelectedProgramId(null);
    setEditingSectionId(null);
  };

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
      resetForm();
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
    const warning = 'Students in this section will become unassigned, and faculty assignments for it will be removed.';
    const performDelete = async () => {
      try {
        await apiDeleteProgramChairSection(token, sectionId);
        if (editingSectionId === sectionId) resetForm();
        setSectionError('');
        setSectionSuccess('Section deleted successfully!');
        await load();
      } catch (err) {
        setSectionSuccess('');
        setSectionError(err.message || 'Failed to delete section.');
      }
    };

    // Alert.alert does nothing on web, so use a browser confirm there.
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete section?\n\n${warning}`)) performDelete();
    } else {
      Alert.alert('Delete section', warning, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete }
      ]);
    }
  };

  // Build program options for section dropdown
  const programOptions = data.programs.map((p) => ({
    label: p.name,
    value: p._id?.toString() || p.id
  }));

  if (isLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  if (!isProgramChair) return null;

  const isWide = width >= 900;

  const formCard = (
    <View style={styles.cardWrap}>
      <View style={styles.cardShadow} />
      <View style={styles.card}>
        <View style={styles.formTitleRow}>
          <Ionicons
            name={editingSectionId ? 'create-outline' : 'add-circle-outline'}
            size={22}
            color={COLORS.brand}
          />
          <Text style={styles.formTitle}>{editingSectionId ? 'Update section' : 'Add section'}</Text>
          {editingSectionId ? (
            <View style={styles.editingPill}>
              <Text style={styles.editingPillText}>EDITING</Text>
            </View>
          ) : null}
        </View>

        {sectionError ? <Banner kind="error">{sectionError}</Banner> : null}
        {sectionSuccess ? <Banner kind="success">{sectionSuccess}</Banner> : null}

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

        <View style={styles.formActions}>
          <AuthButton
            title={editingSectionId ? 'Update Section' : 'Add Section'}
            onPress={handleAddSection}
            loading={sectionSubmitting}
            disabled={data.programs.length === 0}
          />
          {editingSectionId ? (
            <AuthButton title="Cancel Edit" onPress={resetForm} variant="outline" />
          ) : null}
        </View>
      </View>
    </View>
  );

  const listPanel = (
    <View>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.heading}>Sections</Text>
        <Text style={styles.sectionCount}>{data.sections.length} total</Text>
      </View>
      {data.sections.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={30} color={COLORS.faint} />
          <Text style={styles.empty}>No sections added yet. Add your first one 👆</Text>
        </View>
      ) : (
        data.sections.map((s) => {
          const id = s._id || s.id;
          return (
            <View key={id} style={[styles.listItem, editingSectionId === id && styles.listItemEditing]}>
              <View style={styles.itemTopRow}>
                <View style={styles.itemIcon}>
                  <Ionicons name="people" size={18} color={COLORS.brand} />
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemText} numberOfLines={1}>{s.name}</Text>
                  <View style={styles.chipRow}>
                    {s.yearLevel ? (
                      <View style={styles.yearChip}>
                        <Text style={styles.yearChipText}>{s.yearLevel}</Text>
                      </View>
                    ) : null}
                    {s.programName ? (
                      <View style={styles.programChip}>
                        <Text style={styles.programChipText} numberOfLines={1}>{s.programName}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={styles.sectionActions}>
                <AuthButton title="Edit" onPress={() => startEditSection(s)} variant="outline" style={styles.actionButton} />
                <AuthButton
                  title="Delete"
                  onPress={() => deleteSection(s.id || s._id)}
                  variant="outline"
                  style={[styles.actionButton, styles.deleteButton]}
                  textStyle={styles.deleteText}
                />
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderIcon}>
          <Ionicons name="layers" size={22} color={COLORS.brand} />
        </View>
        <View style={styles.pageHeaderText}>
          <Text style={styles.title}>Sections</Text>
          <Text style={styles.pageSubtitle}>Add and manage sections for your programs</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{data.sections.length}</Text>
        </View>
      </View>

      <StaffHeader role="programchair" activeRoute="/pc-courses" />

      {/* Desktop: form left, list right. Phone: stacked. */}
      <View style={[styles.layout, isWide && styles.layoutWide]}>
        <View style={isWide ? styles.formCol : null}>{formCard}</View>
        <View style={isWide ? styles.listCol : null}>{listPanel}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.paper
  },
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

  /* Layout */
  layout: { gap: 8 },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  formCol: { width: 400 },
  listCol: { flex: 1, minWidth: 0 },

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

  /* Form card with hard offset shadow */
  cardWrap: { marginBottom: 24, marginRight: 6 },
  cardShadow: {
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  formTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink, flex: 1 },
  editingPill: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    transform: [{ rotate: '-2deg' }]
  },
  editingPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.brandDeep },
  formActions: { gap: 8, marginTop: 6 },

  /* List */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  heading: { fontSize: 18, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  sectionCount: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
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

  listItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.ink,
    marginBottom: 12
  },
  listItemEditing: { backgroundColor: COLORS.goldSoft },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listItemContent: { flex: 1, minWidth: 0 },
  listItemText: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  yearChip: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999
  },
  yearChipText: { fontSize: 11, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },
  programChip: {
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999,
    maxWidth: 220
  },
  programChipText: { fontSize: 11, fontWeight: '800', color: COLORS.brandDeep },
  sectionActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { flex: 1 },
  deleteButton: { borderColor: COLORS.danger },
  deleteText: { color: COLORS.danger }
});