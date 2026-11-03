import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import {
  formatBytes,
  hexToRgba,
  detectColorSwatch,
  detectTextFormat,
  sanitizeApiKeyInput,
} from './utils/formatters'
import { OpenDeskBrandIcon, MacOSFolderIcon } from './components/BrandIcons'

// --- TYPE DEFINITIONS ---
interface FileItem {
  name: string
  isDirectory: boolean
  path: string
  extension: string
  size: number
  modified: string | Date
  isSymLink?: boolean
}

interface NoteItem {
  name: string
  content: string
  path: string
  modified: string | Date
  size?: number
}

interface ClipboardEntry {
  id: string
  type: 'text' | 'image'
  content: string
  format?: 'plain' | 'code' | 'url' | 'email' | 'image'
  timestamp: string | Date
  isFavorite?: boolean
  sourceApp?: string
}

interface FolderStats {
  totalSize: number
  fileCount: number
  folderCount: number
}

type AIProviderId =
  | 'builtin'
  | 'freecloud'
  | 'openrouter'
  | 'nvidia'
  | 'omniroute'
  | 'groq'
  | 'gemini'
  | 'cerebras'
  | 'sambanova'
  | 'github'
  | 'huggingface'
  | 'mistral'
  | 'ollama'
  | 'lmstudio'

interface AIConfig {
  provider: AIProviderId
  model: string
  ollamaUrl: string
  lmstudioUrl: string
  omnirouteUrl: string
  openrouterKey: string
  nvidiaKey: string
  omnirouteKey: string
  groqKey: string
  geminiKey: string
  cerebrasKey?: string
  sambanovaKey?: string
  githubKey?: string
  huggingfaceKey?: string
  mistralKey?: string
  systemPrompt: string
}

type ThemeMode =
  | 'auto'
  | 'liquid'
  | 'solid'
  | 'aurora'
  | 'nord'
  | 'solarized'
  | 'obsidian'
  | 'light'
  | 'dark'

type AccentColorId =
  | 'multicolor'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'graphite'

type IconWidgetStyle = 'default' | 'dark' | 'clear' | 'tinted'

interface QuickTaskItem {
  id: string
  text: string
  done: boolean
}

interface CustomPromptPreset {
  id: string
  label: string
  prompt: string
}

interface AIAttachment {
  id: string
  label: string
  content: string
}

interface VaultItem {
  id: string
  title: string
  category: 'secret' | 'note' | 'key' | 'token'
  content: string
  username?: string
  url?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

interface EncryptedVaultFileInfo {
  name: string
  path: string
  originalName: string
  originalSize: number
  sha256: string
  encryptedAt: string
}

interface AppSettings {
  currentPath: string
  notesPath?: string
  vaultPath?: string
  layoutMode: 'split3' | 'split4' | 'tabbed'
  theme: ThemeMode
  liquidGlassIntensity: number
  glassTintBlurEnabled?: boolean
  dualLightPreset?: string
  solidBgHex?: string
  autoSpellCorrectEnabled?: boolean
  sentenceMakerMode?: 'sentences' | 'bullets' | 'executive'
  integrationsConfig?: Record<string, boolean>
  customIntegrationWebhook?: string
  accentColor: AccentColorId
  iconStyle: IconWidgetStyle
  folderColor: 'automatic' | AccentColorId
  sortBy: 'name' | 'date' | 'size' | 'type'
  sortDirection: 'asc' | 'desc'
  viewMode: 'grid' | 'list'
  clipboardLength: number
  filteredApps: string[]
  trackingEnabled: boolean
  twoFingerPullEnabled: boolean
  showThemeLine: boolean
  isPinned?: boolean
  lockedFiles?: string[]
  lockedNotes?: string[]
  paneWidths?: number[]
  shelfPaths?: string[]
  quickTasks?: QuickTaskItem[]
  customPrompts?: CustomPromptPreset[]
  strictPrivacyMode?: boolean
  piiRedactionEnabled?: boolean
  sensitiveClipboardGuard?: boolean
  clipboardRetentionMinutes?: number
  vaultAutoLockOnHide?: boolean
  vaultAutoLockMinutes?: number
  aiConfig: AIConfig
}

interface PreviewItemData {
  name: string
  path: string
  type: 'image' | 'markdown' | 'text' | 'large'
  content: string
  size: number
  modified: string | Date
  extension?: string
  linesCount?: number
  wordsCount?: number
  sha256?: string
}

interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
  provider?: string
  model?: string
  latencyMs?: number
}

interface ElectronAPI {
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<{ success: boolean }>
  resetDefaultSettings: () => Promise<AppSettings>
  seedDefaultContent: () => Promise<{ success: boolean }>
  getSystemDiagnostics: () => Promise<any>
  getSystemTheme: () => Promise<'dark' | 'light'>
  getOSAccentColor: () => Promise<string>
  selectFolder: () => Promise<string | null>
  selectNotesFolder: () => Promise<string | null>
  getSystemFolders: () => Promise<Record<string, string>>
  togglePin: (pinned: boolean) => Promise<{ success: boolean; isPinned: boolean }>
  hideWindow: () => Promise<{ success: boolean }>
  vaultGetStatus?: () => Promise<{
    initialized: boolean
    unlocked: boolean
    hasCustomPassphrase?: boolean
    vaultPath: string
    itemCount: number
    encryptedFilesCount: number
    encryptedFiles: EncryptedVaultFileInfo[]
    items: VaultItem[]
    cipher: string
    kdf: string
    autoLockOnHide: boolean
    autoLockMinutes: number
  }>
  vaultInitialize?: (payload?: { passphrase?: string }) => Promise<any>
  vaultUnlock?: (payload?: { passphrase?: string; useHardwareSeal?: boolean }) => Promise<{
    success: boolean
    unlocked?: boolean
    vaultPath?: string
    items?: VaultItem[]
    encryptedFiles?: EncryptedVaultFileInfo[]
    error?: string
  }>
  vaultLock?: () => Promise<{ success: boolean; unlocked: boolean }>
  vaultSaveItem?: (payload: {
    id?: string
    title: string
    category: 'secret' | 'note' | 'key' | 'token'
    content: string
    username?: string
    url?: string
    tags?: string[]
  }) => Promise<{ success: boolean; item: VaultItem; items: VaultItem[] }>
  vaultDeleteItem?: (itemId: string) => Promise<{ success: boolean; items: VaultItem[] }>
  vaultEncryptFile?: (payload: { filePath: string; removeOriginal?: boolean }) => Promise<{
    success: boolean
    encryptedFilePath: string
    sha256: string
    encryptedFiles: EncryptedVaultFileInfo[]
  }>
  vaultDecryptFile?: (payload: { encryptedFilePath: string; targetDir?: string }) => Promise<{
    success: boolean
    restoredPath: string
    sha256Verified: boolean
  }>
  vaultChangePassphrase?: (payload: { currentPassphrase?: string; newPassphrase: string }) => Promise<{
    success: boolean
    hasCustomPassphrase?: boolean
    error?: string
  }>
  getPrivacyAudit?: () => Promise<any>
  redactSensitiveText?: (text: string) => Promise<{
    redactedText: string
    redactionCount: number
    categories: string[]
  }>
  panicWipePrivacy?: () => Promise<{ success: boolean }>
  pollClipboardChange?: () => Promise<{
    changed: boolean
    type?: 'text' | 'image'
    content?: string
    blockedSensitive?: boolean
  }>
  licenseGetStatus?: () => Promise<{
    isActivated: boolean
    licenseTier: string
    licenseKeyMasked: string
    licensedTo: string
    trialDaysTotal: number
    trialDaysRemaining: number
    trialHoursRemaining: number
    isTrialExpired: boolean
    clockTamperDetected: boolean
    firstLaunchAt: string
    masterDemoKey: string
  }>
  licenseActivate?: (payload: { licenseKey: string; licensedTo?: string }) => Promise<{
    success: boolean
    status?: any
    error?: string
  }>
  licenseCompleteCheckout?: (payload: {
    tier: 'PRO' | 'ENT'
    customerName?: string
    customerEmail?: string
    paymentMethod?: string
  }) => Promise<{
    success: boolean
    licenseKey: string
    amountUsd: number
    receiptPath: string
    status: any
  }>
  licenseGenerateKey?: (payload?: { tier?: 'PRO' | 'ENT'; seed?: string }) => Promise<{
    success: boolean
    licenseKey: string
  }>
  licenseSimulateTrial?: (payload: { mode: 'expire_now' | 'reset_trial' | 'deactivate' }) => Promise<{
    success: boolean
    status: any
  }>
  securityGetStatus?: () => Promise<{
    isAppLocked: boolean
    hasCustomPin: boolean
    failedAttempts: number
    lockoutUntil: number
    cipher: string
  }>
  securityLockApp?: () => Promise<{ success: boolean; isAppLocked: boolean }>
  securityUnlockApp?: (payload?: { pin?: string }) => Promise<{
    success: boolean
    isAppLocked?: boolean
    error?: string
  }>
  securitySetPin?: (payload: { newPin: string; currentPin?: string }) => Promise<{
    success: boolean
    hasCustomPin?: boolean
    error?: string
  }>
  generateCsprngSecret?: (payload?: {
    mode?: 'password' | 'passphrase' | 'apikey' | 'hex256'
    length?: number
  }) => Promise<{
    success: boolean
    secret: string
    entropyBits: number
    strengthLabel: string
    mode: string
  }>
  secureShredFile?: (filePath: string) => Promise<{
    success: boolean
    passes: number
    bytesShredded: number
  }>
  scanWorkspaceSecrets?: (dirPath?: string) => Promise<{
    success: boolean
    scannedFilesCount: number
    findings: {
      id: string
      fileName: string
      filePath: string
      line: number
      category: string
      maskedPreview: string
      rawSecret: string
    }[]
  }>
  exportEncryptedSnapshot?: (payload?: { passphrase?: string }) => Promise<{
    success: boolean
    backupPath: string
    fileName: string
    notesCount: number
  }>
  listEncryptedSnapshots?: () => Promise<{
    success: boolean
    snapshots: { fileName: string; path: string; size: number; modifiedAt: string }[]
  }>
  recallEncryptedSnapshot?: (payload?: { backupPath?: string; passphrase?: string }) => Promise<{
    success: boolean
    backupPath?: string
    fileName?: string
    exportedAt?: string
    restoredNotesCount?: number
    restoredTasksCount?: number
    restoredVaultItemsCount?: number
    error?: string
  }>
  recallCommercialLicense?: (payload?: { tier?: 'PRO' | 'ENT'; licensedTo?: string }) => Promise<{
    success: boolean
    recalledFromReceipt: boolean
    licenseKey: string
    licenseTier: string
    licensedTo: string
    receiptPath: string
    status: any
  }>
  getWorkspaceRecall?: () => Promise<any>
  makeSentencesAndSpellcheck?: (payload: {
    text: string
    mode?: 'sentences' | 'bullets' | 'executive' | 'spell-only'
  }) => Promise<{
    success: boolean
    correctedText: string
    correctionsCount: number
    correctionsMade: string[]
    sentencesCount: number
    mode: string
  }>
  detectIntegrations?: () => Promise<{
    success: boolean
    integrations: {
      id: string
      name: string
      type: 'app' | 'package'
      icon: string
      desc: string
      installed: boolean
      enabled: boolean
    }[]
    customWebhook: string
  }>
  triggerAppIntegration?: (payload: {
    integrationId: string
    targetPath?: string
    noteName?: string
  }) => Promise<{
    success: boolean
    integrationId: string
    message: string
    manifestPath?: string
  }>
  getUnifiedSecurityPacket?: () => Promise<any>
  sealTextPacket?: (payload: { text: string; passphrase?: string }) => Promise<{
    success: boolean
    packet: string
    cipher: string
    kdf: string
  }>
  unsealTextPacket?: (payload: { packet: string; passphrase?: string }) => Promise<{
    success: boolean
    plainText?: string
    error?: string
  }>
  vaultAndRedactLeak?: (payload: {
    filePath: string
    rawSecret: string
    category?: string
    line?: number
  }) => Promise<{
    success: boolean
    vaultedItem: VaultItem
    items: VaultItem[]
    redactedFilePath: string
  }>
  onVaultStatusChanged?: (callback: (status: { unlocked: boolean }) => void) => void
  onSecurityLockChanged?: (callback: (status: { isAppLocked: boolean }) => void) => void
  onLicenseStatusChanged?: (callback: (status: any) => void) => void
  aiCheckLocalModels: (payload: { ollamaUrl?: string; lmstudioUrl?: string; omnirouteUrl?: string }) => Promise<{
    ollamaOnline: boolean
    ollamaModels: string[]
    lmstudioOnline: boolean
    lmstudioModels: string[]
    omnirouteOnline?: boolean
    omnirouteModels?: string[]
  }>
  aiChatCompletion: (payload: {
    prompt: string
    contextText?: string
    attachments?: { label: string; content: string }[]
    customConfig?: Partial<AIConfig>
  }) => Promise<{ success: boolean; text?: string; error?: string; model?: string }>
  aiOrganizeFolder: (dirPath?: string) => Promise<{ movedCount: number; summary: string }>
  readDirectory: (path?: string) => Promise<FileItem[]>
  getFolderStats: (dirPath?: string) => Promise<FolderStats>
  createFolder: (folderPath: string) => Promise<{ success: boolean }>
  createFile: (payload: { filePath: string; content?: string }) => Promise<{ success: boolean }>
  saveFileContent: (payload: { filePath: string; content: string }) => Promise<{ success: boolean }>
  renameItem: (payload: { oldPath: string; newPath: string }) => Promise<{ success: boolean }>
  duplicateItem: (itemPath: string) => Promise<{ success: boolean; newPath?: string }>
  archiveItem: (itemPath: string) => Promise<{ success: boolean; zipPath?: string }>
  batchArchiveItems: (payload: {
    itemPaths: string[]
    targetDir?: string
    archiveName?: string
  }) => Promise<{ success: boolean; zipPath?: string; count: number }>
  batchMoveItems: (payload: {
    itemPaths: string[]
    targetDir: string
    copyOnly?: boolean
  }) => Promise<{ success: boolean; count: number }>
  batchDeleteItems: (payload: {
    itemPaths: string[]
  }) => Promise<{ success: boolean; deleted: number; skippedLocked: number }>
  createSymlink: (payload: { targetPath: string; linkName?: string }) => Promise<{ success: boolean; symlinkPath?: string }>
  deleteItem: (itemPath: string) => Promise<{ success: boolean }>
  toggleFileLock: (filePath: string) => Promise<{ success: boolean; locked: boolean }>
  toggleNoteLock: (noteName: string) => Promise<{ success: boolean; locked: boolean }>
  openItem: (itemPath: string) => Promise<{ success: boolean }>
  openTerminal: (dirPath?: string) => Promise<{ success: boolean }>
  openExternalUrl: (url: string) => Promise<{ success: boolean }>
  saveClipboardImageToFile: (payload: { dataUrl: string; fileName?: string; targetDir?: string }) => Promise<{ success: boolean; filePath?: string }>
  showInFolder: (itemPath: string) => Promise<{ success: boolean }>
  readFileContent: (filePath: string) => Promise<PreviewItemData>
  stageDroppedFiles: (payload: { sourcePaths: string[]; targetDir?: string }) => Promise<any[]>
  exportFileDialog: (payload: { defaultName: string; content: string; filters?: any[] }) => Promise<{ success: boolean; path?: string }>
  startNativeDrag: (filePath: string) => Promise<{ success: boolean }>
  pasteAndHide: (payload: { type: 'text' | 'image'; content: string }) => Promise<{ success: boolean }>
  scanDuplicateFiles: (dirPath?: string) => Promise<{
    duplicateGroups: { hash: string; size: number; keepPath: string; duplicates: { path: string; name: string; size: number }[] }[]
    totalDuplicateFiles: number
    reclaimableBytes: number
  }>
  removeDuplicateFiles: (dirPath?: string) => Promise<{
    removedCount: number
    reclaimedBytes: number
    removedPaths: string[]
    keptCount?: number
  }>
  getClipboardText: () => Promise<string>
  getClipboardImage: () => Promise<string | null>
  writeClipboardText: (text: string) => Promise<{ success: boolean }>
  writeClipboardImage: (dataUrl: string) => Promise<{ success: boolean }>
  getClipboardHistory: () => Promise<ClipboardEntry[]>
  saveClipboardHistory: (history: ClipboardEntry[]) => Promise<{ success: boolean }>
  transformClipboardText: (payload: { text: string; mode: string }) => Promise<{
    success: boolean
    result: string
    error?: string
  }>
  getNotes: (customFolder?: string) => Promise<NoteItem[]>
  saveNote: (payload: { name: string; content: string; customFolder?: string }) => Promise<{ success: boolean; path?: string; fileName?: string }>
  renameNote: (payload: { oldName: string; newName: string; customFolder?: string }) => Promise<{ success: boolean; fileName?: string; path?: string }>
  deleteNote: (payload: { name: string; customFolder?: string }) => Promise<{ success: boolean }>
  onFolderChanged: (callback: (path: string) => void) => void
  onFolderContentsChanged: (callback: (event: { eventType: string; filename: string }) => void) => void
  onNotesFolderChanged: (callback: (event: { eventType: string; filename: string }) => void) => void
  onPinChanged: (callback: (pinned: boolean) => void) => void
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => void
  onSystemThemeUpdated: (callback: (sysTheme: 'dark' | 'light') => void) => void
  onOSAccentUpdated: (callback: (hex: string) => void) => void
  onTriggerNewNote: (callback: () => void) => void
  onTriggerClearClipboard: (callback: () => void) => void
  onTriggerCommandPalette: (callback: () => void) => void
  onAIStreamChunk: (callback: (payload: { chunk: string; done?: boolean }) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

const OS_THEME_COLORS: { id: AccentColorId; label: string; hex: string; cssBg: string }[] = [
  {
    id: 'multicolor',
    label: 'Multicolor',
    hex: '#007aff',
    cssBg: 'conic-gradient(from 180deg, #ff3b30, #ff9500, #ffcc00, #34c759, #007aff, #af52de, #ff2d55, #ff3b30)',
  },
  { id: 'blue', label: 'Blue', hex: '#007aff', cssBg: '#007aff' },
  { id: 'purple', label: 'Purple', hex: '#af52de', cssBg: '#af52de' },
  { id: 'pink', label: 'Pink', hex: '#ff2d55', cssBg: '#ff2d55' },
  { id: 'red', label: 'Red', hex: '#ff3b30', cssBg: '#ff3b30' },
  { id: 'orange', label: 'Orange', hex: '#ff9500', cssBg: '#ff9500' },
  { id: 'yellow', label: 'Yellow', hex: '#ffcc00', cssBg: '#ffcc00' },
  { id: 'green', label: 'Green', hex: '#34c759', cssBg: '#34c759' },
  { id: 'graphite', label: 'Graphite', hex: '#8e8e93', cssBg: '#8e8e93' },
]

const THEME_OPTIONS: { id: ThemeMode; label: string; shortLabel: string; previewBg: string; cardBg: string }[] = [
  {
    id: 'auto',
    label: 'Auto',
    shortLabel: 'Auto',
    previewBg: 'linear-gradient(90deg, #e2e8f0 0%, #e2e8f0 50%, #0f172a 50%, #0f172a 100%)',
    cardBg: 'linear-gradient(90deg, #ffffff 50%, #1e293b 50%)',
  },
  {
    id: 'liquid',
    label: 'Liquid Glass',
    shortLabel: 'Liquid Glass',
    previewBg: 'linear-gradient(135deg, rgba(56,189,248,0.55) 0%, rgba(37,99,235,0.45) 100%)',
    cardBg: 'rgba(255,255,255,0.28)',
  },
  {
    id: 'light',
    label: 'Dual Light',
    shortLabel: 'Light Dual',
    previewBg: 'linear-gradient(135deg, #FAF3E8 0%, #F5E6D3 52%, #EA580C 100%)',
    cardBg: '#FFFFFF',
  },
  {
    id: 'solid',
    label: 'Solid Colors',
    shortLabel: 'Solid',
    previewBg: '#0f172a',
    cardBg: '#1e293b',
  },
]

const DUAL_LIGHT_PRESETS: {
  id: string
  label: string
  shortLabel: string
  swatchBg: string
  primaryHex: string
  secondaryHex: string
  drawerBg: string
  headerBg: string
  subbarBg: string
  cardBg: string
  cardHoverBg: string
  inputBg: string
  modalBg: string
  pillBg: string
  pillHoverBg: string
  borderRgba: string
  borderSubtleRgba: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accentHex: string
}[] = [
  {
    id: 'beige-orange',
    label: 'Beige / Bridge & Orange',
    shortLabel: 'Beige·Orange',
    swatchBg: 'linear-gradient(135deg, #F5E6D3 0%, #F5E6D3 52%, #EA580C 52%, #EA580C 100%)',
    primaryHex: '#F5E6D3',
    secondaryHex: '#EA580C',
    drawerBg: 'linear-gradient(145deg, #FAF3E8 0%, #F2E4D1 55%, #FFF7ED 100%)',
    headerBg: 'linear-gradient(180deg, rgba(234, 88, 12, 0.15) 0%, rgba(255, 251, 245, 0.85) 100%)',
    subbarBg: 'rgba(234, 88, 12, 0.09)',
    cardBg: 'rgba(255, 252, 247, 0.92)',
    cardHoverBg: 'rgba(255, 255, 255, 0.99)',
    inputBg: 'rgba(255, 255, 255, 0.96)',
    modalBg: '#FCF7F0',
    pillBg: 'rgba(234, 88, 12, 0.11)',
    pillHoverBg: 'rgba(234, 88, 12, 0.21)',
    borderRgba: 'rgba(234, 88, 12, 0.30)',
    borderSubtleRgba: 'rgba(234, 88, 12, 0.16)',
    textPrimary: '#29180E',
    textSecondary: '#5C3A21',
    textMuted: '#8C5E3C',
    accentHex: '#EA580C',
  },
  {
    id: 'white-blue',
    label: 'White & Royal Blue',
    shortLabel: 'White·Blue',
    swatchBg: 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 52%, #2563EB 52%, #2563EB 100%)',
    primaryHex: '#FFFFFF',
    secondaryHex: '#2563EB',
    drawerBg: 'linear-gradient(145deg, #FFFFFF 0%, #EFF6FF 58%, #DBEAFE 100%)',
    headerBg: 'linear-gradient(180deg, rgba(37, 99, 235, 0.14) 0%, rgba(255, 255, 255, 0.88) 100%)',
    subbarBg: 'rgba(37, 99, 235, 0.08)',
    cardBg: 'rgba(255, 255, 255, 0.94)',
    cardHoverBg: '#FFFFFF',
    inputBg: '#FFFFFF',
    modalBg: '#F8FAFF',
    pillBg: 'rgba(37, 99, 235, 0.10)',
    pillHoverBg: 'rgba(37, 99, 235, 0.19)',
    borderRgba: 'rgba(37, 99, 235, 0.28)',
    borderSubtleRgba: 'rgba(37, 99, 235, 0.14)',
    textPrimary: '#0F172A',
    textSecondary: '#1E3A8A',
    textMuted: '#475569',
    accentHex: '#2563EB',
  },
  {
    id: 'ivory-emerald',
    label: 'Ivory & Emerald Green',
    shortLabel: 'Ivory·Emerald',
    swatchBg: 'linear-gradient(135deg, #FAFDF7 0%, #FAFDF7 52%, #059669 52%, #059669 100%)',
    primaryHex: '#FAFDF7',
    secondaryHex: '#059669',
    drawerBg: 'linear-gradient(145deg, #FCFDF9 0%, #ECFDF5 58%, #D1FAE5 100%)',
    headerBg: 'linear-gradient(180deg, rgba(5, 150, 105, 0.14) 0%, rgba(255, 255, 255, 0.85) 100%)',
    subbarBg: 'rgba(5, 150, 105, 0.08)',
    cardBg: 'rgba(255, 255, 255, 0.92)',
    cardHoverBg: '#FFFFFF',
    inputBg: '#FFFFFF',
    modalBg: '#F6FEF9',
    pillBg: 'rgba(5, 150, 105, 0.11)',
    pillHoverBg: 'rgba(5, 150, 105, 0.20)',
    borderRgba: 'rgba(5, 150, 105, 0.28)',
    borderSubtleRgba: 'rgba(5, 150, 105, 0.14)',
    textPrimary: '#062E22',
    textSecondary: '#065F46',
    textMuted: '#3F6256',
    accentHex: '#059669',
  },
  {
    id: 'pearl-coral',
    label: 'Pearl Blush & Rose Coral',
    shortLabel: 'Pearl·Coral',
    swatchBg: 'linear-gradient(135deg, #FFF5F5 0%, #FFF5F5 52%, #E11D48 52%, #E11D48 100%)',
    primaryHex: '#FFF5F5',
    secondaryHex: '#E11D48',
    drawerBg: 'linear-gradient(145deg, #FFFBFB 0%, #FFF1F2 58%, #FFE4E6 100%)',
    headerBg: 'linear-gradient(180deg, rgba(225, 29, 72, 0.13) 0%, rgba(255, 255, 255, 0.86) 100%)',
    subbarBg: 'rgba(225, 29, 72, 0.08)',
    cardBg: 'rgba(255, 255, 255, 0.93)',
    cardHoverBg: '#FFFFFF',
    inputBg: '#FFFFFF',
    modalBg: '#FFF8F9',
    pillBg: 'rgba(225, 29, 72, 0.10)',
    pillHoverBg: 'rgba(225, 29, 72, 0.19)',
    borderRgba: 'rgba(225, 29, 72, 0.27)',
    borderSubtleRgba: 'rgba(225, 29, 72, 0.14)',
    textPrimary: '#311018',
    textSecondary: '#881337',
    textMuted: '#9F4A5E',
    accentHex: '#E11D48',
  },
  {
    id: 'sand-amber',
    label: 'Desert Sand & Amber Gold',
    shortLabel: 'Sand·Amber',
    swatchBg: 'linear-gradient(135deg, #FEF9E7 0%, #FEF9E7 52%, #D97706 52%, #D97706 100%)',
    primaryHex: '#FEF9E7',
    secondaryHex: '#D97706',
    drawerBg: 'linear-gradient(145deg, #FEFDF8 0%, #FEF3C7 58%, #FDE68A 100%)',
    headerBg: 'linear-gradient(180deg, rgba(217, 119, 6, 0.15) 0%, rgba(255, 253, 245, 0.86) 100%)',
    subbarBg: 'rgba(217, 119, 6, 0.09)',
    cardBg: 'rgba(255, 253, 248, 0.92)',
    cardHoverBg: '#FFFFFF',
    inputBg: '#FFFFFF',
    modalBg: '#FFFDF5',
    pillBg: 'rgba(217, 119, 6, 0.12)',
    pillHoverBg: 'rgba(217, 119, 6, 0.22)',
    borderRgba: 'rgba(217, 119, 6, 0.30)',
    borderSubtleRgba: 'rgba(217, 119, 6, 0.15)',
    textPrimary: '#2D1B06',
    textSecondary: '#78350F',
    textMuted: '#925822',
    accentHex: '#D97706',
  },
  {
    id: 'mist-cyan',
    label: 'Glacier Mist & Cyan Teal',
    shortLabel: 'Mist·Cyan',
    swatchBg: 'linear-gradient(135deg, #F0F9FF 0%, #F0F9FF 52%, #0891B2 52%, #0891B2 100%)',
    primaryHex: '#F0F9FF',
    secondaryHex: '#0891B2',
    drawerBg: 'linear-gradient(145deg, #F8FDFF 0%, #E0F2FE 58%, #CFFAFE 100%)',
    headerBg: 'linear-gradient(180deg, rgba(8, 145, 178, 0.14) 0%, rgba(255, 255, 255, 0.86) 100%)',
    subbarBg: 'rgba(8, 145, 178, 0.08)',
    cardBg: 'rgba(255, 255, 255, 0.92)',
    cardHoverBg: '#FFFFFF',
    inputBg: '#FFFFFF',
    modalBg: '#F5FCFF',
    pillBg: 'rgba(8, 145, 178, 0.11)',
    pillHoverBg: 'rgba(8, 145, 178, 0.20)',
    borderRgba: 'rgba(8, 145, 178, 0.28)',
    borderSubtleRgba: 'rgba(8, 145, 178, 0.14)',
    textPrimary: '#082F49',
    textSecondary: '#155E75',
    textMuted: '#43768C',
    accentHex: '#0891B2',
  },
  {
    id: 'lavender-violet',
    label: 'Lavender Milk & Violet',
    shortLabel: 'Lavender·Violet',
    swatchBg: 'linear-gradient(135deg, #F5F3FF 0%, #F5F3FF 52%, #7C3AED 52%, #7C3AED 100%)',
    primaryHex: '#F5F3FF',
    secondaryHex: '#7C3AED',
    drawerBg: 'linear-gradient(145deg, #FDFAFF 0%, #F3E8FF 58%, #EDE9FE 100%)',
    headerBg: 'linear-gradient(180deg, rgba(124, 58, 237, 0.14) 0%, rgba(255, 255, 255, 0.86) 100%)',
    subbarBg: 'rgba(124, 58, 237, 0.08)',
    cardBg: 'rgba(255, 255, 255, 0.92)',
    cardHoverBg: '#FFFFFF',
    inputBg: '#FFFFFF',
    modalBg: '#FAF7FF',
    pillBg: 'rgba(124, 58, 237, 0.11)',
    pillHoverBg: 'rgba(124, 58, 237, 0.20)',
    borderRgba: 'rgba(124, 58, 237, 0.28)',
    borderSubtleRgba: 'rgba(124, 58, 237, 0.14)',
    textPrimary: '#241046',
    textSecondary: '#5B21B6',
    textMuted: '#6D5496',
    accentHex: '#7C3AED',
  },
  {
    id: 'platinum-indigo',
    label: 'Platinum White & Indigo',
    shortLabel: 'Platinum·Indigo',
    swatchBg: 'linear-gradient(135deg, #F8FAFC 0%, #F8FAFC 52%, #4F46E5 52%, #4F46E5 100%)',
    primaryHex: '#F8FAFC',
    secondaryHex: '#4F46E5',
    drawerBg: 'linear-gradient(145deg, #FFFFFF 0%, #EEF2FF 58%, #E0E7FF 100%)',
    headerBg: 'linear-gradient(180deg, rgba(79, 70, 229, 0.13) 0%, rgba(255, 255, 255, 0.88) 100%)',
    subbarBg: 'rgba(79, 70, 229, 0.08)',
    cardBg: 'rgba(255, 255, 255, 0.93)',
    cardHoverBg: '#FFFFFF',
    inputBg: '#FFFFFF',
    modalBg: '#F8FAFF',
    pillBg: 'rgba(79, 70, 229, 0.10)',
    pillHoverBg: 'rgba(79, 70, 229, 0.19)',
    borderRgba: 'rgba(79, 70, 229, 0.27)',
    borderSubtleRgba: 'rgba(79, 70, 229, 0.14)',
    textPrimary: '#1E1B4B',
    textSecondary: '#3730A3',
    textMuted: '#5A608A',
    accentHex: '#4F46E5',
  },
]

const CLIENT_SPELL_DICTIONARY: Record<string, string> = {
  teh: 'the',
  recieve: 'receive',
  recieved: 'received',
  seperate: 'separate',
  definately: 'definitely',
  occured: 'occurred',
  accomodate: 'accommodate',
  wierd: 'weird',
  untill: 'until',
  bussiness: 'business',
  enviroment: 'environment',
  configuartion: 'configuration',
  intgeration: 'integration',
  intergration: 'integration',
  commerical: 'commercial',
  sucess: 'success',
  immediatly: 'immediately',
  tommorow: 'tomorrow',
  calender: 'calendar',
  neccessary: 'necessary',
  priviledge: 'privilege',
  maintainance: 'maintenance',
  occassion: 'occasion',
  recomend: 'recommend',
  refered: 'referred',
  begining: 'beginning',
  beleive: 'believe',
  acheive: 'achieve',
  arguement: 'argument',
  freind: 'friend',
  goverment: 'government',
  grammer: 'grammar',
  knowlege: 'knowledge',
  mispell: 'misspell',
  realy: 'really',
  remeber: 'remember',
  suprise: 'surprise',
  therefor: 'therefore',
  truely: 'truly',
  unfortunatly: 'unfortunately',
  wich: 'which',
  writting: 'writing',
  dont: "don't",
  cant: "can't",
  wont: "won't",
  didnt: "didn't",
  doesnt: "doesn't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  shouldnt: "shouldn't",
  wouldnt: "wouldn't",
  couldnt: "couldn't",
  havent: "haven't",
  hasnt: "hasn't",
  im: "I'm",
  ive: "I've",
  id: "I'd",
}

function clientAutoCorrectAndMakeSentences(
  rawText: string,
  mode: 'sentences' | 'bullets' | 'executive' | 'spell-only' = 'sentences'
): { correctedText: string; correctionsCount: number; sentencesCount: number } {
  let text = String(rawText || '')
  let correctionsCount = 0
  text = text
    .replace(/\btheir\s+are\b/gi, () => {
      correctionsCount++
      return 'there are'
    })
    .replace(/\btheir\s+is\b/gi, () => {
      correctionsCount++
      return 'there is'
    })
    .replace(/\bduel\s+combinations\b/gi, () => {
      correctionsCount++
      return 'dual combinations'
    })
  text = text.replace(/\b([A-Za-z]+)\b/g, (word) => {
    const lower = word.toLowerCase()
    if (word === 'i') {
      correctionsCount++
      return 'I'
    }
    const mapped = CLIENT_SPELL_DICTIONARY[lower]
    if (!mapped) return word
    correctionsCount++
    if (word[0] === word[0].toUpperCase()) return mapped.charAt(0).toUpperCase() + mapped.slice(1)
    return mapped
  })
  if (mode === 'spell-only') {
    return { correctedText: text, correctionsCount, sentencesCount: 0 }
  }
  let sentencesCount = 0
  const outLines = text.split('\n').map((line) => {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('```') || (t.startsWith('|') && t.endsWith('|'))) return line
    const m = line.match(/^(\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|~\s*))/)
    const prefix = m ? (m[1].trim().startsWith('~') ? '- ' : m[1]) : mode === 'bullets' ? '- ' : ''
    const body = (m ? line.slice(m[1].length) : t).trim()
    const clauses = body
      .split(/(?<=[.!?])\s+|\s*;\s*/)
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const cap = c.charAt(0).toUpperCase() + c.slice(1)
        sentencesCount++
        return /[.!?]$/.test(cap) ? cap : `${cap}.`
      })
    return `${prefix}${clauses.join(' ')}`
  })
  return { correctedText: outLines.join('\n'), correctionsCount, sentencesCount }
}

