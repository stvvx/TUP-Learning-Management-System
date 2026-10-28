import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import AuthButton from '../components/AuthButton';
import StudentHeader from '../components/(Students)/StudentHeader';
import AdminDashboard from '../components/(Super Admin)/adminDashboard';
import FacultyDashboard from '../components/(Faculty)/facultyDashboard';
import PcDashboard from '../components/(Program Chair)/pcDashboard';
import DashboardBarChart from '../components/DashboardBarChart';
import { apiGetDashboardStats } from '../api/dashboardStats';
import {
  apiGetStudentSubjects,
  apiGetStudentLessons,
  apiGetStudentQuizzes
} from '../api/client';

export default function DashboardScreen({ onNavigate }) {
  const router = useRouter();
  const { user, token, logout, refreshUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [stats, setStats] = useState({ chart: [], totals: {} });
  const [subjectsData, setSubjectsData] = useState({ yearLevel: null, subjects: [], terms: [] });
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  const chartData = Array.isArray(stats?.chart) ? stats.chart : [];

  const loadAllStudentData = useCallback(async () => {
    if (!token || user?.role !== 'student') return;
    try {
      const [nextStats, nextSubjects, nextLessons, nextQuizzes] = await Promise.all([
        apiGetDashboardStats(token).catch((err) => {
          console.warn('Dashboard stats load error:', err);
          return { chart: [], totals: {} };
        }),
        apiGetStudentSubjects(token).catch((err) => {
          console.warn('Student subjects load error:', err);
          return { yearLevel: null, subjects: [], terms: [] };
        }),
        apiGetStudentLessons(token).catch((err) => {
          console.warn('Student lessons load error:', err);
          return [];
        }),
        apiGetStudentQuizzes(token).catch((err) => {
          console.warn('Student quizzes load error:', err);
          return [];
        })
      ]);

      setStats(nextStats || { chart: [], totals: {} });
      setSubjectsData(nextSubjects || { yearLevel: null, subjects: [], terms: [] });
      setLessons(Array.isArray(nextLessons) ? nextLessons : []);
      setQuizzes(Array.isArray(nextQuizzes) ? nextQuizzes : []);
    } catch (error) {
      console.error('Failed to load student dashboard data:', error);
    } finally {
      setIsLoadingContent(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (token && user?.role === 'student') {
      const timer = setTimeout(loadAllStudentData, 0);
      return () => clearTimeout(timer);
    }
  }, [loadAllStudentData, token, user?.role]);

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      if (onNavigate) {
        onNavigate('login');
      } else {
        router.replace('/login');
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to log out of your Technological University of the Philippines - Taguig account?')) {
        performLogout();
      }
      return;
    }

    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your Technological University of the Philippines - Taguig account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: performLogout
        }
      ]
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refreshUser?.(),
      loadAllStudentData()
    ]);
    setIsRefreshing(false);
  };

  const navigateTo = (route) => {
    if (onNavigate) {
      onNavigate(route.replace('/', ''));
    } else {
      router.push(route);
    }
  };

  const normalizedRole = user?.role === 'super admin' || user?.role === 'super_admin'
    ? 'superadmin'
    : user?.role === 'program_chair'
      ? 'programchair'
    : user?.role === 'faculty' || user?.role === 'instructor'
      ? 'faculty'
      : 'student';

  if (normalizedRole !== 'student') {
    if (normalizedRole === 'superadmin') return <AdminDashboard />;
    if (normalizedRole === 'programchair') return <PcDashboard />;
    return <FacultyDashboard />;
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'S';
  const enrolledSubjects = (subjectsData.subjects || []).filter((s) => s.enrolled);
  const enrolledCount = enrolledSubjects.length || stats?.totals?.enrolledSubjects || 0;
  const availableCount = (subjectsData.subjects || []).length || stats?.totals?.availableSubjects || 0;
  const currentYearLevel = subjectsData.yearLevel || user?.yearLevel || 'Not assigned';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Branding Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons name="school" size={20} color="#2563EB" />
          </View>
          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>TUP - Taguig</Text>
            <Text style={styles.brandSubtitle}>Learning Management System</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={isRefreshing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Refresh dashboard"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color="#64748B" />
          )}
        </TouchableOpacity>
      </View>

      {/* Navigation Header Tabs */}
      <StudentHeader activeRoute="/dashboard" />

      {/* Welcome / Student Hero Profile Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitial}</Text>
          </View>
          <View style={styles.heroInfo}>
            <View style={styles.greetingRow}>
              <Text style={styles.greetingTitle}>Welcome back,</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active Student</Text>
              </View>
            </View>
            <Text style={styles.userName}>{user?.name || 'Student'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.badgeRow}>
            <View style={styles.infoBadge}>
              <Ionicons name="ribbon-outline" size={14} color="#1D4ED8" />
              <Text style={styles.infoBadgeText}>Year: {currentYearLevel}</Text>
            </View>
            {user?.program ? (
              <View style={styles.infoBadge}>
                <Ionicons name="book-outline" size={14} color="#1D4ED8" />
                <Text style={styles.infoBadgeText}>{user.program}</Text>
              </View>
            ) : null}
            <View style={styles.infoBadgeNeutral}>
              <Ionicons name="calendar-outline" size={14} color="#64748B" />
              <Text style={styles.infoBadgeNeutralText}>
                Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'This term'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Metric Stat Cards Grid */}
      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: '#2563EB' }]}
          onPress={() => navigateTo('/subjects')}
          activeOpacity={0.7}
        >
          <View style={[styles.statIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="library" size={20} color="#2563EB" />
          </View>
          <Text style={styles.statNumber}>{enrolledCount}</Text>
          <Text style={styles.statLabel}>Enrolled Subjects</Text>
          <Text style={styles.statSub}>{availableCount} available</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: '#059669' }]}
          onPress={() => navigateTo('/lessons')}
          activeOpacity={0.7}
        >
          <View style={[styles.statIconWrap, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="book" size={20} color="#059669" />
          </View>
          <Text style={styles.statNumber}>{lessons.length}</Text>
          <Text style={styles.statLabel}>Published Lessons</Text>
          <Text style={styles.statSub}>Ready for study</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: '#D97706' }]}
          onPress={() => navigateTo('/exams')}
          activeOpacity={0.7}
        >
          <View style={[styles.statIconWrap, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="document-text" size={20} color="#D97706" />
          </View>
          <Text style={styles.statNumber}>{quizzes.length}</Text>
          <Text style={styles.statLabel}>Available Exams</Text>
          <Text style={styles.statSub}>Quizzes to take</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: '#7C3AED' }]}
          onPress={() => navigateTo('/message')}
          activeOpacity={0.7}
        >
          <View style={[styles.statIconWrap, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="chatbubbles" size={20} color="#7C3AED" />
          </View>
          <Text style={styles.statNumber}>Inbox</Text>
          <Text style={styles.statLabel}>Messages</Text>
          <Text style={styles.statSub}>Chat & support</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Launchpad Shortcuts */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Quick Shortcuts</Text>
      </View>
      <View style={styles.shortcutsRow}>
        <TouchableOpacity
          style={styles.shortcutBtn}
          onPress={() => navigateTo('/subjects')}
        >
          <View style={[styles.shortcutIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="library-outline" size={22} color="#2563EB" />
          </View>
          <Text style={styles.shortcutLabel}>Subjects</Text>
          <Text style={styles.shortcutDesc}>Enroll courses</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shortcutBtn}
          onPress={() => navigateTo('/lessons')}
        >
          <View style={[styles.shortcutIconCircle, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="book-outline" size={22} color="#059669" />
          </View>
          <Text style={styles.shortcutLabel}>Lessons</Text>
          <Text style={styles.shortcutDesc}>Read slides</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shortcutBtn}
          onPress={() => navigateTo('/exams')}
        >
          <View style={[styles.shortcutIconCircle, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="document-text-outline" size={22} color="#D97706" />
          </View>
          <Text style={styles.shortcutLabel}>Exams</Text>
          <Text style={styles.shortcutDesc}>Take quizzes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shortcutBtn}
          onPress={() => navigateTo('/profile')}
        >
          <View style={[styles.shortcutIconCircle, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="person-outline" size={22} color="#7C3AED" />
          </View>
          <Text style={styles.shortcutLabel}>Profile</Text>
          <Text style={styles.shortcutDesc}>My account</Text>
        </TouchableOpacity>
      </View>

      {/* Enrollment by Term Chart */}
      {chartData.length > 0 ? (
        <View style={styles.chartSection}>
          <DashboardBarChart title="Enrollment by Term" data={chartData} />
        </View>
      ) : null}

      {/* My Enrolled Subjects Overview */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>My Enrolled Subjects</Text>
            <Text style={styles.sectionSubtitle}>
              {enrolledSubjects.length} subject{enrolledSubjects.length === 1 ? '' : 's'} enrolled
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigateTo('/subjects')}>
            <Text style={styles.seeAllLink}>View all →</Text>
          </TouchableOpacity>
        </View>

        {isLoadingContent ? (
          <ActivityIndicator style={{ paddingVertical: 20 }} color="#2563EB" />
        ) : enrolledSubjects.length === 0 ? (
          <View style={styles.emptyCallout}>
            <Ionicons name="information-circle-outline" size={32} color="#2563EB" />
            <Text style={styles.emptyCalloutTitle}>No enrolled subjects yet</Text>
            <Text style={styles.emptyCalloutText}>
              Select and enroll in your required subjects for {currentYearLevel} to start accessing lessons and exams.
            </Text>
            <TouchableOpacity
              style={styles.calloutButton}
              onPress={() => navigateTo('/subjects')}
            >
              <Text style={styles.calloutButtonText}>Enroll in Subjects</Text>
            </TouchableOpacity>
          </View>
        ) : (
          enrolledSubjects.slice(0, 4).map((subject) => (
            <View key={subject.id} style={styles.subjectCard}>
              <View style={styles.subjectCardHeader}>
                <View style={styles.subjectCodeBadge}>
                  <Text style={styles.subjectCodeText}>{subject.code}</Text>
                </View>
                <View style={styles.enrolledBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.enrolledBadgeText}>Enrolled</Text>
                </View>
              </View>
              <Text style={styles.subjectDescription} numberOfLines={2}>
                {subject.description}
              </Text>
              <View style={styles.subjectCardFooter}>
                <Text style={styles.subjectTermText}>
                  <Ionicons name="time-outline" size={12} color="#64748B" /> {subject.term}
                </Text>
                <TouchableOpacity
                  onPress={() => navigateTo('/lessons')}
                  style={styles.subjectActionBtn}
                >
                  <Text style={styles.subjectActionText}>Lessons →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Recent Lessons to Study */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Recent Lessons</Text>
            <Text style={styles.sectionSubtitle}>Lecture notes and slides</Text>
          </View>
          <TouchableOpacity onPress={() => navigateTo('/lessons')}>
            <Text style={styles.seeAllLink}>View all →</Text>
          </TouchableOpacity>
        </View>

        {isLoadingContent ? (
          <ActivityIndicator style={{ paddingVertical: 20 }} color="#2563EB" />
        ) : lessons.length === 0 ? (
          <View style={styles.emptyStateSimple}>
            <Text style={styles.emptyStateSimpleText}>
              No lessons have been published for your subjects yet.
            </Text>
          </View>
        ) : (
          lessons.slice(0, 3).map((lesson) => (
            <TouchableOpacity
              key={lesson.id}
              style={styles.lessonCard}
              onPress={() => navigateTo('/lessons')}
              activeOpacity={0.7}
            >
              <View style={styles.lessonIconBox}>
                <Ionicons
                  name={lesson.type === 'file' ? 'document-attach-outline' : 'easel-outline'}
                  size={20}
                  color="#2563EB"
                />
              </View>
              <View style={styles.lessonMeta}>
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                <Text style={styles.lessonSub}>
                  {lesson.type === 'file' ? lesson.fileName : `${lesson.slides?.length || 0} slide(s)`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Available Exams & Quizzes */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Available Quizzes</Text>
            <Text style={styles.sectionSubtitle}>Assess your learning</Text>
          </View>
          <TouchableOpacity onPress={() => navigateTo('/exams')}>
            <Text style={styles.seeAllLink}>View all →</Text>
          </TouchableOpacity>
        </View>

        {isLoadingContent ? (
          <ActivityIndicator style={{ paddingVertical: 20 }} color="#2563EB" />
        ) : quizzes.length === 0 ? (
          <View style={styles.emptyStateSimple}>
            <Text style={styles.emptyStateSimpleText}>
              No quizzes or exams are currently scheduled.
            </Text>
          </View>
        ) : (
          quizzes.slice(0, 3).map((quiz) => {
            const hasTaken = Boolean(quiz.submission);
            return (
              <View key={quiz.id} style={styles.quizCard}>
                <View style={styles.quizInfo}>
                  <View style={styles.quizTitleRow}>
                    <Text style={styles.quizTitle}>{quiz.title}</Text>
                    {hasTaken && (
                      <View style={[styles.quizScorePill, quiz.submission.percentage >= 75 ? styles.scorePillPass : styles.scorePillFail]}>
                        <Text style={[styles.quizScorePillText, quiz.submission.percentage >= 75 ? styles.scorePillTextPass : styles.scorePillTextFail]}>
                          Score: {quiz.submission.score}/{quiz.submission.total}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.quizSub}>
                    {quiz.subjectCode || 'Subject'} · {quiz.questions?.length || 0} questions
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.takeQuizBtn, hasTaken && styles.viewScoreBtn]}
                  onPress={() => navigateTo('/exams')}
                >
                  <Text style={[styles.takeQuizBtnText, hasTaken && styles.viewScoreBtnText]}>
                    {hasTaken ? 'View Score' : 'Take Exam'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      {/* Account Logout Section */}
      <View style={styles.actionsContainer}>
        <AuthButton
          title="Log Out"
          variant="outline"
          onPress={handleLogout}
          loading={isLoggingOut}
          disabled={isLoggingOut}
          style={styles.logoutButton}
          textStyle={styles.logoutButtonText}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 48
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTextContainer: {
    flex: 1
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 14
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800'
  },
  heroInfo: {
    flex: 1
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2
  },
  greetingTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669'
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46'
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B'
  },
  heroFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8'
  },
  infoBadgeNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  infoBadgeNeutralText: {
    fontSize: 12,
    color: '#64748B'
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  statSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },

  // Shortcuts
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB'
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  shortcutIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  shortcutLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A'
  },
  shortcutDesc: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1
  },

  // Chart section
  chartSection: {
    marginBottom: 16
  },

  // Section containers
  sectionContainer: {
    marginBottom: 20
  },

  // Enrolled Subject Cards
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8
  },
  subjectCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  subjectCodeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  subjectCodeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8'
  },
  enrolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  enrolledBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46'
  },
  subjectDescription: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 8
  },
  subjectCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC'
  },
  subjectTermText: {
    fontSize: 12,
    color: '#64748B'
  },
  subjectActionBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6
  },
  subjectActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB'
  },

  // Empty Callout
  emptyCallout: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 8
  },
  emptyCalloutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D4ED8',
    marginTop: 8,
    marginBottom: 4
  },
  emptyCalloutText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12
  },
  calloutButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  calloutButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },

  // Lessons
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8
  },
  lessonIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  lessonMeta: {
    flex: 1
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2
  },
  lessonSub: {
    fontSize: 12,
    color: '#64748B'
  },

  // Quizzes
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8
  },
  quizInfo: {
    flex: 1
  },
  quizTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2
  },
  quizTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  quizScorePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  scorePillPass: {
    backgroundColor: '#ECFDF5'
  },
  scorePillFail: {
    backgroundColor: '#FEF2F2'
  },
  quizScorePillText: {
    fontSize: 11,
    fontWeight: '800'
  },
  scorePillTextPass: {
    color: '#059669'
  },
  scorePillTextFail: {
    color: '#DC2626'
  },
  quizSub: {
    fontSize: 12,
    color: '#64748B'
  },
  takeQuizBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  takeQuizBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8'
  },
  viewScoreBtn: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1'
  },
  viewScoreBtnText: {
    color: '#475569'
  },

  emptyStateSimple: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  emptyStateSimpleText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center'
  },

  // Actions
  actionsContainer: {
    marginTop: 8
  },
  logoutButton: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2'
  },
  logoutButtonText: {
    color: '#DC2626'
  }
});
