# Security Policy & Cryptographic Architecture — OpenDesk PRO Enterprise (v3.1.0)

## 1. Unified Cryptographic Standards (Single Packet)
- **Authenticated Encryption Cipher:** `AES-256-GCM` with unique 128-bit random IVs and 128-bit authentication tags per encrypted record, file (`*.dfenc`), text packet (`ODSEAL1:...`), and snapshot (`*.dfbackup`).
- **Key Derivation Function (KDF):** `PBKDF2-HMAC-SHA512` with `210,000` iterations and a 256-bit cryptographically random salt (`crypto.randomBytes(32)`).
- **Zero-Knowledge Memory Hygiene:** Active key buffers (`activeVaultKey`, `hwKey`) are explicitly zeroed in RAM via `Buffer.fill(0)` on manual lock (`⌘+L`), drawer close (`vaultAutoLockOnHide`), or Panic Wipe.
- **DoD 5220.22-M 3-Pass File Shredder:** Overwrites sensitive files with `0x00`, `0xFF`, and CSPRNG random bytes (`crypto.randomBytes`), scrubs the APFS directory entry name, and unlinks the file.
- **Offline HMAC-SHA256 Licensing:** Verifies commercial keys (`ODPRO-` / `ODENT-`) offline using constant-time `crypto.timingSafeEqual`.

## 2. Electron Hardening & Isolation
- **Context Isolation:** `contextIsolation: true` and `nodeIntegration: false` across the main workspace renderer, exposing only typed IPC channels through `preload.ts`.
- **ASCII Header Sanitizer:** `sanitizeApiKey` and `buildSafeAsciiHeaders` enforce strict printable ASCII (`0x21..0x7E`) on all HTTP headers to prevent WebIDL `ByteString` injection or crash vectors.
