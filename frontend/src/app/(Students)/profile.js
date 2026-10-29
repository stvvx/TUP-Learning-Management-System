import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { apiUpdateProfilePicture } from '../../api/client';
import StudentHeader from '../../components/(Students)/StudentHeader';

// TUP palette, same as the other screens. Consider moving this to a shared theme file.
const COLORS = {
  brand: '#7B1113',
  brandDeep: '#4A0A0C',
  brandSoft: '#F6E4E4',
  brandLine: '#EBC9A0',
  gold: '#F2B705',
  goldSoft: '#FFF1BF',
  paper: '#FFF9EE',
  surface: '#FFFFFF',
  ink: '#1F1416',
  muted: '#6E6165',
  line: '#E8E2E4',
  success: '#1F7A4D'
};

// "program_chair" -> "Program Chair"
const formatRole = (role) =>
  role
    ? role
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';

function InfoRow({ icon, label, value, isLast }) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={COLORS.brand} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} selectable>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, token, isLoading, refreshUser } = useAuth();

  const [photo, setPhoto] = useState(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const yearSection = user?.yearSection || ''; // set by admin, read-only here

  const storeKey = `profile:${user?.id || user?._id || user?.email || 'me'}`;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, router, user]);

  // Load saved photo + year/section (local storage fallback).
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem(storeKey)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : {};
        setPhoto(user.profilePicture || saved.photo || user.photoUrl || null);
      })
      .catch(() => {});
  }, [user, storeKey]);

  const persist = (next) => {
    const data = { photo, ...next };
    AsyncStorage.setItem(storeKey, JSON.stringify(data)).catch(() => {});
  };

  const pickPhoto = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to change your profile picture.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // lets the user crop on phone
      aspect: [1, 1], // square crop -> fits the circle
      quality: 0.4, // small file
      base64: true
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Photo unavailable', 'Could not prepare this image for upload. Please choose another photo.');
      return;
    }

    const mimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
      ? asset.mimeType
      : 'image/jpeg';
    const imageData = `data:${mimeType};base64,${asset.base64}`;

    setIsSavingPhoto(true);
    try {
      const savedPhoto = await apiUpdateProfilePicture(token, imageData);
      setPhoto(savedPhoto);
      persist({ photo: savedPhoto });
      await refreshUser();
    } catch (error) {
      Alert.alert('Could not save photo', error.message || 'Please try again.');
    } finally {
      setIsSavingPhoto(false);
    }
  };

  if (isLoading || !user) {
    return null;
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?';
  const roleLabel = formatRole(user?.role);

  const rows = [
    { icon: 'person-outline', label: 'Name', value: user?.name || '—' },
    { icon: 'people-outline', label: 'Year & Section', value: yearSection || '—' },
    { icon: 'mail-outline', label: 'Email', value: user?.email || '—' },
    { icon: 'shield-checkmark-outline', label: 'Role', value: roleLabel },
    user?.program
      ? { icon: 'school-outline', label: 'Program', value: user.program }
      : null,
    user?.yearLevel
      ? { icon: 'ribbon-outline', label: 'Year level', value: user.yearLevel }
      : null,
    user?.createdAt
      ? {
          icon: 'calendar-outline',
          label: 'Joined',
          value: new Date(user.createdAt).toLocaleDateString()
        }
      : null
  ].filter(Boolean);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderIcon}>
          <Ionicons name="person" size={22} color={COLORS.brand} />
        </View>
        <View style={styles.pageHeaderText}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.pageSubtitle}>Your account details</Text>
        </View>
      </View>

      <StudentHeader activeRoute="/profile" />

      {/* Hero card with hard offset shadow */}
      <View style={styles.heroWrap}>
        <View style={styles.heroShadow} />
        <View style={styles.heroCard}>
          <Ionicons name="settings" size={170} color={COLORS.gold} style={styles.gearBig} />
          <Ionicons name="settings" size={70} color={COLORS.gold} style={styles.gearSmall} />

          {/* Avatar: tap to change photo */}
          <Pressable
            onPress={pickPhoto}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel={isSavingPhoto ? 'Saving profile photo' : 'Change profile photo'}
            disabled={isSavingPhoto}
          >
            <View style={styles.avatar}>
              {isSavingPhoto ? (
                <ActivityIndicator color={COLORS.brandDeep} />
              ) : photo ? (
                <Image source={{ uri: photo }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </View>
            <View style={styles.cameraBtn}>
              <Ionicons name="camera" size={14} color={COLORS.brandDeep} />
            </View>
          </Pressable>

          <Text style={styles.heroName} numberOfLines={2}>{user?.name || 'TUPian'}</Text>


          <Text style={styles.heroEmail} numberOfLines={1}>{user?.email || '—'}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.brandDeep} />
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
            <View style={styles.campusBadge}>
              <Ionicons name="location" size={13} color={COLORS.brandLine} />
              <Text style={styles.campusBadgeText}>TUP Taguig</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Details */}
      <Text style={styles.sectionTitle}>Account details</Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <InfoRow key={row.label} {...row} isLast={index === rows.length - 1} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, paddingTop: 48, paddingBottom: 48 },

  /* Page header */
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  pageHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pageHeaderText: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 1 },

  /* Hero */
  heroWrap: { marginBottom: 26, marginRight: 6 },
  heroShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: COLORS.gold,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  heroCard: {
    backgroundColor: COLORS.brand,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 22,
    alignItems: 'center',
    overflow: 'hidden'
  },
  gearBig: {
    position: 'absolute',
    right: -40,
    top: -30,
    opacity: 0.12,
    transform: [{ rotate: '15deg' }]
  },
  gearSmall: {
    position: 'absolute',
    left: -10,
    bottom: -14,
    opacity: 0.1,
    transform: [{ rotate: '-20deg' }]
  },
  avatarWrap: { marginBottom: 12 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.gold,
    borderWidth: 3,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' // clips the photo to the circle
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 38, fontWeight: '900', color: COLORS.brandDeep },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.surface,
    textAlign: 'center',
    letterSpacing: -0.3
  },

  /* Year & Section */
  ysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  ysText: { fontSize: 14, fontWeight: '800', color: COLORS.gold, letterSpacing: 0.4 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  input: {
    minWidth: 160,
    maxWidth: 220,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.brandLine,
    backgroundColor: COLORS.brandDeep,
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center'
  },
  saveBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center'
  },

  heroEmail: { fontSize: 13, color: COLORS.brandLine, marginTop: 3, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999
  },
  roleBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.brandDeep },
  campusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.brandLine
  },
  campusBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.brandLine },

  /* Details */
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3, marginBottom: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.ink,
    paddingHorizontal: 16
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.line },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowText: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  value: { fontSize: 16, fontWeight: '600', color: COLORS.ink, marginTop: 2 }
});