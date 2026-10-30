import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AuthButton from '../../components/AuthButton';
import AuthInput from '../../components/AuthInput';
import StaffHeader from '../../components/StaffHeader';
import StudentHeader from '../../components/(Students)/StudentHeader';
import DropdownSelect from '../../components/DropdownSelect';
import {
  apiCreateSubject,
  apiDeleteSubject,
  apiEnrollSubject,
  apiGetProgramChairData,
  apiGetTeachingSubjects,
  apiGetTeachingSubjectStudents,
  apiGetStudentSubjects,
  apiUpdateSubject
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
  successLine: '#B7E1C8',
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
const TERM_OPTIONS = [
  { label: 'First Term', value: 'First Term' },
  { label: 'Second Term', value: 'Second Term' },
  { label: 'Third Term', value: 'Third Term' }
];

const EMPTY_FORM = { code: '', description: '', yearLevel: '', term: '' };

const optionIndex = (list, value) => {
  const index = list.findIndex((option) => option.value === value);
  return index === -1 ? 99 : index;
};

// Group subjects by Year Level, then Semester (with optional filters)
const groupSubjects = (list, yearFilter = 'all', termFilter = 'all') => {
  const map = new Map();
  list.forEach((subject) => {
    if (yearFilter !== 'all' && subject.yearLevel !== yearFilter) return;
    if (termFilter !== 'all' && subject.term !== termFilter) return;
    const year = subject.yearLevel || 'No year level';
    const term = subject.term || 'No semester';
    const key = `${year}|${term}`;
    if (!map.has(key)) map.set(key, { key, year, term, items: [] });
    map.get(key).items.push(subject);
  });
  return [...map.values()].sort(
    (a, b) =>
      optionIndex(YEAR_LEVEL_OPTIONS, a.year) - optionIndex(YEAR_LEVEL_OPTIONS, b.year) ||
      optionIndex(TERM_OPTIONS, a.term) - optionIndex(TERM_OPTIONS, b.term)
  );
};

export default function SubjectsScreen() {
  const { user } = useAuth();
  if (user?.role === 'student') return <StudentSubjectsScreen />;
  if (user?.role === 'faculty' || user?.role === 'instructor') return <TeachingSubjectsScreen />;
  return <ProgramChairSubjectsScreen />;
}

/* ───────────────────────── Shared bits ───────────────────────── */

function PageHeader({ title, subtitle, count }) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderIcon}>
        <Ionicons name="library" size={22} color={COLORS.brand} />
      </View>
      <View style={styles.pageHeaderText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {typeof count === 'number' ? (
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Banner({ kind, children }) {
  const isError = kind === 'error';
  return (
    <View
      style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]}
      accessibilityRole="alert"
    >
      <Ionicons
        name={isError ? 'alert-circle' : 'checkmark-circle'}
        size={20}
        color={isError ? COLORS.danger : COLORS.success}
      />
      <Text style={[styles.bannerText, { color: isError ? COLORS.danger : COLORS.success }]}>
        {children}
      </Text>
    </View>
  );
}

function EmptyState({ icon = 'library-outline', children }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={30} color={COLORS.faint} />
      <Text style={styles.empty}>{children}</Text>
    </View>
  );
}

function Chip({ icon, children, tone = 'gold' }) {
  return (
    <View style={[styles.chip, tone === 'plain' && styles.chipPlain]}>
      {icon ? <Ionicons name={icon} size={12} color={COLORS.brandDeep} /> : null}
      <Text style={styles.chipText} numberOfLines={1}>{children}</Text>
    </View>
  );
}

