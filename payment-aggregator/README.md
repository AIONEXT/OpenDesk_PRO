# NexusPay ~ Multi-Rail Unified Payment Aggregator Platform

A production-grade, highly secure payment aggregator implementing native switches and adapters for **UPI (NPCI)**, **Visa & MasterCard (Direct Rail)**, **Razorpay (Aggregated Gateway)**, and an **International Cross-Border Platform (Stripe/PayPal Global Rails)**. Includes an interactive customer checkout widget GUI, merchant operations dashboard, and zero-external-dependency architecture powered by Node.js.

---

## 🏛️ System Architecture

```
                                  [ Client Layer ]
              ┌────────────────────────────────────────────────────────┐
              │  Unified Checkout Modal (UPI, Cards, RZP, Global FX)   │
              │  Merchant Operations Dashboard & Cryptographic Tool    │
              └───────────────────────────┬────────────────────────────┘
                                          │ HTTP / REST / Webhooks
                                          ▼
                               [ API Gateway & Router ]
              ┌────────────────────────────────────────────────────────┐
              │  Idempotency Protocol (Lock & Replay Prevention)       │
              │  Fraud & Risk Scoring Engine (Velocity, Geo, Limits)   │
              │  PCI-DSS Card Vault (AES-256-GCM Encrypted Tokenizer)  │
              │  Smart Dynamic Router (Cost-Optimized, Uptime-Driven)  │
              └───────┬──────────────┬───────────────┬───────────────┬─┘
                      │              │               │               │
        ┌─────────────▼──┐    ┌──────▼──────┐   ┌────▼────────┐  ┌───▼─────────────┐
        │   UPI Direct   │    │ Visa / MC   │   │  Razorpay   │  │  International  │
        │   NPCI Switch  │    │ Direct Rail │   │   Adapter   │  │  Global Rails   │
        └───────┬────────┘    └──────┬──────┘   └────┬────────┘  └───┬─────────────┘
                │                    │               │               │
        • Dynamic Vector QR   • BIN Detection • Orders API   • Multi-Currency FX
        • VPA Collect Form    • 3DS 2.0 ACS   • Payment Cap  • Cross-Border AML
        • Intent Deep-Links   • CoFT Tokens   • Webhook Sig  • RBI Purpose P0802
```

---

## 🛡️ Security Protocols & Compliance

1. **PCI-DSS Level 1 Scope Reduction & Card Vault**:
   - Zero raw PAN or sensitive authentication data (CVV) is persisted in databases or logs.
   - Primary Account Numbers (PANs) are vaulted in memory and disk using authenticated **AES-256-GCM** encryption with 96-bit IVs and authentication tags.
   - Generates non-reversible surrogate tokens (`tok_visa_...`, `tok_mc_...`) with masked PANs (`4111 •••• •••• 1111`) adhering to **RBI Card-on-File Tokenization (CoFT)** guidelines.

2. **3D Secure 2.0 (3DS2) Authentication Protocol**:
   - Emits step-up authentication challenges via Access Control Server (ACS) emulation.
   - Validates one-time passwords (OTP) with countdown timers and outputs authentic ECI 05 certification and CAVV tokens.

3. **Strict Financial Idempotency (`Idempotency-Key`)**:
   - Request payloads are locked in-flight. Duplicate submissions or retried network requests immediately return the cached completed response without triggering secondary debits.

4. **Multi-Factor Fraud Detection & Risk Scoring Engine**:
   - Real-time velocity tracking against cards, VPAs, and client IPs within sliding time windows.
   - Luhn algorithm validation (Mod 10 check) on all card inputs.
   - Single transaction ceiling enforcement (₹5,00,000 threshold) and stepped-up verification requirements (> ₹1,00,000).
   - Classifies risk into tiers: `LOW` (Frictionless), `MEDIUM` (Mandatory 3DS2 Challenge), `BLOCKED` (Immediate decline).

5. **Cryptographic Webhook Signatures & Anti-Replay**:
   - All outgoing webhook dispatches are signed with **HMAC-SHA256** using merchant secret keys.
   - Supports Razorpay signature verification (`HMAC-SHA256(order_id + "|" + payment_id, secret)`).
   - Supports Stripe timestamped signatures (`t=...,v1=...`) with a 5-minute replay attack tolerance window.

---

## ⚡ Supported Payment Rails & Features

