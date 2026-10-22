import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  };

  const deleteSubject = (subjectId) => {
    Alert.alert('Delete subject', 'This will also remove its enrollments and faculty assignments.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
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
        }
      }
    ]);
  };

  if (isLoading || !isProgramChair) return null;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Subjects</Text>
      <StaffHeader role="programchair" activeRoute="/subjects" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Text style={styles.heading}>Assigned Subjects</Text>
      {assignedSubjects.length === 0 ? <Text style={styles.empty}>No subjects assigned to you yet.</Text> : assignedSubjects.map((subject) => (
        <View key={`${subject.id}-${subject.sectionId}`} style={styles.item}>
          <Text style={styles.itemTitle}>{subject.code}</Text>
          <Text style={styles.itemText}>{subject.description} · {subject.sectionName} · {subject.term}</Text>
        </View>
      ))}
      <View style={styles.card}>
        <Text style={styles.heading}>{editingId ? 'Update Subject' : 'Create Subject'}</Text>
        <AuthInput label="Subject Code" icon="code-outline" placeholder="e.g. IT101" value={form.code} onChangeText={(code) => setForm({ ...form, code: code.toUpperCase() })} autoCapitalize="characters" />
        <AuthInput label="Subject Description" icon="document-text-outline" placeholder="Enter subject description" value={form.description} onChangeText={(description) => setForm({ ...form, description })} />
        <DropdownSelect label="Year Level" icon="school-outline" placeholder="Select year level" options={YEAR_LEVEL_OPTIONS} value={form.yearLevel} onSelect={(val) => setForm({ ...form, yearLevel: val })} />
        <DropdownSelect label="Semester" icon="calendar-outline" placeholder="Select semester" options={TERM_OPTIONS} value={form.term} onSelect={(term) => setForm({ ...form, term })} />
        <AuthButton title={editingId ? 'Update Subject' : 'Create Subject'} onPress={submitSubject} loading={isSaving} />
        {editingId ? <AuthButton title="Cancel Edit" onPress={() => { setEditingId(null); setForm({ code: '', description: '', yearLevel: '', term: '' }); }} variant="outline" /> : null}
      </View>
      <Text style={styles.heading}>Available Subjects</Text>
      {subjects.length === 0 ? <Text style={styles.empty}>No subjects created yet.</Text> : subjects.map((subject) => (
        <View key={subject.id || subject._id} style={styles.item}>
          <Text style={styles.itemTitle}>{subject.code}</Text>
          <Text style={styles.itemText}>{subject.description} · {subject.yearLevel} · {subject.term}</Text>
          <View style={styles.actions}>
            <AuthButton title="Edit" onPress={() => editSubject(subject)} variant="outline" style={styles.actionButton} />
            <AuthButton title="Delete" onPress={() => deleteSubject(subject.id || subject._id)} variant="outline" style={[styles.actionButton, styles.deleteButton]} textStyle={styles.deleteText} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Subjects</Text>
      <StaffHeader role="faculty" activeRoute="/subjects" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {subjects.length === 0 ? <Text style={styles.empty}>No subjects have been assigned to you yet.</Text> : subjects.map((subject) => (
        <View key={`${subject.id}-${subject.sectionId}`} style={styles.item}>
          <Text style={styles.itemTitle}>{subject.code}</Text>
          <Text style={styles.itemText}>{subject.description}</Text>
          <Text style={styles.itemText}>{subject.sectionName} · {subject.yearLevel} · {subject.term}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function StudentSubjectsScreen() {
  const { user, token, isLoading } = useAuth();
  const [data, setData] = useState({ yearLevel: null, subjects: [], terms: [] });
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const result = await apiGetStudentSubjects(token);
      setData(result);
      setSelectedTerm((current) => current && result.terms.includes(current) ? current : result.terms[0] || null);
    } catch (err) {
      setError(err.message || 'Failed to load available subjects.');
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
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Enroll in Subjects</Text>
      <Text style={styles.helper}>Choose available subjects for your year level and semester. You are responsible for completing your enrollment.</Text>
      <StudentHeader activeRoute="/subjects" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {!data.yearLevel ? <Text style={styles.empty}>Your year level has not been assigned yet. Please contact the administrator.</Text> : (
        <>
          <Text style={styles.yearLevel}>Year level: {data.yearLevel}</Text>
          <DropdownSelect label="Semester" icon="calendar-outline" placeholder="Select semester" options={TERM_OPTIONS} value={selectedTerm} onSelect={setSelectedTerm} />
          {visibleSubjects.length === 0 ? <Text style={styles.empty}>No subjects are available for this semester.</Text> : visibleSubjects.map((subject) => (
            <View key={subject.id} style={styles.item}>
              <Text style={styles.itemTitle}>{subject.code}</Text>
              <Text style={styles.itemText}>{subject.description}</Text>
              <AuthButton title={subject.enrolled ? 'Enrolled' : 'Enroll in Subject'} onPress={() => enroll(subject.id)} disabled={subject.enrolled || isSaving} />
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24 },
  heading: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 12, marginTop: 18 },
  helper: { fontSize: 13, color: '#64748B', marginBottom: 10 },
  yearLevel: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 14 },
  error: { color: '#B91C1C', marginBottom: 12 },
  message: { color: '#047857', marginBottom: 12 },
  empty: { color: '#64748B', marginBottom: 12 },
  item: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#1D4ED8' },
  itemText: { fontSize: 13, color: '#475569', marginTop: 4 }
  ,actions: { flexDirection: 'row', gap: 8, marginTop: 8 }
  ,actionButton: { flex: 1, marginVertical: 0, height: 42 }
  ,deleteButton: { borderColor: '#FCA5A5' }
  ,deleteText: { color: '#B91C1C' }
});
