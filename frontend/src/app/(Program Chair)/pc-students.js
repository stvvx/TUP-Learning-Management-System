import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AuthButton from '../../components/AuthButton';
import DropdownSelect from '../../components/DropdownSelect';
import StaffHeader from '../../components/StaffHeader';
import { apiGetProgramChairAcademic } from '../../api/client';
import {
  apiGetProgramChairStudents,
  apiUpdateProgramChairStudentPlacement
} from '../../api/programChairStudents';

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
  return (
    <View style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]}>
      <Text style={[styles.bannerText, isError ? styles.bannerTextError : styles.bannerTextSuccess]}>
        {children}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss message">
        <Text style={[styles.bannerClose, isError ? styles.bannerTextError : styles.bannerTextSuccess]}>✕</Text>
      </Pressable>
    </View>
  );
}

function GroupHeader({ title, count, open, onToggle, tone }) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <View style={[styles.groupAccent, tone === 'warn' && styles.groupAccentWarn]} />
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={[styles.countPill, tone === 'warn' && styles.countPillWarn]}>
        <Text style={[styles.countText, tone === 'warn' && styles.countTextWarn]}>{count}</Text>
      </View>
      <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
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
    <View style={[styles.card, expanded && styles.cardExpanded]}>
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
          {dirty ? <Text style={styles.dirtyNote}>You have unsaved changes.</Text> : null}
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
      setStudents(listedStudents);
      setSections(academic.sections || []);
      setPlacements((current) => listedStudents.reduce((result, student) => ({
        ...result,
        [student.id]: current[student.id] || {
          yearLevel: student.yearLevel || '',
          sectionId: student.sectionId || ''
        }
      }), {}));
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
    () => sections.reduce((result, section) => ({ ...result, [sectionKey(section)]: section.name }), {}),
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
        onToggle={() => setExpandedId((current) => (current === student.id ? null : student.id))}
        onChangeYear={(value) => setPlacementField(student.id, { yearLevel: value, sectionId: '' })}
        onChangeSection={(value) => setPlacementField(student.id, { sectionId: value })}
        onSave={() => updatePlacement(student.id)}
      />
    );
  };

  const searching = query.trim().length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Students</Text>
      <StaffHeader role="programchair" activeRoute="/pc-students" />
      <Text style={styles.subtitle}>
        Tap a student to change their year level and section.
      </Text>

      <View style={styles.statsStrip}>
        <Stat value={students.length} label="Students" />
        <View style={styles.statDivider} />
        <Stat value={placedCount} label="Placed" />
        <View style={styles.statDivider} />
        <Stat value={needsPlacementCount} label="Need placement" tone={needsPlacementCount ? 'warn' : undefined} />
      </View>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or email"
        placeholderTextColor="#8A94A6"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />

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
          {!closedGroups.noYear ? noYearStudents.map(renderStudent) : null}
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
                      <Text style={styles.sectionHeading}>
                        {section.name}
                        <Text style={styles.sectionCount}>{`  ${section.students.length}`}</Text>
                      </Text>
                      {section.students.length
                        ? section.students.map(renderStudent)
                        : <Text style={styles.empty}>No students in this section yet.</Text>}
                    </View>
                  );
                })}
                {group.unassigned.length ? (
                  <View>
                    <Text style={[styles.sectionHeading, styles.sectionHeadingWarn]}>
                      Not in a section
                      <Text style={styles.sectionCount}>{`  ${group.unassigned.length}`}</Text>
                    </Text>
                    {group.unassigned.map(renderStudent)}
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
        <Text style={styles.noResults}>No students match “{query.trim()}”.</Text>
      ) : null}
    </ScrollView>
  );
}

/* ---------- Styles ---------- */

const COLORS = {
  bg: '#F3F5F8',
  surface: '#FFFFFF',
  ink: '#172033',
  muted: '#5B6577',
  line: '#DDE2EA',
  accent: '#8A1C2B',
  accentSoft: '#F6E9EB',
  ok: '#1F7A55',
  okSoft: '#E4F3EC',
  warn: '#B45309',
  warnSoft: '#FDF0DC',
  danger: '#B42318',
  dangerSoft: '#FDECEA'
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingTop: 48, paddingBottom: 56 },
  pressed: { opacity: 0.7 },

  title: { fontSize: 28, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.5, marginBottom: 16 },
  subtitle: { fontSize: 14, lineHeight: 20, color: COLORS.muted, marginTop: 4, marginBottom: 16 },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingVertical: 14,
    marginBottom: 14
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.ink },
  statValueWarn: { color: COLORS.warn },
  statLabel: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.line },

  search: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
    marginBottom: 14
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14
  },
  bannerError: { backgroundColor: COLORS.dangerSoft },
  bannerSuccess: { backgroundColor: COLORS.okSoft },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', marginRight: 12 },
  bannerTextError: { color: COLORS.danger },
  bannerTextSuccess: { color: COLORS.ok },
  bannerClose: { fontSize: 14, fontWeight: '700' },

  group: { marginTop: 10 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 6
  },
  groupAccent: { width: 4, height: 22, borderRadius: 2, backgroundColor: COLORS.accent, marginRight: 10 },
  groupAccentWarn: { backgroundColor: COLORS.warn },
  groupTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: COLORS.ink },
  countPill: {
    minWidth: 28,
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    marginRight: 10
  },
  countPillWarn: { backgroundColor: COLORS.warnSoft },
  countText: { fontSize: 13, fontWeight: '700', color: COLORS.accent },
  countTextWarn: { color: COLORS.warn },
  chevron: { fontSize: 24, color: COLORS.muted, transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }] },

  sectionHeading: { fontSize: 15, fontWeight: '700', color: COLORS.muted, marginTop: 10, marginBottom: 8, marginLeft: 2 },
  sectionHeadingWarn: { color: COLORS.warn },
  sectionCount: { fontWeight: '500', color: '#8A94A6' },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    marginBottom: 10,
    overflow: 'hidden'
  },
  cardExpanded: { borderColor: COLORS.accent },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarWarn: { backgroundColor: COLORS.warnSoft },
  avatarText: { fontSize: 14, fontWeight: '800', color: COLORS.accent },
  avatarTextWarn: { color: COLORS.warn },
  cardInfo: { flex: 1, marginRight: 10 },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  email: { fontSize: 13, color: COLORS.muted, marginTop: 2 },

  chip: { maxWidth: 120, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipOk: { backgroundColor: COLORS.okSoft },
  chipWarn: { backgroundColor: COLORS.warnSoft },
  chipText: { fontSize: 12, fontWeight: '700' },
  chipTextOk: { color: COLORS.ok },
  chipTextWarn: { color: COLORS.warn },

  editor: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: '#FAFBFC'
  },
  dirtyNote: { fontSize: 13, color: COLORS.warn, marginVertical: 8 },

  empty: { color: COLORS.muted, fontSize: 14, marginBottom: 10, marginLeft: 2 },
  noResults: { textAlign: 'center', color: COLORS.muted, fontSize: 15, marginTop: 24 }
});