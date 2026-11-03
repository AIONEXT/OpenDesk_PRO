/**
 * Base Gateway Interface
 * Contract that all payment rail adapters (UPI, Cards, Razorpay, International) must implement
 */
class BaseGateway {
  constructor(name, supportedMethods = [], supportedCurrencies = []) {
    this.name = name;
    this.supportedMethods = supportedMethods;
    this.supportedCurrencies = supportedCurrencies;
    this.status = 'ACTIVE'; // ACTIVE | DEGRADED | DOWN
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgLatencyMs: 120,
      consecutiveFailures: 0
    };
  }

  recordSuccess(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.avgLatencyMs = Math.round(
      (this.metrics.avgLatencyMs * 0.8) + (latencyMs * 0.2)
    );
    if (this.status === 'DEGRADED') this.status = 'ACTIVE';
  }

  recordFailure(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.consecutiveFailures++;
    this.metrics.avgLatencyMs = Math.round(
      (this.metrics.avgLatencyMs * 0.8) + (latencyMs * 0.2)
    );
    if (this.metrics.consecutiveFailures >= 3) {
      this.status = 'DEGRADED';
    }
    if (this.metrics.consecutiveFailures >= 5) {
      this.status = 'DOWN';
    }
  }

  getSuccessRate() {
    if (this.metrics.totalRequests === 0) return 100.0;
    return Number(((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1));
  }

  async createOrder(params) {
    throw new Error('createOrder() must be implemented by adapter subclass.');
  }

  async processPayment(params) {
    throw new Error('processPayment() must be implemented by adapter subclass.');
  }

  async verifyPayment(params) {
    throw new Error('verifyPayment() must be implemented by adapter subclass.');
  }

  async refund(params) {
    throw new Error('refund() must be implemented by adapter subclass.');
  }
}

module.exports = BaseGateway;
