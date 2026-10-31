import crypto from 'crypto'

const LICENSE_SIGNING_SECRET = 'DESKFOLDER_AEGIS_COMMERCIAL_MASTER_HMAC_2026_V3'

// Ed25519 Asymmetric Public Key (SPKI PEM) for offline verification of server-issued asymmetric license tokens
export const OPENDESK_ED25519_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA8fJ6X7mQ9V2wK4pL1nR5tY8uI0oP3aS6dF9gH2jK5lM=
-----END PUBLIC KEY-----`

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
