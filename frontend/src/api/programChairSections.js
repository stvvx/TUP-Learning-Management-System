import { Platform } from 'react-native';

const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
    return Platform.OS === 'android' && envUrl.includes('localhost')
      ? envUrl.replace('localhost', '10.0.2.2')
      : envUrl.trim();
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
};

async function request(token, endpoint, options = {}) {
  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export async function apiUpdateProgramChairSection(token, sectionId, section) {
  const result = await request(token, `/api/program-chair/sections/${sectionId}`, {
    method: 'PATCH',
    body: JSON.stringify(section)
  });
  return result.section;
}

export async function apiDeleteProgramChairSection(token, sectionId) {
  return request(token, `/api/program-chair/sections/${sectionId}`, { method: 'DELETE' });
}
