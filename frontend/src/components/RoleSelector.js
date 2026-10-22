import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ROLES = [
  {
    id: 'student',
    title: 'Student',
    subtitle: 'Learn & submit tasks',
    icon: 'school-outline'
  },
  {
    id: 'instructor',
    title: 'Instructor',
    subtitle: 'Teach & manage LMS',
    icon: 'briefcase-outline'
  }
];

export default function RoleSelector({ selectedRole, onSelectRole }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select Role</Text>
      <View style={styles.rolesRow}>
        {ROLES.map((role) => {
          const isSelected = selectedRole === role.id;
          return (
            <TouchableOpacity
              key={role.id}
              activeOpacity={0.8}
              onPress={() => onSelectRole(role.id)}
              style={[
                styles.roleCard,
                isSelected && styles.roleCardSelected
              ]}
            >
              <View style={[styles.iconWrapper, isSelected && styles.iconWrapperSelected]}>
                <Ionicons
                  name={role.icon}
                  size={20}
                  color={isSelected ? '#2563EB' : '#64748B'}
                />
              </View>
              <View style={styles.textWrapper}>
                <Text style={[styles.roleTitle, isSelected && styles.roleTitleSelected]}>
                  {role.title}
                </Text>
                <Text style={styles.roleSubtitle}>{role.subtitle}</Text>
              </View>
              {isSelected && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#2563EB"
                  style={styles.checkIcon}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%'
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    letterSpacing: 0.2
  },
  rolesRow: {
    flexDirection: 'row',
    gap: 10
  },
  roleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    position: 'relative'
  },
  roleCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF'
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  iconWrapperSelected: {
    backgroundColor: '#DBEAFE'
  },
  textWrapper: {
    flex: 1
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  roleTitleSelected: {
    color: '#1D4ED8'
  },
  roleSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1
  },
  checkIcon: {
    position: 'absolute',
    top: 6,
    right: 6
  }
});
