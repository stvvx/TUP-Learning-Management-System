import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import StudentPage from '../../components/(Students)/StudentPage';
import StudentHeader from '../../components/(Students)/StudentHeader';
import StaffHeader from '../../components/StaffHeader';
import AuthButton from '../../components/AuthButton';
import AuthInput from '../../components/AuthInput';
import DropdownSelect from '../../components/DropdownSelect';
import { API_BASE_URL, apiCreateLesson, apiDeleteLesson, apiGetStudentLessons, apiGetTeachingLessons, apiGetTeachingSubjects, apiReplaceLessonFile, apiUpdateLesson, apiUploadLesson } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const FILE_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];

export default function LessonsScreen() {
  const { user } = useAuth();
  if (user?.role === 'faculty' || user?.role === 'instructor' || user?.role === 'program_chair') {
    return <TeachingLessonsScreen />;
  }
  if (user?.role === 'student') return <StudentLessonsScreen />;
  return null;
}

function TeachingLessonsScreen() {
  const { token, user, isLoading } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slides, setSlides] = useState([{ title: '', body: '' }]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewingLesson, setViewingLesson] = useState(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [assignedSubjects, teachingLessons] = await Promise.all([
        apiGetTeachingSubjects(token),
        apiGetTeachingLessons(token)
      ]);
      setSubjects(assignedSubjects);
      setLessons(teachingLessons);
      setSubjectId((current) => current || assignedSubjects[0]?.id || '');
    } catch (err) {
      setError(err.message || 'Failed to load teaching content.');
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: FILE_TYPES,
      copyToCacheDirectory: true,
      multiple: false
    });
    if (!result.canceled) {
      setSelectedFile(result.assets[0]);
      setError('');
    }
  };

  const saveLesson = async () => {
    setError('');
    setMessage('');
    if (!subjectId || !title.trim()) {
      setError('Select an assigned subject and enter a lesson title.');
      return;
    }
    setIsSaving(true);
    try {
      let lesson;
      if (editingLesson) {
        lesson = selectedFile
          ? await apiReplaceLessonFile(token, editingLesson.id, selectedFile.file || {
            uri: selectedFile.uri,
            name: selectedFile.name,
            type: selectedFile.mimeType || 'application/octet-stream'
          })
          : editingLesson;
        lesson = await apiUpdateLesson(token, editingLesson.id, {
          title,
          description,
          slides
        });
      } else if (selectedFile) {
        lesson = await apiUploadLesson(token, {
          subjectId,
          title,
          description,
          file: selectedFile.file || {
            uri: selectedFile.uri,
            name: selectedFile.name,
            type: selectedFile.mimeType || 'application/octet-stream'
          }
        });
      } else {
        lesson = await apiCreateLesson(token, {
          subjectId,
          title,
          description,
          slides
        });
      }
      setLessons((current) => editingLesson
        ? current.map((item) => item.id === lesson.id ? lesson : item)
        : [lesson, ...current]);
      setTitle('');
      setDescription('');
      setSlides([{ title: '', body: '' }]);
      setSelectedFile(null);
      setEditingLesson(null);
      setMessage(editingLesson ? 'Lesson updated successfully.' : 'Lesson saved successfully.');
    } catch (err) {
      setError(err.message || 'Failed to save lesson.');
    } finally {
      setIsSaving(false);
    }
  };

  const editLesson = (lesson) => {
    setEditingLesson(lesson);
    setTitle(lesson.title);
    setDescription(lesson.description || '');
    setSlides(lesson.slides?.length ? lesson.slides : [{ title: '', body: '' }]);
    setSelectedFile(null);
    setError('');
  };

  const cancelEdit = () => {
    setEditingLesson(null);
    setTitle('');
    setDescription('');
    setSlides([{ title: '', body: '' }]);
    setSelectedFile(null);
  };

  const deleteLesson = (lesson) => {
    Alert.alert('Delete lesson', `Delete "${lesson.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteLesson(token, lesson.id);
            setLessons((current) => current.filter((item) => item.id !== lesson.id));
            if (editingLesson?.id === lesson.id) cancelEdit();
            setMessage('Lesson deleted successfully.');
          } catch (err) {
            setError(err.message || 'Failed to delete lesson.');
          }
        }
      }
    ]);
  };

  if (isLoading) return null;
  const subjectOptions = subjects.map((subject) => ({
    label: `${subject.code} - ${subject.sectionName}`,
    value: subject.id
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.brandTitle}>Lessons</Text>
      <StaffHeader role={user?.role === 'program_chair' ? 'programchair' : 'faculty'} activeRoute="/lessons" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.heading}>{editingLesson ? 'Edit lesson' : 'Create lesson'}</Text>
        <DropdownSelect label="Assigned subject" icon="library-outline" placeholder="Select a subject" options={subjectOptions} value={subjectId} onSelect={setSubjectId} />
        <AuthInput label="Lesson title" icon="book-outline" placeholder="Enter lesson title" value={title} onChangeText={setTitle} />
        <AuthInput label="Description" icon="document-text-outline" placeholder="Optional description" value={description} onChangeText={setDescription} />
        <Text style={styles.subheading}>Create slides in the system</Text>
        {slides.map((slide, index) => (
          <View key={index} style={styles.slide}>
            <Text style={styles.slideLabel}>Slide {index + 1}</Text>
            <AuthInput label="Slide title" icon="text-outline" placeholder="Enter slide title" value={slide.title} onChangeText={(value) => setSlides((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: value } : item))} />
            <AuthInput label="Slide content" icon="reader-outline" placeholder="Enter slide content" value={slide.body} onChangeText={(value) => setSlides((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, body: value } : item))} multiline />
          </View>
        ))}
        <AuthButton title="Add another slide" variant="outline" onPress={() => setSlides((current) => [...current, { title: '', body: '' }])} />
        <Text style={styles.or}>or</Text>
        <AuthButton title={selectedFile ? `Selected: ${selectedFile.name}` : 'Choose PDF or PPTX'} variant="outline" onPress={pickFile} />
        <AuthButton title={editingLesson ? 'Update Lesson' : 'Save Lesson'} onPress={saveLesson} loading={isSaving} />
        {editingLesson ? <AuthButton title="Cancel Edit" variant="outline" onPress={cancelEdit} /> : null}
      </View>
      <Text style={styles.heading}>Published lessons</Text>
      {lessons.length === 0 ? <Text style={styles.empty}>No lessons created yet.</Text> : lessons.map((lesson) => (
        <View key={lesson.id} style={styles.item}>
          <Text style={styles.itemTitle}>{lesson.title}</Text>
          <Text style={styles.itemText}>{subjects.find((subject) => subject.id === lesson.subjectId)?.code || 'Assigned subject'} · {lesson.type === 'file' ? lesson.fileName : `${lesson.slides.length} slide(s)`}</Text>
          <AuthButton title="View lesson" variant="outline" onPress={() => setViewingLesson(lesson)} />
          <View style={styles.actions}>
            <AuthButton title="Edit" variant="outline" onPress={() => editLesson(lesson)} style={styles.actionButton} />
            <AuthButton title="Delete" variant="outline" onPress={() => deleteLesson(lesson)} style={[styles.actionButton, styles.deleteButton]} textStyle={styles.deleteText} />
          </View>
        </View>
      ))}
      <LessonViewer lesson={viewingLesson} onClose={() => setViewingLesson(null)} />
    </ScrollView>
  );
}

function StudentLessonsScreen() {
  const { token, isLoading } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState('');
  const [viewingLesson, setViewingLesson] = useState(null);

  useEffect(() => {
    if (!token) return;
    apiGetStudentLessons(token).then(setLessons).catch((err) => {
      setError(err.message || 'Failed to load lessons.');
    });
  }, [token]);

  if (isLoading) return null;
  if (error) return <StudentPage activeRoute="/lessons" title="Lessons" icon="book-outline" message={error} />;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.brandTitle}>Lessons</Text>
      <StudentHeader activeRoute="/lessons" />
      <Text style={styles.helper}>Lessons published for your enrolled subjects.</Text>
      {lessons.length === 0 ? <Text style={styles.empty}>No lessons are available yet.</Text> : lessons.map((lesson) => (
        <View key={lesson.id} style={styles.item}>
          <Text style={styles.itemTitle}>{lesson.title}</Text>
          <Text style={styles.itemText}>{lesson.type === 'file' ? lesson.fileName : `${lesson.slides.length} slide(s)`}</Text>
          {lesson.description ? <Text style={styles.itemText}>{lesson.description}</Text> : null}
          <AuthButton title="View lesson" variant="outline" onPress={() => setViewingLesson(lesson)} />
        </View>
      ))}
      <LessonViewer lesson={viewingLesson} onClose={() => setViewingLesson(null)} />
    </ScrollView>
  );
}

function LessonViewer({ lesson, onClose }) {
  if (!lesson) return null;

  return (
    <View style={styles.viewer}>
      <View style={styles.viewerHeader}>
        <View style={styles.viewerTitleContainer}>
          <Text style={styles.viewerTitle}>{lesson.title}</Text>
          <Text style={styles.itemText}>
            {lesson.type === 'file' ? lesson.fileName : `${lesson.slides.length} lesson slide(s)`}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
      {lesson.description ? <Text style={styles.viewerDescription}>{lesson.description}</Text> : null}
      {lesson.fileUrl ? (
        <View style={styles.fileViewer}>
          <Text style={styles.fileViewerText}>This lesson is an uploaded {lesson.fileName?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'PPTX'} file.</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`${API_BASE_URL}${lesson.fileUrl}`)}>
            <Text style={styles.link}>Open uploaded lesson</Text>
          </TouchableOpacity>
        </View>
      ) : (
        lesson.slides.map((slide, index) => (
          <View key={index} style={styles.slideViewer}>
            <Text style={styles.slideNumber}>Slide {index + 1}</Text>
            <Text style={styles.slideLabel}>{slide.title || `Slide ${index + 1}`}</Text>
            {slide.body ? <Text style={styles.slideBody}>{slide.body}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  brandTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 22 },
  heading: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  subheading: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 8, marginBottom: 8 },
  slide: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 8 },
  slideLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 4 },
  or: { textAlign: 'center', color: '#64748B', marginVertical: 8 },
  helper: { color: '#64748B', marginBottom: 16 },
  item: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  itemText: { fontSize: 13, color: '#64748B', marginTop: 5 },
  link: { fontSize: 12, color: '#2563EB', marginTop: 8 },
  empty: { color: '#64748B', marginBottom: 16 },
  error: { color: '#DC2626', marginBottom: 12 },
  message: { color: '#15803D', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { flex: 1 },
  deleteButton: { borderColor: '#FCA5A5' },
  deleteText: { color: '#DC2626' },
  slidePreview: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 8 },
  viewer: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#93C5FD', marginTop: 12 },
  viewerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  viewerTitleContainer: { flex: 1 },
  viewerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  closeButton: { paddingVertical: 4, paddingHorizontal: 2 },
  closeText: { color: '#2563EB', fontWeight: '700' },
  viewerDescription: { color: '#475569', fontSize: 14, lineHeight: 21, marginTop: 12 },
  fileViewer: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginTop: 12 },
  fileViewerText: { color: '#1E3A8A', fontSize: 13, lineHeight: 19 },
  slideViewer: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 14, marginTop: 14 },
  slideNumber: { color: '#2563EB', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  slideBody: { color: '#334155', fontSize: 15, lineHeight: 23, marginTop: 8 }
});
