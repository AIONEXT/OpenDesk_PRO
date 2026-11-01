#!/usr/bin/env bash
set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

LOG_FILE="/tmp/opendesk-github-deploy.log"
exec > >(tee "$LOG_FILE") 2>&1

echo "================================================================"
echo "🚀 Publishing OpenDesk PRO v3.1.0 to GitHub (AIONEXT/OpenDesk_PRO)"
echo "================================================================"

# Ensure remote is configured
git remote set-url origin https://github.com/AIONEXT/OpenDesk_PRO.git 2>/dev/null || \
  git remote add origin https://github.com/AIONEXT/OpenDesk_PRO.git

# Ensure gh git credential helper is wired if gh is authenticated
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh auth setup-git 2>/dev/null || true
fi

# Push main branch (or create repo via GitHub CLI if it doesn't exist yet)
if git push -u origin main; then
  echo "✅ Pushed main branch to https://github.com/AIONEXT/OpenDesk_PRO"
elif command -v gh >/dev/null 2>&1; then
  echo "ℹ️ Creating repository AIONEXT/OpenDesk_PRO via GitHub CLI and pushing..."
  gh repo create AIONEXT/OpenDesk_PRO --public --source=. --remote=origin \
    --description "OpenDesk PRO v3.1 — macOS Liquid Glass top-edge workspace drawer with Power Clipboard, Staging Shelf, Markdown Notes, AES-256-GCM Vault & Zero-Telemetry AI Studio." \
    --push || git push -u origin main
fi

# Configure GitHub description, topics & v3.1.0 DMG release via gh CLI if authenticated
if command -v gh >/dev/null 2>&1; then
  gh repo edit AIONEXT/OpenDesk_PRO \
    --description "OpenDesk PRO v3.1 — macOS Liquid Glass top-edge workspace drawer with Power Clipboard, Staging Shelf, Markdown Notes, AES-256-GCM Vault & Zero-Telemetry AI Studio." \
    --add-topic macos,electron,react,typescript,productivity,clipboard-manager,markdown-notes,aes-256-gcm,encrypted-vault,local-ai 2>/dev/null || true

  if [ -f "$REPO_DIR/DeskFolder-3.1.0.dmg" ]; then
    echo "📦 Uploading DeskFolder-3.1.0.dmg to GitHub Release v3.1.0..."
    gh release create v3.1.0 "$REPO_DIR/DeskFolder-3.1.0.dmg#OpenDesk-PRO-3.1.0.dmg" \
      --repo AIONEXT/OpenDesk_PRO \
      --title "OpenDesk PRO v3.1.0 Enterprise" \
      --notes "OpenDesk PRO v3.1.0 Enterprise — macOS Liquid Glass Workspace Drawer, Dedicated AES-256-GCM Encrypted Vault, 7-Day Trial & Offline Licensing, and Zero-Telemetry AI Hub." || \
    gh release upload v3.1.0 "$REPO_DIR/DeskFolder-3.1.0.dmg#OpenDesk-PRO-3.1.0.dmg" \
      --repo AIONEXT/OpenDesk_PRO --clobber
    echo "✅ GitHub Release v3.1.0 published with OpenDesk-PRO-3.1.0.dmg"
  fi
fi

echo "================================================================"
echo "🎉 Live at: https://github.com/AIONEXT/OpenDesk_PRO"
echo "================================================================"
echo "DEPLOY_COMPLETE_OK"
