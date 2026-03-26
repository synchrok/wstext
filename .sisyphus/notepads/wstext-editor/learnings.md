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

## Task 2: TypeScript Types Definition

### Completed
- Created `src/lib/types.ts` with all required type definitions
- All types exported: Encoding, ViewMode, ThemeName, TabState, SessionState, AppSettings, FileInfo, SESSION_VERSION, DEFAULT_SETTINGS
- svelte-check: 0 errors, 0 warnings ✓

### Key Insights
- Plain `.ts` file (no Svelte runes) — correct for shared type definitions
- TabState.content: only for untitled buffers; file-backed tabs re-read from disk on restore
- SESSION_VERSION = 1 for future migration logic
- DEFAULT_SETTINGS provides sensible defaults (monokai theme, 14px font, 4-space tabs)
- All interfaces fully documented with JSDoc comments

### Type Structure
- **Encoding**: 4 variants (utf-8, utf-16le, utf-16be, latin1)
- **ViewMode**: 3 variants (editor, preview, split)
- **ThemeName**: 5 built-in themes
- **TabState**: 12 properties including cursor position, scroll, encoding metadata
- **SessionState**: version, activeTabId, tabs array, savedAt timestamp
- **AppSettings**: theme, font, tabSize, wordWrap, minimap
- **FileInfo**: path, encoding, BOM, size, language detection

### Next Steps
- Task 3: Create session persistence module (`src/lib/session.ts`)

## Task 3: Theme System (2026-03-26)

### Key Learnings
- **inherit: false is CRITICAL**: Without it, Monaco themes inherit base theme rules and text becomes invisible
- **Empty token rule required**: Each theme must start with `{ token: '', foreground: '...', background: '...' }` to set defaults
- **Light theme base**: solarized-light uses `base: 'vs'` (light) while others use `base: 'vs-dark'`
- **ThemeColors interface**: 13 properties cover editor + UI (tabs, status bar, borders)
- **Color consistency**: Each theme's THEME_COLORS object must match the Monaco theme definition colors

### Implementation Pattern
```typescript
// 1. Define ThemeColors interface (UI colors)
// 2. Create THEME_COLORS record with all 5 themes
// 3. registerAllThemes() calls monaco.editor.defineTheme() for each
// 4. setTheme() applies globally
// 5. getThemeColors() returns UI colors for non-Monaco components
```

### Themes Registered
1. **monokai**: Dark, warm yellows/pinks, green accents
2. **dracula**: Dark, purple/cyan, bright green functions
3. **one-dark**: Dark, blue functions, red variables
4. **solarized-dark**: Dark, muted colors, blue accents
5. **solarized-light**: Light, muted colors, blue accents

### Next Steps
- Wire registerAllThemes() call in App.svelte before editor creation
- Connect theme switcher UI to setTheme()
- Apply getThemeColors() to TabBar and StatusBar components

## Task 7: StatusBar Component (2026-03-26)

### Completed
- Created `src/lib/components/StatusBar.svelte` with full functionality
- Displays: Ln {line}, Col {column} | {encoding} · Spaces: {tabSize} | {language}
- Three sections: left (cursor), center (encoding + spaces), right (language)
- All buttons emit click events for dropdown integration (Task 15)
- svelte-check: 0 errors, 0 warnings ✓

### Key Implementation Details
- **Svelte 5 runes**: Uses `$props()` and `$derived()` for reactive state
- **Encoding display**: Maps 'utf-8' → 'UTF-8', 'utf-16le' → 'UTF-16 LE', etc.
- **Language display**: Capitalizes first letter, special case for 'plaintext' → 'Plain Text'
- **Styling**: 22px height, flex layout with 3 equal sections, hover effects on buttons
- **Props**: All optional with sensible defaults (line=1, column=1, encoding='utf-8', tabSize=4, language='Plain Text')
- **Color props**: bgColor, fgColor, fgMuted for theme integration

### TypeScript Gotcha
- Initial implementation had `encoding.toUpperCase()` as fallback in ternary chain
- TypeScript couldn't narrow the type properly (all Encoding variants covered)
- Fixed by replacing fallback with literal 'UTF-8' (safe since all cases handled)

### Design Decisions
- **No file size/Git branch**: Per spec, only cursor + encoding + spaces + language
- **Buttons not links**: Using `<button>` with `onclick` handlers for accessibility
- **Separator**: Centered section uses `·` (middle dot) with reduced opacity
- **Hover state**: Subtle background color change (rgba(255,255,255,0.1))
- **No dropdown logic**: Deferred to Task 15 (component just emits events)

### Next Steps
- Task 8+: Integrate StatusBar into main App layout
- Task 15: Implement dropdown menus for encoding/spaces/language selection
