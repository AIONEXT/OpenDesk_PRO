/**
 * Idempotency Key Protocol Engine
 * Prevents double-charging on network retries, race conditions, or duplicate client clicks
 */

class IdempotencyManager {
  constructor(ttlMs = 24 * 60 * 60 * 1000) {
    this.cache = new Map(); // key -> { status: 'PENDING'|'COMPLETED', response, timestamp, requestHash }
    this.ttlMs = ttlMs;
  }

  /**
   * Acquire a lock on an idempotency key
   * @param {string} key 
   * @param {string} requestHash 
   * @returns {object} { isDuplicate: boolean, cachedResponse: any, inFlight: boolean }
   */
  checkAndLock(key, requestHash = '') {
    if (!key) {
      return { isDuplicate: false, cachedResponse: null, inFlight: false };
    }

    const now = Date.now();
    const existing = this.cache.get(key);

    if (existing) {
      // Check expiration
      if (now - existing.timestamp > this.ttlMs) {
        this.cache.delete(key);
      } else {
        if (existing.status === 'PENDING') {
          return { isDuplicate: true, cachedResponse: null, inFlight: true };
        }
        return { isDuplicate: true, cachedResponse: existing.response, inFlight: false };
      }
    }

    // Lock the key in PENDING state
    this.cache.set(key, {
      status: 'PENDING',
      response: null,
      timestamp: now,
      requestHash
    });

    return { isDuplicate: false, cachedResponse: null, inFlight: false };
  }

  /**
   * Commit the response for an idempotency key once processing completes
   * @param {string} key 
   * @param {number} statusCode 
   * @param {object} responseBody 
   */
  commit(key, statusCode, responseBody) {
    if (!key) return;

    this.cache.set(key, {
      status: 'COMPLETED',
      response: {
        statusCode,
        body: responseBody
      },
      timestamp: Date.now()
    });
  }

  /**
   * Release lock in case of network or validation failure before processing
   * @param {string} key 
   */
  release(key) {
    if (!key) return;
    this.cache.delete(key);
  }

  /**
   * Clean up expired idempotency keys
   */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now - record.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = new IdempotencyManager();
