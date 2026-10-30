import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AuthButton from '../../components/AuthButton';
import StaffHeader from '../../components/StaffHeader';
import {
  apiAssignSubject,
  apiGetProgramChairData
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

const YEAR_LEVELS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];
const TERMS = ['First Term', 'Second Term', 'Third Term'];
const YEAR_OPTIONS = YEAR_LEVELS.map((value) => ({ label: value, value }));
const TERM_OPTIONS = TERMS.map((value) => ({ label: value, value }));

const ROLE_LABELS = {
  faculty: 'Faculty',
  instructor: 'Instructor',
  program_chair: 'Program Chair'
};

const orderOf = (list, value) => {
  const index = list.indexOf(value);
  return index === -1 ? 99 : index;
};

const idOf = (item) => item.id || item._id;

/* ───────────────────────── Small pieces ───────────────────────── */

function Banner({ kind, children }) {
  const isError = kind === 'error';
  return (
    <View style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]} accessibilityRole="alert">
      <Ionicons
        name={isError ? 'alert-circle' : 'checkmark-circle'}
        size={20}
        color={isError ? COLORS.danger : COLORS.success}
      />
      <Text style={[styles.bannerText, { color: isError ? COLORS.danger : COLORS.success }]}>{children}</Text>
    </View>
  );
}

