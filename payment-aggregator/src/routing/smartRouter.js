/**
 * Smart Routing & Circuit Breaker Engine
 * Dynamically routes payments across UPI Direct, Visa/MasterCard, Razorpay, and International Rails
 */
const upiGateway = require('../gateways/upiSwitch');
const cardGateway = require('../gateways/cardProcessor');
const razorpayGateway = require('../gateways/razorpayAdapter');
const intlGateway = require('../gateways/internationalGateway');

class SmartRouter {
  constructor() {
    this.gateways = {
      upi: upiGateway,
      card_direct: cardGateway,
      razorpay: razorpayGateway,
      international: intlGateway
    };

    // Configurable routing strategies: 'SMART_AUTO' | 'COST_OPTIMIZED' | 'SUCCESS_RATE' | 'FAILOVER'
    this.strategy = 'SMART_AUTO';

    // Manual priority overrides if desired by merchant
    this.priorityOverrides = {
      upi: ['upi', 'razorpay'],
      card_inr: ['card_direct', 'razorpay'],
      card_intl: ['international', 'card_direct'],
      netbanking: ['razorpay'],
      wallet: ['razorpay']
    };
  }

  /**
   * Determine optimal gateway for a transaction
   * @param {object} params { method, currency, amount, riskScore }
   * @returns {object} { primaryGateway, fallbackGateway, decisionReason, routingStrategy }
   */
  resolveGateway(params) {
    const { method, currency = 'INR', amount, riskScore = 10 } = params;
    const isINR = currency.toUpperCase() === 'INR';

    let primary = null;
    let fallback = null;
    let reason = '';

    // 1. Cross-Border / Multi-Currency Routing
    if (!isINR) {
      if (this.gateways.international.status === 'ACTIVE') {
        primary = this.gateways.international;
        fallback = this.gateways.card_direct;
        reason = `Cross-border currency (${currency}): routed to Global Rails with dynamic FX matrix.`;
      } else {
        primary = this.gateways.card_direct;
        fallback = null;
        reason = `Global rails degraded: fallback to Direct Card Rail with DCC conversion.`;
      }
      return { primaryGateway: primary, fallbackGateway: fallback, decisionReason: reason, routingStrategy: this.strategy };
    }

    // 2. Strategy: COST_OPTIMIZED (Prefer lowest MDR fees)
    if (this.strategy === 'COST_OPTIMIZED') {
      if (method === 'upi') {
        primary = this.gateways.upi;
        fallback = this.gateways.razorpay;
        reason = 'Cost-optimized: Selected UPI Direct (0% MDR) over aggregated rails.';
      } else if (method === 'card') {
        // Direct Visa/MC interchange is typically lower than aggregated
        primary = this.gateways.card_direct.status === 'ACTIVE' ? this.gateways.card_direct : this.gateways.razorpay;
        fallback = this.gateways.razorpay;
        reason = 'Cost-optimized: Direct network interchange selected.';
      } else {
        primary = this.gateways.razorpay;
        reason = 'Aggregated rail selected for alternative payment method.';
      }
      return { primaryGateway: primary, fallbackGateway: fallback, decisionReason: reason, routingStrategy: this.strategy };
    }

    // 3. Strategy: SUCCESS_RATE (Route to highest current uptime and success rate)
    if (this.strategy === 'SUCCESS_RATE') {
      const candidates = method === 'upi'
        ? [this.gateways.upi, this.gateways.razorpay]
        : [this.gateways.card_direct, this.gateways.razorpay];

      candidates.sort((a, b) => b.getSuccessRate() - a.getSuccessRate());
      primary = candidates[0];
      fallback = candidates[1];
      reason = `Success-rate optimized: ${primary.name} has highest current success rate (${primary.getSuccessRate()}%).`;
      return { primaryGateway: primary, fallbackGateway: fallback, decisionReason: reason, routingStrategy: this.strategy };
    }

    // 4. Default: SMART_AUTO (Smart Hybrid Routing)
    if (method === 'upi') {
      if (this.gateways.upi.status === 'ACTIVE') {
        primary = this.gateways.upi;
        fallback = this.gateways.razorpay;
        reason = 'Native NPCI UPI Switch selected for instant clearing & 0% MDR.';
      } else {
        primary = this.gateways.razorpay;
        fallback = null;
        reason = 'NPCI direct switch degraded: smart failover to Razorpay UPI gateway.';
      }
    } else if (method === 'card') {
      if (this.gateways.card_direct.status === 'ACTIVE') {
        primary = this.gateways.card_direct;
        fallback = this.gateways.razorpay;
        reason = 'Direct Visa/MasterCard 3DS2 processing rail selected.';
      } else {
        primary = this.gateways.razorpay;
        fallback = null;
        reason = 'Direct card switch degraded: smart failover to Razorpay.';
      }
    } else if (method === 'razorpay' || method === 'netbanking' || method === 'wallet') {
      primary = this.gateways.razorpay;
      fallback = null;
      reason = 'Method requires Razorpay aggregator rail.';
    } else if (method === 'international') {
      primary = this.gateways.international;
      fallback = this.gateways.card_direct;
      reason = 'International payment platform selected.';
    } else {
      primary = this.gateways.razorpay;
      reason = 'Default fallback to primary aggregator.';
    }

    return {
      primaryGateway: primary,
      fallbackGateway: fallback,
      decisionReason: reason,
      routingStrategy: this.strategy
    };
  }

  /**
   * Get health status and metrics of all rails
   */
  getRailStatuses() {
    return Object.entries(this.gateways).map(([key, gateway]) => ({
      key,
      name: gateway.name,
      status: gateway.status,
      successRate: gateway.getSuccessRate(),
      metrics: gateway.metrics,
      supportedMethods: gateway.supportedMethods,
      supportedCurrencies: gateway.supportedCurrencies
    }));
  }

  setStrategy(strategy) {
    if (['SMART_AUTO', 'COST_OPTIMIZED', 'SUCCESS_RATE', 'FAILOVER'].includes(strategy)) {
      this.strategy = strategy;
      return true;
    }
    return false;
  }
}

module.exports = new SmartRouter();
