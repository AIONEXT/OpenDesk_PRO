/**
 * Signature Generation and Verification Protocols
 * Supports Razorpay, Stripe, and Native Aggregator HMAC-SHA256 standards
 */
const crypto = require('crypto');
const config = require('../config');
const { verifyHmacSignature, generateHmacSignature } = require('./crypto');

/**
 * Generate Razorpay-compliant payment signature
 * Razorpay algorithm: HMAC_SHA256(order_id + "|" + razorpay_payment_id, secret)
 * @param {string} orderId 
 * @param {string} paymentId 
 * @param {string} secret 
 * @returns {string} Hex signature
 */
function generateRazorpaySignature(orderId, paymentId, secret = config.razorpay.keySecret) {
  const payload = `${orderId}|${paymentId}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId 
 * @param {string} paymentId 
 * @param {string} signature 
 * @param {string} secret 
 * @returns {boolean}
 */
function verifyRazorpaySignature(orderId, paymentId, signature, secret = config.razorpay.keySecret) {
  const payload = `${orderId}|${paymentId}`;
  return verifyHmacSignature(payload, signature, secret);
}

/**
 * Generate Stripe-compliant webhook signature header
 * Format: t={timestamp},v1={hmac_sha256(t + "." + payload)}
 * @param {string|object} payload 
 * @param {string} secret 
 * @returns {string} Header value
 */
function generateStripeSignatureHeader(payload, secret = config.webhookSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const data = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  const signedPayload = `${timestamp}.${data}`;
  const v1Signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${v1Signature}`;
}

/**
 * Verify Stripe-compliant webhook signature header with 5-minute replay tolerance
 * @param {string|object} payload 
 * @param {string} header 
 * @param {string} secret 
 * @param {number} toleranceSeconds 
 * @returns {boolean}
 */
function verifyStripeSignatureHeader(payload, header, secret = config.webhookSecret, toleranceSeconds = 300) {
  try {
    if (!header) return false;
    const parts = header.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parseInt(parts.t, 10);
    const signature = parts.v1;

    if (!timestamp || !signature) return false;

    // Check replay attack window
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false; // Expired / replayed webhook
    }

    const data = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
    const signedPayload = `${timestamp}.${data}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch (err) {
    return false;
  }
}

/**
 * Native Aggregator Webhook Signature (X-Signature-SHA256)
 * @param {string|object} payload 
 * @param {string} secret 
 * @returns {string}
 */
function generateAggregatorWebhookSignature(payload, secret = config.webhookSecret) {
  return generateHmacSignature(payload, secret);
}

module.exports = {
  generateRazorpaySignature,
  verifyRazorpaySignature,
  generateStripeSignatureHeader,
  verifyStripeSignatureHeader,
  generateAggregatorWebhookSignature
};
