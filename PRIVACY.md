# Privacy Policy — OpenDesk PRO Enterprise (v3.1.0)

**Effective Date:** October 30, 2026  
**Architecture:** Local-First · Zero-Telemetry · Air-Gapped Strict Privacy Mode (`🛡️ Strict Privacy`)

## 1. Zero Telemetry & Zero Data Collection
**OpenDesk PRO Enterprise** is engineered as a 100% local-first macOS application.
- **No Analytics or Tracking SDKs:** OpenDesk contains zero analytics libraries, telemetry beacons, crash-reporting trackers, or user-profiling scripts.
- **Local Storage Only:** All clipboard history, workspace files, Obsidian Markdown notes (`Notes/`), and AES-256-GCM encrypted vault records (`Vault/vault-store.dfvault`) are stored exclusively on your local Mac filesystem.

## 2. Unified Security, Privacy & Vault Packet (`🛡️ Security Packet`)
- **Strict Privacy Mode (`strictPrivacyMode`):** When enabled, OpenDesk blocks all external network requests at the Electron main-process transport layer and routes 100% of AI requests to the on-device **Built-in Smart AI** or local loopback endpoints (`127.0.0.1` Ollama / LM Studio / OmniRoute).
- **Outbound PII & Secret Redaction Engine (`piiRedactionEnabled`):** Automatically scrubs API keys, PEM private keys, JWT tokens, payment card numbers, SSNs, and email addresses into `[REDACTED_*]` placeholders before any optional external AI query.
- **Sensitive Clipboard Guard (`sensitiveClipboardGuard`):** Automatically ignores clipboard events originating from password managers (`1Password`, `Keychain Access`, `Bitwarden`, `KeePassXC`, `LastPass`, `Dashlane`) and blocks high-entropy secrets from unencrypted clipboard persistence.
- **Emergency Panic Wipe (`🔥 Panic Wipe`):** Immediately locks the Dedicated Vault, zeroes active cryptographic keys in memory (`Buffer.fill(0)`), and purges non-pinned clipboard items and staging shelves.
