"use client"

import React, { useState, useEffect, useCallback } from 'react'
import {
  MoreVertical,
  RotateCw,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useChatStore } from '@/store/useChatStore'
import { ThemeToggle } from './ThemeToggle'
import api from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function ChatHeader() {
  const {
    selectedChat,
    setSelectedChat,
    triggerMessageRefresh,
    user,
    setGroups,
    groups,
    updateSelectedChat,
    activeSessionId,
    bumpScrollChatBottom,
  } = useChatStore()

  const [refreshing, setRefreshing] = useState(false)
  // Backup toggle state — starts as false/unknown, fetched from DB on chat open
  const [backupEnabled, setBackupEnabled] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  // "Synced ✓" toast — shown when backup is turned ON
  const [showSyncedToast, setShowSyncedToast] = useState(false)
  const [syncingHistory, setSyncingHistory] = useState(false)

  // Fetch the real backup state from DB when a chat is opened
  // This is the only place we read from DB — state resets to false on every chat switch
  useEffect(() => {
    if (!selectedChat) return
    setBackupEnabled(false) // always reset first
    setShowSyncedToast(false)

    const fetchBackupState = async () => {
      if (!activeSessionId) return
      try {
        const { data } = await api.get(
          `/whatsapp/sessions/${activeSessionId}/group-backup/${selectedChat.groupId}`
        )
        setBackupEnabled(data.isBackupEnabled === true)
      } catch {
        setBackupEnabled(false)
      }
    }
    fetchBackupState()
  }, [selectedChat?.groupId, activeSessionId])

  /**
   * "Sync to WA" button handler.
   * 1. Calls the backend /sync endpoint which triggers fetchMessageHistory on the phone
   * 2. Phone sends messages back via messaging-history.set event (real-time via socket)
   * 3. Also bumps messageRefreshToken to force ChatWindow to re-fetch DB immediately
   */
  const handleRefresh = useCallback(async () => {
    if (refreshing || !selectedChat) return
    setRefreshing(true)
    try {
      if (!activeSessionId) return
      await api.get(
        `/whatsapp/sessions/${activeSessionId}/messages/${selectedChat.groupId}/sync?count=100`
      )
    } catch (err) {
      console.warn('[ChatHeader] Sync request failed:', err)
    } finally {
      // Always bump the refresh token so ChatWindow re-fetches DB (even if sync failed)
      triggerMessageRefresh()
      setTimeout(() => setRefreshing(false), 1500)
    }
  }, [refreshing, selectedChat, activeSessionId, triggerMessageRefresh])

  /**
   * Toggle backup for this group.
   * When enabled → show "Synced ✓" popup for 3s.
   * When disabled → hide popup.
   */
  const handleToggleBackup = async () => {
    if (backupLoading || !selectedChat) return
    const newState = !backupEnabled
    setBackupLoading(true)
    try {
      if (!activeSessionId) return
      await api.post(`/whatsapp/sessions/${activeSessionId}/toggle-backup`, {
        groupId: selectedChat.groupId,
        enabled: newState,
      })
      setBackupEnabled(newState)

      // Update sidebar badge
      setGroups(groups.map(g =>
        g.groupId === selectedChat.groupId
          ? { ...g, isBackupEnabled: newState }
          : g
      ))
      updateSelectedChat({ isBackupEnabled: newState })

      // Show "Up to date" popup when enabling
      if (newState) {
        setShowSyncedToast(true)
        setTimeout(() => setShowSyncedToast(false), 3500)
      } else {
        setShowSyncedToast(false)
      }
    } catch (err) {
      console.error('Toggle backup error:', err)
    } finally {
      setBackupLoading(false)
    }
  }

  /**
   * Sync History: Trigger historical fetch from WhatsApp
   * Calls /sync endpoint in backend and then refreshes the UI.
   */
  const handleSyncHistory = async () => {
    if (syncingHistory || !selectedChat) return
    setSyncingHistory(true)
    try {
      if (!activeSessionId) return
      await api.get(`/whatsapp/sessions/${activeSessionId}/messages/${selectedChat.groupId}/sync`)
      triggerMessageRefresh()
      // Brief delay to show completion
      setTimeout(() => setSyncingHistory(false), 1000)
    } catch (err) {
      console.error('History sync error:', err)
      setSyncingHistory(false)
    }
  }

  if (!selectedChat) return null

  return (
    <div className="relative flex flex-wrap items-center gap-y-2 justify-between gap-x-2 px-2 sm:px-3 py-2 sm:py-2.5 bg-whatsapp-light-panel dark:bg-zinc-800/80 border-b border-border shadow-sm z-10 shrink-0 min-w-0">

      {/* "Up to date" sync toast */}
      {showSyncedToast && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 bg-emerald-500 text-white text-[12.5px] font-semibold px-4 py-2 rounded-full shadow-lg">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            Backup enabled — messages will now sync to database
          </div>
        </div>
      )}

      {/* Left: back button + chat info */}
      <div className="flex items-center gap-2 overflow-hidden min-w-0">
        <button
          onClick={() => setSelectedChat(null)}
          className="md:hidden p-1.5 hover:bg-secondary/20 rounded-full transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>

        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedChat.name}`} />
          <AvatarFallback className="font-bold text-sm">
            {selectedChat.name[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <button
          type="button"
          onClick={() => bumpScrollChatBottom()}
          title="Jump to latest messages"
          className="flex flex-col min-w-0 text-left rounded-lg px-1.5 py-0.5 -mx-0.5 hover:bg-secondary/25 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <span className="flex items-center gap-1 min-w-0">
            <span className="font-semibold text-foreground truncate text-[14px]">
              {selectedChat.name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70" aria-hidden />
          </span>
          <p className="text-[11px] text-muted-foreground truncate">
            {selectedChat.isGroup
              ? `${selectedChat.participants?.length || 0} participants`
              : 'Direct Message'}
          </p>
        </button>
      </div>

      {/* Right: actions */}
      <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2 md:gap-3 text-muted-foreground flex-shrink-0 max-w-full min-w-0">

        {/* Backup toggle — master only */}
        {user?.role === 'master' && (
          <div className="flex items-center gap-1.5">
            {/* Sync Button */}
            <button
               onClick={handleSyncHistory}
               disabled={syncingHistory}
               title="Sync historical messages from phone"
               className={`
                 hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border transition-all duration-200
                 ${syncingHistory 
                   ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' 
                   : 'bg-indigo-500/5 text-indigo-500 border-indigo-500/10 hover:bg-indigo-500/10 hover:border-indigo-500/30'}
               `}
            >
               {syncingHistory ? (
                 <Loader2 className="h-3.5 w-3.5 animate-spin" />
               ) : (
                 <RotateCw className="h-3.5 w-3.5" />
               )}
               <span>{syncingHistory ? 'Syncing...' : 'Full Sync'}</span>
            </button>

            <button
              onClick={handleToggleBackup}
              disabled={backupLoading}
              title={backupEnabled ? 'Disable backup' : 'Enable backup'}
              className={`
                hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border
                transition-all duration-200 cursor-pointer disabled:opacity-50
                ${backupEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-zinc-500/20'
                }
              `}
            >
              {backupLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : backupEnabled ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" />
              )}
              <span>{backupEnabled ? 'Backup ON' : 'Backup OFF'}</span>
            </button>
          </div>
        )}

        {/* Sync Latest (User Requested) */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Sync latest messages from WhatsApp"
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-all duration-200 cursor-pointer
            ${refreshing
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
            }
          `}
        >
          <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{refreshing ? 'Syncing...' : 'Sync to WA'}</span>
          <span className="sm:hidden">{refreshing ? '…' : 'Sync'}</span>
        </button>

        <ThemeToggle />

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 hover:bg-secondary/20 rounded-full outline-none transition-colors">
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={handleRefresh} disabled={refreshing}>
              <RotateCw className="h-4 w-4 mr-2" />
              Refresh Chat
            </DropdownMenuItem>
            {user?.role === 'master' && (
              <>
                <DropdownMenuItem onClick={handleSyncHistory} disabled={syncingHistory}>
                  <RotateCw className={`h-4 w-4 mr-2 ${syncingHistory ? 'animate-spin' : ''}`} />
                  Full History Sync
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleBackup} disabled={backupLoading}>
                  {backupEnabled ? (
                    <><ShieldAlert className="h-4 w-4 mr-2 text-orange-500" /> Disable Backup</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4 mr-2 text-emerald-500" /> Enable Backup</>
                  )}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              className="text-rose-500 md:hidden"
              onClick={() => setSelectedChat(null)}
            >
              ← Back to chats
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