const ICON_BUTTON_DESCRIPTIONS: Record<string, string> = {
  '+': 'Add / Create New Item',
  '🧹': 'Clean / Remove Duplicates',
  '🔍': 'Search / Filter Items',
  '⚙': 'Open Appearance, Glass, Themes & Integration Settings',
  '▲': 'Slide Up & Hide Workspace Drawer (⌘+Shift+D)',
  '☰': 'Toggle All Notes List Drawer',
  '👁️': 'Quick Look File Inspector & SHA-256 Preview',
  '👁': 'Quick Look File Inspector & SHA-256 Preview',
  '✨': 'AI Studio Action / Smart Assistant',
  '📥': 'Stage / Remove File on Drop Shelf',
  '📦': 'Compress ZIP Archive / Export Backup',
  '🔒': 'Lock Item / Engage Security Shield',
  '🔓': 'Unlock Item / Release Security Shield',
  '🔐': 'Encrypt into Dedicated AES-256-GCM Vault',
  '🔥': 'DoD 3-Pass Cryptographic Shredder / Panic Wipe',
  '✏️': 'Rename Item',
  '🗑️': 'Move to Trash / Delete Item',
  '💾': 'Export & Save Note to Disk',
  '📋': 'Copy to Clipboard',
  'B': 'Bold Text (**bold**)',
  'I': 'Italic Text (*italic*)',
  'H2': 'Insert Section Heading (##)',
  '</>': 'Insert Code Block (```)',
  '✕': 'Close Modal / Dismiss',
  '×': 'Remove / Delete Item',
  '←': 'Navigate Back in Folder History',
  '→': 'Navigate Forward in Folder History',
  '↑': 'Go Up to Parent Folder',
}

function resolveHoveredButtonLabel(el: HTMLElement): string {
  const explicit =
    el.getAttribute('data-key-name') ||
    el.getAttribute('title') ||
    el.getAttribute('aria-label') ||
    el.getAttribute('placeholder')
  const rawText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  if (explicit && rawText && !explicit.toLowerCase().includes(rawText.toLowerCase()) && rawText.length <= 22) {
    return `${rawText} — ${explicit}`
  }
  if (explicit) return explicit
  if (ICON_BUTTON_DESCRIPTIONS[rawText]) {
    return `${rawText} ${ICON_BUTTON_DESCRIPTIONS[rawText]}`
  }
  if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range') {
    return `Slider Control (${(el as HTMLInputElement).value}%)`
  }
  if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') {
    return (el as HTMLInputElement).checked ? 'Toggle Switch (Enabled)' : 'Toggle Switch (Disabled)'
  }
  if (rawText) {
    return rawText.length > 48 ? `${rawText.slice(0, 48)}…` : `Button: ${rawText}`
  }
  return 'Interactive Control'
}

const SOLID_COLOR_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: 'slate', label: 'Midnight Slate', hex: '#0f172a' },
  { id: 'sapphire', label: 'Deep Sapphire', hex: '#0c1838' },
  { id: 'charcoal', label: 'Obsidian Carbon', hex: '#141418' },
  { id: 'nordic', label: 'Nordic Steel', hex: '#1e293b' },
  { id: 'emerald', label: 'Deep Pine', hex: '#07241e' },
  { id: 'graphite', label: 'Warm Graphite', hex: '#222226' },
]

const DEFAULT_AI_CONFIG: AIConfig = {
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
  cerebrasKey: '',
  sambanovaKey: '',
  githubKey: '',
  huggingfaceKey: '',
  mistralKey: '',
  systemPrompt:
    "You are OpenDesk AI v3.1 (OpenDesk PRO Enterprise), an enterprise-grade macOS workspace assistant integrated into the user's Clipboard, Files, Staging Shelf, Notes, and Unified Security/Privacy/Vault Packet. Provide concise, directly usable responses.",
}

const CLOUD_MODEL_PRESETS: Record<string, string[]> = {
  builtin: ['deskfolder-pro-v3', 'smart-workspace-v3'],
  freecloud: ['openai', 'mistral', 'llama', 'qwen-coder', 'deepseek-r1'],
  openrouter: [
    'deepseek/deepseek-r1:free',
    'deepseek/deepseek-chat-v3-0324:free',
    'nvidia/nemotron-3.5-lightning:free',
    'cohere/north-mini-code:free',
    'thinkingmachines/inkling:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-coder-32b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'nvidia/llama-3.1-nemotron-70b-instruct:free',
    'mistralai/mistral-small-24b-instruct-2501:free',
    'openrouter/free',
  ],
  nvidia: [
    'meta/llama-3.3-70b-instruct',
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'nvidia/nemotron-3.5-lightning:free',
    'deepseek-ai/deepseek-r1',
    'nvidia/llama-3.1-nemotron-ultra-253b-v1',
    'qwen/qwen2.5-coder-32b-instruct',
    'mistralai/mistral-nemotron',
    'google/gemma-2-27b-it',
  ],
  omniroute: [
    'omniroute/auto-free',
    'auto/best-free',
    'deepseek-r1:free',
    'llama-3.3-70b-instruct',
    'qwen-2.5-coder-32b',
    'gemini-2.0-flash-free',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'deepseek-r1-distill-llama-70b',
    'qwen-qwq-32b',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
  ],
  gemini: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'],
  cerebras: ['llama-3.3-70b', 'llama3.1-8b', 'deepseek-r1-distill-llama-70b'],
  sambanova: [
    'Meta-Llama-3.3-70B-Instruct',
    'DeepSeek-R1',
    'DeepSeek-V3-0324',
    'Qwen2.5-Coder-32B-Instruct',
  ],
  github: ['gpt-4o-mini', 'DeepSeek-R1', 'Llama-3.3-70B-Instruct', 'Codestral-2501', 'Phi-4'],
  huggingface: [
    'Qwen/Qwen2.5-72B-Instruct',
    'meta-llama/Llama-3.3-70B-Instruct',
    'mistralai/Mistral-Small-24B-Instruct-2501',
  ],
  mistral: ['mistral-small-latest', 'codestral-latest', 'open-mistral-nemo'],
}

const VALID_FREE_PROVIDERS: AIProviderId[] = [
  'builtin',
  'freecloud',
  'openrouter',
  'nvidia',
  'omniroute',
  'groq',
  'gemini',
  'cerebras',
  'sambanova',
  'github',
  'huggingface',
  'mistral',
  'ollama',
  'lmstudio',
]

// sanitizeApiKeyInput imported from ./utils/formatters

function sanitizeRendererAIConfig(raw?: Partial<AIConfig> & Record<string, any>): AIConfig {
  const rawProvider = typeof raw?.provider === 'string' ? raw.provider.trim().toLowerCase() : 'builtin'
  const provider: AIProviderId = (VALID_FREE_PROVIDERS as string[]).includes(rawProvider)
    ? (rawProvider as AIProviderId)
    : 'openrouter'
  const defaultModel = CLOUD_MODEL_PRESETS[provider]?.[0] || (provider === 'ollama' ? 'llama3.2' : provider === 'lmstudio' ? 'local-model' : 'deskfolder-pro-v3')
  let model = typeof raw?.model === 'string' ? raw.model.replace(/[^\x21-\x7E]/g, '').trim() : defaultModel
  if (!model || (provider !== 'builtin' && (model === 'deskfolder-pro-v3' || model === 'smart-workspace-v3'))) {
    model = defaultModel
  }
  if (provider === 'openrouter' && !model.endsWith(':free') && model !== 'openrouter/free' && model !== 'openrouter/auto') {
    model = 'deepseek/deepseek-r1:free'
  }
  return {
    ...DEFAULT_AI_CONFIG,
    provider,
    model,
    ollamaUrl: typeof raw?.ollamaUrl === 'string' && raw.ollamaUrl.trim() ? raw.ollamaUrl.replace(/[^\x21-\x7E]/g, '').trim() : DEFAULT_AI_CONFIG.ollamaUrl,
    lmstudioUrl: typeof raw?.lmstudioUrl === 'string' && raw.lmstudioUrl.trim() ? raw.lmstudioUrl.replace(/[^\x21-\x7E]/g, '').trim() : DEFAULT_AI_CONFIG.lmstudioUrl,
    omnirouteUrl: typeof raw?.omnirouteUrl === 'string' && raw.omnirouteUrl.trim() ? raw.omnirouteUrl.replace(/[^\x21-\x7E]/g, '').trim() : DEFAULT_AI_CONFIG.omnirouteUrl,
    openrouterKey: sanitizeApiKeyInput(raw?.openrouterKey),
    nvidiaKey: sanitizeApiKeyInput(raw?.nvidiaKey),
    omnirouteKey: sanitizeApiKeyInput(raw?.omnirouteKey),
    groqKey: sanitizeApiKeyInput(raw?.groqKey),
    geminiKey: sanitizeApiKeyInput(raw?.geminiKey),
    cerebrasKey: sanitizeApiKeyInput(raw?.cerebrasKey),
    sambanovaKey: sanitizeApiKeyInput(raw?.sambanovaKey),
    githubKey: sanitizeApiKeyInput(raw?.githubKey),
    huggingfaceKey: sanitizeApiKeyInput(raw?.huggingfaceKey),
    mistralKey: sanitizeApiKeyInput(raw?.mistralKey),
    systemPrompt: typeof raw?.systemPrompt === 'string' && raw.systemPrompt.trim() ? raw.systemPrompt.trim() : DEFAULT_AI_CONFIG.systemPrompt,
  }
}

// Formatters (formatBytes, hexToRgba, detectColorSwatch, detectTextFormat) and BrandIcons (OpenDeskBrandIcon, MacOSFolderIcon) imported from modular renderer packages

