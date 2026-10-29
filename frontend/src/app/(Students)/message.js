import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import {
  apiGetChatContacts,
  apiGetChatMessages,
  apiSendChatMessage
} from '../../api/client';
import StudentHeader from '../../components/(Students)/StudentHeader';
import StaffHeader from '../../components/StaffHeader';

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
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  dangerLine: '#FECDCA',
  bubble: '#F1EDEE',
  online: '#1F7A4D'
};

const GROUP_GAP_MS = 5 * 60 * 1000;
const TIME_BREAK_MS = 15 * 60 * 1000;
const MAX_LENGTH = 1000;

const formatRole = (role) =>
  role
    ? role.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Member';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatStamp = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return `Today · ${formatTime(value)}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${formatTime(value)}`;
};

const timeOf = (value) => {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

function Avatar({ name, size = 36, ring = false }) {
  const content = (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 }
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {name?.charAt(0)?.toUpperCase() || '?'}
      </Text>
    </View>
  );

  if (!ring) return content;

  return (
    <View
      style={[
        styles.avatarRing,
        { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2 }
      ]}
    >
      {content}
    </View>
  );
}

function ChatMessage({ item, isOwnMessage, isFirstInGroup, isLastInGroup, showStamp }) {
  const bubbleShape = isOwnMessage
    ? {
        borderTopRightRadius: isFirstInGroup ? 20 : 6,
        borderBottomRightRadius: isLastInGroup ? 20 : 6
      }
    : {
        borderTopLeftRadius: isFirstInGroup ? 20 : 6,
        borderBottomLeftRadius: isLastInGroup ? 20 : 6
      };

  return (
    <View>
      {showStamp ? (
        <View style={styles.stampWrap}>
          <Text style={styles.stamp}>{formatStamp(item.createdAt)}</Text>
        </View>
      ) : null}

      {!isOwnMessage && isFirstInGroup ? (
        <View style={styles.senderLine}>
          <Text style={styles.senderName}>{item.senderName}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>{formatRole(item.senderRole)}</Text>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.messageRow,
          isOwnMessage && styles.messageRowOwn,
          { marginTop: isFirstInGroup ? 10 : 3 }
        ]}
      >
        {!isOwnMessage ? (
          <View style={styles.avatarSlot}>
            {isLastInGroup ? <Avatar name={item.senderName} size={28} /> : null}
          </View>
        ) : null}

        <View
          style={[
            styles.messageBubble,
            isOwnMessage && styles.messageBubbleOwn,
            bubbleShape
          ]}
        >
          <Text style={[styles.messageText, isOwnMessage && styles.messageTextOwn]}>
            {item.text}
          </Text>
        </View>
      </View>

      {isLastInGroup && formatTime(item.createdAt) ? (
        <Text style={[styles.timeText, isOwnMessage ? styles.timeTextOwn : styles.timeTextOther]}>
          {formatTime(item.createdAt)}
        </Text>
      ) : null}
    </View>
  );
}

