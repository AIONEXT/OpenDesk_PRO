# Changelog — OpenDesk PRO Enterprise

## [3.1.0 Enterprise Edition] — 2026-10-30

### `OpenDesk` Brand, Custom Squircle Icon, Recall Engine & Unified Single-Packet Security Architecture
- **`OpenDesk` Brand & Custom macOS Icon (`build/icon.png` & `icon.icns`)**: Rebranded across the application, menu bar tray (`🛡️📂`), documentation, and installer to **`OpenDesk`**, with a custom Midnight Sapphire & Liquid-Glass Drawer + Cryptographic Shield icon embedded into `DeskFolder.app` and the single canonical `DeskFolder-3.1.0.dmg` in-place (zero duplicate `.dmg` files).
- **Workspace & Encrypted Snapshot Recall (`⏪ Recall` / `recall-encrypted-snapshot` / `recall-commercial-license` / `get-workspace-recall`)**: Added 1-click AES-256-GCM `.dfbackup` snapshot recall (restoring Notes, Quick Tasks, Custom Prompts, and Vault records) and 1-click Commercial License Recall & receipt verification in the Unified Security Packet, Commercial License Modal, and Global Command Palette (`⌘K`).
- **Unified OpenDesk Security, Privacy, Vault, Recall & Unique Features Packet (`🛡️ Security Packet` / `get-unified-security-packet`)**: Consolidated all 12 security, privacy, vault, encryption, snapshot recall, duplicate-cleaning, and commercial licensing engines into one unified command center and single IPC packet.
- **Zero-Knowledge Armored Text Cipher (`ODSEAL1:...`) & 1-Click Leak Auto-Remediation (`vault-and-redact-leak`)**: Added AES-256-GCM armored text sealing/unsealing (`seal-text-packet` / `unseal-text-packet`) and 1-click secret leak vaulting + in-place file redaction.
- **15-Day Hardware-Bound Trial & $9 Automated One-Time Lifetime Subscription (`ODPRO-` / `ODENT-`)**: Upgraded to a 15-day (360-hour) hardware-sealed trial ledger (`license-ledger.dfsec`) with zero-lag in-memory PBKDF2/ledger caching, monotonic clock-tamper detection, offline HMAC-SHA256 & Ed25519 license verification (`crypto.timingSafeEqual`), 1-Click Automated Customer Checkout (`$9` Lifetime Subscription across UPI 2.0, Visa/MasterCard/Apple Pay, Razorpay, and Global rails via `./payment-aggregator`), and built-in 1-Click License Recall & Owner Simulator.
- **Full-Workspace Encrypted Security Lock (`🔒 Lock` / `⌘+L`)**: Added full-window AES-256-GCM lockscreen shield that zeroes active keys in memory and enforces brute-force lockout protection.
- **Flagship Security Suite**: Added CSPRNG Password/Diceware Generator with Shannon entropy scoring, DoD 5220.22-M 3-Pass Cryptographic File Shredder (`🔥`), Workspace Secret Leak Scanner (`🕵️`), and Encrypted `.dfbackup` Snapshot Exporter & Recall (`📦` / `⏪`).

### Commercial & Legal Readiness
- **MIT License (`LICENSE`)**: Standard OSI-approved MIT License (`Copyright (c) 2026 OpenDesk PRO Contributors`) for unrestricted commercial distribution, modification, and enterprise deployment.
- **Compliance & Attribution Suite**: `COMMERCIAL_LICENSING.md`, `PRIVACY.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `build/entitlements.mac.plist` (Apple Hardened Runtime entitlements), embedded inside `app.asar`.

### Dedicated AES-256-GCM Encrypted Vault (`🔐 Vault`) & Strict Privacy Shield
- **Authenticated Cryptographic Container (`Vault/vault-store.dfvault`)**: **AES-256-GCM** encryption with **PBKDF2-HMAC-SHA512 (210,000 iterations)** key derivation, unique 256-bit salt, per-item 128-bit IVs, and 128-bit authentication tags.
- **Strict Privacy Mode (`🛡️ Strict Privacy`) & Outbound PII Redactor**: Air-gaps AI Studio from external cloud fallbacks for 100% local execution, and automatically scrubs API keys, tokens, PEM private keys, emails, credit cards, and SSNs before any external AI request.
- **Expanded Free AI Model Presets & Multi-Port OmniRoute**: Added `nvidia/nemotron-3.5-lightning-30b-a3b`, `nvidia/nemotron-3.5-lightning:free`, `cohere/north-mini-code:free`, `thinkingmachines/inkling:free`, and `auto/best-free`, plus automatic OmniRoute discovery across `127.0.0.1:20128`, `127.0.0.1:4000`, and `api.omnirouter.ai`.
