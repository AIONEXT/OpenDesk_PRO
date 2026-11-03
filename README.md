# OpenDesk PRO v3.1 Enterprise — All-in-One macOS Liquid Glass Workspace, Unified Security/Privacy/Vault/Recall Packet & Zero-Telemetry AI Hub

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A commercial-ready, MIT-licensed macOS menu bar (`🛡️📂`) and top-edge two-finger trackpad pull-down workspace supercharged with the **OpenDesk All-in-One Security, Privacy, Vault, Recall & Unique Features Packet** — combining **15-Day Commercial Trial, 1-Click $9 Automated Lifetime Checkout, 1-Click License Recall & Offline HMAC-SHA256 Licensing (`ODPRO-` / `ODENT-`)**, **Full-Workspace Encrypted Security Lock (`🔒 Lock` / `⌘+L`)**, **Dedicated AES-256-GCM Encrypted Vault (`🔐 Vault`)**, **Encrypted `.dfbackup` Snapshot Exporter & 1-Click Workspace Recall (`⏪ Recall`)**, **Zero-Knowledge Armored Text & Snippet Cipher (`ODSEAL1:...`)**, **Strict Privacy & Outbound PII Redaction Shield (`🛡️ Strict Privacy`)**, **CSPRNG Secret Generator & DoD 5220.22-M 3-Pass File Shredder**, **Workspace Secret Leak Scanner + 1-Click Vault & Redact**, **Power Clipboard & Developer Utilities**, **Zero-Overlap Files Dropzone & Native Drag-Out Shelf**, **Fast 8KB-Prehashed SHA-256 Duplicate Cleaner (`🧹`)**, **Obsidian-Compatible Markdown & Table Notepad**, **Pomodoro Focus Suite**, **Global Command Palette (`⌘K`)**, **NexusPay Multi-Rail Payment Aggregator (`./payment-aggregator`)**, and a **14-Provider Local/Free/Cloud AI Studio**.

## Single Canonical Installer, App Bundle, Payment Aggregator & Dedicated Vaults
- **Updated macOS Disk Image (`.dmg`)**: `./DeskFolder-3.1.0.dmg` (updated in-place with zero duplicate `.dmg` files)
- **Standalone Release App Bundle**: `./desk-folder-app/release/DeskFolder.app`
- **Multi-Rail Automated Payment Aggregator (`NexusPay`)**: `./payment-aggregator` (UPI 2.0, Visa/MasterCard, Razorpay, Global FX & 1-Click `$9` Automated Lifetime Checkout)
- **Custom OpenDesk macOS Squircle Icon**: `./desk-folder-app/build/icon.png` & embedded `icon.icns`
- **Dedicated AES-256-GCM Encrypted Vault**: `./Vault` (`vault-store.dfvault` + `*.dfenc` encrypted files + `*.dfbackup` snapshots)
- **Dedicated Obsidian Knowledge Vault**: `./Notes` (`.obsidian` configured)
- **Commercial & Legal Compliance Package**: [`COMMERCIAL_LICENSING.md`](./COMMERCIAL_LICENSING.md), [`LICENSE`](./LICENSE) (MIT License), [`PRIVACY.md`](./PRIVACY.md), [`SECURITY.md`](./SECURITY.md), [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md), [`CHANGELOG.md`](./CHANGELOG.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md), and [`build/entitlements.mac.plist`](./desk-folder-app/build/entitlements.mac.plist).

## v3.1 Enterprise Feature Highlights (Unified Single Packet)

### 1. Unified OpenDesk Security, Privacy, Vault, Recall & Unique Features Packet (`🛡️ Security Packet`)
- **All-in-One Single Packet (`get-unified-security-packet`)**: Consolidates all 12 security, privacy, vault, encryption, snapshot recall, duplicate-cleaning, and commercial licensing engines into one unified command center and IPC packet.
- **Dedicated AES-256-GCM Vault (`Vault/vault-store.dfvault`)**: Protects confidential secrets, API tokens, SSH/PGP keys, recovery codes, and private notes using **AES-256-GCM** with **PBKDF2-HMAC-SHA512 (210,000 iterations)**, 256-bit salt, per-item 128-bit IVs, and 128-bit GCM authentication tags.
- **1-Click File Encryption (`*.dfenc`), Zero-Knowledge Text Cipher (`ODSEAL1:...`) & Encrypted Snapshot Recall (`⏪ Recall`)**: Encrypt any workspace file into `Vault/` with SHA-256 verification, seal/unseal confidential text snippets into portable `ODSEAL1:...` AES-256-GCM armored packets, and export or recall encrypted `.dfbackup` workspace snapshots (`export-encrypted-snapshot` / `recall-encrypted-snapshot`).
- **CSPRNG Generator, Secret Leak Scanner (`vault-and-redact-leak`) & DoD 3-Pass Shredder**: Generate >=128-bit entropy passwords/Diceware passphrases, scan workspace files for exposed API keys with 1-click vaulting and in-place file redaction, and shred sensitive files with 3-pass DoD 5220.22-M overwrite (`0x00`, `0xFF`, CSPRNG).

