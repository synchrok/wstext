# Learnings — wstext-editor

## [2026-03-26] Session Start

### Tech Stack Decisions (Final)
- Tauri v2 + Svelte 5 (pure, no SvelteKit) + Vite + Monaco Editor
- Platform: Windows + Mac
- Theme: Monokai (default) + Dracula, One Dark, Solarized Dark, Solarized Light

### Critical Patterns
- Monaco workers: `?worker` import (NOT vite-plugin-monaco-editor — has ESM/CJS bug)
- `optimizeDeps.exclude: ['monaco-editor']` in vite.config.ts is REQUIRED
- Tab management: 1 editor instance + N models (setModel swap, NOT multiple editors)
- Todo checkboxes: CSS Decorations + onMouseDown (NOT Content Widgets — overlay issue)
- Session store: `LazyStore` from @tauri-apps/plugin-store
- Encoding: always `readFile()` (binary Uint8Array), never `readTextFile()` (UTF-8 only)
- Svelte 5 runes in modules: MUST use `.svelte.ts` extension (not `.ts`)
- Tauri capabilities: all calls silently fail without explicit permissions in `capabilities/default.json`

### Critical Gotchas
- `model.dispose()` MUST be called on tab close — otherwise URI reuse fails and memory leaks
- `editor.saveViewState()` / `restoreViewState()` required on tab switch for cursor/scroll preservation
- `monaco.editor.defineTheme()` MUST be called before first `editor.create()`
- macOS window restore bug: set `"visible": false` in tauri.conf.json, restore in setup hook
- BOM detection order: UTF-16 LE (FF FE) → UTF-16 BE (FE FF) → UTF-8 BOM (EF BB BF) → UTF-8
- YAML worker: local re-export file required (`src/lib/yaml.worker.ts` → `import 'monaco-yaml/yaml.worker.js'`); direct import causes Vite error
- DOMPurify required for markdown HTML even in Tauri webview (JS execution still possible)
- Sentinel file pattern for crash detection: create on start, delete on clean exit
- Atomic writes: write to temp → rename (prevents corruption on crash)

## [2026-03-26] Task 1 Scaffold Learnings

- `npm create tauri-app --template svelte-ts` currently scaffolds SvelteKit-oriented frontend files (`src/app.html`, `src/routes/*`, `vite.config.js` using `sveltekit()`), so converting to pure Svelte+Vite requires replacing entry with `index.html` + `src/main.ts` + `svelte()` plugin.
- Tauri v2 window config key is `dragDropEnabled` (not `fileDropEnabled`), otherwise `tauri dev` fails schema validation.
- Monaco worker setup is validated when `vite build` emits dedicated worker chunks (`editor/json/css/html/ts worker` bundles).
- Rust LSP may be unavailable in this environment (`rust-analyzer` missing), so `cargo check` is the reliable compile verification fallback.
