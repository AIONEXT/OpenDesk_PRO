#!/bin/bash
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

APP_DIR="/Users/aio_x/Documents/Mac DeskFolder/desk-folder-app"
WORKSPACE_DIR="/Users/aio_x/Documents/Mac DeskFolder"
NOTES_DIR="$WORKSPACE_DIR/Notes"
USER_DATA_DIR="$HOME/Library/Application Support/DeskFolder"
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENT_DIR/com.deskfolder.app.plist"

echo "========================================================"
echo " 🚀 OpenDesk PRO v3.1 Auto-Start & Default Seeder"
echo "========================================================"

# 1. Stop any running instances cleanly
launchctl unload "$PLIST_PATH" 2>/dev/null || true
killall DeskFolder 2>/dev/null || true
killall Electron 2>/dev/null || true

# 2. Ensure Workspace, Notes & Default Starter Content exist
mkdir -p "$WORKSPACE_DIR/Work"
mkdir -p "$NOTES_DIR"
mkdir -p "$USER_DATA_DIR"
mkdir -p "$LAUNCH_AGENT_DIR"

if [ ! -f "$WORKSPACE_DIR/Readme.txt" ]; then
cat << 'TXT' > "$WORKSPACE_DIR/Readme.txt"
Welcome to OpenDesk PRO v3.1 Dropzone!
--------------------------------------
• Drag & drop files here for temporary staging or drag them back out to Desktop/Finder.
• Double-click any file to open it in its default macOS app.
• Click the Eye icon for instant Quick Look preview with SHA-256 & line/word metrics.
• Use the AI Studio button or ⌘K Omni-Search to summarize or auto-organize files.
TXT
fi

if [ ! -f "$NOTES_DIR/Welcome.md" ]; then
cat << 'MD' > "$NOTES_DIR/Welcome.md"
# Welcome to OpenDesk PRO v3.1

Use this notepad for quick notes, code snippets, Markdown tables, and daily tasks with Auto Spelling Correction & ✨ Sentence Maker.

### Quick Tasks
- [x] Seed default starter content & v3.1 settings
- [x] Enable macOS LaunchAgent auto-start
- [ ] Try two-finger pull-down from top of screen
- [ ] Press ⌘K to launch Global Command Palette & Omni-Search

#welcome #productivity
MD
fi

# 3. Seed Default v3.1 Settings & Sample Clipboard Clips if missing
cat << 'NODE_SEED' | node
const fs = require('fs');
const path = require('path');
const os = require('os');

const userData = path.join(os.homedir(), 'Library', 'Application Support', 'DeskFolder');
const settingsFile = path.join(userData, 'desk-folder-settings.json');
const clipsFile = path.join(userData, 'clipboard-history.json');
const defaultFolder = path.join(os.homedir(), 'Documents', 'Mac DeskFolder');
const defaultNotes = path.join(defaultFolder, 'Notes');

const defaultSettings = {
  currentPath: defaultFolder,
  notesPath: defaultNotes,
  layoutMode: 'split3',
  theme: 'liquid',
  liquidGlassIntensity: 55,
  glassTintBlurEnabled: true,
  dualLightPreset: 'beige-orange',
  autoSpellCorrectEnabled: true,
  sentenceMakerMode: 'sentences',
  accentColor: 'multicolor',
  iconStyle: 'default',
  folderColor: 'automatic',
  sortBy: 'name',
  sortDirection: 'asc',
  viewMode: 'grid',
  clipboardLength: 100,
  filteredApps: ['1Password', 'Keychain Access', 'Bitwarden'],
  trackingEnabled: true,
  twoFingerPullEnabled: true,
  showThemeLine: false,
  isPinned: false,
  lockedFiles: [],
  lockedNotes: [],
  paneWidths: [28, 40, 32],
  shelfPaths: [],
  aiConfig: {
    provider: 'builtin',
    model: 'deskfolder-pro-v3',
    ollamaUrl: 'http://127.0.0.1:11434',
    lmstudioUrl: 'http://127.0.0.1:1234',
    omnirouteUrl: 'http://127.0.0.1:20128/v1',
    openrouterKey: '',
    nvidiaKey: '',
    omnirouteKey: '',
    groqKey: '',
    geminiKey: '',
    systemPrompt: "You are OpenDesk PRO AI v3.1, an enterprise-grade macOS workspace assistant integrated into the user's Clipboard, Files, Staging Shelf, and Notes drawer. Provide concise, directly usable responses."
  }
};

