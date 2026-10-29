import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AuthButton from '../../components/AuthButton';
import DropdownSelect from '../../components/DropdownSelect';
import StaffHeader from '../../components/StaffHeader';
import {
  apiGetProgramChairAcademic,
  apiGetProgramChairStudents,
  apiUpdateProgramChairStudentPlacement
} from '../../api/client';

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

const YEAR_LEVEL_OPTIONS = [
  { label: 'First Year', value: 'First Year' },
  { label: 'Second Year', value: 'Second Year' },
  { label: 'Third Year', value: 'Third Year' },
  { label: 'Fourth Year', value: 'Fourth Year' }
];

const sectionKey = (section) => section.id || section._id;

const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

/* ---------- Small presentational pieces ---------- */

function Stat({ value, label, tone }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone === 'warn' && styles.statValueWarn]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Banner({ tone, children, onDismiss }) {
  const isError = tone === 'error';
  const color = isError ? COLORS.danger : COLORS.success;
  return (
    <View style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]} accessibilityRole="alert">
      <Ionicons name={isError ? 'alert-circle' : 'checkmark-circle'} size={20} color={color} />
      <Text style={[styles.bannerText, { color }]}>{children}</Text>
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss message">
        <Ionicons name="close" size={18} color={color} />
      </Pressable>
    </View>
  );
}

function GroupHeader({ title, count, open, onToggle, tone }) {
  const warn = tone === 'warn';
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.groupHeader, warn && styles.groupHeaderWarn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <View style={[styles.groupIcon, warn && styles.groupIconWarn]}>
        <Ionicons name={warn ? 'alert' : 'school'} size={16} color={warn ? COLORS.goldDeep : COLORS.surface} />
      </View>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={[styles.countPill, warn && styles.countPillWarn]}>
        <Text style={[styles.countText, warn && styles.countTextWarn]}>{count}</Text>
      </View>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.brand} />
    </Pressable>
  );
}

