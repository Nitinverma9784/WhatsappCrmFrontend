"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MessageSquare, ShieldCheck, Mail, Lock } from 'lucide-react'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import api from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { username, password })
      localStorage.setItem('token', data.token)
      toast.success('Logged in successfully!', { theme: 'colored' })
      router.push('/')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#f0f2f5] dark:bg-[#0b141a] flex items-center justify-center p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <ToastContainer />
      <div className="absolute top-0 h-48 w-full bg-[#00a884] dark:bg-[#005c4b] -z-10" />
      
      <div className="max-w-md w-full space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
        <div className="text-center text-white space-y-2">
            <div className="h-16 w-16 bg-white dark:bg-zinc-800 rounded-full mx-auto flex items-center justify-center p-3 shadow-xl">
               <MessageSquare className="h-full w-full text-[#00a884]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">WhatsApp CRM</h1>
            <p className="text-white/80 text-sm">Professional WhatsApp Management Platform</p>
        </div>

        <Card className="border-none shadow-2xl p-2 bg-white dark:bg-[#111b21] rounded-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold">Sign In</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Enter your credentials to access your CRM dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2 relative">
                <Mail className="absolute left-3 top-10 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username" 
                  className="pl-10 h-12 bg-secondary/10 border-none rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2 relative">
                <Lock className="absolute left-3 top-10 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password" 
                  placeholder="Password"
                  className="pl-10 h-12 bg-secondary/10 border-none rounded-xl"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-[#00a884] hover:bg-[#06cf9c] text-lg font-bold transition-all shadow-md active:scale-95"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 text-center pb-8 border-t border-border/10 mt-4 pt-6">
            <Link
              href="/new"
              className="text-sm text-[#00a884] hover:underline font-medium"
            >
              Got an invite? Set up WhatsApp and get your login
            </Link>
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60 justify-center">
               <ShieldCheck className="h-3 w-3" />
               Enterprise grade WhatsApp API encryption enabled
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
