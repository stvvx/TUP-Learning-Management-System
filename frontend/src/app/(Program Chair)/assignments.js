import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
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

// One selectable list card (Subjects / Sections / Faculty)
function PickerCard({ step, icon, title, count, empty, children }) {
  return (
    <View style={styles.pickerCard}>
      <View style={styles.pickerHeader}>
        <View style={styles.stepBubble}>
          <Text style={styles.stepBubbleText}>{step}</Text>
        </View>
        <Ionicons name={icon} size={18} color={COLORS.brand} />
        <Text style={styles.heading}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      {count === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="file-tray-outline" size={26} color={COLORS.faint} />
          <Text style={styles.empty}>{empty}</Text>
        </View>
      ) : (
        children
      )}
    </View>
  );
}

function Option({ selected, onPress, title, text }) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.selected]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Ionicons name="checkmark" size={14} color={COLORS.brandDeep} /> : null}
      </View>
      <View style={styles.optionText}>
        {title ? <Text style={styles.itemTitle}>{title}</Text> : null}
        <Text style={styles.itemText}>{text}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SummaryChip({ label, value }) {
  return (
    <View style={[styles.chip, !value && styles.chipEmpty]}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, !value && styles.chipValueEmpty]} numberOfLines={1}>
        {value || 'Not selected'}
      </Text>
    </View>
  );
}

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

  if (isLoading || !isProgramChair) return null;

  const isWide = width >= 900;
  const subjectObj = subjects.find((s) => (s.id || s._id) === selectedSubject);
  const sectionObj = sections.find((s) => (s.id || s._id) === selectedSection);
  const facultyObj = faculty.find((m) => m.id === selectedFaculty);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderIcon}>
          <Ionicons name="git-network" size={22} color={COLORS.brand} />
        </View>
        <View style={styles.pageHeaderText}>
          <Text style={styles.title}>Assign Subjects</Text>
          <Text style={styles.pageSubtitle}>Select a subject, section, then faculty member</Text>
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
          </View>
          <View style={[styles.chipRow, isWide && styles.chipRowWide]}>
            <SummaryChip label="SUBJECT" value={subjectObj?.code} />
            <SummaryChip label="SECTION" value={sectionObj?.name} />
            <SummaryChip label="FACULTY" value={facultyObj?.name} />
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

      {/* Pickers: 3 columns on desktop, stacked on phone */}
      <View style={[styles.pickerGrid, isWide && styles.pickerGridWide]}>
        <View style={styles.pickerCol}>
          <PickerCard step="1" icon="library-outline" title="Subjects" count={subjects.length} empty="No subjects found.">
            {subjects.map((subject) => {
              const id = subject.id || subject._id;
              return (
                <Option
                  key={id}
                  selected={selectedSubject === id}
                  onPress={() => setSelectedSubject(id)}
                  title={subject.code}
                  text={`${subject.description} · ${subject.yearLevel} · ${subject.term}`}
                />
              );
            })}
          </PickerCard>
        </View>

        <View style={styles.pickerCol}>
          <PickerCard step="2" icon="people-outline" title="Sections" count={sections.length} empty="No sections found.">
            {sections.map((section) => {
              const id = section.id || section._id;
              return (
                <Option
                  key={id}
                  selected={selectedSection === id}
                  onPress={() => setSelectedSection(id)}
                  text={`${section.name} · Year ${section.yearLevel}`}
                />
              );
            })}
          </PickerCard>
        </View>

        <View style={styles.pickerCol}>
          <PickerCard step="3" icon="person-outline" title="Faculty" count={faculty.length} empty="No faculty found.">
            {faculty.map((member) => (
              <Option
                key={member.id}
                selected={selectedFaculty === member.id}
                onPress={() => setSelectedFaculty(member.id)}
                title={member.name}
                text={member.email}
              />
            ))}
          </PickerCard>
        </View>
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
  actionWrap: { marginTop: 14 },

  /* Picker grid */
  pickerGrid: { gap: 16 },
  pickerGridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  pickerCol: { flex: 1, minWidth: 0 },
  pickerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 14
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  stepBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepBubbleText: { color: COLORS.surface, fontSize: 12, fontWeight: '800' },
  heading: { fontSize: 17, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3, flex: 1 },
  sectionCount: { fontSize: 12, fontWeight: '700', color: COLORS.muted },

  emptyBox: {
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    padding: 18
  },
  empty: { color: COLORS.muted, textAlign: 'center', fontSize: 13 },

  /* Options */
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    marginBottom: 8
  },
  selected: { backgroundColor: COLORS.goldSoft, borderColor: COLORS.ink },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.faint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioOn: { backgroundColor: COLORS.gold, borderColor: COLORS.ink },
  optionText: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 15, fontWeight: '800', color: COLORS.brand },
  itemText: { fontSize: 13, color: COLORS.muted, marginTop: 2, lineHeight: 18 }
});