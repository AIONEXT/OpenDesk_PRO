import path from 'path'
import os from 'os'
import { URL } from 'url'

/**
 * P0 Security: Validates external URLs before passing to shell.openExternal().
 * Strictly allows http:, https:, and mailto: schemes. Blocks file:, javascript:,
 * data:, applescript:, terminal:, and other custom OS schemes.
 */
export function validateSafeExternalUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('Invalid or empty URL')
  }
  const trimmed = rawUrl.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error(`Malformed URL: ${trimmed}`)
  }

  const allowedProtocols = ['http:', 'https:', 'mailto:']
  if (!allowedProtocols.includes(parsed.protocol.toLowerCase())) {
    throw new Error(`Blocked unsafe URL protocol: ${parsed.protocol}`)
  }

  return parsed.toString()
}

/**
 * P0 Security: Enforces workspace path boundary checks and blocks path traversal
 * into sensitive system or user credential directories.
 */
export function assertPathWithinAllowedRoots(
  targetPath: unknown,
  allowedRoots: string[]
): string {
  if (typeof targetPath !== 'string' || !targetPath.trim()) {
    throw new Error('Invalid or empty file path')
  }

  if (targetPath.includes('\0')) {
    throw new Error('Null byte detected in file path')
  }

  const resolved = path.resolve(targetPath.trim())
  const home = os.homedir()

  // Explicitly block critical OS and credential directories even if user selects home folder
  const forbiddenPrefixes = [
    '/System',
    '/bin',
    '/sbin',
    '/usr/bin',
    '/usr/sbin',
    '/etc',
    '/private/etc',
    path.join(home, '.ssh'),
    path.join(home, '.gnupg'),
    path.join(home, '.aws'),
    path.join(home, '.kube'),
    path.join(home, 'Library/Keychains'),
  ]

  for (const forbidden of forbiddenPrefixes) {
    if (resolved === forbidden || resolved.startsWith(forbidden + path.sep)) {
      throw new Error(`Security violation: access to protected path (${forbidden}) is forbidden`)
    }
  }

  const normalizedRoots = [
    ...allowedRoots.filter(Boolean).map((r) => path.resolve(r)),
    '/tmp',
    '/private/tmp',
    path.resolve(os.tmpdir()),
  ]

  const isInsideAllowed = normalizedRoots.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep)
  )

  if (!isInsideAllowed) {
    throw new Error(`Security violation: path is outside allowed workspace directories (${resolved})`)
  }

  return resolved
}

/**
 * Sanitizes any API key or token so non-ASCII characters (such as box-drawing '─' U+2500 = 9472
 * from accidental clipboard/CLI pastes) can NEVER trigger WebIDL ByteString errors in fetch() headers.
 */
export function sanitizeApiKey(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim().replace(/^Bearer\s+/i, '').trim()
  if (!trimmed) return ''

  const knownTokenMatch = trimmed.match(
    /\b(sk-or-v1-[A-Za-z0-9_-]{16,}|sk-or-[A-Za-z0-9_-]{16,}|nvapi-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{16,}|csk-[A-Za-z0-9_-]{16,}|hf_[A-Za-z0-9_-]{16,}|github_pat_[A-Za-z0-9_]{16,}|ghp_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{16,})\b/
  )
  if (knownTokenMatch) {
    return knownTokenMatch[1]
  }

  const unquoted = trimmed.replace(/[\u200B-\u200D\uFEFF"'`]/g, '').trim()
  if (!unquoted || /[\r\n\s\u0080-\uFFFF]/.test(unquoted)) {
    return ''
  }

  const asciiOnly = unquoted.replace(/[^\x21-\x7E]/g, '')
  if (asciiOnly.length < 6 || asciiOnly.length > 256) return ''
  return asciiOnly
}

export function sanitizeEndpointUrl(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const clean = raw.replace(/[^\x21-\x7E]/g, '').trim().replace(/\/+$/, '')
  if (!clean || (!clean.startsWith('http://') && !clean.startsWith('https://'))) {
    return fallback
  }
  return clean
}

export function buildSafeAsciiHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const safe: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined || v === null) continue
    const cleanKey = String(k).replace(/[^\x21-\x7E]/g, '').trim()
    const cleanVal = String(v).replace(/[^\x20-\x7E]/g, '').trim()
    if (cleanKey && cleanVal) {
      safe[cleanKey] = cleanVal
    }
  }
  return safe
}
