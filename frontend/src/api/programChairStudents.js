import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Network from 'expo-network';

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

const getBaseUrl = async () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
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

async function request(token, endpoint, options = {}) {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export async function apiGetProgramChairStudents(token) {
  const result = await request(token, '/api/program-chair/students');
  return Array.isArray(result?.students) ? result.students : [];
}

export async function apiUpdateProgramChairStudentPlacement(token, userId, yearLevel, term, sectionId) {
  return request(token, `/api/program-chair/students/${userId}/placement`, {
    method: 'PATCH',
    body: JSON.stringify({ yearLevel, term, sectionId })
  });
}
