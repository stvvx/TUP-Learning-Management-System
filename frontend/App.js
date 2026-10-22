import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/app/login';
import RegisterScreen from './src/app/register';
import DashboardScreen from './src/app/studentDashboard';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('login');

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoCircle}>
          <Ionicons name="school" size={44} color="#2563EB" />
        </View>
        <Text style={styles.appName}>Technological University of the Philippines - Taguig</Text>
        <Text style={styles.tagline}>Learning Management System</Text>
        <ActivityIndicator size="large" color="#2563EB" style={styles.loader} />
      </View>
    );
  }

  // If user is authenticated, show Dashboard
  if (user) {
    return <DashboardScreen onNavigate={(screen) => setCurrentScreen(screen)} />;
  }

  // Unauthenticated screens
  if (currentScreen === 'register') {
    return <RegisterScreen onNavigate={(screen) => setCurrentScreen(screen)} />;
  }

  return <LoginScreen onNavigate={(screen) => setCurrentScreen(screen)} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#DBEAFE'
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5
  },
  tagline: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4
  },
  loader: {
    marginTop: 32
  }
});
