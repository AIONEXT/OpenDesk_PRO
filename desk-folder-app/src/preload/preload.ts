import { contextBridge, ipcRenderer } from 'electron'

const activeChannelHandlers = new Map<string, (...args: any[]) => void>()

/**
 * Registers an IPC listener safely without wiping unrelated listeners,
 * replacing only the previous bridge handler for that channel and returning an unsubscribe callback.
 */
function listenChannel(channel: string, callback: (...args: any[]) => void): () => void {
  const prevHandler = activeChannelHandlers.get(channel)
  if (prevHandler) {
    ipcRenderer.removeListener(channel, prevHandler)
  }
  const handler = (_: any, ...args: any[]) => callback(...args)
  activeChannelHandlers.set(channel, handler)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
    if (activeChannelHandlers.get(channel) === handler) {
      activeChannelHandlers.delete(channel)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Edge Sensor Secure Bridge (for contextIsolation: true sensorWindow)
  sensorTriggerPull: () => ipcRenderer.send('sensor-two-finger-pull'),
  sensorPassThroughClick: () => ipcRenderer.send('sensor-pass-through-click'),

  // Settings, OS Theme & Diagnostics
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  resetDefaultSettings: () => ipcRenderer.invoke('reset-default-settings'),
  seedDefaultContent: () => ipcRenderer.invoke('seed-default-content'),
  getSystemDiagnostics: () => ipcRenderer.invoke('get-system-diagnostics'),
  getLoginItem: () => ipcRenderer.invoke('get-login-item'),
  setLoginItem: (openAtLogin: boolean) => ipcRenderer.invoke('set-login-item', openAtLogin),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  getOSAccentColor: () => ipcRenderer.invoke('get-os-accent-color'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectNotesFolder: () => ipcRenderer.invoke('select-notes-folder'),
  getSystemFolders: () => ipcRenderer.invoke('get-system-folders'),
  togglePin: (pinned: boolean) => ipcRenderer.invoke('toggle-pin', pinned),
  hideWindow: () => ipcRenderer.invoke('hide-window'),

  // 15-Day Commercial Trial, QR/One-Time URL Checkout, Email Auth Credentials & OTT Certificate Engine
  licenseGetStatus: () => ipcRenderer.invoke('license-get-status'),
  licenseActivate: (payload: { licenseKey: string; licensedTo?: string; customerEmail?: string }) =>
    ipcRenderer.invoke('license-activate', payload),
  licenseCreatePaymentSession: (payload: {
    tier?: 'PRO' | 'ENT'
    customerEmail: string
    customerName?: string
  }) => ipcRenderer.invoke('license-create-payment-session', payload),
  licenseCompleteCheckout: (payload: {
    tier: 'PRO' | 'ENT'
    customerName?: string
    customerEmail?: string
    paymentMethod?: string
  }) => ipcRenderer.invoke('license-complete-checkout', payload),
  licenseGenerateKey: (payload?: { tier?: 'PRO' | 'ENT'; seed?: string }) =>
    ipcRenderer.invoke('license-generate-key', payload),
  licenseSimulateTrial: (payload: { mode: 'expire_now' | 'reset_trial' | 'deactivate' }) =>
    ipcRenderer.invoke('license-simulate-trial', payload),

  // Full-Workspace Encrypted Security Lockscreen (⌘+L / Master PIN)
  securityGetStatus: () => ipcRenderer.invoke('security-get-status'),
  securityLockApp: () => ipcRenderer.invoke('security-lock-app'),
  securityUnlockApp: (payload?: { pin?: string }) => ipcRenderer.invoke('security-unlock-app', payload),
  securitySetPin: (payload: { newPin: string; currentPin?: string }) =>
    ipcRenderer.invoke('security-set-pin', payload),

  // Best-in-Class Flagship Security Utilities & Unified OpenDesk Security Packet
  generateCsprngSecret: (payload?: {
    mode?: 'password' | 'passphrase' | 'apikey' | 'hex256'
    length?: number
  }) => ipcRenderer.invoke('generate-csprng-secret', payload),
  secureShredFile: (filePath: string) => ipcRenderer.invoke('secure-shred-file', filePath),
  scanWorkspaceSecrets: (dirPath?: string) => ipcRenderer.invoke('scan-workspace-secrets', dirPath),
  exportEncryptedSnapshot: (payload?: { passphrase?: string }) =>
    ipcRenderer.invoke('export-encrypted-snapshot', payload),
  listEncryptedSnapshots: () => ipcRenderer.invoke('list-encrypted-snapshots'),
  recallEncryptedSnapshot: (payload?: { backupPath?: string; passphrase?: string }) =>
    ipcRenderer.invoke('recall-encrypted-snapshot', payload),
  recallCommercialLicense: (payload?: { tier?: 'PRO' | 'ENT'; licensedTo?: string }) =>
    ipcRenderer.invoke('recall-commercial-license', payload),
  getWorkspaceRecall: () => ipcRenderer.invoke('get-workspace-recall'),
  makeSentencesAndSpellcheck: (payload: {
    text: string
    mode?: 'sentences' | 'bullets' | 'executive' | 'spell-only'
  }) => ipcRenderer.invoke('make-sentences-and-spellcheck', payload),
  detectIntegrations: () => ipcRenderer.invoke('detect-integrations'),
  triggerAppIntegration: (payload: { integrationId: string; targetPath?: string; noteName?: string }) =>
    ipcRenderer.invoke('trigger-app-integration', payload),
  getUnifiedSecurityPacket: () => ipcRenderer.invoke('get-unified-security-packet'),
  sealTextPacket: (payload: { text: string; passphrase?: string }) =>
    ipcRenderer.invoke('seal-text-packet', payload),
  unsealTextPacket: (payload: { packet: string; passphrase?: string }) =>
    ipcRenderer.invoke('unseal-text-packet', payload),
  vaultAndRedactLeak: (payload: { filePath: string; rawSecret: string; category?: string; line?: number }) =>
    ipcRenderer.invoke('vault-and-redact-leak', payload),

  // Enterprise Dedicated Vault (AES-256-GCM + PBKDF2-HMAC-SHA512) & Strict Privacy Shield
  vaultGetStatus: () => ipcRenderer.invoke('vault-get-status'),
  vaultInitialize: (payload?: { passphrase?: string }) => ipcRenderer.invoke('vault-initialize', payload),
  vaultUnlock: (payload?: { passphrase?: string; useHardwareSeal?: boolean }) =>
    ipcRenderer.invoke('vault-unlock', payload),
  vaultLock: () => ipcRenderer.invoke('vault-lock'),
  vaultSaveItem: (payload: {
    id?: string
    title: string
    category: 'secret' | 'note' | 'key' | 'token'
    content: string
    username?: string
    url?: string
    tags?: string[]
  }) => ipcRenderer.invoke('vault-save-item', payload),
  vaultDeleteItem: (itemId: string) => ipcRenderer.invoke('vault-delete-item', itemId),
  vaultEncryptFile: (payload: { filePath: string; removeOriginal?: boolean }) =>
    ipcRenderer.invoke('vault-encrypt-file', payload),
  vaultDecryptFile: (payload: { encryptedFilePath: string; targetDir?: string }) =>
    ipcRenderer.invoke('vault-decrypt-file', payload),
  vaultChangePassphrase: (payload: { currentPassphrase?: string; newPassphrase: string }) =>
    ipcRenderer.invoke('vault-change-passphrase', payload),
  getPrivacyAudit: () => ipcRenderer.invoke('get-privacy-audit'),
  redactSensitiveText: (text: string) => ipcRenderer.invoke('redact-sensitive-text', text),
  panicWipePrivacy: () => ipcRenderer.invoke('panic-wipe-privacy'),
  pollClipboardChange: () => ipcRenderer.invoke('poll-clipboard-change'),

  // AI Hub Handlers
  aiCheckLocalModels: (payload: { ollamaUrl?: string; lmstudioUrl?: string; omnirouteUrl?: string }) =>
    ipcRenderer.invoke('ai-check-local-models', payload),
  aiChatCompletion: (payload: {
    prompt: string
    contextText?: string
    attachments?: { label: string; content: string }[]
    customConfig?: any
  }) => ipcRenderer.invoke('ai-chat-completion', payload),
  aiOrganizeFolder: (dirPath?: string) => ipcRenderer.invoke('ai-organize-folder', dirPath),

  // File System & Batch Shelf Handlers
  readDirectory: (path?: string) => ipcRenderer.invoke('read-directory', path),
  getFolderStats: (dirPath?: string) => ipcRenderer.invoke('get-folder-stats', dirPath),
  createFolder: (folderPath: string) => ipcRenderer.invoke('create-folder', folderPath),
  createFile: (payload: { filePath: string; content?: string }) => ipcRenderer.invoke('create-file', payload),
  saveFileContent: (payload: { filePath: string; content: string }) =>
    ipcRenderer.invoke('save-file-content', payload),
  renameItem: (payload: { oldPath: string; newPath: string }) => ipcRenderer.invoke('rename-item', payload),
  duplicateItem: (itemPath: string) => ipcRenderer.invoke('duplicate-item', itemPath),
  archiveItem: (itemPath: string) => ipcRenderer.invoke('archive-item', itemPath),
  batchArchiveItems: (payload: { itemPaths: string[]; targetDir?: string; archiveName?: string }) =>
    ipcRenderer.invoke('batch-archive-items', payload),
  batchMoveItems: (payload: { itemPaths: string[]; targetDir: string; copyOnly?: boolean }) =>
    ipcRenderer.invoke('batch-move-items', payload),
  batchDeleteItems: (payload: { itemPaths: string[] }) =>
    ipcRenderer.invoke('batch-delete-items', payload),
  createSymlink: (payload: { targetPath: string; linkName?: string }) =>
    ipcRenderer.invoke('create-symlink', payload),
  deleteItem: (itemPath: string) => ipcRenderer.invoke('delete-item', itemPath),
  toggleFileLock: (filePath: string) => ipcRenderer.invoke('toggle-file-lock', filePath),
  openItem: (itemPath: string) => ipcRenderer.invoke('open-item', itemPath),
  openTerminal: (dirPath?: string) => ipcRenderer.invoke('open-terminal', dirPath),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  saveClipboardImageToFile: (payload: { dataUrl: string; fileName?: string; targetDir?: string }) =>
    ipcRenderer.invoke('save-clipboard-image-to-file', payload),
  showInFolder: (itemPath: string) => ipcRenderer.invoke('show-in-folder', itemPath),
  readFileContent: (filePath: string) => ipcRenderer.invoke('read-file-content', filePath),
  stageDroppedFiles: (payload: { sourcePaths: string[]; targetDir?: string }) =>
    ipcRenderer.invoke('stage-dropped-files', payload),
  exportFileDialog: (payload: { defaultName: string; content: string; filters?: any[] }) =>
    ipcRenderer.invoke('export-file-dialog', payload),
  startNativeDrag: (filePath: string) => ipcRenderer.invoke('start-native-drag', filePath),
  pasteAndHide: (payload: { type: 'text' | 'image'; content: string }) =>
    ipcRenderer.invoke('paste-and-hide', payload),
  scanDuplicateFiles: (dirPath?: string) => ipcRenderer.invoke('scan-duplicate-files', dirPath),
  removeDuplicateFiles: (dirPath?: string) => ipcRenderer.invoke('remove-duplicate-files', dirPath),

  // Clipboard & Power Transforms Handlers
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  getClipboardImage: () => ipcRenderer.invoke('get-clipboard-image'),
  writeClipboardText: (text: string) => ipcRenderer.invoke('write-clipboard-text', text),
  writeClipboardImage: (dataUrl: string) => ipcRenderer.invoke('write-clipboard-image', dataUrl),
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  saveClipboardHistory: (history: any[]) => ipcRenderer.invoke('save-clipboard-history', history),
  transformClipboardText: (payload: { text: string; mode: string }) =>
    ipcRenderer.invoke('transform-clipboard-text', payload),

  // Notes Handlers
  getNotes: (customFolder?: string) => ipcRenderer.invoke('get-notes', customFolder),
  saveNote: (payload: { name: string; content: string; customFolder?: string }) =>
    ipcRenderer.invoke('save-note', payload),
  renameNote: (payload: { oldName: string; newName: string; customFolder?: string }) =>
    ipcRenderer.invoke('rename-note', payload),
  deleteNote: (payload: { name: string; customFolder?: string }) => ipcRenderer.invoke('delete-note', payload),
  toggleNoteLock: (noteName: string) => ipcRenderer.invoke('toggle-note-lock', noteName),

  // Event Listeners (with cleanup unsubscribe support)
  onFolderChanged: (callback: (path: string) => void) => listenChannel('folder-changed', callback),
  onFolderContentsChanged: (callback: (event: any) => void) => listenChannel('folder-contents-changed', callback),
  onNotesFolderChanged: (callback: (event: any) => void) => listenChannel('notes-folder-changed', callback),
  onPinChanged: (callback: (pinned: boolean) => void) => listenChannel('pin-changed', callback),
  onSettingsUpdated: (callback: (settings: any) => void) => listenChannel('settings-updated', callback),
  onSystemThemeUpdated: (callback: (sysTheme: 'dark' | 'light') => void) =>
    listenChannel('system-theme-updated', callback),
  onOSAccentUpdated: (callback: (hex: string) => void) => listenChannel('os-accent-updated', callback),
  onTriggerNewNote: (callback: () => void) => listenChannel('trigger-new-note', callback),
  onTriggerClearClipboard: (callback: () => void) => listenChannel('trigger-clear-clipboard', callback),
  onTriggerCommandPalette: (callback: () => void) => listenChannel('trigger-command-palette', callback),
  onVaultStatusChanged: (callback: (status: any) => void) => listenChannel('vault-status-changed', callback),
  onSecurityLockChanged: (callback: (status: { isAppLocked: boolean }) => void) =>
    listenChannel('security-lock-changed', callback),
  onLicenseStatusChanged: (callback: (status: any) => void) =>
    listenChannel('license-status-changed', callback),
  onClipboardChanged: (callback: (payload: { changed: boolean; type: 'text' | 'image'; content: string }) => void) =>
    listenChannel('clipboard-changed', callback),
  onAIStreamChunk: (callback: (payload: { requestId?: string; chunk: string; done?: boolean }) => void) =>
    listenChannel('ai-stream-chunk', callback),
})
