import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const ITEMS = {
  superadmin: [
    { label: 'Home', icon: 'home-outline', route: '/dashboard' },
    { label: 'Users', icon: 'people-outline', route: '/users' },
    { label: 'Programs', icon: 'library-outline', route: '/academic' }
  ],
  faculty: [
    { label: 'Home', icon: 'home-outline', route: '/dashboard' },
    { label: 'Message', icon: 'chatbubble-ellipses-outline', route: '/message' },
    { label: 'Subjects', icon: 'library-outline', route: '/subjects' },
    { label: 'Lessons', icon: 'book-outline', route: '/lessons' },
    { label: 'Exams', icon: 'document-text-outline', route: '/exams' },
    { label: 'Grades', icon: 'school-outline', route: '/grades' }
  ],
  programchair: [
    { label: 'Home', icon: 'home-outline', route: '/dashboard' },
    { label: 'Message', icon: 'chatbubble-ellipses-outline', route: '/message' },
    { label: 'Sections', icon: 'layers-outline', route: '/pc-courses' },
    { label: 'Students', icon: 'people-outline', route: '/pc-students' },
    { label: 'Subjects', icon: 'library-outline', route: '/subjects' },
    { label: 'Assignments', icon: 'person-add-outline', route: '/assignments' },
    { label: 'Lessons', icon: 'book-outline', route: '/lessons' },
    { label: 'Exams', icon: 'document-text-outline', route: '/exams' },
    { label: 'Grades', icon: 'school-outline', route: '/grades' }
  ]
};

export default function StaffHeader({ role, activeRoute }) {
  const router = useRouter();
  const items = ITEMS[role] || ITEMS.faculty;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {items.map((item) => {
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
  scroll: { marginBottom: 20 },
  container: { gap: 10 },
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
  itemActive: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  text: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  textActive: { color: '#1D4ED8', fontWeight: '700' }
});
