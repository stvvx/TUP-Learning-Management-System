import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import StaffHeader from '../../components/StaffHeader';
import { apiGetQuizSubmissions, apiGetTeachingQuizzes } from '../../api/client';

const COLORS = {
  brand: '#7B1113',
  brandDeep: '#4A0A0C',
  brandSoft: '#F6E4E4',
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
  dangerSoft: '#FEF3F2'
};

const getPercentage = (submission) => {
  if (typeof submission.percentage === 'number') return submission.percentage;
  if (!submission.total) return 0;
  return (submission.score / submission.total) * 100;
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export default function GradesScreen() {
  const { user, token, isLoading } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [submissionsByQuiz, setSubmissionsByQuiz] = useState({});
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const role = user?.role === 'program_chair' ? 'programchair' : 'faculty';

  const loadGrades = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const teachingQuizzes = await apiGetTeachingQuizzes(token);
      setQuizzes(teachingQuizzes);
      const entries = await Promise.all(teachingQuizzes.map(async (quiz) => {
        const submissions = await apiGetQuizSubmissions(token, quiz.id);
        return [quiz.id, submissions || []];
      }));
      setSubmissionsByQuiz(Object.fromEntries(entries));
    } catch (loadError) {
      setError(loadError.message || 'Failed to load student grades.');
    } finally {
      setIsLoadingGrades(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(loadGrades, 0);
    return () => clearTimeout(timer);
  }, [loadGrades]);

  const { students, classAverage, submissionCount } = useMemo(() => {
    const studentsById = new Map();
    let totalPercentage = 0;
    let count = 0;

    quizzes.forEach((quiz) => {
      (submissionsByQuiz[quiz.id] || []).forEach((submission) => {
        const studentId = submission.studentId || submission.studentName;
        if (!studentsById.has(studentId)) {
          studentsById.set(studentId, {
            id: studentId,
            name: submission.studentName || 'Unknown student',
            firstName: submission.firstName || '',
            middleName: submission.middleName || '',
            lastName: submission.lastName || '',
            grades: {}
          });
        }
        const percentage = getPercentage(submission);
        studentsById.get(studentId).grades[quiz.id] = { ...submission, percentage };
        totalPercentage += percentage;
        count += 1;
      });
    });

    const sortedStudents = [...studentsById.values()]
      .map((student) => {
        const grades = Object.values(student.grades);
        const average = grades.length
          ? grades.reduce((sum, grade) => sum + grade.percentage, 0) / grades.length
          : null;
        return { ...student, average };
      })
      .sort((a, b) =>
        a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' }) ||
        a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }) ||
        a.middleName.localeCompare(b.middleName, undefined, { sensitivity: 'base' })
      );

    return {
      students: sortedStudents,
      classAverage: count ? totalPercentage / count : null,
      submissionCount: count
    };
  }, [quizzes, submissionsByQuiz]);

  const getExportRows = () => students.map((student) => ({
    'Last Name': student.lastName,
    'First Name': student.firstName,
    'Middle Name': student.middleName,
    ...Object.fromEntries(quizzes.map((quiz) => {
      const grade = student.grades[quiz.id];
      return [quiz.title, grade ? `${grade.score}/${grade.total} (${Math.round(grade.percentage)}%)` : '—'];
    })),
    'Average (%)': student.average === null ? '' : Math.round(student.average)
  }));

  const showExportError = (exportError) => {
    if (Platform.OS === 'web') {
      window.alert(exportError.message || 'Could not export grades. Please try again.');
    } else {
      Alert.alert('Export failed', exportError.message || 'Could not export grades. Please try again.');
    }
  };

  const exportExcel = async () => {
    if (exporting) return;
    setExporting('excel');
    try {
      const rows = getExportRows();
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{
        'Last Name': '', 'First Name': '', 'Middle Name': '', 'Average (%)': ''
      }]);
      worksheet['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 20 },
        ...quizzes.map(() => ({ wch: 24 })),
        { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Grades');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['Class Average (%)', classAverage === null ? '' : Math.round(classAverage)],
        ['Students with submissions', students.length],
        ['Total submissions', submissionCount]
      ]), 'Summary');

      const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      const filename = 'TUP-Student-Grades.xlsx';
      if (Platform.OS === 'web') {
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: 'base64' });
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('File sharing is not available on this device.');
        }
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Download student grades'
        });
      }
    } catch (exportError) {
      showExportError(exportError);
    } finally {
      setExporting('');
    }
  };

  const exportPdf = async () => {
    if (exporting) return;
    setExporting('pdf');
    try {
      const quizHeaders = quizzes.map((quiz) => `<th>${escapeHtml(quiz.title)}</th>`).join('');
      const rows = students.map((student) => `
        <tr>
          <td>${escapeHtml(student.lastName || '—')}</td>
          <td>${escapeHtml(student.firstName || '—')}</td>
          <td>${escapeHtml(student.middleName || '—')}</td>
          ${quizzes.map((quiz) => {
            const grade = student.grades[quiz.id];
            return `<td>${grade ? `${grade.score}/${grade.total} (${Math.round(grade.percentage)}%)` : '—'}</td>`;
          }).join('')}
          <td><strong>${student.average === null ? '—' : `${Math.round(student.average)}%`}</strong></td>
        </tr>`).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
        <title>Student Grades</title>
        <style>
          @page { size: A4 landscape; margin: 18mm 12mm; }
          body { font-family: Arial, sans-serif; color: #1F1416; font-size: 10px; }
          h1 { color: #7B1113; margin-bottom: 4px; font-size: 20px; }
          .summary { color: #6E6165; margin: 0 0 18px; }
          table { border-collapse: collapse; width: 100%; }
          th { background: #FFF1BF; color: #4A0A0C; text-align: left; }
          th, td { border: 1px solid #E8E2E4; padding: 7px 6px; }
          tr:nth-child(even) { background: #FFFCF6; }
        </style></head><body>
        <h1>Student Grades</h1>
        <p class="summary">Class average: ${classAverage === null ? '—' : `${Math.round(classAverage)}%`} · ${students.length} student(s) · ${submissionCount} submission(s)</p>
        <table><thead><tr><th>Last Name</th><th>First Name</th><th>Middle Name</th>${quizHeaders}<th>Average</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="${quizzes.length + 4}">No quiz submissions yet.</td></tr>`}</tbody></table>
        </body></html>`;

      if (Platform.OS === 'web') {
        // expo-print on web prints the whole app page, so print only the table
        // from a hidden iframe instead.
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        document.body.appendChild(frame);
        const frameWindow = frame.contentWindow;
        frameWindow.document.open();
        frameWindow.document.write(html);
        frameWindow.document.close();
        frameWindow.onafterprint = () => frame.remove();
        setTimeout(() => {
          frameWindow.focus();
          frameWindow.print();
        }, 300);
        return;
      }

      const result = await Print.printToFileAsync({ html, width: 842, height: 595 });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('File sharing is not available on this device.');
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        UTI: '.pdf',
        dialogTitle: 'Download student grades as PDF'
      });
    } catch (exportError) {
      showExportError(exportError);
    } finally {
      setExporting('');
    }
  };

  if (isLoading || !user) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <View style={styles.headerIcon}>
          <Ionicons name="school" size={22} color={COLORS.brandDeep} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Grades</Text>
          <Text style={styles.subtitle}>Student quiz scores and class averages</Text>
        </View>
        {!isLoadingGrades ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{students.length}</Text>
          </View>
        ) : null}
      </View>

      <StaffHeader role={role} activeRoute="/grades" />

      {error ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Class average</Text>
          <Text style={styles.summaryValue}>
            {classAverage === null ? '—' : `${Math.round(classAverage)}%`}
          </Text>
          <Text style={styles.summaryHint}>Across submitted quiz scores</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Students</Text>
          <Text style={styles.summaryValue}>{students.length}</Text>
          <Text style={styles.summaryHint}>With at least one submission</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Submissions</Text>
          <Text style={styles.summaryValue}>{submissionCount}</Text>
          <Text style={styles.summaryHint}>Quiz attempts received</Text>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Student scores</Text>
      </View>

      <View style={styles.exportActions}>
        <TouchableOpacity
          style={[styles.exportButton, styles.pdfButton]}
          onPress={exportPdf}
          disabled={Boolean(exporting) || isLoadingGrades}
          accessibilityRole="button"
        >
          {exporting === 'pdf' ? <ActivityIndicator size="small" color={COLORS.surface} /> : <Ionicons name="document-text-outline" size={17} color={COLORS.surface} />}
          <Text style={styles.exportButtonText}>{exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exportButton, styles.excelButton]}
          onPress={exportExcel}
          disabled={Boolean(exporting) || isLoadingGrades}
          accessibilityRole="button"
        >
          {exporting === 'excel' ? <ActivityIndicator size="small" color={COLORS.surface} /> : <Ionicons name="grid-outline" size={17} color={COLORS.surface} />}
          <Text style={styles.exportButtonText}>{exporting === 'excel' ? 'Preparing Excel…' : 'Download Excel'}</Text>
        </TouchableOpacity>
      </View>

      {isLoadingGrades ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={COLORS.brand} />
          <Text style={styles.loadingText}>Loading scores…</Text>
        </View>
      ) : quizzes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={30} color={COLORS.faint} />
          <Text style={styles.emptyTitle}>No quizzes yet</Text>
          <Text style={styles.emptyText}>Quiz scores will appear here after quizzes are created.</Text>
        </View>
      ) : students.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={30} color={COLORS.faint} />
          <Text style={styles.emptyTitle}>No submissions yet</Text>
          <Text style={styles.emptyText}>Student scores will appear here when quizzes are submitted.</Text>
        </View>
      ) : (
        <View style={styles.tableFrame}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.nameColumn]}>Last Name</Text>
                <Text style={[styles.headerCell, styles.nameColumn]}>First Name</Text>
                <Text style={[styles.headerCell, styles.nameColumn]}>Middle Name</Text>
                {quizzes.map((quiz) => (
                  <Text key={quiz.id} style={[styles.headerCell, styles.quizColumn]} numberOfLines={2}>
                    {quiz.title}
                  </Text>
                ))}
                <Text style={[styles.headerCell, styles.averageColumn]}>Average</Text>
              </View>
              {students.map((student, rowIndex) => (
                <View
                  key={student.id}
                  style={[styles.tableRow, rowIndex % 2 === 1 && styles.tableRowAlternate]}
                >
                  <Text style={[styles.studentNameCell, styles.nameColumn]} numberOfLines={2}>
                    {student.lastName || '—'}
                  </Text>
                  <Text style={[styles.studentNameCell, styles.nameColumn]} numberOfLines={2}>
                    {student.firstName || '—'}
                  </Text>
                  <Text style={[styles.studentNameCell, styles.nameColumn]} numberOfLines={2}>
                    {student.middleName || '—'}
                  </Text>
                  {quizzes.map((quiz) => {
                    const grade = student.grades[quiz.id];
                    return (
                      <View key={quiz.id} style={[styles.scoreCell, styles.quizColumn]}>
                        {grade ? (
                          <>
                            <Text style={styles.rawScore}>{grade.score}/{grade.total}</Text>
                            <Text style={[
                              styles.percentage,
                              grade.percentage >= 75 ? styles.passing : styles.needsWork
                            ]}>
                              {Math.round(grade.percentage)}%
                            </Text>
                          </>
                        ) : <Text style={styles.noScore}>—</Text>}
                      </View>
                    );
                  })}
                  <View style={[styles.scoreCell, styles.averageColumn]}>
                    <Text style={styles.averageCellText}>
                      {student.average === null ? '—' : `${Math.round(student.average)}%`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, paddingTop: 48, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerCopy: { flex: 1 },
  title: { color: COLORS.brand, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
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
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    minWidth: 145,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    padding: 14
  },
  summaryLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  summaryValue: { marginTop: 5, color: COLORS.brand, fontSize: 25, fontWeight: '900' },
  summaryHint: { marginTop: 3, color: COLORS.faint, fontSize: 11 },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '900' },
  exportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  exportButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.brandDeep
  },
  pdfButton: { backgroundColor: COLORS.brand },
  excelButton: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  exportButtonText: { color: COLORS.surface, fontSize: 12, fontWeight: '800' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDCA',
    backgroundColor: COLORS.dangerSoft
  },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 13 },
  loadingState: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 30 },
  loadingText: { color: COLORS.muted, fontSize: 13 },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    padding: 28,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface
  },
  emptyTitle: { marginTop: 4, color: COLORS.ink, fontSize: 16, fontWeight: '800' },
  emptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  tableFrame: { overflow: 'hidden', borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.line, backgroundColor: COLORS.surface },
  tableHeader: { flexDirection: 'row', minHeight: 50, alignItems: 'center', backgroundColor: COLORS.goldSoft, borderBottomWidth: 1.5, borderBottomColor: COLORS.line },
  headerCell: { paddingHorizontal: 12, paddingVertical: 10, color: COLORS.brandDeep, fontSize: 12, fontWeight: '900' },
  nameColumn: { width: 150 },
  quizColumn: { width: 150, textAlign: 'center' },
  averageColumn: { width: 110, textAlign: 'center' },
  tableRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.line },
  tableRowAlternate: { backgroundColor: '#FFFCF6' },
  studentNameCell: { paddingHorizontal: 12, color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  scoreCell: { minHeight: 62, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  rawScore: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  percentage: { marginTop: 2, fontSize: 11, fontWeight: '800' },
  passing: { color: COLORS.success },
  needsWork: { color: COLORS.danger },
  noScore: { color: COLORS.faint, fontSize: 16 },
  averageCellText: { color: COLORS.brand, fontSize: 14, fontWeight: '900' }
});