| Rail | Supported Methods | Currency | Settlement Fee (MDR) | Key Technical Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **UPI Direct (NPCI)** | Dynamic QR, Collect, Intent | INR | **0.00%** | Native vector SVG QR generation, VPA handle validation, Google Pay / PhonePe / Paytm / CRED / BHIM deep links, real-time approval simulation |
| **Visa / MasterCard** | Credit, Debit, CoFT Tokens | INR, USD, EUR, GBP | **1.25%** | Real-time BIN detection, 3D Secure 2.0 ACS challenge simulation, interchange fee calculation, tokenized one-click checkouts |
| **Razorpay Adapter** | Netbanking (50+ banks), Wallets | INR, USD, EUR | **1.85%** | Standard Orders API emulation, HMAC-SHA256 signature verification, automated 18% GST deduction on MDR |
| **International Rails** | Global Cards, Stripe, PayPal | USD, EUR, GBP, SGD, AED, JPY, CAD, AUD | **2.90%** | Real-time FX exchange matrix, Dynamic Currency Conversion (DCC), cross-border export compliance (RBI purpose code P0802) |

---

## 🖥️ Graphical User Interface (GUI)

The platform provides a dual-interface GUI accessible directly from the browser:

### 1. Customer-Facing Unified Checkout Widget
- **Dynamic QR Code**: Generates authentic vector SVG QR codes with live countdown timers and pulse animations.
- **UPI VPA Collect Form**: Instant handle chips (`@okhdfcbank`, `@paytm`, `@ybl`, `@oksbi`) with mobile push notification simulation.
- **Interactive 3D Credit Card**: Flips dynamically on CVV focus, auto-detects card brand badges (Visa, MasterCard, RuPay), and checks Luhn checksums in real time.
- **3DS2 Challenge Modal**: Interactive bank OTP screen with test OTP auto-fill button (`123456`).
- **Payment Receipt Modal**: Visual state machine indicator (`INITIATED` ➔ `RISK_SCREENED` ➔ `3DS_VERIFIED` ➔ `CAPTURED`) with transaction identifiers and fee receipts.

### 2. Merchant & Operations Command Center (Dashboard)
- **Live KPI Telemetry**: Total volume processed (INR & USD equivalents), success rate %, average latency (ms), and active card vault tokens.
- **Smart Dynamic Routing Configurator**: Switch strategies between `SMART_AUTO`, `COST_OPTIMIZED` (0% MDR priority), `SUCCESS_RATE`, and `FAILOVER`.
- **Live Circuit Breakers**: Real-time health badges and latency gauges across all 4 rails.
- **Real-Time Transactions Ledger**: Filterable by status and method with search capability.
- **Transaction Inspector Drawer**: Complete audit trail, fraud risk scorecard, PCI-DSS vault inspection, and **One-Click Idempotent Partial or Full Refunds**.
- **Cryptographic Signature Testing Tool**: Test and verify HMAC-SHA256, Razorpay, and Stripe signatures in real time.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+ or later) installed.
- Zero third-party npm packages required; runs natively on Node.js standard libraries.

### 1. Run Verification Test Suite
Verify all cryptographic protocols, tokenization vaults, 3DS flows, routing, and refunds:
```bash
cd "payment-aggregator"
npm test
```

### 2. Start the Aggregator Server
```bash
npm start
```

### 3. Open the GUI
Open your browser and navigate to:
```
http://localhost:4000
```

---

## 📡 RESTful API Reference

| Endpoint | Method | Description | Headers / Payload |
| :--- | :--- | :--- | :--- |
| `/api/config` | `GET` | System configuration, active rails, FX rates | None |
| `/api/metrics` | `GET` | Dashboard KPI metrics & telemetry | None |
| `/api/orders` | `POST` | Create a new merchant order | `{ "amount": 5499, "currency": "INR" }` |
| `/api/cards/tokenize` | `POST` | Vault and tokenize a card under PCI-DSS | `{ "number": "4111...", "expMonth": "12", "expYear": "28", "cvv": "123" }` |
| `/api/payments/initiate` | `POST` | Process payment across any rail | `Idempotency-Key`, `{ "method": "upi"|"card"|"razorpay"|"international", "amount": 5499 }` |
| `/api/payments/verify-3ds` | `POST` | Submit 3DS2 challenge OTP | `{ "paymentId": "pay_...", "otp": "123456" }` |
| `/api/payments/upi-status` | `POST` | Poll or simulate UPI approval | `{ "paymentId": "pay_...", "forceApprove": true }` |
| `/api/payments/:id/refund` | `POST` | Issue full or partial refund | `{ "amount": 1000, "reason": "Customer return" }` |
| `/api/transactions` | `GET` | List transactions with pagination | `?limit=50` |
| `/api/routing/rules` | `GET/POST` | Get or update routing strategy | `{ "strategy": "COST_OPTIMIZED" }` |
| `/api/security/verify-signature` | `POST` | Verify HMAC or gateway signatures | `{ "type": "razorpay"|"stripe"|"hmac", "signature": "..." }` |
| `/api/checkout/express` | `POST` | 1-Click Automated Express Checkout ($9 Lifetime after 15-Day Trial) | `{ "tier": "PRO", "amount": 9, "currency": "USD", "paymentMethod": "upi" }` |

