"use client"

import React, { useState, useEffect } from 'react'
import { Wifi, WifiOff, Loader2, RefreshCw, QrCode, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useChatStore } from '@/store/useChatStore'
import api from '@/lib/api'
import { toast } from 'react-toastify'

/**
 * ConnectionBanner — shows in the top of the chat area when WhatsApp is not connected.
 * Only shown to master admins. For sub-users: shows a simple read-only status.
 */
export default function ConnectionBanner() {
  const { connectionStatus, user, qrCode, activeSessionId } = useChatStore()
  const [reconnecting, setReconnecting] = useState(false)

  // Don't render if connected
  if (connectionStatus === 'CONNECTED') return null

  const handleReconnect = async () => {
    if (reconnecting) return
    setReconnecting(true)
    try {
      if (!activeSessionId) return
      await api.post(`/whatsapp/sessions/${activeSessionId}/connect`)
      toast.info('Reconnecting to WhatsApp…', { autoClose: 2000 })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message
      toast.error(`Reconnect failed: ${msg}`)
    } finally {
      // Keep spinner until socket fires CONNECTED or QR_PENDING
      setTimeout(() => setReconnecting(false), 5000)
    }
  }

  return (
    <div
      className={`
        flex flex-wrap items-center gap-y-2 justify-between gap-x-2 px-2 sm:px-4 py-2 sm:py-2.5 text-[12px] sm:text-[12.5px] font-medium border-b
        transition-all duration-300 shrink-0 min-w-0
        ${connectionStatus === 'CONNECTING'
          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
          : connectionStatus === 'QR_PENDING'
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
          : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
        }
      `}
    >
      <div className="flex items-center gap-2">
        {connectionStatus === 'CONNECTING' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : connectionStatus === 'QR_PENDING' ? (
          <QrCode className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <span>
          {connectionStatus === 'CONNECTING'
            ? 'Connecting to WhatsApp…'
            : connectionStatus === 'QR_PENDING'
            ? user?.role === 'master'
              ? 'Scan QR code to link WhatsApp'
              : 'Waiting for administrator to finish WhatsApp linking'
            : 'WhatsApp disconnected'}
        </span>
      </div>

      {/* Master admin: reconnect button */}
      {user?.role === 'master' && connectionStatus === 'DISCONNECTED' && (
        <button
          onClick={handleReconnect}
          disabled={reconnecting}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-[11.5px] font-semibold transition-colors disabled:opacity-60"
        >
          {reconnecting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {reconnecting ? 'Reconnecting…' : 'Reconnect'}
        </button>
      )}

      {connectionStatus === 'QR_PENDING' && (
        <span className="flex items-center gap-1 text-[11px] opacity-70 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Waiting for scan
        </span>
      )}
    </div>
  )
}
