---
tags:
  - opendesk
  - enterprise
  - vault
  - privacy
  - mit-license
---

# OpenDesk Pro v3.1 — Unified Security, Privacy, Vault & Unique Features Packet

**OpenDesk Pro v3.1 Enterprise** is packaged under the **MIT License** (`LICENSE`) with complete commercial compliance documentation and the **OpenDesk All-in-One Security, Privacy, Vault & Unique Features Packet** (`🛡️ Security Packet`).

## 1. Dedicated AES-256-GCM Vault (`Vault/`) & Zero-Knowledge Cipher (`ODSEAL1`)
- **Cryptographic Standard**: `AES-256-GCM` authenticated encryption with `PBKDF2-HMAC-SHA512` (210,000 iterations) and a 256-bit random salt.
- **Encrypted Container**: `/Users/aio_x/Documents/Mac DeskFolder/Vault/vault-store.dfvault`
- **File Encryption (`*.dfenc`)**: Click `🔐` on any file in the Files Dropzone to encrypt it into `Vault/`, and restore it with verified `SHA-256` integrity.
- **Zero-Knowledge Text Cipher (`ODSEAL1:...`)**: Seal or unseal confidential text snippets inside the Unified Security Packet.
- **1-Click Leak Auto-Remediation**: Scan workspace files for exposed API keys/tokens and vault + redact them in-place with one click.

## 2. Strict Privacy Mode (`🛡️ Strict`) & Full-Workspace Lock (`⌘+L`)
- **Air-Gapped Local AI**: Blocks all external cloud AI calls and fallbacks when active, running 100% locally via Built-in Smart AI or loopback (`127.0.0.1`) Ollama / LM Studio / OmniRoute.
- **Outbound PII & Secret Redaction**: Scrubs API keys, PEM private keys, JWTs, payment cards, SSNs, and email addresses into `[REDACTED_*]` placeholders.
- **Full-Workspace Security Lock (`⌘+L`) & Panic Wipe (`🔥 Panic Wipe`)**: Locks all panes behind an AES-256-GCM shield, zeroes master keys in memory (`Buffer.fill(0)`), and purges non-pinned clipboard history and staging shelves.

## Related Notes
- [[Quick Scratchpad]]
- [[Executive Meeting Template]]
- [[Developer Cheat Sheet]]
