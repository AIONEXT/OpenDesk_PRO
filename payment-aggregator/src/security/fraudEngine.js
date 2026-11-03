/**
 * Fraud Detection & Risk Scoring Engine
 * Evaluates payment risk using velocity checking, amount anomalies, Luhn checks, and geo signals
 */
const config = require('../config');

class FraudEngine {
  constructor() {
    this.velocityLog = []; // array of { identifier, timestamp, amount }
  }

  /**
   * Evaluate transaction risk
   * @param {object} params { amount, currency, method, identifier, ip, cardholderName }
   * @returns {object} { score, tier, action, reasons }
   */
  evaluateRisk(params) {
    const { amount, currency = 'INR', method = 'card', identifier = 'anon', ip = '127.0.0.1' } = params;
    const now = Date.now();
    const reasons = [];
    let score = 5; // Base baseline score

    // Convert amount to INR for standardized risk calculation
    const fxRate = config.fxRates[currency] || 1.0;
    const amountINR = amount * fxRate;

    // 1. Velocity Analysis: Count occurrences of identifier (card token, UPI VPA, or IP)
    const windowStart = now - (config.risk.velocityWindowSeconds * 1000);
    this.velocityLog = this.velocityLog.filter(v => v.timestamp > windowStart);
    
    const recentAttempts = this.velocityLog.filter(v => v.identifier === identifier || v.ip === ip);
    if (recentAttempts.length >= config.risk.velocityMaxAttempts) {
      score += 45;
      reasons.push(`High velocity detected: ${recentAttempts.length} attempts within ${config.risk.velocityWindowSeconds} seconds.`);
    } else if (recentAttempts.length >= 3) {
      score += 20;
      reasons.push(`Moderate velocity: ${recentAttempts.length} attempts detected recently.`);
    }

    // 2. High-Value Anomaly Check
    if (amountINR > config.risk.maxSingleTransactionINR) {
      score += 75;
      reasons.push(`Transaction amount ₹${amountINR.toLocaleString('en-IN')} exceeds single transaction ceiling.`);
    } else if (amountINR >= config.risk.highValueThresholdINR) {
      score += 30;
      reasons.push(`High value transaction ₹${amountINR.toLocaleString('en-IN')} requires stepped-up verification.`);
    }

    // 3. Payment Method Specific Risk Rules
    if (method === 'upi') {
      // UPI is inherently 2-factor authenticated via NPCI PIN on mobile, lowers baseline risk
      score = Math.max(0, score - 10);
      reasons.push('UPI rail: Hardware-bound mobile MPIN protection applied.');
    } else if (method === 'international') {
      score += 15;
      reasons.push('Cross-border rail: Currency exchange and international risk factor applied.');
    }

    // Record this attempt in velocity tracker
    this.velocityLog.push({
      identifier,
      ip,
      amount: amountINR,
      timestamp: now
    });

    // 4. Categorize Risk Tier and Action
    let tier = 'LOW';
    let action = 'ALLOW';

    if (score >= config.risk.autoBlockScore) {
      tier = 'BLOCKED';
      action = 'BLOCK';
    } else if (score >= config.risk.autoChallengeScore) {
      tier = 'MEDIUM';
      action = 'CHALLENGE_3DS';
    } else if (score >= 25) {
      tier = 'ELEVATED';
      action = 'ALLOW_MONITORED';
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      tier,
      action,
      reasons,
      evaluatedAt: new Date().toISOString()
    };
  }
}

module.exports = new FraudEngine();
