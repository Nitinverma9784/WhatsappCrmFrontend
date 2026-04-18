"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ChatHeader from '@/components/ChatHeader'
import ChatWindow from '@/components/ChatWindow'
import MessageInput from '@/components/MessageInput'
import ConnectionBanner from '@/components/ConnectionBanner'
import { useChatStore } from '@/store/useChatStore'
import { useSocket } from '@/hooks/useSocket'
import api from '@/lib/api'
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, CheckCircle2, X } from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const {
    user,
    setUser,
    selectedChat,
    connectionStatus,
    qrCode,
    showQRModal,
    setShowQRModal,
    setConnectionStatus,
    activeSessionId,
  } = useChatStore()

  const isMaster = user?.role === 'master'

  useEffect(() => {
    if (user?.role === 'sub') setShowQRModal(false)
  }, [user?.role, setShowQRModal])

  const [authLoading, setAuthLoading] = useState(true)
  const [justConnected, setJustConnected] = useState(false)
  const [retryVisible, setRetryVisible] = useState(false)

  const { joinRoom } = useSocket()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          router.push('/login')
          return
        }
        const { data } = await api.get('/auth/me')
        setUser(data)
      } catch (err) {
        console.error('Auth error:', err)
        router.push('/login')
      } finally {
        setAuthLoading(false)
      }
    }
    checkAuth()
  }, [router, setUser])

  useEffect(() => {
    if (authLoading || !user || !activeSessionId) return
    const fetchStatus = async () => {
      try {
        const { data } = await api.get(`/whatsapp/sessions/${activeSessionId}/status`)
        setConnectionStatus(data.status, data.qr)

        // Only the master links WhatsApp (QR). Sub-users use CRM login only; session lives in DB.
        if (
          user.role === 'master' &&
          (data.status === 'DISCONNECTED' || data.status === 'QR_PENDING')
        ) {
          setShowQRModal(true)
          if (data.status === 'DISCONNECTED' && !data.qr) {
            api.post(`/whatsapp/sessions/${activeSessionId}/connect`).catch(console.error)
          }
        }
      } catch (err) {
        console.error('Error fetching WA status:', err)
      }
    }
    fetchStatus()
  }, [authLoading, user, activeSessionId, setConnectionStatus, setShowQRModal])

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    if (showQRModal && !qrCode && !justConnected) {
      t = setTimeout(() => setRetryVisible(true), 10000)
    } else {
      setRetryVisible(false)
    }
    return () => clearTimeout(t)
  }, [showQRModal, qrCode, justConnected])

  const handleRetryQR = async () => {
    if (!activeSessionId || !isMaster) return
    setRetryVisible(false)
    try {
      await api.post(`/whatsapp/sessions/${activeSessionId}/connect`)
    } catch (err) {
      console.error('Retry error:', err)
    }
  }

  useEffect(() => {
    if (connectionStatus === 'CONNECTED' && showQRModal) {
      setJustConnected(true)
      const t = setTimeout(() => {
        setJustConnected(false)
        setShowQRModal(false)
      }, 1800)
      return () => clearTimeout(t)
    }
  }, [connectionStatus, showQRModal, setShowQRModal])

  useEffect(() => {
    if (selectedChat) {
      joinRoom(selectedChat.groupId)
    }
  }, [selectedChat, joinRoom])

  if (authLoading) {
    return (
      <div className="flex h-[100dvh] min-h-0 w-full max-w-[100vw] bg-whatsapp-light-bg dark:bg-whatsapp-dark-bg p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
        <Skeleton className="hidden sm:block w-full sm:max-w-[380px] md:w-[35%] h-full rounded-xl shrink-0" />
        <Skeleton className="flex-1 min-w-0 h-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full max-w-[100vw] bg-whatsapp-light-bg dark:bg-whatsapp-dark-bg overflow-hidden relative font-sans text-foreground supports-[height:100dvh]:h-[100dvh]">
      <div
        className={`h-full min-h-0 min-w-0 border-r border-border w-full md:max-w-[400px] md:w-[35%] shrink-0 transition-all duration-300 ${
          selectedChat ? 'hidden md:flex' : 'flex flex-col'
        }`}
      >
        <Sidebar />
      </div>

      <div
        className={`flex flex-col flex-1 min-w-0 min-h-0 h-full relative transition-all duration-300 ${
          !selectedChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatHeader />
        <ConnectionBanner />
        <ChatWindow />
        <MessageInput />
      </div>

      {showQRModal && activeSessionId && isMaster && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-500">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-[0_0_50px_-12px_rgba(37,211,102,0.4)] max-w-sm w-full text-center space-y-6 border border-emerald-500/20 relative animate-in fade-in zoom-in duration-300">

            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-5 right-5 text-muted-foreground hover:text-foreground hover:bg-secondary/20 p-1.5 rounded-full transition-all"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-3">
                <div className="h-10 w-10 bg-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-[#25D366]/20">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.529 5.849L.057 23.571a.5.5 0 0 0 .612.612l5.722-1.472A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.854 0-3.6-.498-5.107-1.368l-.362-.214-3.742.962.982-3.637-.235-.374A9.959 9.959 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold dark:text-white tracking-tight">WhatsApp Link</h2>
              </div>
              <p className="text-sm text-muted-foreground px-4 leading-relaxed mt-2">
                Open WhatsApp on your phone → <span className="font-semibold text-foreground">Linked Devices</span> → <span className="font-semibold text-foreground">Link a Device</span>
              </p>
            </div>

            <div className="flex flex-col items-center justify-center min-h-[260px] relative">
              {justConnected ? (
                <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-12 w-12 text-[#25D366]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground">Successfully Connected!</h3>
                    <p className="text-sm text-muted-foreground">Enjoy your CRM messaging...</p>
                  </div>
                </div>
              ) : connectionStatus === 'CONNECTING' && !qrCode ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="h-24 w-24 border-4 border-t-[#25D366] border-secondary rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <Loader2 className="h-8 w-8 text-emerald-500 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing connection...</p>
                    {retryVisible && (
                      <button
                        onClick={handleRetryQR}
                        className="text-[11px] bg-red-500/10 text-red-600 hover:bg-red-500/20 px-3 py-1 rounded-full border border-red-500/20 transition-all font-semibold"
                      >
                        Force Retry Refresh
                      </button>
                    )}
                  </div>
                </div>
              ) : qrCode ? (
                <div className="space-y-5 animate-in fade-in duration-700">
                  <div className="bg-white p-4 rounded-3xl inline-block border-2 border-emerald-500/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative">
                    <img
                      src={qrCode}
                      alt="WhatsApp QR Code"
                      className="h-60 w-60 object-contain selection:bg-transparent"
                      onError={(e) => {
                        const el = e.currentTarget
                        if (!el.src.includes('qrserver.com')) {
                          el.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrCode || '')}&format=png&ecc=H`
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-4 py-1.5 rounded-full">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      Ready to Scan
                    </div>
                    {retryVisible && (
                      <button
                         onClick={handleRetryQR}
                         className="text-[11px] bg-red-500/10 text-red-600 hover:bg-red-500/20 px-3 py-1 rounded-full border border-red-500/20 transition-all font-semibold"
                      >
                         Refresh QR
                      </button>
                    )}
                    <p className="text-[11px] text-muted-foreground/60">
                      QR code refreshes automatically every ~60s
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                   <div className="h-24 w-24 border-4 border-t-[#25D366] border-secondary rounded-full animate-spin"></div>
                   <div className="space-y-1">
                     <p className="text-sm font-semibold text-foreground">Waiting for WhatsApp status...</p>
                     <p className="text-[12px] text-muted-foreground">Checking connection health</p>
                     {retryVisible && (
                        <button
                          onClick={handleRetryQR}
                          className="mt-2 text-[11px] bg-red-500/10 text-red-600 hover:bg-red-500/20 px-3 py-1 rounded-full border border-red-500/20 transition-all font-semibold"
                        >
                          Retry Connection
                        </button>
                     )}
                   </div>
                </div>
              )}
            </div>

            {!justConnected && (
               <div className="pt-2">
                 <p className="text-[11px] text-muted-foreground bg-secondary/30 py-2 px-4 rounded-xl inline-block italic">
                   Tip: Keep your phone connected to the internet
                 </p>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
