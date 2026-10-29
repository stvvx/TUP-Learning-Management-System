import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import StudentPage from '../../components/(Students)/StudentPage';
import StudentHeader from '../../components/(Students)/StudentHeader';
import StaffHeader from '../../components/StaffHeader';
import AuthButton from '../../components/AuthButton';
import AuthInput from '../../components/AuthInput';
import DropdownSelect from '../../components/DropdownSelect';
import { API_BASE_URL, apiCreateLesson, apiDeleteLesson, apiGetStudentLessons, apiGetTeachingLessons, apiGetTeachingSubjects, apiReplaceLessonFile, apiUpdateLesson, apiUploadLesson } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

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
  inkSoft: '#EFE9EA',
  muted: '#6E6165',
  faint: '#A39A9E',
  line: '#E8E2E4',
  success: '#1F7A4D',
  successSoft: '#E3F4EA',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  dangerLine: '#FECDCA'
};

const FILE_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];

// "PDF" / "PPTX" / "SLIDES" label for a lesson
const getLessonKind = (lesson) => {
  if (lesson?.type === 'file') {
    const ext = lesson.fileName?.split('.').pop()?.toUpperCase();
    return ext || 'FILE';
  }
  return 'SLIDES';
};

const getLessonSummary = (lesson) =>
  lesson?.type === 'file'
    ? lesson.fileName
    : `${lesson?.slides?.length || 0} slide(s)`;

export default function LessonsScreen() {
  const { user } = useAuth();
  if (user?.role === 'faculty' || user?.role === 'instructor' || user?.role === 'program_chair') {
    return <TeachingLessonsScreen />;
  }
  if (user?.role === 'student') return <StudentLessonsScreen />;
  return null;
}

/* ───────────────────────── Shared bits ───────────────────────── */

function PageHeader({ title, subtitle, count }) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderIcon}>
        <Ionicons name="book" size={22} color={COLORS.brand} />
      </View>
      <View style={styles.pageHeaderText}>
        <Text style={styles.brandTitle}>{title}</Text>
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

function EmptyState({ icon = 'book-outline', children }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={30} color={COLORS.faint} />
      <Text style={styles.empty}>{children}</Text>
    </View>
  );
}

function KindBadge({ lesson }) {
  const kind = getLessonKind(lesson);
  return (
    <View style={styles.kindBadge}>
      <Text style={styles.kindBadgeText}>{kind}</Text>
    </View>
  );
}

/* ───────────────────────── Teaching view ───────────────────────── */

