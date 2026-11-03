/**
 * High-Performance Native HTTP Server for NexusPay Payment Aggregator
 * Zero external dependencies: Built with native Node.js HTTP, URL, FS, and Path modules
 */
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const aggregatorService = require('./services/aggregatorService');
const smartRouter = require('./routing/smartRouter');
const store = require('./models/store');
const { listTokens } = require('./security/tokenization');
const { verifyHmacSignature, generateHmacSignature } = require('./security/crypto');
const { verifyRazorpaySignature, verifyStripeSignatureHeader } = require('./security/signatures');

const PUBLIC_DIR = path.join(__dirname, '../public');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/**
 * Parse JSON body from request stream
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Protect against payload bombing (> 1MB)
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format in request body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Signature, X-Client-Version',
    ...headers
  });
  res.end(JSON.stringify(data));
}

/**
 * Serve static files from public directory
 */
function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS pre-flight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Signature, X-Client-Version'
    });
    return res.end();
  }

  // --- API ROUTING ---
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Health check
      if (pathname === '/api/health' && method === 'GET') {
        return sendJson(res, 200, {
          status: 'UP',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
      }

      // 2. System config & capabilities
      if (pathname === '/api/config' && method === 'GET') {
        return sendJson(res, 200, {
          appName: config.appName,
          environment: config.environment,
          fxRates: config.fxRates,
          fees: config.fees,
          upi: {
            merchantVpa: config.upi.merchantVpa,
            merchantName: config.upi.merchantName,
            supportedHandles: config.upi.supportedHandles
          },
          supportedCurrencies: Object.keys(config.fxRates),
          testCards: [
            { brand: 'Visa', number: '4111 2222 3333 1111', exp: '12/28', cvv: '123' },
            { brand: 'MasterCard', number: '5500 0000 0000 0004', exp: '10/27', cvv: '456' },
            { brand: 'RuPay', number: '6071 2345 6789 0123', exp: '09/29', cvv: '789' }
          ],
          testUpiHandles: ['customer@okhdfcbank', 'shopper@paytm', 'user@ybl', 'payer@oksbi']
        });
      }

      // 3. High-level dashboard metrics
      if (pathname === '/api/metrics' && method === 'GET') {
        return sendJson(res, 200, aggregatorService.getMetrics());
      }

      // 4. Create Order
      if (pathname === '/api/orders' && method === 'POST') {
        const body = await parseJsonBody(req);
        const order = await aggregatorService.createOrder(body);
        return sendJson(res, 201, order);
      }

      // 5. Tokenize Card (PCI-DSS & RBI Tokenization Vault)
      if (pathname === '/api/cards/tokenize' && method === 'POST') {
        const body = await parseJsonBody(req);
        const token = aggregatorService.tokenizeCard(body);
        return sendJson(res, 201, token);
      }

      // 6. List Token Vault
      if (pathname === '/api/vault/tokens' && method === 'GET') {
        return sendJson(res, 200, listTokens());
      }

      // 7. Initiate Payment (Idempotency Key supported)
      if (pathname === '/api/payments/initiate' && method === 'POST') {
        const idempotencyKey = req.headers['idempotency-key'] || null;
        const body = await parseJsonBody(req);
        const clientIp = req.socket.remoteAddress || '127.0.0.1';

        const payment = await aggregatorService.initiatePayment({
          ...body,
          clientIp
        }, idempotencyKey);

        const status = payment.status === 'DECLINED_FRAUD' ? 403 : 200;
        return sendJson(res, status, payment);
      }

      // 8. Verify 3DS2 Challenge OTP
      if (pathname === '/api/payments/verify-3ds' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { paymentId, otp } = body;
        if (!paymentId || !otp) {
          return sendJson(res, 400, { error: 'Both paymentId and otp are required.' });
        }
        const result = await aggregatorService.verify3DS(paymentId, otp);
        return sendJson(res, 200, result);
      }

      // 9. UPI Status / Trigger Approval
      if (pathname === '/api/payments/upi-status' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { paymentId, forceApprove } = body;
        if (!paymentId) {
          return sendJson(res, 400, { error: 'paymentId is required.' });
        }
        const result = await aggregatorService.checkUPIStatus(paymentId, forceApprove);
        return sendJson(res, 200, result);
      }

      // 10. Issue Refund
      if (pathname.match(/^\/api\/payments\/[\w_]+\/refund$/) && method === 'POST') {
        const paymentId = pathname.split('/')[3];
        const body = await parseJsonBody(req);
        const refund = await aggregatorService.initiateRefund(paymentId, body.amount, body.reason);
        return sendJson(res, 200, refund);
      }

      // 11. List Transactions
      if (pathname === '/api/transactions' && method === 'GET') {
        const limit = parseInt(parsedUrl.query.limit, 10) || 50;
        const list = store.listTransactions(limit);
        return sendJson(res, 200, list);
      }

      // 12. Single Transaction Inspection
      if (pathname.match(/^\/api\/transactions\/[\w_]+$/) && method === 'GET') {
        const paymentId = pathname.split('/')[3];
        const tx = store.getTransaction(paymentId);
        if (!tx) {
          return sendJson(res, 404, { error: `Transaction ${paymentId} not found.` });
        }
        return sendJson(res, 200, tx);
      }

      // 13. Smart Routing Rules & Circuit Breakers
      if (pathname === '/api/routing/rules') {
        if (method === 'GET') {
          return sendJson(res, 200, {
            activeStrategy: smartRouter.strategy,
            rails: smartRouter.getRailStatuses()
          });
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          if (body.strategy) {
            const success = smartRouter.setStrategy(body.strategy);
            if (!success) {
              return sendJson(res, 400, { error: `Invalid routing strategy '${body.strategy}'.` });
            }
          }
          return sendJson(res, 200, {
            message: 'Routing strategy updated successfully',
            activeStrategy: smartRouter.strategy
          });
        }
      }

      // 14. Signature Verification & Cryptographic Testing Tool
      if (pathname === '/api/security/verify-signature' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { type = 'hmac', payload, signature, secret, orderId, paymentId } = body;

        let isValid = false;
        if (type === 'razorpay') {
          isValid = verifyRazorpaySignature(orderId, paymentId, signature, secret || config.razorpay.keySecret);
        } else if (type === 'stripe') {
          isValid = verifyStripeSignatureHeader(payload, signature, secret || config.webhookSecret);
        } else {
          isValid = verifyHmacSignature(payload, signature, secret || config.webhookSecret);
        }

        return sendJson(res, 200, {
          isValid,
          type,
          computedSignature: type === 'hmac' ? generateHmacSignature(payload, secret || config.webhookSecret) : null,
          verifiedAt: new Date().toISOString()
        });
      }

      // 15. Webhooks history
      if (pathname === '/api/webhooks/logs' && method === 'GET') {
        return sendJson(res, 200, store.listWebhooks());
      }

      // 16. Audit trail logs
      if (pathname === '/api/audit/logs' && method === 'GET') {
        return sendJson(res, 200, store.listAuditLogs());
      }

      // 17. 1-Click Automated Express Checkout ($9 Lifetime after 15-Day Free Trial)
      if (pathname === '/api/checkout/express' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = await aggregatorService.expressLifetimeCheckout(body);
        return sendJson(res, 200, result);
      }

      // Endpoint not matched
      return sendJson(res, 404, { error: `API endpoint '${method} ${pathname}' not found.` });
    } catch (err) {
      console.error(`Error processing ${method} ${pathname}:`, err);
      return sendJson(res, err.statusCode || 500, {
        error: err.message || 'Internal Server Error',
        stack: config.environment === 'development' ? err.stack : undefined
      });
    }
  }

  // --- STATIC FILE SERVING ---
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  const fullPath = path.join(PUBLIC_DIR, safePath);
  serveStaticFile(res, fullPath);
});

// Start listening if run directly
if (require.main === module) {
  const PORT = config.port;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` 🚀 NexusPay Global Aggregator Server Running`);
    console.log(` 📡 URL: http://localhost:${PORT}`);
    console.log(` 🔒 Security: PCI-DSS Token Vault (AES-256-GCM) Active`);
    console.log(` ⚡ Rails: UPI 2.0 | Visa | MasterCard | Razorpay | Intl`);
    console.log(`=======================================================`);
  });
}

module.exports = server;
