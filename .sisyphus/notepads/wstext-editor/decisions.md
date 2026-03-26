# Decisions — wstext-editor

## [2026-03-26] Session Start

### Scope Boundaries
- IN: tabs, file management, session recovery, 5 themes, MD viewer, todo, formatting, zoom, encoding, status bar
- OUT: file tree, command palette, cross-file search, editor split panels, multi-window, plugins, LSP, autocomplete

### Guardrails (DO NOT implement these)
- No file tree / sidebar
- No editor split panels (markdown split OK)
- No cross-file search (Ctrl+Shift+F)
- No command palette (Ctrl+Shift+P)
- No custom theme creation/import (5 built-in only)
- No multiple windows
- No plugins
- No terminal
- No Git integration
- No autocomplete / LSP
- No undo history across sessions
- No recent files list
- No formatters beyond JSON/YAML
- No Mermaid/KaTeX in markdown
- No auto-update
- No reimplementing Monaco built-ins

### Auto-save Clarification
- NOT file auto-save
- Session state auto-save to local storage only
- Explicit Ctrl+S writes to actual file
- 5s metadata saves + 30s content backups

### Session Persistence Design
- Tier 1: `Store.load('session.json', { autoSave: false })` + manual 5s save for metadata
- Tier 2: `writeFile()` to `$APPDATA/backups/{tabId}.txt` every 30s for dirty content
- Sentinel file: `.wstext-running` created on start, deleted on clean exit
- On crash: sentinel exists → recovery mode, load from backups