function StudentRow({
  student,
  placement,
  sections,
  sectionName,
  expanded,
  dirty,
  saving,
  isWide,
  onToggle,
  onChangeYear,
  onChangeSection,
  onSave
}) {
  const sectionOptions = sections
    .filter((section) => !placement.yearLevel || section.yearLevel === placement.yearLevel)
    .map((section) => ({ label: section.name, value: sectionKey(section) }));

  const placed = Boolean(student.yearLevel && student.sectionId);

  return (
    <View
      style={[
        styles.card,
        isWide && styles.cardWide,
        expanded && styles.cardExpanded,
        expanded && isWide && styles.cardFull
      ]}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${student.name}. ${placed ? sectionName : 'Needs placement'}`}
      >
        <View style={[styles.avatar, !placed && styles.avatarWarn]}>
          <Text style={[styles.avatarText, !placed && styles.avatarTextWarn]}>{initialsOf(student.name)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.name} numberOfLines={1}>{student.name}</Text>
          <Text style={styles.email} numberOfLines={1}>{student.email}</Text>
        </View>
        <View style={[styles.chip, placed ? styles.chipOk : styles.chipWarn]}>
          <Text style={[styles.chipText, placed ? styles.chipTextOk : styles.chipTextWarn]} numberOfLines={1}>
            {placed ? sectionName : 'Needs placement'}
          </Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.editor}>
          <DropdownSelect
            label="Year Level"
            placeholder="Select year level"
            options={YEAR_LEVEL_OPTIONS}
            value={placement.yearLevel}
            onSelect={onChangeYear}
          />
          <DropdownSelect
            label="Section"
            placeholder={sectionOptions.length ? 'Select section' : 'No matching sections'}
            options={sectionOptions}
            value={placement.sectionId}
            onSelect={onChangeSection}
          />
          {dirty ? (
            <View style={styles.dirtyRow}>
              <Ionicons name="alert-circle-outline" size={15} color={COLORS.goldDeep} />
              <Text style={styles.dirtyNote}>You have unsaved changes.</Text>
            </View>
          ) : null}
          <AuthButton
            title={saving ? 'Saving…' : 'Save placement'}
            onPress={onSave}
            disabled={saving || !dirty || !placement.yearLevel || !placement.sectionId}
          />
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Screen ---------- */

export default function PcStudentsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, token, isLoading } = useAuth();
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [placements, setPlacements] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [closedGroups, setClosedGroups] = useState({});

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [listedStudents, academic] = await Promise.all([
        apiGetProgramChairStudents(token),
        apiGetProgramChairAcademic(token)
      ]);
      const validStudents = Array.isArray(listedStudents) ? listedStudents : [];
      setStudents(validStudents);
      setSections(Array.isArray(academic?.sections) ? academic.sections : []);
      setPlacements((current) =>
        validStudents.reduce((result, student) => ({
          ...result,
          [student.id]: current?.[student.id] || {
            yearLevel: student.yearLevel || '',
            sectionId: student.sectionId || ''
          }
        }), {})
      );
    } catch (err) {
      setError(err.message || 'Failed to load students.');
    }
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    if (user?.role !== 'program_chair') {
      router.replace('/dashboard');
      return;
    }
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
  }, [isLoading, loadData, router, user?.role]);

  const updatePlacement = async (studentId) => {
    const placement = placements[studentId];
    setError('');
    setMessage('');
    setSavingId(studentId);
    try {
      await apiUpdateProgramChairStudentPlacement(token, studentId, placement.yearLevel, placement.sectionId);
      setMessage('Student placement updated.');
      setExpandedId(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to update student placement.');
    } finally {
      setSavingId(null);
    }
  };

  const setPlacementField = (studentId, patch) =>
    setPlacements((current) => ({ ...current, [studentId]: { ...current[studentId], ...patch } }));

  const toggleGroup = (key) => setClosedGroups((current) => ({ ...current, [key]: !current[key] }));

  const sectionNameById = useMemo(
    () => (Array.isArray(sections) ? sections : []).reduce((result, section) => ({ ...result, [sectionKey(section)]: section.name }), {}),
    [sections]
  );

  const visibleStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      `${student.name || ''} ${student.email || ''}`.toLowerCase().includes(needle)
    );
  }, [query, students]);

  const studentsByYear = useMemo(() => YEAR_LEVEL_OPTIONS.map((year) => {
    const yearStudents = visibleStudents.filter((student) => student.yearLevel === year.value);
    const yearSections = sections.filter((section) => section.yearLevel === year.value);
    return {
      ...year,
      total: yearStudents.length,
      sections: yearSections.map((section) => ({
        ...section,
        students: yearStudents.filter((student) => student.sectionId === sectionKey(section))
      })),
      unassigned: yearStudents.filter((student) => !student.sectionId)
    };
  }), [sections, visibleStudents]);

  const noYearStudents = visibleStudents.filter((student) => !student.yearLevel);

  const placedCount = students.filter((student) => student.yearLevel && student.sectionId).length;
  const needsPlacementCount = students.length - placedCount;

  if (isLoading || user?.role !== 'program_chair') return null;

  const isWide = width >= 900;

  const renderStudent = (student) => {
    const placement = placements[student.id] || { yearLevel: '', sectionId: '' };
    const dirty =
      placement.yearLevel !== (student.yearLevel || '') ||
      placement.sectionId !== (student.sectionId || '');
    return (
      <StudentRow
        key={student.id}
        student={student}
        placement={placement}
        sections={sections}
        sectionName={sectionNameById[student.sectionId] || 'Section assigned'}
        expanded={expandedId === student.id}
        dirty={dirty}
        saving={savingId === student.id}
        isWide={isWide}
        onToggle={() => setExpandedId((current) => (current === student.id ? null : student.id))}
        onChangeYear={(value) => setPlacementField(student.id, { yearLevel: value, sectionId: '' })}
        onChangeSection={(value) => setPlacementField(student.id, { sectionId: value })}
        onSave={() => updatePlacement(student.id)}
      />
    );
  };

  // Phones: one column. Desktop: two-column grid of student cards.
  const renderList = (list) => <View style={[styles.list, isWide && styles.listWide]}>{list.map(renderStudent)}</View>;

  const searching = query.trim().length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderIcon}>
          <Ionicons name="people" size={22} color={COLORS.brand} />
        </View>
        <View style={styles.pageHeaderText}>
          <Text style={styles.title}>Students</Text>
          <Text style={styles.pageSubtitle}>Tap a student to change their year level and section</Text>
        </View>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>{students.length}</Text>
        </View>
      </View>

      <StaffHeader role="programchair" activeRoute="/pc-students" />

      {/* Stats with hard offset shadow */}
      <View style={styles.cardWrap}>
        <View style={styles.cardShadow} />
        <View style={styles.statsStrip}>
          <Stat value={students.length} label="Students" />
          <View style={styles.statDivider} />
          <Stat value={placedCount} label="Placed" />
          <View style={styles.statDivider} />
          <Stat value={needsPlacementCount} label="Need placement" tone={needsPlacementCount ? 'warn' : undefined} />
        </View>
      </View>

      {/* Search */}
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
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={COLORS.faint} />
          </Pressable>
        ) : null}
      </View>

      {error ? <Banner tone="error" onDismiss={() => setError('')}>{error}</Banner> : null}
      {message ? <Banner tone="success" onDismiss={() => setMessage('')}>{message}</Banner> : null}

      {noYearStudents.length ? (
        <View style={styles.group}>
          <GroupHeader
            title="No year level yet"
            count={noYearStudents.length}
            tone="warn"
            open={!closedGroups.noYear}
            onToggle={() => toggleGroup('noYear')}
          />
          {!closedGroups.noYear ? renderList(noYearStudents) : null}
        </View>
      ) : null}

      {studentsByYear.map((group) => {
        const open = searching ? true : !closedGroups[group.value];
        return (
          <View key={group.value} style={styles.group}>
            <GroupHeader
              title={group.label}
              count={group.total}
              open={open}
              onToggle={() => toggleGroup(group.value)}
            />
            {open ? (
              <>
                {group.sections.map((section) => {
                  if (searching && !section.students.length) return null;
                  return (
                    <View key={sectionKey(section)}>
                      <View style={styles.sectionHeadingRow}>
                        <Text style={styles.sectionHeading}>{section.name}</Text>
                        <Text style={styles.sectionCount}>{section.students.length}</Text>
                      </View>
                      {section.students.length
                        ? renderList(section.students)
                        : <Text style={styles.empty}>No students in this section yet.</Text>}
                    </View>
                  );
                })}
                {group.unassigned.length ? (
                  <View>
                    <View style={styles.sectionHeadingRow}>
                      <Text style={[styles.sectionHeading, styles.sectionHeadingWarn]}>Not in a section</Text>
                      <Text style={styles.sectionCount}>{group.unassigned.length}</Text>
                    </View>
                    {renderList(group.unassigned)}
                  </View>
                ) : null}
                {!group.sections.length && !group.unassigned.length ? (
                  <Text style={styles.empty}>
                    {searching ? 'No matching students.' : 'No students in this year level yet.'}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}

      {searching && !visibleStudents.length ? (
        <View style={styles.emptyBox}>
          <Ionicons name="search-outline" size={28} color={COLORS.faint} />
          <Text style={styles.noResults}>No students match “{query.trim()}”.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, paddingTop: 48, paddingBottom: 56 },
  pressed: { opacity: 0.7 },

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
  headerPill: {
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
  headerPillText: { color: COLORS.surface, fontWeight: '800', fontSize: 14 },

  /* Stats */
  cardWrap: { marginBottom: 18, marginRight: 6 },
  cardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: COLORS.gold,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.ink,
    paddingVertical: 14
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900', color: COLORS.brand },
  statValueWarn: { color: COLORS.goldDeep },
  statLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted, marginTop: 2 },
  statDivider: { width: 1.5, backgroundColor: COLORS.line },

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

  /* Banners */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1
  },
  bannerError: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.dangerLine },
  bannerSuccess: { backgroundColor: COLORS.successSoft, borderColor: '#B7E1C8' },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },

  /* Groups */
  group: { marginTop: 12 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10
  },
  groupHeaderWarn: { backgroundColor: COLORS.goldSoft },
  groupIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupIconWarn: { backgroundColor: COLORS.gold },
  groupTitle: { flex: 1, fontSize: 17, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  countPill: {
    minWidth: 28,
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.brandSoft
  },
  countPillWarn: { backgroundColor: COLORS.gold },
  countText: { fontSize: 13, fontWeight: '800', color: COLORS.brand },
  countTextWarn: { color: COLORS.brandDeep },

  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 2
  },
  sectionHeading: { fontSize: 13, fontWeight: '800', color: COLORS.brand, letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionHeadingWarn: { color: COLORS.goldDeep },
  sectionCount: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.brandDeep,
    backgroundColor: COLORS.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden'
  },

  /* Student cards: 1 column on phone, 2 on desktop */
  list: { marginBottom: 6 },
  listWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.line,
    marginBottom: 10,
    overflow: 'hidden'
  },
  cardWide: { width: '49%', marginBottom: 0 },
  cardFull: { width: '100%' },
  cardExpanded: { borderColor: COLORS.ink },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarWarn: { backgroundColor: COLORS.surface, borderStyle: 'dashed' },
  avatarText: { fontSize: 14, fontWeight: '900', color: COLORS.brandDeep },
  avatarTextWarn: { color: COLORS.goldDeep },
  cardInfo: { flex: 1, minWidth: 0, marginRight: 10 },
  name: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  email: { fontSize: 13, color: COLORS.muted, marginTop: 2 },

  chip: { maxWidth: 120, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1.5 },
  chipOk: { backgroundColor: COLORS.brand, borderColor: COLORS.ink },
  chipWarn: { backgroundColor: COLORS.goldSoft, borderColor: COLORS.ink },
  chipText: { fontSize: 12, fontWeight: '800' },
  chipTextOk: { color: COLORS.surface },
  chipTextWarn: { color: COLORS.brandDeep },

  editor: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: COLORS.goldSoft,
    backgroundColor: COLORS.paper
  },
  dirtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 },
  dirtyNote: { fontSize: 13, fontWeight: '600', color: COLORS.goldDeep },

  empty: { color: COLORS.muted, fontSize: 13, marginBottom: 10, marginLeft: 2 },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    padding: 24,
    marginTop: 20
  },
  noResults: { textAlign: 'center', color: COLORS.muted, fontSize: 14 }
});