function TeachingLessonsScreen() {
  const { token, user, isLoading } = useAuth();
  const scrollRef = useRef(null);
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
  const [deletingLessonId, setDeletingLessonId] = useState(null);

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

  const refreshLessons = useCallback(async () => {
    if (!token) return;
    try {
      const teachingLessons = await apiGetTeachingLessons(token);
      setLessons(teachingLessons);
    } catch (err) {
      setError(err.message || 'Failed to refresh lessons.');
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

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

  const updateSlide = (index, field, value) =>
    setSlides((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );

  const removeSlide = (index) =>
    setSlides((current) =>
      current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current
    );

  const saveLesson = async () => {
    setError('');
    setMessage('');
    if (!subjectId || !title.trim()) {
      setError('Select an assigned subject and enter a lesson title.');
      scrollToTop();
      return;
    }
    setIsSaving(true);
    try {
      let lesson;
      if (editingLesson) {
        lesson = selectedFile
          ? await apiReplaceLessonFile(token, editingLesson.id, {
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
          file: {
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
      scrollToTop();
    } catch (err) {
      setError(err.message || 'Failed to save lesson.');
      scrollToTop();
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
    setMessage('');
    scrollToTop();
  };

  const cancelEdit = () => {
    setEditingLesson(null);
    setTitle('');
    setDescription('');
    setSlides([{ title: '', body: '' }]);
    setSelectedFile(null);
  };

  const deleteLesson = (lesson) => {
    if (!lesson?.id || deletingLessonId === lesson.id) return;

    const performDelete = async () => {
      setDeletingLessonId(lesson.id);
      setMessage('');
      setError('');

      try {
        await apiDeleteLesson(token, lesson.id);
        setViewingLesson((current) => (current?.id === lesson.id ? null : current));
        if (editingLesson?.id === lesson.id) cancelEdit();
        await refreshLessons();
        setMessage('Lesson deleted successfully.');
      } catch (err) {
        setError(err.message || 'Failed to delete lesson.');
      } finally {
        setDeletingLessonId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${lesson.title}"?`)) {
        performDelete();
      }
    } else {
      Alert.alert('Delete lesson', `Delete "${lesson.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete }
      ]);
    }
  };

  if (isLoading) return null;
  const subjectOptions = subjects.map((subject) => ({
    label: `${subject.code} - ${subject.sectionName}`,
    value: subject.id
  }));

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="Lessons"
        subtitle="Create and manage lessons for your subjects"
        count={lessons.length}
      />
      <StaffHeader role={user?.role === 'program_chair' ? 'programchair' : 'faculty'} activeRoute="/lessons" />
      {error ? <Banner kind="error">{error}</Banner> : null}
      {message ? <Banner kind="success">{message}</Banner> : null}

      {/* Create / edit form */}
      <View style={styles.cardWrap}>
        <View style={styles.cardShadow} />
        <View style={styles.card}>
          <View style={styles.formTitleRow}>
            <Ionicons
              name={editingLesson ? 'create-outline' : 'add-circle-outline'}
              size={22}
              color={COLORS.brand}
            />
            <Text style={styles.formTitle}>{editingLesson ? 'Edit lesson' : 'Create lesson'}</Text>
            {editingLesson ? (
              <View style={styles.editingPill}>
                <Text style={styles.editingPillText}>EDITING</Text>
              </View>
            ) : null}
          </View>

          <DropdownSelect label="Assigned subject" icon="library-outline" placeholder="Select a subject" options={subjectOptions} value={subjectId} onSelect={setSubjectId} />
          <AuthInput label="Lesson title" icon="book-outline" placeholder="Enter lesson title" value={title} onChangeText={setTitle} />
          <AuthInput label="Description" icon="document-text-outline" placeholder="Optional description" value={description} onChangeText={setDescription} />

          <View style={styles.sectionDivider} />
          <Text style={styles.subheading}>Build slides in the app ✏️</Text>
          {slides.map((slide, index) => (
            <View key={index} style={styles.slide}>
              <View style={styles.slideHeaderRow}>
                <View style={styles.slideNumberBubble}>
                  <Text style={styles.slideNumberBubbleText}>{index + 1}</Text>
                </View>
                <Text style={styles.slideLabel}>Slide {index + 1}</Text>
                {slides.length > 1 ? (
                  <TouchableOpacity
                    onPress={() => removeSlide(index)}
                    style={styles.removeSlideBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove slide ${index + 1}`}
                  >
                    <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                    <Text style={styles.removeSlideText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <AuthInput label="Slide title" icon="text-outline" placeholder="Enter slide title" value={slide.title} onChangeText={(value) => updateSlide(index, 'title', value)} />
              <AuthInput label="Slide content" icon="reader-outline" placeholder="Enter slide content" value={slide.body} onChangeText={(value) => updateSlide(index, 'body', value)} multiline />
            </View>
          ))}
          <AuthButton title="Add another slide" variant="outline" onPress={() => setSlides((current) => [...current, { title: '', body: '' }])} />

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.or}>or upload a file</Text>
            <View style={styles.orLine} />
          </View>

          <AuthButton title={selectedFile ? `Selected: ${selectedFile.name}` : 'Choose PDF or PPTX'} variant="outline" onPress={pickFile} />
          <View style={styles.formActions}>
            <AuthButton title={editingLesson ? 'Update Lesson' : 'Save Lesson'} onPress={saveLesson} loading={isSaving} />
            {editingLesson ? <AuthButton title="Cancel Edit" variant="outline" onPress={cancelEdit} /> : null}
          </View>
        </View>
      </View>

      {/* Published lessons */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.heading}>Published lessons</Text>
        <Text style={styles.sectionCount}>{lessons.length} total</Text>
      </View>
      {lessons.length === 0 ? (
        <EmptyState>No lessons created yet. Make your first one above 👆</EmptyState>
      ) : lessons.map((lesson) => {
        const isViewingLesson = viewingLesson?.id === lesson.id;
        const subjectCode = subjects.find((subject) => subject.id === lesson.subjectId)?.code || 'Assigned subject';
        return (
          <View key={lesson.id} style={styles.item}>
            <View style={styles.itemTopRow}>
              <View style={styles.subjectChip}>
                <Text style={styles.subjectChipText}>{subjectCode}</Text>
              </View>
              <KindBadge lesson={lesson} />
            </View>
            <Text style={styles.itemTitle}>{lesson.title}</Text>
            <Text style={styles.itemText}>{getLessonSummary(lesson)}</Text>
            <View style={styles.itemButtonGap}>
              <AuthButton title="View lesson" variant="outline" onPress={() => setViewingLesson(lesson)} />
            </View>
            {isViewingLesson ? <LessonViewer lesson={lesson} onClose={() => setViewingLesson(null)} /> : null}
            <View style={styles.actions}>
              <AuthButton title="Edit" variant="outline" onPress={() => editLesson(lesson)} style={styles.actionButton} />
              <AuthButton
                title={deletingLessonId === lesson.id ? 'Deleting...' : 'Delete'}
                variant="outline"
                onPress={() => deleteLesson(lesson)}
                style={[styles.actionButton, styles.deleteButton, deletingLessonId === lesson.id && styles.deleteDisabled]}
                textStyle={styles.deleteText}
                disabled={deletingLessonId === lesson.id}
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

/* ───────────────────────── Student view ───────────────────────── */

function StudentLessonsScreen() {
  const { token, isLoading } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState('');
  const [isLoadingLessons, setIsLoadingLessons] = useState(true);
  const [viewingLesson, setViewingLesson] = useState(null);

  useEffect(() => {
    if (!token) return;
    setIsLoadingLessons(true);
    apiGetStudentLessons(token)
      .then(setLessons)
      .catch((err) => {
        setError(err.message || 'Failed to load lessons.');
      })
      .finally(() => setIsLoadingLessons(false));
  }, [token]);

  if (isLoading) return null;
  if (error) return <StudentPage activeRoute="/lessons" title="Lessons" icon="book-outline" message={error} />;
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="Lessons"
        subtitle="Published for your enrolled subjects"
        count={isLoadingLessons ? undefined : lessons.length}
      />
      <StudentHeader activeRoute="/lessons" />

      {isLoadingLessons ? (
        <ActivityIndicator style={{ paddingVertical: 28 }} color={COLORS.brand} />
      ) : lessons.length === 0 ? (
        <EmptyState>No lessons are available yet. Check back soon 😌</EmptyState>
      ) : lessons.map((lesson) => {
        const isViewingLesson = viewingLesson?.id === lesson.id;
        return (
          <View key={lesson.id} style={styles.item}>
            <View style={styles.itemTopRow}>
              <KindBadge lesson={lesson} />
            </View>
            <Text style={styles.itemTitle}>{lesson.title}</Text>
            <Text style={styles.itemText}>{getLessonSummary(lesson)}</Text>
            {lesson.description ? <Text style={styles.itemText}>{lesson.description}</Text> : null}
            <View style={styles.itemButtonGap}>
              <AuthButton title="View lesson" variant="outline" onPress={() => setViewingLesson(lesson)} />
            </View>
            {isViewingLesson ? <LessonViewer lesson={lesson} onClose={() => setViewingLesson(null)} /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

/* ───────────────────────── Lesson viewer ───────────────────────── */

// Servers on private/local addresses can't be reached by Office Online's embed viewer.
const isPrivateHost = (url) =>
  /^https?:\/\/(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);

// Full-screen lesson viewer (opens as a modal over the whole screen)
function LessonViewer({ lesson, onClose }) {
  const insets = useSafeAreaInsets();
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);

  const isWeb = Platform.OS === 'web';
  const fileUrl = lesson?.fileUrl || '';
  const fileName = lesson?.fileName || '';
  // Support both relative ("/uploads/x.pdf") and absolute file URLs
  const lessonFileUrl = fileUrl
    ? (/^https?:\/\//i.test(fileUrl) ? fileUrl : `${API_BASE_URL}${fileUrl}`)
    : '';
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const slides = lesson?.slides || [];

  // Start from slide 1 whenever a different lesson is opened
  useEffect(() => {
    setSlideIndex(0);
  }, [lesson?.id]);

  // Web PDF preview: load into a blob URL (data: URLs for PDFs get blocked by browsers)
  useEffect(() => {
    if (!isWeb || !lessonFileUrl || !isPdf) {
      setPdfBlobUrl('');
      setViewerError('');
      setIsLoadingPdf(false);
      return undefined;
    }

    let isActive = true;
    let objectUrl = '';

    const loadPdf = async () => {
      setIsLoadingPdf(true);
      setViewerError('');
      setPdfBlobUrl('');
      try {
        const response = await fetch(lessonFileUrl);
        if (!response.ok) {
          throw new Error(`PDF request failed with status ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        if (!isActive) return;
        // Force the PDF mime type in case the server sends a wrong content-type
        objectUrl = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
        setPdfBlobUrl(objectUrl);
      } catch (err) {
        console.warn('Failed to load PDF for in-app preview:', err);
        if (isActive) {
          setViewerError('This PDF could not be previewed here. Use "Open in new tab" instead.');
        }
      } finally {
        if (isActive) setIsLoadingPdf(false);
      }
    };

    loadPdf();

    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isWeb, lessonFileUrl, isPdf]);

  if (!lesson) return null;

  const openFile = async () => {
    if (!lessonFileUrl) return;
    try {
      if (isWeb) {
        window.open(lessonFileUrl, '_blank', 'noopener');
      } else {
        // No canOpenURL check: it wrongly returns false for https on Android 11+
        await Linking.openURL(lessonFileUrl);
      }
    } catch (err) {
      console.warn('Failed to open lesson file:', err);
      Alert.alert('Could not open file', 'This lesson file could not be opened on this device.');
    }
  };

  const officeViewerUrl = lessonFileUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(lessonFileUrl)}`
    : '';
  const canEmbedPptx = isWeb && !isPdf && lessonFileUrl && !isPrivateHost(lessonFileUrl);

  const safeIndex = Math.min(slideIndex, Math.max(slides.length - 1, 0));
  const currentSlide = slides[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex >= slides.length - 1;

  const renderFileBody = () => {
    if (isWeb && isPdf && isLoadingPdf) {
      return (
        <View style={styles.fsCenter}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.fsCenterTextLight}>Loading PDF...</Text>
        </View>
      );
    }

    if (isWeb && isPdf && pdfBlobUrl) {
      return (
        <iframe
          title={lesson.title}
          src={`${pdfBlobUrl}#view=FitH`}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#2B2325' }}
        />
      );
    }

    if (canEmbedPptx) {
      return (
        <iframe
          title={lesson.title}
          src={officeViewerUrl}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#FFFFFF' }}
        />
      );
    }

    // Native, PPTX on a private server, or a PDF that failed to preview
    return (
      <View style={styles.fsCenter}>
        <View style={styles.fsFileCard}>
          <View style={styles.fsFileIcon}>
            <Ionicons
              name={isPdf ? 'document-text' : 'easel'}
              size={34}
              color={COLORS.brand}
            />
          </View>
          <Text style={styles.fsFileName} numberOfLines={2}>{fileName || lesson.title}</Text>
          <Text style={styles.fsFileHint}>
            {viewerError
              ? viewerError
              : isWeb && !isPdf
                ? 'PowerPoint files can only be previewed when the server is publicly reachable. Open the file to view it.'
                : `This lesson is an uploaded ${isPdf ? 'PDF' : 'PPTX'} file. Open it to view on your device.`}
          </Text>
          <TouchableOpacity style={styles.downloadButton} onPress={openFile} activeOpacity={0.85}>
            <Ionicons
              name={isWeb ? 'open-outline' : 'download-outline'}
              size={18}
              color={COLORS.surface}
            />
            <Text style={styles.downloadButtonText}>
              {isWeb ? 'Open in new tab' : 'Open / download lesson'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSlidesBody = () => {
    if (slides.length === 0) {
      return (
        <View style={styles.fsCenter}>
          <Ionicons name="easel-outline" size={36} color={COLORS.faint} />
          <Text style={styles.fsCenterTextDark}>This lesson has no slides yet.</Text>
        </View>
      );
    }
    return (
      <>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((safeIndex + 1) / slides.length) * 100}%` }
            ]}
          />
        </View>
        <ScrollView
          style={styles.fsSlideScroll}
          contentContainerStyle={styles.fsSlideContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.slideNumberPill}>
            <Text style={styles.slideNumber}>
              SLIDE {safeIndex + 1} OF {slides.length}
            </Text>
          </View>
          <Text style={styles.fsSlideTitle}>{currentSlide?.title || `Slide ${safeIndex + 1}`}</Text>
          {currentSlide?.body ? <Text style={styles.fsSlideBody}>{currentSlide.body}</Text> : null}
        </ScrollView>
        <View style={[styles.fsBottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.pagerBtn, isFirst && styles.pagerBtnDisabled]}
            onPress={() => setSlideIndex(Math.max(safeIndex - 1, 0))}
            disabled={isFirst}
            accessibilityRole="button"
            accessibilityLabel="Previous slide"
          >
            <Ionicons name="arrow-back" size={16} color={COLORS.brandDeep} />
            <Text style={styles.pagerBtnText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pagerBtn, styles.pagerBtnPrimary, isLast && styles.pagerBtnDisabled]}
            onPress={() => setSlideIndex(Math.min(safeIndex + 1, slides.length - 1))}
            disabled={isLast}
            accessibilityRole="button"
            accessibilityLabel="Next slide"
          >
            <Text style={[styles.pagerBtnText, styles.pagerBtnTextPrimary]}>Next</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.surface} />
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const isFileLesson = Boolean(lessonFileUrl);

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.fsRoot, isFileLesson && styles.fsRootDark]}>
        {/* Header */}
        <View style={[styles.fsHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.fsCloseBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close lesson"
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.brandDeep} />
          </TouchableOpacity>
          <View style={styles.fsHeaderText}>
            <Text style={styles.fsTitle} numberOfLines={1}>{lesson.title}</Text>
            <Text style={styles.fsSub} numberOfLines={1}>
              {lesson.type === 'file' ? lesson.fileName : `${slides.length} lesson slide(s)`}
            </Text>
          </View>
          {isFileLesson ? (
            <TouchableOpacity
              onPress={openFile}
              style={styles.fsIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isWeb ? 'Open in new tab' : 'Download lesson'}
            >
              <Ionicons
                name={isWeb ? 'open-outline' : 'download-outline'}
                size={20}
                color={COLORS.surface}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {lesson.description && !isFileLesson ? (
          <Text style={styles.fsDescription} numberOfLines={2}>{lesson.description}</Text>
        ) : null}

        {/* Body fills the rest of the screen */}
        <View style={styles.fsBody}>
          {isFileLesson ? renderFileBody() : renderSlidesBody()}
        </View>
      </View>
    </Modal>
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
  brandTitle: { fontSize: 24, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.5 },
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

  /* Form card with hard offset shadow */
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
  editingPill: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    transform: [{ rotate: '-2deg' }]
  },
  editingPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.brandDeep },
  sectionDivider: { height: 2, backgroundColor: COLORS.goldSoft, borderRadius: 1, marginVertical: 14 },
  subheading: { fontSize: 14, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },

  /* Slides in form */
  slide: {
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.line,
    padding: 12,
    marginBottom: 12
  },
  slideHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  slideNumberBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  slideNumberBubbleText: { color: COLORS.surface, fontSize: 12, fontWeight: '800' },
  slideLabel: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.ink },
  removeSlideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerLine
  },
  removeSlideText: { fontSize: 11, fontWeight: '700', color: COLORS.danger },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.line },
  or: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  formActions: { gap: 8, marginTop: 4 },

  /* Lists */
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
    padding: 24,
    marginBottom: 16
  },
  empty: { color: COLORS.muted, textAlign: 'center', fontSize: 13 },

  item: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 15,
    borderWidth: 2,
    borderColor: COLORS.ink,
    marginBottom: 12
  },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  subjectChip: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999
  },
  subjectChipText: { fontSize: 12, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.4 },
  kindBadge: {
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999
  },
  kindBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: COLORS.brandDeep },
  itemTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  itemText: { fontSize: 13, color: COLORS.muted, marginTop: 5, lineHeight: 18 },
  itemButtonGap: { marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { flex: 1 },
  deleteButton: { borderColor: COLORS.danger },
  deleteDisabled: { opacity: 0.6 },
  deleteText: { color: COLORS.danger },

  /* Viewer */
  viewer: {
    backgroundColor: COLORS.paper,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.brand,
    marginTop: 12
  },
  viewerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  viewerTitleContainer: { flex: 1 },
  viewerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999
  },
  closeText: { color: COLORS.brandDeep, fontWeight: '800', fontSize: 12 },
  viewerDescription: { color: COLORS.ink, fontSize: 14, lineHeight: 21, marginTop: 12 },
  fileViewer: {
    backgroundColor: COLORS.goldSoft,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    padding: 12,
    marginTop: 12
  },
  fileViewerText: { color: COLORS.brandDeep, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  viewerErrorText: { color: COLORS.danger, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  downloadButton: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.brand,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderBottomWidth: 4,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  downloadButtonText: { color: COLORS.surface, fontWeight: '800', fontSize: 14 },
  webEmbedContainer: {
    height: 360,
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.surface
  },
  /* Full-screen viewer */
  fsRoot: { flex: 1, backgroundColor: COLORS.paper },
  fsRootDark: { backgroundColor: '#2B2325' },
  fsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 4,
    borderBottomColor: COLORS.gold
  },
  fsCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fsHeaderText: { flex: 1 },
  fsTitle: { fontSize: 17, fontWeight: '900', color: COLORS.surface },
  fsSub: { fontSize: 12, color: COLORS.brandLine, marginTop: 1 },
  fsIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: COLORS.brandLine,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fsDescription: {
    backgroundColor: COLORS.goldSoft,
    color: COLORS.brandDeep,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  fsBody: { flex: 1 },
  fsCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  fsCenterTextLight: { color: COLORS.brandLine, fontSize: 13, fontWeight: '600' },
  fsCenterTextDark: { color: COLORS.muted, fontSize: 14, textAlign: 'center' },
  fsFileCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 22
  },
  fsFileIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fsFileName: { fontSize: 15, fontWeight: '800', color: COLORS.ink, textAlign: 'center' },
  fsFileHint: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 19 },
  fsSlideScroll: { flex: 1 },
  fsSlideContent: { padding: 24, paddingBottom: 32 },
  fsSlideTitle: { fontSize: 28, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.5, marginTop: 4 },
  fsSlideBody: { fontSize: 18, lineHeight: 28, color: COLORS.ink, marginTop: 16 },
  fsBottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 2,
    borderTopColor: COLORS.ink
  },
  previewPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  previewPlaceholderText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.goldSoft,
    overflow: 'hidden'
  },
  progressFill: { height: '100%', backgroundColor: COLORS.brand },
  pagerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 16 },
  pagerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.goldSoft
  },
  pagerBtnPrimary: { backgroundColor: COLORS.brand },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.brandDeep },
  pagerBtnTextPrimary: { color: COLORS.surface },
  slideViewer: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.line,
    padding: 14,
    marginTop: 12
  },
  slideNumberPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brandSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 6
  },
  slideNumber: { color: COLORS.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  slideTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  slideBody: { color: COLORS.ink, fontSize: 15, lineHeight: 23, marginTop: 8 }
});