let currentSettings = {};
if (fs.existsSync(settingsFile)) {
  try { currentSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch {}
}
const mergedSettings = { ...defaultSettings, ...currentSettings };
fs.writeFileSync(settingsFile, JSON.stringify(mergedSettings, null, 2));

let currentClips = [];
if (fs.existsSync(clipsFile)) {
  try { currentClips = JSON.parse(fs.readFileSync(clipsFile, 'utf8')); } catch {}
}
if (!Array.isArray(currentClips) || currentClips.length === 0) {
  const now = new Date().toISOString();
  const sampleClips = [
    {
      id: 'sample-clip-1',
      content: 'OpenDesk PRO v3.1 Shortcut Guide: Pull down with 2 fingers at the top edge, press ⌘+Shift+D to toggle the drawer, or press ⌘+K inside OpenDesk PRO for the Global Command Palette.',
      type: 'text',
      format: 'plain',
      timestamp: now,
      isFavorite: true,
      sourceApp: 'OpenDesk PRO'
    },
    {
      id: 'sample-clip-2',
      content: '#007aff',
      type: 'text',
      format: 'plain',
      timestamp: now,
      isFavorite: true,
      sourceApp: 'Design'
    }
  ];
  fs.writeFileSync(clipsFile, JSON.stringify(sampleClips, null, 2));
}
console.log('✓ Default OpenDesk PRO v3.1 settings and starter clipboard items verified.');
NODE_SEED

# 4. Build Production Bundle, Canonical DMG & Standalone App
cd "$APP_DIR"
bash "$APP_DIR/build-macos-dmg.sh"

# 5. Copy to /Applications if writable and remove quarantine attributes
APP_SRC="$APP_DIR/release/DeskFolder.app"
if [ -d "$APP_SRC" ]; then
  if [ -w "/Applications" ]; then
    rm -rf "/Applications/DeskFolder.app"
    cp -R "$APP_SRC" "/Applications/DeskFolder.app"
    echo "✓ Installed OpenDesk PRO to /Applications/DeskFolder.app"
  else
    echo "ℹ️ /Applications is not writable in sandbox; using $APP_SRC"
  fi
else
  echo "⚠️ Packaged .app not found at $APP_SRC"
  exit 1
fi

TARGET_BIN="/Applications/DeskFolder.app/Contents/MacOS/DeskFolder"
if [ ! -f "$TARGET_BIN" ]; then
  TARGET_BIN="$APP_SRC/Contents/MacOS/DeskFolder"
fi

# 6. Create & Load macOS LaunchAgent for Automatic Background Startup
cat << PLIST > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.deskfolder.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>$TARGET_BIN</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ProcessType</key>
    <string>Interactive</string>
    <key>StandardOutPath</key>
    <string>/tmp/deskfolder.out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/deskfolder.err.log</string>
</dict>
</plist>
PLIST

chmod 644 "$PLIST_PATH"
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH" 2>/dev/null || true

echo "========================================================"
echo " ✅ OpenDesk PRO v3.1 is ready!"
echo " • App Bundle: $APP_SRC"
echo " • DMG Image:  $WORKSPACE_DIR/DeskFolder-3.1.0.dmg"
echo " • Shortcut:   Cmd + Shift + D (or two-finger pull-down at top)"
echo "========================================================"
