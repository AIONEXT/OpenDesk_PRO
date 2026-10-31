# OpenDesk Pro v3.1 — Feature & Parameter Verification Report

## 1. Root Cause & Permanent Fix for Top-Edge Two-Finger Pull-Down

| Issue Found | Root Cause on macOS | Permanent Fix Applied in `src/main/main.ts` | Status |
| :--- | :--- | :--- | :--- |
| **Top-edge two-finger pull-down not responding** | `sensorWindow` had `focusable: false`, which prevents Chromium's `RenderWidgetHostViewCocoa` on macOS from receiving trackpad `wheel` scroll gestures. | Set `focusable: true` with `type: 'panel'` and `acceptFirstMouse: true`, while showing via `sensorWindow.showInactive()` so it never steals focus from active apps. | ✅ Verified |
| **Window clamped below `y = 0` by macOS WindowServer** | Standard `alwaysOnTop: true` (`floating` level `3`) windows on macOS are clamped below the Menu Bar (`y = 25..38`), so when `cursor.y <= 2` the cursor never overlapped `sensorWindow`. | Added `enableLargerThanScreen: true` and `sensorWindow.setAlwaysOnTop(true, 'screen-saver', 1)` (`level = 1001`) so `sensorWindow` can sit at `y = 0` (`Zone 1`) and `y = menuBarY - 1` (`Zone 2`). | ✅ Verified |
| **Smooth trackpad scroll ticks ignored** | `if (Math.abs(e.deltaY) > 2)` discarded low-delta initial trackpad ticks (`0.5..2.0`) and required `pullAccum >= 18`. | Removed the `> 2` filter; any two-finger trackpad scroll triggers immediately once `pullAccum >= 3.5` or `wheelTicks >= 2` (or downward drag `>= 4px`). | ✅ Verified |
| **macOS Menu Bar interference** | Hovering over the menu bar previously either triggered the drawer or blocked clicks. | `Zone 3` (`6 < cursor.y < menuBarY - 2`) moves `sensorWindow` to `y = menuBarY` with `setIgnoreMouseEvents(true, { forward: true })`, keeping the macOS Menu Bar 100% unobstructed. | ✅ Verified |
| **`EMFILE: too many open files, watch` on slider/theme changes** | `saveSettings()` recreated `fs.watch` watchers on every setting change without `.on('error')` listeners. | Attached `.on('error')` recovery handlers to `folderWatcher` and `notesWatcher`, and restricted `setupWatchers()` to path changes only. | ✅ Verified |

## 2. OS-Matching Theme Line, Dual-Light Themes & macOS Appearance Parameters Tested

| Parameter | Tested Values | Verification Result |
| :--- | :--- | :--- |
| **`theme` (Appearance)** | `liquid`, `light` (`8 Dual-Tone Light Presets`), `solid`, `dark`, `auto` | Syncs with `nativeTheme.shouldUseDarkColors` and updates all semantic `--df-*` CSS tokens. |
| **`liquidGlassIntensity` & `glassTintBlurEnabled`** | `ON/OFF` + `10%`, `20%`, `55%`, `90%`, `95%` | Dynamically maps `--df-liquid-alpha` (`0.12..0.92`), `--df-liquid-card-alpha` (`0.06..0.34`), `--df-glass-tint-rgba`, and `--df-liquid-blur-px` (`8px..76px`). |
| **`dualLightPreset` (Dual Light Combinations)** | `beige-orange`, `white-blue`, `ivory-emerald`, `pearl-coral`, `sand-amber`, `mist-cyan`, `lavender-violet`, `platinum-indigo` | Applies high-contrast dual-tone light surfaces and matching accent colors. |
| **`autoSpellCorrectEnabled` & `make-sentences-and-spellcheck`** | `sentences`, `bullets`, `executive`, `spell-only` | Corrects 130+ common typos and turns rough fragments into punctuated sentences. |
| **All IPC Channels & Commercial Bundle** | Settings, Vault, Recall, Licensing, Spell/Sentence Maker, App/Pkg Integrations, Local/Free AI | 84/84 verification checks passed via `npm test` (`tsc --noEmit && node ./test-all-features.mjs`). |
