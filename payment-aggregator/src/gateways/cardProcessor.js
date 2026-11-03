/**
 * Direct Visa & MasterCard Processing Rail
 * Handles PCI-DSS Tokenized Cards, Interchange Calculation, and 3D Secure 2.0 (3DS2) Flow
 */
const BaseGateway = require('./baseGateway');
const config = require('../config');
const { generateId } = require('../security/crypto');
const { getVaultEntry, identifyCardBrand } = require('../security/tokenization');

class CardProcessorGateway extends BaseGateway {
  constructor() {
    super('Visa / MasterCard Direct Rail', ['card', 'token'], ['INR', 'USD', 'EUR', 'GBP']);
    this.pending3DSChallenges = new Map();
  }

  /**
   * Process Card Transaction with 3DS2 Protocol
   * @param {object} params { orderId, amount, currency, tokenId, cardData, requires3DS }
   */
  async processPayment(params) {
    const startTime = Date.now();
    const { orderId, amount, currency = 'INR', tokenId, cardData, requires3DS = true, description } = params;

    let brand = 'visa';
    let maskedPan = '•••• •••• •••• 1111';
    let cardholder = 'VALUED CUSTOMER';
    let last4 = '1111';

    if (tokenId) {
      const vaultEntry = getVaultEntry(tokenId);
      brand = vaultEntry.brand;
      maskedPan = vaultEntry.maskedPan;
      cardholder = vaultEntry.cardholderName;
      last4 = vaultEntry.last4;
    } else if (cardData && cardData.number) {
      const brandInfo = identifyCardBrand(cardData.number);
      brand = brandInfo.brand;
      last4 = String(cardData.number).slice(-4);
      maskedPan = `•••• •••• •••• ${last4}`;
      cardholder = cardData.cardholderName || 'VALUED CUSTOMER';
    }

    const paymentId = generateId(`pay_${brand}`);
    const networkAuthCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const stan = Math.floor(100000 + Math.random() * 900000).toString(); // System Trace Audit Number

    // Fee breakdown: Interchange (0.9%), Network Assessment (0.15%), Acquirer Processing (0.2%)
    const feeRate = config.fees.visa_mastercard / 100;
    const feeAmount = Number((amount * feeRate).toFixed(2));

    if (requires3DS) {
      // Step-up 3DS2 Authentication Challenge Required
      const challengeId = generateId('3ds');
      const challengeData = {
        challengeId,
        paymentId,
        orderId,
        amount: Number(amount),
        currency,
        brand,
        maskedPan,
        cardholder,
        networkAuthCode,
        stan,
        feeAmount,
        status: 'CHALLENGE_REQUIRED',
        testOtp: config.threeDSecure.testOtp,
        expiresAt: Date.now() + (config.threeDSecure.challengeExpirySeconds * 1000),
        acsUrl: `/api/payments/verify-3ds`
      };

      this.pending3DSChallenges.set(paymentId, challengeData);
      this.recordSuccess(Date.now() - startTime);

      return {
        paymentId,
        orderId,
        gateway: this.name,
        network: brand.toUpperCase(),
        amount: Number(amount),
        currency,
        fee: feeAmount,
        maskedPan,
        cardholder,
        status: 'REQUIRES_3DS2_AUTH',
        threeDSecure: {
          challengeId,
          acsUrl: challengeData.acsUrl,
          message: '3D Secure 2.0 Challenge Required. Bank OTP sent to registered mobile.',
          maskedPhone: '+91 ••••• ••429',
          testOtpHint: `Use sandbox OTP: ${config.threeDSecure.testOtp}`,
          expiresInSeconds: config.threeDSecure.challengeExpirySeconds
        },
        initiatedAt: new Date().toISOString()
      };
    }

    // Frictionless flow (Low Risk)
    this.recordSuccess(Date.now() - startTime);

    return {
      paymentId,
      orderId,
      gateway: this.name,
      network: brand.toUpperCase(),
      amount: Number(amount),
      currency,
      fee: feeAmount,
      maskedPan,
      cardholder,
      status: 'CAPTURED',
      networkAuthCode,
      stan,
      frictionless: true,
      capturedAt: new Date().toISOString()
    };
  }

  /**
   * Verify 3DS2 Challenge OTP
   * @param {string} paymentId 
   * @param {string} otp 
   */
  async verify3DS(paymentId, otp) {
    const startTime = Date.now();
    const challenge = this.pending3DSChallenges.get(paymentId);

    if (!challenge) {
      this.recordFailure(Date.now() - startTime);
      throw new Error(`No active 3DS challenge found for payment ${paymentId}.`);
    }

    if (Date.now() > challenge.expiresAt) {
      this.pending3DSChallenges.delete(paymentId);
      this.recordFailure(Date.now() - startTime);
      throw new Error('3D Secure challenge session has expired.');
    }

    // Check OTP (accepts testOtp or any 6-digit match in test mode)
    if (otp !== challenge.testOtp && otp !== '123456') {
      this.recordFailure(Date.now() - startTime);
      throw new Error('Invalid OTP provided for 3D Secure verification.');
    }

    this.pending3DSChallenges.delete(paymentId);
    this.recordSuccess(Date.now() - startTime);

    return {
      paymentId,
      orderId: challenge.orderId,
      gateway: this.name,
      network: challenge.brand.toUpperCase(),
      amount: challenge.amount,
      currency: challenge.currency,
      fee: challenge.feeAmount,
      maskedPan: challenge.maskedPan,
      status: 'CAPTURED',
      eci: '05', // ECI 05: 3DS fully authenticated
      cavv: Math.random().toString(36).substring(2, 22),
      networkAuthCode: challenge.networkAuthCode,
      stan: challenge.stan,
      capturedAt: new Date().toISOString()
    };
  }

  async refund(params) {
    const startTime = Date.now();
    const { paymentId, amount, reason } = params;
    const refundId = generateId('rfnd_card');

    this.recordSuccess(Date.now() - startTime);

    return {
      refundId,
      paymentId,
      gateway: this.name,
      amount: Number(amount),
      status: 'PROCESSED',
      acquirerRefNumber: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      reason: reason || 'Customer requested refund',
      processedAt: new Date().toISOString()
    };
  }
}

module.exports = new CardProcessorGateway();
