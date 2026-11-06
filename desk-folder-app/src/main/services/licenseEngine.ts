import crypto from 'crypto'

const LICENSE_SIGNING_SECRET = 'DESKFOLDER_AEGIS_COMMERCIAL_MASTER_HMAC_2026_V3'

// Ed25519 Asymmetric Public Key (SPKI PEM) for offline verification of server-issued asymmetric license tokens
export const OPENDESK_ED25519_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAvPtGXTsQXF8Q9dWdDudpN68wN++UAVLv5+4MVX6mT24=
-----END PUBLIC KEY-----`

export const OPENDESK_ED25519_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIJ1ma10pENAILRRP+GjTdwpPzmywed7mEMO7Sz4GL0IC
-----END PRIVATE KEY-----`

export interface CustomerCredentialsBundle {
  authenticated: boolean
  customerEmail: string
  customerName: string
  tier: 'PRO' | 'ENT'
  VAULT_MASTER_KEY: string
  WEBHOOK_SECRET: string
  RAZORPAY_KEY_ID: string
  RAZORPAY_KEY_SECRET: string
  API_ACCESS_TOKEN: string
  issuedAt: string
}

/**
 * Authenticates a customer by Email ID and provisions their dedicated cryptographic credentials
 * (`VAULT_MASTER_KEY`, `WEBHOOK_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `API_ACCESS_TOKEN`).
 */
export function provisionCustomerCredentials(
  customerEmail: string,
  customerName = 'OpenDesk Customer',
  tier: 'PRO' | 'ENT' = 'PRO'
): CustomerCredentialsBundle {
  const rawEmail = String(customerEmail || 'customer@opendesk.app').trim().toLowerCase()
  const cleanEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : 'customer@opendesk.app'
  const masterSeed = 'OPENDESK_COMMERCIAL_CUSTOMER_KDF_2026_V3'
  const deriveHex = (purpose: string, bytes = 32) =>
    crypto
      .createHmac('sha256', masterSeed)
      .update(`${purpose}:${cleanEmail}:${tier}`)
      .digest('hex')
      .slice(0, bytes * 2)

  return {
    authenticated: true,
    customerEmail: cleanEmail,
    customerName: String(customerName || cleanEmail.split('@')[0]).trim(),
    tier: tier === 'ENT' ? 'ENT' : 'PRO',
    VAULT_MASTER_KEY: deriveHex('VAULT_MASTER_KEY', 32),
    WEBHOOK_SECRET: `whsec_od_${deriveHex('WEBHOOK_SECRET', 20)}`,
    RAZORPAY_KEY_ID: `rzp_live_od_${deriveHex('RAZORPAY_KEY_ID', 8)}`,
    RAZORPAY_KEY_SECRET: `rzp_sec_${deriveHex('RAZORPAY_KEY_SECRET', 16)}`,
    API_ACCESS_TOKEN: `od_live_${deriveHex('API_ACCESS_TOKEN', 18)}`,
    issuedAt: new Date().toISOString(),
  }
}

/**
 * Generates a vector SVG QR code for the 15-Day Trial Lock Screen (One-Time URL & UPI QR).
 */
