/**
 * PCI-DSS & RBI Tokenization Engine
 * Provides secure card vaulting, Luhn validation, brand detection, and non-reversible token generation
 */
const { encryptAES256GCM, decryptAES256GCM, generateId } = require('./crypto');

// In-memory Card Vault (isolated encrypted vault)
const cardVault = new Map();

/**
 * Validate card number using Luhn Algorithm (Mod 10)
 * @param {string} cardNumber 
 * @returns {boolean}
 */
function validateLuhn(cardNumber) {
  const sanitized = String(cardNumber).replace(/\D/g, '');
  if (!sanitized || sanitized.length < 12 || sanitized.length > 19) {
    return false;
  }

  let sum = 0;
  let alternate = false;
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);
    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/**
 * Identify Card Brand and Network based on Bank Identification Number (BIN)
 * Supports Visa, MasterCard, RuPay, and American Express
 * @param {string} cardNumber 
 * @returns {object} { brand, displayName, feeCategory }
 */
function identifyCardBrand(cardNumber) {
  const digits = String(cardNumber).replace(/\D/g, '');

  if (/^4[0-9]{12}(?:[0-9]{3})?$/.test(digits) || digits.startsWith('4')) {
    return { brand: 'visa', displayName: 'Visa', feeCategory: 'visa_mastercard' };
  }
  if (/^(5[1-5][0-9]{14}|2(22[1-9][0-9]{12}|2[3-9][0-9]{13}|[3-6][0-9]{14}|7[0-1][0-9]{13}|720[0-9]{12}))$/.test(digits) ||
      /^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) {
    return { brand: 'mastercard', displayName: 'MasterCard', feeCategory: 'visa_mastercard' };
  }
  if (/^60[0-9]{14}$|^65[0-9]{14}$|^508[0-9]{13}$|^353[0-9]{13}$|^356[0-9]{13}$/.test(digits) ||
      digits.startsWith('60') || digits.startsWith('65') || digits.startsWith('508')) {
    return { brand: 'rupay', displayName: 'RuPay', feeCategory: 'rupay_debit' };
  }
  if (/^3[47][0-9]{13}$/.test(digits) || digits.startsWith('34') || digits.startsWith('37')) {
    return { brand: 'amex', displayName: 'American Express', feeCategory: 'international' };
  }

  return { brand: 'generic_card', displayName: 'Credit/Debit Card', feeCategory: 'visa_mastercard' };
}

/**
 * Mask Primary Account Number (PAN) according to PCI-DSS standards
 * Shows first 4 and last 4 digits only (e.g., 4111 •••• •••• 1111)
 * @param {string} cardNumber 
 * @returns {string}
 */
function maskCardNumber(cardNumber) {
  const digits = String(cardNumber).replace(/\D/g, '');
  if (digits.length < 8) return '•••• •••• •••• ' + digits.slice(-4);
  const first4 = digits.substring(0, 4);
  const last4 = digits.substring(digits.length - 4);
  return `${first4} •••• •••• ${last4}`;
}

/**
 * Tokenize a card: Encrypts card details into Card Vault using AES-256-GCM
 * Generates an opaque, non-reversible surrogate token (e.g. tok_visa_...)
 * @param {object} cardData { number, expMonth, expYear, cvv, cardholderName, customerId }
 * @returns {object} Token response (safe to expose, no raw PAN or CVV)
 */
function tokenizeCard(cardData) {
  const { number, expMonth, expYear, cvv, cardholderName, customerId } = cardData;
  const sanitizedNumber = String(number || '').replace(/\D/g, '');

  if (!validateLuhn(sanitizedNumber)) {
    throw new Error('Invalid card number: Failed Luhn algorithm check.');
  }

  const { brand, displayName, feeCategory } = identifyCardBrand(sanitizedNumber);
  const maskedPan = maskCardNumber(sanitizedNumber);
  const tokenId = generateId(`tok_${brand}`);

  // PCI DSS Requirement: Never store CVV/CVC post-authorization.
  // Store only encrypted PAN + expiry in the isolated vault.
  const sensitivePayload = {
    pan: sanitizedNumber,
    expMonth: parseInt(expMonth, 10),
    expYear: parseInt(expYear, 10),
    cardholderName: cardholderName ? cardholderName.trim().toUpperCase() : 'VALUED CUSTOMER'
  };

  const encrypted = encryptAES256GCM(sensitivePayload);

  const vaultEntry = {
    tokenId,
    brand,
    displayName,
    feeCategory,
    maskedPan,
    last4: sanitizedNumber.slice(-4),
    first6: sanitizedNumber.slice(0, 6),
    expMonth: parseInt(expMonth, 10),
    expYear: parseInt(expYear, 10),
    cardholderName: sensitivePayload.cardholderName,
    customerId: customerId || null,
    createdAt: new Date().toISOString(),
    encryptedPayload: encrypted
  };

  cardVault.set(tokenId, vaultEntry);

  return {
    tokenId,
    brand,
    displayName,
    maskedPan,
    last4: vaultEntry.last4,
    expMonth: vaultEntry.expMonth,
    expYear: vaultEntry.expYear,
    cardholderName: vaultEntry.cardholderName,
    rbiTokenized: true,
    createdAt: vaultEntry.createdAt
  };
}

/**
 * Retrieve decrypted card details from vault (Internal Gateway Processor only)
 * @param {string} tokenId 
 * @returns {object} Decrypted card payload and metadata
 */
function getVaultEntry(tokenId) {
  const entry = cardVault.get(tokenId);
  if (!entry) {
    throw new Error(`Token ${tokenId} not found in Card Vault.`);
  }

  const decryptedJson = decryptAES256GCM(
    entry.encryptedPayload.cipherText,
    entry.encryptedPayload.iv,
    entry.encryptedPayload.authTag
  );
  const decrypted = JSON.parse(decryptedJson);

  return {
    ...entry,
    rawCard: decrypted
  };
}

/**
 * List all tokenized cards in vault (Masked view for merchant operations)
 * @returns {Array}
 */
function listTokens() {
  return Array.from(cardVault.values()).map(entry => ({
    tokenId: entry.tokenId,
    brand: entry.brand,
    displayName: entry.displayName,
    maskedPan: entry.maskedPan,
    last4: entry.last4,
    expMonth: entry.expMonth,
    expYear: entry.expYear,
    cardholderName: entry.cardholderName,
    createdAt: entry.createdAt
  }));
}

module.exports = {
  validateLuhn,
  identifyCardBrand,
  maskCardNumber,
  tokenizeCard,
  getVaultEntry,
  listTokens,
  cardVault
};
