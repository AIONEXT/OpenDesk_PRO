/**
 * Automated Verification Suite for NexusPay Global Aggregator
 * Tests UPI, Visa/MasterCard, Razorpay, International Rails, Tokenization, 3DS2, Idempotency, and Fraud Scoring
 */
const assert = require('assert');
const aggregatorService = require('../src/services/aggregatorService');
const { tokenizeCard, validateLuhn, identifyCardBrand, getVaultEntry } = require('../src/security/tokenization');
const { generateRazorpaySignature, verifyRazorpaySignature, generateAggregatorWebhookSignature } = require('../src/security/signatures');
const { verifyHmacSignature } = require('../src/security/crypto');
const idempotencyManager = require('../src/security/idempotency');
const fraudEngine = require('../src/security/fraudEngine');
const smartRouter = require('../src/routing/smartRouter');
const store = require('../src/models/store');
const config = require('../src/config');

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🧪 Starting NexusPay Aggregator Automated Verification Suite');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // --- 1. Cryptography & Signature Verification ---
  test('Crypto: HMAC-SHA256 signature generation and timing-safe verification', () => {
    const payload = { event: 'payment.captured', amount: 5499 };
    const secret = 'test_secret_key_12345';
    const sig = generateAggregatorWebhookSignature(payload, secret);
    assert(sig && typeof sig === 'string', 'Signature must be a non-empty string');
    assert(verifyHmacSignature(payload, sig, secret), 'Signature should be verified successfully');
    assert(!verifyHmacSignature(payload, sig, 'wrong_secret'), 'Wrong secret must fail verification');
  });

  test('Signatures: Razorpay order & payment HMAC-SHA256 algorithm', () => {
    const orderId = 'order_rzp_test_123';
    const paymentId = 'pay_rzp_test_456';
    const secret = 'rzp_secret_9988';
    const sig = generateRazorpaySignature(orderId, paymentId, secret);
    assert(verifyRazorpaySignature(orderId, paymentId, sig, secret), 'Razorpay signature must verify');
    assert(!verifyRazorpaySignature(orderId, 'pay_tampered', sig, secret), 'Tampered payment ID must fail');
  });

  // --- 2. PCI-DSS Tokenization & Card Vault ---
  test('Tokenization: Luhn check and brand detection for Visa, MasterCard & RuPay', () => {
    assert(validateLuhn('4111111111111111'), 'Visa test card should pass Luhn');
    assert(validateLuhn('5555555555554444'), 'MasterCard test card should pass Luhn');
    assert(validateLuhn('6071234567890120'), 'RuPay test card should pass Luhn');
    assert(!validateLuhn('4111111111111119'), 'Invalid card number must fail Luhn');

    assert.strictEqual(identifyCardBrand('4111111111111111').brand, 'visa');
    assert.strictEqual(identifyCardBrand('5555555555554444').brand, 'mastercard');
    assert.strictEqual(identifyCardBrand('6071234567890120').brand, 'rupay');
  });

  test('Card Vault: Encrypt card into AES-256-GCM vault with zero raw PAN exposure', () => {
    const rawCard = {
      number: '4111111111111111',
      cardholderName: 'Vikram Seth',
      expMonth: '11',
      expYear: '28',
      cvv: '888'
    };

    const token = tokenizeCard(rawCard);
    assert(token.tokenId.startsWith('tok_visa_'), 'Token ID must be formatted with brand');
    assert.strictEqual(token.maskedPan, '4111 •••• •••• 1111', 'PAN must be masked (PCI-DSS)');
    assert.strictEqual(token.cvv, undefined, 'CVV must never be returned or stored in token view');

    // Internal vault check
    const vaultEntry = getVaultEntry(token.tokenId);
    assert.strictEqual(vaultEntry.rawCard.pan, '4111111111111111', 'Vault decrypts PAN accurately');
  });

  // --- 3. Fraud & Risk Engine ---
  test('Fraud Engine: Risk scoring assigns correct risk tier and detects anomalies', () => {
    const normalAssessment = fraudEngine.evaluateRisk({
      amount: 2500,
      currency: 'INR',
      method: 'upi',
      identifier: 'clean_user_1',
      ip: '10.0.0.1'
    });
    assert.strictEqual(normalAssessment.tier, 'LOW', 'Low amount UPI must be LOW risk');

    const hugeAssessment = fraudEngine.evaluateRisk({
      amount: 1500000, // ₹15 Lakhs (exceeds max ceiling)
      currency: 'INR',
      method: 'card',
      identifier: 'risk_user_2',
      ip: '10.0.0.2'
    });
    assert.strictEqual(hugeAssessment.tier, 'BLOCKED', 'Excessive transaction must be BLOCKED');
    assert.strictEqual(hugeAssessment.action, 'BLOCK', 'Action must be BLOCK');
  });

  // --- 4. Idempotency Key Handling ---
  await testAsync('Security: Idempotency Key prevents duplicate charges', async () => {
    const idempKey = 'idemp_test_unit_' + Date.now();
    const paymentReq = {
      amount: 1999,
      currency: 'INR',
      method: 'upi',
      description: 'Idempotency test order'
    };

    const first = await aggregatorService.initiatePayment(paymentReq, idempKey);
    const second = await aggregatorService.initiatePayment(paymentReq, idempKey);

    assert.strictEqual(first.paymentId, second.paymentId, 'Both calls must return identical paymentId');
    assert.strictEqual(second._idempotentReplay, true, 'Second call must flag _idempotentReplay');
  });

  // --- 5. UPI Direct NPCI Payment Flow ---
  await testAsync('UPI Rail: Dynamic QR generation and status capture simulation', async () => {
    const payment = await aggregatorService.initiatePayment({
      amount: 2499,
      currency: 'INR',
      method: 'upi',
      upiMode: 'qr',
      description: 'Subscription order'
    });

    assert(payment.paymentId.startsWith('pay_upi_'), 'Must generate UPI payment ID');
    assert.strictEqual(payment.status, 'AWAITING_PAYMENT');
    assert(payment.gatewayDetails.qrSvg.includes('<svg'), 'Dynamic vector SVG QR must be generated');
    assert(payment.gatewayDetails.upiUri.startsWith('upi://pay?'), 'Must generate standard NPCI UPI URI');

    // Simulate mobile approval
    const approved = await aggregatorService.checkUPIStatus(payment.paymentId, true);
    assert.strictEqual(approved.status, 'CAPTURED', 'UPI status must transition to CAPTURED');
    assert(approved.gatewayDetails.npciRrn, 'Must include NPCI 12-digit RRN reference');
  });

  // --- 6. Card Payment Rail & 3DS2 Challenge Flow ---
  await testAsync('Card Rail: Visa payment with 3DS2 challenge and OTP verification', async () => {
    const payment = await aggregatorService.initiatePayment({
      amount: 4500,
      currency: 'INR',
      method: 'card',
      cardData: {
        number: '4111111111111111',
        cardholderName: 'Ananya Roy',
        expMonth: '08',
        expYear: '29',
        cvv: '321'
      },
      saveCard: true
    });

    assert.strictEqual(payment.status, 'REQUIRES_3DS2_AUTH', 'Card transaction must trigger 3DS2 challenge');
    assert.strictEqual(payment.gatewayDetails.threeDSecure.testOtpHint, 'Use sandbox OTP: 123456');

    // Submit valid OTP
    const verified = await aggregatorService.verify3DS(payment.paymentId, '123456');
    assert.strictEqual(verified.status, 'CAPTURED', 'Status must transition to CAPTURED post-OTP');
    assert.strictEqual(verified.gatewayDetails.eci, '05', 'ECI must indicate full 3DS authentication');
  });

  // --- 7. Razorpay Adapter Flow ---
  await testAsync('Razorpay Rail: Standard Indian gateway order & capture with GST breakdown', async () => {
    const payment = await aggregatorService.initiatePayment({
      amount: 3200,
      currency: 'INR',
      method: 'razorpay',
      description: 'Online store purchase'
    });

    assert.strictEqual(payment.status, 'CAPTURED');
    assert.strictEqual(payment.gateway, 'Razorpay Payment Gateway');
    assert(payment.gatewayDetails.signatureVerified, 'Razorpay HMAC signature must verify');
    assert(payment.gatewayDetails.fee > 0, 'MDR fee must be computed');
    assert(payment.gatewayDetails.tax > 0, '18% GST tax must be calculated on fee');
  });

  // --- 8. International Multi-Currency Cross-Border Platform ---
  await testAsync('International Rail: Cross-border USD payment with dynamic FX conversion', async () => {
    const payment = await aggregatorService.initiatePayment({
      amount: 99.00,
      currency: 'USD',
      method: 'international',
      internationalChannel: 'stripe',
      description: 'Global SaaS enterprise subscription'
    });

    assert.strictEqual(payment.currency, 'USD');
    assert.strictEqual(payment.status, 'CAPTURED');
    assert.strictEqual(payment.gatewayDetails.crossBorderCompliance.exportCode, 'P0802');
    assert(payment.gatewayDetails.fxDetails.targetAmount > 0, 'Target INR equivalent must be calculated');
  });

  // --- 9. Full and Partial Refund Flow ---
  await testAsync('Refund Engine: Idempotent partial and full refunds with ledger tracking', async () => {
    // 1. Create a captured payment
    const payment = await aggregatorService.initiatePayment({
      amount: 1000,
      currency: 'INR',
      method: 'razorpay'
    });

    // 2. Partial refund of ₹400
    const partial = await aggregatorService.initiateRefund(payment.paymentId, 400, 'Partial return');
    assert.strictEqual(partial.amount, 400);

    const txAfterPartial = store.getTransaction(payment.paymentId);
    assert.strictEqual(txAfterPartial.refundedAmount, 400);
    assert.strictEqual(txAfterPartial.status, 'PARTIALLY_REFUNDED');

    // 3. Complete remaining refund of ₹600
    const full = await aggregatorService.initiateRefund(payment.paymentId, 600, 'Remaining return');
    assert.strictEqual(full.amount, 600);

    const txAfterFull = store.getTransaction(payment.paymentId);
    assert.strictEqual(txAfterFull.refundedAmount, 1000);
    assert.strictEqual(txAfterFull.status, 'REFUNDED');
  });

  // --- 10. Webhooks & High-Level Metrics ---
  test('Webhooks & Metrics: Real-time telemetry, signed dispatches, and rail statuses', () => {
    const metrics = aggregatorService.getMetrics();
    assert(metrics.totalTransactions > 0, 'Metrics should count transactions');
    assert(metrics.rails.length >= 4, 'Must report health of all 4 payment rails');
    assert(metrics.successRate >= 0 && metrics.successRate <= 100, 'Success rate must be valid percentage');

    const webhooks = store.listWebhooks();
    assert(webhooks.length > 0, 'Dispatched webhooks must be logged');
    assert(webhooks[0].signatureHeader, 'Webhook must be cryptographically signed');
  });

  // --- 11. 1-Click Automated Express Checkout ($9 Lifetime after 15-Day Free Trial) ---
  await testAsync('Express Automated Checkout: 15-Day Trial -> $9 Lifetime Subscription & ODPRO Key Issuance', async () => {
    const expressRes = await aggregatorService.expressLifetimeCheckout({
      tier: 'PRO',
      amount: 9,
      currency: 'USD',
      paymentMethod: 'upi',
      customerName: 'Aarav Sharma',
      customerEmail: 'aarav@opendesk.app'
    });

    assert.strictEqual(expressRes.success, true);
    assert.strictEqual(expressRes.trialDays, 15);
    assert.strictEqual(expressRes.amountUsd, 9);
    assert(expressRes.licenseKey.startsWith('ODPRO-2026-'), 'Must issue signed ODPRO-2026 license key');
    assert(expressRes.deepLink.startsWith('opendesk://activate?key='), 'Must include 1-click app activation deep link');
    assert.strictEqual(expressRes.payment.status, 'CAPTURED', 'Express checkout must auto-capture immediately');
  });

  // Summary
  console.log('\n===============================================================');
  console.log(`📊 Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('===============================================================\n');

  if (passed === total) {
    console.log('🚀 All Payment Aggregator systems and security protocols PASSED verification!');
    return true;
  } else {
    throw new Error(`Test suite failed: ${total - passed} failures`);
  }
}

runTestSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
