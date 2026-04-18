"use client"

import React, { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { CheckCheck, Trash2, Paperclip, Clock, Download, Eye, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore, Message } from '@/store/useChatStore'
import MediaViewerModal, { type MediaViewerKind } from '@/components/MediaViewerModal'
import { downloadFromUrl } from '@/lib/downloadMedia'

interface MessageProps {
  message: Message
}

function sameUserId(a: string | undefined, b: string | undefined) {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

function normalizeDisplayText(s: string | undefined) {
  if (s == null) return ''
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n')
}

function isRedundantMediaCaption(text: string | undefined, mediaUrl?: string) {
  if (!mediaUrl) return false
  const t = (text || '').trim()
  if (!t) return true
  if (/^\[(IMAGE|VIDEO|AUDIO|DOCUMENT)\]$/i.test(t)) return true
  if (t === '📷 Photo' || t === '{image}' || t === '{Image}') return true
  return false
}

function viewerKindFor(message: Message): MediaViewerKind | null {
  if (!message.mediaUrl) return null
  switch (message.mediaType) {
    case 'image':
      return 'image'
    case 'video':
      return 'video'
    case 'document': {
      const u = (message.mediaUrl || '').toLowerCase()
      const t = (message.text || '').toLowerCase()
      if (u.includes('.xlsx') || u.includes('.docx') || u.includes('.zip') || u.includes('.pptx')) return 'other'
      if (
        u.includes('.pdf') ||
        t.endsWith('.pdf') ||
        t.includes('.pdf') ||
        u.includes('/documents/') ||
        u.includes('whatsapp-crm')
      ) {
        return 'pdf'
      }
      return 'other'
    }
    default:
      return 'other'
  }
}

function downloadFileName(message: Message): string {
  const t = (message.text || '').trim()
  if (t && !t.includes('\n') && t.length < 200 && /\.[a-z0-9]{2,5}$/i.test(t)) return t
  const id = String(message.messageId || 'file').slice(0, 20)
  if (message.mediaType === 'image') return `image-${id}.jpg`
  if (message.mediaType === 'document') {
    const u = (message.mediaUrl || '').toLowerCase()
    if (u.includes('.pdf')) return `document-${id}.pdf`
    return `document-${id}`
  }
  if (message.mediaType === 'video') return `video-${id}.mp4`
  if (message.mediaType === 'audio') return `audio-${id}.m4a`
  return `file-${id}`
}

export default function MessageBubble({ message }: MessageProps) {
  const { user } = useChatStore()
  const [viewer, setViewer] = useState<{
    url: string
    kind: MediaViewerKind
    fileName: string
  } | null>(null)

  const openViewer = useCallback(() => {
    if (!message.mediaUrl) return
    const kind = viewerKindFor(message)
    if (!kind || kind === 'other') {
      downloadFromUrl(message.mediaUrl, downloadFileName(message))
      return
    }
    setViewer({
      url: message.mediaUrl,
      kind,
      fileName: downloadFileName(message),
    })
  }, [message])

  const myId = user?._id != null ? String(user._id) : ''

  const isMine =
    (message.senderType === 'crm_user' &&
      (sameUserId(message.sender, myId) || (message.sender === 'me' && !myId))) ||
    (message.senderType === 'whatsapp' && message.sender === 'me')

  const isOtherAgent =
    message.senderType === 'crm_user' && !sameUserId(message.sender, myId) && message.sender !== 'me'

  const isOptimistic = message._optimistic === true
  const alignment = isMine ? 'items-end' : 'items-start'

  const formattedTime = (() => {
    try {
      return format(new Date(message.timestamp), 'p')
    } catch {
      return ''
    }
  })()

  const displayName =
    message.senderType === 'crm_user'
      ? message.senderName || 'Team member'
      : message.senderName || message.sender?.split('@')[0] || 'Unknown'

  const docLabel = normalizeDisplayText(message.text)?.trim() || 'Document'
  const vk = message.mediaUrl ? viewerKindFor(message) : null
  const canInlineView = Boolean(message.mediaUrl && vk && vk !== 'other')

  return (
    <div className={`flex flex-col mb-1 w-full ${alignment}`}>
      {viewer && (
        <MediaViewerModal
          open
          onClose={() => setViewer(null)}
          url={viewer.url}
          kind={viewer.kind}
          fileName={viewer.fileName}
        />
      )}

      <div
        className={`
          relative max-w-[min(92vw,85%)] lg:max-w-[70%] px-2.5 py-1.5 sm:px-3 rounded-lg shadow-sm
          ${isMine
            ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-none'
            : isOtherAgent
            ? 'bg-blue-50 dark:bg-[#182633] text-[#111b21] dark:text-[#e9edef] rounded-tl-none border-l-4 border-blue-500'
            : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-none'
          }
          ${isOptimistic ? 'opacity-70' : 'opacity-100'}
          transition-opacity duration-200
        `}
      >
        {!isMine && (
          <div className="flex items-center gap-2 mb-0.5 select-none shrink-0 overflow-hidden">
            <span
              className={`text-[12.5px] font-bold truncate max-w-[180px] ${
                isOtherAgent ? 'text-blue-700 dark:text-blue-300' : 'text-[#d01c8b] dark:text-[#53bdeb]'
              }`}
            >
              {displayName}
            </span>
            {isOtherAgent && (
              <span className="text-[8px] bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter border border-blue-500/20">
                CRM
              </span>
            )}
          </div>
        )}

        {isMine && message.senderType === 'crm_user' && (
          <div className="text-[10px] font-semibold text-emerald-800/70 dark:text-emerald-200/60 mb-0.5 text-right select-none">
            You · {message.senderName || user?.nickname || user?.username || 'Agent'}
          </div>
        )}

        {message.mediaUrl && (
          <div className="mb-2 rounded-md overflow-hidden bg-black/5 dark:bg-black/20 min-w-[200px]">
            {message.mediaType === 'image' && (
              <div className="relative group">
                <button
                  type="button"
                  className="block w-full p-0 border-0 bg-transparent cursor-zoom-in text-left"
                  onClick={openViewer}
                >
                  <img
                    src={message.mediaUrl}
                    alt=""
                    className="max-w-full h-auto max-h-80 object-cover rounded hover:opacity-95 transition-opacity"
                  />
                </button>
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 shadow-md"
                    title="View full size"
                    onClick={(e) => {
                      e.stopPropagation()
                      openViewer()
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 shadow-md"
                    title="Save image"
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadFromUrl(message.mediaUrl!, downloadFileName(message))
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {message.mediaType === 'video' && (
              <div className="space-y-2">
                <video src={message.mediaUrl} controls playsInline className="max-w-full h-auto max-h-80 rounded w-full" />
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => downloadFromUrl(message.mediaUrl!, downloadFileName(message))}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Save
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={openViewer}>
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            )}
            {message.mediaType === 'audio' && (
              <div className="flex flex-col gap-2">
                <audio src={message.mediaUrl} controls className="w-full h-10 mt-1" />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => downloadFromUrl(message.mediaUrl!, downloadFileName(message))}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            )}
            {message.mediaType === 'document' && (
              message.mediaUrl ? (
                <div className="rounded-md border border-border/30 bg-secondary/10 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 p-2.5 border-b border-border/20 bg-secondary/20">
                    <div className="bg-emerald-500/20 p-2 rounded shrink-0">
                      <Paperclip className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate text-foreground">{docLabel}</p>
                      <p className="text-[10px] text-muted-foreground">PDF / document</p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                      {canInlineView && (
                        <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={openViewer}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => downloadFromUrl(message.mediaUrl!, downloadFileName(message))}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => window.open(message.mediaUrl!, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Tab
                      </Button>
                    </div>
                  </div>
                  {vk === 'pdf' && (
                    <div className="h-[min(360px,50vh)] w-full bg-zinc-100 dark:bg-zinc-900">
                      <iframe
                        title={docLabel}
                        src={message.mediaUrl.includes('#') ? message.mediaUrl : `${message.mediaUrl}#toolbar=1`}
                        className="w-full h-full min-h-[280px] border-0"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-secondary/15 rounded-md border border-dashed border-border/40">
                  <div className="bg-emerald-500/10 p-2 rounded">
                    <Paperclip className="h-5 w-5 text-emerald-600/80" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium truncate">{docLabel}</span>
                    <span className="text-[10px] text-muted-foreground">Uploading…</span>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {message.deleted ? (
          <div className="flex items-center gap-1.5 text-[13px] italic text-muted-foreground/70 select-none">
            <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span>This message was deleted</span>
          </div>
        ) : !isRedundantMediaCaption(message.text, message.mediaUrl) ? (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words pr-12 text-[#111b21] dark:text-[#e9edef]">
            {normalizeDisplayText(message.text)}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-1 mt-0.5 min-h-[14px]">
          <span className="text-[10px] text-muted-foreground/60 select-none font-medium">
            {formattedTime}
          </span>
          {isMine &&
            (isOptimistic ? (
              <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] opacity-90" />
            ))}
        </div>
      </div>
    </div>
  )
}