// Horizontal chip filter (All + options) so long lists stay short
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
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Collapsible "Year Level · Semester" group with a grid of cards inside
function SubjectGroups({ groups, closed, onToggle, isWide, renderCard, emptyText }) {
  if (groups.length === 0) return <EmptyState>{emptyText}</EmptyState>;
  return groups.map((group) => {
    const open = !closed[group.key];
    return (
      <View key={group.key} style={styles.group}>
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => onToggle(group.key)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <View style={styles.groupIcon}>
            <Ionicons name="school" size={15} color={COLORS.surface} />
          </View>
          <Text style={styles.groupTitle} numberOfLines={1}>{group.year}</Text>
          <View style={styles.termTag}>
            <Text style={styles.termTagText}>{group.term}</Text>
          </View>
          <View style={styles.groupCount}>
            <Text style={styles.groupCountText}>{group.items.length}</Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.brand} />
        </TouchableOpacity>
        {open ? (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {group.items.map((subject) => (
              <View key={`${subject.id || subject._id}-${subject.sectionId || ''}`} style={[styles.gridCell, isWide && styles.gridCellWide]}>
                {renderCard(subject)}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  });
}

// Compact subject card
function SubjectCard({ subject, chips, onEdit, onDelete }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemTopRow}>
        <View style={styles.codeChip}>
          <Text style={styles.codeChipText}>{subject.code}</Text>
        </View>
        {chips}
        {onEdit || onDelete ? (
          <View style={styles.iconActions}>
            {onEdit ? (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${subject.code}`}
              >
                <Ionicons name="create-outline" size={16} color={COLORS.brand} />
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                style={[styles.iconBtn, styles.iconBtnDanger]}
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${subject.code}`}
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
      <Text style={styles.itemText} numberOfLines={2}>{subject.description}</Text>
    </View>
  );
}

function FacultySubjectCard({ subject, students, isLoadingStudents }) {
  return (
    <View style={styles.facultySubjectCard}>
      <SubjectCard subject={subject} chips={<Chip icon="people-outline">{subject.sectionName}</Chip>} />
      <View style={styles.rosterHeader}>
        <View style={styles.rosterTitleRow}>
          <Ionicons name="people" size={16} color={COLORS.brand} />
          <Text style={styles.rosterTitle}>Enrolled students</Text>
        </View>
        {!isLoadingStudents ? (
          <View style={styles.rosterCount}>
            <Text style={styles.rosterCountText}>{students.length}</Text>
          </View>
        ) : null}
      </View>
      {isLoadingStudents ? (
        <View style={styles.rosterLoading}>
          <ActivityIndicator size="small" color={COLORS.brand} />
          <Text style={styles.rosterMuted}>Loading students…</Text>
        </View>
      ) : students.length === 0 ? (
        <Text style={styles.rosterMuted}>No students are enrolled in this subject yet.</Text>
      ) : (
        <View style={styles.rosterTableFrame}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.rosterTableContent}>
              <View style={styles.rosterTableHeader}>
                <Text style={[styles.rosterHeaderCell, styles.rosterNumberColumn]}>#</Text>
                <Text style={[styles.rosterHeaderCell, styles.rosterNameColumn]}>Last Name</Text>
                <Text style={[styles.rosterHeaderCell, styles.rosterNameColumn]}>First Name</Text>
                <Text style={[styles.rosterHeaderCell, styles.rosterNameColumn]}>Middle Name</Text>
              </View>
              {students.map((student, index) => (
                <View
                  key={student.id}
                  style={[styles.rosterTableRow, index % 2 === 1 && styles.rosterTableRowAlternate]}
                >
                  <Text style={[styles.rosterCell, styles.rosterNumberColumn]}>{index + 1}</Text>
                  <Text style={[styles.rosterCell, styles.rosterNameColumn]} numberOfLines={1}>
                    {student.lastName || '—'}
                  </Text>
                  <Text style={[styles.rosterCell, styles.rosterNameColumn]} numberOfLines={1}>
                    {student.firstName || '—'}
                  </Text>
                  <Text style={[styles.rosterCell, styles.rosterNameColumn]} numberOfLines={1}>
                    {student.middleName || '—'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ───────────────────────── Program chair ───────────────────────── */

function ProgramChairSubjectsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  const { user, token, isLoading } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [showForm, setShowForm] = useState(false); // phone only: form is collapsed by default
  const [assignedOpen, setAssignedOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState('all');
  const [termFilter, setTermFilter] = useState('all');
  const [closedGroups, setClosedGroups] = useState({});
  const isProgramChair = user?.role === 'program_chair';
  const isWide = width >= 900;

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGetProgramChairData(token);
      setSubjects(data.subjects);
      setAssignedSubjects(await apiGetTeachingSubjects(token));
    } catch (err) {
      setError(err.message || 'Failed to load program data.');
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && !isProgramChair) {
      router.replace('/dashboard');
      return;
    }
    if (!isLoading && isProgramChair) {
      const timer = setTimeout(loadData, 0);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isProgramChair, loadData, router]);

  const groups = useMemo(() => groupSubjects(subjects, yearFilter, termFilter), [subjects, yearFilter, termFilter]);
  const assignedGroups = useMemo(() => groupSubjects(assignedSubjects), [assignedSubjects]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submitSubject = async () => {
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      const subject = editingId
        ? await apiUpdateSubject(token, editingId, form)
        : await apiCreateSubject(token, form);
      setSubjects((current) => editingId
        ? current.map((item) => ((item.id || item._id) === editingId ? subject : item))
        : [...current, subject]);
      resetForm();
      setShowForm(false);
      setMessage(editingId ? 'Subject updated successfully.' : 'Subject created successfully.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err) {
      setError(err.message || 'Failed to create subject.');
    } finally {
      setIsSaving(false);
    }
  };

  const editSubject = (subject) => {
    setEditingId(subject.id || subject._id);
    setForm({
      code: subject.code,
      description: subject.description,
      yearLevel: subject.yearLevel,
      term: subject.term
    });
    setError('');
    setMessage('');
    setShowForm(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const deleteSubject = (subjectId) => {
    const performDelete = async () => {
      try {
        await apiDeleteSubject(token, subjectId);
        setSubjects((current) => current.filter((item) => (item.id || item._id) !== subjectId));
        if (editingId === subjectId) resetForm();
        setMessage('Subject deleted successfully.');
      } catch (err) {
        setError(err.message || 'Failed to delete subject.');
      }
    };

    const warning = 'This will also remove its enrollments and faculty assignments.';
    // Alert.alert does nothing on web, so use a browser confirm there
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete subject?\n\n${warning}`)) performDelete();
      return;
    }
    Alert.alert('Delete subject', warning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: performDelete }
    ]);
  };

  const toggleGroup = (key) => setClosedGroups((current) => ({ ...current, [key]: !current[key] }));

  if (isLoading || !isProgramChair) return null;

  const formCard = (
    <View style={styles.cardWrap}>
      <View style={styles.cardShadow} />
      <View style={styles.card}>
        <View style={styles.formTitleRow}>
          <Ionicons
            name={editingId ? 'create-outline' : 'add-circle-outline'}
            size={22}
            color={COLORS.brand}
          />
          <Text style={styles.formTitle}>{editingId ? 'Update Subject' : 'Create Subject'}</Text>
          {editingId ? (
            <View style={styles.editingPill}>
              <Text style={styles.editingPillText}>EDITING</Text>
            </View>
          ) : null}
        </View>
        <AuthInput label="Subject Code" icon="code-outline" placeholder="e.g. IT101" value={form.code} onChangeText={(code) => setForm({ ...form, code: code.toUpperCase() })} autoCapitalize="characters" />
        <AuthInput label="Subject Description" icon="document-text-outline" placeholder="Enter subject description" value={form.description} onChangeText={(description) => setForm({ ...form, description })} />
        <DropdownSelect label="Year Level" icon="school-outline" placeholder="Select year level" options={YEAR_LEVEL_OPTIONS} value={form.yearLevel} onSelect={(val) => setForm({ ...form, yearLevel: val })} />
        <DropdownSelect label="Semester" icon="calendar-outline" placeholder="Select semester" options={TERM_OPTIONS} value={form.term} onSelect={(term) => setForm({ ...form, term })} />
        <View style={styles.formActions}>
          <AuthButton title={editingId ? 'Update Subject' : 'Create Subject'} onPress={submitSubject} loading={isSaving} />
          {editingId ? <AuthButton title="Cancel Edit" onPress={resetForm} variant="outline" /> : null}
        </View>
      </View>
    </View>
  );

  const listPanel = (
    <View>
      {/* Assigned to me: collapsed by default so it doesn't push the list down */}
      <TouchableOpacity
        style={styles.panelToggle}
        onPress={() => setAssignedOpen((open) => !open)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded: assignedOpen }}
      >
        <Ionicons name="person-circle-outline" size={20} color={COLORS.brand} />
        <Text style={styles.panelToggleText}>Assigned to me</Text>
        <View style={styles.groupCount}>
          <Text style={styles.groupCountText}>{assignedSubjects.length}</Text>
        </View>
        <Ionicons name={assignedOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.brand} />
      </TouchableOpacity>
      {assignedOpen ? (
        <View style={styles.panelBody}>
          <SubjectGroups
            groups={assignedGroups}
            closed={closedGroups}
            onToggle={toggleGroup}
            isWide={isWide}
            emptyText="No subjects assigned to you yet."
            renderCard={(subject) => (
              <SubjectCard subject={subject} chips={<Chip icon="people-outline">{subject.sectionName}</Chip>} />
            )}
          />
        </View>
      ) : null}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.heading}>Available subjects</Text>
        <Text style={styles.sectionCount}>{subjects.length} total</Text>
      </View>
      <FilterRow label="Year" options={YEAR_LEVEL_OPTIONS} value={yearFilter} onChange={setYearFilter} />
      <FilterRow label="Semester" options={TERM_OPTIONS} value={termFilter} onChange={setTermFilter} />
      <SubjectGroups
        groups={groups}
        closed={closedGroups}
        onToggle={toggleGroup}
        isWide={isWide}
        emptyText={subjects.length === 0 ? 'No subjects created yet. Make your first one 👆' : 'No subjects match these filters.'}
        renderCard={(subject) => (
          <SubjectCard
            subject={subject}
            onEdit={() => editSubject(subject)}
            onDelete={() => deleteSubject(subject.id || subject._id)}
          />
        )}
      />
    </View>
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="Subjects"
        subtitle="Manage subjects for your program"
        count={subjects.length}
      />
      <StaffHeader role="programchair" activeRoute="/subjects" />
      {error ? <Banner kind="error">{error}</Banner> : null}
      {message ? <Banner kind="success">{message}</Banner> : null}

      {isWide ? (
        // Desktop: form on the left, filtered list on the right
        <View style={styles.layoutWide}>
          <View style={styles.formCol}>{formCard}</View>
          <View style={styles.listCol}>{listPanel}</View>
        </View>
      ) : (
        // Phone: form hides behind a button so the list is right there
        <View>
          <TouchableOpacity
            style={[styles.createToggle, showForm && styles.createToggleOpen]}
            onPress={() => {
              if (showForm && editingId) resetForm();
              setShowForm((open) => !open);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ expanded: showForm }}
          >
            <Ionicons name={showForm ? 'close' : 'add'} size={18} color={COLORS.brandDeep} />
            <Text style={styles.createToggleText}>{showForm ? 'Close form' : 'Create subject'}</Text>
          </TouchableOpacity>
          {showForm ? formCard : null}
          {listPanel}
        </View>
      )}
    </ScrollView>
  );
}

/* ───────────────────────── Faculty / Instructor ───────────────────────── */

function TeachingSubjectsScreen() {
  const { token, isLoading } = useAuth();
  const { width } = useWindowDimensions();
  const [subjects, setSubjects] = useState([]);
  const [studentsBySubject, setStudentsBySubject] = useState({});
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [error, setError] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [termFilter, setTermFilter] = useState('all');
  const [closedGroups, setClosedGroups] = useState({});

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadingTimer = setTimeout(() => setIsLoadingStudents(true), 0);
    apiGetTeachingSubjects(token)
      .then(async (assignedSubjects) => {
        if (!active) return;
        setSubjects(assignedSubjects);
        const rosters = await Promise.all(
          assignedSubjects.map(async (subject) => [
            subject.id,
            await apiGetTeachingSubjectStudents(token, subject.id)
          ])
        );
        if (active) setStudentsBySubject(Object.fromEntries(rosters));
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load assigned subjects.');
      })
      .finally(() => {
        if (active) setIsLoadingStudents(false);
      });
    return () => {
      active = false;
      clearTimeout(loadingTimer);
    };
  }, [token]);

  const groups = useMemo(() => groupSubjects(subjects, yearFilter, termFilter), [subjects, yearFilter, termFilter]);

  if (isLoading) return null;
  const isWide = width >= 900;
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="My Subjects"
        subtitle="Subjects assigned to you"
        count={subjects.length}
      />
      <StaffHeader role="faculty" activeRoute="/subjects" />
      {error ? <Banner kind="error">{error}</Banner> : null}
      {subjects.length > 0 ? (
        <>
          <FilterRow label="Year" options={YEAR_LEVEL_OPTIONS} value={yearFilter} onChange={setYearFilter} />
          <FilterRow label="Semester" options={TERM_OPTIONS} value={termFilter} onChange={setTermFilter} />
        </>
      ) : null}
      <SubjectGroups
        groups={groups}
        closed={closedGroups}
        onToggle={(key) => setClosedGroups((current) => ({ ...current, [key]: !current[key] }))}
        isWide={isWide}
        emptyText={subjects.length === 0 ? 'No subjects have been assigned to you yet.' : 'No subjects match these filters.'}
        renderCard={(subject) => (
          <FacultySubjectCard
            subject={subject}
            students={studentsBySubject[subject.id] || []}
            isLoadingStudents={isLoadingStudents}
          />
        )}
      />
    </ScrollView>
  );
}

/* ───────────────────────── Student ───────────────────────── */

function StudentSubjectsScreen() {
  const { user, token, isLoading } = useAuth();
  const { width } = useWindowDimensions();
  const [data, setData] = useState({ yearLevel: null, currentTerm: null, subjects: [], terms: [] });
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const result = await apiGetStudentSubjects(token);
      setData(result);
      setSelectedTerm(result.currentTerm || result.terms[0] || null);
    } catch (err) {
      setError(err.message || 'Failed to load available subjects.');
    } finally {
      setIsLoadingData(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && user?.role === 'student') {
      const timer = setTimeout(loadData, 0);
      return () => clearTimeout(timer);
    }
  }, [loadData, token, user?.role]);

  const currentTerm = data.currentTerm || selectedTerm;

  const enroll = async (subjectId) => {
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      await apiEnrollSubject(token, subjectId, currentTerm);
      setMessage('Subject enrolled successfully.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to enroll in subject.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || user?.role !== 'student') return null;
  const visibleSubjects = data.subjects.filter((subject) => subject.term === currentTerm);
  const enrolledCount = data.subjects.filter((subject) => subject.enrolled).length;
  const isWide = width >= 900;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="Enroll in Subjects"
        subtitle={`${enrolledCount} enrolled so far`}
        count={isLoadingData ? undefined : visibleSubjects.length}
      />
      <StudentHeader activeRoute="/subjects" />

      {error ? <Banner kind="error">{error}</Banner> : null}
      {message ? <Banner kind="success">{message}</Banner> : null}

      {isLoadingData ? (
        <ActivityIndicator style={{ paddingVertical: 28 }} color={COLORS.brand} />
      ) : !data.yearLevel ? (
        <EmptyState icon="alert-circle-outline">
          Your year level has not been assigned yet. Please contact the administrator.
        </EmptyState>
      ) : (
        <>
          {/* Year level + short hint in one compact strip */}
          <View style={styles.infoStrip}>
            <View style={styles.yearBadge}>
              <Ionicons name="ribbon" size={14} color={COLORS.brandDeep} />
              <Text style={styles.yearBadgeText}>{data.yearLevel}</Text>
            </View>
          </View>

          {/* Students only see subjects for the active academic term. */}
          <View style={styles.tabs}>
            <View style={[styles.tab, styles.tabActive]}>
              <Text style={[styles.tabText, styles.tabTextActive]} numberOfLines={1}>{currentTerm || 'Current Term'}</Text>
              <View style={[styles.tabCount, styles.tabCountActive]}>
                <Text style={[styles.tabCountText, styles.tabCountTextActive]}>{data.subjects.length}</Text>
              </View>
            </View>
          </View>

          {visibleSubjects.length === 0 ? (
            <EmptyState>No subjects are available for this semester.</EmptyState>
          ) : (
            <View style={[styles.grid, isWide && styles.gridWide]}>
              {visibleSubjects.map((subject) => (
                <View key={subject.id} style={[styles.gridCell, isWide && styles.gridCellWide]}>
                  <View style={[styles.studentCard, subject.enrolled && styles.studentCardEnrolled]}>
                    <View style={styles.studentCardTop}>
                      <View style={styles.codeChip}>
                        <Text style={styles.codeChipText}>{subject.code}</Text>
                      </View>
                      {subject.enrolled ? (
                        <View style={styles.enrolledBadge}>
                          <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                          <Text style={styles.enrolledBadgeText}>Enrolled</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.studentDescription} numberOfLines={3}>{subject.description}</Text>
                    <TouchableOpacity
                      style={[
                        styles.enrollButton,
                        subject.enrolled && styles.enrollButtonEnrolled,
                        (subject.enrolled || isSaving) && styles.enrollButtonDisabled
                      ]}
                      onPress={() => enroll(subject.id)}
                      disabled={subject.enrolled || isSaving}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={subject.enrolled ? `${subject.code} enrolled` : `Enroll in ${subject.code}`}
                    >
                      {isSaving && !subject.enrolled ? (
                        <ActivityIndicator size="small" color={COLORS.surface} />
                      ) : (
                        <Ionicons
                          name={subject.enrolled ? 'checkmark' : 'add'}
                          size={18}
                          color={subject.enrolled ? COLORS.success : COLORS.surface}
                        />
                      )}
                      <Text style={[styles.enrollButtonText, subject.enrolled && styles.enrollButtonTextEnrolled]}>
                        {subject.enrolled ? 'Enrolled' : 'Enroll'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
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
  bannerSuccess: { backgroundColor: COLORS.successSoft, borderColor: COLORS.successLine },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },

  /* Desktop two-column layout */
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  formCol: { width: 380 },
  listCol: { flex: 1, minWidth: 0 },

  /* Phone: create toggle */
  createToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 16
  },
  createToggleOpen: { backgroundColor: COLORS.goldSoft },
  createToggleText: { fontSize: 14, fontWeight: '900', color: COLORS.brandDeep },

  /* Section headings */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6
  },
  heading: { fontSize: 18, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  sectionCount: { fontSize: 12, fontWeight: '700', color: COLORS.muted },

  /* Empty */
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    padding: 24,
    marginBottom: 16
  },
  empty: { color: COLORS.muted, textAlign: 'center', fontSize: 13, lineHeight: 19 },

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
  formActions: { gap: 8, marginTop: 4 },

  /* Collapsible "Assigned to me" */
  panelToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14
  },
  panelToggleText: { flex: 1, fontSize: 15, fontWeight: '900', color: COLORS.ink },
  panelBody: { marginBottom: 8 },

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

  /* Groups (Year Level · Semester) */
  group: { marginTop: 10 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10
  },
  groupIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupTitle: { flex: 1, fontSize: 15, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.2 },
  termTag: {
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999
  },
  termTagText: { fontSize: 11, fontWeight: '800', color: COLORS.brandDeep },
  groupCount: {
    minWidth: 24,
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: COLORS.brandSoft
  },
  groupCountText: { fontSize: 12, fontWeight: '800', color: COLORS.brand },

  /* Card grid: 1 column on phone, 2 on desktop */
  grid: { marginBottom: 6 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: { marginBottom: 10 },
  gridCellWide: { width: '49%', marginBottom: 0 },

  /* Compact subject cards */
  item: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  itemTopRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 },
  codeChip: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999
  },
  codeChipText: { fontSize: 13, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    maxWidth: 160
  },
  chipPlain: { backgroundColor: COLORS.surface, borderColor: COLORS.line },
  chipText: { fontSize: 11, fontWeight: '700', color: COLORS.brandDeep },
  itemText: { fontSize: 13, color: COLORS.ink, lineHeight: 18 },
  iconActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.goldSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconBtnDanger: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.danger },
  facultySubjectCard: { gap: 10 },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2
  },
  rosterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rosterTitle: { fontSize: 12, fontWeight: '900', color: COLORS.brandDeep },
  rosterCount: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1,
    borderColor: COLORS.brandLine,
    alignItems: 'center'
  },
  rosterCountText: { fontSize: 11, fontWeight: '900', color: COLORS.brandDeep },
  rosterLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  rosterMuted: { fontSize: 12, color: COLORS.muted, paddingHorizontal: 2, paddingVertical: 4 },
  rosterTableFrame: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.surface
  },
  rosterTableContent: { width: '100%', minWidth: 420 },
  rosterTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brandSoft,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.brandLine
  },
  rosterTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line
  },
  rosterTableRowAlternate: { backgroundColor: COLORS.paper },
  rosterHeaderCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.brandDeep,
    textTransform: 'uppercase'
  },
  rosterCell: { paddingHorizontal: 8, paddingVertical: 8, fontSize: 12, color: COLORS.ink },
  rosterNumberColumn: { flex: 0.3, minWidth: 38, textAlign: 'center' },
  rosterNameColumn: { flex: 1, minWidth: 118 },

  /* Student: info strip + semester tabs */
  infoStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  yearBadgeText: { fontSize: 13, fontWeight: '900', color: COLORS.brandDeep },
  infoText: { flex: 1, fontSize: 12, color: COLORS.muted, lineHeight: 17 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.line
  },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.ink },
  tabText: { fontSize: 13, fontWeight: '800', color: COLORS.muted },
  tabTextActive: { color: COLORS.surface },
  tabCount: {
    minWidth: 20,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: COLORS.brandSoft
  },
  tabCountActive: { backgroundColor: COLORS.gold },
  tabCountText: { fontSize: 11, fontWeight: '800', color: COLORS.brand },
  tabCountTextActive: { color: COLORS.brandDeep },

  /* Student subject cards */
  studentCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  studentCardEnrolled: { backgroundColor: COLORS.successSoft, borderColor: COLORS.success },
  studentCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  studentDescription: { fontSize: 13, color: COLORS.ink, lineHeight: 18, marginBottom: 10 },
  enrolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.successLine,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  enrolledBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.success },
  enrollButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.brand,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  enrollButtonEnrolled: { backgroundColor: COLORS.surface, borderColor: COLORS.successLine },
  enrollButtonDisabled: { opacity: 0.9 },
  enrollButtonText: { color: COLORS.surface, fontSize: 13, fontWeight: '800' },
  enrollButtonTextEnrolled: { color: COLORS.success }
});