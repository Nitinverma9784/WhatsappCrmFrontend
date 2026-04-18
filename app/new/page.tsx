"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MessageSquare, Lock, Loader2, Copy, CheckCircle2, KeyRound, QrCode } from 'lucide-react'
import { toast } from 'react-toastify'

const apiBase = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

type WaStatus = {
  status: string
  qr?: string | null
  reconnectAttempts?: number
}

type DonePayload = {
  username: string
  password: string
  loginUrl: string
}

export default function ShareSetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'gate' | 'qr' | 'done'>('gate')
  const [gatePassword, setGatePassword] = useState('')
  const [starting, setStarting] = useState(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null)
  const [waStatus, setWaStatus] = useState<WaStatus | null>(null)
  const [completing, setCompleting] = useState(false)
  const [done, setDone] = useState<DonePayload | null>(null)
  const [copied, setCopied] = useState<'user' | 'pass' | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bootConnectSent = useRef(false)
  const completeAttempted = useRef(false)

  const authHeaders = useCallback((): HeadersInit => {
    if (!onboardingToken) return {}
    return { Authorization: `Bearer ${onboardingToken}` }
  }, [onboardingToken])

  const fetchStatus = useCallback(async () => {
    if (!sessionId || !onboardingToken) return null
    const res = await fetch(`${apiBase()}/onboarding/share/${sessionId}/status`, {
      headers: authHeaders(),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error((j as { message?: string }).message || res.statusText)
    }
    return (await res.json()) as WaStatus
  }, [sessionId, onboardingToken, authHeaders])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (step !== 'qr' || !sessionId || !onboardingToken) return

    const tick = async () => {
      try {
        const s = await fetchStatus()
        if (!s) return
        setWaStatus(s)

        if (s.status === 'DISCONNECTED' && !s.qr && !bootConnectSent.current) {
          bootConnectSent.current = true
          await fetch(`${apiBase()}/onboarding/share/${sessionId}/connect`, {
            method: 'POST',
            headers: authHeaders(),
          }).catch(() => {})
        }

        if (s.status === 'CONNECTED' && !completeAttempted.current) {
          completeAttempted.current = true
          setCompleting(true)
          try {
            const res = await fetch(`${apiBase()}/onboarding/share/${sessionId}/complete`, {
              method: 'POST',
              headers: authHeaders(),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Could not create account')
            setDone({
              username: data.username,
              password: data.password,
              loginUrl: data.loginUrl || '/login',
            })
            setStep('done')
            if (pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }
            toast.success('Account created. Save your login details.')
          } catch (e: unknown) {
            completeAttempted.current = false
            toast.error((e as Error).message || 'Failed to finish setup')
          } finally {
            setCompleting(false)
          }
        }
      } catch (e: unknown) {
        toast.error((e as Error).message || 'Status error')
      }
    }

    tick()
    pollRef.current = setInterval(tick, 2000)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [step, sessionId, onboardingToken, fetchStatus, authHeaders])

  const handleGate = async (e: React.FormEvent) => {
    e.preventDefault()
    setStarting(true)
    try {
      const res = await fetch(`${apiBase()}/onboarding/share/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: gatePassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Invalid password')
      bootConnectSent.current = false
      completeAttempted.current = false
      setSessionId(data.sessionId)
      setOnboardingToken(data.onboardingToken)
      setStep('qr')
      toast.success('Scan the QR code with WhatsApp on your phone.')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Could not start setup')
    } finally {
      setStarting(false)
    }
  }

  const handleRetryQr = async () => {
    if (!sessionId || !onboardingToken) return
    bootConnectSent.current = true
    try {
      await fetch(`${apiBase()}/onboarding/share/${sessionId}/connect`, {
        method: 'POST',
        headers: authHeaders(),
      })
      toast.info('Refreshing QR…')
      const s = await fetchStatus()
      if (s) setWaStatus(s)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Retry failed')
    }
  }

  const copyText = async (field: 'user' | 'pass', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#f0f2f5] dark:bg-[#0b141a] flex items-center justify-center p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <div className="absolute top-0 h-48 w-full bg-[#00a884] dark:bg-[#005c4b] -z-10" />

      <div className="max-w-md w-full space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
        <div className="text-center text-white space-y-2">
          <div className="h-16 w-16 bg-white dark:bg-zinc-800 rounded-full mx-auto flex items-center justify-center p-3 shadow-xl">
            <MessageSquare className="h-full w-full text-[#00a884]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Set up WhatsApp CRM</h1>
          <p className="text-white/85 text-sm max-w-sm mx-auto leading-relaxed">
            For hosts: share this page so someone can link their WhatsApp and get their own CRM login.
          </p>
        </div>

        {step === 'gate' && (
          <Card className="border-none shadow-2xl p-2 bg-white dark:bg-[#111b21] rounded-2xl">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-xl font-semibold">Enter setup password</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Ask your host for the password, then continue to the WhatsApp QR step.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGate} className="space-y-4">
                <div className="space-y-2 relative">
                  <Lock className="absolute left-3 top-[2.9rem] h-4 w-4 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground block">Password</label>
                  <Input
                    value={gatePassword}
                    onChange={(e) => setGatePassword(e.target.value)}
                    type="password"
                    autoComplete="off"
                    placeholder="Setup password"
                    className="pl-10 h-12 bg-secondary/10 border-none rounded-xl"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={starting}
                  className="w-full h-12 bg-[#00a884] hover:bg-[#06cf9c] text-lg font-semibold"
                >
                  {starting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2 inline" />
                      Starting…
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center text-center">
              <Link href="/login" className="text-sm text-[#00a884] hover:underline">
                Already have an account? Sign in
              </Link>
            </CardFooter>
          </Card>
        )}

        {step === 'qr' && (
          <Card className="border-none shadow-2xl p-2 bg-white dark:bg-[#111b21] rounded-2xl">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-xl font-semibold flex items-center justify-center gap-2">
                <QrCode className="h-5 w-5" />
                Link WhatsApp
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Open WhatsApp → Linked devices → Link a device, then scan this code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col items-center">
              <div className="rounded-2xl border border-border/40 bg-white p-4 shadow-inner min-h-[248px] min-w-[248px] flex items-center justify-center">
                {waStatus?.qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={waStatus.qr} alt="WhatsApp QR" className="h-56 w-56 object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground text-sm px-4 text-center max-w-[240px]">
                    <Loader2 className="h-10 w-10 animate-spin text-[#00a884]" />
                    {waStatus?.status === 'CONNECTING' ? (
                      <span>Preparing QR code…</span>
                    ) : (
                      <span>Waiting for QR code… If this takes long, tap refresh below.</span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Status: <span className="font-mono">{waStatus?.status ?? '…'}</span>
                {completing && (
                  <span className="block mt-2 text-[#00a884]">
                    <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                    Creating your account…
                  </span>
                )}
              </p>
              <Button type="button" variant="outline" className="w-full" onClick={handleRetryQr}>
                Refresh QR / reconnect
              </Button>
            </CardContent>
            <CardFooter className="justify-center">
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Cancel and return to login
              </Link>
            </CardFooter>
          </Card>
        )}

        {step === 'done' && done && (
          <Card className="border-none shadow-2xl p-2 bg-white dark:bg-[#111b21] rounded-2xl">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <CardTitle className="text-xl font-semibold">Save your login</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                This password is shown only once. Copy it now, then sign in to use the CRM and share this setup link
                with others.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-secondary/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Username</p>
                    <p className="font-mono text-sm truncate">{done.username}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="shrink-0"
                    aria-label="Copy username"
                    onClick={() => copyText('user', done.username)}
                  >
                    {copied === 'user' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Password</p>
                    <p className="font-mono text-sm break-all">{done.password}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="shrink-0"
                    aria-label="Copy password"
                    onClick={() => copyText('pass', done.password)}
                  >
                    {copied === 'pass' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                className="w-full h-12 bg-[#00a884] hover:bg-[#06cf9c] font-semibold gap-2"
                onClick={() => router.push('/login')}
              >
                <KeyRound className="h-5 w-5" />
                Go to sign in
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
