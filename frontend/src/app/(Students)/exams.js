import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import StudentPage from '../../components/(Students)/StudentPage';
import StaffHeader from '../../components/StaffHeader';
import AuthButton from '../../components/AuthButton';
import AuthInput from '../../components/AuthInput';
import DropdownSelect from '../../components/DropdownSelect';
import {
  apiCreateQuiz,
  apiGetStudentQuizzes,
  apiGetTeachingQuizzes,
  apiGetTeachingSubjects,
  apiSubmitQuiz
} from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const createQuestion = () => ({ question: '', options: ['', '', '', ''], correctOption: 0 });
const createQuestions = () => Array.from({ length: 10 }, createQuestion);

export default function ExamsScreen() {
  const { user } = useAuth();
  if (user?.role === 'faculty' || user?.role === 'instructor' || user?.role === 'program_chair') {
    return <TeachingExamsScreen />;
  }
  if (user?.role === 'student') return <StudentExamsScreen />;
  return null;
}

function TeachingExamsScreen() {
  const { token, user, isLoading } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState(createQuestions);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewingQuiz, setViewingQuiz] = useState(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [assignedSubjects, teachingQuizzes] = await Promise.all([
        apiGetTeachingSubjects(token),
        apiGetTeachingQuizzes(token)
      ]);
      setSubjects(assignedSubjects);
      setQuizzes(teachingQuizzes);
      setSubjectId((current) => current || assignedSubjects[0]?.id || '');
    } catch (err) {
      setError(err.message || 'Failed to load quiz data.');
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const updateQuestion = (index, update) => {
    setQuestions((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...update } : item
    )));
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    setQuestions((current) => current.map((item, itemIndex) => {
      if (itemIndex !== questionIndex) return item;
      const options = item.options.map((option, index) => index === optionIndex ? value : option);
      return { ...item, options };
    }));
  };

  const saveQuiz = async () => {
    setError('');
    setMessage('');
    if (!subjectId || !title.trim()) {
      setError('Select an assigned subject and enter a quiz title.');
      return;
    }
    if (questions.length < 10 || questions.length > 20) {
      setError('A quiz must contain between 10 and 20 questions.');
      return;
    }
    if (questions.some((item) => !item.question.trim() || item.options.some((option) => !option.trim()))) {
      setError('Complete the question and all four options for every item.');
      return;
    }

    setIsSaving(true);
    try {
      const quiz = await apiCreateQuiz(token, { subjectId, title, description, questions });
      setQuizzes((current) => [quiz, ...current]);
      setTitle('');
      setDescription('');
      setQuestions(createQuestions());
      setMessage('Quiz created successfully.');
    } catch (err) {
      setError(err.message || 'Failed to create quiz.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return null;
  const subjectOptions = subjects.map((subject) => ({
    label: `${subject.code} - ${subject.sectionName}`,
    value: subject.id
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.brandTitle}>Quizzes</Text>
      <StaffHeader role={user?.role === 'program_chair' ? 'programchair' : 'faculty'} activeRoute="/exams" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.heading}>Create multiple-choice quiz</Text>
        <Text style={styles.helper}>Create 10 to 20 questions. Every question must have four options and one correct answer.</Text>
        <DropdownSelect label="Assigned subject" icon="library-outline" placeholder="Select a subject" options={subjectOptions} value={subjectId} onSelect={setSubjectId} />
        <AuthInput label="Quiz title" icon="document-text-outline" placeholder="Enter quiz title" value={title} onChangeText={setTitle} />
        <AuthInput label="Description" icon="reader-outline" placeholder="Optional instructions" value={description} onChangeText={setDescription} multiline />
        {questions.map((item, index) => (
          <View key={index} style={styles.questionCard}>
            <Text style={styles.questionLabel}>Question {index + 1}</Text>
            <AuthInput label="Question" icon="help-circle-outline" placeholder="Enter the question" value={item.question} onChangeText={(value) => updateQuestion(index, { question: value })} multiline />
            {item.options.map((option, optionIndex) => (
              <AuthInput
                key={optionIndex}
                label={`Option ${OPTION_LABELS[optionIndex]}`}
                icon="radio-button-on-outline"
                placeholder={`Enter option ${OPTION_LABELS[optionIndex]}`}
                value={option}
                onChangeText={(value) => updateOption(index, optionIndex, value)}
              />
            ))}
            <DropdownSelect
              label="Correct answer"
              icon="checkmark-circle-outline"
              options={OPTION_LABELS.map((label, optionIndex) => ({ label: `Option ${label}`, value: optionIndex }))}
              value={item.correctOption}
              onSelect={(value) => updateQuestion(index, { correctOption: value })}
            />
          </View>
        ))}
        {questions.length < 20 ? <AuthButton title="Add question" variant="outline" onPress={() => setQuestions((current) => [...current, createQuestion()])} /> : null}
        {questions.length > 10 ? <AuthButton title="Remove last question" variant="outline" onPress={() => setQuestions((current) => current.slice(0, -1))} /> : null}
        <AuthButton title={isSaving ? 'Creating quiz...' : 'Create Quiz'} onPress={saveQuiz} loading={isSaving} />
      </View>
      <Text style={styles.heading}>Created quizzes</Text>
      {quizzes.length === 0 ? <Text style={styles.empty}>No quizzes created yet.</Text> : quizzes.map((quiz) => (
        <View key={quiz.id} style={styles.item}>
          <Text style={styles.itemTitle}>{quiz.title}</Text>
          <Text style={styles.itemText}>{quiz.subjectCode} · {quiz.sectionName} · {quiz.questions.length} questions</Text>
          <AuthButton title="View exam" variant="outline" onPress={() => setViewingQuiz(quiz)} />
        </View>
      ))}
      <QuizViewer key={viewingQuiz?.id || 'faculty-exam-viewer'} quiz={viewingQuiz} showAnswers onClose={() => setViewingQuiz(null)} />
    </ScrollView>
  );
}

function StudentExamsScreen() {
  const { token, isLoading } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState('');
  const [viewingQuiz, setViewingQuiz] = useState(null);

  useEffect(() => {
    if (!token) return;
    apiGetStudentQuizzes(token).then(setQuizzes).catch((err) => setError(err.message || 'Failed to load quizzes.'));
  }, [token]);

  if (isLoading) return null;
  return (
    <StudentPage activeRoute="/exams" title="Exams" icon="document-text-outline" message="">
      <ScrollView contentContainerStyle={styles.studentContent}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {quizzes.length === 0 ? <Text style={styles.empty}>No quizzes are available yet.</Text> : quizzes.map((quiz) => (
          <View key={quiz.id} style={styles.item}>
            <Text style={styles.itemTitle}>{quiz.title}</Text>
            <Text style={styles.itemText}>{quiz.subjectCode} · {quiz.questions.length} multiple-choice questions</Text>
            {quiz.description ? <Text style={styles.itemText}>{quiz.description}</Text> : null}
            <AuthButton title="View exam" variant="outline" onPress={() => setViewingQuiz(quiz)} />
          </View>
        ))}
        <QuizViewer key={viewingQuiz?.id || 'student-exam-viewer'} quiz={viewingQuiz} token={token} onClose={() => setViewingQuiz(null)} />
      </ScrollView>
    </StudentPage>
  );
}

function QuizViewer({ quiz, showAnswers = false, token, onClose }) {
  const [answers, setAnswers] = useState(() => quiz ? Array(quiz.questions.length).fill(null) : []);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!quiz) return null;

  const submitExam = async () => {
    setSubmitError('');
    if (answers.some((answer) => answer === null)) {
      setSubmitError('Answer every question before submitting the exam.');
      return;
    }
    setIsSubmitting(true);
    try {
      setResult(await apiSubmitQuiz(token, quiz.id, answers));
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit exam.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.viewer}>
      <View style={styles.viewerHeader}>
        <View style={styles.viewerTitleContainer}>
          <Text style={styles.viewerTitle}>{quiz.title}</Text>
          <Text style={styles.itemText}>
            {quiz.subjectCode || 'Assigned subject'} · {quiz.questions.length} questions
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
      {quiz.description ? <Text style={styles.viewerDescription}>{quiz.description}</Text> : null}
      {quiz.questions.map((question, index) => (
        <View key={`${quiz.id}-${index}`} style={styles.examQuestion}>
          <Text style={styles.questionLabel}>{index + 1}. {question.question}</Text>
          {question.options.map((option, optionIndex) => (
            <TouchableOpacity
              key={optionIndex}
              accessibilityRole="radio"
              accessibilityState={{ selected: answers[index] === optionIndex }}
              onPress={() => !showAnswers && setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? optionIndex : answer))}
              style={[
                styles.examOption,
                answers[index] === optionIndex && styles.selectedOption,
                showAnswers && question.correctOption === optionIndex && styles.correctOption
              ]}
            >
              <Text>
                {OPTION_LABELS[optionIndex]}. {option}{showAnswers && question.correctOption === optionIndex ? ' (Correct answer)' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      {!showAnswers ? (
        <>
          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
          <AuthButton title="Submit exam" onPress={submitExam} loading={isSubmitting} />
          {result ? (
            <View style={styles.result}>
              <Text style={styles.resultTitle}>Exam submitted</Text>
              <Text style={styles.resultScore}>{result.score} / {result.total}</Text>
              <Text style={styles.resultText}>{result.percentage}% correct</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  brandTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 24 },
  heading: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 12, marginTop: 18 },
  helper: { fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 19 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  questionCard: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16, marginTop: 12 },
  questionLabel: { fontSize: 15, fontWeight: '700', color: '#1D4ED8', marginBottom: 8 },
  item: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  itemText: { fontSize: 13, color: '#64748B', marginTop: 5 },
  error: { color: '#B91C1C', marginBottom: 12 },
  message: { color: '#047857', marginBottom: 12 },
  empty: { color: '#64748B', marginBottom: 12 },
  studentContent: { paddingBottom: 24 },
  viewer: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#93C5FD', marginTop: 12, marginBottom: 20 },
  viewerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  viewerTitleContainer: { flex: 1 },
  viewerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  closeButton: { paddingVertical: 4, paddingHorizontal: 2 },
  closeText: { color: '#2563EB', fontWeight: '700' },
  viewerDescription: { color: '#475569', fontSize: 14, lineHeight: 21, marginTop: 12 },
  examQuestion: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 14, marginTop: 14 },
  examOption: { color: '#334155', fontSize: 14, lineHeight: 20, marginTop: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  selectedOption: { backgroundColor: '#EFF6FF', borderColor: '#60A5FA', color: '#1D4ED8' },
  correctOption: { color: '#047857', fontWeight: '700', borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  result: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 16, marginTop: 12, alignItems: 'center' },
  resultTitle: { color: '#047857', fontSize: 16, fontWeight: '800' },
  resultScore: { color: '#065F46', fontSize: 28, fontWeight: '800', marginTop: 6 },
  resultText: { color: '#047857', fontSize: 14, marginTop: 4 }
});
