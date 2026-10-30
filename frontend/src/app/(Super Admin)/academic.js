import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AuthButton from '../../components/AuthButton';
import AuthInput from '../../components/AuthInput';
import StaffHeader from '../../components/StaffHeader';
import DropdownSelect from '../../components/DropdownSelect';
import {
  apiCreateProgram,
  apiCreateSection,
  apiGetAcademicStructure,
  apiUpdateAcademicSettings,
  apiUpdateProgram,
  apiDeleteProgram,
  apiUpdateAdminSection,
  apiDeleteAdminSection
} from '../../api/client';

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
  faint: '#A39A9E',
  line: '#E8E2E4',
  success: '#1F7A4D',
  successSoft: '#E3F4EA',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  dangerLine: '#FECDCA'
};

const YEAR_LEVEL_OPTIONS = [
  { label: 'First Year', value: 'First Year' },
  { label: 'Second Year', value: 'Second Year' },
  { label: 'Third Year', value: 'Third Year' },
  { label: 'Fourth Year', value: 'Fourth Year' }
];
const TERM_OPTIONS = [
  { label: 'First Term', value: 'First Term' },
  { label: 'Second Term', value: 'Second Term' },
  { label: 'Third Term', value: 'Third Term' }
];

const idOf = (item) => item.id || item._id;
const yearRank = (yearLevel) => {
  const index = YEAR_LEVEL_OPTIONS.findIndex((option) => option.value === yearLevel);
  return index === -1 ? 99 : index;
};

// Alert.alert does nothing on web, so use a browser confirm there
const confirmAction = (title, message, onConfirm) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm }
  ]);
};

/* ───────────────────────── Reusable pieces ───────────────────────── */

function Banner({ kind, children }) {
  const isError = kind === 'error';
  const color = isError ? COLORS.danger : COLORS.success;
  return (
    <View style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]} accessibilityRole="alert">
      <Ionicons name={isError ? 'alert-circle' : 'checkmark-circle'} size={20} color={color} />
      <Text style={[styles.bannerText, { color }]}>{children}</Text>
    </View>
  );
}

// Card with the hard offset gold shadow
function FormCard({ icon, title, editing, children }) {
  return (
    <View style={styles.cardWrap}>
      <View style={styles.cardShadow} />
      <View style={styles.card}>
        <View style={styles.formTitleRow}>
          <Ionicons name={icon} size={22} color={COLORS.brand} />
          <Text style={styles.formTitle}>{title}</Text>
          {editing ? (
            <View style={styles.editingPill}>
              <Text style={styles.editingPillText}>EDITING</Text>
            </View>
          ) : null}
        </View>
        {children}
      </View>
    </View>
  );
}

function ListHeader({ title, count, unit = 'total' }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.sectionCount}>{count} {unit}</Text>
    </View>
  );
}

function EmptyState({ icon, children }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={30} color={COLORS.faint} />
      <Text style={styles.empty}>{children}</Text>
    </View>
  );
}

