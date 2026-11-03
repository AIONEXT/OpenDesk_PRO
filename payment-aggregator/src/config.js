/**
 * Central Configuration for the Payment Aggregator Platform
 */
const crypto = require('crypto');

module.exports = {
  port: process.env.PORT || 4000,
  appName: 'NexusPay Global Aggregator',
  environment: process.env.NODE_ENV || 'development',

  // Master encryption key for PCI-DSS Card Vault (AES-256-GCM requires 32 bytes)
  // In production, this would be fetched from an HSM / AWS KMS / Azure Key Vault
  vaultMasterKey: process.env.VAULT_MASTER_KEY || crypto.createHash('sha256').update('nexuspay-secure-vault-master-key-2026').digest(),

  // HMAC Secret for Webhook generation and signature verification
  webhookSecret: process.env.WEBHOOK_SECRET || 'whsec_nexuspay_live_secret_998877665544332211',

  // Razorpay Gateway Credentials (Sandbox simulation)
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_nxpAggregator99',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'rzp_sec_k983hf82h49f8h23f4h92',
    merchantVpa: 'nexuspay.merchant@hdfcbank'
  },

  // UPI Switch Configuration (NPCI Rail Simulation)
  upi: {
    merchantVpa: 'payments@nexuspay',
    merchantName: 'NexusPay Global Store',
    mcc: '5411', // Grocery/Retail Merchant Category Code
    supportedHandles: [
      '@okhdfcbank', '@okaxis', '@oksbi', '@okicici',
      '@paytm', '@ybl', '@ibl', '@apl', '@upi', '@barodampay'
    ]
  },

  // International Payment Platform (FX Exchange rates relative to USD & INR)
  fxRates: {
    INR: 1.0,        // Base reference in India
    USD: 87.50,      // 1 USD = 87.50 INR
    EUR: 94.20,      // 1 EUR = 94.20 INR
    GBP: 110.80,     // 1 GBP = 110.80 INR
    SGD: 65.40,      // 1 SGD = 65.40 INR
    AED: 23.82,      // 1 AED = 23.82 INR
    JPY: 0.58,       // 1 JPY = 0.58 INR
    CAD: 63.10,      // 1 CAD = 63.10 INR
    AUD: 57.20       // 1 AUD = 57.20 INR
  },

  // Processing fee schedules (MDR in %)
  fees: {
    upi: 0.0,             // 0% as per NPCI mandate for P2M < ₹2000
    rupay_debit: 0.0,     // 0% as per Indian regulations
    visa_mastercard: 1.25,// 1.25% interchange + network fee
    razorpay: 1.85,       // Standard 1.85% MDR
    international: 2.90   // Cross border card fee + FX markup
  },

  // Security Thresholds & Risk Limits
  risk: {
    maxSingleTransactionINR: 500000, // ₹5,00,000
    highValueThresholdINR: 100000,   // ₹1,00,000 (Requires mandatory 3DS challenge)
    velocityWindowSeconds: 60,
    velocityMaxAttempts: 5,
    autoChallengeScore: 40,          // Risk score >= 40 forces 3DS2 OTP
    autoBlockScore: 80               // Risk score >= 80 blocks immediately
  },

  // 3D Secure 2.0 Simulation Credentials
  threeDSecure: {
    testOtp: '123456',
    challengeExpirySeconds: 300 // 5 minutes
  }
};