### 2. 15-Day Commercial Trial, $9 Automated Lifetime Checkout, 1-Click License Recall & Full-Workspace Security Lock (`⌘+L`)
- **Zero-Lag In-Memory Hardware-Bound Trial Ledger (`license-ledger.dfsec`)**: Tracks the **15-day (360-hour)** full-feature free trial encrypted with AES-256-GCM, cached in memory to eliminate main-thread PBKDF2 lag during UI reviews, and protected by a monotonic anti-clock-tamper guard.
- **$9 One-Time Lifetime Subscription & Automated Payment Gateway (`ODPRO-` / `ODENT-`)**: After the 15-day free trial, users unlock lifetime access for a single **$9 one-time payment** (`license-complete-checkout` / `POST /api/checkout/express` across UPI 2.0, Visa/MasterCard, Razorpay, and Global rails) with instant offline `HMAC-SHA256` & `Ed25519` verification, 1-Click Commercial License Recall (`recall-commercial-license`), and zero recurring fees.
- **Full-Workspace Encrypted Security Lockscreen (`🔒 Lock` / `⌘+L`)**: Covers all panes behind an AES-256-GCM lock shield, zeroes in-memory cryptographic keys (`Buffer.fill(0)`), and enforces brute-force lockout protection after 5 failed PIN/passphrase attempts.

### 3. Strict Privacy Mode (`🛡️ Strict Privacy`), Outbound PII Redactor & Fast Duplicate Cleaner
- **Air-Gapped Local AI Enforcement**: Enabling `🛡️ Strict Privacy` blocks all external cloud AI connections and fallbacks at the main-process transport layer, routing 100% of requests to on-device **Built-in Smart AI** or local loopback servers (`127.0.0.1` Ollama / LM Studio / OmniRoute).
- **Outbound PII & Secret Redaction Shield**: Automatically scrubs API keys, PEM private keys, JWTs, AWS keys, payment card numbers, SSNs, and email addresses into `[REDACTED_*]` placeholders before any external AI query.
- **High-Speed 8KB-Prehashed SHA-256 Duplicate Cleaner (`🧹`)**: Uses a two-stage 8KB boundary pre-filter (`first 4KB + last 4KB`) before full SHA-256 verification to scan and remove byte-identical duplicate files up to 10x faster.

### 4. OpenDesk AI Studio v3.1: Multi-Attachment `@Context`, Transcript Export & 14 Free Providers Only
- **Zero-Key Free, Router & Local Providers**: `⚡ Built-in Smart AI (Offline)`, `🌐 Free Cloud AI (Zero-Key Gateway)`, `🧭 OmniRoute (Free AI Router on 127.0.0.1:20128 / 4000 or api.omnirouter.ai)`, `🏠 Ollama`, and `🏠 LM Studio`.
- **100% Free-Tier Cloud API Key Vault**: `🆓 OpenRouter (:free models including deepseek-r1:free, nemotron-3.5-lightning:free, cohere/north-mini-code:free, thinkingmachines/inkling:free)`, `🟢 Nvidia NIM (meta/llama-3.3-70b-instruct, nvidia/nemotron-3.5-lightning-30b-a3b)`, `🧭 OmniRoute (omniroute/auto-free, auto/best-free)`, `⚡ Groq Cloud`, `☁️ Google Gemini (Free)`, `🚀 Cerebras`, `🔥 SambaNova Cloud`, `🐙 GitHub Models`, `🤗 Hugging Face`, and `🌪️ Mistral / Codestral`, protected by strict ASCII `ByteString` header sanitization.
