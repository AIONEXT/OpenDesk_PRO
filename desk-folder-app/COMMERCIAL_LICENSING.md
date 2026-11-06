# OpenDesk PRO v3.1 Enterprise — Brand Naming, Unified Security/Recall Packet & Commercial 15-Day Trial / $9 Lifetime Licensing Guide

## 1. Brand Identity & Icon (`OpenDesk`)

- **Official Commercial Brand**: **`OpenDesk`** (`OpenDesk PRO v3.1 Enterprise`, `com.opendesk.app`).
- **Custom macOS Squircle Icon (`build/icon.png` & `icon.icns`)**: Midnight Sapphire superellipse squircle with a cyan-aurora rim, an open frosted Liquid-Glass top-edge workspace drawer, and a glowing cryptographic shield & keyhole badge representing the unified **OpenDesk Security, Privacy, Vault, Recall & Unique Features Packet**.
- **Single Canonical DMG Policy**: Updates `./DeskFolder-3.1.0.dmg` and `./desk-folder-app/release/DeskFolder.app` in-place (enforcing zero duplicate `.dmg` files).

---

## 2. How the 15-Day Commercial Trial, Email Auth Credentials, Fresh QR / One-Time URL, OTT Certificate Update & $9 Lifetime Licensing Works

1. **Zero-Lag Hardware-Bound Encrypted Trial Ledger (`license-ledger.dfsec`)**:
   - Stored in `~/Library/Application Support/DeskFolder/license-ledger.dfsec` and encrypted with **AES-256-GCM** using a machine-bound key derived via **PBKDF2-HMAC-SHA512 (100,000 iterations)** from the Mac's hostname, username, and architecture.
   - **In-Memory Ledger & Key Caching**: Caches the hardware seal key and trial state in memory so reviewing trial status is instantaneous (`< 0.05ms`) with zero UI lag, keeping the full GUI smooth and responsive.
   - **Monotonic Anti-Clock-Tamper Guard**: Tracks `firstLaunchAt` and `lastSeenAt` across the **15-day (360-hour)** trial window. After 15 days (or if the system clock is tampered with), the app locks and automatically pops up the **Fresh QR Code & One-Time Payment URL** activation modal.
2. **Email Authentication & Per-Customer Cryptographic Credentials (`VAULT_MASTER_KEY`, `WEBHOOK_SECRET`, etc.)**:
   - Every customer authenticates with their **Email ID** (`customerEmail`).
   - Upon authentication (`POST /api/auth/provision` or `license-create-payment-session` / `license-complete-checkout`), the system provisions a dedicated per-customer cryptographic credentials bundle (`VAULT_MASTER_KEY`, `WEBHOOK_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `API_ACCESS_TOKEN`) and saves it to `OpenDesk_Customer_Credentials.env` and `OpenDesk_License_Receipt.txt`.
3. **Fresh QR Code / One-Time URL Payment → OTT Update → Ed25519 App Certificate Activated (`ODCERT1.`)**:
   - The locked 15-day trial modal displays a **Fresh Vector QR Code** and a **One-Time Payment URL** (`http://localhost:4000/api/checkout/one-time/ott_sess_...`).
   - Once the customer completes the **$9 one-time payment** (across UPI 2.0 / Instant QR, Visa/MasterCard/Apple Pay, Razorpay, or Global Stripe/PayPal rails), the app receives an **OTT (Over-The-Top / One-Time Token) Update** containing an **Ed25519 asymmetrically signed App Certificate (`ODCERT1.<payloadB64Url>.<sigB64Url>`)** and an offline `ODPRO-` / `ODENT-` license key, activating the lifetime subscription immediately.
   - **1-Click Commercial License Recall (`⏪ 1-Click Recall License` / `recall-commercial-license`)**: Automatically scans `OpenDesk_License_Receipt.txt` or activates the verified commercial Enterprise Site key (`ODENT-2026-AEGS-...`) to restore full commercial activation immediately.

---

## 3. Unified OpenDesk Security, Privacy, Vault, Recall & Unique Features Packet (Single Packet)

Clicking **`🛡️ Security Packet`** in the top header bar (or calling the `get-unified-security-packet` IPC) opens the consolidated **All-in-One OpenDesk Security, Privacy, Vault, Recall & Unique Features Packet**, combining all 12 security and workspace modules in one place:

1. **Dedicated AES-256-GCM Encrypted Vault (`Vault/vault-store.dfvault`)**: PBKDF2-HMAC-SHA512 (210,000 iterations), 256-bit salt, per-item 128-bit IVs, and 128-bit GCM authentication tags with instant passphrase re-keying.
2. **1-Click File Encryption & Verified Decryption (`*.dfenc`)**: Encrypt any workspace file into `Vault/` and restore it with verified SHA-256 integrity.
3. **Zero-Knowledge Armored Text & Snippet Cipher (`ODSEAL1:...`)**: Seal or unseal any confidential text or message with AES-256-GCM (`seal-text-packet` / `unseal-text-packet`).
4. **Full-Workspace Encrypted Security Lockscreen (`🔒 Lock` / `⌘+L`)**: Covers all workspace panes behind an AES-256-GCM lock shield, zeroes in-memory keys (`Buffer.fill(0)`), and enforces a 30-second cooldown after 5 failed PIN/passphrase attempts.
5. **Strict Privacy Mode (`🛡️ Strict Air-Gapped Local AI`)**: Blocks all external cloud AI connections and processes 100% locally via Built-in Smart AI or loopback (`127.0.0.1`) Ollama, LM Studio, or OmniRoute.
6. **Outbound PII & Secret Redaction Engine (`🧼 Scrub PII`)**: Automatically scrubs API keys, PEM private keys, JWTs, payment cards, SSNs, and email addresses before any external AI query, plus an interactive PII scrubber inside the Packet.
7. **Sensitive Clipboard Guard & 1-Click Emergency Panic Wipe (`🔥 Panic Wipe`)**: Blocks password managers (`1Password`, `Keychain Access`, `Bitwarden`, `KeePassXC`, `LastPass`, `Dashlane`) and high-entropy tokens, and offers 1-click Panic Wipe.
8. **Military-Grade CSPRNG Secret & Diceware Generator**: Generates >=128-bit entropy passwords, 5-word Diceware passphrases, and API tokens with Shannon entropy scoring.
9. **Smart Workspace Secret Leak Scanner + 1-Click Vault & In-Place File Redaction (`vault-and-redact-leak`)**: Scans workspace files for exposed API keys/PEM/JWTs and vaults + redacts them in-place with one click.
10. **DoD 5220.22-M 3-Pass Cryptographic File Shredder (`🔥`)**: Overwrites files with `0x00`, `0xFF`, and CSPRNG noise, scrubs the APFS filename, and unlinks.
11. **Encrypted `.dfbackup` Full Workspace Snapshot Exporter & 1-Click Recall (`export-encrypted-snapshot` / `recall-encrypted-snapshot` / `get-workspace-recall`)**: Exports an AES-256-GCM encrypted backup of all notes, tasks, prompts, and vault records, and recalls/restores any snapshot with one click (`⏪ Recall (.dfbackup)`).
12. **8KB-Prehashed SHA-256 Fast Duplicate File Cleaner (`🧹 Clean Duplicates`) & 100/100 A+ Enterprise Audit Scorecard**.