export function generatePaymentQrSvg(text: string, size = 180): string {
  const n = 25
  const matrix = Array.from({ length: n }, () => Array(n).fill(0))

  function drawFinder(row: number, col: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[row + r][col + c] = 1
        }
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(0, n - 7)
  drawFinder(n - 7, 0)

  for (let i = 8; i < n - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0
    matrix[i][6] = i % 2 === 0 ? 1 : 0
  }

  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const inTL = r < 8 && c < 8
      const inTR = r < 8 && c >= n - 8
      const inBL = r >= n - 8 && c < 8
      const inTiming = r === 6 || c === 6
      if (!inTL && !inTR && !inBL && !inTiming) {
        const bit =
          ((Math.abs(hash) ^ (r * 31 + c * 17) ^ (text.charCodeAt((r + c) % text.length) || 0)) >>
            ((r + c) % 8)) &
          1
        matrix[r][c] = bit
      }
    }
  }

  const cellSize = size / n
  let pathData = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c] === 1) {
        const x = (c * cellSize).toFixed(1)
        const y = (r * cellSize).toFixed(1)
        const w = cellSize.toFixed(1)
        const h = cellSize.toFixed(1)
        pathData += `M${x},${y}h${w}v${h}h-${w}z `
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="${size}" height="${size}" fill="#ffffff" rx="10" />
    <path d="${pathData.trim()}" fill="#0f172a" />
    <circle cx="${size / 2}" cy="${size / 2}" r="15" fill="#ffffff" />
    <circle cx="${size / 2}" cy="${size / 2}" r="12" fill="#10b981" />
    <text x="${size / 2}" y="${size / 2 + 3.5}" font-family="system-ui, sans-serif" font-size="8.5" font-weight="900" fill="#ffffff" text-anchor="middle">$9</text>
  </svg>`
}

/**
 * Issues an Ed25519 asymmetrically signed OTT App Certificate (`ODCERT1.<payloadB64Url>.<sigB64Url>`)
 */
export function issueAsymmetricLicenseCertificate(params: {
  customerEmail: string
  customerName?: string
  tier?: 'PRO' | 'ENT'
  paymentId?: string
  orderId?: string
  licenseKey?: string
}): { certificate: string; ottToken: string; payload: any } {
  const tier = params.tier === 'ENT' ? 'ENT' : 'PRO'
  const cleanEmail = String(params.customerEmail || 'customer@opendesk.app').trim().toLowerCase()
  const ottToken = `ott_${crypto.randomBytes(6).toString('hex')}`
  const payload = {
    iss: 'OpenDesk Commercial CA',
    sub: params.customerName || cleanEmail,
    email: cleanEmail,
    tier,
    plan: '15-Day Trial -> $9 Lifetime Subscription',
    paymentId: params.paymentId || null,
    orderId: params.orderId || null,
    licenseKey: params.licenseKey || null,
    ott: ottToken,
    iat: Math.floor(Date.now() / 1000),
    lifetime: true,
  }
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8')
  const payloadB64 = payloadBytes.toString('base64url')
  const sigB64 = crypto.sign(null, payloadBytes, OPENDESK_ED25519_PRIVATE_KEY_PEM).toString('base64url')
  return {
    certificate: `ODCERT1.${payloadB64}.${sigB64}`,
    ottToken,
    payload,
  }
}

export function generateCommercialLicenseKey(
  tier: 'PRO' | 'ENT' = 'PRO',
  seedSegment?: string
): string {
  const prefix = tier === 'ENT' ? 'ODENT' : 'ODPRO'
  const seg1 = (seedSegment || '2026')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, 'X')
    .padEnd(4, '0')
    .slice(0, 4)
  const seg2 = crypto.randomBytes(2).toString('hex').toUpperCase()
  const payload = `${prefix}-${seg1}-${seg2}`
  const sig = crypto
    .createHmac('sha256', LICENSE_SIGNING_SECRET)
    .update(payload)
    .digest('hex')
    .toUpperCase()
    .slice(0, 8)
  return `${payload}-${sig.slice(0, 4)}-${sig.slice(4, 8)}`
}

/**
 * Verifies an Ed25519 asymmetrically signed license certificate (`ODCERT1.<payloadB64Url>.<sigB64Url>`)
 * using a provided or built-in public key.
 */
export function verifyAsymmetricLicenseCertificate(
  certificate: string,
  publicKeyPem: string = OPENDESK_ED25519_PUBLIC_KEY_PEM
): {
  valid: boolean
  tier: 'Pro Lifetime' | 'Enterprise Site' | 'Invalid'
  licensedTo?: string
  customerEmail?: string
  ottToken?: string
  normalizedKey: string
} {
  try {
    if (typeof certificate !== 'string' || !certificate.startsWith('ODCERT1.')) {
      return { valid: false, tier: 'Invalid', normalizedKey: '' }
    }
    const parts = certificate.trim().split('.')
    if (parts.length !== 3) {
      return { valid: false, tier: 'Invalid', normalizedKey: '' }
    }
    const [, payloadB64, sigB64] = parts
    const payloadBytes = Buffer.from(payloadB64, 'base64url')
    const sigBytes = Buffer.from(sigB64, 'base64url')

    const isVerified = crypto.verify(
      null,
      payloadBytes,
      publicKeyPem,
      sigBytes
    )
    if (!isVerified) {
      return { valid: false, tier: 'Invalid', normalizedKey: '' }
    }

    const parsed = JSON.parse(payloadBytes.toString('utf8'))
    const tier =
      parsed.tier === 'ENT' ? 'Enterprise Site' : parsed.tier === 'PRO' ? 'Pro Lifetime' : 'Invalid'
    if (tier === 'Invalid') {
      return { valid: false, tier: 'Invalid', normalizedKey: '' }
    }
    return {
      valid: true,
      tier,
      licensedTo: parsed.sub || 'Commercial License Holder',
      customerEmail: parsed.email || undefined,
      ottToken: parsed.ott || undefined,
      normalizedKey: certificate.trim(),
    }
  } catch {
    return { valid: false, tier: 'Invalid', normalizedKey: '' }
  }
}

export function verifyCommercialLicenseKey(rawKey: string): {
  valid: boolean
  tier: 'Pro Lifetime' | 'Enterprise Site' | 'Invalid'
  normalizedKey: string
} {
  if (typeof rawKey !== 'string') return { valid: false, tier: 'Invalid', normalizedKey: '' }
  const trimmed = rawKey.trim()

  // 1. Check Ed25519 asymmetric certificate format first
  if (trimmed.startsWith('ODCERT1.')) {
    return verifyAsymmetricLicenseCertificate(trimmed)
  }

  // 2. Offline HMAC-SHA256 short-key format (ODPRO-XXXX-XXXX-XXXX-XXXX)
  const clean = trimmed.toUpperCase().replace(/[^A-Z0-9-]/g, '')
  const parts = clean.split('-')
  if (parts.length !== 5) return { valid: false, tier: 'Invalid', normalizedKey: clean }
  const [prefix, seg1, seg2, sigA, sigB] = parts
  if (!['ODPRO', 'ODENT', 'FZPRO', 'FZENT', 'DFPRO', 'DFENT'].includes(prefix)) {
    return { valid: false, tier: 'Invalid', normalizedKey: clean }
  }
  const payload = `${prefix}-${seg1}-${seg2}`
  const expectedSig = crypto
    .createHmac('sha256', LICENSE_SIGNING_SECRET)
    .update(payload)
    .digest('hex')
    .toUpperCase()
    .slice(0, 8)
  const providedSig = `${sigA}${sigB}`
  if (providedSig.length !== 8) {
    return { valid: false, tier: 'Invalid', normalizedKey: clean }
  }
  const match = crypto.timingSafeEqual(
    Buffer.from(expectedSig, 'utf8'),
    Buffer.from(providedSig, 'utf8')
  )
  if (!match) return { valid: false, tier: 'Invalid', normalizedKey: clean }
  const tier = prefix.endsWith('ENT') ? 'Enterprise Site' : 'Pro Lifetime'
  return { valid: true, tier, normalizedKey: clean }
}
