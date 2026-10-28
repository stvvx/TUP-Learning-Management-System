import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import StudentPage from '../../components/(Students)/StudentPage';
import StaffHeader from '../../components/StaffHeader';
import AuthButton from '../../components/AuthButton';
import AuthInput from '../../components/AuthInput';
import DropdownSelect from '../../components/DropdownSelect';
import {
  apiCreateQuiz,
  apiGetQuizSubmissions,
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

// ─── Faculty / Instructor view ────────────────────────────────────────────────
function TeachingExamsScreen() {
  const { token, user, isLoading } = useAuth();

  // shared data
  const [subjects, setSubjects] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loadError, setLoadError] = useState('');

  // tab: 'list' | 'create'
  const [activeTab, setActiveTab] = useState('list');

  // create-form state
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState(createQuestions);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // quiz viewer / scores
  const [viewingQuiz, setViewingQuiz] = useState(null);
  const [scoresQuiz, setScoresQuiz] = useState(null);
  const [quizScores, setQuizScores] = useState([]);
  const [scoresError, setScoresError] = useState('');

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
      setLoadError(err.message || 'Failed to load quiz data.');
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // ── question helpers ──────────────────────────────────────────────────────
  const updateQuestion = (index, update) => {
    setQuestions((current) =>
      current.map((item, i) => (i === index ? { ...item, ...update } : item))
    );
  };

  const updateOption = (qIdx, optIdx, value) => {
    setQuestions((current) =>
      current.map((item, i) => {
        if (i !== qIdx) return item;
        const options = item.options.map((o, oi) => (oi === optIdx ? value : o));
        return { ...item, options };
      })
    );
  };

  const addQuestion = () => {
    if (questions.length >= 20) return;
    setQuestions((current) => [...current, createQuestion()]);
  };

  const removeQuestion = (index) => {
    if (questions.length <= 10) return;
    const doRemove = () =>
      setQuestions((current) => current.filter((_, i) => i !== index));
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove Question ${index + 1}?`)) doRemove();
    } else {
      Alert.alert('Remove question', `Remove Question ${index + 1}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doRemove }
      ]);
    }
  };

  // ── save quiz ─────────────────────────────────────────────────────────────
  const saveQuiz = async () => {
    setFormError('');
    setFormMessage('');
    if (!subjectId || !title.trim()) {
      setFormError('Select an assigned subject and enter a quiz title.');
      return;
    }
    if (questions.length < 10 || questions.length > 20) {
      setFormError('A quiz must contain between 10 and 20 questions.');
      return;
    }
    if (
      questions.some(
        (item) =>
          !item.question.trim() || item.options.some((o) => !o.trim())
      )
    ) {
      setFormError('Complete the question and all four options for every item.');
      return;
    }
    setIsSaving(true);
    try {
      const quiz = await apiCreateQuiz(token, {
        subjectId, title, description, questions
      });
      setQuizzes((current) => [quiz, ...current]);
      setTitle('');
      setDescription('');
      setQuestions(createQuestions());
      setFormMessage('Quiz created successfully.');
      setActiveTab('list');
    } catch (err) {
      setFormError(err.message || 'Failed to create quiz.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── view scores ───────────────────────────────────────────────────────────
  const viewScores = async (quiz) => {
    setScoresError('');
    try {
      const submissions = await apiGetQuizSubmissions(token, quiz.id);
      setScoresQuiz(quiz);
      setQuizScores(submissions || []);
    } catch (err) {
      setScoresError(err.message || 'Failed to load quiz scores.');
    }
  };

  if (isLoading) return null;

  const subjectOptions = subjects.map((s) => ({
    label: `${s.code} - ${s.sectionName}`,
    value: s.id
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.brandTitle}>Quizzes</Text>
      <StaffHeader
        role={user?.role === 'program_chair' ? 'programchair' : 'faculty'}
        activeRoute="/exams"
      />

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.tabActive]}
          onPress={() => setActiveTab('list')}
        >
          <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>
            My Quizzes
          </Text>
          {quizzes.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{quizzes.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'create' && styles.tabActive]}
          onPress={() => {
            setFormError('');
            setFormMessage('');
            setTitle('');
            setDescription('');
            setQuestions(createQuestions());
            setActiveTab('create');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>
            + Create Quiz
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── My Quizzes tab ──────────────────────────────────── */}
      {activeTab === 'list' && (
        <View>
          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
          {formMessage ? (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>✓ {formMessage}</Text>
            </View>
          ) : null}
          {scoresError ? <Text style={styles.error}>{scoresError}</Text> : null}

          {quizzes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📝</Text>
              <Text style={styles.emptyStateTitle}>No quizzes yet</Text>
              <Text style={styles.emptyStateText}>
                Switch to the Create Quiz tab to build your first quiz.
              </Text>
              <AuthButton
                title="Create your first quiz"
                onPress={() => {
                  setTitle('');
                  setDescription('');
                  setQuestions(createQuestions());
                  setActiveTab('create');
                }}
                style={styles.emptyStateBtn}
              />
            </View>
          ) : (
            quizzes.map((quiz) => (
              <View key={quiz.id} style={styles.quizCard}>
                {/* header row */}
                <View style={styles.quizCardHeader}>
                  <View style={styles.quizCardMeta}>
                    <Text style={styles.quizCardTitle}>{quiz.title}</Text>
                    <Text style={styles.quizCardSub}>
                      {quiz.subjectCode} · {quiz.sectionName}
                    </Text>
                  </View>
                  <View style={styles.questionCountBadge}>
                    <Text style={styles.questionCountText}>{quiz.questions.length}Q</Text>
                  </View>
                </View>

                {/* action buttons */}
                <View style={styles.quizCardActions}>
                  <TouchableOpacity
                    style={styles.actionChip}
                    onPress={() => setViewingQuiz(quiz)}
                  >
                    <Text style={styles.actionChipText}>👁 View exam</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionChip, styles.scoresChip]}
                    onPress={() => viewScores(quiz)}
                  >
                    <Text style={[styles.actionChipText, styles.scoresChipText]}>
                      📊 Student scores
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* quiz viewer panel */}
          <QuizViewer
            key={viewingQuiz?.id || 'faculty-exam-viewer'}
            quiz={viewingQuiz}
            showAnswers
            onClose={() => setViewingQuiz(null)}
          />

          {/* scores panel */}
          {scoresQuiz ? (
            <QuizScoresViewer
              quiz={scoresQuiz}
              submissions={quizScores}
              onClose={() => { setScoresQuiz(null); setQuizScores([]); }}
            />
          ) : null}
        </View>
      )}

      {/* ── Create Quiz tab ─────────────────────────────────── */}
      {activeTab === 'create' && (
        <View style={styles.createForm}>
          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          {/* basic info card */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Quiz details</Text>
            <DropdownSelect
              label="Assigned subject"
              icon="library-outline"
              placeholder="Select a subject"
              options={subjectOptions}
              value={subjectId}
              onSelect={setSubjectId}
            />
            <AuthInput
              label="Quiz title"
              icon="document-text-outline"
              placeholder="Enter quiz title"
              value={title}
              onChangeText={setTitle}
            />
            <AuthInput
              label="Instructions (optional)"
              icon="reader-outline"
              placeholder="Add instructions for students"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          {/* questions card */}
          <View style={styles.formSection}>
            <View style={styles.questionsSectionHeader}>
              <View>
                <Text style={styles.formSectionTitle}>Questions</Text>
                <Text style={styles.questionsCount}>
                  {questions.length} / 20 · min 10
                </Text>
              </View>
              {questions.length < 20 ? (
                <TouchableOpacity style={styles.addQuestionBtn} onPress={addQuestion}>
                  <Text style={styles.addQuestionBtnText}>+ Add</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {questions.map((item, index) => (
              <View key={index} style={styles.questionCard}>
                <View style={styles.questionCardHeader}>
                  <View style={styles.questionNumberBadge}>
                    <Text style={styles.questionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.questionCardTitle}>Question {index + 1}</Text>
                  {questions.length > 10 ? (
                    <TouchableOpacity
                      style={styles.removeQuestionBtn}
                      onPress={() => removeQuestion(index)}
                    >
                      <Text style={styles.removeQuestionBtnText}>✕ Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <AuthInput
                  label="Question text"
                  icon="help-circle-outline"
                  placeholder="Enter the question"
                  value={item.question}
                  onChangeText={(value) => updateQuestion(index, { question: value })}
                  multiline
                />

                <Text style={styles.optionsLabel}>Answer options</Text>
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
                  options={OPTION_LABELS.map((label, optionIndex) => ({
                    label: `Option ${label}`,
                    value: optionIndex
                  }))}
                  value={item.correctOption}
                  onSelect={(value) => updateQuestion(index, { correctOption: value })}
                />
              </View>
            ))}

            {questions.length < 20 ? (
              <TouchableOpacity style={styles.addQuestionBlock} onPress={addQuestion}>
                <Text style={styles.addQuestionBlockText}>+ Add another question</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* save button */}
          <AuthButton
            title={isSaving ? 'Creating quiz…' : 'Create Quiz'}
            onPress={saveQuiz}
            loading={isSaving}
          />
          <AuthButton
            title="Cancel"
            variant="outline"
            onPress={() => {
              setFormError('');
              setTitle('');
              setDescription('');
              setQuestions(createQuestions());
              setActiveTab('list');
            }}
          />
        </View>
      )}
    </ScrollView>
  );
}

// ─── Student view ─────────────────────────────────────────────────────────────
function StudentExamsScreen() {
  const { token, isLoading } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState('');
  const [viewingQuiz, setViewingQuiz] = useState(null);

  const loadQuizzes = useCallback(() => {
    if (!token) return;
    apiGetStudentQuizzes(token)
      .then(setQuizzes)
      .catch((err) => setError(err.message || 'Failed to load quizzes.'));
  }, [token]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const handleQuizSubmitted = (quizId, result, answers) => {
    const updatedSubmission = {
      score: result.score,
      total: result.total,
      percentage: result.percentage,
      submittedAt: result.submittedAt || new Date().toISOString(),
      answers
    };

    setQuizzes((current) =>
      current.map((q) =>
        q.id === quizId ? { ...q, submission: updatedSubmission } : q
      )
    );

    setViewingQuiz((current) =>
      current && current.id === quizId
        ? { ...current, submission: updatedSubmission }
        : current
    );

    loadQuizzes();
  };

  if (isLoading) return null;

  return (
    <StudentPage activeRoute="/exams" title="Exams" icon="document-text-outline" message="">
      <ScrollView contentContainerStyle={styles.studentContent}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {quizzes.length === 0 ? (
          <Text style={styles.empty}>No quizzes are available yet.</Text>
        ) : (
          quizzes.map((quiz) => {
            const hasTaken = Boolean(quiz.submission);
            const isPass = hasTaken && quiz.submission.percentage >= 75;

            return (
              <View key={quiz.id} style={styles.quizCard}>
                <View style={styles.quizCardHeader}>
                  <View style={styles.quizCardMeta}>
                    <Text style={styles.quizCardTitle}>{quiz.title}</Text>
                    <Text style={styles.quizCardSub}>
                      {quiz.subjectCode} · {quiz.questions.length} questions
                    </Text>
                    {quiz.description ? (
                      <Text style={styles.quizCardDesc}>{quiz.description}</Text>
                    ) : null}
                  </View>

                  {hasTaken ? (
                    <View style={[styles.submittedBadge, isPass ? styles.badgePass : styles.badgeFail]}>
                      <Text style={[styles.submittedBadgeText, isPass ? styles.badgeTextPass : styles.badgeTextFail]}>
                        {isPass ? 'Passed ✓' : 'Completed'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.questionCountBadge}>
                      <Text style={styles.questionCountText}>{quiz.questions.length}Q</Text>
                    </View>
                  )}
                </View>

                {hasTaken && (
                  <View style={styles.scoreSummaryBox}>
                    <View style={styles.scoreSummaryItem}>
                      <Text style={styles.scoreSummaryLabel}>Your Score</Text>
                      <Text style={styles.scoreSummaryValue}>
                        {quiz.submission.score} / {quiz.submission.total} ({quiz.submission.percentage}%)
                      </Text>
                    </View>
                    <Text style={styles.scoreSummaryDate}>
                      Submitted: {new Date(quiz.submission.submittedAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}

                <AuthButton
                  title={hasTaken ? 'View Exam & Score' : 'Take exam'}
                  onPress={() => setViewingQuiz(quiz)}
                  variant={hasTaken ? 'outline' : 'primary'}
                  style={styles.takeExamBtn}
                />
              </View>
            );
          })
        )}
        <QuizViewer
          key={viewingQuiz?.id || 'student-exam-viewer'}
          quiz={viewingQuiz}
          token={token}
          onSubmitted={handleQuizSubmitted}
          onClose={() => setViewingQuiz(null)}
        />
      </ScrollView>
    </StudentPage>
  );
}

// ─── Quiz Scores panel ────────────────────────────────────────────────────────
function QuizScoresViewer({ quiz, submissions, onClose }) {
  if (!quiz) return null;

  const avg =
    submissions.length > 0
      ? Math.round(
          submissions.reduce((sum, s) => sum + s.percentage, 0) / submissions.length
        )
      : null;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleWrap}>
          <Text style={styles.panelTitle}>📊 {quiz.title}</Text>
          <Text style={styles.panelSub}>Student scores · {submissions.length} submitted</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕ Close</Text>
        </TouchableOpacity>
      </View>

      {avg !== null && (
        <View style={styles.avgRow}>
          <Text style={styles.avgLabel}>Class average</Text>
          <Text style={styles.avgValue}>{avg}%</Text>
        </View>
      )}

      {submissions.length === 0 ? (
        <Text style={styles.empty}>No student submissions yet.</Text>
      ) : (
        submissions.map((submission) => (
          <View key={submission.id} style={styles.scoreRow}>
            <View style={styles.scoreRowMeta}>
              <Text style={styles.scoreStudentName}>{submission.studentName}</Text>
              <Text style={styles.scoreDate}>
                {new Date(submission.submittedAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.scoreValues}>
              <Text style={styles.scoreRaw}>
                {submission.score}/{submission.total}
              </Text>
              <View
                style={[
                  styles.scorePctBadge,
                  submission.percentage >= 75
                    ? styles.scorePctPass
                    : styles.scorePctFail
                ]}
              >
                <Text style={styles.scorePctText}>{submission.percentage}%</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ─── Quiz viewer / taker ──────────────────────────────────────────────────────
function QuizViewer({ quiz, showAnswers = false, token, onSubmitted, onClose }) {
  const hasTaken = Boolean(quiz?.submission);

  const [answers, setAnswers] = useState(() => {
    if (quiz?.submission?.answers && Array.isArray(quiz.submission.answers)) {
      return quiz.submission.answers;
    }
    return quiz ? Array(quiz.questions.length).fill(null) : [];
  });
  const [result, setResult] = useState(() => quiz?.submission || null);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!quiz) return null;

  const isCompleted = Boolean(hasTaken || result);

  const submitExam = async () => {
    if (isCompleted) {
      setSubmitError('You have already taken this quiz. Retakes are not allowed.');
      return;
    }
    setSubmitError('');
    if (answers.some((a) => a === null)) {
      setSubmitError('Answer every question before submitting.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiSubmitQuiz(token, quiz.id, answers);
      setResult(res);
      onSubmitted?.(quiz.id, res, answers);
    } catch (err) {
      if (err.data?.result) {
        setResult(err.data.result);
        onSubmitted?.(quiz.id, err.data.result, answers);
      }
      setSubmitError(err.message || 'Failed to submit exam.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const answered = answers.filter((a) => a !== null).length;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleWrap}>
          <Text style={styles.panelTitle}>{quiz.title}</Text>
          <Text style={styles.panelSub}>
            {quiz.subjectCode || 'Assigned subject'} · {quiz.questions.length} questions
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕ Close</Text>
        </TouchableOpacity>
      </View>

      {/* Completed Score Banner for Student */}
      {isCompleted && !showAnswers && (
        <View style={styles.completedBanner}>
          <View style={styles.completedHeaderRow}>
            <View style={styles.completedCheckCircle}>
              <Text style={styles.completedCheckMark}>✓</Text>
            </View>
            <View style={styles.completedInfo}>
              <Text style={styles.completedTitle}>Exam Completed</Text>
              <Text style={styles.completedSub}>
                {result?.submittedAt ? `Submitted ${new Date(result.submittedAt).toLocaleDateString()}` : 'Submitted'} · Retakes not allowed
              </Text>
            </View>
          </View>
          <View style={styles.completedScoreCard}>
            <Text style={styles.completedScoreNumber}>
              {result?.score} / {result?.total}
            </Text>
            <View
              style={[
                styles.scorePctBadge,
                (result?.percentage || 0) >= 75
                  ? styles.scorePctPass
                  : styles.scorePctFail
              ]}
            >
              <Text style={styles.scorePctText}>{result?.percentage}%</Text>
            </View>
          </View>
          <Text style={styles.reviewNotice}>
            Reviewing your submitted answers below.
          </Text>
        </View>
      )}

      {quiz.description ? (
        <Text style={styles.panelDescription}>{quiz.description}</Text>
      ) : null}

      {/* progress bar for active takers */}
      {!showAnswers && !isCompleted && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(answered / quiz.questions.length) * 100}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {answered} / {quiz.questions.length} answered
          </Text>
        </View>
      )}

      {quiz.questions.map((question, index) => (
        <View key={`${quiz.id}-${index}`} style={styles.examQuestion}>
          <View style={styles.examQuestionHeader}>
            <View style={styles.questionNumberBadge}>
              <Text style={styles.questionNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.examQuestionText}>{question.question}</Text>
          </View>
          {question.options.map((option, optionIndex) => {
            const isSelected = answers[index] === optionIndex;
            const isCorrect =
              showAnswers && question.correctOption === optionIndex;
            return (
              <TouchableOpacity
                key={optionIndex}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                disabled={showAnswers || isCompleted}
                onPress={() =>
                  !showAnswers &&
                  !isCompleted &&
                  setAnswers((current) =>
                    current.map((a, ai) => (ai === index ? optionIndex : a))
                  )
                }
                style={[
                  styles.examOption,
                  isSelected && styles.examOptionSelected,
                  isCorrect && styles.examOptionCorrect,
                  isCompleted && styles.examOptionDisabled
                ]}
              >
                <View style={styles.examOptionLabel}>
                  <Text
                    style={[
                      styles.examOptionLetter,
                      isSelected && styles.examOptionLetterSelected,
                      isCorrect && styles.examOptionLetterCorrect
                    ]}
                  >
                    {OPTION_LABELS[optionIndex]}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.examOptionText,
                    isSelected && styles.examOptionTextSelected,
                    isCorrect && styles.examOptionTextCorrect
                  ]}
                >
                  {option}
                  {isCorrect ? '  ✓ (Correct)' : ''}
                  {isCompleted && isSelected && !showAnswers ? '  (Your answer)' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {!showAnswers && !isCompleted && (
        <>
          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
          <AuthButton
            title={isSubmitting ? 'Submitting…' : 'Submit exam'}
            onPress={submitExam}
            loading={isSubmitting}
          />
        </>
      )}

      {isCompleted && !showAnswers && (
        <AuthButton
          title="Close Exam Review"
          variant="outline"
          onPress={onClose}
          style={{ marginTop: 16 }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 48, paddingBottom: 60 },
  brandTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 20 },

  // tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
    gap: 6
  },
  tabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#1D4ED8', fontWeight: '700' },
  badge: { backgroundColor: '#1D4ED8', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  // empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyStateIcon: { fontSize: 48, marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  emptyStateBtn: { width: 220 },

  // success banner
  successBanner: { backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginBottom: 16 },
  successBannerText: { color: '#047857', fontWeight: '700', fontSize: 14 },

  // quiz card (list)
  quizCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  quizCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  quizCardMeta: { flex: 1 },
  quizCardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  quizCardSub: { fontSize: 13, color: '#64748B' },
  quizCardDesc: { fontSize: 13, color: '#64748B', marginTop: 4 },
  questionCountBadge: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  questionCountText: { color: '#1D4ED8', fontWeight: '800', fontSize: 13 },
  submittedBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  badgePass: { backgroundColor: '#ECFDF5' },
  badgeFail: { backgroundColor: '#FEF2F2' },
  submittedBadgeText: { fontWeight: '800', fontSize: 12 },
  badgeTextPass: { color: '#059669' },
  badgeTextFail: { color: '#DC2626' },

  scoreSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  scoreSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  scoreSummaryLabel: {
    fontSize: 12,
    color: '#64748B'
  },
  scoreSummaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  scoreSummaryDate: {
    fontSize: 11,
    color: '#94A3B8'
  },

  quizCardActions: { flexDirection: 'row', gap: 8 },
  actionChip: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  actionChipText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  scoresChip: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  scoresChipText: { color: '#047857' },
  takeExamBtn: { marginTop: 4 },

  // create form
  createForm: { gap: 16 },
  formSection: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  formSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  questionsSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  questionsCount: { fontSize: 12, color: '#64748B', marginTop: 2 },
  addQuestionBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  addQuestionBtnText: { color: '#1D4ED8', fontWeight: '700', fontSize: 13 },
  questionCard: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16, marginTop: 12 },
  questionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  questionNumberBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  questionNumberText: { color: '#1D4ED8', fontWeight: '800', fontSize: 12 },
  questionCardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#334155' },
  removeQuestionBtn: { backgroundColor: '#FEF2F2', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  removeQuestionBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 12 },
  optionsLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 4, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  addQuestionBlock: { marginTop: 16, borderWidth: 1.5, borderColor: '#BFDBFE', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  addQuestionBlockText: { color: '#1D4ED8', fontWeight: '700', fontSize: 14 },

  // panel (viewer / scores)
  panel: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#93C5FD', marginTop: 16, marginBottom: 8 },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  panelTitleWrap: { flex: 1 },
  panelTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  panelSub: { fontSize: 13, color: '#64748B', marginTop: 3 },
  panelDescription: { fontSize: 14, color: '#475569', lineHeight: 21, marginBottom: 12 },
  closeBtn: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  closeBtnText: { color: '#334155', fontWeight: '700', fontSize: 13 },

  // completed banner
  completedBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16
  },
  completedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10
  },
  completedCheckCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center'
  },
  completedCheckMark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  completedInfo: {
    flex: 1
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46'
  },
  completedSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 1
  },
  completedScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5'
  },
  completedScoreNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#065F46'
  },
  reviewNotice: {
    fontSize: 12,
    color: '#047857',
    marginTop: 8,
    textAlign: 'center'
  },

  // scores
  avgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 12 },
  avgLabel: { fontSize: 14, fontWeight: '600', color: '#1D4ED8' },
  avgValue: { fontSize: 22, fontWeight: '800', color: '#1D4ED8' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  scoreRowMeta: { flex: 1, marginRight: 12 },
  scoreStudentName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  scoreDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  scoreValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreRaw: { fontSize: 14, fontWeight: '700', color: '#334155' },
  scorePctBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  scorePctPass: { backgroundColor: '#DCFCE7' },
  scorePctFail: { backgroundColor: '#FEE2E2' },
  scorePctText: { fontSize: 12, fontWeight: '800', color: '#0F172A' },

  // exam viewer
  progressWrap: { marginBottom: 16 },
  progressBar: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },
  progressText: { fontSize: 12, color: '#64748B', textAlign: 'right' },
  examQuestion: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16, marginTop: 16 },
  examQuestionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  examQuestionText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A', lineHeight: 22 },
  examOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 8 },
  examOptionSelected: { borderColor: '#60A5FA', backgroundColor: '#EFF6FF' },
  examOptionCorrect: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  examOptionDisabled: { opacity: 0.9 },
  examOptionLabel: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  examOptionLetter: { fontSize: 13, fontWeight: '800', color: '#475569' },
  examOptionLetterSelected: { color: '#1D4ED8' },
  examOptionLetterCorrect: { color: '#047857' },
  examOptionText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },
  examOptionTextSelected: { color: '#1D4ED8', fontWeight: '700' },
  examOptionTextCorrect: { color: '#047857', fontWeight: '700' },

  // shared
  error: { color: '#B91C1C', marginBottom: 12, fontSize: 14 },
  empty: { color: '#64748B', marginBottom: 12 },
  studentContent: { paddingBottom: 24 }
});
