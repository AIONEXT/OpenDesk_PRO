# Contributing & Enterprise Build Guide — OpenDesk PRO Enterprise

Thank you for contributing to **OpenDesk PRO Enterprise (`com.opendesk.app`)**! This project is released under the **MIT License**.

## 1. Repository Architecture
- `src/main/main.ts` — Electron Main Process: Top-edge two-finger trackpad sensor, AES-256-GCM Dedicated Vault engine, Encrypted `.dfbackup` Snapshot Exporter & 1-Click Recall (`recall-encrypted-snapshot`), Commercial License Recall & Offline HMAC-SHA256 Licensing (`ODPRO-` / `ODENT-`), Strict Privacy & PII Redaction Shield, SHA-256 duplicate file cleaner, and 14-provider AI Studio bridge.
- `src/preload/preload.ts` — Context-isolated IPC bridge (`window.electronAPI`).
- `src/renderer/main.tsx` & `src/renderer/styles.css` — React 18 UI, Designer Glass themes, resizable 3/4-pane split layout, Unified Security/Privacy/Vault/Recall Packet (`🛡️ Security Packet`), Power Clipboard, and Markdown Notepad.
- `build-valid-dmg.py` & `build-macos-dmg.sh` — Apple APFS UDZO disk image builder with Fletcher-64 superblock verification and `hdiutil verify` validation.

## 2. Building & Running Verification Tests
```bash
cd desk-folder-app
npm run build
npm test
```

## 3. Security & Privacy Standards
- Never introduce external telemetry, analytics, or unrequested network calls.
- Ensure all new IPC handlers use `registerIpc()` and respect `strictPrivacyMode` and `lockedFiles` / `lockedNotes` guards.
- Run `node ./test-all-features.mjs` and verify `hdiutil verify ../DeskFolder-3.1.0.dmg` passes before submitting changes.
