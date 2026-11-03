/**
 * Central State & Ledger Store
 * Tracks Orders, Transactions, Tokens, Refunds, Webhooks, and System Audit Logs
 * Auto-persists to disk at data/store.json
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/store.json');

class Store {
  constructor() {
    this.orders = new Map();
    this.transactions = new Map();
    this.refunds = new Map();
    this.webhooks = [];
    this.auditLogs = [];
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.orders) data.orders.forEach(o => this.orders.set(o.orderId || o.id, o));
        if (data.transactions) data.transactions.forEach(t => this.transactions.set(t.paymentId, t));
        if (data.refunds) data.refunds.forEach(r => this.refunds.set(r.refundId, r));
        if (data.webhooks) this.webhooks = data.webhooks;
        if (data.auditLogs) this.auditLogs = data.auditLogs;
      }
    } catch (err) {
      console.warn('Could not load persistent store, starting fresh:', err.message);
    }
  }

  saveToDisk() {
    try {
      const data = {
        orders: Array.from(this.orders.values()),
        transactions: Array.from(this.transactions.values()),
        refunds: Array.from(this.refunds.values()),
        webhooks: this.webhooks.slice(-100), // Keep last 100
        auditLogs: this.auditLogs.slice(-200) // Keep last 200
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save store to disk:', err.message);
    }
  }

  // --- Orders ---
  saveOrder(order) {
    this.orders.set(order.orderId, order);
    this.logAudit('ORDER_CREATED', `Order ${order.orderId} created for ${order.currency} ${order.amount}`);
    this.saveToDisk();
    return order;
  }

  getOrder(orderId) {
    return this.orders.get(orderId) || null;
  }

  // --- Transactions ---
  saveTransaction(tx) {
    this.transactions.set(tx.paymentId, tx);
    this.logAudit('PAYMENT_' + tx.status, `Payment ${tx.paymentId} status: ${tx.status} via ${tx.gateway}`);
    this.saveToDisk();
    return tx;
  }

  getTransaction(paymentId) {
    return this.transactions.get(paymentId) || null;
  }

  listTransactions(limit = 50) {
    return Array.from(this.transactions.values())
      .sort((a, b) => new Date(b.initiatedAt || b.capturedAt || 0) - new Date(a.initiatedAt || a.capturedAt || 0))
      .slice(0, limit);
  }

  // --- Refunds ---
  saveRefund(refund) {
    this.refunds.set(refund.refundId, refund);
    this.logAudit('REFUND_ISSUED', `Refund ${refund.refundId} of ${refund.currency} ${refund.amount} issued for ${refund.paymentId}`);
    this.saveToDisk();
    return refund;
  }

  listRefunds() {
    return Array.from(this.refunds.values());
  }

  // --- Webhooks ---
  recordWebhook(webhook) {
    this.webhooks.unshift(webhook);
    if (this.webhooks.length > 100) this.webhooks.pop();
    this.saveToDisk();
    return webhook;
  }

  listWebhooks() {
    return this.webhooks;
  }

  // --- Audit Logs ---
  logAudit(action, details, metadata = {}) {
    const entry = {
      id: 'aud_' + Math.random().toString(36).substring(2, 10),
      timestamp: new Date().toISOString(),
      action,
      details,
      metadata
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 200) this.auditLogs.pop();
    return entry;
  }

  listAuditLogs(limit = 50) {
    return this.auditLogs.slice(0, limit);
  }
}

module.exports = new Store();
