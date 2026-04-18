"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from 'react-toastify'
import { UserPlus, Settings, LayoutDashboard, GroupIcon, Smartphone, KeyRound, Trash2, Copy, Eye, EyeOff } from 'lucide-react'
import { useChatStore } from '@/store/useChatStore'

type FlatGroup = {
  groupId: string
  name: string
  sessionId: { _id: string; label: string } | string
}

export default function UserManagement() {
  const router = useRouter()
  const { user } = useChatStore()
  const [users, setUsers] = useState<any[]>([])
  const [allGroups, setAllGroups] = useState<FlatGroup[]>([])
  const [sessions, setSessions] = useState<{ _id: string; label: string }[]>([])
  const [newUser, setNewUser] = useState({ username: '', password: '', nickname: '' })
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([])
  const [assignedSessionIds, setAssignedSessionIds] = useState<string[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const isSuperAdmin = user?.username === 'masteradmin'

  const generatePassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    const chars = Array.from(crypto.getRandomValues(new Uint32Array(14)), (n) => alphabet[n % alphabet.length])
    return chars.join('')
  }

  useEffect(() => {
    if (user?.role !== 'master') {
      router.push('/')
      return
    }
    fetchData()
  }, [user, router])

  const fetchData = async () => {
    try {
      const [uRes, gRes, sRes] = await Promise.all([
        api.get('/whatsapp/users'),
        api.get('/whatsapp/groups-all'),
        api.get('/whatsapp/sessions'),
      ])
      setUsers(uRes.data)
      setAllGroups(gRes.data)
      setSessions(sRes.data.map((s: any) => ({ _id: s._id, label: s.label })))
      if (isSuperAdmin) {
        const { data } = await api.get('/whatsapp/tenants')
        setTenants(data)
      }
    } catch (err) {
      toast.error('Failed to load management data')
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/auth/register-sub', newUser)
      toast.success('Sub-user created!')
      setNewUser({ username: '', password: '', nickname: '' })
      fetchData()
    } catch (err) {
      toast.error('Failed to create user')
    }
  }

  const handleAssignAccess = async () => {
    if (!selectedUser) return
    try {
      await api.post('/whatsapp/assign-access', {
        userId: selectedUser._id,
        groupIds: assignedGroupIds,
        sessionIds: assignedSessionIds,
      })
      toast.success('Access saved successfully!')
      fetchData()
      setSelectedUser(null)
    } catch (err) {
      toast.error('Failed to save access')
    }
  }

  const handleDeleteUser = async (u: any) => {
    if (!confirm(`Delete user @${u.username}?`)) return
    try {
      await api.delete(`/whatsapp/users/${u._id}`)
      toast.success('User deleted')
      if (selectedUser?._id === u._id) setSelectedUser(null)
      fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete user')
    }
  }

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm('Delete this tenant and all its sessions/chats/users permanently?')) return
    try {
      await api.delete(`/whatsapp/tenants/${tenantId}`)
      toast.success('Tenant deleted')
      fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete tenant')
    }
  }

  const toggleGroup = (groupId: string) => {
    setAssignedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    )
  }

  const toggleSession = (sessionId: string) => {
    setAssignedSessionIds(prev =>
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    )
  }

  const sessionLabel = (g: FlatGroup) => {
    const s = g.sessionId
    if (s && typeof s === 'object' && 'label' in s) return s.label
    return 'Account'
  }

  const handleGeneratePassword = () => {
    setNewUser((prev) => ({ ...prev, password: generatePassword() }))
    toast.success('Random password generated')
  }

  const handleCopyPassword = async () => {
    if (!newUser.password) {
      toast.error('No password to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(newUser.password)
      toast.success('Password copied')
    } catch {
      toast.error('Failed to copy password')
    }
  }

  return (
    <div className="min-h-[100dvh] max-w-[100vw] overflow-x-hidden bg-secondary/10 dark:bg-[#0b141a] p-3 sm:p-4 md:p-8 pb-[max(1rem,env(safe-area-inset-bottom,0px))] font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-[#00a884]">User Management</h1>
          <Button variant="outline" onClick={() => router.push('/')} className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Back to Chat
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="border-none shadow-lg dark:bg-[#111b21]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#00a884]" />
                Create Sub-User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <Input
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="bg-secondary/20 border-none"
                  required
                />
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="bg-secondary/20 border-none"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPassword}
                    title="Copy password"
                    aria-label="Copy password"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePassword}
                  className="w-full"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Generate Password
                </Button>
                <Input
                  placeholder="Nickname (e.g. Nitin)"
                  value={newUser.nickname}
                  onChange={(e) => setNewUser({ ...newUser, nickname: e.target.value })}
                  className="bg-secondary/20 border-none"
                  required
                />
                <Button type="submit" className="w-full bg-[#00a884] hover:bg-[#00a884]/90">
                  Register User
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg dark:bg-[#111b21]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#00a884]" />
                Manage Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ScrollArea className="h-64 border rounded-md p-4 bg-secondary/5">
                {users.map(u => (
                  <div
                    key={u._id}
                    onClick={() => {
                      setSelectedUser(u)
                      setAssignedGroupIds(u.assignedGroups || [])
                      setAssignedSessionIds((u.assignedSessions || []).map((x: any) => String(x)))
                    }}
                    className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors mb-2 ${selectedUser?._id === u._id ? 'bg-[#00a884]/10 border border-[#00a884]/30' : 'hover:bg-secondary/10'}`}
                  >
                    <div>
                      <p className="font-semibold">{u.nickname}</p>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs px-2 py-1 rounded bg-secondary/20 uppercase tracking-tighter shadow-sm font-bold">
                        {(u.assignedSessions || []).length} WA · {u.assignedGroups?.length || 0} chats
                      </div>
                      <button
                        type="button"
                        title="Delete user"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteUser(u)
                        }}
                        className="p-1 rounded hover:bg-red-500/10 text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </ScrollArea>

              {selectedUser && (
                <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="space-y-2">
                    <h3 className="font-bold flex items-center gap-2 text-sm uppercase text-muted-foreground/80 tracking-widest">
                      <Smartphone className="h-4 w-4" />
                      WhatsApp accounts for {selectedUser.nickname}
                    </h3>
                    <ScrollArea className="h-32 border rounded-md p-3">
                      {sessions.map(s => (
                        <div key={s._id} className="flex items-center gap-3 p-2 hover:bg-secondary/10 rounded">
                          <Checkbox
                            checked={assignedSessionIds.includes(s._id)}
                            onCheckedChange={() => toggleSession(s._id)}
                            className="accent-[#00a884]"
                          />
                          <span className="text-sm">{s.label}</span>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold flex items-center gap-2 text-sm uppercase text-muted-foreground/80 tracking-widest">
                      <GroupIcon className="h-4 w-4" />
                      Chats (optional filter — leave empty for all chats in assigned accounts)
                    </h3>
                    <ScrollArea className="h-48 border rounded-md p-3">
                      {allGroups.map(g => (
                        <div key={`${g.groupId}-${sessionLabel(g)}`} className="flex items-center gap-3 p-2 hover:bg-secondary/10 rounded">
                          <Checkbox
                            checked={assignedGroupIds.includes(g.groupId)}
                            onCheckedChange={() => toggleGroup(g.groupId)}
                            className="accent-[#00a884]"
                          />
                          <span className="text-sm truncate">
                            <span className="text-[10px] font-bold text-muted-foreground mr-1">{sessionLabel(g)}</span>
                            {g.name}
                          </span>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>

                  <Button onClick={handleAssignAccess} className="w-full bg-[#00a884] translate-y-2">
                    Save Access
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {isSuperAdmin && (
          <Card className="border-none shadow-lg dark:bg-[#111b21]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#00a884]" />
                All Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-56 border rounded-md p-4 bg-secondary/5">
                {tenants.map((t) => (
                  <div key={t.tenantId} className="flex items-center justify-between p-3 mb-2 rounded-lg hover:bg-secondary/10">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{t.master?.nickname || 'Master'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{t.master?.username || 'unknown'} · {t.sessions} WA
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTenant(t.tenantId)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                      title="Delete tenant"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
