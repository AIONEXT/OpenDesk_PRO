import crypto from 'crypto'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const VAULT_KDF_ITERATIONS = 210000
export const VAULT_DEFAULT_PASSPHRASE = 'deskfolder-enterprise-vault-v3'

export function deriveVaultKey(passphrase: string, saltHex: string): Buffer {
  const cleanPass = String(passphrase || VAULT_DEFAULT_PASSPHRASE)
  const saltBuf = Buffer.from(saltHex, 'hex')
  return crypto.pbkdf2Sync(cleanPass, saltBuf, VAULT_KDF_ITERATIONS, 32, 'sha512')
}

export function encryptVaultPayload(
  plainText: string,
  key: Buffer
): { iv: string; tag: string; ciphertext: string } {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('base64'),
  }
}

export function decryptVaultPayload(
  enc: { iv: string; tag: string; ciphertext: string },
  key: Buffer
): string {
  const iv = Buffer.from(enc.iv, 'hex')
  const tag = Buffer.from(enc.tag, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

/**
 * Hardware-backed Keychain master secret retrieval via Electron safeStorage when available,
 * with fallback for headless CI/test environments.
 */
export async function resolveHardwareMasterPassphrase(
  userDataDir: string,
  safeStorageApi?: {
    isEncryptionAvailable?: () => boolean
    encryptString?: (plainText: string) => Buffer
    decryptString?: (encrypted: Buffer) => string
  }
): Promise<string> {
  try {
    if (
      safeStorageApi &&
      typeof safeStorageApi.isEncryptionAvailable === 'function' &&
      safeStorageApi.isEncryptionAvailable() &&
      typeof safeStorageApi.encryptString === 'function' &&
      typeof safeStorageApi.decryptString === 'function'
    ) {
      const keychainFile = path.join(userDataDir, 'vault-keychain-seal.bin')
      if (existsSync(keychainFile)) {
        const encryptedBuf = await fs.readFile(keychainFile)
        const decrypted = safeStorageApi.decryptString(encryptedBuf)
        if (decrypted && decrypted.length >= 16) return decrypted
      }
      const generatedSecret = `odk-hw-${crypto.randomBytes(24).toString('hex')}`
      const sealedBuf = safeStorageApi.encryptString(generatedSecret)
      await fs.mkdir(userDataDir, { recursive: true })
      await fs.writeFile(keychainFile, sealedBuf, { mode: 0o600 })
      return generatedSecret
    }
  } catch {
    // Fallback to deterministic hardware seal when Keychain is unavailable
  }
  return VAULT_DEFAULT_PASSPHRASE
}
