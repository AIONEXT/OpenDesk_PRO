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
   * 1-Click Automated Express Checkout for OpenDesk PRO ($9 Lifetime Subscription after 15-Day Free Trial)
   * Eliminates multi-step friction, auto-captures across UPI / Card / Razorpay / Global, and signs an offline ODPRO/ODENT license key.
   */
  async expressLifetimeCheckout(params = {}) {
    const crypto = require('crypto');
    const tier = params.tier === 'ENT' ? 'ENT' : 'PRO';
    const amountUsd = Number(params.amount) > 0 ? Number(params.amount) : 9;
    const currency = (params.currency || 'USD').toUpperCase();
    const customerName = (params.customerName || 'OpenDesk Lifetime Customer').trim();
    const customerEmail = (params.customerEmail || 'customer@opendesk.app').trim();
    const rawMethod = String(params.paymentMethod || params.method || 'upi').toLowerCase();

    let method = 'international';
    if (rawMethod.includes('upi')) method = 'upi';
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
      description: 'OpenDesk PRO $9 Lifetime Subscription (15-Day Free Trial Upgrade)'
    });

    if (payment.status === 'AWAITING_PAYMENT' || payment.status === 'PENDING_USER_APPROVAL') {
      payment = await this.checkUPIStatus(payment.paymentId, true);
    } else if (payment.status === 'REQUIRES_3DS2_AUTH') {
      payment = await this.verify3DS(payment.paymentId, config.threeDSecure.testOtp || '123456');
    }

    // Generate cryptographically signed OpenDesk PRO / ENT lifetime key (HMAC-SHA256 compatible with licenseEngine.ts)
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
    const deepLink = `opendesk://activate?key=${encodeURIComponent(licenseKey)}&tier=${tier}&amount=${amountUsd}`;

    this.dispatchWebhook('license.lifetime.activated', {
      orderId: order.orderId,
      paymentId: payment.paymentId,
      plan: '15-Day Free Trial -> $9 Lifetime Subscription',
      amountUsd,
      tier,
      customerName,
      customerEmail,
      licenseKey,
      deepLink
    });

    return {
      success: true,
      plan: 'OpenDesk PRO Lifetime Subscription (After 15-Day Free Trial)',
      trialDays: 15,
      amountUsd,
      currency: order.currency,
      licenseKey,
      deepLink,
      order,
      payment
    };
  }
}

module.exports = new AggregatorService();
