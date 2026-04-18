"use client"

import React, { useEffect } from 'react'
import { X, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadFromUrl, sanitizeDownloadFilename } from '@/lib/downloadMedia'

export type MediaViewerKind = 'image' | 'pdf' | 'video' | 'other'

type Props = {
  open: boolean
  onClose: () => void
  url: string
  kind: MediaViewerKind
  fileName: string
}

export default function MediaViewerModal({ open, onClose, url, kind, fileName }: Props) {
  const label = sanitizeDownloadFilename(fileName, 'file')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 pt-[env(safe-area-inset-top,0px)]"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <div
        className="flex items-center justify-between gap-2 sm:gap-3 px-2 sm:px-3 py-2.5 bg-zinc-950/95 border-b border-white/10 shrink-0 pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm text-zinc-100 font-medium truncate min-w-0 flex-1">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9"
            onClick={() => downloadFromUrl(url, label)}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Open in new tab"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-zinc-100 hover:bg-white/10 shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <button
        type="button"
        className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] overflow-auto cursor-default outline-none"
        onClick={onClose}
      >
        <div
          className="max-w-full max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {kind === 'image' && (
            <img
              src={url}
              alt={label}
              className="max-h-[calc(100vh-5.5rem)] max-w-[min(100vw-1.5rem,1200px)] object-contain rounded shadow-2xl"
            />
          )}
          {kind === 'pdf' && (
            <iframe
              title={label}
              src={`${url}${url.includes('?') ? '&' : '?'}#toolbar=1`}
              className="w-[min(100vw-1.5rem,960px)] h-[min(calc(100vh-5.5rem),900px)] rounded bg-white shadow-2xl border border-white/10"
            />
          )}
          {kind === 'video' && (
            <video
              src={url}
              controls
              playsInline
              className="max-h-[calc(100vh-5.5rem)] max-w-[min(100vw-1.5rem,1200px)] rounded shadow-2xl bg-black"
            />
          )}
          {kind === 'other' && (
            <div className="rounded-xl bg-zinc-900/90 border border-white/10 px-6 py-8 text-center text-zinc-200 max-w-md">
              <p className="text-sm mb-4">No in-app preview for this file type.</p>
              <Button type="button" variant="secondary" onClick={() => downloadFromUrl(url, label)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          )}
        </div>
      </button>
    </div>
  )
}