// Enhanced Markdown Renderer with Interactive Checkboxes, Tables & Copyable Code Blocks
const MarkdownPreview: React.FC<{
  content: string
  onWikiLinkClick?: (noteTitle: string) => void
  onToggleCheckbox?: (lineIndex: number) => void
}> = ({ content, onWikiLinkClick, onToggleCheckbox }) => {
  const rendered = useMemo(() => {
    if (!content) return '<p class="df-text-muted italic">Empty note...</p>'
    const lines = content.split('\n')
    let html = ''
    let inCodeBlock = false
    let codeBuffer = ''
    let tableRows: string[][] = []

    const flushTable = () => {
      if (tableRows.length === 0) return
      const header = tableRows[0]
      const bodyRows = tableRows.slice(1).filter((r) => !r.every((cell) => /^[-:\s]+$/.test(cell)))
      html += '<table class="df-md-table"><thead><tr>'
      for (const h of header) {
        html += `<th>${h}</th>`
      }
      html += '</tr></thead><tbody>'
      for (const row of bodyRows) {
        html += '<tr>'
        for (const c of row) {
          html += `<td>${c}</td>`
        }
        html += '</tr>'
      }
      html += '</tbody></table>'
      tableRows = []
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim().startsWith('```')) {
        flushTable()
        if (inCodeBlock) {
          html += `<pre class="df-input p-2.5 rounded-lg my-1.5 font-mono text-[11px] overflow-x-auto select-text"><code>${codeBuffer}</code></pre>`
          codeBuffer = ''
          inCodeBlock = false
        } else {
          inCodeBlock = true
        }
        continue
      }
      if (inCodeBlock) {
        codeBuffer += line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n'
        continue
      }

      // Detect Markdown Table Row (| Col 1 | Col 2 |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|') && line.includes('|')) {
        const cells = line
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
        tableRows.push(cells)
        continue
      } else {
        flushTable()
      }

      if (line.startsWith('# ')) {
        html += `<h1 class="text-base font-bold my-1.5 df-text-primary pb-0.5" style="border-bottom: 1px solid var(--df-border-subtle)">${line.slice(2)}</h1>`
      } else if (line.startsWith('## ')) {
        html += `<h2 class="text-sm font-semibold my-1 df-text-primary">${line.slice(3)}</h2>`
      } else if (line.startsWith('### ')) {
        html += `<h3 class="text-xs font-semibold my-1 df-text-secondary">${line.slice(4)}</h3>`
      } else if (line.trim().startsWith('- [x] ') || line.trim().startsWith('- [X] ')) {
        html += `<div class="task-checkbox flex items-center gap-2 my-1 text-xs df-text-muted line-through cursor-pointer" data-line="${i}"><span class="text-emerald-500 font-bold">☑</span> <span>${line.trim().slice(6)}</span></div>`
      } else if (line.trim().startsWith('- [ ] ')) {
        html += `<div class="task-checkbox flex items-center gap-2 my-1 text-xs df-text-primary cursor-pointer" data-line="${i}"><span class="df-text-muted font-bold">☐</span> <span>${line.trim().slice(6)}</span></div>`
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        html += `<li class="ml-4 list-disc text-xs my-0.5 df-text-secondary">${line.trim().slice(2)}</li>`
      } else if (!line.trim()) {
        html += '<div class="h-1.5"></div>'
      } else {
        const inline = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(
            /\[\[(.*?)\]\]/g,
            '<span class="wikilink underline cursor-pointer font-semibold" style="color: var(--df-accent)" data-note="$1">⟦$1⟧</span>'
          )
          .replace(/\*\*(.*?)\*\*/g, '<strong class="df-text-primary font-semibold">$1</strong>')
          .replace(/`([^`]+)`/g, '<code class="df-pill px-1 py-0.5 rounded font-mono text-[10px]">$1</code>')
          .replace(/#([a-zA-Z0-9_\-]+)/g, '<span class="df-pill px-1.5 py-0.2 rounded text-[10px] font-medium">#$1</span>')
        html += `<p class="text-xs my-0.5 leading-relaxed df-text-secondary">${inline}</p>`
      }
    }
    flushTable()
    return html
  }, [content])

  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement
        const taskBox = target.closest('.task-checkbox') as HTMLElement
        if (taskBox && onToggleCheckbox) {
          const lineIdx = taskBox.getAttribute('data-line')
          if (lineIdx !== null) onToggleCheckbox(parseInt(lineIdx, 10))
          return
        }
        if (target && target.classList.contains('wikilink')) {
          const noteTitle = target.getAttribute('data-note')
          if (noteTitle && onWikiLinkClick) onWikiLinkClick(noteTitle)
        }
      }}
      className="p-3 overflow-y-auto h-full font-sans df-text-primary select-text"
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  )
}

// --- MAIN APPLICATION COMPONENT ---
const App = () => {
  const [layoutMode, setLayoutMode] = useState<'split3' | 'split4' | 'tabbed'>('split3')
  const [activeTab, setActiveTab] = useState<'clipboard' | 'files' | 'notes' | 'ai' | 'vault'>('files')
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [showVaultModal, setShowVaultModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isPinned, setIsPinned] = useState(false)

  // Enterprise Dedicated Vault, 7-Day Trial, Full Security Lock & Flagship Utilities State
  const [strictPrivacyMode, setStrictPrivacyMode] = useState(false)
  const [piiRedactionEnabled, setPiiRedactionEnabled] = useState(true)
  const [sensitiveClipboardGuard, setSensitiveClipboardGuard] = useState(true)
  const [vaultAutoLockOnHide, setVaultAutoLockOnHide] = useState(false)
  const [vaultUnlocked, setVaultUnlocked] = useState(false)
  const [vaultHasCustomPass, setVaultHasCustomPass] = useState(false)
  const [vaultPath, setVaultPath] = useState('/Users/aio_x/Documents/Mac DeskFolder/Vault')
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([])
  const [vaultEncryptedFiles, setVaultEncryptedFiles] = useState<EncryptedVaultFileInfo[]>([])
  const [vaultPassphraseInput, setVaultPassphraseInput] = useState('')
  const [vaultNewPassphraseInput, setVaultNewPassphraseInput] = useState('')
  const [vaultNewTitle, setVaultNewTitle] = useState('')
  const [vaultNewCategory, setVaultNewCategory] = useState<'secret' | 'note' | 'key' | 'token'>('secret')
  const [vaultNewContent, setVaultNewContent] = useState('')
  const [vaultRevealedIds, setVaultRevealedIds] = useState<string[]>([])
  const [privacyAudit, setPrivacyAudit] = useState<any>(null)

  // Vault Sub-Tab, Glass Tint/Blur Toggle, Dual-Light Preset, Auto-Spell/Sentence Maker, Hover Reflection & Integrations State
  const [vaultSubTab, setVaultSubTab] = useState<'records' | 'privacy' | 'tools' | 'audit'>('records')
  const [solidBgHex, setSolidBgHex] = useState<string>('#0f172a')
  const [glassTintBlurEnabled, setGlassTintBlurEnabled] = useState<boolean>(true)
  const [dualLightPreset, setDualLightPreset] = useState<string>('beige-orange')
  const [autoSpellCorrectEnabled, setAutoSpellCorrectEnabled] = useState<boolean>(true)
  const [sentenceMakerMode, setSentenceMakerMode] = useState<'sentences' | 'bullets' | 'executive'>('sentences')
  const [hoveredKeyInfo] = useState<{ label: string; x: number; y: number } | null>(null)
  const hoverTooltipElRef = useRef<HTMLDivElement | null>(null)
  const hoverTooltipLabelRef = useRef<HTMLSpanElement | null>(null)
  const hoverBadgeElRef = useRef<HTMLSpanElement | null>(null)
  const lastHoveredTargetRef = useRef<HTMLElement | null>(null)
  const [integrationsList, setIntegrationsList] = useState<
    { id: string; name: string; type: 'app' | 'package'; icon: string; desc: string; installed: boolean; enabled: boolean }[]
  >([])
  const [integrationsConfig, setIntegrationsConfig] = useState<Record<string, boolean>>({
    obsidian: true,
    vscode: true,
    cursor: true,
    iterm: true,
    finder: true,
    git: true,
    node: true,
    bun: true,
    python3: true,
    homebrew: true,
  })
  const [customIntegrationWebhook, setCustomIntegrationWebhook] = useState<string>('')

  // 15-Day Commercial Trial, $9 Automated Lifetime Checkout & License State
  const [licenseStatus, setLicenseStatus] = useState<any>({
    isActivated: false,
    licenseTier: '15-Day Pro Trial',
    trialDaysTotal: 15,
    trialDaysRemaining: 15,
    trialHoursRemaining: 360,
    lifetimePriceUsd: 9,
    isTrialExpired: false,
    masterDemoKey: '',
  })
  const [showLicenseModal, setShowLicenseModal] = useState(false)
  const [licenseKeyInput, setLicenseKeyInput] = useState('')
  const [licensedToInput, setLicensedToInput] = useState('')
  const [checkoutEmailInput, setCheckoutEmailInput] = useState('')
  const [checkoutMethod, setCheckoutMethod] = useState<'UPI / Instant QR' | 'Card / Apple Pay' | 'Razorpay / Global'>('UPI / Instant QR')
  const [lastReceiptInfo, setLastReceiptInfo] = useState<{ key: string; receiptPath: string; plan: string } | null>(null)

  // Full-Workspace Encrypted Security Lock State (⌘+L)
  const [isAppSecurityLocked, setIsAppSecurityLocked] = useState(false)
  const [securityPinInput, setSecurityPinInput] = useState('')
  const [securityErrorMsg, setSecurityErrorMsg] = useState('')

  // Best-in-Class CSPRNG Secret Generator, Text Cipher, PII Tester & Workspace Leak Scanner State (Unified Packet)
  const [generatedSecretData, setGeneratedSecretData] = useState<{
    secret: string
    entropyBits: number
    strengthLabel: string
    mode: string
  } | null>(null)
  const [secretScanFindings, setSecretScanFindings] = useState<any[] | null>(null)
  const [sealInputText, setSealInputText] = useState('')
  const [sealPassphrase, setSealPassphrase] = useState('')
  const [sealedPacketOutput, setSealedPacketOutput] = useState('')
  const [piiSampleInput, setPiiSampleInput] = useState('')
  const [piiSampleOutput, setPiiSampleOutput] = useState<string | null>(null)

  // Resizable Split Panes State (Percentages for 3-Pane or 4-Pane)
  const [paneWidths, setPaneWidths] = useState<number[]>([28, 40, 32])
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const draggingDividerRef = useRef<{ index: number; startX: number; startWidths: number[] } | null>(null)

  // Global Command Palette (⌘K) & Omni-Search State
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [omniQuery, setOmniQuery] = useState('')
  const [omniCategory, setOmniCategory] = useState<'all' | 'actions' | 'files' | 'notes' | 'clipboard'>('all')
  const [omniSelectedIndex, setOmniSelectedIndex] = useState(0)

  // Built-in Pomodoro Focus Timer & Quick Tasks Bar State
  const [pomoSecondsLeft, setPomoSecondsLeft] = useState(25 * 60)
  const pomoSecondsLeftRef = useRef(25 * 60)
  const [pomoRunning, setPomoRunning] = useState(false)
  const [pomoMode, setPomoMode] = useState<'sprint' | 'focus' | 'short' | 'deep'>('focus')
  const [pomoSessionsCompleted, setPomoSessionsCompleted] = useState(0)
  const [showPomoPopover, setShowPomoPopover] = useState(false)
  const [quickTasks, setQuickTasks] = useState<QuickTaskItem[]>([
    { id: 'qt-1', text: 'Review staged files in Dropzone', done: false },
    { id: 'qt-2', text: 'Test ⌘K Omni-Search & AI Studio', done: false },
  ])
  const [newQuickTaskText, setNewQuickTaskText] = useState('')

  // Per-pane Search & Inline Modals (Zero window.prompt / window.confirm!)
  const [clipSearchOpen, setClipSearchOpen] = useState(false)
  const [clipSearch, setClipSearch] = useState('')
  const [newClipOpen, setNewClipOpen] = useState(false)
  const [newClipText, setNewClipText] = useState('')
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([])

  const [fileSearchOpen, setFileSearchOpen] = useState(false)
  const [fileSearch, setFileSearch] = useState('')
  const [createModal, setCreateModal] = useState<{ type: 'folder' | 'file' | 'note'; defaultVal: string } | null>(null)
  const [createInputVal, setCreateInputVal] = useState('')
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'file' | 'note'; name: string; path?: string } | null>(null)

  const [noteSearchOpen, setNoteSearchOpen] = useState(false)
  const [noteSearch, setNoteSearch] = useState('')
  const [showNotesListDrawer, setShowNotesListDrawer] = useState(false)

  // Settings & macOS Appearance State
  const [workspaceRoot, setWorkspaceRoot] = useState('/Users/aio_x/Documents/Mac DeskFolder')
  const [currentPath, setCurrentPath] = useState('/Users/aio_x/Documents/Mac DeskFolder')
  const [navHistory, setNavHistory] = useState<string[]>(['/Users/aio_x/Documents/Mac DeskFolder'])
  const [navIndex, setNavIndex] = useState<number>(0)

  const [notesPath, setNotesPath] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [theme, setTheme] = useState<ThemeMode>('liquid')
  const [liquidGlassIntensity, setLiquidGlassIntensity] = useState<number>(55)
  const [accentColor, setAccentColor] = useState<AccentColorId>('multicolor')
  const [osAccentHex, setOSAccentHex] = useState<string>('#007aff')
  const [iconStyle, setIconStyle] = useState<IconWidgetStyle>('default')
  const [folderColor, setFolderColor] = useState<'automatic' | AccentColorId>('automatic')
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('dark')
  const [clipboardLength, setClipboardLength] = useState(100)
  const [trackingEnabled, setTrackingEnabled] = useState(true)
  const [twoFingerPullEnabled, setTwoFingerPullEnabled] = useState(true)
  const [systemFolders, setSystemFolders] = useState<Record<string, string>>({})
  const [lockedFiles, setLockedFiles] = useState<string[]>([])
  const [lockedNotes, setLockedNotes] = useState<string[]>([])

  // Files, Multi-Select & Temporary Staging Shelf State
  const [files, setFiles] = useState<FileItem[]>([])
  const [fileCategory, setFileCategory] = useState<'all' | 'docs' | 'images' | 'code' | 'archives' | 'folders'>('all')
  const [folderStats, setFolderStats] = useState<FolderStats>({ totalSize: 0, fileCount: 0, folderCount: 0 })
  const [filesLoading, setFilesLoading] = useState(false)
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [previewFile, setPreviewFile] = useState<PreviewItemData | null>(null)
  const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([])
  const [shelfPaths, setShelfPaths] = useState<string[]>([])
  const [showShelfDrawer, setShowShelfDrawer] = useState<boolean>(false)

  // Notes State — Decoupled Editor State so fs.watch NEVER overwrites typing!
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [activeNoteName, setActiveNoteName] = useState<string>('')
  const [editorContent, setEditorContent] = useState<string>('')
  const [renamingNoteTitle, setRenamingNoteTitle] = useState<boolean>(false)
  const [noteTitleDraft, setNoteTitleDraft] = useState<string>('')
  const [noteViewMode, setNoteViewMode] = useState<'edit' | 'preview'>('edit')
  const [noteSaveStatus, setNoteSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved')

  const activeNoteNameRef = useRef<string>('')
  const isTypingNoteRef = useRef<boolean>(false)
  const lastLocalNoteSaveRef = useRef<number>(0)
  const autoSaveTimerRef = useRef<any>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const currentPathRef = useRef<string>(currentPath)

  useEffect(() => {
    activeNoteNameRef.current = activeNoteName
  }, [activeNoteName])

  useEffect(() => {
    currentPathRef.current = currentPath
  }, [currentPath])

  // Clipboard State
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardEntry[]>([])
  const [clipboardCategory, setClipboardCategory] = useState<'all' | 'favorites' | 'text' | 'image' | 'code' | 'url'>('all')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // AI Hub State (Multi-Context Attachments, Custom Prompts & Streaming)
  const [aiConfig, setAIConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG)
  const [localStatus, setLocalStatus] = useState<{
    ollamaOnline: boolean
    ollamaModels: string[]
    lmstudioOnline: boolean
    lmstudioModels: string[]
    omnirouteOnline?: boolean
    omnirouteModels?: string[]
  }>({ ollamaOnline: false, ollamaModels: [], lmstudioOnline: false, lmstudioModels: [], omnirouteOnline: false, omnirouteModels: [] })
  const [aiMessages, setAIMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Ready! Running in **100% Free AI Studio** mode with **⚡ Built-in Smart AI (Offline)**, **🌐 Free Cloud AI (Zero-Key)**, **🆓 OpenRouter (:free models)**, **🟢 Nvidia NIM**, **🧭 OmniRoute**, **⚡ Groq**, **☁️ Google Gemini (Free)**, **🚀 Cerebras**, **🔥 SambaNova**, **🐙 GitHub Models**, **🤗 Hugging Face**, **🌪️ Mistral**, and **🏠 Local Ollama / LM Studio**.\n\n• Attach **multiple Files, Notes, or Clips** simultaneously using the `@Context` bar below.\n• Click **+Note**, **Replace Note**, or **💾 File** on any AI reply to apply it immediately.",
      timestamp: new Date(),
      provider: 'builtin',
      model: 'deskfolder-pro-v3',
    },
  ])
  const [aiPromptInput, setAIPromptInput] = useState('')
  const [aiContextAttachment, setAIContextAttachment] = useState<{ label: string; content: string } | null>(null)
  const [aiAttachments, setAIAttachments] = useState<AIAttachment[]>([])
  const [customPrompts, setCustomPrompts] = useState<CustomPromptPreset[]>([
    { id: 'cp-1', label: '⚡ Executive Brief', prompt: 'Summarize the key points into a 5-bullet executive brief with action items:' },
    { id: 'cp-2', label: '🛠️ Refactor & Fix', prompt: 'Review this code for edge cases, bugs, and type safety, and output an improved version:' },
    { id: 'cp-3', label: '📧 Draft Reply', prompt: 'Draft a concise, warm, professional reply based on this context:' },
  ])
  const [newPresetOpen, setNewPresetOpen] = useState(false)
  const [newPresetLabel, setNewPresetLabel] = useState('')
  const [newPresetPrompt, setNewPresetPrompt] = useState('')
  const [aiLoading, setAILoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2400)
  }, [])

  // --- POMODORO COUNTDOWN EFFECT ---
  useEffect(() => {
    pomoSecondsLeftRef.current = pomoSecondsLeft
  }, [pomoSecondsLeft])

  useEffect(() => {
    if (!pomoRunning) return
    const timer = setInterval(() => {
      setPomoSecondsLeft((prev) => {
        if (prev <= 1) {
          setPomoRunning(false)
          if (pomoMode !== 'short') {
            setPomoSessionsCompleted((c) => c + 1)
          }
          showToast(pomoMode !== 'short' ? '🎉 Focus session complete! Take a 5m break.' : '⏰ Break complete! Ready to focus.')
          return pomoMode !== 'short' ? 5 * 60 : 25 * 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [pomoRunning, pomoMode, showToast])

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // --- GLOBAL KEYBOARD SHORTCUTS (⌘K Command Palette, ⌘L Full App Security Lock, Escape) ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
        setOmniQuery('')
        setOmniSelectedIndex(0)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        window.electronAPI?.securityLockApp?.()
        setIsAppSecurityLocked(true)
        setVaultUnlocked(false)
        setVaultItems([])
        showToast('🔒 Full-Workspace Security Lock Activated')
      } else if (e.key === 'Escape') {
        if (commandPaletteOpen) setCommandPaletteOpen(false)
        else if (showPomoPopover) setShowPomoPopover(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commandPaletteOpen, showPomoPopover, showToast])

  // --- RESIZABLE SPLIT PANE MOUSE DRAG HANDLER (rAF-Throttled for 60fps Zero-Lag Dragging) ---
  useEffect(() => {
    let rafId: number | null = null
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingDividerRef.current || !splitContainerRef.current) return
      const clientX = e.clientX
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!draggingDividerRef.current || !splitContainerRef.current) return
        const { index, startX, startWidths } = draggingDividerRef.current
        const rect = splitContainerRef.current.getBoundingClientRect()
        if (rect.width <= 0) return
        const deltaPct = ((clientX - startX) / rect.width) * 100
        const next = [...startWidths]
        const minPct = layoutMode === 'split4' ? 16 : 20
        const leftVal = Math.max(minPct, Math.min(100 - minPct * 2, startWidths[index] + deltaPct))
        const actualDelta = leftVal - startWidths[index]
        const rightVal = startWidths[index + 1] - actualDelta
        if (rightVal >= minPct) {
          next[index] = Math.round(leftVal * 10) / 10
          next[index + 1] = Math.round(rightVal * 10) / 10
          setPaneWidths(next)
        }
      })
    }
    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (draggingDividerRef.current) {
        draggingDividerRef.current = null
        window.electronAPI?.saveSettings({ paneWidths })
      }
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [layoutMode, paneWidths])

  const resetSplitWidths = () => {
    const defaults = layoutMode === 'split4' ? [23, 31, 24, 22] : [28, 40, 32]
    setPaneWidths(defaults)
    window.electronAPI?.saveSettings({ paneWidths: defaults })
    showToast('Reset split pane widths')
  }

  // --- INITIALIZATION ---
  const applySettingsState = useCallback((settings: AppSettings) => {
    if (settings.currentPath) {
      setWorkspaceRoot(settings.currentPath)
      setCurrentPath(settings.currentPath)
      setNavHistory([settings.currentPath])
      setNavIndex(0)
    }
    if (settings.notesPath !== undefined) setNotesPath(settings.notesPath)
    if (settings.layoutMode) setLayoutMode(settings.layoutMode)
    if (settings.viewMode) setViewMode(settings.viewMode)
    if (settings.sortBy) setSortBy(settings.sortBy)
    if (settings.sortDirection) setSortDirection(settings.sortDirection)
    if (
      settings.theme &&
      ['liquid', 'solid', 'aurora', 'nord', 'solarized', 'obsidian', 'light', 'dark', 'auto'].includes(settings.theme)
    ) {
      setTheme(settings.theme)
    }
    if (typeof settings.liquidGlassIntensity === 'number') {
      setLiquidGlassIntensity(settings.liquidGlassIntensity)
    }
    if (settings.glassTintBlurEnabled !== undefined) {
      setGlassTintBlurEnabled(Boolean(settings.glassTintBlurEnabled))
    }
    if (settings.dualLightPreset) {
      setDualLightPreset(settings.dualLightPreset)
    }
    if (settings.solidBgHex) {
      setSolidBgHex(settings.solidBgHex)
    }
    if (settings.autoSpellCorrectEnabled !== undefined) {
      setAutoSpellCorrectEnabled(settings.autoSpellCorrectEnabled !== false)
    }
    if (settings.sentenceMakerMode) {
      setSentenceMakerMode(settings.sentenceMakerMode)
    }
    if (settings.integrationsConfig) {
      setIntegrationsConfig((prev) => ({ ...prev, ...settings.integrationsConfig }))
    }
    if (typeof settings.customIntegrationWebhook === 'string') {
      setCustomIntegrationWebhook(settings.customIntegrationWebhook)
    }
    if (settings.accentColor) setAccentColor(settings.accentColor)
    if (settings.iconStyle) setIconStyle(settings.iconStyle)
    if (settings.folderColor) setFolderColor(settings.folderColor)
    if (settings.clipboardLength) setClipboardLength(settings.clipboardLength)
    if (settings.trackingEnabled !== undefined) setTrackingEnabled(settings.trackingEnabled)
    if (settings.twoFingerPullEnabled !== undefined) setTwoFingerPullEnabled(settings.twoFingerPullEnabled)
    if (settings.isPinned !== undefined) setIsPinned(settings.isPinned)
    if (settings.strictPrivacyMode !== undefined) setStrictPrivacyMode(Boolean(settings.strictPrivacyMode))
    if (settings.piiRedactionEnabled !== undefined) setPiiRedactionEnabled(settings.piiRedactionEnabled !== false)
    if (settings.sensitiveClipboardGuard !== undefined) setSensitiveClipboardGuard(settings.sensitiveClipboardGuard !== false)
    if (settings.vaultAutoLockOnHide !== undefined) setVaultAutoLockOnHide(Boolean(settings.vaultAutoLockOnHide))
    if (settings.lockedFiles) setLockedFiles(settings.lockedFiles)
    if (settings.lockedNotes) setLockedNotes(settings.lockedNotes)
    if (Array.isArray(settings.paneWidths) && settings.paneWidths.length >= 3) {
      setPaneWidths(settings.paneWidths)
    }
    if (Array.isArray(settings.shelfPaths)) setShelfPaths(settings.shelfPaths)
    if (Array.isArray(settings.quickTasks) && settings.quickTasks.length > 0) setQuickTasks(settings.quickTasks)
    if (Array.isArray(settings.customPrompts) && settings.customPrompts.length > 0) setCustomPrompts(settings.customPrompts)
    if (settings.aiConfig) setAIConfig(sanitizeRendererAIConfig(settings.aiConfig))
  }, [])

  const refreshVaultStatus = useCallback(async () => {
    if (!window.electronAPI?.vaultGetStatus) return
    try {
      const st = await window.electronAPI.vaultGetStatus()
      setVaultUnlocked(st.unlocked)
      setVaultHasCustomPass(Boolean(st.hasCustomPassphrase))
      if (st.vaultPath) setVaultPath(st.vaultPath)
      if (Array.isArray(st.items)) setVaultItems(st.items)
      if (Array.isArray(st.encryptedFiles)) setVaultEncryptedFiles(st.encryptedFiles)
      if (window.electronAPI.getPrivacyAudit) {
        const audit = await window.electronAPI.getPrivacyAudit()
        setPrivacyAudit(audit)
      }
      if (window.electronAPI.licenseGetStatus) {
        const lic = await window.electronAPI.licenseGetStatus()
        setLicenseStatus(lic)
      }
      if (window.electronAPI.securityGetStatus) {
        const sec = await window.electronAPI.securityGetStatus()
        setIsAppSecurityLocked(Boolean(sec.isAppLocked))
      }
    } catch {}
  }, [])

  const probeLocalAI = useCallback(
    async (cfg = aiConfig) => {
      if (!window.electronAPI?.aiCheckLocalModels) return
      try {
        const status = await window.electronAPI.aiCheckLocalModels({
          ollamaUrl: cfg.ollamaUrl,
          lmstudioUrl: cfg.lmstudioUrl,
          omnirouteUrl: cfg.omnirouteUrl,
        })
        setLocalStatus(status)
        if (cfg.provider === 'ollama' && status.ollamaModels.length > 0 && !status.ollamaModels.includes(cfg.model)) {
          const next = sanitizeRendererAIConfig({ ...cfg, model: status.ollamaModels[0] })
          setAIConfig(next)
          window.electronAPI.saveSettings({ aiConfig: next })
        }
      } catch {}
    },
    [aiConfig]
  )

  // --- SAFE NOTES LOADER (Never overwrites active typing!) ---
  const refreshNotesMetadata = useCallback(async (forceSelectNoteName?: string) => {
    if (!window.electronAPI) return
    try {
      const data = await window.electronAPI.getNotes()
      if (data.length === 0) {
        const starterName = 'Quick Scratchpad.md'
        const starterBody =
          "# Quick Scratchpad\n\nWelcome to OpenDesk PRO v3.1 Notepad.\n\n- [ ] Use the toolbar above to format text, add tasks, or create new notes\n- [ ] Click ✨ AI to summarize, polish, or extract action items\n- [ ] Everything auto-saves safely without interrupting your typing\n"
        lastLocalNoteSaveRef.current = Date.now()
        await window.electronAPI.saveNote({ name: starterName, content: starterBody })
        const refreshed = await window.electronAPI.getNotes()
        setNotes(refreshed)
        if (refreshed.length > 0) {
          setActiveNoteName(refreshed[0].name)
          setEditorContent(refreshed[0].content)
        }
        return
      }

      setNotes(data)

      const targetName = forceSelectNoteName || activeNoteNameRef.current
      if (!targetName) {
        setActiveNoteName(data[0].name)
        setEditorContent(data[0].content)
      } else if (forceSelectNoteName) {
        const found = data.find((n) => n.name === forceSelectNoteName)
        if (found) {
          setActiveNoteName(found.name)
          setEditorContent(found.content)
        }
      } else if (!isTypingNoteRef.current && Date.now() - lastLocalNoteSaveRef.current > 2000) {
        const stillExists = data.some((n) => n.name === targetName)
        if (!stillExists && data.length > 0) {
          setActiveNoteName(data[0].name)
          setEditorContent(data[0].content)
        }
      }
    } catch (err) {
      console.error('Failed to load notes:', err)
    }
  }, [])

  useEffect(() => {
    async function init() {
      if (!window.electronAPI) return
      try {
        const settings = await window.electronAPI.getSettings()
        applySettingsState(settings)

        if (window.electronAPI.getSystemTheme) {
          const sys = await window.electronAPI.getSystemTheme()
          setSystemTheme(sys)
        }
        if (window.electronAPI.getOSAccentColor) {
          const hex = await window.electronAPI.getOSAccentColor()
          if (hex) setOSAccentHex(hex)
        }

        const sysFolders = await window.electronAPI.getSystemFolders()
        setSystemFolders(sysFolders)

        const initialFolder = settings.currentPath || currentPath
        await loadFiles(initialFolder, false)
        await refreshNotesMetadata()
        await refreshVaultStatus()
        probeLocalAI(settings.aiConfig || DEFAULT_AI_CONFIG)

        const history = await window.electronAPI.getClipboardHistory()
        if (history && history.length > 0) setClipboardHistory(history)

        window.electronAPI.onFolderChanged((newPath) => {
          navigateToFolder(newPath)
        })
        window.electronAPI.onFolderContentsChanged(() => {
          loadFiles(currentPathRef.current, false)
        })
        window.electronAPI.onNotesFolderChanged(() => {
          if (!isTypingNoteRef.current && Date.now() - lastLocalNoteSaveRef.current > 1800) {
            refreshNotesMetadata()
          }
        })
        window.electronAPI.onPinChanged((pinned) => setIsPinned(pinned))
        window.electronAPI.onSettingsUpdated?.((updated) => applySettingsState(updated))
        window.electronAPI.onSystemThemeUpdated?.((sys) => setSystemTheme(sys))
        window.electronAPI.onOSAccentUpdated?.((hex) => setOSAccentHex(hex))
        window.electronAPI.onTriggerNewNote(() => openCreateModal('note'))
        window.electronAPI.onTriggerClearClipboard(() => setShowClearConfirm(true))
        window.electronAPI.onTriggerCommandPalette?.(() => {
          setCommandPaletteOpen(true)
          setOmniQuery('')
        })
        window.electronAPI.onVaultStatusChanged?.((st) => {
          setVaultUnlocked(Boolean(st?.unlocked))
          if (!st?.unlocked) setVaultItems([])
        })
        window.electronAPI.onSecurityLockChanged?.((st) => {
          setIsAppSecurityLocked(Boolean(st?.isAppLocked))
        })
        window.electronAPI.onLicenseStatusChanged?.((st) => {
          if (st) setLicenseStatus(st)
        })
        window.electronAPI.onAIStreamChunk?.((payload) => {
          if (payload.done) {
            setStreamingText('')
          } else if (payload.chunk) {
            setStreamingText((prev) => prev + payload.chunk)
          }
        })
      } catch (err) {
        console.error('Init error:', err)
      }
    }
    init()
  }, [])

  // --- SYNC CSS VARIABLES FOR OS ACCENT COLOR, DUAL-LIGHT THEMES & LIQUID GLASS TINT/BLUR SLIDER ---
  const activeDualLight = useMemo(() => {
    return DUAL_LIGHT_PRESETS.find((p) => p.id === dualLightPreset) || DUAL_LIGHT_PRESETS[0]
  }, [dualLightPreset])

  const activeAccentHex = useMemo(() => {
    if (theme === 'light' || (theme === 'auto' && systemTheme === 'light')) {
      return activeDualLight.accentHex
    }
    if (accentColor === 'multicolor') return osAccentHex || '#007aff'
    const found = OS_THEME_COLORS.find((c) => c.id === accentColor)
    return found ? found.hex : '#007aff'
  }, [accentColor, osAccentHex, theme, systemTheme, activeDualLight])

  const activeFolderHex = useMemo(() => {
    if (folderColor === 'automatic' || folderColor === 'multicolor') return activeAccentHex
    const found = OS_THEME_COLORS.find((c) => c.id === folderColor)
    return found ? found.hex : '#007aff'
  }, [folderColor, activeAccentHex])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--df-accent', activeAccentHex)
    root.style.setProperty('--df-accent-soft', hexToRgba(activeAccentHex, 0.24))

    // Dynamic Glass Tint & Blur Intensity (10% Crystal Clear -> 95% Deep Frosted Tint)
    const norm = Math.max(0, Math.min(100, liquidGlassIntensity)) / 100
    const alpha = glassTintBlurEnabled ? (0.12 + norm * 0.80).toFixed(2) : '0.94'
    const cardAlpha = glassTintBlurEnabled ? (0.06 + norm * 0.28).toFixed(2) : '0.12'
    const blurPx = glassTintBlurEnabled ? `${Math.round(8 + norm * 68)}px` : '0px'
    const tintRgba = hexToRgba(activeAccentHex, glassTintBlurEnabled ? Number((0.08 + norm * 0.38).toFixed(2)) : 0.04)
    const sheenRgba = `rgba(255, 255, 255, ${glassTintBlurEnabled ? (0.06 + norm * 0.24).toFixed(2) : '0.04'})`

    root.style.setProperty('--df-liquid-alpha', alpha)
    root.style.setProperty('--df-liquid-card-alpha', cardAlpha)
    root.style.setProperty('--df-liquid-blur-px', blurPx)
    root.style.setProperty('--df-glass-tint-rgba', tintRgba)
    root.style.setProperty('--df-glass-sheen-rgba', sheenRgba)

    // Dual-Tone Light Background Theme Variables
    root.style.setProperty('--df-dual-bg', activeDualLight.drawerBg)
    root.style.setProperty('--df-dual-header', activeDualLight.headerBg)
    root.style.setProperty('--df-dual-subbar', activeDualLight.subbarBg)
    root.style.setProperty('--df-dual-card', activeDualLight.cardBg)
    root.style.setProperty('--df-dual-card-hover', activeDualLight.cardHoverBg)
    root.style.setProperty('--df-dual-input', activeDualLight.inputBg)
    root.style.setProperty('--df-dual-modal', activeDualLight.modalBg)
    root.style.setProperty('--df-dual-pill', activeDualLight.pillBg)
    root.style.setProperty('--df-dual-pill-hover', activeDualLight.pillHoverBg)
    root.style.setProperty('--df-dual-border', activeDualLight.borderRgba)
    root.style.setProperty('--df-dual-border-subtle', activeDualLight.borderSubtleRgba)
    root.style.setProperty('--df-dual-text-primary', activeDualLight.textPrimary)
    root.style.setProperty('--df-dual-text-secondary', activeDualLight.textSecondary)
    root.style.setProperty('--df-dual-text-muted', activeDualLight.textMuted)
  }, [activeAccentHex, liquidGlassIntensity, glassTintBlurEnabled, activeDualLight])

  const iconBadgeClass = useMemo(() => {
    if (iconStyle === 'dark') return 'df-icon-badge-dark'
    if (iconStyle === 'clear') return 'df-icon-badge-clear'
    if (iconStyle === 'tinted') return 'df-icon-badge-tinted'
    return 'df-icon-badge-default'
  }, [iconStyle])

  // --- HIGH-PERFORMANCE CLIPBOARD POLLING (With Sensitive Secret Guard) ---
  const monitorClipboard = useCallback(async () => {
    if (!trackingEnabled || !window.electronAPI) return
    try {
      let newItem: ClipboardEntry | null = null
      if (window.electronAPI.pollClipboardChange) {
        const poll = await window.electronAPI.pollClipboardChange()
        if (!poll.changed || !poll.content) return
        if (poll.type === 'text') {
          newItem = {
            id: `text-${Date.now()}`,
            type: 'text',
            format: detectTextFormat(poll.content),
            content: poll.content,
            timestamp: new Date(),
          }
        } else if (poll.type === 'image') {
          newItem = {
            id: `img-${Date.now()}`,
            type: 'image',
            format: 'image',
            content: poll.content,
            timestamp: new Date(),
          }
        }
      } else {
        const text = await window.electronAPI.getClipboardText()
        const image = await window.electronAPI.getClipboardImage()
        if (text && text.trim().length > 0) {
          newItem = {
            id: `text-${Date.now()}`,
            type: 'text',
            format: detectTextFormat(text),
            content: text,
            timestamp: new Date(),
          }
        } else if (image) {
          newItem = {
            id: `img-${Date.now()}`,
            type: 'image',
            format: 'image',
            content: image,
            timestamp: new Date(),
          }
        }
      }

      if (newItem) {
        setClipboardHistory((prev) => {
          if (prev.length > 0 && prev[0].content === newItem!.content) return prev
          const updated = [newItem!, ...prev.filter((item) => item.content !== newItem!.content).slice(0, clipboardLength - 1)]
          window.electronAPI.saveClipboardHistory(updated)
          return updated
        })
      }
    } catch {}
  }, [clipboardLength, trackingEnabled])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) monitorClipboard()
    }, 2000)
    return () => clearInterval(interval)
  }, [monitorClipboard])

  // --- FILE NAVIGATION WITH BACK / FORWARD / UP / BREADCRUMBS ---
  const loadFiles = async (targetPath: string, pushHistory = false) => {
    setFilesLoading(true)
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.readDirectory(targetPath)
        setFiles(data)
        setCurrentPath(targetPath)
        setSelectedFilePaths([])
        const stats = await window.electronAPI.getFolderStats(targetPath)
        setFolderStats(stats)

        if (pushHistory) {
          setNavHistory((prev) => {
            const sliced = prev.slice(0, navIndex + 1)
            if (sliced[sliced.length - 1] === targetPath) return sliced
            const next = [...sliced, targetPath]
            setNavIndex(next.length - 1)
            return next
          })
        }
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`)
    } finally {
      setFilesLoading(false)
    }
  }

  const navigateToFolder = async (targetPath: string) => {
    await loadFiles(targetPath, true)
  }

  const canGoBack = navIndex > 0
  const canGoForward = navIndex < navHistory.length - 1
  const parentFolderPath = useMemo(() => {
    const clean = currentPath.replace(/\/+$/, '')
    const lastSlash = clean.lastIndexOf('/')
    if (lastSlash <= 0) return '/'
    return clean.slice(0, lastSlash)
  }, [currentPath])
  const canGoUp = currentPath !== '/' && currentPath.length > 1

  const handleGoBack = () => {
    if (!canGoBack) return
    const prevIdx = navIndex - 1
    setNavIndex(prevIdx)
    loadFiles(navHistory[prevIdx], false)
  }

  const handleGoForward = () => {
    if (!canGoForward) return
    const nextIdx = navIndex + 1
    setNavIndex(nextIdx)
    loadFiles(navHistory[nextIdx], false)
  }

  const handleGoUp = () => {
    if (!canGoUp) return
    navigateToFolder(parentFolderPath)
  }

  const breadcrumbSegments = useMemo(() => {
    const rootClean = workspaceRoot.replace(/\/+$/, '')
    if (currentPath.startsWith(rootClean)) {
      const rel = currentPath.slice(rootClean.length).replace(/^\/+/, '')
      const parts = rel ? rel.split('/') : []
      const crumbs = [{ label: rootClean.split('/').pop() || 'OpenDesk PRO', path: rootClean }]
      let acc = rootClean
      for (const p of parts) {
        acc = `${acc}/${p}`
        crumbs.push({ label: p, path: acc })
      }
      return crumbs
    }
    const parts = currentPath.split('/').filter(Boolean)
    const crumbs: { label: string; path: string }[] = []
    let acc = ''
    for (const p of parts) {
      acc = `${acc}/${p}`
      crumbs.push({ label: p, path: acc })
    }
    return crumbs.slice(-4)
  }, [currentPath, workspaceRoot])

  const handleChooseFolder = async () => {
    const selected = await window.electronAPI.selectFolder()
    if (selected) {
      setWorkspaceRoot(selected)
      await navigateToFolder(selected)
      showToast(`Workspace: ${selected.split('/').pop()}`)
    }
  }

  // --- INLINE CREATION MODAL (Replaces broken window.prompt!) ---
  const openCreateModal = (type: 'folder' | 'file' | 'note') => {
    const defaultVal =
      type === 'folder'
        ? 'New Folder'
        : type === 'file'
        ? 'untitled.md'
        : `Note ${notes.length + 1}`
    setCreateModal({ type, defaultVal })
    setCreateInputVal(defaultVal)
  }

  const handleCommitCreate = async () => {
    if (!createModal) return
    const name = createInputVal.trim()
    if (!name) {
      setCreateModal(null)
      return
    }
    const { type } = createModal
    setCreateModal(null)

    try {
      if (type === 'folder') {
        await window.electronAPI.createFolder(`${currentPath}/${name}`)
        await loadFiles(currentPath, false)
        showToast(`Created folder "${name}"`)
      } else if (type === 'file') {
        await window.electronAPI.createFile({ filePath: `${currentPath}/${name}`, content: '' })
        await loadFiles(currentPath, false)
        showToast(`Created file "${name}"`)
      } else if (type === 'note') {
        const cleanTitle = name.replace(/\.md$/i, '')
        const body = `# ${cleanTitle}\n\n`
        lastLocalNoteSaveRef.current = Date.now()
        const res = await window.electronAPI.saveNote({ name: `${cleanTitle}.md`, content: body })
        const finalName = res.fileName || `${cleanTitle}.md`
        await refreshNotesMetadata(finalName)
        setActiveNoteName(finalName)
        setEditorContent(body)
        setNoteViewMode('edit')
        showToast(`Created note "${cleanTitle}"`)
        setTimeout(() => noteTextareaRef.current?.focus(), 40)
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`)
    }
  }

  const handleOpenFile = async (file: FileItem) => {
    if (file.isDirectory) {
      await navigateToFolder(file.path)
    } else {
      await window.electronAPI.openItem(file.path)
    }
  }

  const handleQuickLookPreview = async (file: FileItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (file.isDirectory) {
      await navigateToFolder(file.path)
      return
    }
    try {
      const data = await window.electronAPI.readFileContent(file.path)
      setPreviewFile({ ...data, name: file.name, path: file.path })
    } catch (err: any) {
      showToast(`Preview error: ${err.message}`)
    }
  }

  const addAttachmentToAI = (label: string, content: string) => {
    const clean = content.slice(0, 12000)
    setAIContextAttachment({ label, content: clean })
    setAIAttachments((prev) => {
      if (prev.some((a) => a.label === label)) {
        return prev.map((a) => (a.label === label ? { ...a, content: clean } : a))
      }
      return [...prev, { id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label, content: clean }]
    })
  }

  const handleAskAIAboutFile = async (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (file.isDirectory) return
    try {
      const data = await window.electronAPI.readFileContent(file.path)
      if (data.type === 'text' || data.type === 'markdown') {
        const ctx = { label: `File: ${file.name}`, content: data.content.slice(0, 12000) }
        addAttachmentToAI(ctx.label, ctx.content)
        if (layoutMode === 'tabbed') setActiveTab('ai')
        else if (layoutMode !== 'split4') setShowAIModal(true)
        runAIAction(`Analyze and summarize this file (${file.name}):`, ctx)
      } else {
        showToast('Select a text, markdown, or code file for AI analysis')
      }
    } catch (err: any) {
      showToast(err.message)
    }
  }

  // --- STAGING SHELF & MULTI-SELECT BATCH OPERATIONS ---
  const toggleSelectFile = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFilePaths((prev) =>
      prev.includes(filePath) ? prev.filter((p) => p !== filePath) : [...prev, filePath]
    )
  }

  const toggleShelfItem = (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setShelfPaths((prev) => {
      const exists = prev.includes(filePath)
      const next = exists ? prev.filter((p) => p !== filePath) : [...prev, filePath]
      window.electronAPI?.saveSettings({ shelfPaths: next })
      showToast(exists ? 'Removed from Drop Shelf' : 'Added to Drop Shelf (📥)')
      if (!exists) setShowShelfDrawer(true)
      return next
    })
  }

  const handleBatchStageSelected = () => {
    if (selectedFilePaths.length === 0) return
    const merged = Array.from(new Set([...shelfPaths, ...selectedFilePaths]))
    setShelfPaths(merged)
    window.electronAPI?.saveSettings({ shelfPaths: merged })
    setSelectedFilePaths([])
    setShowShelfDrawer(true)
    showToast(`Staged ${selectedFilePaths.length} item(s) to Drop Shelf`)
  }

  const handleBatchZip = async (pathsToZip: string[], label = 'Selected') => {
    if (pathsToZip.length === 0) return
    showToast(`Compressing ${pathsToZip.length} item(s)…`)
    const res = await window.electronAPI.batchArchiveItems({
      itemPaths: pathsToZip,
      targetDir: currentPath,
      archiveName: `OpenDesk_Pro_${label}_${new Date().toISOString().slice(0, 10)}`,
    })
    if (res.success) {
      await loadFiles(currentPath, false)
      showToast(`Created ZIP bundle (${res.count} items)`)
    }
  }

  const handleBatchMoveOrCopyShelfHere = async (copyOnly: boolean) => {
    if (shelfPaths.length === 0) return
    const res = await window.electronAPI.batchMoveItems({
      itemPaths: shelfPaths,
      targetDir: currentPath,
      copyOnly,
    })
    if (!copyOnly) {
      setShelfPaths([])
      window.electronAPI?.saveSettings({ shelfPaths: [] })
    }
    await loadFiles(currentPath, false)
    showToast(`${copyOnly ? 'Copied' : 'Moved'} ${res.count} item(s) into ${currentPath.split('/').pop()}`)
  }

  const handleBatchAttachToAI = async (pathsToAttach: string[]) => {
    let attached = 0
    for (const p of pathsToAttach) {
      try {
        const data = await window.electronAPI.readFileContent(p)
        if (data.type === 'text' || data.type === 'markdown') {
          const baseName = p.split('/').pop() || p
          addAttachmentToAI(`File: ${baseName}`, data.content)
          attached++
        }
      } catch {}
    }
    if (attached > 0) {
      if (layoutMode === 'tabbed') setActiveTab('ai')
      else if (layoutMode !== 'split4') setShowAIModal(true)
      showToast(`Attached ${attached} file(s) to AI Studio @Context`)
    } else {
      showToast('No readable text/code files in selection')
    }
  }

  const handleBatchDeleteSelected = async () => {
    if (selectedFilePaths.length === 0) return
    const res = await window.electronAPI.batchDeleteItems({ itemPaths: selectedFilePaths })
    setSelectedFilePaths([])
    await loadFiles(currentPath, false)
    showToast(
      `Moved ${res.deleted} item(s) to Trash${res.skippedLocked > 0 ? ` (${res.skippedLocked} locked skipped)` : ''}`
    )
  }

  const handleArchiveFile = async (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation()
    showToast(`Compressing "${file.name}"…`)
    await window.electronAPI.archiveItem(file.path)
    await loadFiles(currentPath, false)
    showToast(`Created ${file.name}.zip`)
  }

  const handleToggleFileLock = async (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await window.electronAPI.toggleFileLock(file.path)
    setLockedFiles((prev) => (res.locked ? [...prev, file.path] : prev.filter((p) => p !== file.path)))
    showToast(res.locked ? `Locked "${file.name}"` : `Unlocked "${file.name}"`)
  }

  const handleDeleteFileRequest = (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (lockedFiles.includes(file.path)) {
      showToast(`"${file.name}" is locked! Unlock first.`)
      return
    }
    setDeleteConfirmTarget({ type: 'file', name: file.name, path: file.path })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return
    const target = deleteConfirmTarget
    setDeleteConfirmTarget(null)
    try {
      if (target.type === 'file' && target.path) {
        await window.electronAPI.deleteItem(target.path)
        await loadFiles(currentPath, false)
        showToast(`Moved "${target.name}" to Trash`)
      } else if (target.type === 'note') {
        if (lockedNotes.includes(target.name)) {
          showToast(`"${target.name}" is locked! Unlock first.`)
          return
        }
        lastLocalNoteSaveRef.current = Date.now()
        await window.electronAPI.deleteNote({ name: target.name })
        const remaining = notes.filter((n) => n.name !== target.name)
        setNotes(remaining)
        if (activeNoteName === target.name) {
          if (remaining.length > 0) {
            setActiveNoteName(remaining[0].name)
            setEditorContent(remaining[0].content)
          } else {
            setActiveNoteName('')
            setEditorContent('')
            await refreshNotesMetadata()
          }
        }
        showToast(`Moved note "${target.name.replace(/\.md$/, '')}" to Trash`)
      }
    } catch (err: any) {
      showToast(err.message)
    }
  }

  const handleCommitRename = async () => {
    if (!renamingFile || !newFileName.trim() || newFileName.trim() === renamingFile.name) {
      setRenamingFile(null)
      return
    }
    const parentDir = renamingFile.path.substring(0, renamingFile.path.lastIndexOf('/'))
    await window.electronAPI.renameItem({ oldPath: renamingFile.path, newPath: `${parentDir}/${newFileName.trim()}` })
    setRenamingFile(null)
    await loadFiles(currentPath, false)
    showToast(`Renamed to "${newFileName.trim()}"`)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    const sourcePaths = droppedFiles.map((f: any) => f.path).filter(Boolean)
    if (sourcePaths.length > 0) {
      await window.electronAPI.stageDroppedFiles({ sourcePaths, targetDir: currentPath })
      await loadFiles(currentPath, false)
      showToast(`Staged ${sourcePaths.length} file(s)`)
    }
  }

  const handleAIOrganizeFolder = async () => {
    try {
      showToast('Sorting files into categories…')
      const res = await window.electronAPI.aiOrganizeFolder(currentPath)
      await loadFiles(currentPath, false)
      showToast(res.movedCount > 0 ? `Sorted ${res.movedCount} file(s)!` : 'Folder already organized!')
    } catch (err: any) {
      showToast(err.message)
    }
  }

  const handleScanAndRemoveDuplicates = async () => {
    try {
      showToast('Scanning workspace for duplicate files…')
      const scan = await window.electronAPI.scanDuplicateFiles(currentPath)
      if (scan.totalDuplicateFiles === 0) {
        showToast('✓ Zero duplicate files found in workspace!')
        return
      }
      const res = await window.electronAPI.removeDuplicateFiles(currentPath)
      await loadFiles(currentPath, false)
      showToast(
        `🧹 Removed ${res.removedCount} duplicate file(s) · Freed ${formatBytes(res.reclaimedBytes)}!`
      )
    } catch (err: any) {
      showToast(err.message || 'Duplicate scan failed')
    }
  }

  const handleDeduplicateClips = async () => {
    const seen = new Set<string>()
    const unique: ClipboardEntry[] = []
    for (const c of clipboardHistory) {
      const key = `${c.type}:${(c.content || '').trim()}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(c)
      }
    }
    const removed = clipboardHistory.length - unique.length
    if (removed > 0) {
      setClipboardHistory(unique)
      await window.electronAPI.saveClipboardHistory(unique)
      showToast(`🧹 Removed ${removed} duplicate clip(s)!`)
    } else {
      showToast('✓ Clipboard already has zero duplicates!')
    }
  }

  const filteredFiles = useMemo(() => {
    let result = files.filter((f) => f.name.toLowerCase().includes(fileSearch.toLowerCase()))
    if (fileCategory === 'docs') result = result.filter((f) => ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.xlsx', '.csv'].includes(f.extension))
    else if (fileCategory === 'images') result = result.filter((f) => ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(f.extension))
    else if (fileCategory === 'code') result = result.filter((f) => ['.ts', '.tsx', '.js', '.py', '.swift', '.json', '.html', '.css'].includes(f.extension))
    else if (fileCategory === 'archives') result = result.filter((f) => ['.zip', '.tar', '.gz', '.dmg'].includes(f.extension))
    else if (fileCategory === 'folders') result = result.filter((f) => f.isDirectory)

    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'date') cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime()
      else if (sortBy === 'size') cmp = a.size - b.size
      else if (sortBy === 'type') cmp = a.extension.localeCompare(b.extension)
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return result
  }, [files, fileSearch, fileCategory, sortBy, sortDirection])

  // --- ENTERPRISE NOTEPAD HANDLERS (Race-Free Auto-Save & Formatting) ---
  const isCurrentNoteLocked = activeNoteName ? lockedNotes.includes(activeNoteName) : false

  const selectNote = async (note: NoteItem) => {
    if (autoSaveTimerRef.current && activeNoteName) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
      lastLocalNoteSaveRef.current = Date.now()
      await window.electronAPI.saveNote({ name: activeNoteName, content: editorContent })
    }
    isTypingNoteRef.current = false
    setActiveNoteName(note.name)
    setEditorContent(note.content)
    setRenamingNoteTitle(false)
    setNoteSaveStatus('saved')
  }

  const handleCreateTemplateNote = async (titlePrefix: string, bodyTemplate: string) => {
    const uniqueTitle = `${titlePrefix} ${notes.length + 1}.md`
    lastLocalNoteSaveRef.current = Date.now()
    const res = await window.electronAPI.saveNote({ name: uniqueTitle, content: bodyTemplate })
    const savedName = res.fileName || uniqueTitle
    await refreshNotesMetadata(savedName)
    setActiveNoteName(savedName)
    setEditorContent(bodyTemplate)
    setNoteViewMode('edit')
    showToast(`Created "${savedName.replace(/\.md$/, '')}"`)
    setTimeout(() => noteTextareaRef.current?.focus(), 40)
  }

  const saveEditorContentNow = useCallback(
    async (nameToSave: string, textToSave: string) => {
      if (!nameToSave || !window.electronAPI) return
      try {
        setNoteSaveStatus('saving')
        lastLocalNoteSaveRef.current = Date.now()
        await window.electronAPI.saveNote({ name: nameToSave, content: textToSave })
        setNotes((prev) =>
          prev.map((n) => (n.name === nameToSave ? { ...n, content: textToSave, modified: new Date() } : n))
        )
        setNoteSaveStatus('saved')
      } catch (err) {
        console.error('Save note error:', err)
      } finally {
        isTypingNoteRef.current = false
      }
    },
    []
  )

  const handleNoteContentChange = (rawNextText: string) => {
    if (!activeNoteName || isCurrentNoteLocked) return
    isTypingNoteRef.current = true
    let nextText = rawNextText

    // Live Auto Spelling Correction on word boundary (space, newline, period, comma, semicolon)
    if (autoSpellCorrectEnabled && rawNextText.length > editorContent.length && /[\s.,;!?\n]$/.test(rawNextText)) {
      const spellRes = clientAutoCorrectAndMakeSentences(rawNextText, 'spell-only')
      if (spellRes.correctionsCount > 0) {
        nextText = spellRes.correctedText
      }
    }

    setEditorContent(nextText)
    if (noteSaveStatus !== 'dirty') setNoteSaveStatus('dirty')

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    const targetName = activeNoteName
    autoSaveTimerRef.current = setTimeout(() => {
      saveEditorContentNow(targetName, nextText)
    }, 650)
  }

  const handleRunSentenceMaker = async (customMode?: 'sentences' | 'bullets' | 'executive') => {
    if (!activeNoteName || isCurrentNoteLocked || !editorContent.trim()) return
    const targetMode = customMode || sentenceMakerMode
    try {
      let finalText = ''
      let corrCount = 0
      let sentCount = 0
      if (window.electronAPI?.makeSentencesAndSpellcheck) {
        const res = await window.electronAPI.makeSentencesAndSpellcheck({
          text: editorContent,
          mode: targetMode,
        })
        if (res?.success) {
          finalText = res.correctedText
          corrCount = res.correctionsCount
          sentCount = res.sentencesCount
        }
      }
      if (!finalText) {
        const fallback = clientAutoCorrectAndMakeSentences(editorContent, targetMode)
        finalText = fallback.correctedText
        corrCount = fallback.correctionsCount
        sentCount = fallback.sentencesCount
      }
      setEditorContent(finalText)
      setNotes((prev) => prev.map((n) => (n.name === activeNoteName ? { ...n, content: finalText } : n)))
      await saveEditorContentNow(activeNoteName, finalText)
      showToast(`✍️ Fixed ${corrCount} spelling item(s) & built ${sentCount} polished sentence(s) (${targetMode})`)
    } catch (err: any) {
      showToast(err?.message || 'Sentence maker failed')
    }
  }

  const insertNoteSyntax = (prefix: string, suffix = '', defaultSample = 'text') => {
    if (!activeNoteName || isCurrentNoteLocked) return
    const ta = noteTextareaRef.current
    if (!ta) {
      handleNoteContentChange(`${editorContent}\n${prefix}${defaultSample}${suffix}`)
      return
    }
    const start = ta.selectionStart ?? editorContent.length
    const end = ta.selectionEnd ?? editorContent.length
    const selected = editorContent.slice(start, end) || defaultSample
    const updated = editorContent.slice(0, start) + prefix + selected + suffix + editorContent.slice(end)
    handleNoteContentChange(updated)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
    }, 20)
  }

  const handleCommitNoteRename = async () => {
    setRenamingNoteTitle(false)
    const clean = noteTitleDraft.trim()
    if (!clean || !activeNoteName) return
    const desiredName = clean.endsWith('.md') || clean.endsWith('.txt') ? clean : `${clean}.md`
    if (desiredName === activeNoteName) return
    try {
      lastLocalNoteSaveRef.current = Date.now()
      const res = await window.electronAPI.renameNote({ oldName: activeNoteName, newName: desiredName })
      const finalName = res.fileName || desiredName
      setActiveNoteName(finalName)
      await refreshNotesMetadata(finalName)
      showToast(`Renamed note to "${finalName.replace(/\.md$/, '')}"`)
    } catch (err: any) {
      showToast(err.message)
    }
  }

  const handleToggleCheckbox = (lineIndex: number) => {
    if (!activeNoteName || isCurrentNoteLocked) return
    const lines = editorContent.split('\n')
    if (lineIndex < 0 || lineIndex >= lines.length) return
    const line = lines[lineIndex]
    if (line.trim().startsWith('- [ ] ')) lines[lineIndex] = line.replace('- [ ] ', '- [x] ')
    else if (line.trim().startsWith('- [x] ') || line.trim().startsWith('- [X] ')) {
      lines[lineIndex] = line.replace(/- \[[xX]\] /, '- [ ] ')
    }
    handleNoteContentChange(lines.join('\n'))
  }

  const filteredNotes = useMemo(() => {
    return notes.filter(
      (n) =>
        n.name.toLowerCase().includes(noteSearch.toLowerCase()) ||
        n.content.toLowerCase().includes(noteSearch.toLowerCase())
    )
  }, [notes, noteSearch])

  // --- CLIPBOARD & POWER DEVELOPER UTILITIES HANDLERS ---
  const filteredClipboard = useMemo(() => {
    return clipboardHistory.filter((item) => {
      const matchesSearch =
        item.type === 'text'
          ? item.content.toLowerCase().includes(clipSearch.toLowerCase())
          : 'image screenshot'.includes(clipSearch.toLowerCase())
      let matchesCat = true
      if (clipboardCategory === 'favorites') matchesCat = !!item.isFavorite
      else if (clipboardCategory === 'text') matchesCat = item.type === 'text' && item.format === 'plain'
      else if (clipboardCategory === 'image') matchesCat = item.type === 'image'
      else if (clipboardCategory === 'code') matchesCat = item.format === 'code'
      else if (clipboardCategory === 'url') matchesCat = item.format === 'url'
      return matchesSearch && matchesCat
    })
  }, [clipboardHistory, clipSearch, clipboardCategory])

  const handleAddCustomClip = async () => {
    const val = newClipText.trim()
    if (!val) {
      setNewClipOpen(false)
      return
    }
    const entry: ClipboardEntry = {
      id: `custom-${Date.now()}`,
      type: 'text',
      format: detectTextFormat(val),
      content: val,
      timestamp: new Date(),
      isFavorite: true,
    }
    const updated = [entry, ...clipboardHistory.filter((c) => c.content !== val)]
    setClipboardHistory(updated)
    await window.electronAPI.saveClipboardHistory(updated)
    await window.electronAPI.writeClipboardText(val)
    setNewClipText('')
    setNewClipOpen(false)
    showToast('Saved pinned snippet & copied to clipboard')
  }

  const handleTransformClip = async (item: ClipboardEntry, mode: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.type !== 'text') return
    try {
      const res = await window.electronAPI.transformClipboardText({ text: item.content, mode })
      if (!res.success) {
        showToast(`Transform error: ${res.error}`)
        return
      }
      const updated = clipboardHistory.map((c) =>
        c.id === item.id ? { ...c, content: res.result, format: detectTextFormat(res.result) } : c
      )
      setClipboardHistory(updated)
      await window.electronAPI.saveClipboardHistory(updated)
      await window.electronAPI.writeClipboardText(res.result)
      showToast(`Applied ${mode} & copied!`)
    } catch (err: any) {
      showToast(err.message)
    }
  }

  const handleMergeSelectedClips = async () => {
    const selectedItems = clipboardHistory.filter((c) => selectedClipIds.includes(c.id) && c.type === 'text')
    if (selectedItems.length < 2) {
      showToast('Select at least 2 text clips to merge')
      return
    }
    const mergedText = selectedItems.map((c) => c.content).join('\n\n')
    const mergedEntry: ClipboardEntry = {
      id: `merged-${Date.now()}`,
      type: 'text',
      format: detectTextFormat(mergedText),
      content: mergedText,
      timestamp: new Date(),
      isFavorite: true,
    }
    const updated = [mergedEntry, ...clipboardHistory]
    setClipboardHistory(updated)
    setSelectedClipIds([])
    await window.electronAPI.saveClipboardHistory(updated)
    await window.electronAPI.writeClipboardText(mergedText)
    showToast(`Merged ${selectedItems.length} clips & copied!`)
  }

  const handleSaveClipAsFile = async (item: ClipboardEntry, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (item.type === 'image') {
        await window.electronAPI.saveClipboardImageToFile({ dataUrl: item.content, targetDir: currentPath })
      } else {
        const ext = item.format === 'code' ? '.ts' : '.txt'
        const fileName = `Clip_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}${ext}`
        await window.electronAPI.createFile({ filePath: `${currentPath}/${fileName}`, content: item.content })
      }
      await loadFiles(currentPath, false)
      showToast('Saved clip to active Files folder!')
    } catch (err: any) {
      showToast(err.message)
    }
  }

  // --- AI EXECUTION ENGINE (Multi-Attachment @Context + Streaming) ---
  const runAIAction = async (promptText: string, contextOverride?: { label: string; content: string }) => {
    if (!promptText.trim()) return
    const ctx = contextOverride || aiContextAttachment
    const mergedAttachments: { label: string; content: string }[] = [
      ...aiAttachments.map((a) => ({ label: a.label, content: a.content })),
    ]
    if (ctx && ctx.content && !mergedAttachments.some((a) => a.label === ctx.label && a.content === ctx.content)) {
      mergedAttachments.push({ label: ctx.label, content: ctx.content })
    }

    const contextLabels = mergedAttachments.map((a) => a.label).join(', ')
    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: contextLabels ? `[${contextLabels}] ${promptText}` : promptText,
      timestamp: new Date(),
    }
    setAIMessages((prev) => [...prev, userMsg])
    setAIPromptInput('')
    setAILoading(true)
    setStreamingText('')
    const startedAt = Date.now()
    const cleanConfig = sanitizeRendererAIConfig(aiConfig)

    try {
      const res = await window.electronAPI.aiChatCompletion({
        prompt: promptText,
        attachments: mergedAttachments,
        customConfig: cleanConfig,
      })
      const latencyMs = Math.max(1, Date.now() - startedAt)

      const replyText = res.success
        ? res.text || '(Empty response)'
        : `⚠️ AI Error (${cleanConfig.provider.toUpperCase()}): ${res.error}`

      setAIMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          timestamp: new Date(),
          provider: cleanConfig.provider,
          model: res.model || cleanConfig.model,
          latencyMs,
        },
      ])
    } catch (err: any) {
      setAIMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ Error: ${err.message}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setAILoading(false)
      setStreamingText('')
    }
  }

  const triggerQuickAI = (actionPrompt: string, label: string, content: string) => {
    const ctx = { label, content }
    addAttachmentToAI(label, content)
    if (layoutMode === 'tabbed') setActiveTab('ai')
    else if (layoutMode !== 'split4') setShowAIModal(true)
    runAIAction(actionPrompt, ctx)
  }

  const updateAIConfig = (patch: Partial<AIConfig>) => {
    const updated = sanitizeRendererAIConfig({ ...aiConfig, ...patch })
    setAIConfig(updated)
    window.electronAPI.saveSettings({ aiConfig: updated })
  }

  const resolvedThemeClass = useMemo(() => {
    if (theme === 'liquid') return 'theme-liquid'
    if (theme === 'solid' || theme === 'dark' || theme === 'aurora' || theme === 'nord' || theme === 'solarized' || theme === 'obsidian') return 'theme-solid'
    if (theme === 'light') return 'theme-light'
    return systemTheme === 'light' ? 'theme-light' : 'theme-dark'
  }, [theme, systemTheme])

  // --- GLOBAL COMMAND PALETTE (⌘K) OMNI-SEARCH RESULTS (Decoupled from 1s Pomodoro ticks) ---
  const omniResults = useMemo(() => {
    if (!commandPaletteOpen) return []
    const q = omniQuery.trim().toLowerCase()
    const items: {
      id: string
      category: 'actions' | 'files' | 'notes' | 'clipboard'
      icon: string
      title: string
      subtitle: string
      onSelect: () => void
    }[] = []

    // 1. Quick Actions
    const actions = [
      {
        id: 'act-open-vault',
        icon: '🔐',
        title: 'Open Dedicated Encrypted Vault (AES-256-GCM)',
        subtitle: `PBKDF2-HMAC-SHA512 (210k iterations) · ${vaultUnlocked ? 'Unlocked' : 'Locked'}`,
        onSelect: () => {
          refreshVaultStatus()
          if (layoutMode === 'tabbed') setActiveTab('vault')
          else setShowVaultModal(true)
        },
      },
      {
        id: 'act-toggle-strict-privacy',
        icon: '🛡️',
        title: strictPrivacyMode
          ? 'Disable Strict Privacy Mode (Allow Cloud AI)'
          : 'Enable Strict Privacy Mode (Air-Gapped Local AI Only)',
        subtitle: 'Enforce 100% on-device AI processing & PII/Secret redaction shield',
        onSelect: () => {
          const next = !strictPrivacyMode
          setStrictPrivacyMode(next)
          window.electronAPI.saveSettings({ strictPrivacyMode: next })
          showToast(next ? '🛡️ Strict Privacy Mode Enabled (Air-Gapped)' : 'Strict Privacy Mode Disabled')
        },
      },
      {
        id: 'act-lock-app',
        icon: '🔒',
        title: 'Lock Entire Workspace Drawer (AES-256-GCM Security Lock ⌘L)',
        subtitle: 'Hides all panes behind encrypted lock screen & zeroes active keys',
        onSelect: async () => {
          await window.electronAPI.securityLockApp?.()
          setIsAppSecurityLocked(true)
          setVaultUnlocked(false)
          setVaultItems([])
          showToast('🔒 Full-Workspace Security Lock Activated')
        },
      },
      {
        id: 'act-csprng-gen',
        icon: '🎲',
        title: 'Generate Military-Grade CSPRNG Password / API Secret',
        subtitle: '256-bit entropy generator inside Dedicated Vault Studio',
        onSelect: async () => {
          const gen = await window.electronAPI.generateCsprngSecret?.({ mode: 'password', length: 28 })
          if (gen?.success) {
            setGeneratedSecretData(gen)
            setShowVaultModal(true)
          }
        },
      },
      {
        id: 'act-scan-leaks',
        icon: '🕵️',
        title: 'Scan Workspace & Notes for Exposed API Keys / Secrets',
        subtitle: 'Detects plaintext tokens, PEM keys & JWTs across active files',
        onSelect: async () => {
          const res = await window.electronAPI.scanWorkspaceSecrets?.(currentPath)
          if (res?.success) {
            setSecretScanFindings(res.findings || [])
            setShowVaultModal(true)
            showToast(`🕵️ Scanned ${res.scannedFilesCount} files: ${res.findings.length} secret(s) detected`)
          }
        },
      },
      {
        id: 'act-enc-backup',
        icon: '📦',
        title: 'Export Encrypted Workspace Snapshot (.dfbackup)',
        subtitle: 'AES-256-GCM encrypted backup of Notes, Tasks & Vault',
        onSelect: async () => {
          const res = await window.electronAPI.exportEncryptedSnapshot?.()
          if (res?.success) {
            showToast(`📦 Exported ${res.fileName} to Vault`)
          }
        },
      },
      {
        id: 'act-recall-snapshot',
        icon: '⏪',
        title: 'Recall & Restore Encrypted Workspace Snapshot (.dfbackup)',
        subtitle: 'Restores Notes, Quick Tasks, Prompts & Vault records from latest .dfbackup',
        onSelect: async () => {
          const res = await window.electronAPI.recallEncryptedSnapshot?.()
          if (res?.success) {
            await refreshNotesMetadata()
            await refreshVaultStatus()
            showToast(`⏪ Recalled ${res.fileName} (${res.restoredNotesCount} notes restored)`)
          } else {
            showToast(res?.error || 'No snapshot found to recall')
          }
        },
      },
      {
        id: 'act-recall-license',
        icon: '💎',
        title: 'Recall & Activate Commercial Lifetime License (ODENT / ODPRO)',
        subtitle: 'Restores verified commercial license & generates receipt',
        onSelect: async () => {
          const res = await window.electronAPI.recallCommercialLicense?.({ tier: 'ENT' })
          if (res?.success) {
            setLicenseStatus(res.status)
            showToast(`💎 Commercial License Active (${res.licenseKey})`)
          }
        },
      },
      {
        id: 'act-panic-wipe',
        icon: '🔥',
        title: 'Emergency Privacy Panic Wipe (Lock Vault & Purge Cache)',
        subtitle: 'Zeroes Vault keys in memory, clears non-pinned clips & staging shelf',
        onSelect: async () => {
          await window.electronAPI.panicWipePrivacy?.()
          const favs = clipboardHistory.filter((c) => c.isFavorite)
          setClipboardHistory(favs)
          setShelfPaths([])
          await refreshVaultStatus()
          showToast('🔥 Privacy Panic Wipe Complete — Vault Locked & Cache Purged')
        },
      },
      {
        id: 'act-sort',
        icon: '🗂️',
        title: 'AI Auto-Sort Current Folder',
        subtitle: `Organize files in ${currentPath.split('/').pop()}`,
        onSelect: () => handleAIOrganizeFolder(),
      },
      {
        id: 'act-dedupe-files',
        icon: '🧹',
        title: 'Scan & Remove Duplicate Files (SHA-256)',
        subtitle: `Keep newest copy and reclaim disk space in ${currentPath.split('/').pop()}`,
        onSelect: () => handleScanAndRemoveDuplicates(),
      },
      {
        id: 'act-dedupe-clips',
        icon: '✨',
        title: 'Deduplicate Clipboard History',
        subtitle: 'Remove duplicate copied snippets in one click',
        onSelect: () => handleDeduplicateClips(),
      },
      {
        id: 'act-pomo',
        icon: '⏱️',
        title: pomoRunning ? 'Pause Pomodoro Focus Timer' : 'Start 25m Pomodoro Focus Timer',
        subtitle: `Current timer: ${formatTimer(pomoSecondsLeftRef.current)}`,
        onSelect: () => setPomoRunning(!pomoRunning),
      },
      {
        id: 'act-daily-note',
        icon: '📅',
        title: 'Create Daily Standup & Focus Note',
        subtitle: 'Insert structured daily template into Notepad',
        onSelect: () =>
          handleCreateTemplateNote(
            'Daily Focus',
            `# Daily Focus — ${new Date().toISOString().slice(0, 10)}\n\n## Top 3 Priorities\n- [ ] Priority 1\n- [ ] Priority 2\n- [ ] Priority 3\n\n## Notes & Blockers\n- \n`
          ),
      },
      {
        id: 'act-sum-note',
        icon: '✨',
        title: 'AI Summarize Active Note',
        subtitle: activeNoteName || 'Quick Scratchpad',
        onSelect: () =>
          triggerQuickAI('Summarize the key points concisely:', `Note: ${activeNoteName}`, editorContent),
      },
      {
        id: 'act-reset-split',
        icon: '⚖️',
        title: 'Reset Resizable Split Pane Widths',
        subtitle: 'Restore balanced multi-column layout proportions',
        onSelect: () => resetSplitWidths(),
      },
    ]

    if (omniCategory === 'all' || omniCategory === 'actions') {
      for (const a of actions) {
        if (!q || a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)) {
          items.push({ ...a, category: 'actions' })
        }
      }
    }

    // 2. Files
    if (omniCategory === 'all' || omniCategory === 'files') {
      for (const f of files) {
        if (!q || f.name.toLowerCase().includes(q)) {
          items.push({
            id: `file-${f.path}`,
            category: 'files',
            icon: f.isDirectory ? '📁' : getFileIcon(f.extension),
            title: f.name,
            subtitle: f.isDirectory ? 'Open Folder' : `${formatBytes(f.size)} · Quick Look / Open`,
            onSelect: () => {
              if (f.isDirectory) navigateToFolder(f.path)
              else handleQuickLookPreview(f)
            },
          })
        }
      }
    }

    // 3. Notes
    if (omniCategory === 'all' || omniCategory === 'notes') {
      for (const n of notes) {
        if (!q || n.name.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) {
          items.push({
            id: `note-${n.name}`,
            category: 'notes',
            icon: '📝',
            title: n.name.replace(/\.md$/, ''),
            subtitle: n.content.replace(/\n+/g, ' ').slice(0, 70),
            onSelect: () => {
              selectNote(n)
              if (layoutMode === 'tabbed') setActiveTab('notes')
            },
          })
        }
      }
    }

    // 4. Clipboard
    if (omniCategory === 'all' || omniCategory === 'clipboard') {
      for (const c of clipboardHistory) {
        if (c.type === 'text' && (!q || c.content.toLowerCase().includes(q))) {
          items.push({
            id: `clip-${c.id}`,
            category: 'clipboard',
            icon: '📋',
            title: c.content.slice(0, 65),
            subtitle: `Copy ${c.format || 'text'} snippet to clipboard`,
            onSelect: async () => {
              await window.electronAPI.writeClipboardText(c.content)
              showToast('Copied from Omni-Search!')
            },
          })
        }
      }
    }

    return items.slice(0, 24)
  }, [commandPaletteOpen, omniQuery, omniCategory, files, notes, clipboardHistory, currentPath, pomoRunning, activeNoteName, editorContent])

  // ==========================================================================
  // COLUMN 1: POWER CLIPBOARD PANE (6 Slates, Color Swatch, Dev Transforms, Merge)
  // ==========================================================================
  const renderClipboardPane = () => (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      <div className="df-pane-header h-9 px-2.5 flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold tracking-tight df-text-primary truncate">📋 Clipboard</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full df-pill font-mono shrink-0">
            {filteredClipboard.length}
          </span>
        </div>

        <div className="flex items-center gap-1 no-drag shrink-0">
          {selectedClipIds.length >= 2 && (
            <button
              onClick={handleMergeSelectedClips}
              title="Merge selected clips into one snippet"
              className="px-1.5 py-0.5 rounded df-pill-active text-[10px] font-bold"
            >
              🔗 Merge ({selectedClipIds.length})
            </button>
          )}
          <button
            onClick={() => setNewClipOpen(!newClipOpen)}
            title="Add Custom Pinned Snippet"
            className={`px-1.5 py-0.5 rounded text-xs font-bold ${newClipOpen ? 'df-pill-active' : 'df-pill'}`}
          >
            +
          </button>
          <button
            onClick={handleDeduplicateClips}
            title="Remove Duplicate Clipboard Items"
            className="px-1.5 py-0.5 rounded df-pill text-[10px]"
          >
            🧹
          </button>
          <button
            onClick={() => setClipSearchOpen(!clipSearchOpen)}
            title="Filter Clipboard"
            className={`px-1.5 py-0.5 rounded text-xs ${clipSearchOpen ? 'df-pill-active' : 'df-pill'}`}
          >
            🔍
          </button>
          <button
            onClick={() => {
              const next = !trackingEnabled
              setTrackingEnabled(next)
              window.electronAPI.saveSettings({ trackingEnabled: next })
              showToast(next ? 'Clipboard tracking active' : 'Clipboard tracking paused')
            }}
            title={trackingEnabled ? 'Tracking Active (Click to Pause)' : 'Tracking Paused'}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              trackingEnabled ? 'df-pill text-emerald-400' : 'df-pill text-amber-400'
            }`}
          >
            {trackingEnabled ? '● Live' : '⏸'}
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            title="Clear Clipboard History"
            className="px-1.5 py-0.5 rounded df-pill text-xs hover:text-red-400"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 6-Slate Filter Bar */}
      <div className="px-2 py-1 df-subbar flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 no-drag">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'favorites', label: '★ Saved' },
            { id: 'text', label: 'Text' },
            { id: 'code', label: '💻 Code' },
            { id: 'url', label: '🔗 Links' },
            { id: 'image', label: '🖼️ Images' },
          ] as const
        ).map((slate) => (
          <button
            key={slate.id}
            onClick={() => setClipboardCategory(slate.id)}
            className={`px-2 py-0.5 rounded-md text-[10px] shrink-0 transition-all ${
              clipboardCategory === slate.id ? 'df-pill-active shadow-sm' : 'df-pill'
            }`}
          >
            {slate.label}
          </button>
        ))}
      </div>

      {newClipOpen && (
        <div className="px-2.5 py-1.5 df-subbar flex items-center gap-1.5 shrink-0 no-drag">
          <input
            autoFocus
            type="text"
            placeholder="Paste or type snippet to pin (or hex color #007aff)..."
            value={newClipText}
            onChange={(e) => setNewClipText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCustomClip()
              if (e.key === 'Escape') setNewClipOpen(false)
            }}
            className="flex-1 df-input px-2 py-1 text-xs min-w-0"
          />
          <button onClick={handleAddCustomClip} className="px-2 py-1 df-pill-active rounded text-[10px] shrink-0">
            Save
          </button>
        </div>
      )}

      {clipSearchOpen && (
        <div className="px-2.5 py-1.5 df-subbar flex items-center gap-1.5 shrink-0 no-drag">
          <input
            autoFocus
            type="text"
            placeholder="Filter clipboard history..."
            value={clipSearch}
            onChange={(e) => setClipSearch(e.target.value)}
            className="flex-1 df-input px-2 py-0.5 text-xs min-w-0"
          />
          {clipSearch && (
            <button onClick={() => setClipSearch('')} className="text-xs df-text-muted px-1 shrink-0">
              ✕
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto df-row-divider">
        {filteredClipboard.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center df-text-muted text-xs gap-1">
            <span>No items in "{clipboardCategory}" slate</span>
            <span className="text-[10px]">Copy text, code, links, colors, or images (⌘+C) or click +</span>
          </div>
        ) : (
          filteredClipboard.map((item) => {
            const swatch = item.type === 'text' ? detectColorSwatch(item.content) : null
            const isSelected = selectedClipIds.includes(item.id)
            return (
              <div
                key={item.id}
                onClick={async () => {
                  if (item.type === 'text') {
                    await window.electronAPI.writeClipboardText(item.content)
                    showToast('Copied text to clipboard (Double-click to Copy & Retract)')
                  } else if (item.type === 'image') {
                    await window.electronAPI.writeClipboardImage(item.content)
                    showToast('Copied image to clipboard')
                  }
                }}
                onDoubleClick={async () => {
                  await window.electronAPI.pasteAndHide({ type: item.type, content: item.content })
                }}
                className="group relative flex flex-col gap-1.5 p-2.5 hover:bg-blue-500/10 cursor-pointer transition-colors min-w-0 overflow-hidden"
              >
                <div className="flex items-start gap-2 min-w-0 w-full">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedClipIds((prev) =>
                        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                      )
                    }}
                    title="Select clip for multi-merge"
                    className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 mt-1 ${
                      isSelected ? 'df-pill-active' : 'df-pill opacity-60 group-hover:opacity-100'
                    }`}
                  >
                    {isSelected ? '✓' : ''}
                  </button>

                  <div
                    className={`w-7 h-7 rounded-lg ${iconBadgeClass} flex items-center justify-center text-sm shrink-0 shadow-sm mt-0.5`}
                  >
                    {swatch ? (
                      <span
                        className="w-4 h-4 rounded-full border border-white/40 shadow-inner"
                        style={{ background: swatch }}
                      />
                    ) : item.format === 'url' ? (
                      '🧭'
                    ) : item.format === 'code' ? (
                      '💻'
                    ) : item.type === 'image' ? (
                      '🖼️'
                    ) : (
                      '📋'
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {item.type === 'text' ? (
                      <div className="text-xs leading-snug line-clamp-2 font-sans break-words df-text-primary">
                        {item.content}
                      </div>
                    ) : (
                      <img src={item.content} className="h-12 max-w-full object-contain rounded df-card p-0.5" />
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5 text-[9px] df-text-muted truncate">
                      <span className="uppercase font-mono">{swatch ? `COLOR ${swatch}` : item.format || item.type}</span>
                      <span>·</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0 no-drag">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const updated = clipboardHistory.map((c) =>
                          c.id === item.id ? { ...c, isFavorite: !c.isFavorite } : c
                        )
                        setClipboardHistory(updated)
                        window.electronAPI.saveClipboardHistory(updated)
                      }}
                      title="Pin / Favorite"
                      className={`p-1 text-xs ${
                        item.isFavorite ? 'text-amber-400 font-bold' : 'df-text-muted opacity-60 group-hover:opacity-100'
                      }`}
                    >
                      ★
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const updated = clipboardHistory.filter((c) => c.id !== item.id)
                        setClipboardHistory(updated)
                        window.electronAPI.saveClipboardHistory(updated)
                      }}
                      title="Remove Clip"
                      className="p-1 text-xs df-text-muted hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Dedicated Non-Overlapping Bottom Action & Developer Transform Bar */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5 text-[9px] no-drag overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        await window.electronAPI.pasteAndHide({ type: item.type, content: item.content })
                      }}
                      title="Unclutter Auto-Paste: Copy & Retract Drawer to Active App"
                      className="px-1.5 py-0.2 rounded df-pill-active font-medium"
                    >
                      ⚡ Paste
                    </button>
                    {item.type === 'text' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNoteContentChange(editorContent ? `${editorContent}\n\n${item.content}` : item.content)
                            showToast('Inserted clip into active Note')
                          }}
                          className="px-1.5 py-0.2 rounded df-pill font-medium"
                        >
                          +Note
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerQuickAI(
                              item.format === 'code'
                                ? 'Explain and review this code snippet:'
                                : 'Summarize and polish this clipboard text:',
                              'Clipboard Snippet',
                              item.content
                            )
                          }}
                          className="px-1.5 py-0.2 rounded df-pill-active"
                        >
                          ✨ AI
                        </button>
                        <button
                          onClick={(e) => handleTransformClip(item, 'json-pretty', e)}
                          title="Format / Pretty-Print JSON"
                          className="px-1.5 py-0.2 rounded df-pill font-mono"
                        >
                          {'{ }'}
                        </button>
                        <button
                          onClick={(e) => handleTransformClip(item, 'base64-encode', e)}
                          title="Base64 Encode"
                          className="px-1.5 py-0.2 rounded df-pill font-mono"
                        >
                          B64
                        </button>
                        <button
                          onClick={(e) => handleTransformClip(item, 'uppercase', e)}
                          title="UPPERCASE"
                          className="px-1.5 py-0.2 rounded df-pill font-mono"
                        >
                          AA
                        </button>
                        <button
                          onClick={(e) => handleTransformClip(item, 'slugify', e)}
                          title="Convert to URL-safe kebab-case slug"
                          className="px-1.5 py-0.2 rounded df-pill font-mono"
                        >
                          Slug
                        </button>
                        <button
                          onClick={(e) => handleTransformClip(item, 'sha256', e)}
                          title="Compute SHA-256 Digest"
                          className="px-1.5 py-0.2 rounded df-pill font-mono"
                        >
                          SHA
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await window.electronAPI.vaultSaveItem?.({
                                title: `Clip ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                                category: item.format === 'code' ? 'key' : 'secret',
                                content: item.content,
                              })
                              const updated = clipboardHistory.filter((c) => c.id !== item.id)
                              setClipboardHistory(updated)
                              window.electronAPI.saveClipboardHistory(updated)
                              await refreshVaultStatus()
                              showToast('🔐 Encrypted clip into Dedicated Vault & purged from clipboard history')
                            } catch (err: any) {
                              setShowVaultModal(true)
                              showToast(err?.message || 'Unlock Vault to store secret')
                            }
                          }}
                          title="Encrypt into Dedicated AES-256-GCM Vault & Purge from Clipboard"
                          className="px-1.5 py-0.2 rounded df-pill font-medium"
                        >
                          🔐 Vault
                        </button>
                      </>
                    )}
                    {item.format === 'url' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          window.electronAPI.openExternalUrl(item.content.trim())
                        }}
                        className="px-1.5 py-0.2 df-pill rounded"
                      >
                        🌐 Open
                      </button>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleSaveClipAsFile(item, e)}
                    title="Save Clip as File in Dropzone"
                    className="px-1.5 py-0.2 df-pill rounded shrink-0"
                  >
                    💾 File
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  // ==========================================================================
  // COLUMN 2: FILES DROPZONE PANE (Zero-Overlap Grid/List + Staging Shelf + Batch Bar)
  // ==========================================================================
  const renderFilesPane = () => (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(false)
      }}
      onDrop={handleDrop}
      className="flex flex-col h-full w-full min-w-0 overflow-hidden relative"
    >
      {isDraggingOver && (
        <div
          className="absolute inset-2 border-2 border-dashed z-50 flex flex-col items-center justify-center pointer-events-none rounded-2xl animate-pulse"
          style={{ background: 'var(--df-accent-soft)', borderColor: 'var(--df-accent)' }}
        >
          <div className="w-14 h-14 rounded-2xl df-card flex items-center justify-center text-3xl mb-2 shadow-xl">
            ⬇️
          </div>
          <span className="text-sm font-bold df-text-primary">Drop files here to stage in OpenDesk PRO</span>
        </div>
      )}

      {/* Files Header with Back, Forward, Up & Folder Selector */}
      <div className="df-pane-header h-9 px-2.5 flex items-center justify-between gap-1 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-0 no-drag shrink-0">
          <button
            disabled={!canGoBack}
            onClick={handleGoBack}
            title="Back"
            className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${
              canGoBack ? 'df-pill cursor-pointer' : 'df-pill opacity-35 cursor-not-allowed'
            }`}
          >
            ←
          </button>
          <button
            disabled={!canGoForward}
            onClick={handleGoForward}
            title="Forward"
            className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${
              canGoForward ? 'df-pill cursor-pointer' : 'df-pill opacity-35 cursor-not-allowed'
            }`}
          >
            →
          </button>
          <button
            disabled={!canGoUp}
            onClick={handleGoUp}
            title="Up to Parent Folder"
            className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${
              canGoUp ? 'df-pill cursor-pointer' : 'df-pill opacity-35 cursor-not-allowed'
            }`}
          >
            ↑
          </button>

          <select
            value={currentPath}
            onChange={(e) => {
              if (e.target.value === '__custom__') handleChooseFolder()
              else navigateToFolder(e.target.value)
            }}
            className="df-input px-1.5 py-0.5 text-[10px] max-w-[125px] truncate ml-0.5"
          >
            <option value={systemFolders.deskFolder || workspaceRoot}>OpenDesk PRO Workspace</option>
            {systemFolders.projects && <option value={systemFolders.projects}>Projects</option>}
            {systemFolders.desktop && <option value={systemFolders.desktop}>Desktop</option>}
            {systemFolders.downloads && <option value={systemFolders.downloads}>Downloads</option>}
            {systemFolders.documents && <option value={systemFolders.documents}>Documents</option>}
            {systemFolders.receipts && <option value={systemFolders.receipts}>Receipts</option>}
            {systemFolders.screenshots && <option value={systemFolders.screenshots}>Screenshots</option>}
            {!Object.values(systemFolders).includes(currentPath) && (
              <option value={currentPath}>{currentPath.split('/').pop() || currentPath}</option>
            )}
            <option value="__custom__">Choose Folder…</option>
          </select>
        </div>

        <div className="flex items-center gap-1 no-drag shrink-0">
          <button
            onClick={() => setShowShelfDrawer(!showShelfDrawer)}
            title="Toggle Temporary Drop Staging Shelf"
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5 ${
              showShelfDrawer || shelfPaths.length > 0 ? 'df-pill-active' : 'df-pill'
            }`}
          >
            <span>📥</span>
            <span>{shelfPaths.length}</span>
          </button>
          <button onClick={() => openCreateModal('folder')} title="New Folder" className="px-1.5 py-0.5 rounded df-pill text-[11px]">
            📁+
          </button>
          <button onClick={() => openCreateModal('file')} title="New File" className="px-1.5 py-0.5 rounded df-pill text-[11px]">
            📄+
          </button>
          <button
            onClick={handleAIOrganizeFolder}
            title="AI Auto-Sort Files into Category Folders"
            className="px-1.5 py-0.5 rounded df-pill text-[10px] font-medium"
          >
            🗂️
          </button>
          <button
            onClick={handleScanAndRemoveDuplicates}
            title="Scan & Remove Duplicate Files (Keep Newest Copy)"
            className="px-1.5 py-0.5 rounded df-pill text-[10px] font-medium"
          >
            🧹
          </button>
          <button
            onClick={() => window.electronAPI.openTerminal(currentPath)}
            title="Open in Terminal"
            className="px-1.5 py-0.5 rounded df-pill text-[10px] font-mono"
          >
            &gt;_
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            title="Toggle Grid / List View"
            className="px-1.5 py-0.5 rounded df-pill text-xs"
          >
            {viewMode === 'grid' ? '☰' : '☷'}
          </button>
          <button
            onClick={() => setFileSearchOpen(!fileSearchOpen)}
            title="Search & Filter Files"
            className={`px-1.5 py-0.5 rounded text-xs ${fileSearchOpen ? 'df-pill-active' : 'df-pill'}`}
          >
            🔍
          </button>
        </div>
      </div>

      {/* Clickable Breadcrumb Path Bar */}
      <div className="px-2.5 py-1 df-subbar flex items-center justify-between gap-1 text-[10px] shrink-0 no-drag overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => navigateToFolder(systemFolders.deskFolder || workspaceRoot)}
            title="Jump to Workspace Root"
            className="px-1.5 py-0.2 rounded df-pill text-[10px] shrink-0"
          >
            🏠
          </button>
          {breadcrumbSegments.map((seg, i) => (
            <React.Fragment key={seg.path}>
              {i > 0 && <span className="df-text-muted shrink-0">/</span>}
              <button
                onClick={() => navigateToFolder(seg.path)}
                className={`px-1.5 py-0.2 rounded truncate max-w-[105px] shrink-0 ${
                  i === breadcrumbSegments.length - 1 ? 'df-pill-active' : 'df-pill'
                }`}
              >
                {seg.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              if (selectedFilePaths.length === filteredFiles.length && filteredFiles.length > 0) {
                setSelectedFilePaths([])
              } else {
                setSelectedFilePaths(filteredFiles.map((f) => f.path))
              }
            }}
            title="Select / Deselect All in Folder"
            className="px-1.5 py-0.2 rounded df-pill text-[9px]"
          >
            {selectedFilePaths.length > 0 ? `☑ ${selectedFilePaths.length}` : '☐ All'}
          </button>
          <button
            onClick={() => {
              const order: ('name' | 'date' | 'size' | 'type')[] = ['name', 'date', 'size', 'type']
              const nextSort = order[(order.indexOf(sortBy) + 1) % order.length]
              setSortBy(nextSort)
              window.electronAPI.saveSettings({ sortBy: nextSort })
            }}
            title="Cycle Sort Field (Name / Date / Size / Type)"
            className="px-1.5 py-0.2 rounded df-pill text-[9px] font-mono capitalize"
          >
            Sort: {sortBy}
          </button>
          <button
            onClick={() => {
              const nextDir = sortDirection === 'asc' ? 'desc' : 'asc'
              setSortDirection(nextDir)
              window.electronAPI.saveSettings({ sortDirection: nextDir })
            }}
            title="Toggle Sort Direction"
            className="px-1.5 py-0.2 rounded df-pill text-[9px] font-mono"
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Multi-Select Batch Action Toolbar */}
      {selectedFilePaths.length > 0 && (
        <div className="px-2.5 py-1 df-subbar flex items-center justify-between gap-1 text-[10px] shrink-0 no-drag overflow-x-auto no-scrollbar">
          <span className="font-semibold df-text-primary shrink-0">{selectedFilePaths.length} selected:</span>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleBatchStageSelected} className="px-2 py-0.5 rounded df-pill-active">
              📥 +Shelf
            </button>
            <button onClick={() => handleBatchZip(selectedFilePaths, 'Selected')} className="px-2 py-0.5 rounded df-pill">
              📦 Zip
            </button>
            <button onClick={() => handleBatchAttachToAI(selectedFilePaths)} className="px-2 py-0.5 rounded df-pill">
              ✨ +AI
            </button>
            <button
              onClick={handleBatchDeleteSelected}
              className="px-2 py-0.5 rounded bg-red-600/80 text-white font-medium"
            >
              🗑️ Trash
            </button>
            <button onClick={() => setSelectedFilePaths([])} className="px-1.5 py-0.5 rounded df-pill">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Temporary Drop Staging Shelf (Stage files across folders before moving/zipping) */}
      {showShelfDrawer && (
        <div className="px-2.5 py-2 df-subbar flex flex-col gap-1.5 shrink-0 no-drag">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-bold df-text-primary flex items-center gap-1">
              <span>📥</span> Drop Staging Shelf ({shelfPaths.length} items)
            </span>
            <div className="flex items-center gap-1">
              {shelfPaths.length > 0 && (
                <>
                  <button
                    onClick={() => handleBatchMoveOrCopyShelfHere(false)}
                    title="Move all shelf items into current folder"
                    className="px-1.5 py-0.2 rounded df-pill-active"
                  >
                    Move Here
                  </button>
                  <button
                    onClick={() => handleBatchMoveOrCopyShelfHere(true)}
                    title="Copy all shelf items into current folder"
                    className="px-1.5 py-0.2 rounded df-pill"
                  >
                    Copy Here
                  </button>
                  <button
                    onClick={() => handleBatchZip(shelfPaths, 'Shelf')}
                    title="Bundle all shelf items into a ZIP file here"
                    className="px-1.5 py-0.2 rounded df-pill"
                  >
                    📦 Zip
                  </button>
                  <button
                    onClick={() => handleBatchAttachToAI(shelfPaths)}
                    title="Attach all shelf files to AI Studio"
                    className="px-1.5 py-0.2 rounded df-pill"
                  >
                    ✨ AI
                  </button>
                  <button
                    onClick={() => {
                      setShelfPaths([])
                      window.electronAPI?.saveSettings({ shelfPaths: [] })
                    }}
                    className="px-1.5 py-0.2 rounded df-pill hover:text-red-400"
                  >
                    Clear
                  </button>
                </>
              )}
              <button onClick={() => setShowShelfDrawer(false)} className="px-1 df-text-muted">
                ▲
              </button>
            </div>
          </div>
          {shelfPaths.length === 0 ? (
            <div className="text-[10px] df-text-muted italic">
              Click 📥 on any file across folders to stage it here for batch move, copy, zip, or AI analysis.
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {shelfPaths.map((sp) => (
                <div
                  key={sp}
                  draggable
                  onDragStart={(e) => {
                    e.preventDefault()
                    window.electronAPI?.startNativeDrag(sp)
                  }}
                  title="Drag out to Finder, Desktop, Mail, or Slack"
                  className="px-2 py-0.5 rounded-md df-card flex items-center gap-1 text-[10px] shrink-0 max-w-[150px] cursor-grab active:cursor-grabbing"
                >
                  <span className="truncate">{sp.split('/').pop()}</span>
                  <button onClick={(e) => toggleShelfItem(sp, e)} className="df-text-muted hover:text-red-400">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {fileSearchOpen && (
        <div className="px-2.5 py-1.5 df-subbar flex items-center gap-1.5 shrink-0 no-drag overflow-x-auto no-scrollbar">
          <input
            autoFocus
            type="text"
            placeholder="Filter files..."
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            className="flex-1 df-input px-2 py-0.5 text-xs min-w-[90px]"
          />
          {(['all', 'folders', 'docs', 'images', 'code', 'archives'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFileCategory(cat)}
              className={`px-1.5 py-0.5 rounded text-[10px] capitalize shrink-0 ${
                fileCategory === cat ? 'df-pill-active' : 'df-pill'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Main Files Area — Strictly Non-Overlapping Grid & List Views */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {filesLoading ? (
          <div className="h-full flex items-center justify-center df-text-muted text-xs">Loading folder…</div>
        ) : filteredFiles.length === 0 ? (
          <div
            className="h-full flex flex-col items-center justify-center df-text-muted text-xs gap-2 border border-dashed rounded-xl p-4 text-center"
            style={{ borderColor: 'var(--df-border)' }}
          >
            <span className="text-2xl">📥</span>
            <span className="font-medium df-text-secondary">This folder is empty</span>
            <div className="flex items-center gap-2 mt-1">
              {canGoBack && (
                <button onClick={handleGoBack} className="px-2.5 py-1 df-pill-active rounded-lg text-[10px]">
                  ← Go Back
                </button>
              )}
              <button onClick={() => openCreateModal('file')} className="px-2.5 py-1 df-pill rounded-lg text-[10px]">
                + New File
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="df-files-grid">
            {filteredFiles.map((file, i) => {
              const isLocked = lockedFiles.includes(file.path)
              const isSelected = selectedFilePaths.includes(file.path)
              const inShelf = shelfPaths.includes(file.path)
              return (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    e.preventDefault()
                    window.electronAPI?.startNativeDrag(file.path)
                  }}
                  onClick={() => {
                    if (file.isDirectory) navigateToFolder(file.path)
                  }}
                  onDoubleClick={() => handleOpenFile(file)}
                  className={`df-card df-file-card cursor-pointer ${
                    isSelected ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {/* 1. Dedicated Top Status & Selection Row — Never Overlaps Icon */}
                  <div className="df-file-top-bar no-drag">
                    <button
                      onClick={(e) => toggleSelectFile(file.path, e)}
                      title="Select for batch operation"
                      className={`w-4 h-4 rounded flex items-center justify-center text-[9px] shrink-0 ${
                        isSelected ? 'df-pill-active' : 'df-pill'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </button>
                    <div className="flex items-center gap-1 min-w-0">
                      {isLocked && (
                        <span className="text-[9px]" title="Locked">
                          🔒
                        </span>
                      )}
                      <span className="px-1 py-0.2 df-pill text-[8px] font-bold uppercase rounded truncate">
                        {file.isDirectory ? 'DIR' : (file.extension || '.file').replace('.', '')}
                      </span>
                    </div>
                  </div>

                  {/* 2. Unobstructed Center Icon Box */}
                  <div className={`df-file-icon-box ${iconBadgeClass}`}>
                    {file.isDirectory ? (
                      <MacOSFolderIcon colorHex={activeFolderHex} size={30} />
                    ) : (
                      <span className="text-xl leading-none">{getFileIcon(file.extension)}</span>
                    )}
                  </div>

                  {/* 3. Clean Truncated Filename & Size */}
                  <div className="df-file-name df-text-primary" title={file.name}>
                    {file.name}
                  </div>
                  <div className="df-file-meta df-text-muted">
                    {file.isDirectory ? 'Open Folder →' : formatBytes(file.size)}
                  </div>

                  {/* 4. Dedicated Bottom Action Dock — Never Overlaps Icon or Filename */}
                  <div className="df-file-actions-bar no-drag">
                    {!file.isDirectory && (
                      <>
                        <button
                          onClick={(e) => handleQuickLookPreview(file, e)}
                          title="Quick Look Preview"
                          className="p-0.5 rounded df-pill text-[9px]"
                        >
                          👁️
                        </button>
                        <button
                          onClick={(e) => handleAskAIAboutFile(file, e)}
                          title="Analyze with AI"
                          className="p-0.5 rounded df-pill-active text-[9px]"
                        >
                          ✨
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await window.electronAPI.vaultEncryptFile?.({
                                filePath: file.path,
                                removeOriginal: false,
                              })
                              await refreshVaultStatus()
                              showToast(`🔐 Encrypted "${file.name}" to Dedicated Vault (AES-256-GCM)`)
                            } catch (err: any) {
                              setShowVaultModal(true)
                              showToast(err?.message || 'Unlock Vault first to encrypt file')
                            }
                          }}
                          title="Encrypt File into Dedicated Vault (AES-256-GCM)"
                          className="p-0.5 rounded df-pill text-[9px]"
                        >
                          🔐
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const res = await window.electronAPI.secureShredFile?.(file.path)
                              if (res?.success) {
                                await loadFiles(currentPath, false)
                                showToast(`🔥 3-Pass Cryptographically Shredded "${file.name}"`)
                              }
                            } catch (err: any) {
                              showToast(err?.message || 'Shred failed')
                            }
                          }}
                          title="DoD 3-Pass Cryptographic File Shredder (Permanent Unrecoverable Wipe)"
                          className="p-0.5 rounded df-pill text-[9px] hover:text-red-400"
                        >
                          🔥
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => toggleShelfItem(file.path, e)}
                      title={inShelf ? 'Remove from Drop Shelf' : 'Stage to Drop Shelf'}
                      className={`p-0.5 rounded text-[9px] ${inShelf ? 'df-pill-active' : 'df-pill'}`}
                    >
                      📥
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRenamingFile(file)
                        setNewFileName(file.name)
                      }}
                      title="Rename"
                      className="p-0.5 rounded df-pill text-[9px]"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => handleDeleteFileRequest(file, e)}
                      title="Move to Trash"
                      className="p-0.5 rounded df-pill text-[9px] hover:text-red-400"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="df-row-divider">
            {filteredFiles.map((file, i) => {
              const isLocked = lockedFiles.includes(file.path)
              const isSelected = selectedFilePaths.includes(file.path)
              const inShelf = shelfPaths.includes(file.path)
              return (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    e.preventDefault()
                    window.electronAPI?.startNativeDrag(file.path)
                  }}
                  onClick={() => {
                    if (file.isDirectory) navigateToFolder(file.path)
                  }}
                  onDoubleClick={() => handleOpenFile(file)}
                  className="df-list-row hover:bg-blue-500/10 rounded-lg cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      onClick={(e) => toggleSelectFile(file.path, e)}
                      className={`w-4 h-4 rounded flex items-center justify-center text-[9px] shrink-0 no-drag ${
                        isSelected ? 'df-pill-active' : 'df-pill'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </button>
                    <div className={`w-7 h-7 rounded-lg ${iconBadgeClass} flex items-center justify-center shrink-0`}>
                      {file.isDirectory ? (
                        <MacOSFolderIcon colorHex={activeFolderHex} size={20} />
                      ) : (
                        <span className="text-sm">{getFileIcon(file.extension)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate df-text-primary" title={file.name}>
                        {file.name} {isLocked && '🔒'}
                      </div>
                      <div className="text-[10px] df-text-muted truncate">
                        {file.isDirectory ? 'Folder' : formatBytes(file.size)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 no-drag">
                    {!file.isDirectory && (
                      <>
                        <button
                          onClick={(e) => handleQuickLookPreview(file, e)}
                          className="px-1.5 py-0.5 df-pill rounded text-[10px]"
                        >
                          👁️
                        </button>
                        <button
                          onClick={(e) => handleAskAIAboutFile(file, e)}
                          className="px-1.5 py-0.5 df-pill-active rounded text-[10px]"
                        >
                          ✨
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => toggleShelfItem(file.path, e)}
                      className={`px-1.5 py-0.5 rounded text-[10px] ${inShelf ? 'df-pill-active' : 'df-pill'}`}
                    >
                      📥
                    </button>
                    <button
                      onClick={(e) => handleArchiveFile(file, e)}
                      title="Compress ZIP"
                      className="px-1.5 py-0.5 df-pill rounded text-[10px]"
                    >
                      📦
                    </button>
                    <button
                      onClick={(e) => handleToggleFileLock(file, e)}
                      title="Lock/Unlock"
                      className="px-1.5 py-0.5 df-pill rounded text-[10px]"
                    >
                      {isLocked ? '🔒' : '🔓'}
                    </button>
                    <button
                      onClick={(e) => handleDeleteFileRequest(file, e)}
                      className="px-1.5 py-0.5 df-pill rounded text-[10px] hover:text-red-400"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div
        className="px-3 py-1 df-subbar flex items-center justify-between text-[10px] df-text-muted font-mono shrink-0"
        style={{ borderTop: '1px solid var(--df-border-subtle)', borderBottom: 'none' }}
      >
        <span className="truncate">
          {folderStats.folderCount} folders · {folderStats.fileCount} files ({formatBytes(folderStats.totalSize)})
        </span>
        <button
          onClick={() => window.electronAPI.showInFolder(currentPath)}
          className="df-text-secondary hover:underline no-drag shrink-0"
        >
          Open in Finder ↗
        </button>
      </div>
    </div>
  )

  // ==========================================================================
  // COLUMN 3: ENTERPRISE NOTEPAD PANE (Templates, Interactive Tables & Auto-Save)
  // ==========================================================================
  const renderNotesPane = () => (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      <div className="df-pane-header h-9 px-2.5 flex items-center justify-between gap-1 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-0 no-drag">
          <span className="text-xs font-semibold df-text-primary shrink-0">📝 Notes</span>
          {activeNoteName &&
            (renamingNoteTitle ? (
              <input
                autoFocus
                value={noteTitleDraft}
                onChange={(e) => setNoteTitleDraft(e.target.value)}
                onBlur={handleCommitNoteRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitNoteRename()
                  if (e.key === 'Escape') setRenamingNoteTitle(false)
                }}
                className="df-input px-1.5 py-0.5 text-xs w-28"
              />
            ) : (
              <button
                onClick={() => {
                  setNoteTitleDraft(activeNoteName.replace(/\.md$/, ''))
                  setRenamingNoteTitle(true)
                }}
                title="Click to rename note"
                className="text-[11px] df-text-secondary hover:underline truncate max-w-[125px] text-left"
              >
                — {activeNoteName.replace(/\.md$/, '')} ✏️
              </button>
            ))}
        </div>

        <div className="flex items-center gap-1 no-drag shrink-0">
          <button
            onClick={() => openCreateModal('note')}
            title="Create New Note"
            className="px-2 py-0.5 rounded df-pill-active text-[10px] font-bold"
          >
            + New
          </button>
          <button
            onClick={() => setShowNotesListDrawer(!showNotesListDrawer)}
            title="All Notes Drawer"
            className={`px-1.5 py-0.5 rounded text-xs ${showNotesListDrawer ? 'df-pill-active' : 'df-pill'}`}
          >
            ☰
          </button>
          <button
            onClick={() => setNoteViewMode(noteViewMode === 'edit' ? 'preview' : 'edit')}
            title="Toggle Edit / Interactive Markdown & Table Preview"
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              noteViewMode === 'preview' ? 'df-pill-active' : 'df-pill'
            }`}
          >
            {noteViewMode === 'preview' ? 'Edit' : 'Preview'}
          </button>
          {activeNoteName && (
            <button
              onClick={() =>
                triggerQuickAI(
                  'Improve, organize, and extract key action items (- [ ]) from this note:',
                  `Note: ${activeNoteName}`,
                  editorContent
                )
              }
              title="AI Polish / Extract Tasks"
              className="px-1.5 py-0.5 rounded df-pill-active text-[10px]"
            >
              ✨ AI
            </button>
          )}
          <button
            onClick={() => setNoteSearchOpen(!noteSearchOpen)}
            title="Search Notes"
            className={`px-1.5 py-0.5 rounded text-xs ${noteSearchOpen ? 'df-pill-active' : 'df-pill'}`}
          >
            🔍
          </button>
        </div>
      </div>

      {/* Horizontal Note Switcher Tabs & Daily Scratchpad Templates */}
      <div className="px-2 py-1 df-subbar flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 no-drag">
        {notes.map((n) => (
          <button
            key={n.name}
            onClick={() => selectNote(n)}
            className={`px-2 py-0.5 rounded-md text-[10px] shrink-0 max-w-[110px] truncate transition-all ${
              activeNoteName === n.name ? 'df-pill-active shadow-sm' : 'df-pill'
            }`}
          >
            {n.name.replace(/\.md$/, '')}
          </button>
        ))}
        <button
          onClick={() =>
            handleCreateTemplateNote(
              'Daily Standup',
              `# Daily Standup — ${new Date().toISOString().slice(0, 10)}\n\n## Top Priorities\n- [ ] Complete core milestone\n- [ ] Review staged files\n\n## Metrics Table\n| Task | Owner | Status |\n| :--- | :--- | :--- |\n| Release Build | Team | In Progress |\n`
            )
          }
          title="Create Daily Standup Note with Table"
          className="px-1.5 py-0.5 rounded-md df-pill text-[9px] shrink-0 ml-auto"
        >
          +📅 Daily
        </button>
        <button
          onClick={() =>
            handleCreateTemplateNote(
              'Meeting Sync',
              '# Meeting Sync\n\n## Key Discussion\n- \n\n## Action Items\n- [ ] Follow up with team\n- [ ] Share summary\n'
            )
          }
          title="Create Meeting Note"
          className="px-1.5 py-0.5 rounded-md df-pill text-[9px] shrink-0"
        >
          +📋 Meeting
        </button>
        <button
          onClick={() =>
            handleCreateTemplateNote(
              'Checklist',
              '# Daily Action Checklist\n\n- [ ] Top priority task\n- [ ] Review staged files\n- [ ] Clear completed items\n'
            )
          }
          title="Create Task Checklist"
          className="px-1.5 py-0.5 rounded-md df-pill text-[9px] shrink-0"
        >
          +☑ Tasks
        </button>
      </div>

      {/* Formatting & Action Toolbar */}
      <div className="px-2 py-1 df-subbar flex items-center justify-between gap-1 shrink-0 no-drag text-[10px] overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => insertNoteSyntax('**', '**', 'bold')}
            title="Bold"
            className="px-1.5 py-0.2 rounded df-pill font-bold"
          >
            B
          </button>
          <button
            onClick={() => insertNoteSyntax('*', '*', 'italic')}
            title="Italic"
            className="px-1.5 py-0.2 rounded df-pill italic"
          >
            I
          </button>
          <button
            onClick={() => insertNoteSyntax('\n## ', '\n', 'Heading')}
            title="Heading"
            className="px-1.5 py-0.2 rounded df-pill font-semibold"
          >
            H2
          </button>
          <button
            onClick={() => insertNoteSyntax('\n- [ ] ', '', 'New task item')}
            title="Insert Interactive Checkbox Task"
            className="px-1.5 py-0.2 rounded df-pill"
          >
            ☑ Task
          </button>
          <button
            onClick={() =>
              insertNoteSyntax(
                '\n| Column 1 | Column 2 | Status |\n| :--- | :--- | :--- |\n| ',
                ' | Value | Active |\n',
                'Item 1'
              )
            }
            title="Insert Markdown Table"
            className="px-1.5 py-0.2 rounded df-pill"
          >
            📊 Table
          </button>
          <button
            onClick={() => insertNoteSyntax('\n```\n', '\n```\n', '// code')}
            title="Insert Code Block"
            className="px-1.5 py-0.2 rounded df-pill font-mono"
          >
            &lt;/&gt;
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              const next = !autoSpellCorrectEnabled
              setAutoSpellCorrectEnabled(next)
              window.electronAPI.saveSettings({ autoSpellCorrectEnabled: next })
              showToast(next ? '✍️ Live Auto Spelling Correction Enabled' : 'Auto Spelling Correction Paused')
            }}
            title="Toggle Live Auto Spelling Correction While Typing"
            className={`px-1.5 py-0.2 rounded font-semibold ${autoSpellCorrectEnabled ? 'df-pill-active' : 'df-pill'}`}
          >
            ✍️ {autoSpellCorrectEnabled ? 'Auto-Spell ON' : 'Spell OFF'}
          </button>
          <button
            onClick={() => handleRunSentenceMaker()}
            title="Fix All Spelling Mistakes & Turn Fragments into Complete Sentences"
            className="px-1.5 py-0.2 rounded df-pill-active font-semibold"
          >
            ✨ Sentence Maker
          </button>
          <button
            onClick={async () => {
              const res = await window.electronAPI.triggerAppIntegration?.({
                integrationId: 'obsidian',
                noteName: activeNoteName,
              })
              showToast(res?.message || 'Synced note with Obsidian Vault')
            }}
            title="Sync & Open Note in Integrated App (Obsidian / VS Code)"
            className="px-1.5 py-0.2 rounded df-pill"
          >
            🔗 Sync
          </button>
          <button
            onClick={async () => {
              await window.electronAPI.writeClipboardText(editorContent)
              showToast('Copied note to clipboard')
            }}
            title="Copy Entire Note"
            className="px-1.5 py-0.2 rounded df-pill"
          >
            📋 Copy
          </button>
          <button
            onClick={async () => {
              const res = await window.electronAPI.exportFileDialog({
                defaultName: activeNoteName || 'note.md',
                content: editorContent,
              })
              if (res.success) showToast('Exported note!')
            }}
            title="Export Note to Disk"
            className="px-1.5 py-0.2 rounded df-pill"
          >
            💾
          </button>
          {activeNoteName && (
            <button
              onClick={() => setDeleteConfirmTarget({ type: 'note', name: activeNoteName })}
              title="Delete Current Note"
              className="px-1.5 py-0.2 rounded df-pill hover:text-red-400"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {noteSearchOpen && (
        <div className="px-2.5 py-1.5 df-subbar flex items-center gap-1.5 shrink-0 no-drag">
          <input
            autoFocus
            type="text"
            placeholder="Search across all notes..."
            value={noteSearch}
            onChange={(e) => {
              setNoteSearch(e.target.value)
              setShowNotesListDrawer(true)
            }}
            className="flex-1 df-input px-2 py-0.5 text-xs min-w-0"
          />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {showNotesListDrawer && (
          <div className="w-44 df-subbar df-pane-divider flex flex-col shrink-0 z-20" style={{ borderBottom: 'none' }}>
            <div className="flex-1 overflow-y-auto df-row-divider">
              {filteredNotes.map((n, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    selectNote(n)
                    setShowNotesListDrawer(false)
                  }}
                  className={`p-2 cursor-pointer text-xs flex items-center justify-between group ${
                    activeNoteName === n.name ? 'df-pill-active' : 'df-text-secondary hover:bg-blue-500/10'
                  }`}
                >
                  <span className="truncate">{n.name.replace(/\.md$/, '')}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirmTarget({ type: 'note', name: n.name })
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeNoteName ? (
            noteViewMode === 'edit' ? (
              <textarea
                ref={noteTextareaRef}
                readOnly={isCurrentNoteLocked}
                spellCheck={autoSpellCorrectEnabled}
                value={editorContent}
                onChange={(e) => handleNoteContentChange(e.target.value)}
                onBlur={() => {
                  if (noteSaveStatus === 'dirty' && activeNoteName) {
                    saveEditorContentNow(activeNoteName, editorContent)
                  }
                }}
                placeholder="Write notes, action items (- [ ]), Markdown tables, or code snippets (Auto-Spell & ✨ Sentence Maker active)..."
                className="flex-1 w-full p-3.5 bg-transparent resize-none focus:outline-none text-xs leading-relaxed font-sans df-text-primary select-text"
              />
            ) : (
              <MarkdownPreview
                content={editorContent}
                onToggleCheckbox={handleToggleCheckbox}
                onWikiLinkClick={(title) => {
                  const match = notes.find((n) => n.name.toLowerCase().includes(title.toLowerCase()))
                  if (match) selectNote(match)
                  else handleCreateTemplateNote(title, `# ${title}\n\n`)
                }}
              />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center df-text-muted text-xs gap-2">
              <span>No note selected</span>
              <button onClick={() => openCreateModal('note')} className="px-3 py-1 df-pill-active rounded-lg text-xs">
                + Create Note
              </button>
            </div>
          )}
        </div>
      </div>

      {activeNoteName && (
        <div
          className="px-3 py-1 df-subbar flex items-center justify-between text-[10px] df-text-muted font-mono shrink-0"
          style={{ borderTop: '1px solid var(--df-border-subtle)', borderBottom: 'none' }}
        >
          <span className="truncate">
            {editorContent.split(/\s+/).filter(Boolean).length} words · {editorContent.length} chars · ~{Math.max(1, Math.ceil(editorContent.split(/\s+/).filter(Boolean).length / 200))}m read ·{' '}
            {noteSaveStatus === 'saved' ? '✓ saved' : noteSaveStatus === 'saving' ? 'saving…' : '● unsaved'}
          </span>
          <div className="flex items-center gap-2 no-drag shrink-0">
            <button
              onClick={() => {
                addAttachmentToAI(`Note: ${activeNoteName}`, editorContent)
                showToast('Attached Note to AI @Context')
              }}
              className="df-text-secondary hover:underline"
            >
              +AI Context
            </button>
            <button
              onClick={() => saveEditorContentNow(activeNoteName, editorContent)}
              title="Save Now"
              className="df-text-secondary hover:underline"
            >
              Save
            </button>
            <button
              onClick={async () => {
                const res = await window.electronAPI.toggleNoteLock(activeNoteName)
                setLockedNotes((prev) =>
                  res.locked ? [...prev, activeNoteName] : prev.filter((n) => n !== activeNoteName)
                )
                showToast(res.locked ? 'Note locked (read-only)' : 'Note unlocked')
              }}
              title="Lock/Unlock Note"
              className="df-text-secondary"
            >
              {isCurrentNoteLocked ? '🔒' : '🔓'}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // ==========================================================================
  // COLUMN 4 / TAB: ENTERPRISE AI STUDIO (14 Free Providers Only, Multi-Context)
  // ==========================================================================
  const renderAIHubPane = () => {
    const availableModels =
      aiConfig.provider === 'ollama'
        ? localStatus.ollamaModels.length > 0
          ? localStatus.ollamaModels
          : ['llama3.2', 'qwen2.5-coder', 'deepseek-r1', 'mistral']
        : aiConfig.provider === 'lmstudio'
        ? localStatus.lmstudioModels.length > 0
          ? localStatus.lmstudioModels
          : ['local-model']
        : aiConfig.provider === 'omniroute' &&
          localStatus.omnirouteModels &&
          localStatus.omnirouteModels.length > 0
        ? localStatus.omnirouteModels
        : CLOUD_MODEL_PRESETS[aiConfig.provider] || ['deskfolder-pro-v3']

    return (
      <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
        <div className="df-pane-header h-9 px-2.5 flex items-center justify-between gap-1 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold df-text-primary">✨ AI Studio</span>
            <span
              className={`w-2 h-2 rounded-full ${
                aiConfig.provider === 'builtin' || aiConfig.provider === 'freecloud'
                  ? 'bg-emerald-500'
                  : aiConfig.provider === 'ollama'
                  ? localStatus.ollamaOnline
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              title="100% Free AI Engine Ready"
            />
          </div>

          <div className="flex items-center gap-1 no-drag shrink-0">
            <select
              value={aiConfig.provider}
              onChange={(e) => {
                const nextProvider = e.target.value as AIConfig['provider']
                const defaultModel =
                  nextProvider === 'ollama'
                    ? localStatus.ollamaModels[0] || 'llama3.2'
                    : nextProvider === 'lmstudio'
                    ? localStatus.lmstudioModels[0] || 'local-model'
                    : nextProvider === 'omniroute' && localStatus.omnirouteModels?.[0]
                    ? localStatus.omnirouteModels[0]
                    : CLOUD_MODEL_PRESETS[nextProvider]?.[0] || 'deskfolder-pro-v3'
                updateAIConfig({ provider: nextProvider, model: defaultModel })
              }}
              className="df-input px-1.5 py-0.5 text-[10px] max-w-[138px]"
            >
              <option value="builtin">⚡ Built-in Smart AI (Free Offline)</option>
              <option value="freecloud">🌐 Free Cloud AI (No Key Required)</option>
              <option value="openrouter">🆓 OpenRouter (:free Models)</option>
              <option value="nvidia">🟢 Nvidia NIM (Free Tier)</option>
              <option value="omniroute">🧭 OmniRoute (Free AI Router)</option>
              <option value="groq">⚡ Groq Cloud (Free Tier)</option>
              <option value="gemini">☁️ Google Gemini (Free Tier)</option>
              <option value="cerebras">🚀 Cerebras Fast AI (Free Tier)</option>
              <option value="sambanova">🔥 SambaNova Cloud (Free Tier)</option>
              <option value="github">🐙 GitHub Models (Free Tier)</option>
              <option value="huggingface">🤗 Hugging Face (Free Inference)</option>
              <option value="mistral">🌪️ Mistral / Codestral (Free Tier)</option>
              <option value="ollama">🏠 Local: Ollama (Free Offline)</option>
              <option value="lmstudio">🏠 Local: LM Studio (Free Offline)</option>
            </select>

            <select
              value={aiConfig.model}
              onChange={(e) => updateAIConfig({ model: e.target.value })}
              className="df-input px-1.5 py-0.5 text-[10px] max-w-[110px] truncate font-mono"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowSettingsModal(true)}
              title="Configure Free AI Provider Keys"
              className="px-1.5 py-0.5 df-pill rounded text-[10px]"
            >
              🔑
            </button>
          </div>
        </div>

        {/* One-Click Enterprise AI Action Chips + Custom Presets */}
        <div className="px-2 py-1 df-subbar flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 no-drag">
          <button
            onClick={() => {
              const ctx = aiContextAttachment || (editorContent ? { label: `Note: ${activeNoteName}`, content: editorContent } : undefined)
              runAIAction('Summarize the key points concisely:', ctx)
            }}
            className="px-2 py-0.5 rounded-md df-pill text-[10px] shrink-0"
          >
            📝 Summarize
          </button>
          <button
            onClick={() => {
              const ctx = aiContextAttachment || (editorContent ? { label: `Note: ${activeNoteName}`, content: editorContent } : undefined)
              runAIAction('Extract actionable checklist tasks (- [ ]) from this:', ctx)
            }}
            className="px-2 py-0.5 rounded-md df-pill text-[10px] shrink-0"
          >
            ☑ Tasks
          </button>
          <button
            onClick={() => {
              const ctx = aiContextAttachment || (editorContent ? { label: `Note: ${activeNoteName}`, content: editorContent } : undefined)
              runAIAction('Polish, format, and improve the clarity of this text:', ctx)
            }}
            className="px-2 py-0.5 rounded-md df-pill text-[10px] shrink-0"
          >
            ✨ Polish
          </button>
          <button
            onClick={() => {
              const ctx =
                aiContextAttachment ||
                (clipboardHistory[0]?.type === 'text'
                  ? { label: 'Latest Clip', content: clipboardHistory[0].content }
                  : { label: `Note: ${activeNoteName}`, content: editorContent })
              runAIAction('Explain and review this code for bugs & improvements:', ctx)
            }}
            className="px-2 py-0.5 rounded-md df-pill text-[10px] shrink-0"
          >
            💻 Code Review
          </button>
          <button
            onClick={() => {
              const ctx = aiContextAttachment || (editorContent ? { label: `Note: ${activeNoteName}`, content: editorContent } : undefined)
              runAIAction('Convert this information into a clean Markdown table:', ctx)
            }}
            className="px-2 py-0.5 rounded-md df-pill text-[10px] shrink-0"
          >
            📊 Table
          </button>
          {customPrompts.map((cp) => (
            <button
              key={cp.id}
              onClick={() => {
                const ctx = aiContextAttachment || (editorContent ? { label: `Note: ${activeNoteName}`, content: editorContent } : undefined)
                runAIAction(cp.prompt, ctx)
              }}
              className="px-2 py-0.5 rounded-md df-pill text-[10px] shrink-0"
            >
              {cp.label}
            </button>
          ))}
          <button
            onClick={() => setNewPresetOpen(!newPresetOpen)}
            title="Create Custom Prompt Preset"
            className="px-1.5 py-0.5 rounded-md df-pill text-[10px] shrink-0"
          >
            +Preset
          </button>
        </div>

        {newPresetOpen && (
          <div className="px-2.5 py-1.5 df-subbar flex items-center gap-1 shrink-0 no-drag">
            <input
              type="text"
              placeholder="Label (e.g. 🔍 Audit)"
              value={newPresetLabel}
              onChange={(e) => setNewPresetLabel(e.target.value)}
              className="w-28 df-input px-1.5 py-0.5 text-[10px]"
            />
            <input
              type="text"
              placeholder="Prompt instruction..."
              value={newPresetPrompt}
              onChange={(e) => setNewPresetPrompt(e.target.value)}
              className="flex-1 df-input px-1.5 py-0.5 text-[10px] min-w-0"
            />
            <button
              onClick={() => {
                if (!newPresetLabel.trim() || !newPresetPrompt.trim()) return
                const next = [
                  ...customPrompts,
                  { id: `cp-${Date.now()}`, label: newPresetLabel.trim(), prompt: newPresetPrompt.trim() },
                ]
                setCustomPrompts(next)
                window.electronAPI.saveSettings({ customPrompts: next })
                setNewPresetLabel('')
                setNewPresetPrompt('')
                setNewPresetOpen(false)
                showToast('Saved custom AI preset!')
              }}
              className="px-2 py-0.5 df-pill-active rounded text-[10px]"
            >
              Add
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {aiMessages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user' ? 'df-pill-active ml-6' : 'df-card mr-2'
              }`}
            >
              <div className="flex items-center justify-between text-[9px] opacity-80 mb-1.5 font-mono gap-1 flex-wrap">
                <span>
                  {msg.role === 'user' ? 'You' : `✨ ${msg.provider || 'AI'} (${msg.model || 'pro'})${msg.latencyMs ? ` · ⚡ ${msg.latencyMs}ms` : ''}`}
                </span>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 no-drag">
                    <button
                      onClick={() => {
                        window.electronAPI.writeClipboardText(msg.text)
                        showToast('Copied AI response')
                      }}
                      className="px-1.5 py-0.2 rounded df-pill text-[9px]"
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => {
                        handleNoteContentChange(editorContent ? `${editorContent}\n\n${msg.text}` : msg.text)
                        showToast('Appended to active Note')
                      }}
                      className="px-1.5 py-0.2 rounded df-pill text-[9px]"
                    >
                      +Note
                    </button>
                    <button
                      onClick={() => {
                        handleNoteContentChange(msg.text)
                        showToast('Replaced active Note content')
                      }}
                      className="px-1.5 py-0.2 rounded df-pill text-[9px]"
                    >
                      Replace Note
                    </button>
                    <button
                      onClick={async () => {
                        const fileName = `AI_Output_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.md`
                        await window.electronAPI.createFile({
                          filePath: `${currentPath}/${fileName}`,
                          content: msg.text,
                        })
                        await loadFiles(currentPath, false)
                        showToast(`Saved ${fileName} to Files`)
                      }}
                      className="px-1.5 py-0.2 rounded df-pill text-[9px]"
                    >
                      💾 File
                    </button>
                  </div>
                )}
              </div>
              <div className="whitespace-pre-wrap select-text">{msg.text}</div>
            </div>
          ))}
          {aiLoading && (
            <div className="p-2.5 rounded-xl df-card text-xs df-text-muted">
              <div className="animate-pulse font-semibold mb-1">
                ✨ Generating response via {aiConfig.provider} ({aiConfig.model})…
              </div>
              {streamingText && <div className="whitespace-pre-wrap df-text-primary">{streamingText}</div>}
            </div>
          )}
        </div>

        {/* Multi-Item @Context Attachment Chips & Input Box */}
        <div className="p-2 df-subbar space-y-1.5 no-drag" style={{ borderBottom: 'none' }}>
          {(aiAttachments.length > 0 || aiContextAttachment) && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {aiAttachments.map((att) => (
                <div
                  key={att.id}
                  className="px-2 py-0.5 rounded-md df-pill-active text-[9px] flex items-center gap-1 shrink-0"
                >
                  <span className="truncate max-w-[110px]">📎 {att.label}</span>
                  <button
                    onClick={() => setAIAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                    className="font-bold hover:text-red-200"
                  >
                    ×
                  </button>
                </div>
              ))}
              {aiAttachments.length === 0 && aiContextAttachment && (
                <div className="px-2 py-0.5 rounded-md df-pill-active text-[9px] flex items-center gap-1 shrink-0">
                  <span className="truncate max-w-[130px]">📎 {aiContextAttachment.label}</span>
                  <button onClick={() => setAIContextAttachment(null)} className="font-bold">
                    ×
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setAIAttachments([])
                  setAIContextAttachment(null)
                }}
                className="px-1.5 py-0.5 rounded df-pill text-[9px] shrink-0 ml-auto"
              >
                Clear Context
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 text-[9px] overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                if (editorContent) {
                  addAttachmentToAI(`Note: ${activeNoteName || 'Scratchpad'}`, editorContent)
                  showToast('Attached active Note to AI @Context')
                }
              }}
              className="px-1.5 py-0.5 df-pill rounded shrink-0"
            >
              +📝 Note
            </button>
            <button
              onClick={() => {
                const latestText = clipboardHistory.find((c) => c.type === 'text')
                if (latestText) {
                  addAttachmentToAI('Latest Clip', latestText.content)
                  showToast('Attached latest Clip to AI @Context')
                }
              }}
              className="px-1.5 py-0.5 df-pill rounded shrink-0"
            >
              +📋 Clip
            </button>
            {shelfPaths.length > 0 && (
              <button
                onClick={() => handleBatchAttachToAI(shelfPaths)}
                className="px-1.5 py-0.5 df-pill rounded shrink-0"
              >
                +📥 Shelf ({shelfPaths.length})
              </button>
            )}
            <button
              onClick={() => {
                const transcript = aiMessages
                  .map((m) => `### ${m.role === 'user' ? 'User' : `AI (${m.model || 'pro'})`}\n${m.text}`)
                  .join('\n\n')
                handleCreateTemplateNote('AI Session Transcript', `# AI Studio Transcript\n\n${transcript}\n`)
                showToast('Saved AI conversation to Notes!')
              }}
              title="Export AI Chat Transcript to Notes"
              className="px-1.5 py-0.5 df-pill rounded shrink-0 ml-auto"
            >
              💾 Export Chat
            </button>
            <button
              onClick={() => setAIMessages([aiMessages[0]])}
              className="px-1.5 py-0.5 df-pill rounded shrink-0"
            >
              Clear Chat
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={aiPromptInput}
              onChange={(e) => setAIPromptInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runAIAction(aiPromptInput)}
              placeholder={`Ask ${aiConfig.provider === 'builtin' ? 'OpenDesk PRO AI' : aiConfig.model} anything…`}
              className="flex-1 df-input px-2.5 py-1.5 text-xs min-w-0"
            />
            <button
              disabled={aiLoading}
              onClick={() => runAIAction(aiPromptInput)}
              className="px-3 py-1.5 df-pill-active rounded-lg text-xs shadow shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    )
  }

  function getFileIcon(ext: string) {
    switch (ext) {
      case '.pdf':
        return '📕'
      case '.swift':
        return '🐦'
      case '.ts':
      case '.tsx':
      case '.js':
        return '💻'
      case '.md':
      case '.txt':
        return '📄'
      case '.xlsx':
      case '.csv':
        return '📊'
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.gif':
        return '🖼️'
      case '.zip':
      case '.tar':
      case '.gz':
        return '📦'
      default:
        return '📄'
    }
  }

  const startResizingPane = (index: number, e: React.MouseEvent) => {
    e.preventDefault()
    const currentWidths =
      layoutMode === 'split4'
        ? paneWidths.length === 4
          ? paneWidths
          : [23, 31, 24, 22]
        : paneWidths.length === 3
        ? paneWidths
        : [28, 40, 32]
    draggingDividerRef.current = {
      index,
      startX: e.clientX,
      startWidths: [...currentWidths],
    }
  }

  const activeWidths3 = paneWidths.length === 3 ? paneWidths : [28, 40, 32]
  const activeWidths4 = paneWidths.length === 4 ? paneWidths : [23, 31, 24, 22]

  return (
    <div
      onMouseOver={(e) => {
        const target = (e.target as HTMLElement)?.closest(
          'button, [role="button"], input[type="range"], input[type="checkbox"], summary'
        ) as HTMLElement | null
        if (target && target !== lastHoveredTargetRef.current) {
          lastHoveredTargetRef.current = target
          const rect = target.getBoundingClientRect()
          const label = resolveHoveredButtonLabel(target)
          const clampedX = Math.max(90, Math.min(window.innerWidth - 90, rect.left + rect.width / 2))
          const nextY = rect.bottom + 28 < window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - 28)
          if (hoverTooltipElRef.current && hoverTooltipLabelRef.current) {
            hoverTooltipElRef.current.style.left = `${clampedX}px`
            hoverTooltipElRef.current.style.top = `${nextY}px`
            hoverTooltipElRef.current.style.display = 'inline-flex'
            hoverTooltipLabelRef.current.textContent = label
          }
          if (hoverBadgeElRef.current) {
            hoverBadgeElRef.current.style.display = 'inline'
            hoverBadgeElRef.current.textContent = `🎯 ${label}`
          }
        }
      }}
      onMouseOut={(e) => {
        const related = e.relatedTarget as HTMLElement | null
        const nextTarget = related?.closest('button, [role="button"], input[type="range"], input[type="checkbox"], summary') as HTMLElement | null
        if (!nextTarget) {
          lastHoveredTargetRef.current = null
          if (hoverTooltipElRef.current) hoverTooltipElRef.current.style.display = 'none'
          if (hoverBadgeElRef.current) hoverBadgeElRef.current.style.display = 'none'
        }
      }}
      className={`h-screen w-screen flex flex-col overflow-hidden bg-transparent select-none ${resolvedThemeClass} ${
        glassTintBlurEnabled ? 'df-glass-enabled' : 'df-glass-disabled'
      }`}
      style={{ '--df-solid-bg': solidBgHex } as React.CSSProperties}
    >
      {/* Main Sliding Drawer */}
      <div className="flex-1 flex flex-col overflow-hidden df-drawer relative">
        {/* Clean, Settled Top Control Bar (Left: Brand & Layout | Center: Auto / Liquid Glass / Dual Light / Solid | Right: Vault, AI, Trial & Lock) */}
        <div
          onWheel={(e) => {
            if (Math.abs(e.deltaY) >= 8 && e.deltaY < 0 && !isPinned) {
              window.electronAPI.hideWindow()
            }
          }}
          className="drag-region h-10 px-3.5 flex items-center justify-between gap-2.5 df-subbar shrink-0 whitespace-nowrap"
        >
          {/* Left: OpenDesk PRO Brand, Layout Mode & Search */}
          <div className="flex items-center gap-2 no-drag shrink-0">
            <span className="text-xs font-bold tracking-tight flex items-center gap-1.5 df-text-primary pr-1">
              <OpenDeskBrandIcon size={17} />
              <span>OpenDesk PRO</span>
            </span>
            <div className="flex items-center rounded-lg p-0.5 text-[10.5px] gap-0.5" style={{ background: 'var(--df-bg-pill)' }}>
              <button
                onClick={() => {
                  setLayoutMode('split3')
                  setPaneWidths([28, 40, 32])
                  window.electronAPI.saveSettings({ layoutMode: 'split3', paneWidths: [28, 40, 32] })
                }}
                title="3-Pane Split Layout (Clipboard · Files · Notes)"
                className={`px-2 py-0.5 rounded-md transition-all ${layoutMode === 'split3' ? 'df-pill-active' : 'df-text-secondary'}`}
              >
                3-Pane
              </button>
              <button
                onClick={() => {
                  setLayoutMode('split4')
                  setPaneWidths([23, 31, 24, 22])
                  window.electronAPI.saveSettings({ layoutMode: 'split4', paneWidths: [23, 31, 24, 22] })
                }}
                title="4-Pane Split Layout (Clipboard · Files · Notes · AI Studio)"
                className={`px-2 py-0.5 rounded-md transition-all ${layoutMode === 'split4' ? 'df-pill-active' : 'df-text-secondary'}`}
              >
                4-Pane
              </button>
              <button
                onClick={() => {
                  setLayoutMode('tabbed')
                  window.electronAPI.saveSettings({ layoutMode: 'tabbed' })
                }}
                title="Compact Single-Pane Tabbed Layout"
                className={`px-2 py-0.5 rounded-md transition-all ${layoutMode === 'tabbed' ? 'df-pill-active' : 'df-text-secondary'}`}
              >
                Compact
              </button>
            </div>

            <button
              onClick={() => {
                setCommandPaletteOpen(true)
                setOmniQuery('')
                setOmniSelectedIndex(0)
              }}
              title="Global Command Palette & Omni-Search (⌘K)"
              className="px-2.5 py-1 rounded-lg df-pill text-[10.5px] font-medium flex items-center gap-1"
            >
              <span>🔍</span>
              <span>⌘K</span>
            </button>
          </div>

          {/* Center: Appearance Switcher (Auto | Liquid Glass | Light Dual | Solid) + Active Swatches / Glass Tint & Blur */}
          <div className="flex items-center gap-2 no-drag shrink-0">
            <div className="flex items-center gap-0.5 rounded-lg p-0.5 text-[10.5px]" style={{ background: 'var(--df-bg-pill)' }}>
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setTheme(opt.id)
                    window.electronAPI.saveSettings({ theme: opt.id })
                  }}
                  title={`Switch Appearance Theme to ${opt.label}`}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    theme === opt.id ? 'df-pill-active shadow-sm' : 'df-text-secondary hover:opacity-100'
                  }`}
                >
                  {opt.shortLabel}
                </button>
              ))}
            </div>

            {theme === 'liquid' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'var(--df-bg-pill)' }}>
                <button
                  onClick={() => {
                    const next = !glassTintBlurEnabled
                    setGlassTintBlurEnabled(next)
                    window.electronAPI.saveSettings({ glassTintBlurEnabled: next })
                    showToast(next ? `💧 Glass Tint & Blur ON (${liquidGlassIntensity}%)` : 'Glass Tint & Blur OFF')
                  }}
                  title="Toggle Liquid Glass Tint & Frosted Blur (ON / OFF)"
                  className={`px-1.5 py-0.2 rounded-full font-semibold ${glassTintBlurEnabled ? 'df-pill-active' : 'df-pill'}`}
                >
                  💧 {glassTintBlurEnabled ? `${liquidGlassIntensity}%` : 'OFF'}
                </button>
                <input
                  type="range"
                  min={10}
                  max={95}
                  value={liquidGlassIntensity}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setLiquidGlassIntensity(val)
                    if (!glassTintBlurEnabled) setGlassTintBlurEnabled(true)
                    window.electronAPI.saveSettings({ liquidGlassIntensity: val, glassTintBlurEnabled: true })
                  }}
                  title={`Adjust Liquid Glass Tint & Blur Intensity (${liquidGlassIntensity}%)`}
                  className="w-16 df-liquid-slider"
                  style={{ background: 'var(--df-accent)' }}
                />
              </div>
            )}

            {theme === 'light' && (
              <div className="flex items-center gap-1 px-1.5 py-1 rounded-full" style={{ background: 'var(--df-bg-pill)' }}>
                {DUAL_LIGHT_PRESETS.map((dl) => (
                  <button
                    key={dl.id}
                    onClick={() => {
                      setDualLightPreset(dl.id)
                      window.electronAPI.saveSettings({ theme: 'light', dualLightPreset: dl.id })
                    }}
                    title={`Dual Light Theme: ${dl.label}`}
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${
                      dualLightPreset === dl.id ? 'scale-125 ring-2 ring-orange-500' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ background: dl.swatchBg, border: '1px solid rgba(15,23,42,0.28)' }}
                  />
                ))}
              </div>
            )}

            {theme === 'solid' && (
              <div className="flex items-center gap-1 px-1.5 py-1 rounded-full" style={{ background: 'var(--df-bg-pill)' }}>
                {SOLID_COLOR_PRESETS.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setSolidBgHex(sc.hex)
                      window.electronAPI.saveSettings({ theme: 'solid', solidBgHex: sc.hex })
                    }}
                    title={`Solid Color: ${sc.label}`}
                    className={`w-3 h-3 rounded-full transition-transform ${
                      solidBgHex === sc.hex ? 'scale-125 ring-2 ring-sky-400' : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{ background: sc.hex, border: '1px solid rgba(255,255,255,0.25)' }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Settled Workspace Controls (Live Key Reflection, Timer, Vault, AI, Pin, Settings & Hide) */}
          <div className="flex items-center gap-1.5 no-drag shrink-0">
            <button
              onClick={() => setShowPomoPopover(!showPomoPopover)}
              title="Focus Timer & Quick Tasks"
              className={`px-2 py-1 rounded-lg text-[10.5px] font-mono flex items-center gap-1 ${
                pomoRunning || showPomoPopover ? 'df-pill-active' : 'df-pill'
              }`}
            >
              <span>⏱️</span>
              <span>{formatTimer(pomoSecondsLeft)}</span>
            </button>

            <button
              onClick={async () => {
                await refreshVaultStatus()
                if (layoutMode === 'tabbed') setActiveTab('vault')
                else setShowVaultModal(!showVaultModal)
              }}
              title="OpenDesk PRO Vault (Encrypted Secrets, Files, Privacy Shield & Crypto Tools)"
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 ${
                showVaultModal || (layoutMode === 'tabbed' && activeTab === 'vault') ? 'df-pill-active' : 'df-pill'
              }`}
            >
              <span>{vaultUnlocked ? '🔓' : '🔐'}</span>
              <span>Vault</span>
            </button>

            <button
              onClick={() => {
                if (layoutMode === 'tabbed') setActiveTab('ai')
                else setShowAIModal(!showAIModal)
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
                showAIModal || (layoutMode === 'tabbed' && activeTab === 'ai') ? 'df-pill-active' : 'df-pill'
              }`}
            >
              <span>✨</span>
              <span>AI</span>
            </button>

            <button
              onClick={() => setShowLicenseModal(!showLicenseModal)}
              title="15-Day Free Trial & $9 One-Time Lifetime Subscription (Automated Gateway)"
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
                showLicenseModal || licenseStatus?.isActivated ? 'df-pill-active' : 'df-pill'
              }`}
            >
              <span>💎</span>
              <span>
                {licenseStatus?.isActivated
                  ? 'Lifetime Active'
                  : `${licenseStatus?.trialDaysRemaining ?? 15}d Trial · $9`}
              </span>
            </button>

            <button
              onClick={async () => {
                const next = !isPinned
                setIsPinned(next)
                await window.electronAPI.togglePin(next)
                showToast(next ? 'Drawer pinned open' : 'Drawer auto-hide enabled')
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${isPinned ? 'df-pill-active' : 'df-pill'}`}
            >
              📌 {isPinned ? 'Pinned' : 'Pin'}
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-1.5 py-0.5 rounded-md df-pill text-[11px]"
              title="Appearance, Liquid Glass & AI Settings"
            >
              ⚙
            </button>

            <button
              onClick={() => window.electronAPI.hideWindow()}
              className="w-5 h-5 rounded-md df-pill flex items-center justify-center text-[10px]"
              title="Slide Up (⌘+Shift+D)"
            >
              ▲
            </button>
          </div>
        </div>

        {/* Built-in Pomodoro Timer & Quick Tasks Popover */}
        {showPomoPopover && (
          <div className="absolute top-10 right-16 w-80 df-modal rounded-xl p-3 shadow-2xl z-50 space-y-2.5 text-xs no-drag">
            <div className="flex items-center justify-between pb-1.5" style={{ borderBottom: '1px solid var(--df-border-subtle)' }}>
              <span className="font-bold df-text-primary flex items-center gap-1.5">
                <span>⏱️ Focus Timer</span>
                <span className="df-stat-badge">🔥 {pomoSessionsCompleted} done</span>
              </span>
              <button onClick={() => setShowPomoPopover(false)} className="df-text-muted">
                ✕
              </button>
            </div>
            <div className="df-card p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-lg font-mono font-bold df-text-primary">{formatTimer(pomoSecondsLeft)}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPomoRunning(!pomoRunning)}
                    className="px-2.5 py-1 rounded df-pill-active text-[10px]"
                  >
                    {pomoRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    onClick={() => {
                      setPomoRunning(false)
                      const totalSec = pomoMode === 'sprint' ? 15 * 60 : pomoMode === 'focus' ? 25 * 60 : pomoMode === 'short' ? 5 * 60 : 45 * 60
                      setPomoSecondsLeft(totalSec)
                    }}
                    className="px-2 py-1 rounded df-pill text-[10px]"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="df-progress-track">
                <div
                  className="df-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, 100 - (pomoSecondsLeft / (pomoMode === 'sprint' ? 15 * 60 : pomoMode === 'focus' ? 25 * 60 : pomoMode === 'short' ? 5 * 60 : 45 * 60)) * 100))}%`,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {(
                [
                  { id: 'sprint', label: '15m Sprint', sec: 15 * 60 },
                  { id: 'focus', label: '25m Focus', sec: 25 * 60 },
                  { id: 'short', label: '5m Break', sec: 5 * 60 },
                  { id: 'deep', label: '45m Deep', sec: 45 * 60 },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setPomoMode(m.id)
                    setPomoRunning(false)
                    setPomoSecondsLeft(m.sec)
                  }}
                  className={`py-1 rounded ${pomoMode === m.id ? 'df-pill-active' : 'df-pill'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="space-y-1 pt-1" style={{ borderTop: '1px solid var(--df-border-subtle)' }}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold df-text-secondary">
                  Quick Tasks ({quickTasks.filter((t) => t.done).length}/{quickTasks.length} done)
                </span>
                {quickTasks.some((t) => t.done) && (
                  <button
                    onClick={() => {
                      const remaining = quickTasks.filter((t) => !t.done)
                      setQuickTasks(remaining)
                      window.electronAPI.saveSettings({ quickTasks: remaining })
                    }}
                    className="df-text-muted hover:text-red-400"
                  >
                    Clear Done
                  </button>
                )}
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {quickTasks.map((qt) => (
                  <div key={qt.id} className="flex items-center justify-between gap-1.5 text-[11px] p-1 rounded df-card">
                    <button
                      onClick={() => {
                        const next = quickTasks.map((t) => (t.id === qt.id ? { ...t, done: !t.done } : t))
                        setQuickTasks(next)
                        window.electronAPI.saveSettings({ quickTasks: next })
                      }}
                      className="flex items-center gap-1.5 text-left truncate flex-1"
                    >
                      <span>{qt.done ? '☑' : '☐'}</span>
                      <span className={qt.done ? 'line-through df-text-muted truncate' : 'df-text-primary truncate'}>
                        {qt.text}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        const next = quickTasks.filter((t) => t.id !== qt.id)
                        setQuickTasks(next)
                        window.electronAPI.saveSettings({ quickTasks: next })
                      }}
                      className="df-text-muted hover:text-red-400 px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 pt-1">
                <input
                  type="text"
                  placeholder="Add quick task..."
                  value={newQuickTaskText}
                  onChange={(e) => setNewQuickTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newQuickTaskText.trim()) {
                      const next = [...quickTasks, { id: `qt-${Date.now()}`, text: newQuickTaskText.trim(), done: false }]
                      setQuickTasks(next)
                      window.electronAPI.saveSettings({ quickTasks: next })
                      setNewQuickTaskText('')
                    }
                  }}
                  className="flex-1 df-input px-2 py-1 text-[11px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Workspace Content Area — Resizable Split Panes or Compact Tabbed View */}
        {layoutMode === 'split3' ? (
          <div ref={splitContainerRef} className="flex-1 flex overflow-hidden w-full">
            <div style={{ width: `${activeWidths3[0]}%` }} className="h-full min-w-[200px] overflow-hidden flex flex-col">
              {renderClipboardPane()}
            </div>
            <div
              onMouseDown={(e) => startResizingPane(0, e)}
              onDoubleClick={resetSplitWidths}
              title="Drag to resize · Double-click to reset"
              className="df-pane-resizer no-drag"
            />
            <div style={{ width: `${activeWidths3[1]}%` }} className="h-full min-w-[240px] overflow-hidden flex flex-col">
              {renderFilesPane()}
            </div>
            <div
              onMouseDown={(e) => startResizingPane(1, e)}
              onDoubleClick={resetSplitWidths}
              title="Drag to resize · Double-click to reset"
              className="df-pane-resizer no-drag"
            />
            <div style={{ width: `${activeWidths3[2]}%` }} className="h-full min-w-[200px] overflow-hidden flex flex-col flex-1">
              {renderNotesPane()}
            </div>
          </div>
        ) : layoutMode === 'split4' ? (
          <div ref={splitContainerRef} className="flex-1 flex overflow-hidden w-full">
            <div style={{ width: `${activeWidths4[0]}%` }} className="h-full min-w-[180px] overflow-hidden flex flex-col">
              {renderClipboardPane()}
            </div>
            <div
              onMouseDown={(e) => startResizingPane(0, e)}
              onDoubleClick={resetSplitWidths}
              className="df-pane-resizer no-drag"
            />
            <div style={{ width: `${activeWidths4[1]}%` }} className="h-full min-w-[220px] overflow-hidden flex flex-col">
              {renderFilesPane()}
            </div>
            <div
              onMouseDown={(e) => startResizingPane(1, e)}
              onDoubleClick={resetSplitWidths}
              className="df-pane-resizer no-drag"
            />
            <div style={{ width: `${activeWidths4[2]}%` }} className="h-full min-w-[190px] overflow-hidden flex flex-col">
              {renderNotesPane()}
            </div>
            <div
              onMouseDown={(e) => startResizingPane(2, e)}
              onDoubleClick={resetSplitWidths}
              className="df-pane-resizer no-drag"
            />
            <div style={{ width: `${activeWidths4[3]}%` }} className="h-full min-w-[200px] overflow-hidden flex flex-col flex-1">
              {renderAIHubPane()}
            </div>
          </div>
        ) : (
          /* COMPACT TABBED VIEW — Cleanly Aligned Segmented Tab Switcher */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-1.5 df-subbar flex items-center justify-between gap-2 shrink-0 no-drag">
              <div className="grid grid-cols-5 gap-1.5 w-full p-0.5 rounded-xl" style={{ background: 'var(--df-bg-pill)' }}>
                {(
                  [
                    { id: 'clipboard', label: `📋 Clips (${filteredClipboard.length})` },
                    { id: 'files', label: `📁 Files (${filteredFiles.length})` },
                    { id: 'notes', label: `📝 Notes (${notes.length})` },
                    { id: 'ai', label: '✨ AI Studio' },
                    { id: 'vault', label: `${vaultUnlocked ? '🔓' : '🔐'} Vault` },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id === 'vault') refreshVaultStatus()
                      setActiveTab(t.id)
                    }}
                    className={`py-1 px-2 rounded-lg text-xs font-medium text-center transition-all truncate ${
                      activeTab === t.id ? 'df-pill-active shadow-sm' : 'df-text-secondary hover:opacity-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab === 'clipboard' && renderClipboardPane()}
              {activeTab === 'files' && renderFilesPane()}
              {activeTab === 'notes' && renderNotesPane()}
              {activeTab === 'ai' && renderAIHubPane()}
              {activeTab === 'vault' && (
                <div className="h-full overflow-y-auto p-3 text-xs space-y-3">
                  <div className="df-card p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold df-text-primary">🔐 Dedicated AES-256-GCM Encrypted Vault</div>
                      <div className="text-[10px] df-text-muted font-mono">{vaultPath}</div>
                    </div>
                    <button
                      onClick={() => setShowVaultModal(true)}
                      className="px-2.5 py-1 df-pill-active rounded-lg text-xs"
                    >
                      Open Full Vault Studio ↗
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GLOBAL COMMAND PALETTE (⌘K) & CROSS-PANE OMNI-SEARCH MODAL */}
        {commandPaletteOpen && (
          <div
            onClick={() => setCommandPaletteOpen(false)}
            className="absolute inset-0 bg-black/55 flex items-start justify-center pt-12 z-50 no-drag"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="df-modal rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[80%]"
            >
              <div className="p-3 df-pane-header flex items-center gap-2">
                <span className="text-sm">🔍</span>
                <input
                  autoFocus
                  type="text"
                  value={omniQuery}
                  onChange={(e) => {
                    setOmniQuery(e.target.value)
                    setOmniSelectedIndex(0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setOmniSelectedIndex((prev) => Math.min(omniResults.length - 1, prev + 1))
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setOmniSelectedIndex((prev) => Math.max(0, prev - 1))
                    } else if (e.key === 'Enter' && omniResults[omniSelectedIndex]) {
                      e.preventDefault()
                      omniResults[omniSelectedIndex].onSelect()
                      setCommandPaletteOpen(false)
                    } else if (e.key === 'Escape') {
                      setCommandPaletteOpen(false)
                    }
                  }}
                  placeholder="Omni-Search Files, Notes, Clipboard snippets, or type a command (⌘K)..."
                  className="flex-1 bg-transparent text-xs df-text-primary focus:outline-none"
                />
                <button onClick={() => setCommandPaletteOpen(false)} className="px-2 py-0.5 df-pill rounded text-[10px]">
                  ESC
                </button>
              </div>

              <div className="px-3 py-1.5 df-subbar flex items-center gap-1.5 text-[10px]">
                {(['all', 'actions', 'files', 'notes', 'clipboard'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setOmniCategory(cat)
                      setOmniSelectedIndex(0)
                    }}
                    className={`px-2 py-0.5 rounded capitalize ${
                      omniCategory === cat ? 'df-pill-active' : 'df-pill'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {omniResults.length === 0 ? (
                  <div className="p-6 text-center text-xs df-text-muted">No matching items or commands found.</div>
                ) : (
                  omniResults.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        item.onSelect()
                        setCommandPaletteOpen(false)
                      }}
                      className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer text-xs ${
                        idx === omniSelectedIndex ? 'df-pill-active' : 'hover:bg-blue-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{item.title}</div>
                          <div className="text-[10px] opacity-75 truncate">{item.subtitle}</div>
                        </div>
                      </div>
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded df-pill shrink-0">
                        {item.category}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating AI Studio Drawer Overlay */}
        {showAIModal && layoutMode === 'split3' && (
          <div className="absolute top-9 right-0 bottom-0 w-96 df-modal z-40 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-3 py-1 df-subbar">
              <span className="text-[10px] df-text-muted uppercase tracking-wider font-bold flex items-center gap-1"><OpenDeskBrandIcon size={12} /> OpenDesk PRO AI Studio</span>
              <button onClick={() => setShowAIModal(false)} className="text-xs df-text-secondary px-1">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{renderAIHubPane()}</div>
          </div>
        )}

        {/* Inline Create Folder / File / Note Modal (Replaces broken window.prompt!) */}
        {createModal && (
          <div
            onClick={() => setCreateModal(null)}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <div onClick={(e) => e.stopPropagation()} className="df-modal rounded-xl p-4 w-80 shadow-2xl">
              <h4 className="text-xs font-bold mb-2 df-text-primary">
                {createModal.type === 'folder'
                  ? '📁 Create New Folder'
                  : createModal.type === 'file'
                  ? '📄 Create New File'
                  : '📝 Create New Note'}
              </h4>
              <input
                autoFocus
                value={createInputVal}
                onChange={(e) => setCreateInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitCreate()
                  if (e.key === 'Escape') setCreateModal(null)
                }}
                placeholder={
                  createModal.type === 'folder'
                    ? 'Folder name...'
                    : createModal.type === 'file'
                    ? 'filename.md'
                    : 'Note title...'
                }
                className="w-full df-input px-2.5 py-1.5 text-xs mb-3"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setCreateModal(null)} className="px-3 py-1 df-pill rounded-lg text-xs">
                  Cancel
                </button>
                <button onClick={handleCommitCreate} className="px-3 py-1 df-pill-active rounded-lg text-xs">
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inline Delete Confirmation Modal (Replaces blocking window.confirm!) */}
        {deleteConfirmTarget && (
          <div
            onClick={() => setDeleteConfirmTarget(null)}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <div onClick={(e) => e.stopPropagation()} className="df-modal rounded-xl p-4 w-80 shadow-2xl text-center space-y-3">
              <div className="text-xs font-bold df-text-primary">
                Move "{deleteConfirmTarget.name.replace(/\.md$/, '')}" to Trash?
              </div>
              <div className="flex justify-center gap-2">
                <button onClick={() => setDeleteConfirmTarget(null)} className="px-3 py-1 df-pill rounded-lg text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold"
                >
                  Move to Trash
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Look File Preview & Metadata Inspector Modal */}
        {previewFile && (
          <div
            onClick={() => setPreviewFile(null)}
            className="absolute inset-0 bg-black/55 flex items-center justify-center p-6 z-50"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="df-modal rounded-2xl w-full max-w-xl max-h-[86%] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="px-4 py-2.5 df-pane-header flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{getFileIcon(previewFile.extension || '')}</span>
                  <span className="text-xs font-bold truncate df-text-primary">{previewFile.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {previewFile.type !== 'image' && previewFile.type !== 'large' && (
                    <button
                      onClick={() => {
                        window.electronAPI.writeClipboardText(previewFile.content)
                        showToast('Copied file contents to clipboard')
                      }}
                      className="px-2 py-0.5 df-pill rounded text-[10px]"
                    >
                      📋 Copy
                    </button>
                  )}
                  {previewFile.type !== 'image' && previewFile.type !== 'large' && (
                    <button
                      onClick={() => {
                        const target = previewFile
                        setPreviewFile(null)
                        triggerQuickAI('Analyze and summarize this file:', `File: ${target.name}`, target.content)
                      }}
                      className="px-2 py-0.5 df-pill rounded text-[10px]"
                    >
                      ✨ AI
                    </button>
                  )}
                  <button
                    onClick={() => window.electronAPI.showInFolder(previewFile.path)}
                    className="px-2 py-0.5 df-pill rounded text-[10px]"
                  >
                    📂 Finder
                  </button>
                  <button
                    onClick={() => window.electronAPI.openItem(previewFile.path)}
                    className="px-2 py-0.5 df-pill-active rounded text-[10px]"
                  >
                    Open Native
                  </button>
                  <button onClick={() => setPreviewFile(null)} className="df-text-secondary text-sm px-1">
                    ✕
                  </button>
                </div>
              </div>
              <div className="px-4 py-1.5 df-subbar flex items-center gap-2 flex-wrap text-[10px]">
                <span className="df-stat-badge">{formatBytes(previewFile.size)}</span>
                {previewFile.extension && <span className="df-stat-badge uppercase">{previewFile.extension}</span>}
                {typeof previewFile.linesCount === 'number' && (
                  <span className="df-stat-badge">{previewFile.linesCount} lines · {previewFile.wordsCount || 0} words</span>
                )}
                {previewFile.sha256 && <span className="df-stat-badge">SHA256: {previewFile.sha256}…</span>}
                <span className="df-text-muted ml-auto font-mono text-[9.5px]">
                  Modified {new Date(previewFile.modified).toLocaleString()}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-4 text-xs">
                {previewFile.type === 'image' ? (
                  <img src={previewFile.content} className="max-h-72 mx-auto object-contain rounded" />
                ) : (
                  <pre className="font-mono text-[11px] whitespace-pre-wrap df-text-primary select-text">
                    {previewFile.content}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS MODAL (8 Themes, Liquid Glass Slider & Expanded Free/Cloud AI Keys Vault) */}
        {showSettingsModal && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center p-4 z-50">
            <div className="df-modal rounded-2xl w-full max-w-2xl max-h-[92%] overflow-y-auto p-5 shadow-2xl space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2.5" style={{ borderBottom: '1px solid var(--df-border)' }}>
                <div className="flex items-center gap-2">
                  <OpenDeskBrandIcon size={20} />
                  <div>
                    <h2 className="text-sm font-bold df-text-primary">OpenDesk PRO v3.1 — Appearance, Themes & Unified Security Packet</h2>
                    <p className="text-[10px] df-text-muted">
                      8 Designer Glass Themes · Resizable Split Panes · All-in-One Security/Privacy/Vault Packet · 14 Free/Local AI Providers
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowSettingsModal(false)} className="px-2.5 py-1 df-pill rounded-lg font-bold">
                  Done
                </button>
              </div>

              {/* SECTION 1: Appearance (Auto | Liquid Glass | Dual Light Themes | Solid Colors) */}
              <div className="df-card p-4 space-y-3">
                <div className="font-semibold text-xs df-text-primary">
                  Appearance Mode (Auto · Liquid Glass · Dual Light · Solid Colors)
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {THEME_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setTheme(item.id)
                        window.electronAPI.saveSettings({ theme: item.id })
                      }}
                      title={`Select ${item.label} Theme Mode`}
                      className={`p-2 rounded-xl flex flex-col items-center gap-1.5 transition-all ${
                        theme === item.id ? 'ring-2 ring-sky-400 df-pill-active' : 'df-pill'
                      }`}
                    >
                      <div
                        className="w-full h-7 rounded-lg"
                        style={{
                          background:
                            item.id === 'solid'
                              ? solidBgHex
                              : item.id === 'light'
                              ? activeDualLight.swatchBg
                              : item.previewBg,
                          border: '1px solid rgba(255,255,255,0.2)',
                        }}
                      />
                      <span className="text-[11px] font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>

                {/* Dual-Tone Light Background Themes (Beige/Bridge + Orange, White + Blue, etc.) */}
                <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--df-border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs df-text-primary">
                        ☀️ Dual-Tone Light Background Combinations (Beige/Bridge & Orange · White & Blue · +6 More)
                      </div>
                      <div className="text-[10px] df-text-muted">
                        Active Dual Palette: {activeDualLight.label}
                      </div>
                    </div>
                    <span className="df-stat-badge">8 Dual Light Themes</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {DUAL_LIGHT_PRESETS.map((dl) => (
                      <button
                        key={dl.id}
                        onClick={() => {
                          setTheme('light')
                          setDualLightPreset(dl.id)
                          window.electronAPI.saveSettings({ theme: 'light', dualLightPreset: dl.id })
                          showToast(`☀️ Applied ${dl.label} Dual Light Theme`)
                        }}
                        title={`Apply Dual Light Theme: ${dl.label}`}
                        className={`p-1.5 rounded-xl flex items-center gap-2 text-left transition-all ${
                          theme === 'light' && dualLightPreset === dl.id ? 'ring-2 ring-orange-500 df-pill-active' : 'df-pill'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-lg shrink-0"
                          style={{ background: dl.swatchBg, border: '1px solid rgba(15,23,42,0.25)' }}
                        />
                        <span className="text-[10px] font-medium truncate">{dl.shortLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Solid Surface Palette Picker */}
                <div className="pt-2 flex items-center justify-between gap-4" style={{ borderTop: '1px solid var(--df-border-subtle)' }}>
                  <div>
                    <div className="font-semibold text-xs df-text-primary">Solid Surface Color Palette</div>
                    <div className="text-[10px] df-text-muted">Select a clean solid background shade</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {SOLID_COLOR_PRESETS.map((sc) => (
                      <button
                        key={sc.id}
                        onClick={() => {
                          setTheme('solid')
                          setSolidBgHex(sc.hex)
                          window.electronAPI.saveSettings({ theme: 'solid', solidBgHex: sc.hex })
                        }}
                        title={`Solid Color: ${sc.label}`}
                        className={`w-6 h-6 rounded-lg transition-transform ${
                          theme === 'solid' && solidBgHex === sc.hex ? 'scale-110 ring-2 ring-sky-400' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ background: sc.hex, border: '1px solid rgba(255,255,255,0.25)' }}
                      />
                    ))}
                  </div>
                </div>

                {/* Liquid Glass Tint & Blur Intensity Toggle + Slider + Presets */}
                <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--df-border-subtle)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-xs df-text-primary">
                        💧 Liquid Glass Tint & Blur Intensity ({glassTintBlurEnabled ? `${liquidGlassIntensity}% Active` : 'OFF'})
                      </div>
                      <div className="text-[10px] df-text-muted">
                        Toggle frosted blur & glass color tint or choose a preset below
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const next = !glassTintBlurEnabled
                          setGlassTintBlurEnabled(next)
                          if (next && theme !== 'liquid') setTheme('liquid')
                          window.electronAPI.saveSettings({
                            glassTintBlurEnabled: next,
                            ...(next ? { theme: 'liquid' } : {}),
                          })
                          showToast(next ? `💧 Glass Tint & Blur Enabled (${liquidGlassIntensity}%)` : 'Glass Tint & Blur Disabled')
                        }}
                        title="Toggle Liquid Glass Tint & Blur Effect ON or OFF"
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold ${
                          glassTintBlurEnabled ? 'df-pill-active' : 'df-pill'
                        }`}
                      >
                        {glassTintBlurEnabled ? '💧 Blur & Tint: ON' : '⚪ Blur & Tint: OFF'}
                      </button>
                      {([
                        { label: 'Crystal 20%', val: 20 },
                        { label: 'Balanced 55%', val: 55 },
                        { label: 'Frosted 90%', val: 90 },
                      ] as const).map((preset) => (
                        <button
                          key={preset.val}
                          onClick={() => {
                            setTheme('liquid')
                            setGlassTintBlurEnabled(true)
                            setLiquidGlassIntensity(preset.val)
                            window.electronAPI.saveSettings({
                              theme: 'liquid',
                              glassTintBlurEnabled: true,
                              liquidGlassIntensity: preset.val,
                            })
                          }}
                          title={`Set Glass Tint & Blur Intensity to ${preset.label}`}
                          className={`px-2 py-1 rounded-lg text-[10px] ${
                            glassTintBlurEnabled && liquidGlassIntensity === preset.val ? 'df-pill-active' : 'df-pill'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] df-text-muted w-16">Clear (10%)</span>
                    <input
                      type="range"
                      min={10}
                      max={95}
                      value={liquidGlassIntensity}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setLiquidGlassIntensity(val)
                        setGlassTintBlurEnabled(true)
                        if (theme !== 'liquid') setTheme('liquid')
                        window.electronAPI.saveSettings({
                          theme: 'liquid',
                          glassTintBlurEnabled: true,
                          liquidGlassIntensity: val,
                        })
                      }}
                      title={`Slide to Adjust Glass Tint & Blur Intensity (${liquidGlassIntensity}%)`}
                      className="flex-1 df-liquid-slider"
                      style={{ background: 'var(--df-accent)' }}
                    />
                    <span className="text-[10px] df-text-muted w-20 text-right">Frosted (95%)</span>
                  </div>
                </div>
              </div>

              {/* SECTION 1B: Auto Spelling Correction & Sentence Maker + App & Package Integrations */}
              <div className="df-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs df-text-primary">
                      ✍️ Auto Spelling Correction & Sentence Maker + 🔗 External App & Package Integrations
                    </h3>
                    <p className="text-[10px] df-text-muted">
                      Real-time typo correction, 1-click sentence builder, and native integrations with macOS apps & CLI packages
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const next = !autoSpellCorrectEnabled
                        setAutoSpellCorrectEnabled(next)
                        window.electronAPI.saveSettings({ autoSpellCorrectEnabled: next })
                        showToast(next ? '✍️ Auto Spelling Correction Enabled' : 'Auto Spelling Correction Disabled')
                      }}
                      title="Toggle Real-Time Auto Spelling Correction"
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        autoSpellCorrectEnabled ? 'df-pill-active' : 'df-pill'
                      }`}
                    >
                      {autoSpellCorrectEnabled ? '✍️ Auto-Spell: ON' : 'Auto-Spell: OFF'}
                    </button>
                    {(['sentences', 'bullets', 'executive'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setSentenceMakerMode(m)
                          window.electronAPI.saveSettings({ sentenceMakerMode: m })
                        }}
                        title={`Set Sentence Maker Style to ${m}`}
                        className={`px-2 py-1 rounded-lg text-[10px] capitalize ${
                          sentenceMakerMode === m ? 'df-pill-active' : 'df-pill'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 pt-1">
                  {([
                    { id: 'obsidian', name: 'Obsidian Vault', icon: '🟣', type: 'App' },
                    { id: 'vscode', name: 'VS Code', icon: '📘', type: 'App' },
                    { id: 'cursor', name: 'Cursor IDE', icon: '⚡', type: 'App' },
                    { id: 'iterm', name: 'Terminal / iTerm', icon: '💻', type: 'App' },
                    { id: 'finder', name: 'macOS Finder', icon: '📂', type: 'App' },
                    { id: 'git', name: 'Git VCS', icon: '🌿', type: 'Pkg' },
                    { id: 'node', name: 'Node & npm', icon: '🟢', type: 'Pkg' },
                    { id: 'bun', name: 'Bun Bundler', icon: '🥟', type: 'Pkg' },
                    { id: 'python3', name: 'Python 3', icon: '🐍', type: 'Pkg' },
                    { id: 'homebrew', name: 'Homebrew', icon: '🍺', type: 'Pkg' },
                  ] as const).map((item) => {
                    const enabled = integrationsConfig[item.id] !== false
                    return (
                      <div
                        key={item.id}
                        className="p-2 rounded-xl df-subbar flex flex-col justify-between gap-1.5"
                        style={{ border: '1px solid var(--df-border-subtle)' }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10.5px] font-semibold df-text-primary truncate">
                            {item.icon} {item.name}
                          </span>
                          <input
                            type="checkbox"
                            checked={enabled}
                            title={`Enable or Disable ${item.name} (${item.type}) Integration`}
                            onChange={(e) => {
                              const nextCfg = { ...integrationsConfig, [item.id]: e.target.checked }
                              setIntegrationsConfig(nextCfg)
                              window.electronAPI.saveSettings({ integrationsConfig: nextCfg })
                            }}
                          />
                        </div>
                        <button
                          onClick={async () => {
                            const res = await window.electronAPI.triggerAppIntegration?.({
                              integrationId: item.id,
                              targetPath: currentPath,
                              noteName: activeNoteName,
                            })
                            showToast(res?.message || `Triggered ${item.name} integration`)
                          }}
                          title={`Trigger & Sync with ${item.name}`}
                          className="w-full py-0.5 rounded df-pill text-[9.5px] font-medium"
                        >
                          🚀 Sync / Open
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Custom Package / Webhook / CLI Command Endpoint (e.g. http://127.0.0.1:5678/webhook or brew bundle)..."
                    value={customIntegrationWebhook}
                    onChange={(e) => {
                      setCustomIntegrationWebhook(e.target.value)
                      window.electronAPI.saveSettings({ customIntegrationWebhook: e.target.value })
                    }}
                    className="flex-1 df-input px-2.5 py-1 text-[11px] font-mono"
                  />
                  <button
                    onClick={async () => {
                      const res = await window.electronAPI.triggerAppIntegration?.({
                        integrationId: 'manifest-export',
                        targetPath: currentPath,
                      })
                      showToast(res?.message || 'Exported OpenDesk_Integrations_Manifest.json')
                    }}
                    title="Export Active App & Package Integrations Manifest JSON"
                    className="px-2.5 py-1 df-pill-active rounded-lg text-[10px] font-bold shrink-0"
                  >
                    📦 Export Manifest
                  </button>
                </div>
              </div>

              {/* SECTION 2: 100% Free AI Providers & Local Endpoints Vault */}
              <div className="df-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs df-text-primary">🤖 100% Free AI Providers & Free-Tier API Key Vault</h3>
                    <p className="text-[10px] df-text-muted">
                      Built-in Smart AI & Free Cloud AI require ZERO keys. Add free-tier keys below for OpenRouter (:free), Nvidia NIM, OmniRoute, Groq, Gemini Free, Cerebras, SambaNova, GitHub Models, Hugging Face, or Mistral.
                    </p>
                  </div>
                  <button
                    onClick={() => probeLocalAI()}
                    className="px-2 py-1 df-pill rounded text-[10px] shrink-0"
                  >
                    🔄 Probe Local
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] df-text-muted block">
                      Ollama URL ({localStatus.ollamaOnline ? '🟢 Online' : '⚪ Offline'})
                    </label>
                    <input
                      type="text"
                      value={aiConfig.ollamaUrl}
                      onChange={(e) => updateAIConfig({ ollamaUrl: e.target.value })}
                      className="w-full df-input px-2 py-1 text-[11px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] df-text-muted block">
                      LM Studio URL ({localStatus.lmstudioOnline ? '🟢 Online' : '⚪ Offline'})
                    </label>
                    <input
                      type="text"
                      value={aiConfig.lmstudioUrl}
                      onChange={(e) => updateAIConfig({ lmstudioUrl: e.target.value })}
                      className="w-full df-input px-2 py-1 text-[11px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] df-text-muted block">
                      OmniRoute URL ({localStatus.omnirouteOnline ? '🟢 Online' : '🧭 Hybrid Ready'})
                    </label>
                    <input
                      type="text"
                      value={aiConfig.omnirouteUrl}
                      onChange={(e) => updateAIConfig({ omnirouteUrl: e.target.value })}
                      className="w-full df-input px-2 py-1 text-[11px] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2" style={{ borderTop: '1px solid var(--df-border-subtle)' }}>
                  <input
                    type="password"
                    placeholder="OpenRouter Key (:free models) (sk-or-...)"
                    value={aiConfig.openrouterKey}
                    onChange={(e) => updateAIConfig({ openrouterKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="password"
                    placeholder="Nvidia NIM Free Key (nvapi-...)"
                    value={aiConfig.nvidiaKey}
                    onChange={(e) => updateAIConfig({ nvidiaKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="password"
                    placeholder="OmniRoute Router Key (Optional)"
                    value={aiConfig.omnirouteKey}
                    onChange={(e) => updateAIConfig({ omnirouteKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="password"
                    placeholder="Groq Cloud Free Key (gsk_...)"
                    value={aiConfig.groqKey}
                    onChange={(e) => updateAIConfig({ groqKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="password"
                    placeholder="Google Gemini Free Key (AIza...)"
                    value={aiConfig.geminiKey}
                    onChange={(e) => updateAIConfig({ geminiKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="password"
                    placeholder="Cerebras Fast AI Free Key (csk-...)"
                    value={aiConfig.cerebrasKey || ''}
                    onChange={(e) => updateAIConfig({ cerebrasKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="password"
                    placeholder="SambaNova Cloud Free Key"
                    value={aiConfig.sambanovaKey || ''}
                    onChange={(e) => updateAIConfig({ sambanovaKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="password"
                    placeholder="GitHub Models Free Token (ghp_ / github_pat_)"
                    value={aiConfig.githubKey || ''}
                    onChange={(e) => updateAIConfig({ githubKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="password"
                    placeholder="Hugging Face Free Token (hf_...)"
                    value={aiConfig.huggingfaceKey || ''}
                    onChange={(e) => updateAIConfig({ huggingfaceKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="password"
                    placeholder="Mistral / Codestral Free Key"
                    value={aiConfig.mistralKey || ''}
                    onChange={(e) => updateAIConfig({ mistralKey: e.target.value })}
                    className="w-full df-input px-2 py-1 text-[11px] font-mono"
                  />
                </div>
              </div>

              {/* SECTION 3: Enterprise Strict Privacy & Dedicated Vault Governance */}
              <div className="df-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs df-text-primary">🛡️ Enterprise Strict Privacy & Dedicated AES-256-GCM Vault</h3>
                    <p className="text-[10px] df-text-muted">
                      MIT Licensed Commercial Package · Zero Telemetry · PBKDF2-HMAC-SHA512 (210,000 Iterations)
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSettingsModal(false)
                      refreshVaultStatus()
                      setShowVaultModal(true)
                    }}
                    className="px-2.5 py-1 df-pill-active rounded-lg text-[10px] shrink-0"
                  >
                    🔐 Open Dedicated Vault
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="df-pill p-2 rounded-lg flex items-center justify-between cursor-pointer">
                    <span>🛡️ Strict Privacy Mode (Air-Gapped Local AI)</span>
                    <input
                      type="checkbox"
                      checked={strictPrivacyMode}
                      onChange={(e) => {
                        const val = e.target.checked
                        setStrictPrivacyMode(val)
                        window.electronAPI.saveSettings({ strictPrivacyMode: val })
                      }}
                    />
                  </label>
                  <label className="df-pill p-2 rounded-lg flex items-center justify-between cursor-pointer">
                    <span>🧹 Outbound PII & Secret Redaction Shield</span>
                    <input
                      type="checkbox"
                      checked={piiRedactionEnabled}
                      onChange={(e) => {
                        const val = e.target.checked
                        setPiiRedactionEnabled(val)
                        window.electronAPI.saveSettings({ piiRedactionEnabled: val })
                      }}
                    />
                  </label>
                  <label className="df-pill p-2 rounded-lg flex items-center justify-between cursor-pointer">
                    <span>📋 Sensitive Clipboard Secret Guard</span>
                    <input
                      type="checkbox"
                      checked={sensitiveClipboardGuard}
                      onChange={(e) => {
                        const val = e.target.checked
                        setSensitiveClipboardGuard(val)
                        window.electronAPI.saveSettings({ sensitiveClipboardGuard: val })
                      }}
                    />
                  </label>
                  <label className="df-pill p-2 rounded-lg flex items-center justify-between cursor-pointer">
                    <span>🔒 Auto-Lock Vault When Drawer Closes</span>
                    <input
                      type="checkbox"
                      checked={vaultAutoLockOnHide}
                      onChange={(e) => {
                        const val = e.target.checked
                        setVaultAutoLockOnHide(val)
                        window.electronAPI.saveSettings({ vaultAutoLockOnHide: val })
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTLED, TABBED OPENDESK VAULT MODAL (Secrets & Files | Privacy & Lock | Crypto Tools | Security Audit) */}
        {showVaultModal && (
          <div
            onClick={() => setShowVaultModal(false)}
            className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50 no-drag"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="df-modal rounded-2xl w-full max-w-2xl max-h-[90%] overflow-y-auto p-5 shadow-2xl space-y-3.5 text-xs"
            >
              {/* Clean Vault Header */}
              <div className="flex items-center justify-between pb-2.5" style={{ borderBottom: '1px solid var(--df-border)' }}>
                <div className="flex items-center gap-2.5">
                  <OpenDeskBrandIcon size={22} />
                  <div>
                    <h3 className="font-bold text-sm df-text-primary">OpenDesk PRO Vault</h3>
                    <div className="text-[10px] df-text-muted font-mono">
                      AES-256-GCM · PBKDF2-HMAC-SHA512 (210,000 iterations) · {vaultPath}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {vaultUnlocked ? (
                    <button
                      onClick={async () => {
                        await window.electronAPI.vaultLock?.()
                        setVaultUnlocked(false)
                        setVaultItems([])
                        showToast('🔒 Vault locked & key zeroed in memory')
                      }}
                      className="px-2.5 py-1 df-pill rounded-lg text-[10.5px] font-semibold"
                    >
                      🔒 Lock Vault
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        const res = await window.electronAPI.vaultUnlock?.({ passphrase: vaultPassphraseInput })
                        if (res?.success) {
                          setVaultUnlocked(true)
                          setVaultItems(res.items || [])
                          setVaultEncryptedFiles(res.encryptedFiles || [])
                          setVaultPassphraseInput('')
                          showToast('🔓 Vault Unlocked')
                        } else {
                          showToast(res?.error || 'Failed to unlock Vault')
                        }
                      }}
                      className="px-2.5 py-1 df-pill-active rounded-lg text-[10.5px] font-semibold"
                    >
                      🔓 Unlock Vault
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await window.electronAPI.panicWipePrivacy?.()
                      const favs = clipboardHistory.filter((c) => c.isFavorite)
                      setClipboardHistory(favs)
                      setShelfPaths([])
                      await refreshVaultStatus()
                      showToast('🔥 Emergency Panic Wipe Complete')
                    }}
                    title="Lock Vault, Zero Keys, Clear Clipboard & Staging Shelf"
                    className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[10.5px] font-semibold"
                  >
                    🔥 Panic Wipe
                  </button>
                  <button onClick={() => setShowVaultModal(false)} className="px-2 py-1 df-pill rounded-lg font-bold">
                    ✕
                  </button>
                </div>
              </div>

              {/* Clean 4-Tab Segmented Navigation inside Vault */}
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--df-bg-subbar)' }}>
                {([
                  { id: 'records', label: `🔐 Secrets & Files (${vaultItems.length + vaultEncryptedFiles.length})` },
                  { id: 'privacy', label: '🛡️ Privacy & Lock' },
                  { id: 'tools', label: '🧰 Crypto & Clean Tools' },
                  { id: 'audit', label: '✅ Security Audit (100/100)' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setVaultSubTab(t.id)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
                      vaultSubTab === t.id ? 'df-pill-active shadow-sm' : 'df-text-secondary hover:opacity-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: SECRETS & ENCRYPTED FILES */}
              {vaultSubTab === 'records' && (
                !vaultUnlocked ? (
                  <div className="df-card p-3.5 flex items-center gap-2">
                    <input
                      type="password"
                      placeholder={
                        vaultHasCustomPass
                          ? 'Enter Vault Master Passphrase...'
                          : 'Passphrase (leave blank for Hardware Seal Quick Unlock)...'
                      }
                      value={vaultPassphraseInput}
                      onChange={(e) => setVaultPassphraseInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          const res = await window.electronAPI.vaultUnlock?.({ passphrase: vaultPassphraseInput })
                          if (res?.success) {
                            setVaultUnlocked(true)
                            setVaultItems(res.items || [])
                            setVaultEncryptedFiles(res.encryptedFiles || [])
                            setVaultPassphraseInput('')
                            showToast('🔓 Vault Unlocked')
                          } else {
                            showToast(res?.error || 'Invalid passphrase')
                          }
                        }
                      }}
                      className="flex-1 df-input px-3 py-1.5 text-xs font-mono"
                    />
                    <button
                      onClick={async () => {
                        const res = await window.electronAPI.vaultUnlock?.({ passphrase: vaultPassphraseInput })
                        if (res?.success) {
                          setVaultUnlocked(true)
                          setVaultItems(res.items || [])
                          setVaultEncryptedFiles(res.encryptedFiles || [])
                          setVaultPassphraseInput('')
                          showToast('🔓 Vault Unlocked')
                        } else {
                          showToast(res?.error || 'Invalid passphrase')
                        }
                      }}
                      className="px-3.5 py-1.5 df-pill-active rounded-lg text-xs font-semibold"
                    >
                      Unlock Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="df-card p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold df-text-primary text-xs">➕ Add Encrypted Secret / Key / Note</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="password"
                            placeholder="New master passphrase..."
                            value={vaultNewPassphraseInput}
                            onChange={(e) => setVaultNewPassphraseInput(e.target.value)}
                            className="df-input px-2 py-0.5 text-[10px] w-40 font-mono"
                          />
                          <button
                            onClick={async () => {
                              if (!vaultNewPassphraseInput.trim()) return
                              const res = await window.electronAPI.vaultChangePassphrase?.({
                                newPassphrase: vaultNewPassphraseInput.trim(),
                              })
                              if (res?.success) {
                                setVaultHasCustomPass(Boolean(res.hasCustomPassphrase))
                                setVaultNewPassphraseInput('')
                                showToast('🔐 Re-keyed Vault with new Master Passphrase')
                              } else {
                                showToast(res?.error || 'Failed to update passphrase')
                              }
                            }}
                            className="px-2 py-0.5 df-pill rounded text-[10px]"
                          >
                            Re-Key
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Title (e.g. AWS Secret, Recovery Key)"
                          value={vaultNewTitle}
                          onChange={(e) => setVaultNewTitle(e.target.value)}
                          className="w-44 df-input px-2.5 py-1.5 text-xs"
                        />
                        <select
                          value={vaultNewCategory}
                          onChange={(e) => setVaultNewCategory(e.target.value as any)}
                          className="df-input px-2 py-1.5 text-xs"
                        >
                          <option value="secret">🔑 Secret</option>
                          <option value="token">🪙 API Token</option>
                          <option value="key">🛡️ SSH / PGP Key</option>
                          <option value="note">📝 Private Note</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Confidential content..."
                          value={vaultNewContent}
                          onChange={(e) => setVaultNewContent(e.target.value)}
                          className="flex-1 df-input px-2.5 py-1.5 text-xs font-mono"
                        />
                        <button
                          onClick={async () => {
                            if (!vaultNewTitle.trim() || !vaultNewContent.trim()) return
                            const res = await window.electronAPI.vaultSaveItem?.({
                              title: vaultNewTitle.trim(),
                              category: vaultNewCategory,
                              content: vaultNewContent,
                            })
                            if (res?.success) {
                              setVaultItems(res.items || [])
                              setVaultNewTitle('')
                              setVaultNewContent('')
                              showToast('🔐 Saved encrypted record to Vault')
                            }
                          }}
                          className="px-3 py-1.5 df-pill-active rounded-lg text-xs font-semibold shrink-0"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="df-card p-3.5 space-y-2">
                      <div className="font-bold df-text-primary text-xs">
                        🗄️ Encrypted Vault Records ({vaultItems.length})
                      </div>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto">
                        {vaultItems.map((vi) => {
                          const revealed = vaultRevealedIds.includes(vi.id)
                          return (
                            <div key={vi.id} className="p-2 rounded-lg df-subbar flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold df-text-primary truncate">
                                  {vi.category === 'token' ? '🪙' : vi.category === 'key' ? '🛡️' : vi.category === 'note' ? '📝' : '🔑'}{' '}
                                  {vi.title}
                                </div>
                                <div className="text-[10.5px] font-mono df-text-secondary truncate">
                                  {revealed ? vi.content : '••••••••••••••••••••••••••••••••'}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() =>
                                    setVaultRevealedIds((prev) =>
                                      prev.includes(vi.id) ? prev.filter((x) => x !== vi.id) : [...prev, vi.id]
                                    )
                                  }
                                  className="px-2 py-0.5 df-pill rounded text-[10px]"
                                >
                                  {revealed ? '🙈 Hide' : '👁️ Reveal'}
                                </button>
                                <button
                                  onClick={() => {
                                    window.electronAPI.writeClipboardText(vi.content)
                                    showToast('Copied secret (auto-guarded)')
                                  }}
                                  className="px-2 py-0.5 df-pill-active rounded text-[10px]"
                                >
                                  📋 Copy
                                </button>
                                <button
                                  onClick={async () => {
                                    const res = await window.electronAPI.vaultDeleteItem?.(vi.id)
                                    if (res?.success) setVaultItems(res.items || [])
                                  }}
                                  className="px-1.5 py-0.5 df-pill rounded text-[10px] hover:text-red-400"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="df-card p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold df-text-primary text-xs">
                          📦 Encrypted Files (*.dfenc) ({vaultEncryptedFiles.length})
                        </span>
                        <button
                          onClick={() => window.electronAPI.showInFolder(vaultPath)}
                          className="text-[10px] df-text-secondary hover:underline"
                        >
                          Open Vault in Finder ↗
                        </button>
                      </div>
                      {vaultEncryptedFiles.length === 0 ? (
                        <div className="text-[10.5px] df-text-muted">
                          Click 🔐 on any file card in the Files pane to encrypt it into the Vault.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-28 overflow-y-auto">
                          {vaultEncryptedFiles.map((ef) => (
                            <div key={ef.path} className="p-2 rounded-lg df-subbar flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium df-text-primary truncate">🔐 {ef.originalName}</div>
                                <div className="text-[9.5px] font-mono df-text-muted">
                                  {formatBytes(ef.originalSize)} · SHA256: {ef.sha256}…
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  const res = await window.electronAPI.vaultDecryptFile?.({
                                    encryptedFilePath: ef.path,
                                    targetDir: currentPath,
                                  })
                                  if (res?.success) {
                                    await loadFiles(currentPath, false)
                                    showToast(`🔓 Restored ${ef.originalName} to Workspace`)
                                  }
                                }}
                                className="px-2.5 py-1 df-pill-active rounded text-[10px]"
                              >
                                🔓 Decrypt & Restore
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* TAB 2: PRIVACY & WORKSPACE LOCK */}
              {vaultSubTab === 'privacy' && (
                <div className="space-y-3">
                  <div className="df-card p-3.5 grid grid-cols-2 gap-2.5">
                    <label className="df-pill p-2.5 rounded-xl flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="font-semibold df-text-primary">🛡️ Strict Local AI Mode</div>
                        <div className="text-[10px] df-text-muted">Air-gaps AI to 100% local execution</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={strictPrivacyMode}
                        onChange={(e) => {
                          setStrictPrivacyMode(e.target.checked)
                          window.electronAPI.saveSettings({ strictPrivacyMode: e.target.checked })
                        }}
                      />
                    </label>
                    <label className="df-pill p-2.5 rounded-xl flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="font-semibold df-text-primary">🧼 Outbound PII Redactor</div>
                        <div className="text-[10px] df-text-muted">Scrubs keys, emails, cards & SSNs</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={piiRedactionEnabled}
                        onChange={(e) => {
                          setPiiRedactionEnabled(e.target.checked)
                          window.electronAPI.saveSettings({ piiRedactionEnabled: e.target.checked })
                        }}
                      />
                    </label>
                    <label className="df-pill p-2.5 rounded-xl flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="font-semibold df-text-primary">🚫 Sensitive Clipboard Guard</div>
                        <div className="text-[10px] df-text-muted">Blocks password managers & secrets</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={sensitiveClipboardGuard}
                        onChange={(e) => {
                          setSensitiveClipboardGuard(e.target.checked)
                          window.electronAPI.saveSettings({ sensitiveClipboardGuard: e.target.checked })
                        }}
                      />
                    </label>
                    <label className="df-pill p-2.5 rounded-xl flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="font-semibold df-text-primary">⏱️ Auto-Lock Vault on Hide</div>
                        <div className="text-[10px] df-text-muted">Zeroes keys when drawer closes</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={vaultAutoLockOnHide}
                        onChange={(e) => {
                          setVaultAutoLockOnHide(e.target.checked)
                          window.electronAPI.saveSettings({ vaultAutoLockOnHide: e.target.checked })
                        }}
                      />
                    </label>
                  </div>

                  <div className="df-card p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs df-text-primary">🧼 Live PII & Secret Scrubber</span>
                      <button
                        onClick={async () => {
                          await window.electronAPI.securityLockApp?.()
                          setIsAppSecurityLocked(true)
                          setShowVaultModal(false)
                          showToast('🔒 Full-Workspace Security Lock Activated (⌘+L)')
                        }}
                        className="px-2.5 py-1 df-pill rounded-lg text-[10px] font-semibold"
                      >
                        🔒 Engage Full-Workspace Lock (⌘L)
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Paste text with email, SSN, card, or API key to test scrubbing..."
                        value={piiSampleInput}
                        onChange={(e) => setPiiSampleInput(e.target.value)}
                        className="flex-1 df-input px-2.5 py-1.5 text-xs font-mono"
                      />
                      <button
                        onClick={async () => {
                          if (!piiSampleInput.trim()) return
                          const res = await window.electronAPI.redactSensitiveText?.(piiSampleInput)
                          if (res) {
                            setPiiSampleOutput(res.redactedText)
                            showToast(`🧼 Scrubbed ${res.redactionCount} sensitive item(s)`)
                          }
                        }}
                        className="px-3 py-1.5 df-pill-active rounded-lg text-xs font-semibold shrink-0"
                      >
                        Scrub PII
                      </button>
                    </div>
                    {piiSampleOutput && (
                      <div className="p-2 rounded-lg df-subbar font-mono text-[10.5px] select-text">
                        {piiSampleOutput}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CRYPTO & CLEAN TOOLS */}
              {vaultSubTab === 'tools' && (
                <div className="space-y-3">
                  <div className="df-card p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-xs df-text-primary">
                        🎲 CSPRNG Generator · 🕵️ Leak Scanner · 🧹 Duplicate Cleaner · 📦 Encrypted Backup
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={async () => {
                            const gen = await window.electronAPI.generateCsprngSecret?.({ mode: 'password', length: 28 })
                            if (gen?.success) setGeneratedSecretData(gen)
                          }}
                          className="px-2.5 py-1 df-pill-active rounded-lg text-[10px]"
                        >
                          🎲 Password
                        </button>
                        <button
                          onClick={async () => {
                            const gen = await window.electronAPI.generateCsprngSecret?.({ mode: 'passphrase' })
                            if (gen?.success) setGeneratedSecretData(gen)
                          }}
                          className="px-2.5 py-1 df-pill rounded-lg text-[10px]"
                        >
                          🎲 Passphrase
                        </button>
                        <button
                          onClick={async () => {
                            const gen = await window.electronAPI.generateCsprngSecret?.({ mode: 'apikey' })
                            if (gen?.success) setGeneratedSecretData(gen)
                          }}
                          className="px-2.5 py-1 df-pill rounded-lg text-[10px]"
                        >
                          🪙 API Token
                        </button>
                        <button
                          onClick={async () => {
                            const res = await window.electronAPI.scanWorkspaceSecrets?.(currentPath)
                            if (res?.success) {
                              setSecretScanFindings(res.findings || [])
                              showToast(`🕵️ Scanned ${res.scannedFilesCount} files: ${res.findings.length} secret(s) found`)
                            }
                          }}
                          className="px-2.5 py-1 df-pill rounded-lg text-[10px]"
                        >
                          🕵️ Scan Leaks
                        </button>
                        <button
                          onClick={async () => {
                            const scan = await window.electronAPI.scanDuplicateFiles(currentPath)
                            if (scan.totalDuplicateFiles > 0) {
                              const rem = await window.electronAPI.removeDuplicateFiles(currentPath)
                              await loadFiles(currentPath, false)
                              showToast(`🧹 Cleaned ${rem.removedCount} duplicates (${formatBytes(rem.reclaimedBytes)})`)
                            } else {
                              showToast('✨ Zero duplicate files found in workspace')
                            }
                          }}
                          className="px-2.5 py-1 df-pill rounded-lg text-[10px]"
                        >
                          🧹 Clean Duplicates
                        </button>
                        <button
                          onClick={async () => {
                            const res = await window.electronAPI.exportEncryptedSnapshot?.()
                            if (res?.success) {
                              showToast(`📦 Saved ${res.fileName} to Vault/`)
                            }
                          }}
                          className="px-2.5 py-1 df-pill rounded-lg text-[10px]"
                        >
                          📦 Backup (.dfbackup)
                        </button>
                        <button
                          onClick={async () => {
                            const res = await window.electronAPI.recallEncryptedSnapshot?.()
                            if (res?.success) {
                              await refreshNotesMetadata()
                              await refreshVaultStatus()
                              showToast(`⏪ Recalled ${res.fileName} (${res.restoredNotesCount} notes & Vault restored)`)
                            } else {
                              showToast(res?.error || 'Export a .dfbackup snapshot first')
                            }
                          }}
                          className="px-2.5 py-1 df-pill-active rounded-lg text-[10px]"
                        >
                          ⏪ Recall (.dfbackup)
                        </button>
                      </div>
                    </div>

                    {generatedSecretData && (
                      <div className="p-2.5 rounded-lg df-subbar flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-mono font-bold df-text-primary truncate select-text">
                            {generatedSecretData.secret}
                          </div>
                          <div className="text-[9.5px] df-text-muted">
                            Entropy: {generatedSecretData.entropyBits} bits · {generatedSecretData.strengthLabel}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              window.electronAPI.writeClipboardText(generatedSecretData.secret)
                              showToast('Copied generated secret')
                            }}
                            className="px-2 py-1 df-pill rounded text-[10px]"
                          >
                            📋 Copy
                          </button>
                          <button
                            onClick={async () => {
                              const res = await window.electronAPI.vaultSaveItem?.({
                                title: `Generated ${generatedSecretData.mode.toUpperCase()} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                                category: generatedSecretData.mode === 'apikey' ? 'token' : 'secret',
                                content: generatedSecretData.secret,
                              })
                              if (res?.success) {
                                setVaultUnlocked(true)
                                setVaultItems(res.items || [])
                                showToast('🔐 Saved generated secret into Vault')
                              }
                            }}
                            className="px-2 py-1 df-pill-active rounded text-[10px]"
                          >
                            🔐 Save to Vault
                          </button>
                        </div>
                      </div>
                    )}

                    {secretScanFindings && (
                      <div className="p-2.5 rounded-lg df-subbar space-y-1.5 max-h-32 overflow-y-auto">
                        <div className="flex items-center justify-between text-[10px] font-semibold">
                          <span>
                            🕵️ Secret Leak Scan Results: {secretScanFindings.length} exposed token(s) found
                          </span>
                          <button onClick={() => setSecretScanFindings(null)} className="df-text-muted">
                            ✕
                          </button>
                        </div>
                        {secretScanFindings.length === 0 ? (
                          <div className="text-[10px] text-emerald-400">
                            ✅ Zero plaintext API keys, PEM private keys, or JWT tokens detected in workspace files.
                          </div>
                        ) : (
                          secretScanFindings.map((f) => (
                            <div key={f.id} className="flex items-center justify-between gap-2 text-[10px] py-0.5">
                              <span className="truncate">
                                ⚠️ <strong>{f.fileName}:{f.line}</strong> — {f.category} ({f.maskedPreview})
                              </span>
                              <button
                                onClick={async () => {
                                  const res = await window.electronAPI.vaultAndRedactLeak?.({
                                    filePath: f.filePath,
                                    rawSecret: f.rawSecret,
                                    category: f.category,
                                    line: f.line,
                                  })
                                  if (res?.success) {
                                    setVaultUnlocked(true)
                                    setVaultItems(res.items || [])
                                    setSecretScanFindings((prev) => (prev ? prev.filter((x) => x.id !== f.id) : null))
                                    showToast(`🔐 Vaulted & redacted secret in ${f.fileName}`)
                                  }
                                }}
                                className="px-2 py-0.5 df-pill-active rounded text-[9.5px] shrink-0"
                              >
                                🔐 Vault & Redact File
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="df-card p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs df-text-primary">🔏 Zero-Knowledge Text Cipher (ODSEAL1)</span>
                      <span className="df-stat-badge">AES-256-GCM Armored Packet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Enter text to seal or paste ODSEAL1:... packet to unseal"
                        value={sealInputText}
                        onChange={(e) => setSealInputText(e.target.value)}
                        className="flex-1 df-input px-2.5 py-1.5 text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="Passphrase (optional)"
                        value={sealPassphrase}
                        onChange={(e) => setSealPassphrase(e.target.value)}
                        className="w-36 df-input px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          if (!sealInputText.trim()) return
                          const res = await window.electronAPI.sealTextPacket?.({
                            text: sealInputText,
                            passphrase: sealPassphrase,
                          })
                          if (res?.success) {
                            setSealedPacketOutput(res.packet)
                            showToast('🔏 Sealed text into AES-256-GCM ODSEAL1 packet')
                          }
                        }}
                        className="px-2.5 py-1 df-pill-active rounded-lg text-[10.5px]"
                      >
                        🔒 Seal Text
                      </button>
                      <button
                        onClick={async () => {
                          const target = sealInputText.trim() || sealedPacketOutput.trim()
                          if (!target) return
                          const res = await window.electronAPI.unsealTextPacket?.({
                            packet: target,
                            passphrase: sealPassphrase,
                          })
                          if (res?.success && res.plainText !== undefined) {
                            setSealedPacketOutput(res.plainText)
                            showToast('🔓 Unsealed ODSEAL1 packet')
                          } else {
                            showToast(res?.error || 'Failed to unseal packet')
                          }
                        }}
                        className="px-2.5 py-1 df-pill rounded-lg text-[10.5px]"
                      >
                        🔓 Unseal Packet
                      </button>
                      {sealedPacketOutput && (
                        <button
                          onClick={() => {
                            window.electronAPI.writeClipboardText(sealedPacketOutput)
                            showToast('Copied cipher output')
                          }}
                          className="px-2.5 py-1 df-pill rounded-lg text-[10.5px] ml-auto"
                        >
                          📋 Copy Output
                        </button>
                      )}
                    </div>
                    {sealedPacketOutput && (
                      <div className="p-2 rounded-lg df-subbar font-mono text-[10.5px] truncate select-text">
                        {sealedPacketOutput}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: ENTERPRISE SECURITY AUDIT */}
              {vaultSubTab === 'audit' && privacyAudit && (
                <div className="df-card p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs df-text-primary">
                      🛡️ OpenDesk PRO Security & Privacy Scorecard: {privacyAudit.grade} ({privacyAudit.score}/100)
                    </span>
                    <span className="df-stat-badge">License: {privacyAudit.license || 'MIT'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(privacyAudit.checks || []).map((chk: any) => (
                      <div key={chk.id} className="p-2 rounded-lg df-subbar text-[10.5px]">
                        <div className="font-semibold df-text-primary">✅ {chk.label}</div>
                        <div className="df-text-muted text-[9.5px] truncate">{chk.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 15-DAY FREE TRIAL & STREAMLINED $9 AUTOMATED LIFETIME SUBSCRIPTION MODAL */}
        {(showLicenseModal || licenseStatus?.isTrialExpired) && (
          <div
            onClick={() => {
              if (!licenseStatus?.isTrialExpired) setShowLicenseModal(false)
            }}
            className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 z-50 no-drag"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="df-modal rounded-2xl w-full max-w-lg max-h-[92%] overflow-y-auto p-5 shadow-2xl space-y-3 text-xs"
            >
              <div className="flex items-center justify-between pb-2.5" style={{ borderBottom: '1px solid var(--df-border)' }}>
                <div className="flex items-center gap-2.5">
                  <OpenDeskBrandIcon size={22} />
                  <div>
                    <h3 className="font-bold text-sm df-text-primary">
                      {licenseStatus?.isActivated
                        ? `OpenDesk PRO Lifetime Activated (${licenseStatus.licenseTier})`
                        : licenseStatus?.isTrialExpired
                        ? '15-Day Free Trial Ended — Unlock Lifetime Access for $9'
                        : `OpenDesk PRO 15-Day Free Trial (${licenseStatus?.trialDaysRemaining ?? 15} Days Left) · $9 Lifetime`}
                    </h3>
                    <div className="text-[10px] df-text-muted">
                      15-Day Free Trial → $9 One-Time Lifetime Subscription · Instant Automated Gateway & Zero Lag
                    </div>
                  </div>
                </div>
                {!licenseStatus?.isTrialExpired && (
                  <button onClick={() => setShowLicenseModal(false)} className="px-2 py-1 df-pill rounded-lg font-bold">
                    ✕
                  </button>
                )}
              </div>

              {/* Fast In-Memory Trial & License Status Banner */}
              <div className="df-card p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="df-text-secondary">Status:</span>
                  <span className="font-bold df-text-primary">
                    {licenseStatus?.isActivated
                      ? `✅ ${licenseStatus.licenseTier} (${licenseStatus.licenseKeyMasked})`
                      : licenseStatus?.isTrialExpired
                      ? '🔒 15-Day Trial Ended — Complete 1-Click $9 Lifetime Unlock Below'
                      : `⏳ ${licenseStatus?.trialDaysRemaining ?? 15} days (${licenseStatus?.trialHoursRemaining ?? 360} hours) remaining in 15-Day Free Trial`}
                  </span>
                </div>
                <div className="df-progress-track">
                  <div
                    className="df-progress-fill"
                    style={{
                      width: licenseStatus?.isActivated
                        ? '100%'
                        : `${Math.min(100, Math.max(5, ((licenseStatus?.trialDaysRemaining ?? 15) / 15) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* STREAMLINED 1-CLICK $9 LIFETIME AUTOMATED CHECKOUT */}
              <div className="df-card p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold df-text-primary text-xs">
                      ⚡ 1-Click Automated Lifetime Subscription
                    </span>
                    <div className="text-[10px] df-text-muted">
                      Full GUI + AES-256-GCM Vault + All 14 Free/Local AI Models · Own Forever
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-emerald-400">$9</span>
                    <span className="text-[10px] df-text-muted block">one-time · after 15d</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Name or Organization (optional)..."
                    value={licensedToInput}
                    onChange={(e) => setLicensedToInput(e.target.value)}
                    className="df-input px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="email"
                    placeholder="Email for Receipt & Key..."
                    value={checkoutEmailInput}
                    onChange={(e) => setCheckoutEmailInput(e.target.value)}
                    className="df-input px-2.5 py-1.5 text-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-[10.5px]">
                  <span className="df-text-muted shrink-0">Rail:</span>
                  {(['UPI / Instant QR', 'Card / Apple Pay', 'Razorpay / Global'] as const).map((pm) => (
                    <button
                      key={pm}
                      onClick={() => setCheckoutMethod(pm)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        checkoutMethod === pm ? 'df-pill-active' : 'df-pill'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const res = await window.electronAPI.licenseCompleteCheckout?.({
                        tier: 'PRO',
                        customerName: licensedToInput || checkoutEmailInput || 'OpenDesk PRO Customer',
                        customerEmail: checkoutEmailInput,
                        paymentMethod: checkoutMethod,
                      })
                      if (res?.success) {
                        setLicenseStatus(res.status)
                        setLicenseKeyInput(res.licenseKey)
                        setLastReceiptInfo({
                          key: res.licenseKey,
                          receiptPath: res.receiptPath,
                          plan: `OpenDesk PRO Lifetime ($${res.amountUsd || 9})`,
                        })
                        showToast(`💎 Paid $${res.amountUsd || 9} & Auto-Activated Lifetime (${res.licenseKey})`)
                      }
                    }}
                    className="flex-1 py-2 df-pill-active rounded-xl text-xs font-bold"
                  >
                    ⚡ Pay $9 & Auto-Unlock Lifetime Forever
                  </button>
                  <button
                    onClick={() => window.electronAPI.openExternalUrl('http://localhost:4000')}
                    title="Open Full Multi-Rail Payment Aggregator GUI (UPI / Visa / MasterCard / Razorpay / Global)"
                    className="px-3 py-2 df-pill rounded-xl text-[10.5px] font-semibold shrink-0"
                  >
                    🌐 Gateway GUI ↗
                  </button>
                </div>

                {lastReceiptInfo && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-[10.5px] space-y-1">
                    <div className="font-bold text-emerald-300">
                      ✅ Automated Payment Complete — {lastReceiptInfo.plan} Active!
                    </div>
                    <div className="font-mono text-[10px] df-text-primary select-text">
                      Key: {lastReceiptInfo.key} · Receipt saved to OpenDesk_License_Receipt.txt
                    </div>
                  </div>
                )}
              </div>

              {/* INSTANT KEY ENTRY & 1-CLICK RECALL */}
              <div className="df-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold df-text-primary">🔑 Have a License Key or Receipt?</span>
                  <button
                    onClick={async () => {
                      const res = await window.electronAPI.recallCommercialLicense?.({
                        tier: 'ENT',
                        licensedTo: licensedToInput || checkoutEmailInput || 'OpenDesk Commercial Enterprise',
                      })
                      if (res?.success) {
                        setLicenseStatus(res.status)
                        setLicenseKeyInput(res.licenseKey)
                        setLastReceiptInfo({
                          key: res.licenseKey,
                          receiptPath: res.receiptPath,
                          plan: `${res.licenseTier} ($9 Lifetime Recall)`,
                        })
                        showToast(`⏪ Recalled & Activated ${res.licenseTier} (${res.licenseKey})`)
                      }
                    }}
                    className="px-2 py-0.5 df-pill-active rounded text-[10px] font-semibold"
                  >
                    ⏪ 1-Click Recall License
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="ODPRO-XXXX-XXXX-XXXX-XXXX or ODENT-..."
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    className="flex-1 df-input px-2.5 py-1.5 text-xs font-mono uppercase"
                  />
                  <button
                    onClick={async () => {
                      const res = await window.electronAPI.licenseActivate?.({
                        licenseKey: licenseKeyInput,
                        licensedTo: licensedToInput || checkoutEmailInput || 'Lifetime License Holder',
                      })
                      if (res?.success) {
                        setLicenseStatus(res.status)
                        setLicenseKeyInput('')
                        setShowLicenseModal(false)
                        showToast('💎 One-Time Lifetime License Activated!')
                      } else {
                        showToast(res?.error || 'Invalid license key')
                      }
                    }}
                    className="px-3.5 py-1.5 df-pill-active rounded-lg text-xs font-bold shrink-0"
                  >
                    Activate Key
                  </button>
                </div>
              </div>

              {/* Compact Owner / Developer Trial Simulator */}
              <details className="df-subbar p-2 rounded-xl">
                <summary className="cursor-pointer text-[10px] font-semibold df-text-secondary select-none">
                  🛠️ Owner Trial & Key Tools
                </summary>
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  <button
                    onClick={async () => {
                      const gen = await window.electronAPI.licenseGenerateKey?.({ tier: 'ENT', seed: '2026' })
                      if (gen?.licenseKey) {
                        setLicenseKeyInput(gen.licenseKey)
                        showToast(`Generated key: ${gen.licenseKey}`)
                      }
                    }}
                    className="px-2 py-1 df-pill rounded text-[10px]"
                  >
                    🔑 Generate Key
                  </button>
                  <button
                    onClick={async () => {
                      const res = await window.electronAPI.licenseSimulateTrial?.({ mode: 'expire_now' })
                      if (res?.status) setLicenseStatus(res.status)
                      showToast('Simulated Day 16 (15-Day Trial Expired Paywall)')
                    }}
                    className="px-2 py-1 df-pill rounded text-[10px]"
                  >
                    ⏳ Simulate Day 16 Expiry
                  </button>
                  <button
                    onClick={async () => {
                      const res = await window.electronAPI.licenseSimulateTrial?.({ mode: 'reset_trial' })
                      if (res?.status) setLicenseStatus(res.status)
                      setLastReceiptInfo(null)
                      showToast('Reset to Fresh 15-Day Trial')
                    }}
                    className="px-2 py-1 df-pill rounded text-[10px]"
                  >
                    🔄 Reset 15-Day Trial
                  </button>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* FULL-WORKSPACE ENCRYPTED SECURITY LOCKSCREEN OVERLAY (⌘+L) */}
        {isAppSecurityLocked && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-6 z-50 no-drag">
            <div className="df-modal rounded-2xl w-full max-w-md p-6 shadow-2xl text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl df-pill-active mx-auto flex items-center justify-center text-2xl shadow-lg">
                🔒
              </div>
              <div>
                <h2 className="text-base font-bold df-text-primary">Workspace Encrypted & Locked</h2>
                <p className="text-[11px] df-text-muted mt-1">
                  Protected by AES-256-GCM & PBKDF2-HMAC-SHA512 (210,000 iterations). All active keys are zeroed in memory.
                </p>
              </div>
              <div className="space-y-2">
                <input
                  autoFocus
                  type="password"
                  placeholder={
                    vaultHasCustomPass
                      ? 'Enter Master Security Passphrase / PIN...'
                      : 'Enter Master Passphrase (or press Enter for Hardware Seal)...'
                  }
                  value={securityPinInput}
                  onChange={(e) => {
                    setSecurityPinInput(e.target.value)
                    setSecurityErrorMsg('')
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const res = await window.electronAPI.securityUnlockApp?.({ pin: securityPinInput })
                      if (res?.success) {
                        setIsAppSecurityLocked(false)
                        setSecurityPinInput('')
                        setSecurityErrorMsg('')
                        showToast('🔓 Workspace Security Lock Released')
                      } else {
                        setSecurityErrorMsg(res?.error || 'Invalid security passphrase')
                      }
                    }
                  }}
                  className="w-full df-input px-3 py-2 text-xs text-center font-mono"
                />
                {securityErrorMsg && <div className="text-[10.5px] text-red-400 font-medium">{securityErrorMsg}</div>}
                <button
                  onClick={async () => {
                    const res = await window.electronAPI.securityUnlockApp?.({ pin: securityPinInput })
                    if (res?.success) {
                      setIsAppSecurityLocked(false)
                      setSecurityPinInput('')
                      setSecurityErrorMsg('')
                      showToast('🔓 Workspace Security Lock Released')
                    } else {
                      setSecurityErrorMsg(res?.error || 'Invalid security passphrase')
                    }
                  }}
                  className="w-full py-2 df-pill-active rounded-xl text-xs font-bold shadow-md"
                >
                  🔓 Unlock Workspace
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename File Modal */}
        {renamingFile && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="df-modal rounded-xl p-4 w-72 shadow-2xl">
              <h4 className="text-xs font-bold mb-2 df-text-primary">Rename {renamingFile.name}</h4>
              <input
                autoFocus
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitRename()
                  if (e.key === 'Escape') setRenamingFile(null)
                }}
                className="w-full df-input px-2 py-1 text-xs mb-3"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setRenamingFile(null)} className="px-2.5 py-1 df-pill rounded text-xs">
                  Cancel
                </button>
                <button onClick={handleCommitRename} className="px-2.5 py-1 df-pill-active rounded text-xs">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Clipboard Confirmation */}
        {showClearConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="df-modal rounded-xl p-4 w-72 text-center shadow-2xl space-y-2">
              <h4 className="text-xs font-bold df-text-primary">Clear Clipboard History?</h4>
              <button
                onClick={() => {
                  const favs = clipboardHistory.filter((c) => c.isFavorite)
                  setClipboardHistory(favs)
                  window.electronAPI.saveClipboardHistory(favs)
                  setShowClearConfirm(false)
                  showToast('Cleared non-favorite clips')
                }}
                className="w-full py-1.5 df-pill-active rounded text-xs"
              >
                Keep Saved (★) Only
              </button>
              <button
                onClick={() => {
                  setClipboardHistory([])
                  window.electronAPI.saveClipboardHistory([])
                  setShowClearConfirm(false)
                  showToast('Cleared all clips')
                }}
                className="w-full py-1.5 bg-red-600 text-white rounded text-xs font-semibold"
              >
                Clear Everything
              </button>
              <button onClick={() => setShowClearConfirm(false)} className="w-full py-1 df-pill rounded text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div
          ref={hoverTooltipElRef}
          className="df-key-hover-tooltip"
          style={{ display: hoveredKeyInfo ? 'inline-flex' : 'none', left: `${hoveredKeyInfo?.x || 0}px`, top: `${hoveredKeyInfo?.y || 0}px` }}
        >
          <span>🎯</span>
          <span ref={hoverTooltipLabelRef}>{hoveredKeyInfo?.label || ''}</span>
        </div>

        {toastMessage && (
          <div className="absolute bottom-3 right-4 df-pill-active text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl z-50">
            ✓ {toastMessage}
          </div>
        )}
      </div>

      {/* Bottom-Center Pull-Tab Handle with Gear Icon & Live Key/Button Name Reflection */}
      <div className="h-6 flex justify-center items-start shrink-0 bg-transparent pointer-events-none">
        <button
          onClick={() => setShowSettingsModal(!showSettingsModal)}
          title="OpenDesk PRO Appearance, Liquid Glass, Dual Light Themes, Auto-Spell & App Integrations"
          className="drawer-pull-tab pointer-events-auto no-drag px-5 py-0.5 flex items-center gap-2 text-xs shadow-lg"
        >
          <span>⚙</span>
          <span
            ref={hoverBadgeElRef}
            style={{ display: hoveredKeyInfo ? 'inline' : 'none' }}
            className="text-[10px] font-medium df-text-primary truncate max-w-[320px]"
          >
            {hoveredKeyInfo ? `🎯 ${hoveredKeyInfo.label}` : ''}
          </span>
        </button>
      </div>
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
