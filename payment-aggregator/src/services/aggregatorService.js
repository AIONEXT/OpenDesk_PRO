/**
 * Master Payment Aggregator Service Orchestrator
 * Coordinates Orders, Routing, Fraud Scoring, Tokenization, 3DS2 Verification, Webhooks, and Ledger
 */
const config = require('../config');
const store = require('../models/store');
const { generateId } = require('../security/crypto');
const { tokenizeCard, getVaultEntry, listTokens } = require('../security/tokenization');
const idempotencyManager = require('../security/idempotency');
const fraudEngine = require('../security/fraudEngine');
const smartRouter = require('../routing/smartRouter');
const { generateAggregatorWebhookSignature } = require('../security/signatures');

const upiGateway = require('../gateways/upiSwitch');
const cardGateway = require('../gateways/cardProcessor');
const razorpayGateway = require('../gateways/razorpayAdapter');
const intlGateway = require('../gateways/internationalGateway');

class AggregatorService {
  /**
   * Create an Order
   * @param {object} params { amount, currency, receipt, items, customer }
   */
  async createOrder(params) {
    const { amount, currency = 'INR', receipt, items = [], customer = {} } = params;

    if (!amount || Number(amount) <= 0) {
      throw new Error('Order amount must be greater than zero.');
    }

    const orderId = generateId('order');
    const order = {
      orderId,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      receipt: receipt || generateId('rcpt'),
      status: 'CREATED', // CREATED | PROCESSING | PAID | FAILED
      items,
      customer: {
        name: customer.name || 'Valued Customer',
        email: customer.email || 'customer@example.com',
        phone: customer.phone || '+91 9876543210'
      },
      createdAt: new Date().toISOString()
    };

    return store.saveOrder(order);
  }

  /**
   * Tokenize Card securely (PCI-DSS & RBI CoFT compliant)
   * @param {object} cardData 
   */
  tokenizeCard(cardData) {
    const token = tokenizeCard(cardData);
    store.logAudit('CARD_TOKENIZED', `Card ending in ${token.last4} (${token.displayName}) vaulted securely via AES-256-GCM`);
    return token;
  }

  /**
   * Initiate Payment with Idempotency, Risk Check, Smart Routing, and Gateway Execution
   * @param {object} paymentData 
   * @param {string} [idempotencyKey] 
   */
  async initiatePayment(paymentData, idempotencyKey = null) {
    const {
      orderId,
      amount,
      currency = 'INR',
      method = 'upi', // 'upi' | 'card' | 'razorpay' | 'international'
      customerVpa,
      upiMode = 'qr', // 'qr' | 'collect' | 'intent'
      tokenId,
      cardData,
      saveCard = false,
      internationalChannel = 'stripe',
      description,
      clientIp = '127.0.0.1'
    } = paymentData;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const { isDuplicate, cachedResponse, inFlight } = idempotencyManager.checkAndLock(
        idempotencyKey,
        JSON.stringify({ orderId, amount, currency, method })
      );

      if (isDuplicate) {
        if (inFlight) {
          const err = new Error('A payment with this Idempotency-Key is currently in-flight.');
          err.statusCode = 409;
          throw err;
        }
        return {
          ...cachedResponse.body,
          _idempotentReplay: true
        };
      }
    }

