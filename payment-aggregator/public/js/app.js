/**
 * NexusPay Unified Payment Aggregator - Frontend Client Controller
 * Manages Checkout Modal flows, 3DS2 Challenge, UPI polling, and Merchant Operations Dashboard
 */

// Application State
const state = {
  currentView: 'checkout', // 'checkout' | 'dashboard'
  currentMethod: 'upi',    // 'upi' | 'card' | 'razorpay' | 'international'
  currentCurrency: 'USD',
  baseAmountINR: 787.50,   // $9.00 USD * 87.50 INR/USD (15-Day Free Trial -> $9 Lifetime Subscription)
  activeOrderId: null,
  activePaymentId: null,
  currentCardBrand: 'visa',
  fxRates: { INR: 1, USD: 87.50, EUR: 94.20, GBP: 110.80, SGD: 65.40, AED: 23.82 },
  transactions: [],
  pollingTimer: null,
  qrCountdownTimer: null,
  qrSecondsRemaining: 300
};

/**
 * 1-Click Express Automated Checkout ($9 Lifetime Subscription + Auto License Key)
 */
async function triggerExpressLifetimeCheckout() {
  try {
    const res = await fetch('/api/checkout/express', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: 'PRO',
        amount: 9,
        currency: 'USD',
        method: state.currentMethod,
        customerName: 'OpenDesk PRO Customer',
        customerEmail: 'customer@opendesk.app'
      })
    });
    const data = await res.json();
    if (data && data.payment) {
      data.payment.gatewayDetails = {
        ...(data.payment.gatewayDetails || {}),
        npciRrn: `${data.licenseKey} (Auto-Activated)`
      };
      showReceiptModal(data.payment);
    }
  } catch (err) {
    alert('Express automated checkout failed: ' + err.message);
  }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  await fetchConfig();
  await initCheckout();
  await loadDashboardData();
});

/**
 * Fetch System Configuration from Backend API
 */
async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.fxRates) state.fxRates = data.fxRates;
  } catch (err) {
    console.error('Failed to load system config:', err);
  }
}

/**
 * Switch View: Checkout Widget Demo vs Merchant Operations Dashboard
 */
function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.view-btn').forEach(el => el.classList.remove('active'));

  if (viewName === 'checkout') {
    document.getElementById('viewCheckout').classList.add('active');
    document.getElementById('btnViewCheckout').classList.add('active');
  } else {
    document.getElementById('viewDashboard').classList.add('active');
    document.getElementById('btnViewDashboard').classList.add('active');
    loadDashboardData();
  }
}

/**
 * Initialize Checkout Widget & Generate Dynamic NPCI UPI QR
 */
async function initCheckout() {
  updatePriceDisplay();
  await generateDynamicUpiQr();
}

/**
 * Set Currency for Checkout
 */
function setCheckoutCurrency(curr) {
  state.currentCurrency = curr;
  document.querySelectorAll('.curr-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(curr));
  });

  updatePriceDisplay();
  generateDynamicUpiQr();
}

/**
 * Update Price Display across Order Summary & Widget
 */
