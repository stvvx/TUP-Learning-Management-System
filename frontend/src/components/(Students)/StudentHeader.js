import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// TUP palette, same as the other screens.
const COLORS = {
  brand: '#7B1113',
  brandDeep: '#4A0A0C',
  gold: '#F2B705',
  surface: '#FFFFFF',
  ink: '#1F1416',
  muted: '#6E6165'
};

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
            activeOpacity={0.8}
            style={[styles.item, isActive && styles.itemActive]}
          >
            <Ionicons
              name={item.icon}
              size={18}
              color={isActive ? COLORS.gold : COLORS.ink}
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
    marginBottom: 20,
    // room so the thick bottom border isn't clipped
    paddingBottom: 2
  },
  container: {
    gap: 10,
    paddingRight: 4
  },
  item: {
    minWidth: 92,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderBottomWidth: 4
  },
  itemActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.ink
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink
  },
  textActive: {
    color: COLORS.surface,
    fontWeight: '800'
  }
});