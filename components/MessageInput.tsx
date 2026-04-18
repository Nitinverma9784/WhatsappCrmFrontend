"use client"

import React, { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Send, Smile, Paperclip, X, ImageIcon, Loader2 } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/store/useChatStore'
import api from '@/lib/api'
import { toast } from 'react-toastify'
import { Theme } from 'emoji-picker-react'

/** Must match `multer` limit in `backend/routes/whatsapp.routes.js` */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_IMAGE_LABEL = '20 MB'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] w-full min-w-[280px] animate-pulse rounded-lg bg-muted/40" aria-hidden />
  ),
})

function isImageFile(f: File) {
  return f.type.startsWith('image/')
}

export default function MessageInput() {
  const { selectedChat, user, activeSessionId, addOptimisticMessage, resolveOptimisticMessage, removeOptimisticMessage, updateChat } = useChatStore()
  const { resolvedTheme } = useTheme()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const optimisticIdRef = useRef<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const emojiWrapRef = useRef<HTMLDivElement>(null)
  const emojiBtnRef = useRef<HTMLButtonElement>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    if (!isImageFile(file)) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    const u = URL.createObjectURL(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return u
    })
    return () => {
      URL.revokeObjectURL(u)
    }
  }, [file])

  useEffect(() => {
    if (!showEmoji) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (emojiWrapRef.current?.contains(t) || emojiBtnRef.current?.contains(t)) return
      setShowEmoji(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showEmoji])

  const onImageChosen = (f: File | undefined) => {
    if (!f) return
    if (!isImageFile(f)) {
      toast.error('Please choose an image file.')
      return
    }
    if (f.size > MAX_IMAGE_BYTES) {
      toast.error(`Image is too large. Maximum size is ${MAX_IMAGE_LABEL}.`)
      return
    }
    setFile(f)
  }

  const handleSend = async () => {
    if ((!text.trim() && !file) || !selectedChat || !activeSessionId || sending) return

    if (file && !isImageFile(file)) {
      toast.error('Only image files are supported.')
      return
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      toast.error(`Image is too large. Maximum size is ${MAX_IMAGE_LABEL}.`)
      return
    }

    const trimmedText = text.trim()
    const userNickname = user?.nickname || user?.username || 'Me'
    const senderId = user?._id != null ? String(user._id) : 'me'
    const fileSnapshot = file

    let optimisticBlobUrl: string | null = null
    if (fileSnapshot && isImageFile(fileSnapshot)) {
      optimisticBlobUrl = URL.createObjectURL(fileSnapshot)
    }

    const optimisticText = fileSnapshot ? trimmedText : trimmedText

    setText('')
    setFile(null)
    setShowEmoji(false)

    const optimisticId = `optimistic-${Date.now()}-${Math.random()}`
    optimisticIdRef.current = optimisticId

    const sidebarPreview = fileSnapshot
      ? `${userNickname}: ${trimmedText || '📷'}`
      : `${userNickname}: ${trimmedText}`

    const optimisticMsg = {
      messageId: optimisticId,
      groupId: selectedChat.groupId,
      sender: senderId,
      senderName: userNickname,
      senderType: 'crm_user' as const,
      text: optimisticText,
      mediaUrl: optimisticBlobUrl || undefined,
      mediaType: fileSnapshot ? 'image' : undefined,
      timestamp: new Date().toISOString(),
      deleted: false,
      _optimistic: true,
    }

    addOptimisticMessage(optimisticMsg)
    updateChat(selectedChat.groupId, sidebarPreview, new Date().toISOString())

    setSending(true)
    try {
      if (fileSnapshot) {
        const formData = new FormData()
        formData.append('file', fileSnapshot)
        formData.append('groupId', selectedChat.groupId)
        formData.append('text', trimmedText)
        const { data } = await api.post(`/whatsapp/sessions/${activeSessionId}/send-media`, formData)
        if (data.messageId) {
          resolveOptimisticMessage(optimisticId, {
            ...optimisticMsg,
            messageId: data.messageId,
            mediaUrl: data.mediaUrl ?? optimisticMsg.mediaUrl,
            mediaType: 'image',
            text: optimisticText,
            _optimistic: false,
          })
        }
      } else {
        const { data } = await api.post(`/whatsapp/sessions/${activeSessionId}/send`, {
          groupId: selectedChat.groupId,
          text: trimmedText
        })
        if (data.messageId) {
          resolveOptimisticMessage(optimisticId, {
            ...optimisticMsg,
            messageId: data.messageId,
            _optimistic: false,
          })
        }
      }
    } catch (err: unknown) {
      const errMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Unknown error'
      toast.error(`Send failed: ${errMsg}`)
      console.error('[MessageInput] Send error:', err)
      removeOptimisticMessage(optimisticId)
      setText(trimmedText)
      setFile(fileSnapshot)
    } finally {
      if (optimisticBlobUrl) {
        queueMicrotask(() => URL.revokeObjectURL(optimisticBlobUrl))
      }
      setSending(false)
      optimisticIdRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!selectedChat || !activeSessionId) return null

  const emojiTheme = resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT

  return (
    <div className="relative z-20 border-t border-border bg-whatsapp-light-panel dark:bg-zinc-800/80 shadow-sm shrink-0">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          onImageChosen(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {showEmoji && (
        <div
          ref={emojiWrapRef}
          className="absolute bottom-full left-2 right-2 sm:left-3 sm:right-auto sm:w-[min(100vw-2rem,380px)] mb-2 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden z-[60] max-h-[min(50vh,420px)]"
        >
          <EmojiPicker
            height={360}
            width="100%"
            theme={emojiTheme}
            autoFocusSearch={false}
            onEmojiClick={(d) => {
              setText((t) => t + d.emoji)
              setShowEmoji(false)
            }}
          />
        </div>
      )}

      {file && (
        <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-auto mb-2 bg-white dark:bg-zinc-800 p-3 rounded-xl shadow-2xl border border-[#00a884]/30 max-w-[min(100vw-1rem,320px)] z-30 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/10 gap-2">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00a884] block">Photo</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Max {MAX_IMAGE_LABEL}</span>
            </div>
            <button
              type="button"
              className="p-1.5 min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary/30 touch-manipulation shrink-0"
              aria-label="Remove attachment"
              onClick={() => setFile(null)}
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-rose-500" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0 border border-border/20" />
            ) : (
              <div className="h-16 w-16 bg-secondary/10 rounded-lg flex items-center justify-center shrink-0">
                <ImageIcon className="h-7 w-7 text-[#00a884]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{file.name}</p>
              <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap sm:flex-nowrap items-end gap-2 sm:gap-3 p-2 sm:p-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))]">
        <div className="flex gap-1 sm:gap-2 text-muted-foreground shrink-0 items-center">
          <span className="hidden sm:inline text-[10px] text-muted-foreground/80 whitespace-nowrap max-w-[4.5rem] leading-tight">
            Images max {MAX_IMAGE_LABEL}
          </span>
          <Button
            ref={emojiBtnRef}
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 touch-manipulation rounded-full"
            aria-label="Emoji"
            aria-expanded={showEmoji}
            onClick={() => setShowEmoji((v) => !v)}
          >
            <Smile className="h-6 w-6" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 touch-manipulation rounded-full"
            aria-label="Attach photo"
            title={`Photo — max ${MAX_IMAGE_LABEL}`}
            onClick={() => imageInputRef.current?.click()}
          >
            <Paperclip className="h-6 w-6" />
          </Button>
        </div>

        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={file ? 'Caption (optional)…' : 'Message'}
          disabled={sending}
          className="flex-1 min-w-[140px] bg-secondary/15 dark:bg-zinc-900 border-none outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/30 rounded-xl h-11 px-3 sm:px-4 text-base sm:text-sm placeholder:italic placeholder:text-muted-foreground/50 disabled:opacity-60 touch-manipulation"
        />

        <div className="flex flex-col items-end gap-0.5 shrink-0 ml-auto sm:ml-0">
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending || (!text.trim() && !file)}
            size="icon"
            className="h-11 w-11 rounded-full bg-[#25D366] text-white hover:bg-[#128C7E] touch-manipulation disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5 rotate-45" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
