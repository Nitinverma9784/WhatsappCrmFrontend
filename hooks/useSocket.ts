import { useEffect, useCallback, useRef } from 'react';
import socket, { setSocketAuthToken } from '@/lib/socket';
import { useChatStore } from '@/store/useChatStore';

export const useSocket = () => {
  const {
    addMessage,
    markDeleted,
    setConnectionStatus,
    selectedChat,
    updateChat,
    activeSessionId,
    waSessions,
  } = useChatStore();

  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const sameSession = (msgSessionId?: string) => {
    const cur = activeSessionIdRef.current;
    if (!cur) return false;
    if (!msgSessionId) return true;
    return msgSessionId === cur;
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setSocketAuthToken(token);

    if (!socket.connected) {
      socket.connect();
    }

    const onNewMessage = (msg: any) => {
      if (!sameSession(msg.sessionId)) return;
      const t = (msg.text && String(msg.text).trim()) || '';
      const fallback =
        msg.mediaType === 'image'
          ? '📷'
          : msg.mediaType === 'document'
          ? '📄'
          : msg.mediaType === 'video'
          ? '🎬'
          : msg.mediaType === 'audio'
          ? '🎤'
          : 'Media';
      const body = t || fallback;
      const lastLine = msg.senderName ? `${msg.senderName}: ${body}` : body;
      updateChat(msg.groupId, lastLine, msg.timestamp);
      if (selectedChat && msg.groupId === selectedChat.groupId) {
        addMessage(msg);
      }
    };

    const onChatUpdated = (data: {
      sessionId?: string;
      groupId: string;
      lastMessage: string;
      lastMessageTimestamp: string | Date;
    }) => {
      if (!sameSession(data.sessionId)) return;
      updateChat(data.groupId, data.lastMessage, data.lastMessageTimestamp);
    };

    const onMessageDeleted = (data: {
      sessionId?: string;
      messageId: string;
      groupId: string;
    }) => {
      if (!sameSession(data.sessionId)) return;
      markDeleted(data.messageId);
    };

    const onConnectionStatus = (data: {
      sessionId?: string;
      status: 'CONNECTED' | 'DISCONNECTED' | 'QR_PENDING' | 'CONNECTING';
      qr?: string;
      reconnectIn?: number;
      attempt?: number;
    }) => {
      const cur = activeSessionIdRef.current;
      // When cur is still null (sessions loading), dropping events leaves UI stuck on DISCONNECTED.
      if (cur && data.sessionId && data.sessionId !== cur) return;
      setConnectionStatus(data.status as any, data.qr);
    };

    socket.on('new_message', onNewMessage);
    socket.on('chat_updated', onChatUpdated);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('connectionStatus', onConnectionStatus);

    const joinRooms = () => {
      const ids = waSessions.map((s) => s._id);
      if (ids.length) socket.emit('joinWaSessions', ids);
    };

    joinRooms();

    const onSocketConnect = () => {
      setSocketAuthToken(localStorage.getItem('token'));
      const state = useChatStore.getState();
      const ids = state.waSessions.map((s) => s._id);
      if (ids.length) socket.emit('joinWaSessions', ids);
      if (state.activeSessionId) {
        socket.emit('requestStatus', { sessionId: state.activeSessionId });
      }
    };

    const onSocketReconnect = () => {
      setSocketAuthToken(localStorage.getItem('token'));
      const state = useChatStore.getState();
      const ids = state.waSessions.map((s) => s._id);
      if (ids.length) socket.emit('joinWaSessions', ids);
      if (state.activeSessionId) {
        socket.emit('requestStatus', { sessionId: state.activeSessionId });
      }
    };

    socket.on('connect', onSocketConnect);
    socket.on('reconnect', onSocketReconnect);

    if (socket.connected) {
      onSocketConnect();
    }

    return () => {
      socket.off('connect', onSocketConnect);
      socket.off('new_message', onNewMessage);
      socket.off('chat_updated', onChatUpdated);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('connectionStatus', onConnectionStatus);
      socket.off('reconnect', onSocketReconnect);
    };
  }, [
    selectedChat,
    addMessage,
    markDeleted,
    setConnectionStatus,
    updateChat,
    waSessions,
  ]);

  useEffect(() => {
    const ids = waSessions.map((s) => s._id);
    if (ids.length && socket.connected) {
      socket.emit('joinWaSessions', ids);
    }
  }, [waSessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    const ping = () => {
      if (socket.connected) {
        socket.emit('requestStatus', { sessionId: activeSessionId });
      }
    };
    ping();
    socket.on('connect', ping);
    return () => {
      socket.off('connect', ping);
    };
  }, [activeSessionId]);

  const joinRoom = useCallback((groupId: string) => {
    socket.emit('joinGroup', groupId);
  }, []);

  return { joinRoom };
};
