import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';

const TOKEN_KEY = '@itproflms_token';
const USER_KEY = '@itproflms_user';

const getExpoDeviceHost = () => {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.hostUri,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.debuggerHost,
    Constants.expoConfig?.debuggerHost,
    Constants.expoGoConfig?.debuggerHost
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;

    const host = candidate.split(':')[0].trim();
    if (!host || host === 'localhost' || host === '127.0.0.1') continue;

    return host;
  }

  return null;
};

const getWebHost = () => {
  if (typeof window === 'undefined' || !window.location) return null;

  const host = window.location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;

  return host;
};

const getBaseUrlSync = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  const webHost = getWebHost();
  if (webHost) {
    return `http://${webHost}:3000`;
  }

  const deviceHost = getExpoDeviceHost();
  if (deviceHost) {
    return `http://${deviceHost}:3000`;
  }

  if (Platform.OS === 'android' && !Constants.isDevice) {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
};

const getBaseUrl = async () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  const webHost = getWebHost();
  if (webHost) {
    return `http://${webHost}:3000`;
  }

  const deviceHost = getExpoDeviceHost();
  if (deviceHost) {
    return `http://${deviceHost}:3000`;
  }

  try {
    const ip = await Network.getIpAddressAsync();
    if (ip && !ip.startsWith('127.')) {
      return `http://${ip}:3000`;
    }
  } catch (error) {
    console.warn('Unable to resolve device IP for API base URL:', error);
  }

  if (Platform.OS === 'android' && !Constants.isDevice) {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
};

export const API_BASE_URL = getBaseUrlSync();

/**
 * Helper to handle fetch responses and parse errors
 */
async function request(endpoint, options = {}) {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = data?.error || `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.message && (err.message.includes('Network request failed') || err.message.includes('Failed to fetch'))) {
      const networkError = new Error(
        `Unable to reach server at ${API_BASE_URL}. Ensure your backend server is running.`
      );
      networkError.isNetworkError = true;
      throw networkError;
    }
    throw err;
  }
}

/**
 * Register a new user
 */
export async function apiRegister({ firstName, middleName, lastName, name, email, password, program, profilePictureBase64 }) {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ firstName, middleName, lastName, name, email, password, program, profilePictureBase64 })
  });

  if (result.token && result.user) {
    await saveAuthData(result.token, result.user);
  }
  return result;
}

/**
 * Log in an existing user
 */
export async function apiLogin({ email, password }) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (result.token && result.user) {
    await saveAuthData(result.token, result.user);
  }
  return result;
}

/**
 * Fetch current authenticated user's profile
 */
export async function apiGetCurrentUser(token) {
  const authToken = token || (await getStoredToken());
  if (!authToken) {
    throw new Error('No authentication token found');
  }

  const result = await request('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  return result.user;
}

export async function apiUpdateProfilePicture(token, profilePicture) {
  const result = await request('/api/auth/me/profile-picture', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ profilePicture })
  });
  return result.profilePicture;
}

export async function apiGetDashboardStats(token) {
  return request('/api/dashboard/stats', {
    headers: { Authorization: 'Bearer ' + token }
  });
}

export async function apiGetChatContacts(token) {
  const result = await request('/api/chat/contacts', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.contacts || [];
}

export async function apiGetChatMessages(token, recipientId) {
  const result = await request(`/api/chat/messages?recipientId=${encodeURIComponent(recipientId)}`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.messages || [];
}

export async function apiSendChatMessage(token, recipientId, text) {
  const result = await request('/api/chat/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ recipientId, text })
  });
  return result.message;
}

export async function apiGetUsers(token) {
  const result = await request('/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  return result.users;
}

export async function apiUpdateUserRole(token, userId, role) {
  const result = await request(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role })
  });
  return result.user;
}

export async function apiUpdateUser(token, userId, user) {
  const result = await request(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(user)
  });
  return result.user;
}

export async function apiDeleteUser(token, userId) {
  return request(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
}

export async function apiUpdateStudentPlacement(token, userId, yearLevel, sectionId) {
  return request(`/api/admin/students/${userId}/placement`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ yearLevel, sectionId })
  });
}

export async function apiUpdateAcademicSettings(token, schoolYear, term) {
  const result = await request('/api/admin/academic/settings', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ schoolYear, term })
  });
  return result.settings;
}

export async function apiGetProgramChairData(token) {
  const headers = { Authorization: 'Bearer ' + token };
  const [subjects, users, sections, assignments] = await Promise.all([
    request('/api/program-chair/subjects', { headers }),
    request('/api/program-chair/users', { headers }),
    request('/api/program-chair/sections', { headers }),
    request('/api/program-chair/assignments', { headers })
  ]);
  return {
    subjects: subjects.subjects,
    users: users.users,
    sections: sections.sections,
    assignments: assignments.assignments
  };
}
export async function apiGetProgramChairStudents(token) {
  const result = await request('/api/program-chair/students', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.students;
}

export async function apiUpdateProgramChairStudentPlacement(token, userId, yearLevel, term, sectionId) {
  return request(`/api/program-chair/students/${userId}/placement`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ yearLevel, term, sectionId })
  });
}

export async function apiCreateSubject(token, subject) {
  const result = await request('/api/program-chair/subjects', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(subject)
  });
  return result.subject;
}

export async function apiUpdateSubject(token, subjectId, subject) {
  const result = await request(`/api/program-chair/subjects/${subjectId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(subject)
  });
  return result.subject;
}

