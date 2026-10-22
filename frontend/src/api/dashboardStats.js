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

export async function apiGetDashboardStats(token) {
  const response = await fetch(`${getBaseUrl()}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch dashboard statistics.');
  }
  return data;
}
