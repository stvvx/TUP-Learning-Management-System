import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = '@itproflms_token';
const USER_KEY = '@itproflms_user';

// Determine the default base URL based on platform
const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    // If running in Android emulator and URL is localhost, replace with 10.0.2.2
    if (Platform.OS === 'android' && envUrl.includes('localhost')) {
      return envUrl.replace('localhost', '10.0.2.2');
    }
    return envUrl.trim();
  }
  // Default fallbacks
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
};

export const API_BASE_URL = getBaseUrl();

/**
 * Helper to handle fetch responses and parse errors
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
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
export async function apiRegister({ name, email, password, program, profilePictureBase64 }) {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, program, profilePictureBase64 })
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

export async function apiGetDashboardStats(token) {
  return request('/api/dashboard/stats', {
    headers: { Authorization: 'Bearer ' + token }
  });
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

export async function apiUpdateStudentPlacement(token, userId, yearLevel, sectionId) {
  return request(`/api/admin/students/${userId}/placement`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ yearLevel, sectionId })
  });
}

export async function apiGetProgramChairData(token) {
  const headers = { Authorization: 'Bearer ' + token };
  const [subjects, users, sections] = await Promise.all([
    request('/api/program-chair/subjects', { headers }),
    request('/api/program-chair/users', { headers }),
    request('/api/program-chair/sections', { headers })
  ]);
  return { subjects: subjects.subjects, users: users.users, sections: sections.sections };
}
export async function apiGetProgramChairStudents(token) {
  const result = await request('/api/program-chair/students', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.students;
}

export async function apiUpdateProgramChairStudentPlacement(token, userId, yearLevel, sectionId) {
  return request(`/api/program-chair/students/${userId}/placement`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ yearLevel, sectionId })
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

export async function apiGetTeachingLessons(token) {
  const result = await request('/api/teaching/lessons', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.lessons;
}

export async function apiGetStudentLessons(token) {
  const result = await request('/api/student/lessons', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return result.lessons;
}

export async function apiCreateLesson(token, lesson) {
  const result = await request('/api/teaching/lessons', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(lesson)
  });
  return result.lesson;
}

export async function apiUploadLesson(token, { subjectId, title, description, file }) {
  const formData = new FormData();
  formData.append('subjectId', subjectId);
  formData.append('title', title);
  formData.append('description', description || '');
  formData.append('file', file);
  const result = await request('/api/teaching/lessons/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: formData
  });
  return result.lesson;
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
  const formData = new FormData();
  formData.append('file', file);
  const result = await request(`/api/teaching/lessons/${lessonId}/upload`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: formData
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

export async function apiCreateSection(token, name, yearLevel, programId) {
  const result = await request('/api/admin/academic/sections', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, yearLevel, programId })
  });
  return result.section;
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
