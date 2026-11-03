/**
 * Cryptographic Primitives for Payment Security
 * Implements AES-256-GCM encryption, HMAC-SHA256 signatures, and secure identifier generation
 */
const crypto = require('crypto');
const config = require('../config');

/**
 * Encrypt sensitive cardholder data using AES-256-GCM
 * @param {string|object} data - Plaintext payload to encrypt
 * @param {Buffer} [key] - 32-byte master key
 * @returns {object} { cipherText, iv, authTag } (all hex encoded)
 */
function encryptAES256GCM(data, key = config.vaultMasterKey) {
  const plainText = typeof data === 'object' ? JSON.stringify(data) : String(data);
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let cipherText = cipher.update(plainText, 'utf8', 'hex');
  cipherText += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    cipherText,
    iv: iv.toString('hex'),
    authTag
  };
}

/**
 * Decrypt sensitive cardholder data using AES-256-GCM with authentication tag check
 * @param {string} cipherTextHex 
 * @param {string} ivHex 
 * @param {string} authTagHex 
 * @param {Buffer} [key] 
 * @returns {string} Decrypted plaintext
 */
function decryptAES256GCM(cipherTextHex, ivHex, authTagHex, key = config.vaultMasterKey) {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate HMAC-SHA256 signature for webhooks or API requests
 * @param {string|object} payload 
 * @param {string} secret 
 * @returns {string} Hex encoded signature
 */
function generateHmacSignature(payload, secret = config.webhookSecret) {
  const data = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Timing-safe HMAC-SHA256 signature verification (prevents timing attacks)
 * @param {string|object} payload 
 * @param {string} receivedSignature 
 * @param {string} secret 
 * @returns {boolean}
 */
function verifyHmacSignature(payload, receivedSignature, secret = config.webhookSecret) {
  try {
    const expectedSignature = generateHmacSignature(payload, secret);
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(receivedSignature || '', 'utf8');

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Compute SHA-256 hash of arbitrary content
 * @param {string} content 
 * @returns {string} Hex hash
 */
function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate cryptographically secure unique identifiers
 * @param {string} prefix - e.g. 'pay', 'order', 'tok', 'rfnd', 'tr'
 * @returns {string} e.g. 'pay_6f3e1a8b9c2d'
 */
function generateId(prefix = 'id') {
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${random}`;
}

module.exports = {
  encryptAES256GCM,
  decryptAES256GCM,
  generateHmacSignature,
  verifyHmacSignature,
  sha256,
  generateId
};