function SummaryChip({ label, value, sub }) {
  return (
    <View style={[styles.chip, !value && styles.chipEmpty]}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, !value && styles.chipValueEmpty]} numberOfLines={1}>
        {value || 'Not selected'}
      </Text>
      {value && sub ? <Text style={styles.chipSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

// Chip filter row (All + options)
function FilterRow({ label, options, value, onChange }) {
  const all = [{ label: 'All', value: 'all' }, ...options];
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterChips}
      >
        {all.map((option) => {
          const active = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Card that holds one step (filters + table)
function StepCard({ step, icon, title, count, children }) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={styles.stepBubble}>
          <Text style={styles.stepBubbleText}>{step}</Text>
        </View>
        <Ionicons name={icon} size={18} color={COLORS.brand} />
        <Text style={styles.stepTitle}>{title}</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{count}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

/**
 * Selectable data table.
 * columns: [{ label, width?, flex?, render(data) }]
 * rows: [{ type: 'group', key, label, sub, count } | { type: 'row', id, data }]
 */
function DataTable({ columns, rows, selectedId, onSelect, emptyText, maxHeight }) {
  const hasRows = rows.some((row) => row.type === 'row');
  if (!hasRows) {
    return (
      <View style={styles.emptyBox}>
        <Ionicons name="file-tray-outline" size={26} color={COLORS.faint} />
        <Text style={styles.empty}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={styles.thead}>
        <View style={styles.radioCol} />
        {columns.map((column) => (
          <Text
            key={column.label}
            style={[styles.th, column.width ? { width: column.width } : { flex: column.flex || 1 }]}
            numberOfLines={1}
          >
            {column.label}
          </Text>
        ))}
      </View>
      <ScrollView style={{ maxHeight }} nestedScrollEnabled showsVerticalScrollIndicator>
        {rows.map((row) => {
          if (row.type === 'group') {
            return (
              <View key={row.key} style={styles.groupRow}>
                <Ionicons name="school" size={14} color={COLORS.brand} />
                <Text style={styles.groupText} numberOfLines={1}>{row.label}</Text>
                {row.sub ? (
                  <View style={styles.termTag}>
                    <Text style={styles.termTagText}>{row.sub}</Text>
                  </View>
                ) : null}
                <Text style={styles.groupCount}>{row.count}</Text>
              </View>
            );
          }
          const selected = selectedId === row.id;
          return (
            <TouchableOpacity
              key={row.id}
              style={[styles.tr, selected && styles.trSelected]}
              onPress={() => onSelect(row.id)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={styles.radioCol}>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected ? <Ionicons name="checkmark" size={13} color={COLORS.brandDeep} /> : null}
                </View>
              </View>
              {columns.map((column) => (
                <View
                  key={column.label}
                  style={[styles.td, column.width ? { width: column.width } : { flex: column.flex || 1 }]}
                >
                  {column.render(row.data)}
                </View>
              ))}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ───────────────────────── Screen ───────────────────────── */

export default function AssignmentsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, token, isLoading } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Filters
  const [subjectYear, setSubjectYear] = useState('all');
  const [subjectTerm, setSubjectTerm] = useState('all');
  const [sectionYear, setSectionYear] = useState('all');
  const [facultyQuery, setFacultyQuery] = useState('');

  const isProgramChair = user?.role === 'program_chair';
  const faculty = useMemo(
    () => users.filter((item) => ['faculty', 'instructor', 'program_chair'].includes(item.role)),
    [users]
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGetProgramChairData(token);
      setSubjects(data.subjects);
      setUsers(data.users);
      setSections(data.sections);
    } catch (err) {
      setError(err.message || 'Failed to load assignment data.');
    }
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    if (!isProgramChair) {
      router.replace('/dashboard');
      return;
    }
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
  }, [isLoading, isProgramChair, loadData, router]);

  const assignFaculty = async () => {
    setError('');
    setMessage('');
    setIsAssigning(true);
    try {
      await apiAssignSubject(token, selectedFaculty, selectedSubject, selectedSection);
      setMessage('Subject assigned to faculty successfully.');
    } catch (err) {
      setError(err.message || 'Failed to assign subject.');
    } finally {
      setIsAssigning(false);
    }
  };

  const resetSelection = () => {
    setSelectedSubject('');
    setSelectedSection('');
    setSelectedFaculty('');
  };

  // Picking a subject narrows the section list to the same year level
  const pickSubject = (id) => {
    setSelectedSubject(id);
    const subject = subjects.find((item) => idOf(item) === id);
    if (subject?.yearLevel && YEAR_LEVELS.includes(subject.yearLevel)) {
      setSectionYear(subject.yearLevel);
    }
  };

  /* Table rows, organised by Year Level → Semester */
  const subjectRows = useMemo(() => {
    const map = new Map();
    subjects.forEach((subject) => {
      if (subjectYear !== 'all' && subject.yearLevel !== subjectYear) return;
      if (subjectTerm !== 'all' && subject.term !== subjectTerm) return;
      const year = subject.yearLevel || 'No year level';
      const term = subject.term || 'No semester';
      const key = `${year}|${term}`;
      if (!map.has(key)) map.set(key, { key, year, term, items: [] });
      map.get(key).items.push(subject);
    });
    return [...map.values()]
      .sort((a, b) => orderOf(YEAR_LEVELS, a.year) - orderOf(YEAR_LEVELS, b.year) || orderOf(TERMS, a.term) - orderOf(TERMS, b.term))
      .flatMap((group) => [
        { type: 'group', key: group.key, label: group.year, sub: group.term, count: group.items.length },
        ...group.items.map((subject) => ({ type: 'row', id: idOf(subject), data: subject }))
      ]);
  }, [subjects, subjectYear, subjectTerm]);

  const sectionRows = useMemo(() => {
    const map = new Map();
    sections.forEach((section) => {
      if (sectionYear !== 'all' && section.yearLevel !== sectionYear) return;
      const year = section.yearLevel || 'No year level';
      if (!map.has(year)) map.set(year, { year, items: [] });
      map.get(year).items.push(section);
    });
    return [...map.values()]
      .sort((a, b) => orderOf(YEAR_LEVELS, a.year) - orderOf(YEAR_LEVELS, b.year))
      .flatMap((group) => [
        { type: 'group', key: group.year, label: group.year, count: group.items.length },
        ...group.items.map((section) => ({ type: 'row', id: idOf(section), data: section }))
      ]);
  }, [sections, sectionYear]);

  const facultyRows = useMemo(() => {
    const needle = facultyQuery.trim().toLowerCase();
    return faculty
      .filter((member) => !needle || `${member.name || ''} ${member.email || ''}`.toLowerCase().includes(needle))
      .map((member) => ({ type: 'row', id: member.id, data: member }));
  }, [faculty, facultyQuery]);

  if (isLoading || !isProgramChair) return null;

  const isWide = width >= 900;
  const tableHeight = isWide ? 420 : 300;
  const sideTableHeight = isWide ? 210 : 300;

  const subjectObj = subjects.find((s) => idOf(s) === selectedSubject);
  const sectionObj = sections.find((s) => idOf(s) === selectedSection);
  const facultyObj = faculty.find((m) => m.id === selectedFaculty);
  const selectedCount = [selectedSubject, selectedSection, selectedFaculty].filter(Boolean).length;
  const hasProgram = sections.some((section) => section.programName);

  const subjectColumns = [
    { label: 'Code', width: 86, render: (d) => <Text style={styles.codeText} numberOfLines={1}>{d.code}</Text> },
    { label: 'Description', flex: 1, render: (d) => <Text style={styles.cellText} numberOfLines={2}>{d.description}</Text> }
  ];

  const sectionColumns = [
    { label: 'Section', flex: 1, render: (d) => <Text style={styles.codeText} numberOfLines={1}>{d.name}</Text> },
    ...(hasProgram
      ? [{ label: 'Program', flex: 1.2, render: (d) => <Text style={styles.cellText} numberOfLines={2}>{d.programName || '—'}</Text> }]
      : [])
  ];

  const facultyColumns = [
    {
      label: 'Name',
      flex: 1.4,
      render: (d) => (
        <View>
          <Text style={styles.nameText} numberOfLines={1}>{d.name}</Text>
          <Text style={styles.subText} numberOfLines={1}>{d.email}</Text>
        </View>
      )
    },
    {
      label: 'Role',
      width: 100,
      render: (d) => (
        <View style={styles.roleChip}>
          <Text style={styles.roleChipText} numberOfLines={1}>{ROLE_LABELS[d.role] || d.role}</Text>
        </View>
      )
    }
  ];

  const subjectsCard = (
    <StepCard step="1" icon="library-outline" title="Subject" count={subjects.length}>
      <FilterRow label="Year" options={YEAR_OPTIONS} value={subjectYear} onChange={setSubjectYear} />
      <FilterRow label="Semester" options={TERM_OPTIONS} value={subjectTerm} onChange={setSubjectTerm} />
      <DataTable
        columns={subjectColumns}
        rows={subjectRows}
        selectedId={selectedSubject}
        onSelect={pickSubject}
        emptyText={subjects.length === 0 ? 'No subjects found.' : 'No subjects match these filters.'}
        maxHeight={tableHeight}
      />
    </StepCard>
  );

  const sectionsCard = (
    <StepCard step="2" icon="people-outline" title="Section" count={sections.length}>
      <FilterRow label="Year" options={YEAR_OPTIONS} value={sectionYear} onChange={setSectionYear} />
      <DataTable
        columns={sectionColumns}
        rows={sectionRows}
        selectedId={selectedSection}
        onSelect={setSelectedSection}
        emptyText={sections.length === 0 ? 'No sections found.' : 'No sections for this year level.'}
        maxHeight={sideTableHeight}
      />
    </StepCard>
  );

  const facultyCard = (
    <StepCard step="3" icon="person-outline" title="Faculty" count={faculty.length}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={COLORS.muted} />
        <TextInput
          style={styles.search}
          value={facultyQuery}
          onChangeText={setFacultyQuery}
          placeholder="Search faculty name or email"
          placeholderTextColor={COLORS.faint}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {facultyQuery ? (
          <TouchableOpacity onPress={() => setFacultyQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={COLORS.faint} />
          </TouchableOpacity>
        ) : null}
      </View>
      <DataTable
        columns={facultyColumns}
        rows={facultyRows}
        selectedId={selectedFaculty}
        onSelect={setSelectedFaculty}
        emptyText={faculty.length === 0 ? 'No faculty found.' : 'No faculty match your search.'}
        maxHeight={sideTableHeight}
      />
    </StepCard>
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
          <Ionicons name="git-network" size={22} color={COLORS.brand} />
        </View>
        <View style={styles.pageHeaderText}>
          <Text style={styles.title}>Assign Subjects</Text>
          <Text style={styles.pageSubtitle}>Pick a subject, a section, then a faculty member</Text>
        </View>
        <View style={styles.progressPill}>
          <Text style={styles.progressPillText}>{selectedCount}/3</Text>
        </View>
      </View>

      <StaffHeader role="programchair" activeRoute="/assignments" />

      {error ? <Banner kind="error">{error}</Banner> : null}
      {message ? <Banner kind="success">{message}</Banner> : null}

      {/* Selection summary + action */}
      <View style={styles.cardWrap}>
        <View style={styles.cardShadow} />
        <View style={styles.card}>
          <View style={styles.formTitleRow}>
            <Ionicons name="link-outline" size={22} color={COLORS.brand} />
            <Text style={styles.formTitle}>Your assignment</Text>
            {selectedCount > 0 ? (
              <TouchableOpacity onPress={resetSelection} hitSlop={8} accessibilityRole="button">
                <Text style={styles.resetText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={[styles.chipRow, isWide && styles.chipRowWide]}>
            <SummaryChip
              label="SUBJECT"
              value={subjectObj?.code}
              sub={subjectObj ? `${subjectObj.yearLevel || ''}${subjectObj.term ? ` · ${subjectObj.term}` : ''}` : ''}
            />
            <SummaryChip label="SECTION" value={sectionObj?.name} sub={sectionObj?.yearLevel} />
            <SummaryChip label="FACULTY" value={facultyObj?.name} sub={facultyObj?.email} />
          </View>
          <View style={styles.actionWrap}>
            <AuthButton
              title="Assign Subject"
              onPress={assignFaculty}
              loading={isAssigning}
              disabled={!selectedSubject || !selectedFaculty || !selectedSection || isAssigning}
            />
          </View>
        </View>
      </View>

      {/* Desktop: subjects on the left, sections + faculty on the right. Phone: stacked. */}
      {isWide ? (
        <View style={styles.layoutWide}>
          <View style={styles.leftCol}>{subjectsCard}</View>
          <View style={styles.rightCol}>
            {sectionsCard}
            {facultyCard}
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          {subjectsCard}
          {sectionsCard}
          {facultyCard}
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
  progressPill: {
    minWidth: 44,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: COLORS.brand,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  progressPillText: { color: COLORS.surface, fontWeight: '800', fontSize: 14 },

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

  /* Summary card with hard offset shadow */
  cardWrap: { marginBottom: 26, marginRight: 6 },
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
  resetText: { fontSize: 12, fontWeight: '800', color: COLORS.brand, textDecorationLine: 'underline' },
  chipRow: { gap: 8 },
  chipRowWide: { flexDirection: 'row' },
  chip: {
    flex: 1,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipEmpty: { backgroundColor: COLORS.paper, borderColor: COLORS.line, borderStyle: 'dashed' },
  chipLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: COLORS.muted },
  chipValue: { fontSize: 14, fontWeight: '800', color: COLORS.brandDeep, marginTop: 2 },
  chipValueEmpty: { color: COLORS.faint, fontWeight: '600' },
  chipSub: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  actionWrap: { marginTop: 14 },

  /* Layout */
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  leftCol: { flex: 1.3, minWidth: 0 },
  rightCol: { flex: 1, minWidth: 0, gap: 20 },
  stack: { gap: 16 },

  /* Step cards */
  stepCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 14
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  stepBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepBubbleText: { color: COLORS.surface, fontSize: 12, fontWeight: '800' },
  stepTitle: { flex: 1, fontSize: 17, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  countPill: {
    minWidth: 26,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: COLORS.brandSoft
  },
  countPillText: { fontSize: 12, fontWeight: '800', color: COLORS.brand },

  /* Filters */
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  filterLabel: { width: 62, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: COLORS.muted, textTransform: 'uppercase' },
  filterScroll: { flex: 1 },
  filterChips: { gap: 6, paddingRight: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.line
  },
  filterChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.ink },
  filterChipText: { fontSize: 12, fontWeight: '800', color: COLORS.muted },
  filterChipTextActive: { color: COLORS.surface },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.paper,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10
  },
  search: { flex: 1, paddingVertical: 9, fontSize: 14, color: COLORS.ink, outlineStyle: 'none' },

  /* Data table */
  table: {
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4
  },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldSoft,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.ink,
    paddingVertical: 8,
    paddingRight: 10
  },
  th: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: COLORS.brandDeep,
    textTransform: 'uppercase',
    paddingRight: 8
  },
  radioCol: { width: 38, alignItems: 'center', justifyContent: 'center' },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.brandSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line
  },
  groupText: { fontSize: 12, fontWeight: '900', color: COLORS.brand, letterSpacing: 0.3 },
  termTag: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 999
  },
  termTagText: { fontSize: 10, fontWeight: '800', color: COLORS.brandDeep },
  groupCount: { marginLeft: 'auto', fontSize: 11, fontWeight: '800', color: COLORS.muted },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingRight: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent'
  },
  trSelected: { backgroundColor: COLORS.goldSoft, borderLeftColor: COLORS.brand },
  td: { paddingRight: 8, justifyContent: 'center' },
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
  codeText: { fontSize: 13, fontWeight: '900', color: COLORS.brand },
  cellText: { fontSize: 13, color: COLORS.ink, lineHeight: 17 },
  nameText: { fontSize: 13, fontWeight: '800', color: COLORS.ink },
  subText: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  roleChip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1
  },
  roleChipText: { fontSize: 10, fontWeight: '800', color: COLORS.brandDeep },

  /* Empty */
  emptyBox: {
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    padding: 18,
    marginTop: 4
  },
  empty: { color: COLORS.muted, textAlign: 'center', fontSize: 13 }
});