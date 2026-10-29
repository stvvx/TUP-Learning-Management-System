import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import StudentHeader from '../../components/(Students)/StudentHeader';
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
  successLine: '#B7E1C8',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  dangerLine: '#FECDCA'
};

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

/* ───────────────────────── Shared bits ───────────────────────── */

function PageHeader({ title, subtitle, count }) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderIcon}>
        <Ionicons name="document-text" size={22} color={COLORS.brand} />
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

function EmptyState({ icon = 'document-text-outline', children }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={30} color={COLORS.faint} />
      <Text style={styles.empty}>{children}</Text>
    </View>
  );
}

// Full-screen modal shell used by the quiz viewer and the scores viewer
function ViewerShell({ title, subtitle, onClose, children, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fsRoot}>
        <View style={[styles.fsHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.fsCloseBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.brandDeep} />
          </TouchableOpacity>
          <View style={styles.fsHeaderText}>
            <Text style={styles.fsTitle} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.fsSub} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>

        {children}

        {footer ? (
          <View style={[styles.fsFooter, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.fsFooterInner}>{footer}</View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/* ───────────────────────── Faculty / Instructor view ───────────────────────── */

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="Quizzes"
        subtitle="Build quizzes and check student scores"
        count={quizzes.length}
      />
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
          <Ionicons
            name="albums-outline"
            size={16}
            color={activeTab === 'list' ? COLORS.surface : COLORS.ink}
          />
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
          <Ionicons
            name="add-circle-outline"
            size={16}
            color={activeTab === 'create' ? COLORS.surface : COLORS.ink}
          />
          <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>
            Create Quiz
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── My Quizzes tab ──────────────────────────────────── */}
      {activeTab === 'list' && (
        <View>
          {loadError ? <Banner kind="error">{loadError}</Banner> : null}
          {formMessage ? <Banner kind="success">{formMessage}</Banner> : null}
          {scoresError ? <Banner kind="error">{scoresError}</Banner> : null}

          {quizzes.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIconWrap}>
                <Ionicons name="create-outline" size={34} color={COLORS.brand} />
              </View>
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
                    <View style={styles.subjectChip}>
                      <Text style={styles.subjectChipText}>{quiz.subjectCode}</Text>
                    </View>
                    <Text style={styles.quizCardTitle}>{quiz.title}</Text>
                    <Text style={styles.quizCardSub}>{quiz.sectionName}</Text>
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
                    <Ionicons name="eye-outline" size={16} color={COLORS.ink} />
                    <Text style={styles.actionChipText}>View exam</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionChip, styles.scoresChip]}
                    onPress={() => viewScores(quiz)}
                  >
                    <Ionicons name="stats-chart" size={16} color={COLORS.brandDeep} />
                    <Text style={[styles.actionChipText, styles.scoresChipText]}>
                      Student scores
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* quiz viewer (full screen) */}
          <QuizViewer
            key={viewingQuiz?.id || 'faculty-exam-viewer'}
            quiz={viewingQuiz}
            showAnswers
            onClose={() => setViewingQuiz(null)}
          />

          {/* scores viewer (full screen) */}
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
          {formError ? <Banner kind="error">{formError}</Banner> : null}

          {/* basic info card */}
          <View style={styles.cardWrap}>
            <View style={styles.cardShadow} />
            <View style={styles.formSection}>
              <View style={styles.formSectionTitleRow}>
                <Ionicons name="settings-outline" size={20} color={COLORS.brand} />
                <Text style={styles.formSectionTitle}>Quiz details</Text>
              </View>
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
          </View>

          {/* questions card */}
          <View style={styles.formSection}>
            <View style={styles.questionsSectionHeader}>
              <View>
                <View style={styles.formSectionTitleRow}>
                  <Ionicons name="help-circle-outline" size={20} color={COLORS.brand} />
                  <Text style={styles.formSectionTitle}>Questions</Text>
                </View>
                <Text style={styles.questionsCount}>
                  {questions.length} / 20 · min 10
                </Text>
              </View>
              {questions.length < 20 ? (
                <TouchableOpacity style={styles.addQuestionBtn} onPress={addQuestion}>
                  <Ionicons name="add" size={16} color={COLORS.brandDeep} />
                  <Text style={styles.addQuestionBtnText}>Add</Text>
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
                      <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                      <Text style={styles.removeQuestionBtnText}>Remove</Text>
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
                <Ionicons name="add-circle-outline" size={18} color={COLORS.brand} />
                <Text style={styles.addQuestionBlockText}>Add another question</Text>
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

/* ───────────────────────── Student view ───────────────────────── */

function StudentExamsScreen() {
  const { token, isLoading } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState('');
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(true);
  const [viewingQuiz, setViewingQuiz] = useState(null);

  const loadQuizzes = useCallback(() => {
    if (!token) return;
    apiGetStudentQuizzes(token)
      .then(setQuizzes)
      .catch((err) => setError(err.message || 'Failed to load quizzes.'))
      .finally(() => setIsLoadingQuizzes(false));
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="Exams"
        subtitle="Quizzes for your enrolled subjects"
        count={isLoadingQuizzes ? undefined : quizzes.length}
      />
      <StudentHeader activeRoute="/exams" />

      {error ? <Banner kind="error">{error}</Banner> : null}
      {isLoadingQuizzes ? (
        <ActivityIndicator style={{ paddingVertical: 28 }} color={COLORS.brand} />
      ) : (
        <>
        {quizzes.length === 0 ? (
          <EmptyState>No quizzes are available yet. Breathe easy 🍃</EmptyState>
        ) : (
          quizzes.map((quiz) => {
            const hasTaken = Boolean(quiz.submission);
            const isPass = hasTaken && quiz.submission.percentage >= 75;

            return (
              <View key={quiz.id} style={styles.quizCard}>
                <View style={styles.quizCardHeader}>
                  <View style={styles.quizCardMeta}>
                    <View style={styles.subjectChip}>
                      <Text style={styles.subjectChipText}>{quiz.subjectCode}</Text>
                    </View>
                    <Text style={styles.quizCardTitle}>{quiz.title}</Text>
                    <Text style={styles.quizCardSub}>
                      {quiz.questions.length} questions
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
        </>
      )}

      <QuizViewer
        key={viewingQuiz?.id || 'student-exam-viewer'}
        quiz={viewingQuiz}
        token={token}
        onSubmitted={handleQuizSubmitted}
        onClose={() => setViewingQuiz(null)}
      />
    </ScrollView>
  );
}

/* ───────────────────────── Quiz scores (full screen) ───────────────────────── */

function QuizScoresViewer({ quiz, submissions, onClose }) {
  if (!quiz) return null;

  const avg =
    submissions.length > 0
      ? Math.round(
          submissions.reduce((sum, s) => sum + s.percentage, 0) / submissions.length
        )
      : null;

  return (
    <ViewerShell
      title={quiz.title}
      subtitle={`Student scores · ${submissions.length} submitted`}
      onClose={onClose}
    >
      <ScrollView
        style={styles.fsScroll}
        contentContainerStyle={styles.fsContent}
        showsVerticalScrollIndicator={false}
      >
        {avg !== null && (
          <View style={styles.avgRow}>
            <View>
              <Text style={styles.avgLabel}>Class average</Text>
              <Text style={styles.avgSub}>{submissions.length} student(s)</Text>
            </View>
            <Text style={styles.avgValue}>{avg}%</Text>
          </View>
        )}

        {submissions.length === 0 ? (
          <EmptyState icon="people-outline">No student submissions yet.</EmptyState>
        ) : (
          submissions.map((submission) => (
            <View key={submission.id} style={styles.scoreRow}>
              <View style={styles.scoreAvatar}>
                <Text style={styles.scoreAvatarText}>
                  {(submission.studentName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
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
                  <Text
                    style={[
                      styles.scorePctText,
                      submission.percentage >= 75
                        ? styles.scorePctTextPass
                        : styles.scorePctTextFail
                    ]}
                  >
                    {submission.percentage}%
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ViewerShell>
  );
}

/* ───────────────────────── Quiz viewer / taker (full screen) ───────────────────────── */

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
  const isTaking = !showAnswers && !isCompleted;

  // Sticky footer: submit while taking, close while reviewing a finished exam
  let footer = null;
  if (isTaking) {
    footer = (
      <>
        {submitError ? <Banner kind="error">{submitError}</Banner> : null}
        <AuthButton
          title={isSubmitting ? 'Submitting…' : 'Submit exam'}
          onPress={submitExam}
          loading={isSubmitting}
        />
      </>
    );
  } else if (isCompleted && !showAnswers) {
    footer = (
      <AuthButton title="Close Exam Review" variant="outline" onPress={onClose} />
    );
  }

  return (
    <ViewerShell
      title={quiz.title}
      subtitle={`${quiz.subjectCode || 'Assigned subject'} · ${quiz.questions.length} questions`}
      onClose={onClose}
      footer={footer}
    >
      {/* progress bar for active takers, pinned under the header */}
      {isTaking ? (
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
      ) : null}

      <ScrollView
        style={styles.fsScroll}
        contentContainerStyle={styles.fsContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Completed Score Banner for Student */}
        {isCompleted && !showAnswers && (
          <View style={styles.completedBanner}>
            <View style={styles.completedHeaderRow}>
              <View style={styles.completedCheckCircle}>
                <Ionicons name="checkmark" size={18} color={COLORS.surface} />
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
                <Text
                  style={[
                    styles.scorePctText,
                    (result?.percentage || 0) >= 75
                      ? styles.scorePctTextPass
                      : styles.scorePctTextFail
                  ]}
                >
                  {result?.percentage}%
                </Text>
              </View>
            </View>
            <Text style={styles.reviewNotice}>
              Reviewing your submitted answers below.
            </Text>
          </View>
        )}

        {quiz.description ? (
          <View style={styles.instructionsBox}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.goldDeep} />
            <Text style={styles.panelDescription}>{quiz.description}</Text>
          </View>
        ) : null}

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
                  <View
                    style={[
                      styles.examOptionLabel,
                      isSelected && styles.examOptionLabelSelected,
                      isCorrect && styles.examOptionLabelCorrect
                    ]}
                  >
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
      </ScrollView>
    </ViewerShell>
  );
}

/* ───────────────────────── Styles ───────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, paddingTop: 48, paddingBottom: 60 },

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
  bannerSuccess: { backgroundColor: COLORS.successSoft, borderColor: COLORS.successLine },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 4,
    marginBottom: 20
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6
  },
  tabActive: { backgroundColor: COLORS.brand },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  tabTextActive: { color: COLORS.surface, fontWeight: '800' },
  badge: {
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5
  },
  badgeText: { color: COLORS.brandDeep, fontSize: 11, fontWeight: '800' },

  /* Empty state */
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyStateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyStateTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  emptyStateBtn: { width: 240 },
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

  /* Quiz card (list) */
  quizCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.ink,
    marginBottom: 12
  },
  quizCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  quizCardMeta: { flex: 1 },
  subjectChip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brand,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 8
  },
  subjectChipText: { fontSize: 12, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.4 },
  quizCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink, marginBottom: 3 },
  quizCardSub: { fontSize: 13, color: COLORS.muted },
  quizCardDesc: { fontSize: 13, color: COLORS.muted, marginTop: 4, lineHeight: 18 },
  questionCountBadge: {
    backgroundColor: COLORS.gold,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.ink,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignItems: 'center'
  },
  questionCountText: { color: COLORS.brandDeep, fontWeight: '800', fontSize: 13 },
  submittedBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  badgePass: { backgroundColor: COLORS.successSoft },
  badgeFail: { backgroundColor: COLORS.dangerSoft },
  submittedBadgeText: { fontWeight: '800', fontSize: 12 },
  badgeTextPass: { color: COLORS.success },
  badgeTextFail: { color: COLORS.danger },

  scoreSummaryBox: {
    backgroundColor: COLORS.paper,
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: COLORS.line,
    marginBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4
  },
  scoreSummaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreSummaryLabel: { fontSize: 12, color: COLORS.muted },
  scoreSummaryValue: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
  scoreSummaryDate: { fontSize: 11, color: COLORS.faint },

  quizCardActions: { flexDirection: 'row', gap: 8 },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  actionChipText: { fontSize: 13, fontWeight: '800', color: COLORS.ink },
  scoresChip: { backgroundColor: COLORS.goldSoft },
  scoresChipText: { color: COLORS.brandDeep },
  takeExamBtn: { marginTop: 4 },

  /* Create form */
  createForm: { gap: 16 },
  cardWrap: { marginRight: 6, marginBottom: 6 },
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
  formSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  formSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  formSectionTitle: { fontSize: 17, fontWeight: '900', color: COLORS.ink },
  questionsSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  questionsCount: { fontSize: 12, color: COLORS.muted, marginTop: -6 },
  addQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14
  },
  addQuestionBtnText: { color: COLORS.brandDeep, fontWeight: '800', fontSize: 13 },
  questionCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.line,
    padding: 12,
    marginTop: 14
  },
  questionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  questionNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  questionNumberText: { color: COLORS.surface, fontWeight: '800', fontSize: 12 },
  questionCardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.ink },
  removeQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerLine,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  removeQuestionBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  optionsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.brand,
    marginTop: 4,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  addQuestionBlock: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.goldSoft
  },
  addQuestionBlockText: { color: COLORS.brand, fontWeight: '800', fontSize: 14 },

  /* Full-screen viewers */
  fsRoot: { flex: 1, backgroundColor: COLORS.paper },
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
  fsScroll: { flex: 1 },
  fsContent: {
    padding: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center'
  },
  fsFooter: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 2,
    borderTopColor: COLORS.ink,
    paddingTop: 12,
    paddingHorizontal: 16
  },
  fsFooterInner: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 8 },

  /* Viewer content */
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8
  },
  panelDescription: { flex: 1, fontSize: 14, color: COLORS.brandDeep, lineHeight: 21 },

  /* Completed banner */
  completedBanner: {
    backgroundColor: COLORS.successSoft,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.success,
    marginBottom: 12
  },
  completedHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  completedCheckCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center'
  },
  completedInfo: { flex: 1 },
  completedTitle: { fontSize: 16, fontWeight: '900', color: COLORS.success },
  completedSub: { fontSize: 12, color: COLORS.success, marginTop: 1 },
  completedScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  completedScoreNumber: { fontSize: 26, fontWeight: '900', color: COLORS.ink },
  reviewNotice: { fontSize: 12, color: COLORS.success, marginTop: 8, textAlign: 'center', fontWeight: '600' },

  /* Scores */
  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.brand,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 16,
    marginBottom: 14
  },
  avgLabel: { fontSize: 14, fontWeight: '800', color: COLORS.surface },
  avgSub: { fontSize: 12, color: COLORS.brandLine, marginTop: 1 },
  avgValue: { fontSize: 32, fontWeight: '900', color: COLORS.gold },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 12,
    marginBottom: 10
  },
  scoreAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scoreAvatarText: { fontSize: 15, fontWeight: '900', color: COLORS.brandDeep },
  scoreRowMeta: { flex: 1 },
  scoreStudentName: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
  scoreDate: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  scoreValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreRaw: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
  scorePctBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  scorePctPass: { backgroundColor: COLORS.successSoft },
  scorePctFail: { backgroundColor: COLORS.dangerSoft },
  scorePctText: { fontSize: 12, fontWeight: '800' },
  scorePctTextPass: { color: COLORS.success },
  scorePctTextFail: { color: COLORS.danger },

  /* Exam taking */
  progressWrap: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.line
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.goldSoft,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.ink,
    overflow: 'hidden',
    marginBottom: 5
  },
  progressFill: { height: '100%', backgroundColor: COLORS.brand },
  progressText: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textAlign: 'right' },
  examQuestion: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 14,
    marginTop: 14
  },
  examQuestionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  examQuestionText: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.ink, lineHeight: 22 },
  examOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.line,
    backgroundColor: COLORS.paper,
    marginBottom: 8
  },
  examOptionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  examOptionCorrect: { borderColor: COLORS.success, backgroundColor: COLORS.successSoft },
  examOptionDisabled: { opacity: 0.95 },
  examOptionLabel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.inkSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  examOptionLabelSelected: { backgroundColor: COLORS.brand },
  examOptionLabelCorrect: { backgroundColor: COLORS.success },
  examOptionLetter: { fontSize: 13, fontWeight: '800', color: COLORS.ink },
  examOptionLetterSelected: { color: COLORS.surface },
  examOptionLetterCorrect: { color: COLORS.surface },
  examOptionText: { flex: 1, fontSize: 14, color: COLORS.ink, lineHeight: 20 },
  examOptionTextSelected: { color: COLORS.brandDeep, fontWeight: '800' },
  examOptionTextCorrect: { color: COLORS.success, fontWeight: '800' },

  /* Shared */
  studentContent: { paddingBottom: 24 }
});