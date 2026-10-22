import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const ITEMS = [
  { label: 'Home', icon: 'home-outline', route: '/dashboard' },
  { label: 'Profile', icon: 'person-outline', route: '/profile' },
  { label: 'Message', icon: 'chatbubble-ellipses-outline', route: '/message' },
  { label: 'Subjects', icon: 'library-outline', route: '/subjects' },
  { label: 'Lessons', icon: 'book-outline', route: '/lessons' },
  { label: 'Exams', icon: 'document-text-outline', route: '/exams' }
];

export default function StudentHeader({ activeRoute }) {
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {ITEMS.map((item) => {
        const isActive = activeRoute === item.route;
        return (
          <TouchableOpacity
            key={item.route}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => router.push(item.route)}
            style={[styles.item, isActive && styles.itemActive]}
          >
            <Ionicons
              name={item.icon}
              size={18}
              color={isActive ? '#2563EB' : '#64748B'}
            />
            <Text style={[styles.text, isActive && styles.textActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: 20
  },
  container: {
    gap: 10
  },
  item: {
    minWidth: 86,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  itemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD'
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  textActive: {
    color: '#1D4ED8',
    fontWeight: '700'
  }
});
