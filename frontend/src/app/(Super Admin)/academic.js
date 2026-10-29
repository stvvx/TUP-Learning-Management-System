import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

// Card with the hard offset gold shadow
function FormCard({ icon, title, children }) {
  return (
    <View style={styles.cardWrap}>
      <View style={styles.cardShadow} />
      <View style={styles.card}>
        <View style={styles.formTitleRow}>
          <Ionicons name={icon} size={22} color={COLORS.brand} />
          <Text style={styles.formTitle}>{title}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

export default function AcademicScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
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

  const isWide = width >= 900;

  const forms = (
    <>
      {/* Add Program */}
      <FormCard icon="school-outline" title="Add program">
        <AuthInput
          label="Program Name"
          icon="school-outline"
          placeholder="e.g. Bachelor of Science in Information Technology"
          value={program}
          onChangeText={(t) => { setProgram(t); setError(''); }}
        />
        <AuthButton title="Add Program" onPress={handleAddProgram} />
      </FormCard>

      {/* Add Section */}
      <FormCard icon="add-circle-outline" title="Add section">
        <AuthInput
          label="Section Name"
          icon="list-outline"
          placeholder="e.g. BSIT-1A"
          value={section}
          onChangeText={(t) => { setSection(t); setError(''); }}
          autoCapitalize="characters"
        />
        <DropdownSelect
          label="Year Level"
          icon="layers-outline"
          placeholder="Select year level"
          options={YEAR_LEVEL_OPTIONS}
          value={yearLevel}
          onSelect={(val) => { setYearLevel(val); setError(''); }}
        />
        <DropdownSelect
          label="Program"
          icon="school-outline"
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
      </FormCard>
    </>
  );

  const list = (
    <View>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.heading}>Existing sections</Text>
        <Text style={styles.sectionCount}>{data.sections.length} total</Text>
      </View>
      {data.sections.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={30} color={COLORS.faint} />
          <Text style={styles.empty}>No sections added yet.</Text>
        </View>
      ) : (
        data.sections.map((item) => (
          <View key={item.id || item._id} style={styles.listItem}>
            <View style={styles.itemIcon}>
              <Ionicons name="people" size={18} color={COLORS.brand} />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.chipRow}>
                {item.yearLevel ? (
                  <View style={styles.yearChip}>
                    <Text style={styles.yearChipText}>{item.yearLevel}</Text>
                  </View>
                ) : null}
                {item.programName ? (
                  <View style={styles.programChip}>
                    <Text style={styles.programChipText} numberOfLines={1}>{item.programName}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ))
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
          <Ionicons name="library" size={22} color={COLORS.brand} />
        </View>
        <View style={styles.pageHeaderText}>
          <Text style={styles.title}>Programs & Sections</Text>
          <Text style={styles.pageSubtitle}>Set up the academic structure</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{data.sections.length}</Text>
        </View>
      </View>

      <StaffHeader role="superadmin" activeRoute="/academic" />

      {error ? <Banner kind="error">{error}</Banner> : null}
      {message ? <Banner kind="success">{message}</Banner> : null}

      {/* Desktop: forms left, list right. Phone: stacked. */}
      <View style={[styles.layout, isWide && styles.layoutWide]}>
        <View style={isWide ? styles.formCol : null}>{forms}</View>
        <View style={isWide ? styles.listCol : null}>{list}</View>
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

  /* Layout */
  layout: { gap: 8 },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  formCol: { width: 400 },
  listCol: { flex: 1, minWidth: 0 },

  /* Form cards with hard offset shadow */
  cardWrap: { marginBottom: 28, marginRight: 6 },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.ink,
    marginBottom: 10
  },
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
  itemContent: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
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
    maxWidth: 240
  },
  programChipText: { fontSize: 11, fontWeight: '800', color: COLORS.brandDeep }
});