function updatePriceDisplay() {
  const rate = state.fxRates[state.currentCurrency] || 1.0;
  const convertedAmount = state.currentCurrency === 'INR'
    ? state.baseAmountINR
    : Number((state.baseAmountINR / rate).toFixed(2));

  const symbol = getCurrencySymbol(state.currentCurrency);
  const formatted = `${symbol}${convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Update DOM labels
  const grandTotalEl = document.getElementById('txtGrandTotal');
  if (grandTotalEl) grandTotalEl.textContent = formatted;

  const widgetAmountEl = document.getElementById('widgetDisplayAmount');
  if (widgetAmountEl) widgetAmountEl.textContent = formatted;

  document.querySelectorAll('.btnPayAmount').forEach(el => el.textContent = formatted);

  // FX International panel calculations
  const usdRate = state.fxRates['USD'] || 87.5;
  const usdAmount = Number((state.baseAmountINR / usdRate).toFixed(2));
  const intlSourceEl = document.getElementById('intlSourceAmount');
  if (intlSourceEl) intlSourceEl.textContent = `$${usdAmount.toFixed(2)} USD`;

  const btnIntlAmountEl = document.getElementById('btnIntlAmount');
  if (btnIntlAmountEl) btnIntlAmountEl.textContent = `$${usdAmount.toFixed(2)}`;

  const intlExchangeEl = document.getElementById('intlExchangeRate');
  if (intlExchangeEl) intlExchangeEl.textContent = `1 USD = ₹${usdRate.toFixed(2)} INR`;
}

function getCurrencySymbol(curr) {
  switch (curr) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'SGD': return 'S$';
    case 'AED': return 'د.إ ';
    default: return '₹';
  }
}

/**
 * Switch Payment Method Tab (UPI, Card, Razorpay, International)
 */
function switchMethodTab(method) {
  state.currentMethod = method;
  document.querySelectorAll('.method-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.method === method);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  const tabId = 'tabContent' + method.charAt(0).toUpperCase() + method.slice(1);
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  // Update MDR Fee Schedule Note
  const feeEl = document.getElementById('txtFeeSchedule');
  if (feeEl) {
    if (method === 'upi') feeEl.textContent = '0% (UPI Direct - NPCI)';
    else if (method === 'card') feeEl.textContent = '1.25% (Visa/MasterCard Interchange)';
    else if (method === 'razorpay') feeEl.textContent = '1.85% (Razorpay Standard)';
    else feeEl.textContent = '2.90% (Cross-Border Global Rail)';
  }
}

// ==========================================================================
// UPI PAYMENT ENGINE (QR, Collect, Intent)
// ==========================================================================

function setUpiSubMode(mode) {
  document.querySelectorAll('.upi-modes-toggle .mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(mode));
  });

  document.querySelectorAll('.upi-sub-mode').forEach(el => el.classList.remove('active'));
  const targetId = 'upiMode' + mode.charAt(0).toUpperCase() + mode.slice(1);
  const targetEl = document.getElementById(targetId);
  if (targetEl) targetEl.classList.add('active');
}

function setVpaHandle(handle) {
  const input = document.getElementById('upiVpaInput');
  const current = input.value.split('@')[0] || 'customer';
  input.value = current + handle;
}

/**
 * Generate Dynamic NPCI Vector QR Code
 */
async function generateDynamicUpiQr() {
  const qrTarget = document.getElementById('upiQrTarget');
  if (!qrTarget) return;

  try {
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: state.baseAmountINR,
        currency: 'INR',
        method: 'upi',
        upiMode: 'qr',
        description: 'NexusPay Order QR'
      })
    });

    const data = await res.json();
    if (data.gatewayDetails && data.gatewayDetails.qrSvg) {
      state.activePaymentId = data.paymentId;
      qrTarget.innerHTML = data.gatewayDetails.qrSvg;
      startQrCountdown();
    }
  } catch (err) {
    console.error('Failed to generate UPI QR:', err);
    qrTarget.innerHTML = '<div class="text-rose">QR Generation Failed. Please retry.</div>';
  }
}

function startQrCountdown() {
  if (state.qrCountdownTimer) clearInterval(state.qrCountdownTimer);
  state.qrSecondsRemaining = 300; // 5 mins

  state.qrCountdownTimer = setInterval(() => {
    state.qrSecondsRemaining--;
    if (state.qrSecondsRemaining <= 0) {
      clearInterval(state.qrCountdownTimer);
      const timerEl = document.getElementById('qrTimer');
      if (timerEl) timerEl.textContent = 'Expired';
      return;
    }
    const mins = Math.floor(state.qrSecondsRemaining / 60).toString().padStart(2, '0');
    const secs = (state.qrSecondsRemaining % 60).toString().padStart(2, '0');
    const timerEl = document.getElementById('qrTimer');
    if (timerEl) timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

/**
 * Initiate UPI Collect Request
 */
async function initiateUpiCollect() {
  const vpaInput = document.getElementById('upiVpaInput');
  const vpa = vpaInput ? vpaInput.value.trim() : '';

  if (!vpa || !vpa.includes('@')) {
    alert('Please enter a valid UPI VPA (e.g. username@okhdfcbank)');
    return;
  }

  const btn = document.getElementById('btnSendCollect');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: state.baseAmountINR,
        currency: 'INR',
        method: 'upi',
        upiMode: 'collect',
        customerVpa: vpa,
        description: 'Collect Request'
      })
    });

    const data = await res.json();
    state.activePaymentId = data.paymentId;

    const statusBox = document.getElementById('collectStatusBox');
    if (statusBox) statusBox.classList.remove('hidden');

    const statusText = document.getElementById('collectStatusText');
    if (statusText) statusText.textContent = `Collect request sent to ${vpa}. Please authorize in your mobile app.`;
  } catch (err) {
    alert('Error initiating UPI collect: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Simulate Customer Approving UPI on Phone
 */
async function simulateUpiApproval(appName = 'Mobile App') {
  if (!state.activePaymentId) {
    await generateDynamicUpiQr();
  }

  try {
    const res = await fetch('/api/payments/upi-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: state.activePaymentId,
        forceApprove: true
      })
    });

    const data = await res.json();
    showReceiptModal(data);
  } catch (err) {
    alert('Failed to simulate UPI approval: ' + err.message);
  }
}

// ==========================================================================
// CARD PAYMENT ENGINE (Visa, MasterCard, RuPay, RBI Tokenization & 3DS2)
// ==========================================================================

function updateCardPreview() {
  const nameInput = document.getElementById('cardholderName');
  const dispHolder = document.getElementById('dispCardHolder');
  if (nameInput && dispHolder) {
    dispHolder.textContent = nameInput.value.trim().toUpperCase() || 'VALUED CUSTOMER';
  }

  const cvvInput = document.getElementById('cardCvv');
  const dispCvv = document.getElementById('dispCardCvv');
  if (cvvInput && dispCvv) {
    dispCvv.textContent = cvvInput.value ? cvvInput.value.replace(/./g, '•') : '•••';
  }
}

function flipCard(flipped) {
  const cardGraphic = document.getElementById('cardGraphic');
  if (cardGraphic) {
    if (flipped) cardGraphic.classList.add('flipped');
    else cardGraphic.classList.remove('flipped');
  }
}

function formatAndValidateCard(input) {
  let val = input.value.replace(/\D/g, '');
  if (val.length > 16) val = val.substring(0, 16);

  // Group into 4s
  const grouped = val.match(/.{1,4}/g)?.join(' ') || val;
  input.value = grouped;

  const dispNumber = document.getElementById('dispCardNumber');
  if (dispNumber) {
    dispNumber.textContent = grouped || '•••• •••• •••• ••••';
  }

  // Detect Brand
  const brandBadge = document.getElementById('cardBrandBadge');
  const inputIcon = document.getElementById('inputBrandIcon');

  if (val.startsWith('4')) {
    state.currentCardBrand = 'visa';
    if (brandBadge) brandBadge.textContent = 'VISA';
    if (inputIcon) inputIcon.textContent = '🟦 Visa';
  } else if (/^5[1-5]|^2[2-7]/.test(val)) {
    state.currentCardBrand = 'mastercard';
    if (brandBadge) brandBadge.textContent = 'MASTERCARD';
    if (inputIcon) inputIcon.textContent = '🔴 MasterCard';
  } else if (/^60|^65|^508/.test(val)) {
    state.currentCardBrand = 'rupay';
    if (brandBadge) brandBadge.textContent = 'RUPAY';
    if (inputIcon) inputIcon.textContent = '🟢 RuPay';
  } else {
    state.currentCardBrand = 'card';
    if (brandBadge) brandBadge.textContent = 'CARD';
    if (inputIcon) inputIcon.textContent = '💳';
  }

  // Luhn Check
  const luhnFeedback = document.getElementById('luhnFeedback');
  if (luhnFeedback) {
    if (val.length >= 13 && validateLuhnClient(val)) {
      luhnFeedback.className = 'badge-valid';
      luhnFeedback.textContent = '✓ Valid Card Checksum';
    } else if (val.length >= 13) {
      luhnFeedback.className = 'badge-invalid';
      luhnFeedback.textContent = '✕ Invalid Card Checksum';
    } else {
      luhnFeedback.className = 'text-dim';
      luhnFeedback.textContent = 'Enter 16 Digits';
    }
  }
}

function validateLuhnClient(numStr) {
  let sum = 0;
  let alternate = false;
  for (let i = numStr.length - 1; i >= 0; i--) {
    let digit = parseInt(numStr.charAt(i), 10);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function formatExpiry(input) {
  let val = input.value.replace(/\D/g, '');
  if (val.length > 4) val = val.substring(0, 4);
  if (val.length >= 2) {
    val = val.substring(0, 2) + '/' + val.substring(2);
  }
  input.value = val;

  const dispExpiry = document.getElementById('dispCardExpiry');
  if (dispExpiry) dispExpiry.textContent = val || 'MM/YY';
}

function fillTestCard(type) {
  const numberInput = document.getElementById('cardNumber');
  const nameInput = document.getElementById('cardholderName');
  const expInput = document.getElementById('cardExpiry');
  const cvvInput = document.getElementById('cardCvv');

  if (type === 'visa') {
    if (numberInput) numberInput.value = '4111 1111 1111 1111';
    if (nameInput) nameInput.value = 'Rahul Sharma';
    if (expInput) expInput.value = '12/28';
    if (cvvInput) cvvInput.value = '123';
  } else if (type === 'mastercard') {
    if (numberInput) numberInput.value = '5555 5555 5555 4444';
    if (nameInput) nameInput.value = 'Priya Patel';
    if (expInput) expInput.value = '10/27';
    if (cvvInput) cvvInput.value = '456';
  } else if (type === 'rupay') {
    if (numberInput) numberInput.value = '6071 2345 6789 0120';
    if (nameInput) nameInput.value = 'Amit Verma';
    if (expInput) expInput.value = '09/29';
    if (cvvInput) cvvInput.value = '789';
  }

  if (numberInput) formatAndValidateCard(numberInput);
  if (expInput) formatExpiry(expInput);
  updateCardPreview();
}

/**
 * Handle Card Payment Submission & Step-Up 3DS2 Challenge
 */
async function handleCardSubmit(e) {
  e.preventDefault();
  const number = document.getElementById('cardNumber').value.replace(/\s+/g, '');
  const cardholderName = document.getElementById('cardholderName').value;
  const expiry = document.getElementById('cardExpiry').value.split('/');
  const cvv = document.getElementById('cardCvv').value;
  const saveCard = document.getElementById('chkSaveCard').checked;

  const btn = document.getElementById('btnPayCard');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
      },
      body: JSON.stringify({
        amount: state.baseAmountINR,
        currency: 'INR',
        method: 'card',
        cardData: {
          number,
          cardholderName,
          expMonth: expiry[0] || '12',
          expYear: expiry[1] || '28',
          cvv
        },
        saveCard,
        description: 'Card Checkout'
      })
    });

    const payment = await res.json();
    state.activePaymentId = payment.paymentId;

    if (payment.status === 'REQUIRES_3DS2_AUTH') {
      open3DSModal(payment);
    } else if (payment.status === 'CAPTURED') {
      showReceiptModal(payment);
    } else if (payment.status === 'DECLINED_FRAUD') {
      alert(`Payment Blocked by Risk Firewall:\n${payment.declineReason}`);
    }
  } catch (err) {
    alert('Payment Initiation Failed: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ==========================================================================
// 3D SECURE 2.0 (3DS2) BANKING CHALLENGE MODAL
// ==========================================================================

function open3DSModal(payment) {
  const modal = document.getElementById('modal3DS');
  if (!modal) return;

  const modalAmount = document.getElementById('modal3DSAmount');
  if (modalAmount) modalAmount.textContent = `₹${payment.amount.toLocaleString('en-IN')}`;

  const modalPhone = document.getElementById('modal3DSCard');
  if (modalPhone && payment.maskedPan) modalPhone.textContent = payment.maskedPan;

  const netLogo = document.getElementById('acsNetworkLogo');
  if (netLogo) {
    netLogo.textContent = payment.network === 'MASTERCARD'
      ? 'MasterCard Identity Check'
      : 'Verified by VISA';
  }

  document.getElementById('otpInput').value = '';
  modal.classList.add('active');
}

function close3DSModal() {
  const modal = document.getElementById('modal3DS');
  if (modal) modal.classList.remove('active');
}

async function handle3DSSubmit(e) {
  e.preventDefault();
  const otp = document.getElementById('otpInput').value.trim();
  if (!otp) {
    alert('Please enter OTP');
    return;
  }

  const btn = document.getElementById('btnSubmitOtp');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/payments/verify-3ds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: state.activePaymentId,
        otp
      })
    });

    const data = await res.json();
    if (res.ok) {
      close3DSModal();
      showReceiptModal(data);
    } else {
      alert('3DS Verification Failed: ' + (data.error || 'Invalid OTP'));
    }
  } catch (err) {
    alert('Error verifying 3DS: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ==========================================================================
// RAZORPAY & INTERNATIONAL PAYMENT RAILS
// ==========================================================================

function selectBank(el, code) {
  document.querySelectorAll('.bank-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}

async function initiateRazorpayPayment() {
  try {
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: state.baseAmountINR,
        currency: 'INR',
        method: 'razorpay',
        description: 'Razorpay Netbanking Checkout'
      })
    });

    const data = await res.json();
    showReceiptModal(data);
  } catch (err) {
    alert('Razorpay Checkout Failed: ' + err.message);
  }
}

async function initiateInternationalPayment() {
  const channelRadio = document.querySelector('input[name="intlChannel"]:checked');
  const channel = channelRadio ? channelRadio.value : 'stripe';
  const usdRate = state.fxRates['USD'] || 87.5;
  const usdAmount = Number((state.baseAmountINR / usdRate).toFixed(2));

  try {
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: usdAmount,
        currency: 'USD',
        method: 'international',
        internationalChannel: channel,
        description: 'Cross-Border SaaS Subscription'
      })
    });

    const data = await res.json();
    showReceiptModal(data);
  } catch (err) {
    alert('International Payment Failed: ' + err.message);
  }
}

// ==========================================================================
// TRANSACTION SUCCESS & RECEIPT MODAL
// ==========================================================================

function showReceiptModal(tx) {
  const modal = document.getElementById('modalReceipt');
  if (!modal) return;

  const currSymbol = getCurrencySymbol(tx.currency || 'INR');
  document.getElementById('receiptCurrency').textContent = currSymbol;
  document.getElementById('receiptAmount').textContent = Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  document.getElementById('rcptPaymentId').textContent = tx.paymentId || 'N/A';
  document.getElementById('rcptOrderId').textContent = tx.orderId || 'N/A';
  document.getElementById('rcptGateway').textContent = tx.gateway || 'NexusPay Direct Switch';

  const traceRef = tx.gatewayDetails?.npciRrn || tx.gatewayDetails?.networkAuthCode || tx.gatewayDetails?.externalTransactionId || 'AUTH_OK';
  document.getElementById('rcptTraceRef').textContent = traceRef;

  const feeAmount = tx.fee !== undefined ? `${currSymbol}${Number(tx.fee).toFixed(2)}` : '₹0.00';
  document.getElementById('rcptFee').textContent = feeAmount;

  document.getElementById('rcptTime').textContent = new Date(tx.capturedAt || tx.initiatedAt || Date.now()).toLocaleString();

  modal.classList.add('active');
  loadDashboardData(); // Refresh merchant ledger in background
}

function closeReceiptModal() {
  const modal = document.getElementById('modalReceipt');
  if (modal) modal.classList.remove('active');
}

// ==========================================================================
// MERCHANT OPERATIONS DASHBOARD CONTROLLER
// ==========================================================================

async function loadDashboardData() {
  await Promise.all([
    loadMetrics(),
    loadRails(),
    loadTransactions(),
    loadTokenVault(),
    loadWebhooks()
  ]);
}

async function loadMetrics() {
  try {
    const res = await fetch('/api/metrics');
    const data = await res.json();

    document.getElementById('kpiVolumeINR').textContent = `₹${(data.totalVolumeINR || 0).toLocaleString('en-IN')}`;
    document.getElementById('kpiVolumeUSD').textContent = `≈ $${(data.totalVolumeUSD || 0).toLocaleString('en-US')} USD`;
    document.getElementById('kpiSuccessRate').textContent = `${data.successRate || 100}%`;
    document.getElementById('kpiTotalTxCount').textContent = `${data.totalTransactions || 0} Transactions`;
    document.getElementById('kpiDeclinedCount').textContent = `${data.declinedCount || 0} Blocked`;
    document.getElementById('kpiVaultCount').textContent = data.vaultTokenCount || 0;

    const stratSelect = document.getElementById('selectRoutingStrategy');
    if (stratSelect && data.activeStrategy) stratSelect.value = data.activeStrategy;
  } catch (err) {
    console.error('Error loading metrics:', err);
  }
}

async function loadRails() {
  const container = document.getElementById('railsContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/routing/rules');
    const data = await res.json();

    container.innerHTML = (data.rails || []).map(r => `
      <div class="rail-health-card">
        <div class="rail-card-top">
          <span class="rail-name">${r.name}</span>
          <span class="rail-status-badge ${r.status}">${r.status}</span>
        </div>
        <div class="rail-metrics">
          <div class="rail-metrics-row">
            <span>Success Rate:</span>
            <strong class="text-green">${r.successRate}%</strong>
          </div>
          <div class="rail-metrics-row">
            <span>Avg Latency:</span>
            <span>${r.metrics.avgLatencyMs} ms</span>
          </div>
          <div class="rail-metrics-row">
            <span>Total Requests:</span>
            <span>${r.metrics.totalRequests}</span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading rails:', err);
  }
}

