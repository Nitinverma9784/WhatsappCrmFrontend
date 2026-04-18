"use client"

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '@/store/useChatStore'
import MessageBubble from './MessageBubble'
import { ScrollArea } from "@/components/ui/scroll-area"
import { format, isToday, isYesterday } from 'date-fns'
import api from '@/lib/api'
import { CheckCheck, Loader2, ChevronUp } from 'lucide-react'

// ─── Skeleton Loader ───────────────────────────────────────────────────────────
const MessageSkeleton = () => (
  <div className="flex flex-col gap-4 px-4 py-6 animate-pulse">
    {[
      { side: 'start', w: 'w-52' },
      { side: 'end', w: 'w-64' },
      { side: 'start', w: 'w-36' },
      { side: 'end', w: 'w-48' },
      { side: 'start', w: 'w-72' },
      { side: 'end', w: 'w-40' },
    ].map((item, i) => (
      <div key={i} className={`flex ${item.side === 'end' ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`h-10 rounded-2xl ${item.w} ${
            item.side === 'end'
              ? 'bg-emerald-200/60 dark:bg-emerald-900/30'
              : 'bg-white/60 dark:bg-zinc-700/40'
          }`}
        />
      </div>
    ))}
    <div className="flex justify-center mt-2">
      <div className="h-4 w-32 rounded-full bg-white/40 dark:bg-zinc-700/30" />
    </div>
  </div>
)

// ─── Merge + deduplicate helpers ───────────────────────────────────────────────
function mergeMessages(existing: any[], incoming: any[]): any[] {
  const map = new Map(existing.map(m => [m.messageId, m]));
  for (const m of incoming) {
    if (!map.has(m.messageId)) {
      map.set(m.messageId, m);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function ChatWindow() {
  const {
    messages,
    setMessages,
    setMessagesLoading,
    messagesLoading,
    selectedChat,
    messageRefreshToken,
    activeSessionId,
    scrollBottomNonce,
  } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Track which (chat + token) combination we've already fetched
  const fetchedKeyRef = useRef<string | null>(null)
  // Track total message count so we can detect new arrivals for auto-scroll
  const prevMessageCountRef = useRef(0)
  /** After prepending older messages, skip one auto-scroll-to-bottom */
  const skipNextAutoScrollRef = useRef(false)

  // ── Scroll to bottom (double rAF: content height is reliable after layout) ──
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const run = () => {
      const el = scrollRef.current
      if (!el) return
      const top = el.scrollHeight
      if (behavior === 'smooth') {
        el.scrollTo({ top, behavior: 'smooth' })
      } else {
        el.scrollTop = top
      }
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(run)
    })
  }, [])

  useEffect(() => {
    prevMessageCountRef.current = 0
  }, [selectedChat?.groupId])

  /** After messages finish loading, scroll once the list is painted (fixes open-chat not at bottom). */
  useLayoutEffect(() => {
    if (!selectedChat || messagesLoading) return
    scrollToBottom('auto')
  }, [selectedChat?.groupId, messagesLoading, scrollToBottom])

  // ── Fetch messages when chat changes OR refresh token bumps ──
  useEffect(() => {
    if (!selectedChat) {
      fetchedKeyRef.current = null
      return
    }

    const cacheKey = `${selectedChat.groupId}::${messageRefreshToken}`
    if (fetchedKeyRef.current === cacheKey) return
    fetchedKeyRef.current = cacheKey

    const fetchMessages = async () => {
      if (!activeSessionId) return
      setMessagesLoading(true)
      try {
        const { data: dbData } = await api.get(
          `/whatsapp/sessions/${activeSessionId}/messages/${selectedChat.groupId}`
        )
        const dbMessages: any[] = Array.isArray(dbData) ? dbData : []
        setMessages(dbMessages)
        setHasMore(dbMessages.length >= 150)

        // STEP 2: Trigger WhatsApp sync in background — this fires fetchMessageHistory on phone
        // The response may be empty or partial; actual new messages arrive via socket events.
        // We merge whatever the endpoint returns into existing state.
        try {
          const { data: syncData } = await api.get(
            `/whatsapp/sessions/${activeSessionId}/messages/${selectedChat.groupId}/sync?count=100`
          )
          if (Array.isArray(syncData) && syncData.length > 0) {
            // Merge sync results with current store state (which may already have socket messages)
            const currentMessages = useChatStore.getState().messages
            const merged = mergeMessages(currentMessages, syncData)
            if (merged.length !== currentMessages.length) {
              setMessages(merged)
            }
          }
        } catch (syncErr) {
          // Sync failure is non-fatal — we still have DB messages
          console.warn('[ChatWindow] Background sync failed:', syncErr)
        }
      } catch (err) {
        console.error('[ChatWindow] Error fetching messages:', err)
      } finally {
        setMessagesLoading(false)
      }
    }

    fetchMessages()
  }, [selectedChat?.groupId, messageRefreshToken, activeSessionId, setMessages, setMessagesLoading])

  // ── Jump to bottom when header / sidebar requests it ──
  useLayoutEffect(() => {
    if (!selectedChat || scrollBottomNonce === 0) return
    scrollToBottom('smooth')
  }, [scrollBottomNonce, selectedChat?.groupId, scrollToBottom])

  // ── Auto-scroll when new messages arrive (append); skip after "load older" prepend ──
  useEffect(() => {
    if (messages.length === 0) return

    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false
      prevMessageCountRef.current = messages.length
      return
    }

    const prev = prevMessageCountRef.current
    prevMessageCountRef.current = messages.length

    if (messagesLoading) return

    if (messages.length > prev) {
      scrollToBottom('smooth')
    }
  }, [messages.length, messagesLoading, scrollToBottom])

  // ── Load older messages (cursor pagination) ──
  const loadMore = async () => {
    if (loadingMore || !hasMore || !selectedChat || !activeSessionId || messages.length === 0) return
    setLoadingMore(true)
    try {
      const oldestTimestamp = messages[0]?.timestamp
      if (!oldestTimestamp) return
      const before = new Date(oldestTimestamp).toISOString()
      const { data } = await api.get(
        `/whatsapp/sessions/${activeSessionId}/messages/${selectedChat.groupId}?before=${encodeURIComponent(before)}`
      )
      if (!Array.isArray(data) || data.length === 0) {
        setHasMore(false)
      } else {
        skipNextAutoScrollRef.current = true
        const merged = mergeMessages(data, messages)
        setMessages(merged)
        setHasMore(data.length >= 150)
      }
    } catch (err) {
      console.error('[ChatWindow] Load more error:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Empty state (no chat selected) ──
  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#0b141a] text-muted-foreground p-8 text-center gap-6">
        <div className="relative">
          <div className="h-56 w-56 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center">
            <div className="h-36 w-36 rounded-full bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center">
              <CheckCheck className="h-14 w-14 text-emerald-500/30" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-light text-foreground/80 tracking-tight">WhatsApp CRM</h2>
          <p className="text-sm text-muted-foreground/60 max-w-xs leading-relaxed">
            Select a chat from the sidebar to view and manage conversations.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs border border-border/20 rounded-full px-4 py-1.5 bg-secondary/10 text-muted-foreground/60">
          <CheckCheck className="h-3 w-3 text-emerald-500" />
          End-to-end encrypted
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 w-full min-w-0 bg-[#e5ddd5] dark:bg-[#0b141a] overflow-hidden relative flex flex-col">
      <ScrollArea className="flex-1 min-h-0" viewportRef={scrollRef}>
        <div className="flex flex-col gap-0.5 min-h-full px-2 py-2 sm:px-3 sm:py-3 pb-1">

          {/* Skeleton while loading */}
          {messagesLoading ? (
            <MessageSkeleton />
          ) : (
            <>
              {/* Load older messages button */}
              {hasMore && (
                <div className="flex justify-center py-2 mb-1">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    type="button"
                    className="flex items-center gap-2 text-xs bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm px-4 py-2.5 min-h-11 rounded-full hover:bg-white transition-all shadow-sm border border-border/20 disabled:opacity-50 touch-manipulation"
                  >
                    {loadingMore
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ChevronUp className="h-3 w-3" />
                    }
                    {loadingMore ? 'Loading…' : 'Load older messages'}
                  </button>
                </div>
              )}

              {/* Empty state */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground/50">
                  <div className="text-4xl">💬</div>
                  <p className="text-sm text-center max-w-[240px] leading-relaxed">
                    No messages yet. Click <strong>Sync to WA</strong> to fetch messages from your phone.
                  </p>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, idx) => {
                const msgDate = format(new Date(msg.timestamp), 'yyyy-MM-dd')
                const prevDate = idx > 0
                  ? format(new Date(messages[idx - 1].timestamp), 'yyyy-MM-dd')
                  : null
                const showDate = idx === 0 || msgDate !== prevDate

                return (
                  <React.Fragment key={msg.messageId}>
                    {showDate && (
                      <div className="flex justify-center my-3 sticky top-1 z-10 select-none pointer-events-none">
                        <span className="bg-white/85 dark:bg-zinc-800/85 backdrop-blur-sm px-4 py-1 rounded-full text-[11px] shadow-sm font-medium text-muted-foreground border border-border/10">
                          {isToday(new Date(msg.timestamp))
                            ? 'Today'
                            : isYesterday(new Date(msg.timestamp))
                            ? 'Yesterday'
                            : format(new Date(msg.timestamp), 'MMMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    <MessageBubble message={msg} />
                  </React.Fragment>
                )
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
