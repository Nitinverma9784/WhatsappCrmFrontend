"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  MessageSquare,
  Database,
  Globe,
  CheckCircle2,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import api from '@/lib/api'
import { toast } from 'react-toastify'
import { useChatStore } from '@/store/useChatStore'

interface Group {
  _id: string
  groupId: string
  name: string
  isGroup: boolean
  isBackupEnabled: boolean
  lastMessage?: string
  lastMessageTimestamp?: string
  participants?: string[]
}

interface GlobalSettings {
  backupEnabled: boolean
}

export default function ChatSettingsPage() {
  const router = useRouter()
  const { activeSessionId, setActiveSessionId, setWaSessions, waSessions } = useChatStore()
  const [groups, setGroups] = useState<Group[]>([])
  const [settings, setSettings] = useState<GlobalSettings>({ backupEnabled: false })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [togglingGroup, setTogglingGroup] = useState<string | null>(null)
  const [togglingGlobal, setTogglingGlobal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'backup-on' | 'backup-off'>('all')

  useEffect(() => {
    const boot = async () => {
      try {
        const { data } = await api.get('/whatsapp/sessions')
        setWaSessions(data)
        if (!activeSessionId && data[0]) setActiveSessionId(data[0]._id)
      } catch {
        /* ignore */
      }
    }
    boot()
  }, [activeSessionId, setActiveSessionId, setWaSessions])

  const sessionId = activeSessionId

  const fetchData = useCallback(async () => {
    const sid = useChatStore.getState().activeSessionId
    if (!sid) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [groupsRes, settingsRes] = await Promise.all([
        api.get(`/whatsapp/sessions/${sid}/groups`),
        api.get(`/whatsapp/sessions/${sid}/settings`),
      ])
      setGroups(groupsRes.data)
      setSettings({ backupEnabled: settingsRes.data.backupEnabled })
    } catch (err: any) {
      if (err?.response?.status === 403) {
        router.push('/')
        return
      }
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData, sessionId])

  const handleToggleGlobal = async () => {
    if (!sessionId) return
    const newState = !settings.backupEnabled
    setTogglingGlobal(true)
    try {
      await api.post(`/whatsapp/sessions/${sessionId}/settings/global-backup`, { isEnabled: newState })
      setSettings({ backupEnabled: newState })
      toast.success(`Global backup ${newState ? 'enabled' : 'disabled'}`)
    } catch {
      toast.error('Failed to update global backup')
    } finally {
      setTogglingGlobal(false)
    }
  }

  const handleToggleGroup = async (groupId: string, currentState: boolean) => {
    if (!sessionId) return
    const newState = !currentState
    setTogglingGroup(groupId)
    try {
      await api.post(`/whatsapp/sessions/${sessionId}/toggle-backup`, { groupId, isEnabled: newState })
      setGroups(prev =>
        prev.map(g => g.groupId === groupId ? { ...g, isBackupEnabled: newState } : g)
      )
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Backup {newState ? 'enabled' : 'disabled'} for chat</span>
        </div>,
        { autoClose: 2000 }
      )
    } catch {
      toast.error('Failed to update chat backup')
    } finally {
      setTogglingGroup(null)
    }
  }

  const handleDisableAll = async () => {
    if (!sessionId) return
    if (!confirm('Disable backup for ALL chats in this WhatsApp account?')) return
    setLoading(true)
    try {
      await api.post(`/whatsapp/sessions/${sessionId}/settings/disable-all-backups`)
      await fetchData()
      toast.success('All backups disabled for this account')
    } catch {
      toast.error('Failed to disable all backups')
    } finally {
      setLoading(false)
    }
  }

  const filtered = groups.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase())
    if (filter === 'backup-on') return matchSearch && g.isBackupEnabled
    if (filter === 'backup-off') return matchSearch && !g.isBackupEnabled
    return matchSearch
  })

  const backupOnCount = groups.filter(g => g.isBackupEnabled).length
  const backupOffCount = groups.length - backupOnCount

  return (
    <div className="min-h-[100dvh] max-w-[100vw] overflow-x-hidden bg-[#f0f2f5] dark:bg-[#0b141a] pb-[max(1rem,env(safe-area-inset-bottom,0px))] font-sans">
      <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 hover:bg-secondary/20 rounded-full transition-colors">
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">Chat Backup Settings</h1>
              <p className="text-xs text-muted-foreground">Per WhatsApp number · Master Admin only</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={sessionId || ''}
              onChange={(e) => setActiveSessionId(e.target.value || null)}
              className="text-sm rounded-lg border border-border bg-white dark:bg-zinc-900 px-3 py-2 max-w-[220px]"
            >
              {waSessions.length === 0 ? (
                <option value="">No accounts</option>
              ) : (
                waSessions.map((s) => (
                  <option key={s._id} value={s._id}>{s.label}</option>
                ))
              )}
            </select>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 hover:bg-secondary/20 rounded-full transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        <div className={`rounded-2xl border p-5 flex items-center justify-between transition-all ${
          settings.backupEnabled
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-white dark:bg-zinc-900 border-border'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${settings.backupEnabled ? 'bg-emerald-500/10' : 'bg-zinc-500/10'}`}>
              <Globe className={`h-6 w-6 ${settings.backupEnabled ? 'text-emerald-600' : 'text-zinc-500'}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Global Backup</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When ON, media backup rules apply to all chats (images always stored for preview)
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleGlobal}
            disabled={togglingGlobal || !sessionId}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
              settings.backupEnabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
              settings.backupEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleDisableAll}
            disabled={loading || groups.length === 0 || !sessionId}
            className="flex items-center gap-2 text-[11px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all disabled:opacity-30"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Disable All (this account)
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Chats', value: groups.length, icon: MessageSquare, color: 'blue' },
            { label: 'Backup ON', value: backupOnCount, icon: ShieldCheck, color: 'emerald' },
            { label: 'Backup OFF', value: backupOffCount, icon: ShieldAlert, color: 'zinc' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-border p-4 text-center">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2 bg-${color}-500/10`}>
                <Icon className={`h-5 w-5 text-${color}-500`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="pl-9 bg-white dark:bg-zinc-900 border-border h-10"
            />
          </div>
          <div className="flex rounded-xl overflow-hidden border border-border bg-white dark:bg-zinc-900 shrink-0">
            {(['all', 'backup-on', 'backup-off'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-emerald-500 text-white'
                    : 'text-muted-foreground hover:bg-secondary/20'
                }`}
              >
                {f === 'all' ? 'All' : f === 'backup-on' ? '✓ Backup ON' : '✗ Backup OFF'}
              </button>
            ))}
          </div>
        </div>

        {!sessionId ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Database className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select or create a WhatsApp account from the main chat screen.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <span className="text-sm">Loading chats…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Database className="h-12 w-12 opacity-20" />
            <p className="text-sm">
              {search ? `No chats matching "${search}"` : 'No chats found'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(group => {
              const isToggling = togglingGroup === group.groupId
              return (
                <div
                  key={group.groupId}
                  className={`bg-white dark:bg-zinc-900 rounded-xl border transition-all ${
                    group.isBackupEnabled
                      ? 'border-emerald-200 dark:border-emerald-800/50'
                      : 'border-border'
                  } p-4 flex items-center justify-between gap-4`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-11 w-11 flex-shrink-0">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${group.name}&backgroundType=gradientLinear`}
                      />
                      <AvatarFallback className="font-bold text-sm bg-emerald-500/10 text-emerald-700">
                        {group.name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate text-[14px]">{group.name}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          group.isGroup
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'bg-purple-500/10 text-purple-600'
                        }`}>
                          {group.isGroup ? 'GROUP' : 'DM'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {group.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs font-semibold hidden sm:block ${
                      group.isBackupEnabled ? 'text-emerald-600' : 'text-zinc-400'
                    }`}>
                      {group.isBackupEnabled ? 'ON' : 'OFF'}
                    </span>
                    <button
                      onClick={() => handleToggleGroup(group.groupId, group.isBackupEnabled)}
                      disabled={isToggling}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
                        group.isBackupEnabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 className="h-3.5 w-3.5 text-white animate-spin absolute left-1/2 -translate-x-1/2" />
                      ) : (
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          group.isBackupEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
