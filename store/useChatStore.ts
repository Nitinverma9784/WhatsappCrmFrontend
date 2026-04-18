import { create } from 'zustand';

export interface Message {
  messageId: string;
  groupId: string;
  sender: string;
  senderType?: 'whatsapp' | 'crm_user';
  senderName?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: string;
  timestamp: string | Date;
  deleted: boolean;
  _optimistic?: boolean; // used to mark temp messages
}

export interface Chat {
  groupId: string;
  name: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTimestamp?: string | Date;
  unreadCount?: number;
  isBackupEnabled?: boolean;
  isGroup?: boolean;
  createdAt?: string | Date;
  /** WhatsApp connection (WaSession) this chat belongs to */
  sessionId?: string;
}

export interface WaSessionRow {
  _id: string;
  label: string;
  wid?: string;
  connection?: {
    status: string;
    qr?: string | null;
    reconnectAttempts?: number;
  };
}

export interface PinnedChatRef {
  sessionId: string;
  groupId: string;
}

export interface User {
  _id: string;
  username: string;
  role: 'master' | 'sub';
  nickname?: string;
  assignedGroups: string[];
  assignedSessions?: string[];
  pinnedChats?: PinnedChatRef[];
}

interface ChatState {
  user: User | null;
  /** Currently selected linked WhatsApp number */
  activeSessionId: string | null;
  waSessions: WaSessionRow[];
  groups: Chat[];
  selectedChat: Chat | null;
  messages: Message[];
  messagesLoading: boolean;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'QR_PENDING' | 'CONNECTING';
  qrCode: string | null;
  /** Increment this to force ChatWindow to re-fetch messages for the current chat */
  messageRefreshToken: number;
  /** Controls QR modal visibility */
  showQRModal: boolean;
  /** Bumped to request ChatWindow to scroll to latest (header click, sidebar re-select, etc.) */
  scrollBottomNonce: number;

  setUser: (user: User | null) => void;
  bumpScrollChatBottom: () => void;
  setActiveSessionId: (id: string | null) => void;
  setWaSessions: (sessions: WaSessionRow[]) => void;
  setGroups: (groups: Chat[]) => void;
  updateChat: (groupId: string, lastMessage: string, lastMessageTimestamp: string | Date) => void;
  setSelectedChat: (group: Chat | null) => void;
  updateSelectedChat: (partialChat: Partial<Chat>) => void;
  setMessages: (messages: Message[]) => void;
  setMessagesLoading: (loading: boolean) => void;
  /** Triggers ChatWindow to re-fetch messages without changing selectedChat */
  triggerMessageRefresh: () => void;
  /**
   * Adds a message to the current chat.
   * If a message with the same messageId exists → skip.
   * If it's replacing an optimistic message (same text + senderType='crm_user') → replace it.
   */
  addMessage: (message: Message) => void;
  /**
   * Add an optimistic (temp) message before the server confirms.
   */
  addOptimisticMessage: (message: Message) => void;
  /**
   * Replace the optimistic message with the confirmed one from backend.
   * Matched by optimisticId (temp messageId).
   */
  resolveOptimisticMessage: (optimisticId: string, confirmedMessage: Message) => void;
  /**
   * Remove an optimistic message (on failure).
   */
  removeOptimisticMessage: (optimisticId: string) => void;
  markDeleted: (messageId: string) => void;
  setConnectionStatus: (status: 'CONNECTED' | 'DISCONNECTED' | 'QR_PENDING' | 'CONNECTING', qr?: string | null) => void;
  setShowQRModal: (show: boolean) => void;
}