export async function apiDeleteSubject(token, subjectId) {
  return request(`/api/program-chair/subjects/${subjectId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
}

export async function apiEnrollStudent(token, studentId, subjectId) {
  return request('/api/program-chair/enrollments', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ studentId, subjectId })
  });
}

export async function apiGetStudentSubjects(token) {
  return request('/api/student/subjects', {
    headers: { Authorization: 'Bearer ' + token }
  });
}

export async function apiGetTeachingSubjects(token) {
  const result = await request('/api/teaching/subjects', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.subjects;
}

export async function apiGetTeachingSubjectStudents(token, subjectId) {
  const result = await request(`/api/teaching/subjects/${subjectId}/students`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.students;
}

export async function apiGetTeachingLessons(token) {
  const result = await request('/api/teaching/lessons', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.lessons;
}

export async function apiGetTeachingQuizzes(token) {
  const result = await request('/api/teaching/quizzes', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.quizzes;
}

export async function apiCreateQuiz(token, quiz) {
  const result = await request('/api/teaching/quizzes', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(quiz)
  });
  return result.quiz;
}

export async function apiGetQuizSubmissions(token, quizId) {
  const result = await request(`/api/teaching/quizzes/${quizId}/submissions`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.submissions;
}

export async function apiGetStudentLessons(token) {
  const result = await request('/api/student/lessons', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.lessons;
}

export async function apiSetStudentLessonCompletion(token, lessonId, completed) {
  return request(`/api/student/lessons/${lessonId}/completion`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ completed })
  });
}

export async function apiGetStudentQuizzes(token) {
  const result = await request('/api/student/quizzes', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.quizzes;
}

export async function apiSubmitQuiz(token, quizId, answers) {
  const result = await request(`/api/student/quizzes/${quizId}/submit`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ answers })
  });
  return result.result;
}

export async function apiCreateLesson(token, lesson) {
  const result = await request('/api/teaching/lessons', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(lesson)
  });
  return result.lesson;
}

function normalizeUploadFile(file) {
  if (!file) return null;

  const rawUri = file.uri || file.file?.uri || file.copyUri || null;
  if (!rawUri) return null;

  const fileName = file.name || file.file?.name || file.filename || 'lesson.pdf';
  const mimeType = file.type || file.mimeType || file.file?.type || file.file?.mimeType || 'application/pdf';

  return {
    uri: rawUri,
    name: fileName,
    type: mimeType
  };
}

function getSafeLessonFileName(fileName, fallback = 'lesson.pdf') {
  const candidate = (fileName || fallback).split('/').pop();
  return candidate && candidate.trim() ? candidate : fallback;
}

async function readFileAsBase64(fileUri, fileName) {
  if (!fileUri) {
    throw new Error('No readable file URI was provided.');
  }

  const extension = (getSafeLessonFileName(fileName, 'lesson.pdf').split('.').pop() || 'pdf').toLowerCase();
  const cacheName = `lesson-${Date.now()}.${extension}`;
  const cacheUri = `${FileSystem.cacheDirectory}${cacheName}`;

  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      throw new Error('Selected file is not available on this device.');
    }

    await FileSystem.copyAsync({
      from: fileUri,
      to: cacheUri
    });

    return await FileSystem.readAsStringAsync(cacheUri, {
      encoding: FileSystem.EncodingType.Base64
    });
  } catch (_cacheError) {
    try {
      return await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64
      });
    } catch (_readError) {
      const response = await fetch(fileUri);
      const arrayBuffer = await response.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return `data:${response.headers.get('content-type') || 'application/octet-stream'};base64,${btoa(binary)}`.replace(/^data:.*;base64,/, '');
    }
  }
}

async function uploadLessonPayload(token, endpoint, payload) {
  const result = await request(endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  return result.lesson;
}

export async function apiUploadLesson(token, { subjectId, title, description, file }) {
  const normalizedFile = normalizeUploadFile(file);
  if (!normalizedFile || !normalizedFile.uri) {
    return apiCreateLesson(token, { subjectId, title, description, slides: [] });
  }

  const base64 = await readFileAsBase64(normalizedFile.uri, normalizedFile.name);

  return uploadLessonPayload(token, '/api/teaching/lessons/upload-base64', {
    subjectId,
    title,
    description: description || '',
    fileName: getSafeLessonFileName(normalizedFile.name, 'lesson.pdf'),
    mimeType: normalizedFile.type || normalizedFile.mimeType || 'application/pdf',
    base64
  });
}

export async function apiUpdateLesson(token, lessonId, lesson) {
  const result = await request(`/api/teaching/lessons/${lessonId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(lesson)
  });
  return result.lesson;
}

