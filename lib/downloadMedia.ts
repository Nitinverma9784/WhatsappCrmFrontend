/** Safe filename for disk (Windows + web). */
export function sanitizeDownloadFilename(name: string, fallback = 'download') {
  const base = String(name || fallback)
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim()
    .slice(0, 180)
  return base || fallback
}

/**
 * Fetch file and trigger browser download. Falls back to opening the URL if CORS/network fails.
 */
export async function downloadFromUrl(url: string, filename: string) {
  const name = sanitizeDownloadFilename(filename)
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = name.includes('.') ? name : `${name}.bin`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