async function updateRoutingStrategy(strat) {
  try {
    await fetch('/api/routing/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: strat })
    });
    loadRails();
  } catch (err) {
    alert('Failed to update routing strategy: ' + err.message);
  }
}

async function loadTransactions() {
  const tbody = document.getElementById('txTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/transactions?limit=50');
    state.transactions = await res.json();
    renderTransactionsTable(state.transactions);
  } catch (err) {
    console.error('Error loading transactions:', err);
  }
}

function renderTransactionsTable(list) {
  const tbody = document.getElementById('txTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">No transactions recorded yet. Initiate payments via the Checkout Widget to populate the ledger.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(tx => {
    const sym = getCurrencySymbol(tx.currency);
    const riskScore = tx.riskAssessment ? tx.riskAssessment.score : 10;
    const riskClass = riskScore >= 60 ? 'high' : (riskScore >= 30 ? 'medium' : 'low');

    return `
      <tr>
        <td class="mono font-bold">${tx.paymentId}</td>
        <td class="mono text-muted">${tx.orderId || '-'}</td>
        <td>
          <span class="badge-rail">${tx.rail || tx.method.toUpperCase()}</span>
        </td>
        <td class="mono font-bold">${sym}${Number(tx.amount).toFixed(2)}</td>
        <td class="text-dim mono">${sym}${Number(tx.fee || 0).toFixed(2)}</td>
        <td>${tx.gateway}</td>
        <td>
          <span class="risk-pill ${riskClass}">${riskScore} (${tx.riskAssessment ? tx.riskAssessment.tier : 'LOW'})</span>
        </td>
        <td>
          <span class="status-badge ${tx.status}">${tx.status}</span>
        </td>
        <td class="text-dim">${new Date(tx.initiatedAt || Date.now()).toLocaleTimeString()}</td>
        <td>
          <button class="btn-outline-sm" onclick="inspectTransaction('${tx.paymentId}')">Inspect</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterTransactions() {
  const search = document.getElementById('searchTxInput').value.toLowerCase();
  const statusFilter = document.getElementById('filterStatusSelect').value;

  const filtered = state.transactions.filter(tx => {
    const matchesSearch = !search ||
      (tx.paymentId && tx.paymentId.toLowerCase().includes(search)) ||
      (tx.orderId && tx.orderId.toLowerCase().includes(search)) ||
      (tx.gateway && tx.gateway.toLowerCase().includes(search));

    const matchesStatus = statusFilter === 'ALL' || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  renderTransactionsTable(filtered);
}

/**
 * Open Transaction Inspector Drawer
 */
function inspectTransaction(paymentId) {
  const tx = state.transactions.find(t => t.paymentId === paymentId);
  if (!tx) return;

  const modal = document.getElementById('modalInspector');
  document.getElementById('inspectPaymentId').textContent = tx.paymentId;

  const sym = getCurrencySymbol(tx.currency);
  const content = document.getElementById('inspectorContent');

  content.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <!-- Financial Overview -->
      <div style="background:var(--bg-surface); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span class="text-muted">Transaction Status:</span>
          <span class="status-badge ${tx.status}">${tx.status}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span class="text-muted">Gross Amount:</span>
          <strong>${sym}${Number(tx.amount).toFixed(2)} ${tx.currency}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span class="text-muted">MDR Processing Fee:</span>
          <span>${sym}${Number(tx.fee || 0).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span class="text-muted">Refunded Amount:</span>
          <span class="text-purple">${sym}${Number(tx.refundedAmount || 0).toFixed(2)}</span>
        </div>
      </div>

      <!-- Fraud & Security Audit -->
      <div style="background:var(--bg-surface); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
        <h4 style="margin-bottom:0.5rem; font-size:0.9rem;">Fraud Detection Scorecard</h4>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.8rem;">
          <span class="text-muted">Risk Score:</span>
          <strong class="text-green">${tx.riskAssessment ? tx.riskAssessment.score : 10}/100</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.8rem;">
          <span class="text-muted">Risk Action:</span>
          <span>${tx.riskAssessment ? tx.riskAssessment.action : 'ALLOW'}</span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-dim); margin-top:0.4rem;">
          <strong>Signals Evaluated:</strong>
          <ul>
            ${(tx.riskAssessment?.reasons || ['Standard low-risk pattern']).map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Routing & Rail Info -->
      <div style="background:var(--bg-surface); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color); font-size:0.8rem;">
        <h4 style="margin-bottom:0.5rem; font-size:0.9rem;">Smart Routing Telemetry</h4>
        <p><strong>Gateway:</strong> ${tx.gateway}</p>
        <p><strong>Strategy:</strong> ${tx.routing?.strategy || 'SMART_AUTO'}</p>
        <p><strong>Decision Reason:</strong> ${tx.routing?.reason || 'Direct network assignment'}</p>
      </div>

      <!-- Raw Gateway Response JSON -->
      <div>
        <h4 style="margin-bottom:0.5rem; font-size:0.9rem;">Raw Gateway Payload (Encrypted Vault View)</h4>
        <pre style="background:#020617; padding:0.75rem; border-radius:var(--radius-sm); font-size:0.7rem; overflow-x:auto;" class="mono">${JSON.stringify(tx.gatewayDetails || {}, null, 2)}</pre>
      </div>

      <!-- Refund Action (if eligible) -->
      ${tx.status === 'CAPTURED' || tx.status === 'PARTIALLY_REFUNDED' ? `
        <div style="background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.3); padding:1rem; border-radius:var(--radius-md);">
          <h4 style="margin-bottom:0.5rem; font-size:0.9rem;">Issue Idempotent Refund</h4>
          <div style="display:flex; gap:0.5rem;">
            <input type="number" id="refundAmountInput" placeholder="Amount (Max: ${(tx.amount - tx.refundedAmount).toFixed(2)})" value="${(tx.amount - tx.refundedAmount).toFixed(2)}" style="background:var(--bg-card); border:1px solid var(--border-color); padding:0.4rem 0.6rem; color:#fff; border-radius:4px; flex:1;">
            <button class="btn-primary" style="width:auto; padding:0.4rem 1rem;" onclick="executeRefund('${tx.paymentId}')">Process Refund</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  modal.classList.add('active');
}

function closeInspectorModal() {
  document.getElementById('modalInspector').classList.remove('active');
}

async function executeRefund(paymentId) {
  const amountInput = document.getElementById('refundAmountInput');
  const amount = Number(amountInput ? amountInput.value : 0);

  if (!amount || amount <= 0) {
    alert('Please enter a valid refund amount.');
    return;
  }

  try {
    const res = await fetch(`/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason: 'Merchant dashboard refund' })
    });

    const refund = await res.json();
    if (res.ok) {
      alert(`Refund of ${refund.currency} ${refund.amount} processed successfully (Ref: ${refund.refundId})`);
      closeInspectorModal();
      loadDashboardData();
    } else {
      alert('Refund failed: ' + (refund.error || 'Server error'));
    }
  } catch (err) {
    alert('Refund request error: ' + err.message);
  }
}

// ==========================================================================
// PCI-DSS CARD VAULT & WEBHOOK LOGS
// ==========================================================================

async function loadTokenVault() {
  const container = document.getElementById('vaultListContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/vault/tokens');
    const tokens = await res.json();

    if (!tokens || tokens.length === 0) {
      container.innerHTML = `<div class="empty-state">No vaulted card tokens yet. Complete a card payment with "Save card securely" checked.</div>`;
      return;
    }

    container.innerHTML = tokens.map(tok => `
      <div class="vault-item">
        <div class="vault-item-top">
          <span class="mono font-bold text-blue">${tok.tokenId}</span>
          <span class="badge-rail">${tok.displayName}</span>
        </div>
        <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
          <span>Masked PAN: <strong class="mono">${tok.maskedPan}</strong></span>
          <span>Exp: ${tok.expMonth}/${tok.expYear}</span>
        </div>
        <div style="font-size:0.65rem; color:var(--text-dim); margin-top:0.25rem;">
          Encrypted: AES-256-GCM Vault • ${new Date(tok.createdAt).toLocaleDateString()}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading vault:', err);
  }
}

async function loadWebhooks() {
  const container = document.getElementById('webhookListContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/webhooks/logs');
    const webhooks = await res.json();

    if (!webhooks || webhooks.length === 0) {
      container.innerHTML = `<div class="empty-state">No webhook dispatches yet.</div>`;
      return;
    }

    container.innerHTML = webhooks.slice(0, 10).map(wh => `
      <div class="webhook-item">
        <div class="webhook-item-top">
          <span class="font-bold text-green">${wh.event}</span>
          <span class="mono text-dim">${new Date(wh.timestamp).toLocaleTimeString()}</span>
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.25rem;" class="mono">
          ID: ${wh.webhookId} • HTTP ${wh.httpStatusCode}
        </div>
        <div style="font-size:0.65rem; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" class="mono">
          Sig: ${wh.signatureHeader}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading webhooks:', err);
  }
}

// ==========================================================================
// CRYPTOGRAPHIC TESTING & SIGNATURE VERIFICATION TOOL
// ==========================================================================

function openSignatureTestModal() {
  document.getElementById('modalCryptoTool').classList.add('active');
  toggleCryptoInputs();
}

function closeSignatureTestModal() {
  document.getElementById('modalCryptoTool').classList.remove('active');
}

function toggleCryptoInputs() {
  const type = document.getElementById('cryptoTypeSelect').value;
  const rzpWrap = document.getElementById('cryptoRazorpayWrap');
  const payloadWrap = document.getElementById('cryptoPayloadWrap');

  if (type === 'razorpay') {
    if (rzpWrap) rzpWrap.classList.remove('hidden');
    if (payloadWrap) payloadWrap.classList.add('hidden');
  } else {
    if (rzpWrap) rzpWrap.classList.add('hidden');
    if (payloadWrap) payloadWrap.classList.remove('hidden');
  }
}

async function executeCryptoSignatureTest() {
  const type = document.getElementById('cryptoTypeSelect').value;
  const payload = document.getElementById('cryptoPayload').value;
  const secret = document.getElementById('cryptoSecret').value;
  const signature = document.getElementById('cryptoSignature').value;
  const orderId = document.getElementById('cryptoOrderId').value;
  const paymentId = document.getElementById('cryptoPaymentId').value;

  const resultBox = document.getElementById('cryptoResultBox');
  const resultContent = document.getElementById('cryptoResultContent');

  try {
    const res = await fetch('/api/security/verify-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, secret, signature, orderId, paymentId })
    });

    const data = await res.json();
    resultBox.classList.remove('hidden');

    resultContent.innerHTML = `
      <div style="margin-bottom:0.5rem;">
        <strong>Verification Status:</strong>
        <span class="${data.isValid ? 'text-green font-bold' : 'text-rose font-bold'}">
          ${data.isValid ? '✓ SIGNATURE VERIFIED VALID' : '✕ SIGNATURE MISMATCH / INVALID'}
        </span>
      </div>
      ${data.computedSignature ? `
        <div style="margin-bottom:0.5rem; word-break:break-all;">
          <strong>Computed HMAC-SHA256:</strong><br>
          <span class="text-blue">${data.computedSignature}</span>
        </div>
      ` : ''}
      <div style="font-size:0.7rem; color:var(--text-dim);">
        Tested at: ${data.verifiedAt}
      </div>
    `;
  } catch (err) {
    alert('Cryptographic test error: ' + err.message);
  }
}