export default function MessageScreen() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [showJump, setShowJump] = useState(false);
  const isMounted = useRef(true);
  const listRef = useRef(null);
  const isNearBottom = useRef(true);

  const loadContacts = useCallback(async () => {
    if (!token) return;

    try {
      const nextContacts = await apiGetChatContacts(token);
      if (!isMounted.current) return;
      setContacts(nextContacts);
      setSelectedContact((current) =>
        nextContacts.find((contact) => contact.id === current?.id) || nextContacts[0] || null
      );
      setIsLoadingMessages(nextContacts.length > 0);
      setError('');
    } catch (loadError) {
      if (isMounted.current) setError(loadError.message || 'Unable to load chat contacts.');
    }
  }, [token]);

  const loadMessages = useCallback(async (silent = false) => {
    if (!token || !selectedContact) {
      if (!silent && isMounted.current) setIsLoadingMessages(false);
      return;
    }

    try {
      const nextMessages = await apiGetChatMessages(token, selectedContact.id);
      if (!isMounted.current) return;
      setMessages(nextMessages);
      setError('');
    } catch (loadError) {
      if (!isMounted.current) return;
      if (!silent) setError(loadError.message || 'Unable to load chat messages.');
    } finally {
      if (isMounted.current && !silent) setIsLoadingMessages(false);
    }
  }, [selectedContact, token]);

  useEffect(() => {
    isMounted.current = true;
    const initialLoad = setTimeout(() => loadContacts(), 0);

    return () => {
      isMounted.current = false;
      clearTimeout(initialLoad);
    };
  }, [loadContacts]);

  useEffect(() => {
    if (!selectedContact) return undefined;

    const initialLoad = setTimeout(() => loadMessages(), 0);
    const refreshTimer = setInterval(() => loadMessages(true), 2500);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(refreshTimer);
    };
  }, [loadMessages, selectedContact]);

  const selectContact = (contact) => {
    isNearBottom.current = true;
    setShowJump(false);
    setMessages([]);
    setIsLoadingMessages(true);
    setSelectedContact(contact);
  };

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace('/login');
    }
  }, [isAuthLoading, router, user]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !token || !selectedContact || isSending) return;

    setIsSending(true);
    setError('');
    try {
      const sentMessage = await apiSendChatMessage(token, selectedContact.id, text);
      if (isMounted.current) {
        isNearBottom.current = true;
        setShowJump(false);
        setMessages((currentMessages) => [...currentMessages, sentMessage]);
        setDraft('');
      }
    } catch (sendError) {
      if (isMounted.current) setError(sendError.message || 'Unable to send message.');
    } finally {
      if (isMounted.current) setIsSending(false);
    }
  };

  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const nearBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
    isNearBottom.current = nearBottom;
    setShowJump((current) => (current === !nearBottom ? current : !nearBottom));
  };

  const jumpToLatest = () => {
    isNearBottom.current = true;
    setShowJump(false);
    listRef.current?.scrollToEnd({ animated: true });
  };

  // Web only: Enter sends, Shift+Enter adds a new line
  const handleKeyPress = (event) => {
    if (Platform.OS !== 'web') return;
    const { key, shiftKey } = event.nativeEvent;
    if (key === 'Enter' && !shiftKey) {
      event.preventDefault?.();
      sendMessage();
    }
  };

  const renderMessage = ({ item, index }) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const itemTime = timeOf(item.createdAt);

    const startsAfterBreak =
      !previous || itemTime - timeOf(previous.createdAt) > TIME_BREAK_MS;

    const continuesPrevious =
      previous &&
      previous.senderId === item.senderId &&
      !startsAfterBreak &&
      itemTime - timeOf(previous.createdAt) <= GROUP_GAP_MS;

    const continuesIntoNext =
      next &&
      next.senderId === item.senderId &&
      timeOf(next.createdAt) - itemTime <= GROUP_GAP_MS;

    return (
      <ChatMessage
        item={item}
        isOwnMessage={item.senderId === user.id}
        isFirstInGroup={!continuesPrevious}
        isLastInGroup={!continuesIntoNext}
        showStamp={startsAfterBreak}
      />
    );
  };

  if (isAuthLoading || !user) return null;

  const isStudent = user.role === 'student';
  const staffRole = user.role === 'program_chair' ? 'programchair' : 'faculty';
  const canSend = Boolean(draft.trim()) && !isSending && Boolean(selectedContact);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderIcon}>
            <Ionicons name="chatbubbles" size={22} color={COLORS.brand} />
          </View>
          <View style={styles.pageHeaderText}>
            <Text style={styles.title}>Campus Chat</Text>
            <Text style={styles.pageSubtitle}>Students, faculty, and program chairs</Text>
          </View>
          {contacts.length > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{contacts.length}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.headerTabs}>
          {isStudent ? (
            <StudentHeader activeRoute="/message" />
          ) : (
            <StaffHeader role={staffRole} activeRoute="/message" />
          )}
        </View>

        {/* Contacts */}
        <View style={styles.contactSection}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>{isStudent ? 'Your faculty' : 'Your students'}</Text>
            <Text style={styles.sectionHint}>Tap to chat 💬</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.contactList}
          >
            {contacts.map((contact) => {
              const isSelected = selectedContact?.id === contact.id;
              return (
                <TouchableOpacity
                  key={contact.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Chat with ${contact.name}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => selectContact(contact)}
                  style={styles.contactItem}
                  activeOpacity={0.8}
                >
                  <Avatar name={contact.name} size={50} ring={isSelected} />
                  <View style={[styles.contactNamePill, isSelected && styles.contactNamePillSelected]}>
                    <Text
                      numberOfLines={1}
                      style={[styles.contactName, isSelected && styles.contactNameSelected]}
                    >
                      {contact.name?.split(' ')[0] || contact.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Chat card */}
        <View style={styles.chatWrap}>
          <View style={styles.chatShadow} />
          <View style={styles.chat}>
            <View style={styles.chatHeader}>
              {selectedContact ? (
                <View style={styles.chatHeaderAvatar}>
                  <Avatar name={selectedContact.name} size={40} />
                  <View style={styles.onlineDot} />
                </View>
              ) : (
                <View style={styles.chatHeaderIdle}>
                  <Ionicons name="chatbubble-outline" size={20} color={COLORS.faint} />
                </View>
              )}
              <View style={styles.chatHeaderText}>
                <Text numberOfLines={1} style={styles.chatTitle}>
                  {selectedContact ? selectedContact.name : 'No chat contacts'}
                </Text>
                <Text numberOfLines={2} style={styles.chatSubtitle}>
                  {selectedContact
                    ? `${formatRole(selectedContact.role)} · Live`
                    : isStudent
                      ? 'Enroll in a subject with an assigned faculty member to start chatting.'
                      : 'No eligible students are enrolled in your assigned subjects.'}
                </Text>
              </View>
            </View>

            {isLoadingMessages ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="small" color={COLORS.brand} />
                <Text style={styles.stateText}>Loading messages...</Text>
              </View>
            ) : selectedContact ? (
              <View style={styles.listWrap}>
                <FlatList
                  ref={listRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMessage}
                  contentContainerStyle={[
                    styles.messageList,
                    messages.length === 0 && styles.messageListEmpty
                  ]}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScroll={handleScroll}
                  scrollEventThrottle={100}
                  onContentSizeChange={() => {
                    if (isNearBottom.current) listRef.current?.scrollToEnd({ animated: true });
                  }}
                  ListEmptyComponent={(
                    <View style={styles.emptyState}>
                      <Avatar name={selectedContact.name} size={72} ring />
                      <Text style={styles.emptyTitle}>{selectedContact.name}</Text>
                      <View style={styles.emptyRolePill}>
                        <Text style={styles.emptyRolePillText}>{formatRole(selectedContact.role)}</Text>
                      </View>
                      <Text style={styles.emptyText}>
                        No messages yet. Say hi to start the conversation 👋
                      </Text>
                    </View>
                  )}
                />
                {showJump ? (
                  <TouchableOpacity
                    style={styles.jumpButton}
                    onPress={jumpToLatest}
                    accessibilityRole="button"
                    accessibilityLabel="Jump to latest message"
                    activeOpacity={0.85}
                  >
                    <Ionicons name="arrow-down" size={14} color={COLORS.brandDeep} />
                    <Text style={styles.jumpButtonText}>Latest</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="people-outline" size={34} color={COLORS.brand} />
                </View>
                <Text style={styles.emptyTitle}>No eligible contacts</Text>
                <Text style={styles.emptyText}>
                  {isStudent
                    ? 'Your enrolled subjects do not have a faculty assignment for your section yet.'
                    : 'Students will appear here when they are enrolled in one of your assigned subjects.'}
                </Text>
              </View>
            )}

            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Composer */}
            <View style={styles.composer}>
              <View style={styles.inputWrap}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={selectedContact ? `Message ${selectedContact.name?.split(' ')[0]}...` : 'Message'}
                  placeholderTextColor={COLORS.faint}
                  multiline
                  maxLength={MAX_LENGTH}
                  style={styles.input}
                  editable={!isSending && Boolean(selectedContact)}
                  onSubmitEditing={sendMessage}
                  onKeyPress={handleKeyPress}
                />
                {draft.length > MAX_LENGTH * 0.8 ? (
                  <Text style={styles.charCount}>{draft.length}/{MAX_LENGTH}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Send message"
                onPress={sendMessage}
                disabled={!canSend}
                style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                activeOpacity={0.85}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={COLORS.gold} />
                ) : (
                  <Ionicons name="send" size={20} color={canSend ? COLORS.gold : COLORS.faint} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { flex: 1, paddingTop: 48 },

  /* Page header */
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16
  },
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
  countPill: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: COLORS.brand,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  countPillText: { color: COLORS.surface, fontWeight: '800', fontSize: 14 },
  headerTabs: { paddingHorizontal: 20 },

  /* Avatars */
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  avatarText: { fontWeight: '900', color: COLORS.brandDeep },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.brand,
    backgroundColor: COLORS.surface
  },

  /* Contacts */
  contactSection: { paddingTop: 2 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8
  },
  sectionLabel: { fontSize: 15, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.2 },
  sectionHint: { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  contactList: { gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  contactItem: { width: 70, alignItems: 'center', gap: 6 },
  contactNamePill: {
    maxWidth: 70,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  contactNamePillSelected: { backgroundColor: COLORS.brand, borderColor: COLORS.ink },
  contactName: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textAlign: 'center' },
  contactNameSelected: { color: COLORS.surface, fontWeight: '800' },

  /* Chat card with hard offset shadow */
  chatWrap: { flex: 1, marginLeft: 16, marginRight: 22, marginBottom: 20 },
  chatShadow: {
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
  chat: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.ink,
    overflow: 'hidden'
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.goldSoft,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.ink
  },
  chatHeaderAvatar: { width: 40, height: 40 },
  chatHeaderIdle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  onlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.online,
    borderWidth: 2,
    borderColor: COLORS.surface
  },
  chatHeaderText: { flex: 1 },
  chatTitle: { fontSize: 16, fontWeight: '900', color: COLORS.ink },
  chatSubtitle: { marginTop: 1, fontSize: 12, color: COLORS.brandDeep },

  /* Messages */
  listWrap: { flex: 1, backgroundColor: COLORS.paper },
  messageList: { paddingHorizontal: 12, paddingVertical: 10 },
  messageListEmpty: { flex: 1, justifyContent: 'center' },
  stampWrap: { alignItems: 'center', marginTop: 14, marginBottom: 4 },
  stamp: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden'
  },
  senderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginLeft: 36
  },
  senderName: { fontSize: 12, fontWeight: '800', color: COLORS.ink },
  roleTag: {
    backgroundColor: COLORS.goldSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999
  },
  roleTagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: COLORS.brandDeep },

  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowOwn: { justifyContent: 'flex-end' },
  avatarSlot: { width: 28 },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.ink
  },
  messageBubbleOwn: { backgroundColor: COLORS.brand },
  messageText: { fontSize: 15, lineHeight: 21, color: COLORS.ink },
  messageTextOwn: { color: COLORS.surface },
  timeText: { fontSize: 10, color: COLORS.faint, marginTop: 3 },
  timeTextOwn: { textAlign: 'right', marginRight: 4 },
  timeTextOther: { marginLeft: 36 },

  jumpButton: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.ink,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  jumpButtonText: { fontSize: 12, fontWeight: '800', color: COLORS.brandDeep },

  /* States */
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.paper },
  stateText: { fontSize: 13, color: COLORS.muted },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '900', color: COLORS.ink },
  emptyRolePill: {
    marginTop: 6,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 999
  },
  emptyRolePillText: { fontSize: 11, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.4 },
  emptyText: {
    maxWidth: 260,
    marginTop: 10,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.dangerSoft,
    borderTopWidth: 1,
    borderTopColor: COLORS.dangerLine
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.danger },

  /* Composer */
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 2,
    borderTopColor: COLORS.ink
  },
  inputWrap: {
    flex: 1,
    backgroundColor: COLORS.paper,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.ink
  },
  input: {
    maxHeight: 110,
    minHeight: 40,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: COLORS.ink,
    fontSize: 15
  },
  charCount: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 4,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.brand,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonDisabled: { backgroundColor: COLORS.bubble, borderColor: COLORS.line }
});