function IconActions({ name, onEdit, onDelete }) {
  return (
    <View style={styles.itemActions}>
      <Pressable onPress={onEdit} style={styles.iconButton} accessibilityLabel={`Edit ${name}`}>
        <Ionicons name="create-outline" size={18} color={COLORS.brand} />
      </Pressable>
      <Pressable onPress={onDelete} style={styles.iconButton} accessibilityLabel={`Delete ${name}`}>
        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
      </Pressable>
    </View>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            activeOpacity={0.85}
          >
            <Ionicons name={tab.icon} size={16} color={isActive ? COLORS.surface : COLORS.ink} />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            {typeof tab.count === 'number' ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.count}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ───────────────────────── Screen ───────────────────────── */

export default function AcademicScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, token, isLoading } = useAuth();
  const [data, setData] = useState({ programs: [], sections: [] });
  const [activeTab, setActiveTab] = useState('sections'); // 'period' | 'programs' | 'sections'
  const [program, setProgram] = useState('');
  const [section, setSection] = useState('');
  const [yearLevel, setYearLevel] = useState(null);
  const [programId, setProgramId] = useState(null);
  const [schoolYear, setSchoolYear] = useState('');
  const [term, setTerm] = useState('');
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'super admin';
  const load = useCallback(async () => {
    if (token) {
      const result = await apiGetAcademicStructure(token);
      setData(result);
      setSchoolYear(result.settings?.schoolYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
      setTerm(result.settings?.term || TERM_OPTIONS[0].value);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      router.replace('/dashboard');
      return;
    }
    if (!isLoading && isSuperAdmin) {
      const timer = setTimeout(load, 0);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isSuperAdmin, load, router]);

  const changeTab = (tab) => {
    setActiveTab(tab);
    setError('');
    setMessage('');
  };

  const run = async (action, success) => {
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      setMessage(success);
    } catch (err) {
      setError(err.message || 'Unable to save academic structure.');
    }
  };

  /* ── Programs ── */
  const handleAddProgram = async () => {
    if (!program.trim()) {
      setError('Program name is required.');
      return;
    }
    await run(async () => {
      if (editingProgramId) {
        await apiUpdateProgram(token, editingProgramId, program.trim());
      } else {
        await apiCreateProgram(token, program.trim());
      }
      setProgram('');
      setEditingProgramId(null);
    }, editingProgramId ? 'Program updated successfully.' : 'Program added successfully.');
  };

  const startProgramEdit = (item) => {
    setActiveTab('programs');
    setEditingProgramId(idOf(item));
    setProgram(item.name);
    setError('');
    setMessage('');
  };

  const cancelProgramEdit = () => {
    setEditingProgramId(null);
    setProgram('');
  };

  const removeProgram = (item) => {
    confirmAction('Delete program', `Delete "${item.name}"?`, async () => {
      try {
        await apiDeleteProgram(token, idOf(item));
        if (editingProgramId === idOf(item)) cancelProgramEdit();
        await load();
        setMessage('Program deleted successfully.');
      } catch (err) {
        setError(err.message || 'Unable to delete program.');
      }
    });
  };

  /* ── Academic period ── */
  const handleSaveSettings = async () => {
    await run(async () => {
      const settings = await apiUpdateAcademicSettings(token, schoolYear, term);
      setSchoolYear(settings.schoolYear);
      setTerm(settings.term);
    }, 'Academic period updated successfully.');
  };

  /* ── Sections ── */
  const handleAddSection = async () => {
    if (!section.trim()) {
      setError('Section name is required.');
      return;
    }
    if (!yearLevel) {
      setError('Please select a year level.');
      return;
    }
    if (!programId) {
      setError('Please select a program.');
      return;
    }
    await run(async () => {
      if (editingSectionId) {
        await apiUpdateAdminSection(token, editingSectionId, {
          name: section.trim(),
          yearLevel,
          programId
        });
      } else {
        await apiCreateSection(token, section.trim(), yearLevel, programId);
      }
      setSection('');
      setYearLevel(null);
      setProgramId(null);
      setEditingSectionId(null);
    }, editingSectionId ? 'Section updated successfully.' : 'Section added successfully.');
  };

  const startSectionEdit = (item) => {
    setActiveTab('sections');
    setEditingSectionId(idOf(item));
    setSection(item.name);
    setYearLevel(item.yearLevel);
    setProgramId(item.programId?.toString() || item.courseId?.toString() || null);
    setError('');
    setMessage('');
  };

  const cancelSectionEdit = () => {
    setEditingSectionId(null);
    setSection('');
    setYearLevel(null);
    setProgramId(null);
  };

  const removeSection = (item) => {
    confirmAction('Delete section', `Delete "${item.name}"? Students will become unassigned.`, async () => {
      try {
        await apiDeleteAdminSection(token, idOf(item));
        if (editingSectionId === idOf(item)) cancelSectionEdit();
        await load();
        setMessage('Section deleted successfully.');
      } catch (err) {
        setError(err.message || 'Unable to delete section.');
      }
    });
  };

  const programOptions = data.programs.map((p) => ({
    label: p.name,
    value: idOf(p)
  }));

  // Sections grouped under their program, ordered by year level then name
  const sectionGroups = useMemo(() => {
    const groups = new Map();
    data.sections.forEach((item) => {
      const linkedId = (item.programId ?? item.courseId)?.toString();
      const linkedProgram = data.programs.find((p) => String(idOf(p)) === linkedId);
      const groupName = item.programName || linkedProgram?.name || 'No program assigned';
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(item);
    });
    return Array.from(groups.entries()).map(([name, items]) => ({
      name,
      items: items.sort(
        (a, b) => yearRank(a.yearLevel) - yearRank(b.yearLevel) || String(a.name).localeCompare(String(b.name))
      )
    }));
  }, [data.programs, data.sections]);

  const sectionCountFor = (item) =>
    data.sections.filter((s) => {
      const linkedId = (s.programId ?? s.courseId)?.toString();
      return linkedId === String(idOf(item)) || s.programName === item.name;
    }).length;

  if (isLoading || !isSuperAdmin) return null;

  const isWide = width >= 900;
  const savedPeriod = data.settings
    ? `${data.settings.schoolYear || '—'} · ${data.settings.term || '—'}`
    : null;

  const tabs = [
    { key: 'period', label: 'Period', icon: 'calendar-outline' },
    { key: 'programs', label: 'Programs', icon: 'school-outline', count: data.programs.length },
    { key: 'sections', label: 'Sections', icon: 'people-outline', count: data.sections.length }
  ];

  /* ── Tab: academic period ── */
  const savedSchoolYear = data.settings?.schoolYear || '';
  const savedTerm = data.settings?.term || '';
  const shownSchoolYear = savedSchoolYear || schoolYear || '—';
  const shownTerm = savedTerm || term || '—';
  const hasUnsavedPeriod =
    Boolean(data.settings) && (schoolYear !== savedSchoolYear || term !== savedTerm);
  const currentTermIndex = TERM_OPTIONS.findIndex((option) => option.value === shownTerm);
  const yearCounts = YEAR_LEVEL_OPTIONS.map((option) => ({
    label: option.label,
    count: data.sections.filter((item) => item.yearLevel === option.value).length
  }));
  const maxYearCount = Math.max(1, ...yearCounts.map((item) => item.count));

  const periodForm = (
    <FormCard icon="calendar-outline" title="Academic period">
      <AuthInput
        label="School Year"
        icon="calendar-outline"
        placeholder="e.g. 2026-2027"
        value={schoolYear}
        onChangeText={(value) => { setSchoolYear(value); setError(''); }}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      <DropdownSelect
        label="Current Term / Semester"
        icon="time-outline"
        placeholder="Select term"
        options={TERM_OPTIONS}
        value={term}
        onSelect={(value) => { setTerm(value); setError(''); }}
      />
      <AuthButton title="Save Academic Period" onPress={handleSaveSettings} />
    </FormCard>
  );

  const periodOverview = (
    <View>
      {/* Hero: what's active right now */}
      <View style={styles.heroWrap}>
        <View style={styles.heroShadow} />
        <View style={styles.heroCard}>
          <Ionicons name="settings" size={170} color={COLORS.gold} style={styles.gearBig} />
          <Ionicons name="settings" size={70} color={COLORS.gold} style={styles.gearSmall} />
          <View style={styles.heroTopRow}>
            <View style={styles.activeSticker}>
              <View style={styles.activeDot} />
              <Text style={styles.activeStickerText}>ACTIVE PERIOD</Text>
            </View>
            {hasUnsavedPeriod ? (
              <View style={styles.unsavedPill}>
                <Text style={styles.unsavedPillText}>Unsaved changes</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroLabel}>School year</Text>
          <Text style={styles.heroYear}>{shownSchoolYear}</Text>
          <View style={styles.heroTermPill}>
            <Ionicons name="time" size={14} color={COLORS.brandDeep} />
            <Text style={styles.heroTermText}>{shownTerm}</Text>
          </View>
        </View>
      </View>

      {/* Term timeline */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Term progress</Text>
        <View style={styles.timeline}>
          {TERM_OPTIONS.map((option, index) => {
            const isCurrent = index === currentTermIndex;
            const isDone = currentTermIndex > -1 && index < currentTermIndex;
            return (
              <View key={option.value} style={styles.timelineStep}>
                <View style={styles.timelineTrack}>
                  <View style={[styles.timelineLine, index === 0 && styles.timelineLineHidden, (isDone || isCurrent) && styles.timelineLineDone]} />
                  <View style={[styles.timelineDot, isDone && styles.timelineDotDone, isCurrent && styles.timelineDotCurrent]}>
                    {isDone ? (
                      <Ionicons name="checkmark" size={14} color={COLORS.surface} />
                    ) : (
                      <Text style={[styles.timelineDotText, isCurrent && styles.timelineDotTextCurrent]}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={[styles.timelineLine, index === TERM_OPTIONS.length - 1 && styles.timelineLineHidden, isDone && styles.timelineLineDone]} />
                </View>
                <Text style={[styles.timelineLabel, isCurrent && styles.timelineLabelCurrent]} numberOfLines={1}>
                  {option.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Quick stats (tap to jump) */}
      <View style={styles.statRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => changeTab('programs')} activeOpacity={0.85}>
          <View style={styles.statIcon}>
            <Ionicons name="school" size={18} color={COLORS.brand} />
          </View>
          <Text style={styles.statNumber}>{data.programs.length}</Text>
          <Text style={styles.statLabel}>Programs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => changeTab('sections')} activeOpacity={0.85}>
          <View style={styles.statIcon}>
            <Ionicons name="people" size={18} color={COLORS.brand} />
          </View>
          <Text style={styles.statNumber}>{data.sections.length}</Text>
          <Text style={styles.statLabel}>Sections</Text>
        </TouchableOpacity>
      </View>

      {/* Sections by year level */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Sections by year level</Text>
        {yearCounts.map((item) => (
          <View key={item.label} style={styles.barRow}>
            <Text style={styles.barLabel}>{item.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(item.count / maxYearCount) * 100}%` }]} />
            </View>
            <Text style={styles.barCount}>{item.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  /* ── Tab: programs ── */
  const programForm = (
    <FormCard
      icon={editingProgramId ? 'create-outline' : 'add-circle-outline'}
      title={editingProgramId ? 'Update program' : 'Add program'}
      editing={Boolean(editingProgramId)}
    >
      <AuthInput
        label="Program Name"
        icon="school-outline"
        placeholder="e.g. Bachelor of Science in Information Technology"
        value={program}
        onChangeText={(t) => { setProgram(t); setError(''); }}
      />
      <AuthButton title={editingProgramId ? 'Update Program' : 'Add Program'} onPress={handleAddProgram} />
      {editingProgramId ? (
        <AuthButton title="Cancel Edit" variant="outline" onPress={cancelProgramEdit} />
      ) : null}
    </FormCard>
  );

  const programList = (
    <View>
      <ListHeader title="Programs" count={data.programs.length} />
      {data.programs.length === 0 ? (
        <EmptyState icon="school-outline">No programs added yet. Add one to start creating sections.</EmptyState>
      ) : (
        data.programs.map((item) => {
          const count = sectionCountFor(item);
          return (
            <View key={`program-${idOf(item)}`} style={styles.listItem}>
              <View style={styles.itemIcon}>
                <Ionicons name="school" size={18} color={COLORS.brand} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.chipRow}>
                  <View style={styles.programChip}>
                    <Text style={styles.programChipText}>{count} section{count === 1 ? '' : 's'}</Text>
                  </View>
                </View>
              </View>
              <IconActions
                name={item.name}
                onEdit={() => startProgramEdit(item)}
                onDelete={() => removeProgram(item)}
              />
            </View>
          );
        })
      )}
    </View>
  );

  /* ── Tab: sections ── */
  const sectionForm = (
    <FormCard
      icon={editingSectionId ? 'create-outline' : 'add-circle-outline'}
      title={editingSectionId ? 'Update section' : 'Add section'}
      editing={Boolean(editingSectionId)}
    >
      <AuthInput
        label="Section Name"
        icon="list-outline"
        placeholder="e.g. BSIT-1A"
        value={section}
        onChangeText={(t) => { setSection(t); setError(''); }}
        autoCapitalize="characters"
      />
      <DropdownSelect
        label="Year Level"
        icon="layers-outline"
        placeholder="Select year level"
        options={YEAR_LEVEL_OPTIONS}
        value={yearLevel}
        onSelect={(val) => { setYearLevel(val); setError(''); }}
      />
      <DropdownSelect
        label="Program"
        icon="school-outline"
        placeholder={data.programs.length === 0 ? 'No programs available' : 'Select program'}
        options={programOptions}
        value={programId}
        onSelect={(val) => { setProgramId(val); setError(''); }}
      />
      {data.programs.length === 0 ? (
        <Text style={styles.formHint}>Add a program first (Programs tab) before creating sections.</Text>
      ) : null}
      <AuthButton
        title={editingSectionId ? 'Update Section' : 'Add Section'}
        onPress={handleAddSection}
        disabled={data.programs.length === 0}
      />
      {editingSectionId ? (
        <AuthButton title="Cancel Edit" variant="outline" onPress={cancelSectionEdit} />
      ) : null}
    </FormCard>
  );

  const sectionList = (
    <View>
      <ListHeader title="Sections" count={data.sections.length} />
      {data.sections.length === 0 ? (
        <EmptyState icon="people-outline">No sections added yet.</EmptyState>
      ) : (
        sectionGroups.map((group) => (
          <View key={group.name} style={styles.group}>
            <View style={styles.groupHeader}>
              <Ionicons name="school-outline" size={16} color={COLORS.brandDeep} />
              <Text style={styles.groupTitle} numberOfLines={1}>{group.name}</Text>
              <View style={styles.groupCount}>
                <Text style={styles.groupCountText}>{group.items.length}</Text>
              </View>
            </View>
            {group.items.map((item) => (
              <View key={idOf(item)} style={styles.listItem}>
                <View style={styles.itemIcon}>
                  <Ionicons name="people" size={18} color={COLORS.brand} />
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  {item.yearLevel ? (
                    <View style={styles.chipRow}>
                      <View style={styles.yearChip}>
                        <Text style={styles.yearChipText}>{item.yearLevel}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
                <IconActions
                  name={item.name}
                  onEdit={() => startSectionEdit(item)}
                  onDelete={() => removeSection(item)}
                />
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );

  // Phone: form on top, list below. Desktop: form left, list right.
  const twoColumn = (form, list) => (
    <View style={[styles.layout, isWide && styles.layoutWide]}>
      <View style={isWide ? styles.formCol : null}>{form}</View>
      <View style={isWide ? styles.listCol : null}>{list}</View>
    </View>
  );

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
          <Ionicons name="library" size={22} color={COLORS.brand} />
        </View>
        <View style={styles.pageHeaderText}>
          <Text style={styles.title}>Programs & Sections</Text>
          <Text style={styles.pageSubtitle}>Set up the academic structure</Text>
        </View>
      </View>

      <StaffHeader role="superadmin" activeRoute="/academic" />

      {/* Current period at a glance */}
      {savedPeriod ? (
        <View style={styles.periodSticker}>
          <Ionicons name="calendar" size={14} color={COLORS.brandDeep} />
          <Text style={styles.periodStickerText}>CURRENT: {savedPeriod}</Text>
        </View>
      ) : null}

      <TabBar tabs={tabs} active={activeTab} onChange={changeTab} />

      {error ? <Banner kind="error">{error}</Banner> : null}
      {message ? <Banner kind="success">{message}</Banner> : null}

      {activeTab === 'period' ? twoColumn(periodForm, periodOverview) : null}
      {activeTab === 'programs' ? twoColumn(programForm, programList) : null}
      {activeTab === 'sections' ? twoColumn(sectionForm, sectionList) : null}
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
  periodSticker: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 14,
    transform: [{ rotate: '-1deg' }]
  },
  periodStickerText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: COLORS.brandDeep },

  /* Tabs */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 4,
    marginBottom: 20
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 999,
    gap: 6
  },
  tabActive: { backgroundColor: COLORS.brand },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  tabTextActive: { color: COLORS.surface, fontWeight: '800' },
  badge: {
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5
  },
  badgeText: { color: COLORS.brandDeep, fontSize: 11, fontWeight: '800' },

  /* Banners */
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1
  },
  bannerError: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.dangerLine },
  bannerSuccess: { backgroundColor: COLORS.successSoft, borderColor: '#B7E1C8' },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },

  /* Layout */
  layout: { gap: 8 },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  formCol: { width: 400 },
  listCol: { flex: 1, minWidth: 0 },
  singleCol: { width: '100%', maxWidth: 520 },

  /* Form cards with hard offset shadow */
  cardWrap: { marginBottom: 28, marginRight: 6 },
  cardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: COLORS.gold,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  formTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink, flex: 1 },
  editingPill: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    transform: [{ rotate: '-2deg' }]
  },
  editingPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.brandDeep },
  formHint: { fontSize: 12, color: COLORS.muted, marginBottom: 8, lineHeight: 17 },

  /* Lists */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  heading: { fontSize: 18, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  sectionCount: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    padding: 24
  },
  empty: { color: COLORS.muted, textAlign: 'center', fontSize: 13, lineHeight: 19 },

  group: { marginBottom: 18 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10
  },
  groupTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.brandDeep },
  groupCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  groupCountText: { fontSize: 11, fontWeight: '800', color: COLORS.surface },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.ink,
    marginBottom: 10
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemContent: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  yearChip: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999
  },
  yearChipText: { fontSize: 11, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },
  programChip: {
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999
  },
  programChipText: { fontSize: 11, fontWeight: '800', color: COLORS.brandDeep },

  /* Period overview */
  heroWrap: { marginBottom: 24, marginRight: 6 },
  heroShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: COLORS.gold,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  heroCard: {
    backgroundColor: COLORS.brand,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 22,
    overflow: 'hidden'
  },
  gearBig: { position: 'absolute', right: -40, top: -30, opacity: 0.12, transform: [{ rotate: '15deg' }] },
  gearSmall: { position: 'absolute', right: 120, bottom: -14, opacity: 0.1, transform: [{ rotate: '-20deg' }] },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  activeSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    transform: [{ rotate: '-2deg' }]
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  activeStickerText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.brandDeep },
  unsavedPill: {
    borderWidth: 1,
    borderColor: COLORS.brandLine,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999
  },
  unsavedPillText: { fontSize: 11, fontWeight: '700', color: COLORS.brandLine },
  heroLabel: { fontSize: 12, fontWeight: '700', color: COLORS.brandLine, letterSpacing: 0.5 },
  heroYear: { fontSize: 44, fontWeight: '900', color: COLORS.surface, letterSpacing: -1, marginTop: 2 },
  heroTermPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.goldSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 10
  },
  heroTermText: { fontSize: 13, fontWeight: '800', color: COLORS.brandDeep },

  panel: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.ink,
    padding: 16,
    marginBottom: 18
  },
  panelTitle: { fontSize: 15, fontWeight: '900', color: COLORS.ink, marginBottom: 14 },

  timeline: { flexDirection: 'row' },
  timelineStep: { flex: 1, alignItems: 'center' },
  timelineTrack: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  timelineLine: { flex: 1, height: 3, backgroundColor: COLORS.line },
  timelineLineHidden: { backgroundColor: 'transparent' },
  timelineLineDone: { backgroundColor: COLORS.brand },
  timelineDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  timelineDotDone: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  timelineDotCurrent: { backgroundColor: COLORS.gold, borderColor: COLORS.ink },
  timelineDotText: { fontSize: 13, fontWeight: '800', color: COLORS.faint },
  timelineDotTextCurrent: { color: COLORS.brandDeep },
  timelineLabel: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginTop: 8 },
  timelineLabelCurrent: { color: COLORS.ink, fontWeight: '900' },

  statRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderBottomWidth: 5,
    padding: 14
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  statNumber: { fontSize: 26, fontWeight: '900', color: COLORS.ink },
  statLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: { width: 82, fontSize: 12, fontWeight: '700', color: COLORS.ink },
  barTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1,
    borderColor: COLORS.ink,
    overflow: 'hidden'
  },
  barFill: { height: '100%', backgroundColor: COLORS.brand },
  barCount: { width: 22, textAlign: 'right', fontSize: 13, fontWeight: '800', color: COLORS.ink }
});