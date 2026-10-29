import React, { useCallback, useEffect, useState } from 'react';
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

function SectionHeading({ children, count }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.heading}>{children}</Text>
      {typeof count === 'number' ? <Text style={styles.sectionCount}>{count} total</Text> : null}
    </View>
  );
}

function Chip({ icon, children, tone = 'gold' }) {
  return (
    <View style={[styles.chip, tone === 'plain' && styles.chipPlain]}>
      {icon ? <Ionicons name={icon} size={12} color={COLORS.brandDeep} /> : null}
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

/* ───────────────────────── Program chair ───────────────────────── */

function ProgramChairSubjectsScreen() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({ code: '', description: '', yearLevel: '', term: '' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const isProgramChair = user?.role === 'program_chair';
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

  const submitSubject = async () => {
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      const subject = editingId
        ? await apiUpdateSubject(token, editingId, form)
        : await apiCreateSubject(token, form);
      setSubjects((current) => editingId
        ? current.map((item) => (item.id === editingId ? subject : item))
        : [...current, subject]);
      setForm({ code: '', description: '', yearLevel: '', term: '' });
      setEditingId(null);
      setMessage(editingId ? 'Subject updated successfully.' : 'Subject created successfully.');
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
  };

  const deleteSubject = (subjectId) => {
    const performDelete = async () => {
      try {
        await apiDeleteSubject(token, subjectId);
        setSubjects((current) => current.filter((item) => (item.id || item._id) !== subjectId));
        if (editingId === subjectId) {
          setEditingId(null);
          setForm({ code: '', description: '', yearLevel: '', term: '' });
        }
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

  if (isLoading || !isProgramChair) return null;
  return (
    <ScrollView
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

      <SectionHeading count={assignedSubjects.length}>Assigned Subjects</SectionHeading>
      {assignedSubjects.length === 0 ? (
        <EmptyState>No subjects assigned to you yet.</EmptyState>
      ) : assignedSubjects.map((subject) => (
        <View key={`${subject.id}-${subject.sectionId}`} style={styles.item}>
          <View style={styles.itemTopRow}>
            <View style={styles.codeChip}>
              <Text style={styles.codeChipText}>{subject.code}</Text>
            </View>
            <Chip icon="people-outline">{subject.sectionName}</Chip>
            <Chip icon="calendar-outline">{subject.term}</Chip>
          </View>
          <Text style={styles.itemText}>{subject.description}</Text>
        </View>
      ))}

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
            {editingId ? <AuthButton title="Cancel Edit" onPress={() => { setEditingId(null); setForm({ code: '', description: '', yearLevel: '', term: '' }); }} variant="outline" /> : null}
          </View>
        </View>
      </View>

      <SectionHeading count={subjects.length}>Available Subjects</SectionHeading>
      {subjects.length === 0 ? (
        <EmptyState>No subjects created yet. Make your first one above 👆</EmptyState>
      ) : subjects.map((subject) => (
        <View key={subject.id || subject._id} style={styles.item}>
          <View style={styles.itemTopRow}>
            <View style={styles.codeChip}>
              <Text style={styles.codeChipText}>{subject.code}</Text>
            </View>
            <Chip icon="ribbon-outline">{subject.yearLevel}</Chip>
            <Chip icon="calendar-outline">{subject.term}</Chip>
          </View>
          <Text style={styles.itemText}>{subject.description}</Text>
          <View style={styles.actions}>
            <AuthButton title="Edit" onPress={() => editSubject(subject)} variant="outline" style={styles.actionButton} />
            <AuthButton title="Delete" onPress={() => deleteSubject(subject.id || subject._id)} variant="outline" style={[styles.actionButton, styles.deleteButton]} textStyle={styles.deleteText} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ───────────────────────── Faculty / Instructor ───────────────────────── */

function TeachingSubjectsScreen() {
  const { token, isLoading } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    apiGetTeachingSubjects(token).then(setSubjects).catch((err) => {
      setError(err.message || 'Failed to load assigned subjects.');
    });
  }, [token]);

  if (isLoading) return null;
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
      {subjects.length === 0 ? (
        <EmptyState>No subjects have been assigned to you yet.</EmptyState>
      ) : subjects.map((subject) => (
        <View key={`${subject.id}-${subject.sectionId}`} style={styles.item}>
          <View style={styles.itemTopRow}>
            <View style={styles.codeChip}>
              <Text style={styles.codeChipText}>{subject.code}</Text>
            </View>
            <Chip icon="people-outline">{subject.sectionName}</Chip>
          </View>
          <Text style={styles.itemText}>{subject.description}</Text>
          <View style={styles.itemTopRow}>
            <Chip icon="ribbon-outline" tone="plain">{subject.yearLevel}</Chip>
            <Chip icon="calendar-outline" tone="plain">{subject.term}</Chip>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ───────────────────────── Student ───────────────────────── */

function StudentSubjectsScreen() {
  const { user, token, isLoading } = useAuth();
  const { width } = useWindowDimensions();
  const [data, setData] = useState({ yearLevel: null, subjects: [], terms: [] });
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
      setSelectedTerm((current) => current && result.terms.includes(current) ? current : result.terms[0] || null);
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

  const enroll = async (subjectId) => {
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      await apiEnrollSubject(token, subjectId, selectedTerm);
      setMessage('Subject enrolled successfully.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to enroll in subject.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || user?.role !== 'student') return null;
  const visibleSubjects = data.subjects.filter((subject) => subject.term === selectedTerm);
  const enrolledCount = data.subjects.filter((subject) => subject.enrolled).length;
  const isWideLayout = width >= 820;

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

      <View style={styles.helperBox}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.goldDeep} />
        <Text style={styles.helper}>
          Choose available subjects for your year level and semester. You are responsible for completing your enrollment.
        </Text>
      </View>

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
          <View style={styles.studentYearLevelCard}>
            <Ionicons name="ribbon" size={16} color={COLORS.brandDeep} />
            <Text style={styles.studentYearLevelLabel}>Your year level</Text>
            <Text style={styles.studentYearLevel}>{data.yearLevel}</Text>
          </View>
          <View style={styles.studentFilterCard}>
            <DropdownSelect label="Semester" icon="calendar-outline" placeholder="Select semester" options={TERM_OPTIONS} value={selectedTerm} onSelect={setSelectedTerm} />
          </View>
          {visibleSubjects.length === 0 ? (
            <EmptyState>No subjects are available for this semester.</EmptyState>
          ) : visibleSubjects.map((subject) => (
            <View key={subject.id} style={[styles.studentSubjectCard, isWideLayout && styles.studentSubjectCardWide]}>
              <View style={styles.studentSubjectDetails}>
                <View style={styles.studentSubjectHeading}>
                  <View style={styles.studentSubjectIcon}>
                    <Ionicons name="library-outline" size={21} color={COLORS.brand} />
                  </View>
                  <View style={styles.studentSubjectTitleBlock}>
                    <Text style={styles.studentSubjectCode}>{subject.code}</Text>
                    <Text style={styles.studentSubjectMeta}>{subject.yearLevel} · {subject.term}</Text>
                  </View>
                  {subject.enrolled ? (
                    <View style={styles.enrolledBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                      <Text style={styles.enrolledBadgeText}>Enrolled</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.studentSubjectDescription}>{subject.description}</Text>
              </View>
              <View style={[styles.studentSubjectActionPanel, isWideLayout && styles.studentSubjectActionPanelWide]}>
                <View style={styles.studentSubjectStatusRow}>
                  <Ionicons
                    name={subject.enrolled ? 'checkmark-circle' : 'time-outline'}
                    size={18}
                    color={subject.enrolled ? COLORS.success : COLORS.muted}
                  />
                  <Text style={[styles.studentSubjectStatus, subject.enrolled && styles.studentSubjectStatusEnrolled]}>
                    {subject.enrolled ? 'You are enrolled' : 'Available to enroll'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.studentEnrollButton,
                    subject.enrolled && styles.studentEnrollButtonEnrolled,
                    (subject.enrolled || isSaving) && styles.studentEnrollButtonDisabled
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
                  <Text style={[styles.studentEnrollButtonText, subject.enrolled && styles.studentEnrollButtonTextEnrolled]}>
                    {subject.enrolled ? 'Enrolled' : 'Enroll in subject'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
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

  /* Helper / year level */
  helperBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16
  },
  helper: { flex: 1, fontSize: 13, color: COLORS.brandDeep, lineHeight: 19 },
  yearLevelPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
    transform: [{ rotate: '-1deg' }]
  },
  yearLevel: { fontSize: 13, fontWeight: '800', color: COLORS.brandDeep },
  studentYearLevelCard: {
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 14
  },
  studentYearLevelLabel: { color: COLORS.muted, fontSize: 12 },
  studentYearLevel: { color: COLORS.brandDeep, fontSize: 13, fontWeight: '800' },
  studentFilterCard: { marginBottom: 10 },

  /* Section headings */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  cardWrap: { marginTop: 14, marginBottom: 28, marginRight: 6 },
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

  /* Subject cards */
  item: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 15,
    borderWidth: 2,
    borderColor: COLORS.ink,
    marginBottom: 12
  },
  itemEnrolled: { backgroundColor: COLORS.successSoft, borderColor: COLORS.success },
  itemTopRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 },
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
    borderRadius: 999
  },
  chipPlain: { backgroundColor: COLORS.surface, borderColor: COLORS.line },
  chipText: { fontSize: 11, fontWeight: '700', color: COLORS.brandDeep },
  itemText: { fontSize: 14, color: COLORS.ink, lineHeight: 20, marginBottom: 4 },
  itemButtonGap: { marginTop: 8 },
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

  /* Student enrollment cards */
  studentSubjectCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    marginBottom: 14,
    overflow: 'hidden'
  },
  studentSubjectCardWide: { flexDirection: 'row', alignItems: 'stretch' },
  studentSubjectDetails: { flex: 1, minWidth: 0, padding: 18 },
  studentSubjectHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  studentSubjectIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.goldSoft
  },
  studentSubjectTitleBlock: { flex: 1, minWidth: 0 },
  studentSubjectCode: { color: COLORS.ink, fontSize: 17, fontWeight: '900' },
  studentSubjectMeta: { marginTop: 4, color: COLORS.muted, fontSize: 12 },
  studentSubjectDescription: { marginTop: 14, color: COLORS.ink, fontSize: 14, lineHeight: 21 },
  studentSubjectActionPanel: {
    padding: 16,
    backgroundColor: COLORS.goldSoft,
    borderTopWidth: 1,
    borderTopColor: COLORS.line
  },
  studentSubjectActionPanelWide: {
    width: 250,
    justifyContent: 'center',
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.line
  },
  studentSubjectStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  studentSubjectStatus: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  studentSubjectStatusEnrolled: { color: COLORS.success },
  studentEnrollButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.brand,
    borderWidth: 1.5,
    borderColor: COLORS.brandDeep
  },
  studentEnrollButtonEnrolled: { backgroundColor: COLORS.surface, borderColor: COLORS.successLine },
  studentEnrollButtonDisabled: { opacity: 0.9 },
  studentEnrollButtonText: { color: COLORS.surface, fontSize: 13, fontWeight: '800' },
  studentEnrollButtonTextEnrolled: { color: COLORS.success },

  /* Actions */
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionButton: { flex: 1, marginVertical: 0, height: 42 },
  deleteButton: { borderColor: COLORS.danger },
  deleteText: { color: COLORS.danger }
});