const sortGroupsByLatest = (groups: Chat[]) =>
  [...groups].sort((a, b) => {
    const timeA = new Date(a.lastMessageTimestamp || a.createdAt || 0).getTime();
    const timeB = new Date(b.lastMessageTimestamp || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

export const useChatStore = create<ChatState>((set) => ({
  user: null,
  activeSessionId: null,
  waSessions: [],
  groups: [],
  selectedChat: null,
  messages: [],
  messagesLoading: false,
  connectionStatus: 'DISCONNECTED',
  qrCode: null,
  messageRefreshToken: 0,
  showQRModal: false,
  scrollBottomNonce: 0,

  setUser: (user) => set({ user }),

  bumpScrollChatBottom: () =>
    set((state) => ({ scrollBottomNonce: state.scrollBottomNonce + 1 })),

  setActiveSessionId: (activeSessionId) =>
    set({ activeSessionId, selectedChat: null, messages: [], messagesLoading: false }),

  setWaSessions: (waSessions) => set({ waSessions }),

  setGroups: (groups) => set({ groups: sortGroupsByLatest(groups) }),

  updateChat: (groupId, lastMessage, lastMessageTimestamp) =>
    set((state) => {
      const chatIndex = state.groups.findIndex((g) => g.groupId === groupId);
      if (chatIndex === -1) return state;

      const updatedGroups = [...state.groups];
      updatedGroups[chatIndex] = {
        ...updatedGroups[chatIndex],
        lastMessage,
        lastMessageTimestamp,
      };

      return { groups: sortGroupsByLatest(updatedGroups) };
    }),

  setSelectedChat: (selectedChat) => set({ selectedChat, messages: [], messagesLoading: false }),

  updateSelectedChat: (partialChat) =>
    set((state) => ({
      selectedChat: state.selectedChat ? { ...state.selectedChat, ...partialChat } : null,
    })),

  setMessages: (messages) => 
    set((state) => {
      // Deduplicate when setting (just in case backend/socket sent overlap)
      const unique = Array.from(new Map(messages.map(m => [m.messageId, m])).values());
      return { messages: unique };
    }),

  setMessagesLoading: (messagesLoading) => set({ messagesLoading }),

  /** Forces ChatWindow to re-fetch by bumping a counter it watches */
  triggerMessageRefresh: () => set((state) => ({ messageRefreshToken: state.messageRefreshToken + 1 })),

  addMessage: (message) =>
    set((state) => {
      if (!message._optimistic && state.messages.some((m) => m.messageId === message.messageId)) {
        return state;
      }

      const myId = state.user?._id != null ? String(state.user._id) : '';
      const incomingFromMe =
        message.senderType === 'crm_user' &&
        (String(message.sender) === myId || (message.sender === 'me' && !myId));

      // Socket can arrive before REST resolve — replace our pending CRM optimistic (same chat, same sender).
      // Prefer the most recent matching optimistic; match media vs text so a text echo does not eat an image placeholder.
      if (!message._optimistic && incomingFromMe && message.messageId) {
        const inMedia = Boolean(message.mediaUrl || message.mediaType);
        let pendingIdx = -1;
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const m = state.messages[i];
          if (!m._optimistic || m.groupId !== message.groupId || m.senderType !== 'crm_user') continue;
          if (!(String(m.sender) === myId || (m.sender === 'me' && !myId))) continue;
          const mMedia = Boolean(m.mediaUrl || m.mediaType);
          if (mMedia !== inMedia) continue;
          pendingIdx = i;
          break;
        }
        if (pendingIdx !== -1) {
          const updated = [...state.messages];
          updated[pendingIdx] = { ...message, _optimistic: false };
          return { messages: updated };
        }
      }

      const optIdx = state.messages.findIndex(
        (m) =>
          m._optimistic &&
          m.groupId === message.groupId &&
          m.senderType === 'crm_user' &&
          m.text === message.text
      );

      if (optIdx !== -1) {
        const updated = [...state.messages];
        updated[optIdx] = { ...message, _optimistic: false };
        return { messages: updated };
      }

      return { messages: [...state.messages, message] };
    }),

  addOptimisticMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, _optimistic: true }],
    })),

  resolveOptimisticMessage: (optimisticId, confirmedMessage) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.messageId === optimisticId) {
          return { ...confirmedMessage, _optimistic: false };
        }
        if (m.messageId === confirmedMessage.messageId) {
          return { ...m, ...confirmedMessage, _optimistic: false };
        }
        return m;
      }),
    })),

  removeOptimisticMessage: (optimisticId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.messageId !== optimisticId),
    })),

  markDeleted: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.messageId === messageId ? { ...m, deleted: true } : m
      ),
    })),

  setConnectionStatus: (status, qr) =>
    set((state) => ({
      connectionStatus: status,
      qrCode: qr || null,
      // Auto-open QR modal when backend signals QR_PENDING, auto-close on CONNECTED
      showQRModal:
        status === 'QR_PENDING'
          ? true
          : status === 'CONNECTED'
          ? false
          : state.showQRModal,
    })),

  setShowQRModal: (show) => set({ showQRModal: show }),
}));
