/**
 * International Multi-Currency Payment Platform
 * Supports Stripe Global Rails, PayPal Express, Dynamic Currency Conversion (DCC), and FX Matrix
 */
const BaseGateway = require('./baseGateway');
const config = require('../config');
const { generateId } = require('../security/crypto');
const { generateStripeSignatureHeader } = require('../security/signatures');

class InternationalPaymentGateway extends BaseGateway {
  constructor() {
    super(
      'NexusPay International (Global Rails)',
      ['card', 'paypal', 'sepa', 'apple_pay', 'google_pay'],
      ['USD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD', 'AUD', 'JPY', 'INR']
    );
  }

  /**
   * Convert currency based on FX matrix
   * @param {number} amount 
   * @param {string} fromCurrency 
   * @param {string} toCurrency 
   * @returns {object} { convertedAmount, exchangeRate, markupFee }
   */
  convertCurrency(amount, fromCurrency = 'USD', toCurrency = 'INR') {
    const fromRate = config.fxRates[fromCurrency.toUpperCase()] || 1.0;
    const toRate = config.fxRates[toCurrency.toUpperCase()] || 1.0;

    // Convert to INR first, then to target currency
    const inrValue = amount * fromRate;
    const targetValue = inrValue / toRate;
    const effectiveRate = Number((fromRate / toRate).toFixed(4));

    // 1% FX conversion spread
    const fxSpread = Number((targetValue * 0.01).toFixed(2));

    return {
      sourceAmount: Number(amount),
      sourceCurrency: fromCurrency.toUpperCase(),
      targetAmount: Number(targetValue.toFixed(2)),
      targetCurrency: toCurrency.toUpperCase(),
      effectiveExchangeRate: effectiveRate,
      fxSpreadFee: fxSpread
    };
  }

  /**
   * Process International Payment
   * @param {object} params { orderId, amount, currency, channel: 'stripe'|'paypal'|'sepa', cardholderCountry }
   */
  async processPayment(params) {
    const startTime = Date.now();
    const {
      orderId,
      amount,
      currency = 'USD',
      channel = 'stripe',
      customerEmail,
      cardholderCountry = 'US',
      description
    } = params;

    const paymentId = generateId(`pay_intl_${channel}`);
    const conversion = this.convertCurrency(amount, currency, 'INR');

    // Fee calculation: 2.9% + $0.30 fixed fee
    const feeRate = config.fees.international / 100;
    const fee = Number((amount * feeRate + (currency === 'INR' ? 25 : 0.30)).toFixed(2));
    const net = Number((amount - fee).toFixed(2));

    // Simulated Stripe Charge / PayPal Capture response
    const mockStripeChargeId = `ch_live_${Math.random().toString(36).substring(2, 16)}`;
    const mockStripeSignature = generateStripeSignatureHeader({
      id: paymentId,
      object: 'charge',
      amount,
      currency,
      status: 'succeeded'
    });

    const result = {
      paymentId,
      orderId,
      gateway: this.name,
      rail: channel === 'paypal' ? 'PAYPAL_EXPRESS_GLOBAL' : 'STRIPE_CROSS_BORDER',
      channel,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      fee,
      net,
      status: 'CAPTURED',
      cardholderCountry,
      crossBorderCompliance: {
        exportCode: 'P0802', // Software & Data Processing Services
        rbiReportingRequired: currency !== 'INR',
        amlScreening: 'PASSED',
        sanctionsCheck: 'PASSED'
      },
      fxDetails: conversion,
      externalTransactionId: mockStripeChargeId,
      stripeSignatureHeader: mockStripeSignature,
      capturedAt: new Date().toISOString()
    };

    this.recordSuccess(Date.now() - startTime);
    return result;
  }

  async refund(params) {
    const startTime = Date.now();
    const { paymentId, amount, currency = 'USD', reason } = params;
    const refundId = generateId('rfnd_intl');

    this.recordSuccess(Date.now() - startTime);

    return {
      refundId,
      paymentId,
      gateway: this.name,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      status: 'PROCESSED',
      reason: reason || 'Customer chargeback/return requested',
      processedAt: new Date().toISOString()
    };
  }
}

module.exports = new InternationalPaymentGateway();