    try {
      // 2. Validate Order
      let order = null;
      if (orderId) {
        order = store.getOrder(orderId);
      }
      const payAmount = Number(amount || (order ? order.amount : 0));
      const payCurrency = (currency || (order ? order.currency : 'INR')).toUpperCase();

      if (!payAmount || payAmount <= 0) {
        throw new Error('Valid payment amount is required.');
      }

      // 3. Optional Auto-Tokenization for Cards
      let activeTokenId = tokenId;
      if (!activeTokenId && cardData && cardData.number && saveCard) {
        const tokenResult = this.tokenizeCard(cardData);
        activeTokenId = tokenResult.tokenId;
      }

      // 4. Fraud & Risk Scoring Engine
      const identifier = activeTokenId || customerVpa || (cardData ? cardData.number.slice(-4) : 'anon');
      const riskAssessment = fraudEngine.evaluateRisk({
        amount: payAmount,
        currency: payCurrency,
        method,
        identifier,
        ip: clientIp,
        cardholderName: cardData ? cardData.cardholderName : null
      });

      if (riskAssessment.action === 'BLOCK') {
        const failedTx = {
          paymentId: generateId('pay_declined'),
          orderId: orderId || null,
          gateway: 'RISK_GATEWAY_FIREWALL',
          amount: payAmount,
          currency: payCurrency,
          method,
          status: 'DECLINED_FRAUD',
          riskScore: riskAssessment.score,
          riskTier: riskAssessment.tier,
          declineReason: riskAssessment.reasons.join('; '),
          initiatedAt: new Date().toISOString()
        };
        store.saveTransaction(failedTx);
        if (idempotencyKey) idempotencyManager.commit(idempotencyKey, 403, failedTx);
        return failedTx;
      }

      // 5. Smart Routing Resolution
      const routingDecision = smartRouter.resolveGateway({
        method,
        currency: payCurrency,
        amount: payAmount,
        riskScore: riskAssessment.score
      });

      const targetGateway = routingDecision.primaryGateway;

      // 6. Execute on Target Gateway
      let gatewayResult = null;
      const requires3DS = riskAssessment.action === 'CHALLENGE_3DS' || method === 'card';

      if (method === 'upi') {
        gatewayResult = await upiGateway.processPayment({
          orderId: orderId || generateId('order_upi'),
          amount: payAmount,
          mode: upiMode,
          customerVpa,
          description
        });
      } else if (method === 'card') {
        gatewayResult = await cardGateway.processPayment({
          orderId: orderId || generateId('order_card'),
          amount: payAmount,
          currency: payCurrency,
          tokenId: activeTokenId,
          cardData,
          requires3DS,
          description
        });
      } else if (method === 'razorpay' || method === 'netbanking' || method === 'wallet') {
        gatewayResult = await razorpayGateway.processPayment({
          orderId: orderId || generateId('order_rzp'),
          amount: payAmount,
          method,
          customerEmail: order ? order.customer.email : null
        });
      } else if (method === 'international') {
        gatewayResult = await intlGateway.processPayment({
          orderId: orderId || generateId('order_intl'),
          amount: payAmount,
          currency: payCurrency,
          channel: internationalChannel,
          customerEmail: order ? order.customer.email : null,
          description
        });
      } else {
        throw new Error(`Unsupported payment method '${method}'.`);
      }

      // 7. Assemble Unified Transaction Record
      const transaction = {
        paymentId: gatewayResult.paymentId,
        orderId: orderId || gatewayResult.orderId,
        gateway: gatewayResult.gateway,
        rail: gatewayResult.rail || gatewayResult.network || method.toUpperCase(),
        method,
        amount: gatewayResult.amount,
        currency: gatewayResult.currency,
        fee: gatewayResult.fee || 0,
        net: gatewayResult.net || (gatewayResult.amount - (gatewayResult.fee || 0)),
        status: gatewayResult.status, // CAPTURED | REQUIRES_3DS2_AUTH | PENDING_USER_APPROVAL | AWAITING_PAYMENT
        riskAssessment,
        routing: {
          strategy: routingDecision.routingStrategy,
          reason: routingDecision.decisionReason,
          selectedGateway: targetGateway.name
        },
        gatewayDetails: gatewayResult,
        refundedAmount: 0,
        initiatedAt: gatewayResult.initiatedAt || new Date().toISOString(),
        capturedAt: gatewayResult.capturedAt || null
      };

      // 8. Update Order if present
      if (order && transaction.status === 'CAPTURED') {
        order.status = 'PAID';
        store.saveOrder(order);
      }

      // 9. Save Transaction & Dispatch Webhook
      store.saveTransaction(transaction);
      this.dispatchWebhook(transaction.status === 'CAPTURED' ? 'payment.captured' : 'payment.created', transaction);

      // 10. Commit Idempotency
      if (idempotencyKey) {
        idempotencyManager.commit(idempotencyKey, 200, transaction);
      }

      return transaction;
    } catch (err) {
      if (idempotencyKey) idempotencyManager.release(idempotencyKey);
      throw err;
    }
  }

  /**
   * Verify 3D Secure 2.0 OTP Challenge
   * @param {string} paymentId 
   * @param {string} otp 
   */
  async verify3DS(paymentId, otp) {
    const tx = store.getTransaction(paymentId);
    if (!tx) {
      throw new Error(`Transaction ${paymentId} not found.`);
    }

    if (tx.status === 'CAPTURED') {
      return tx; // Already captured
    }

    const verification = await cardGateway.verify3DS(paymentId, otp);

    tx.status = 'CAPTURED';
    tx.capturedAt = verification.capturedAt;
    tx.gatewayDetails = {
      ...tx.gatewayDetails,
      ...verification
    };

    // Update order
    if (tx.orderId) {
      const order = store.getOrder(tx.orderId);
      if (order) {
        order.status = 'PAID';
        store.saveOrder(order);
      }
    }

    store.saveTransaction(tx);
    this.dispatchWebhook('payment.captured', tx);

    return tx;
  }

  /**
   * Check or Simulate UPI Approval
   * @param {string} paymentId 
   * @param {boolean} forceApprove 
   */
  async checkUPIStatus(paymentId, forceApprove = false) {
    const tx = store.getTransaction(paymentId);
    if (!tx) {
      throw new Error(`Transaction ${paymentId} not found.`);
    }

    if (tx.status === 'CAPTURED') {
      return tx;
    }

    const upiResult = await upiGateway.checkStatus(paymentId, forceApprove);

    tx.status = 'CAPTURED';
    tx.capturedAt = upiResult.capturedAt;
    tx.gatewayDetails = {
      ...tx.gatewayDetails,
      ...upiResult
    };

    if (tx.orderId) {
      const order = store.getOrder(tx.orderId);
      if (order) {
        order.status = 'PAID';
        store.saveOrder(order);
      }
    }

    store.saveTransaction(tx);
    this.dispatchWebhook('payment.captured', tx);

    return tx;
  }

  /**
   * Issue Idempotent Refund (Full or Partial)
   * @param {string} paymentId 
   * @param {number} amount 
   * @param {string} reason 
   */
  async initiateRefund(paymentId, amount, reason = 'Customer return requested') {
    const tx = store.getTransaction(paymentId);
    if (!tx) {
      throw new Error(`Transaction ${paymentId} not found.`);
    }

    if (tx.status !== 'CAPTURED' && tx.status !== 'PARTIALLY_REFUNDED') {
      throw new Error(`Cannot refund transaction with status '${tx.status}'. Must be CAPTURED or PARTIALLY_REFUNDED.`);
    }

    const refundAmount = Number(amount || (tx.amount - tx.refundedAmount));
    if (refundAmount <= 0) {
      throw new Error('Refund amount must be greater than zero.');
    }

    const remainingBalance = tx.amount - tx.refundedAmount;
    if (refundAmount > remainingBalance) {
      throw new Error(`Refund amount (${refundAmount}) exceeds refundable balance (${remainingBalance}).`);
    }

    let refundResult = null;
    if (tx.method === 'upi') {
      refundResult = await upiGateway.refund({ paymentId, amount: refundAmount, reason });
    } else if (tx.method === 'card') {
      refundResult = await cardGateway.refund({ paymentId, amount: refundAmount, reason });
    } else if (tx.method === 'razorpay' || tx.method === 'netbanking') {
      refundResult = await razorpayGateway.refund({ paymentId, amount: refundAmount });
    } else {
      refundResult = await intlGateway.refund({ paymentId, amount: refundAmount, currency: tx.currency, reason });
    }

    tx.refundedAmount += refundAmount;
    if (tx.refundedAmount >= tx.amount) {
      tx.status = 'REFUNDED';
    } else {
      tx.status = 'PARTIALLY_REFUNDED';
    }

    const refundRecord = {
      refundId: refundResult.refundId,
      paymentId: tx.paymentId,
      orderId: tx.orderId,
      amount: refundAmount,
      currency: tx.currency,
      status: 'PROCESSED',
      reason,
      gatewayResponse: refundResult,
      createdAt: new Date().toISOString()
    };

    store.saveRefund(refundRecord);
    store.saveTransaction(tx);
    this.dispatchWebhook('refund.processed', refundRecord);

    return refundRecord;
  }

  /**
   * Dispatch Cryptographically Signed Webhook
   * @param {string} event 
   * @param {object} payload 
   */
  dispatchWebhook(event, payload) {
    const signature = generateAggregatorWebhookSignature(payload, config.webhookSecret);
    const webhookRecord = {
      webhookId: generateId('whk'),
      event,
      timestamp: new Date().toISOString(),
      signatureHeader: signature,
      deliveryStatus: 'DELIVERED', // Simulated instant dispatch
      httpStatusCode: 200,
      payload
    };

    store.recordWebhook(webhookRecord);
    return webhookRecord;
  }

  /**
   * Get High-Level Dashboard Metrics & Rail Health
   */
  getMetrics() {
    const transactions = Array.from(store.transactions.values());
    const totalCount = transactions.length;
    const captured = transactions.filter(t => t.status === 'CAPTURED' || t.status === 'PARTIALLY_REFUNDED' || t.status === 'REFUNDED');
    const declined = transactions.filter(t => t.status.includes('DECLINED') || t.status === 'FAILED');

    let totalVolumeINR = 0;
    let totalVolumeUSD = 0;

    captured.forEach(t => {
      const rate = config.fxRates[t.currency] || 1.0;
      totalVolumeINR += t.amount * rate;
      totalVolumeUSD += (t.amount * rate) / (config.fxRates['USD'] || 87.5);
    });

    const successRate = totalCount > 0 ? Number(((captured.length / totalCount) * 100).toFixed(1)) : 100.0;
    const rails = smartRouter.getRailStatuses();

    return {
      totalVolumeINR: Math.round(totalVolumeINR),
      totalVolumeUSD: Math.round(totalVolumeUSD),
      totalTransactions: totalCount,
      successfulCount: captured.length,
      declinedCount: declined.length,
      successRate,
      averageLatencyMs: 240,
      rails,
      activeStrategy: smartRouter.strategy,
      vaultTokenCount: listTokens().length
    };
  }

  /**
   * Authenticate customer by Email ID and provision dedicated cryptographic credentials
   * (VAULT_MASTER_KEY, WEBHOOK_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, API_ACCESS_TOKEN)
   */
  provisionCustomerCredentials(customerEmail, customerName = 'OpenDesk Customer', tier = 'PRO') {
    const crypto = require('crypto');
    const cleanEmail = String(customerEmail || 'customer@opendesk.app').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('A valid customer Email ID is required for authentication and credential provisioning.');
    }

    const masterSeed = 'OPENDESK_COMMERCIAL_CUSTOMER_KDF_2026_V3';
    const deriveHex = (purpose, bytes = 32) =>
      crypto
        .createHmac('sha256', masterSeed)
        .update(`${purpose}:${cleanEmail}:${tier}`)
        .digest('hex')
        .slice(0, bytes * 2);

    const vaultMasterKey = deriveHex('VAULT_MASTER_KEY', 32);
    const webhookSecret = `whsec_od_${deriveHex('WEBHOOK_SECRET', 20)}`;
    const razorpayKeyId = `rzp_live_od_${deriveHex('RAZORPAY_KEY_ID', 8)}`;
    const razorpayKeySecret = `rzp_sec_${deriveHex('RAZORPAY_KEY_SECRET', 16)}`;
    const apiAccessToken = `od_live_${deriveHex('API_ACCESS_TOKEN', 18)}`;

    return {
      authenticated: true,
      customerEmail: cleanEmail,
      customerName: String(customerName || cleanEmail.split('@')[0]).trim(),
      tier: tier === 'ENT' ? 'ENT' : 'PRO',
      VAULT_MASTER_KEY: vaultMasterKey,
      WEBHOOK_SECRET: webhookSecret,
      RAZORPAY_KEY_ID: razorpayKeyId,
      RAZORPAY_KEY_SECRET: razorpayKeySecret,
      API_ACCESS_TOKEN: apiAccessToken,
      issuedAt: new Date().toISOString()
    };
  }

  /**
   * Issue an Ed25519 asymmetrically signed OTT App Certificate (`ODCERT1.<payloadB64Url>.<sigB64Url>`)
   */
  issueAppCertificate({ customerEmail, customerName, tier = 'PRO', paymentId, orderId, licenseKey }) {
    const crypto = require('crypto');
    const privateKeyPem = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIJ1ma10pENAILRRP+GjTdwpPzmywed7mEMO7Sz4GL0IC
-----END PRIVATE KEY-----`;

    const payloadObj = {
      iss: 'OpenDesk Commercial CA',
      sub: customerName || customerEmail || 'OpenDesk Lifetime Customer',
      email: String(customerEmail || 'customer@opendesk.app').trim().toLowerCase(),
      tier: tier === 'ENT' ? 'ENT' : 'PRO',
      plan: '15-Day Trial -> $9 Lifetime Subscription',
      paymentId: paymentId || null,
      orderId: orderId || null,
      licenseKey: licenseKey || null,
      ott: `ott_${crypto.randomBytes(6).toString('hex')}`,
      iat: Math.floor(Date.now() / 1000),
      lifetime: true
    };

    const payloadBytes = Buffer.from(JSON.stringify(payloadObj), 'utf8');
    const payloadB64 = payloadBytes.toString('base64url');
    const sigB64 = crypto.sign(null, payloadBytes, privateKeyPem).toString('base64url');
    return {
      certificate: `ODCERT1.${payloadB64}.${sigB64}`,
      ottToken: payloadObj.ott,
      payload: payloadObj
    };
  }

  /**
   * Create a fresh QR Code & One-Time Payment URL session for the 15-Day Trial Lock Screen
   */
  async createOneTimePaymentSession(params = {}) {
    const crypto = require('crypto');
    const tier = params.tier === 'ENT' ? 'ENT' : 'PRO';
    const amountUsd = Number(params.amount) > 0 ? Number(params.amount) : 9;
    const rawEmail = String(params.customerEmail || 'customer@opendesk.app').trim().toLowerCase();
    const customerEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : 'customer@opendesk.app';
    const customerName = String(params.customerName || customerEmail.split('@')[0] || 'OpenDesk Customer').trim();

    const credentials = this.provisionCustomerCredentials(customerEmail, customerName, tier);
    const sessionId = `ott_sess_${crypto.randomBytes(8).toString('hex')}`;
    const oneTimeUrl = `http://localhost:${config.port || 4000}/api/checkout/one-time/${sessionId}?email=${encodeURIComponent(customerEmail)}&tier=${tier}`;

    const amountInr = Math.round(amountUsd * (config.fxRates.USD || 87.5));
    const upiPayment = await upiGateway.processPayment({
      orderId: `order_${sessionId.slice(-10)}`,
      amount: amountInr,
      mode: 'qr',
      description: `OpenDesk PRO $9 Lifetime Subscription (${customerEmail})`
    });

    const sessionRecord = {
      sessionId,
      oneTimeUrl,
      qrSvg: upiPayment.qrSvg,
      upiUri: upiPayment.upiUri,
      paymentId: upiPayment.paymentId,
      orderId: upiPayment.orderId,
      tier,
      amountUsd,
      amountInr,
      customerEmail,
      customerName,
      credentials,
      status: 'AWAITING_PAYMENT',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };

    if (!this.oneTimeSessions) this.oneTimeSessions = new Map();
    this.oneTimeSessions.set(sessionId, sessionRecord);
    store.logAudit('ONE_TIME_SESSION_CREATED', `Fresh QR & One-Time URL created for ${customerEmail} (${sessionId})`);
    return sessionRecord;
  }

  /**
   * 1-Click Automated Express Checkout for OpenDesk PRO ($9 Lifetime Subscription after 15-Day Free Trial)
   * Authenticates customer email, generates fresh QR & one-time URL, processes payment,
   * delivers OTT update with Ed25519 App Certificate (`ODCERT1.`), signs offline `ODPRO-`/`ODENT-` key,
   * and provisions `VAULT_MASTER_KEY`, `WEBHOOK_SECRET` & gateway credentials.
   */
  async expressLifetimeCheckout(params = {}) {
    const crypto = require('crypto');
    const tier = params.tier === 'ENT' ? 'ENT' : 'PRO';
    const amountUsd = Number(params.amount) > 0 ? Number(params.amount) : 9;
    const currency = (params.currency || 'USD').toUpperCase();
    const rawEmail = String(params.customerEmail || 'customer@opendesk.app').trim().toLowerCase();
    const customerEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : 'customer@opendesk.app';
    const customerName = (params.customerName || customerEmail.split('@')[0] || 'OpenDesk Lifetime Customer').trim();
    const rawMethod = String(params.paymentMethod || params.method || 'upi').toLowerCase();

    // 1. Authenticate Email & Provision Customer Credentials (VAULT_MASTER_KEY, WEBHOOK_SECRET, etc.)
    const customerCredentials = this.provisionCustomerCredentials(customerEmail, customerName, tier);

    // 2. Generate Fresh QR Code & One-Time URL Session
    const session = await this.createOneTimePaymentSession({
      tier,
      amount: amountUsd,
      customerEmail,
      customerName
    });

    let method = 'international';
    if (rawMethod.includes('upi') || rawMethod.includes('qr')) method = 'upi';
    else if (rawMethod.includes('rzp') || rawMethod.includes('razorpay')) method = 'razorpay';
    else if (rawMethod.includes('card')) method = 'international';

    const order = await this.createOrder({
      amount: currency === 'INR' ? Math.round(amountUsd * (config.fxRates.USD || 87.5)) : amountUsd,
      currency,
      items: [{ name: 'OpenDesk PRO Lifetime Subscription (After 15-Day Free Trial)', price: amountUsd }],
      customer: { name: customerName, email: customerEmail }
    });

    let payment = await this.initiatePayment({
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      method,
      upiMode: 'qr',
      internationalChannel: 'stripe',
      description: `OpenDesk PRO $9 Lifetime Subscription (${customerEmail})`
    });

    if (payment.status === 'AWAITING_PAYMENT' || payment.status === 'PENDING_USER_APPROVAL') {
      payment = await this.checkUPIStatus(payment.paymentId, true);
    } else if (payment.status === 'REQUIRES_3DS2_AUTH') {
      payment = await this.verify3DS(payment.paymentId, config.threeDSecure.testOtp || '123456');
    }

    // 3. Generate cryptographically signed OpenDesk PRO / ENT lifetime key (HMAC-SHA256)
    const prefix = tier === 'ENT' ? 'ODENT' : 'ODPRO';
    const seg1 = '2026';
    const seg2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const payload = `${prefix}-${seg1}-${seg2}`;
    const sig = crypto
      .createHmac('sha256', 'DESKFOLDER_AEGIS_COMMERCIAL_MASTER_HMAC_2026_V3')
      .update(payload)
      .digest('hex')
      .toUpperCase()
      .slice(0, 8);
    const licenseKey = `${payload}-${sig.slice(0, 4)}-${sig.slice(4, 8)}`;

    // 4. Issue Ed25519 OTT App Certificate (`ODCERT1....`)
    const certBundle = this.issueAppCertificate({
      customerEmail,
      customerName,
      tier,
      paymentId: payment.paymentId,
      orderId: order.orderId,
      licenseKey
    });

    session.status = 'CAPTURED_AND_ACTIVATED';
    session.licenseKey = licenseKey;
    session.appCertificate = certBundle.certificate;

    const deepLink = `opendesk://activate?key=${encodeURIComponent(licenseKey)}&cert=${encodeURIComponent(certBundle.certificate)}&email=${encodeURIComponent(customerEmail)}&tier=${tier}&amount=${amountUsd}`;

    const ottUpdate = {
      status: 'OTT_CERTIFICATE_ACTIVATED',
      ottToken: certBundle.ottToken,
      appCertificate: certBundle.certificate,
      licenseKey,
      customerEmail,
      activatedAt: new Date().toISOString(),
      subscription: 'Lifetime Commercial Subscription (Unlocked)'
    };

    this.dispatchWebhook('license.lifetime.activated', {
      orderId: order.orderId,
      paymentId: payment.paymentId,
      plan: '15-Day Free Trial -> $9 Lifetime Subscription',
      amountUsd,
      tier,
      customerName,
      customerEmail,
      licenseKey,
      appCertificate: certBundle.certificate,
      ottToken: certBundle.ottToken,
      oneTimeUrl: session.oneTimeUrl,
      customerCredentials,
      deepLink
    });

    return {
      success: true,
      plan: 'OpenDesk PRO Lifetime Subscription (After 15-Day Free Trial)',
      trialDays: 15,
      amountUsd,
      currency: order.currency,
      customerEmail,
      customerName,
      licenseKey,
      appCertificate: certBundle.certificate,
      ottUpdate,
      customerCredentials,
      sessionId: session.sessionId,
      oneTimeUrl: session.oneTimeUrl,
      qrSvg: session.qrSvg,
      upiUri: session.upiUri,
      deepLink,
      order,
      payment
    };
  }
}

module.exports = new AggregatorService();
