"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Power, Link2, Unlink, Users, User as UserIcon, Loader2, Database, RefreshCw, Plus, Pin } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChatStore } from '@/store/useChatStore'
import { formatDistanceToNow } from 'date-fns'
import api from '@/lib/api'
import Link from 'next/link'

export default function Sidebar() {
  const {
    groups: chats,
    setGroups: setChats,
    setSelectedChat,
    selectedChat,
    user,
    connectionStatus,
    setConnectionStatus,
    setShowQRModal,
    activeSessionId,
    setActiveSessionId,
    waSessions,
    setWaSessions,
    setUser,
    bumpScrollChatBottom,
  } = useChatStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [loadingWA, setLoadingWA] = useState(false)
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [newLabel, setNewLabel] = useState('')

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const { data } = await api.get('/whatsapp/sessions')
      setWaSessions(data)

      const cur = useChatStore.getState().activeSessionId
      const curStr = cur ? String(cur) : ''
      const inList = curStr && data.some((s: { _id: string }) => String(s._id) === curStr)

      let nextId = curStr
      if (!data.length) {
        if (curStr) setActiveSessionId(null)
        return
      }
      if (!inList || !curStr) {
        const connected = data.find(
          (s: { connection?: { status?: string } }) => s.connection?.status === 'CONNECTED'
        )
        nextId = String((connected || data[0])._id)
        if (String(curStr || '') !== nextId) setActiveSessionId(nextId)
      }

      const row = data.find((s: { _id: string }) => String(s._id) === String(nextId))
      if (row?.connection?.status) {
        setConnectionStatus(row.connection.status as any, row.connection.qr ?? null)
      }
    } catch (err) {
      console.error('Error loading sessions:', err)
    } finally {
      setLoadingSessions(false)
    }
  }, [setWaSessions, setActiveSessionId, setConnectionStatus])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!activeSessionId) {
      setChats([])
      return
    }
    const fetchChats = async () => {
      setLoadingChats(true)
      try {
        const { data } = await api.get(`/whatsapp/sessions/${activeSessionId}/groups`)
        setChats(
          data.map((g: any) => ({
            ...g,
            sessionId: g.sessionId ?? activeSessionId,
          }))
        )
      } catch (err) {
        console.error('Error fetching chats:', err)
      } finally {
        setLoadingChats(false)
      }
    }
    fetchChats()
  }, [activeSessionId, setChats])

  const handleSyncChats = async () => {
    if (loadingChats || !activeSessionId) return
    setLoadingChats(true)
    try {
      const { data } = await api.get(`/whatsapp/sessions/${activeSessionId}/groups`)
      setChats(
        data.map((g: any) => ({
          ...g,
          sessionId: g.sessionId ?? activeSessionId,
        }))
      )
      useChatStore.getState().triggerMessageRefresh()
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      setLoadingChats(false)
    }
  }

  const sortedFilteredChats = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const sid = activeSessionId ? String(activeSessionId) : ''
    const pins = (user?.pinnedChats || []).filter((p) => String(p.sessionId) === sid)

    const pinIndex = (groupId: string) =>
      pins.findIndex((p) => p.groupId === groupId)

    const matches = (c: (typeof chats)[0]) => {
      if (!term) return true
      const name = (c.name || '').toLowerCase()
      const last = (c.lastMessage || '').toLowerCase()
      const gid = (c.groupId || '').toLowerCase()
      return name.includes(term) || last.includes(term) || gid.includes(term)
    }

    return [...chats]
      .filter(matches)
      .sort((a, b) => {
        const ia = pinIndex(a.groupId)
        const ib = pinIndex(b.groupId)
        const aP = ia >= 0
        const bP = ib >= 0
        if (aP && !bP) return -1
        if (!aP && bP) return 1
        if (aP && bP) return ia - ib
        const ta = new Date(a.lastMessageTimestamp || a.createdAt || 0).getTime()
        const tb = new Date(b.lastMessageTimestamp || b.createdAt || 0).getTime()
        return tb - ta
      })
  }, [chats, searchTerm, user?.pinnedChats, activeSessionId])

  const handleLogoutWA = async () => {
    if (!activeSessionId) return
    if (!confirm('Disconnect this WhatsApp number? Session data for this number will be cleared.')) return
    setLoadingWA(true)
    try {
      await api.post(`/whatsapp/sessions/${activeSessionId}/logout`)
      setConnectionStatus('DISCONNECTED')
      window.location.reload()
    } catch (err) {
      console.error('WA logout error:', err)
    } finally {
      setLoadingWA(false)
    }
  }

  const handleLogoutCRM = () => {
    if (!confirm('Log out of the CRM?')) return
    localStorage.removeItem('token')
    window.location.reload()
  }

  const handleSelectChat = (chat: typeof chats[0]) => {
    if (selectedChat?.groupId !== chat.groupId) {
      setSelectedChat(chat)
    } else {
      bumpScrollChatBottom()
    }
  }

  const isChatPinned = (groupId: string) => {
    const sid = activeSessionId ? String(activeSessionId) : ''
    return (user?.pinnedChats || []).some(
      (p) => String(p.sessionId) === sid && p.groupId === groupId
    )
  }

  const handleTogglePin = async (e: React.MouseEvent, chat: typeof chats[0]) => {
    e.stopPropagation()
    if (!activeSessionId || !user) return
    try {
      const { data } = await api.post('/auth/pinned-chats/toggle', {
        sessionId: activeSessionId,
        groupId: chat.groupId,
      })
      const pinnedChats = (data.pinnedChats || []).map(
        (p: { sessionId: string; groupId: string }) => ({
          sessionId: String(p.sessionId),
          groupId: p.groupId,
        })
      )
      setUser({ ...user, pinnedChats })
    } catch (err) {
      console.error('Pin chat error:', err)
    }
  }

  const handleReconnectWA = async () => {
    if (loadingWA || !activeSessionId) return
    setLoadingWA(true)
    setShowQRModal(true)
    try {
      await api.post(`/whatsapp/sessions/${activeSessionId}/connect`)
    } catch (err) {
      console.error('Reconnect error:', err)
    } finally {
      setTimeout(() => setLoadingWA(false), 6000)
    }
  }

  const handleCreateSession = async () => {
    const label = newLabel.trim() || 'WhatsApp'
    try {
      await api.post('/whatsapp/sessions', { label })
      setNewLabel('')
      await loadSessions()
    } catch (err) {
      console.error('Create session:', err)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 bg-white dark:bg-[#111b21] border-r border-border w-full max-w-full">
      <div className="flex flex-wrap items-center gap-y-2 justify-between gap-x-2 px-2 sm:px-4 py-2.5 sm:py-3 bg-zinc-100 dark:bg-[#202c33] shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-emerald-500/20">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}`} />
            <AvatarFallback className="bg-emerald-500/10 text-emerald-700 font-bold text-xs">
              {user?.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-bold text-foreground leading-tight truncate max-w-[120px]">
              {user?.nickname || user?.username}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize font-bold opacity-60 tracking-wider">
              {user?.role} Access
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-muted-foreground shrink-0">
          {user?.role === 'master' && (
            <>
              <Link href="/users" title="Manage Users" className="hover:text-emerald-500 transition-colors p-1.5">
                <Users className="h-4.5 w-4.5" />
              </Link>
              <Link href="/settings" title="Chat Backup Settings" className="hover:text-emerald-500 transition-colors p-1.5">
                <Database className="h-4.5 w-4.5" />
              </Link>
            </>
          )}
          <button
            onClick={() => activeSessionId && handleSyncChats()}
            title="Force Sync All"
            className={`p-1.5 hover:text-emerald-500 transition-all ${loadingChats ? 'animate-spin text-emerald-500' : ''}`}
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
          <button onClick={handleLogoutCRM} title="Log out" className="p-1.5 hover:text-red-500 transition-colors ml-1">
            <Power className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* WhatsApp account switcher */}
      <div className="px-3 py-2 border-b border-border/10 bg-secondary/5 space-y-2 shrink-0">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">WhatsApp number</label>
        <div className="flex gap-2 items-center">
          <select
            value={activeSessionId || ''}
            onChange={async (e) => {
              const id = e.target.value || null
              setActiveSessionId(id)
              if (!id) return
              try {
                const { data } = await api.get(`/whatsapp/sessions/${id}/status`)
                setConnectionStatus(data.status, data.qr)
              } catch {
                const row = waSessions.find((s) => String(s._id) === String(id))
                if (row?.connection?.status) {
                  setConnectionStatus(row.connection.status as any, row.connection.qr ?? null)
                }
              }
            }}
            disabled={loadingSessions || !waSessions.length}
            className="flex-1 min-w-0 text-[13px] font-medium rounded-lg bg-zinc-100 dark:bg-[#202c33] border-none py-2 px-2 outline-none focus:ring-1 focus:ring-emerald-500/40"
          >
            {loadingSessions ? (
              <option>Loading…</option>
            ) : waSessions.length === 0 ? (
              <option>No accounts yet</option>
            ) : (
              waSessions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.label}
                  {user?.role === 'master' && s.wid ? ` (${s.wid.split('@')[0]})` : ''}
                </option>
              ))
            )}
          </select>
          {user?.role === 'master' && (
            <div className="flex gap-1 items-center shrink-0">
              <Input
                placeholder="Label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-24 h-9 text-[12px]"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              />
              <button
                type="button"
                title="Add WhatsApp account"
                onClick={handleCreateSession}
                className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className={`px-4 py-2 flex items-center justify-between text-[11px] border-b border-border/10 transition-colors ${
          connectionStatus === 'CONNECTED'
            ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
            : connectionStatus === 'QR_PENDING'
            ? 'bg-amber-500/5 text-amber-600 dark:text-amber-400'
            : connectionStatus === 'CONNECTING'
            ? 'bg-blue-500/5 text-blue-600 dark:text-blue-400'
            : 'bg-red-500/5 text-red-600 dark:text-red-400'
        }`}
      >
        <div className="flex items-center gap-2">
          {connectionStatus === 'CONNECTING' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : connectionStatus === 'CONNECTED' ? (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <Link2 className="h-3 w-3 opacity-60" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <Unlink className="h-3 w-3 opacity-60" />
            </div>
          )}
          <span className="font-bold tracking-tight">
            {connectionStatus === 'CONNECTED'
              ? 'CONNECTED'
              : connectionStatus === 'QR_PENDING'
              ? 'PENDING SCAN'
              : connectionStatus === 'CONNECTING'
              ? 'CONNECTING...'
              : 'OFFLINE'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === 'master' && activeSessionId && connectionStatus === 'DISCONNECTED' && (
            <button
              onClick={handleReconnectWA}
              disabled={loadingWA}
              className="px-2.5 py-0.5 bg-red-500 text-white rounded text-[9px] font-black hover:bg-red-600 transition-colors uppercase"
            >
              Link Device
            </button>
          )}

          {user?.role === 'master' && connectionStatus === 'QR_PENDING' && (
            <button
              onClick={() => setShowQRModal(true)}
              className="px-2.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black hover:bg-amber-600 transition-colors uppercase"
            >
              Show QR
            </button>
          )}

          {user?.role === 'master' && activeSessionId && connectionStatus === 'CONNECTED' && (
            <button
              onClick={handleLogoutWA}
              disabled={loadingWA}
              className="text-[10px] font-bold text-muted-foreground hover:text-red-500 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-3 shrink-0 bg-white dark:bg-[#111b21]">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-emerald-500 transition-colors" />
          <Input
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            placeholder="Search name, preview, or chat id…"
            className="pl-9 h-10 bg-zinc-100 dark:bg-[#202c33] border-none focus-visible:ring-1 focus-visible:ring-emerald-500/30 rounded-xl text-[13px]"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {!activeSessionId ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {user?.role === 'master'
              ? 'Create a WhatsApp account above, then scan QR to link.'
              : 'Ask your admin to assign you a WhatsApp account.'}
          </div>
        ) : loadingChats ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground/50">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Loading chats…</span>
          </div>
        ) : sortedFilteredChats.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {searchTerm
              ? `No chats matching "${searchTerm}"`
              : 'No chats yet. Link WhatsApp to receive conversations.'}
          </div>
        ) : (
          sortedFilteredChats.map((chat) => (
            <div
              key={`${chat.sessionId || activeSessionId}-${chat.groupId}`}
              onClick={() => handleSelectChat(chat)}
              className={`
                flex flex-row px-4 py-3 items-center gap-3 cursor-pointer transition-colors
                hover:bg-secondary/10 dark:hover:bg-zinc-800/40
                ${selectedChat?.groupId === chat.groupId
                  ? 'bg-secondary/20 dark:bg-zinc-800/70 border-l-2 border-l-[#25D366]'
                  : 'border-l-2 border-l-transparent'
                }
                border-b border-border/5
              `}
            >
              <button
                type="button"
                title={isChatPinned(chat.groupId) ? 'Unpin chat' : 'Pin chat'}
                onClick={(e) => handleTogglePin(e, chat)}
                className={`p-1.5 rounded-lg shrink-0 transition-colors hover:bg-secondary/30 ${
                  isChatPinned(chat.groupId) ? 'text-amber-500' : 'text-muted-foreground/50'
                }`}
              >
                <Pin className={`h-4 w-4 ${isChatPinned(chat.groupId) ? 'fill-amber-500/25' : ''}`} />
              </button>
              <Avatar className="h-12 w-12 flex-shrink-0">
                {chat.isGroup ? (
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${chat.name}&backgroundType=gradientLinear`} />
                ) : (
                  <AvatarFallback className="bg-blue-500/10 text-blue-600">
                    <UserIcon className="h-5 w-5" />
                  </AvatarFallback>
                )}
                <AvatarFallback className="bg-emerald-500/10 text-emerald-700 font-bold text-sm">
                  {chat.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col flex-grow min-w-0">
                <div className="flex justify-between items-center mb-0.5 gap-2">
                  <span className="font-semibold text-foreground truncate text-[14px]">
                    {chat.name}
                  </span>
                  {chat.lastMessageTimestamp && (
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {formatDistanceToNow(new Date(chat.lastMessageTimestamp), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center gap-2">
                  <p className="text-[12.5px] text-muted-foreground truncate">
                    {!chat.isGroup && (
                      <span className="text-[10px] font-bold text-blue-500 mr-1">DM</span>
                    )}
                    {chat.lastMessage || (
                      <span className="italic opacity-60">No messages yet</span>
                    )}
                  </p>
                  {chat.isBackupEnabled && (
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-600 rounded px-1.5 py-0.5 whitespace-nowrap font-medium flex-shrink-0">
                      BACKUP
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  )
}
