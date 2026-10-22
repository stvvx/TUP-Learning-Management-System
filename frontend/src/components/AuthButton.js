import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function AuthButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // 'primary' | 'outline' | 'ghost'
  style,
  textStyle
}) {
  const isActionDisabled = disabled || loading;

  const getContainerStyle = () => {
    switch (variant) {
      case 'outline':
        return styles.outlineButton;
      case 'ghost':
        return styles.ghostButton;
      case 'primary':
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
        return styles.outlineText;
      case 'ghost':
        return styles.ghostText;
      case 'primary':
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isActionDisabled}
      style={[
        styles.baseButton,
        getContainerStyle(),
        isActionDisabled && styles.disabledButton,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : '#2563EB'}
        />
      ) : (
        <Text style={[styles.baseText, getTextStyle(), textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
    marginVertical: 6
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3
  },
  outlineButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  ghostButton: {
    backgroundColor: 'transparent'
  },
  disabledButton: {
    opacity: 0.6
  },
  baseText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  primaryText: {
    color: '#FFFFFF'
  },
  outlineText: {
    color: '#334155'
  },
  ghostText: {
    color: '#2563EB'
  }
});
