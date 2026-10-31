export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#007aff').replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) || 0
  const g = parseInt(clean.substring(2, 4), 16) || 122
  const b = parseInt(clean.substring(4, 6), 16) || 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function detectColorSwatch(text: string): string | null {
  if (!text) return null
  const t = text.trim()
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t)) return t
  if (/^(rgb|rgba|hsl|hsla)\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?(\s*,\s*[\d.]+)?\s*\)$/i.test(t)) return t
  return null
}

export function detectTextFormat(text: string): 'code' | 'url' | 'email' | 'plain' {
  const t = text.trim()
  if (/^https?:\/\/[^\s]+$/i.test(t)) return 'url'
  if (/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/i.test(t)) return 'email'
  if (
    /[{}();=><\[\]]/.test(t) &&
    (t.includes('function') ||
      t.includes('const ') ||
      t.includes('let ') ||
      t.includes('import ') ||
      t.includes('export ') ||
      t.includes('class ') ||
      t.includes('def ') ||
      t.includes('return ') ||
      (t.startsWith('{') && t.endsWith('}')))
  ) {
    return 'code'
  }
  return 'plain'
}

export function sanitizeApiKeyInput(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim().replace(/^Bearer\s+/i, '').trim()
  if (!trimmed) return ''
  const knownTokenMatch = trimmed.match(
    /\b(sk-or-v1-[A-Za-z0-9_-]{16,}|sk-or-[A-Za-z0-9_-]{16,}|nvapi-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{16,}|csk-[A-Za-z0-9_-]{16,}|hf_[A-Za-z0-9_-]{16,}|github_pat_[A-Za-z0-9_]{16,}|ghp_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{16,})\b/
  )
  if (knownTokenMatch) return knownTokenMatch[1]
  const unquoted = trimmed.replace(/[\u200B-\u200D\uFEFF"'`]/g, '').trim()
  if (!unquoted || /[\r\n\s\u0080-\uFFFF]/.test(unquoted)) return ''
  return unquoted.replace(/[^\x21-\x7E]/g, '')
}
