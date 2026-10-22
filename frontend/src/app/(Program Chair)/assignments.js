import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AuthButton from '../../components/AuthButton';
import StaffHeader from '../../components/StaffHeader';
import {
  apiAssignSubject,
  apiGetProgramChairData
} from '../../api/client';

export default function AssignmentsScreen() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
    try {
      await apiAssignSubject(token, selectedFaculty, selectedSubject, selectedSection);
      setMessage('Subject assigned to faculty successfully.');
    } catch (err) {
      setError(err.message || 'Failed to assign subject.');
    }
  };

  if (isLoading || !isProgramChair) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Assign Subjects</Text>
      <StaffHeader role="programchair" activeRoute="/assignments" />
      <Text style={styles.helper}>Select a subject, section, then faculty member.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Text style={styles.heading}>Subjects</Text>
      {subjects.map((subject) => {
        const id = subject.id || subject._id;
        return (
          <TouchableOpacity key={id} style={[styles.option, selectedSubject === id && styles.selected]} onPress={() => setSelectedSubject(id)}>
            <Text style={styles.itemTitle}>{subject.code}</Text>
            <Text style={styles.itemText}>{subject.description} · {subject.yearLevel} · {subject.term}</Text>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.heading}>Sections</Text>
      {sections.map((section) => {
        const id = section.id || section._id;
        return (
          <TouchableOpacity key={id} style={[styles.option, selectedSection === id && styles.selected]} onPress={() => setSelectedSection(id)}>
            <Text style={styles.itemText}>{section.name} · Year {section.yearLevel}</Text>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.heading}>Faculty</Text>
      {faculty.map((member) => (
        <TouchableOpacity key={member.id} style={[styles.option, selectedFaculty === member.id && styles.selected]} onPress={() => setSelectedFaculty(member.id)}>
          <Text style={styles.itemText}>{member.name} · {member.email}</Text>
        </TouchableOpacity>
      ))}
      <AuthButton title="Assign Subject" onPress={assignFaculty} disabled={!selectedSubject || !selectedFaculty || !selectedSection} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  heading: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 12, marginTop: 18 },
  helper: { fontSize: 13, color: '#64748B', marginBottom: 10 },
  error: { color: '#B91C1C', marginBottom: 12 },
  message: { color: '#047857', marginBottom: 12 },
  option: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  selected: { backgroundColor: '#EFF6FF', borderColor: '#60A5FA' },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#1D4ED8' },
  itemText: { fontSize: 13, color: '#475569', marginTop: 4 }
});