export async function apiReplaceLessonFile(token, lessonId, file) {
  const normalizedFile = normalizeUploadFile(file);
  if (!normalizedFile || !normalizedFile.uri) {
    return apiUpdateLesson(token, lessonId, { title: '', description: '' });
  }

  const base64 = await readFileAsBase64(normalizedFile.uri, normalizedFile.name);

  const result = await request(`/api/teaching/lessons/${lessonId}/upload-base64`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      fileName: getSafeLessonFileName(normalizedFile.name, 'lesson.pdf'),
      mimeType: normalizedFile.type || normalizedFile.mimeType || 'application/pdf',
      base64
    })
  });
  return result.lesson;
}

export async function apiDeleteLesson(token, lessonId) {
  return request(`/api/teaching/lessons/${lessonId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
}

export async function apiEnrollSubject(token, subjectId, term) {
  return request('/api/student/enrollments', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ subjectId, term })
  });
}

export async function apiAssignSubject(token, facultyId, subjectId, sectionId) {
  return request('/api/program-chair/assignments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ facultyId, subjectId, sectionId })
  });
}

export async function apiUpdateAssignment(token, assignmentId, facultyId) {
  return request(`/api/program-chair/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ facultyId })
  });
}

export async function apiDeleteAssignment(token, assignmentId) {
  return request(`/api/program-chair/assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
}

export async function apiGetAcademicStructure(token) {
  const result = await request('/api/admin/academic', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return result;
}

export async function apiGetPrograms() {
  const result = await request('/api/programs');
  return result.programs || [];
}

export async function apiCreateProgram(token, name) {
  const result = await request('/api/admin/academic/programs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name })
  });
  return result.program;
}

export async function apiUpdateProgram(token, programId, name) {
  const result = await request(`/api/admin/academic/programs/${programId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ name })
  });
  return result.program;
}

export async function apiDeleteProgram(token, programId) {
  return request(`/api/admin/academic/programs/${programId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
}

export async function apiCreateSection(token, name, yearLevel, programId) {
  const result = await request('/api/admin/academic/sections', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, yearLevel, programId })
  });
  return result.section;
}

export async function apiUpdateAdminSection(token, sectionId, section) {
  const result = await request(`/api/admin/academic/sections/${sectionId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(section)
  });
  return result.section;
}

export async function apiDeleteAdminSection(token, sectionId) {
  return request(`/api/admin/academic/sections/${sectionId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
}

/** Program chair Ã¢â‚¬â€ fetch programs and sections they manage */
export async function apiGetProgramChairAcademic(token) {
  const result = await request('/api/program-chair/academic', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return result; // { programs, sections }
}

/** Program chair Ã¢â‚¬â€ create a new section under a program */
export async function apiPcCreateSection(token, name, yearLevel, programId) {
  const result = await request('/api/program-chair/sections', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, yearLevel, programId })
  });
  return result.section;
}

/**
 * Storage helpers
 */
export async function saveAuthData(token, user) {
  try {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(user)]
    ]);
  } catch (err) {
    console.error('Failed to store auth data in storage:', err);
  }
}

export async function getStoredAuthData() {
  try {
    const values = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
    const token = values[0][1];
    const userJson = values[1][1];
    const user = userJson ? JSON.parse(userJson) : null;
    return { token, user };
  } catch (err) {
    console.error('Failed to get auth data from storage:', err);
    return { token: null, user: null };
  }
}

export async function getStoredToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearAuthData() {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  } catch (err) {
    console.error('Failed to clear auth data from storage:', err);
  }
}
