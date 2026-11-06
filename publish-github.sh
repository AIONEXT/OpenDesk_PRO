#!/usr/bin/env bash
set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

echo "================================================================"
echo "🚀 Publishing OpenDesk PRO v3.1.0 to GitHub (AIONEXT/OpenDesk_PRO)"
echo "================================================================"

# Resolve GH_TOKEN from gh CLI or macOS Keychain if available
if [ -z "${GH_TOKEN:-}" ] && command -v gh >/dev/null 2>&1; then
  TOKEN_CANDIDATE="$(gh auth token 2>/dev/null || HOME=/Users/aio_x gh auth token 2>/dev/null || true)"
  if [ -n "$TOKEN_CANDIDATE" ]; then
    export GH_TOKEN="$TOKEN_CANDIDATE"
  fi
fi

if [ -z "${GH_TOKEN:-}" ] && command -v security >/dev/null 2>&1; then
  KEYCHAIN_TOKEN="$(security find-generic-password -s "gh:github.com" -w 2>/dev/null || true)"
  if [ -n "$KEYCHAIN_TOKEN" ]; then
    export GH_TOKEN="$KEYCHAIN_TOKEN"
  fi
fi

# Ensure remote is configured
if [ -n "${GH_TOKEN:-}" ]; then
  git remote set-url origin "https://AIONEXT:${GH_TOKEN}@github.com/AIONEXT/OpenDesk_PRO.git" 2>/dev/null || \
    git remote add origin "https://AIONEXT:${GH_TOKEN}@github.com/AIONEXT/OpenDesk_PRO.git"
else
  git remote set-url origin https://github.com/AIONEXT/OpenDesk_PRO.git 2>/dev/null || \
    git remote add origin https://github.com/AIONEXT/OpenDesk_PRO.git
fi

# Ensure gh git credential helper is wired if gh is authenticated
if command -v gh >/dev/null 2>&1; then
  gh auth setup-git 2>/dev/null || true
fi

# Create public repo if it doesn't exist yet, then push main branch
if command -v gh >/dev/null 2>&1; then
  if ! gh repo view AIONEXT/OpenDesk_PRO >/dev/null 2>&1; then
    echo "ℹ️ Creating public repository AIONEXT/OpenDesk_PRO via GitHub CLI..."
    gh repo create AIONEXT/OpenDesk_PRO --public \
      --description "OpenDesk PRO v3.1 — macOS Liquid Glass top-edge workspace drawer with Power Clipboard, Staging Shelf, Markdown Notes, AES-256-GCM Vault & Zero-Telemetry AI Studio." || true
  fi
fi

git push -u origin main --force
echo "✅ Pushed main branch to https://github.com/AIONEXT/OpenDesk_PRO"

# Reset remote URL to clean HTTPS URL (without embedded token)
git remote set-url origin https://github.com/AIONEXT/OpenDesk_PRO.git 2>/dev/null || true

# Configure GitHub description, topics & v3.1.0 DMG release via gh CLI
if command -v gh >/dev/null 2>&1; then
  gh repo edit AIONEXT/OpenDesk_PRO --visibility public --accept-visibility-change-consequences 2>/dev/null || true
  gh repo edit AIONEXT/OpenDesk_PRO \
    --description "OpenDesk PRO v3.1 — macOS Liquid Glass top-edge workspace drawer with Power Clipboard, Staging Shelf, Markdown Notes, AES-256-GCM Vault & Zero-Telemetry AI Studio." \
    --add-topic macos,electron,react,typescript,productivity,clipboard-manager,markdown-notes,aes-256-gcm,encrypted-vault,local-ai 2>/dev/null || true

  if [ -f "$REPO_DIR/DeskFolder-3.1.0.dmg" ]; then
    echo "📦 Uploading DeskFolder-3.1.0.dmg to GitHub Release v3.1.0..."
    gh release create v3.1.0 "$REPO_DIR/DeskFolder-3.1.0.dmg#OpenDesk-PRO-3.1.0.dmg" \
      --repo AIONEXT/OpenDesk_PRO \
      --title "OpenDesk PRO v3.1.0 Enterprise" \
      --notes "OpenDesk PRO v3.1.0 Enterprise — macOS Liquid Glass Workspace Drawer, Dedicated AES-256-GCM Encrypted Vault, 15-Day Trial -> Fresh QR/One-Time URL -> OTT Ed25519 Certificate Lifetime Activation, Email-Authenticated Customer Credentials (VAULT_MASTER_KEY & WEBHOOK_SECRET), and Zero-Telemetry AI Hub." || \
    gh release upload v3.1.0 "$REPO_DIR/DeskFolder-3.1.0.dmg#OpenDesk-PRO-3.1.0.dmg" \
      --repo AIONEXT/OpenDesk_PRO --clobber
    echo "✅ GitHub Release v3.1.0 published with OpenDesk-PRO-3.1.0.dmg"
  fi
fi

echo "================================================================"
echo "🎉 Live at: https://github.com/AIONEXT/OpenDesk_PRO"
echo "================================================================"
echo "DEPLOY_COMPLETE_OK"
