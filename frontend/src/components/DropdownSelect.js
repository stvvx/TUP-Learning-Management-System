import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * DropdownSelect – a styled dropdown that matches AuthInput visuals.
 *
 * Props:
 *   label       – field label string
 *   icon        – Ionicons icon name (optional)
 *   placeholder – placeholder text when nothing is selected
 *   options     – array of { label, value } objects
 *   value       – currently selected value (or null)
 *   onSelect    – callback(value) when an option is chosen
 *   error       – error string (optional)
 *   containerStyle – optional style override
 */
export default function DropdownSelect({
  label,
  icon,
  placeholder = 'Select an option',
  options = [],
  value,
  onSelect,
  error,
  containerStyle
}) {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setModalVisible(true)}
        style={[
          styles.inputContainer,
          error ? styles.inputError : null,
          modalVisible && styles.inputFocused
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={error ? '#EF4444' : modalVisible ? '#2563EB' : '#94A3B8'}
            style={styles.icon}
          />
        )}

        <Text
          style={[styles.valueText, !selectedOption && styles.placeholderText]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>

        <Ionicons
          name={modalVisible ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#94A3B8"
        />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.sheet}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {label && <Text style={styles.sheetTitle}>{label}</Text>}

            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[styles.option, isSelected && styles.optionSelected]}
                    activeOpacity={0.7}
                    onPress={() => {
                      onSelect(item.value);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
    marginBottom: 6,
    letterSpacing: 0.2
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52
  },
  inputFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2'
  },
  icon: {
    marginRight: 10
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A'
  },
  placeholderText: {
    color: '#94A3B8'
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4
  },
  optionSelected: {
    backgroundColor: '#EFF6FF'
  },
  optionText: {
    fontSize: 15,
    color: '#334155'
  },
  optionTextSelected: {
    color: '#2563EB',
    fontWeight: '600'
  }
});
