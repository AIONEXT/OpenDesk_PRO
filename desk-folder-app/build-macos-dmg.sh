#!/usr/bin/env bash
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "$APP_DIR/.." && pwd)"
export PATH="$APP_DIR/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

CANONICAL_DMG="$WORKSPACE_DIR/DeskFolder-3.1.0.dmg"
BUILT_APP="$APP_DIR/release/DeskFolder.app"

echo "================================================================"
echo "🚀 Updating Existing Canonical OpenDesk PRO v3.1 DMG In-Place"
echo "================================================================"

# Ensure commercial compliance files are synced between root and app directory
for doc in LICENSE PRIVACY.md SECURITY.md THIRD_PARTY_NOTICES.md CHANGELOG.md CONTRIBUTING.md COMMERCIAL_LICENSING.md; do
  if [ -f "$WORKSPACE_DIR/$doc" ]; then
    cp -f "$WORKSPACE_DIR/$doc" "$APP_DIR/$doc"
  elif [ -f "$APP_DIR/$doc" ]; then
    cp -f "$APP_DIR/$doc" "$WORKSPACE_DIR/$doc"
  fi
done

echo "0. Running strict TypeScript typecheck (tsc --noEmit)..."
cd "$APP_DIR"
node ./node_modules/typescript/bin/tsc --noEmit

echo "1. Compiling production renderer & main process in: $APP_DIR"
node ./node_modules/vite/bin/vite.js build
mkdir -p "$APP_DIR/dist-electron/assets"
bun build "$APP_DIR/src/main/main.ts" --outfile "$APP_DIR/dist-electron/main.js" --target node --format cjs --external electron
bun build "$APP_DIR/src/preload/preload.ts" --outfile "$APP_DIR/dist-electron/preload.js" --target node --format cjs --external electron
sed -i '' '/^var __dirname = /d' "$APP_DIR/dist-electron/main.js" 2>/dev/null || true
sed -i '' '/^var __dirname = /d' "$APP_DIR/dist-electron/preload.js" 2>/dev/null || true
cp -R "$APP_DIR/src/main/assets/"* "$APP_DIR/dist-electron/assets/" 2>/dev/null || true

echo "2. Updating existing canonical Apple APFS UDZO DMG in-place..."
python3 "$APP_DIR/build-valid-dmg.py"

if [ -d "$BUILT_APP/Contents/MacOS" ]; then
  echo "3. Signing local DeskFolder.app bundle cleanly via /tmp staging..."
  rm -rf /tmp/DeskFolder-sign.app
  /usr/bin/ditto --norsrc --noextattr "$BUILT_APP" /tmp/DeskFolder-sign.app
  /usr/bin/xattr -cr /tmp/DeskFolder-sign.app 2>/dev/null || true
  /usr/bin/codesign --force --deep --sign - /tmp/DeskFolder-sign.app
  /usr/bin/codesign --verify --deep --strict /tmp/DeskFolder-sign.app
  cp -f /tmp/DeskFolder-sign.app/Contents/MacOS/DeskFolder "$BUILT_APP/Contents/MacOS/DeskFolder"
  cp -Rf /tmp/DeskFolder-sign.app/Contents/_CodeSignature "$BUILT_APP/Contents/"
  rm -rf /tmp/DeskFolder-sign.app
fi

echo "3. Verifying existing canonical DMG checksums with macOS hdiutil verify..."
/usr/bin/hdiutil verify "$CANONICAL_DMG"

echo "================================================================"
echo "✅ Updated Existing Canonical DMG In-Place: $CANONICAL_DMG"
echo "================================================================"
