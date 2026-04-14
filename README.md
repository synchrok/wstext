<p align="center">
  <img src="static/wstext-icon.png" width="128" height="128" alt="WSText" />
</p>

<h1 align="center">WSText</h1>

<p align="center">
  <strong>A tiny, fast text editor with native todo checkboxes and markdown preview.</strong>
</p>

<p align="center">
  Built with Tauri v2 + Svelte 5 + Monaco Editor.<br/>
  Inspired by Sublime Text — only the essentials, nothing more.
</p>

<p align="center">
  <a href="README.ko.md">한국어</a>
</p>

---

## Features

**Core**
- Lightweight native desktop app (~10MB installer)
- Multi-tab editing with session restore
- Ctrl+mousewheel zoom, word wrap, minimap
- Drag & drop file open, recent files list
- Auto-detect file encoding (UTF-8, UTF-16 LE/BE, Latin-1)

**Native Todo Checkboxes**
- Type `[]` and it becomes a checkbox `☐`
- Click or `Ctrl+Enter` to toggle checked `☑`
- Checked items turn semi-transparent
- Multi-line select + `Ctrl+Enter` toggles all at once
- Saved as standard `[ ]` / `[x]` in files — compatible everywhere

**Markdown Preview**
- Split view: editor + live preview side by side
- Toggle via status bar button or `Ctrl+Shift+M`
- `.md` files open in split view automatically
- Syntax-highlighted code blocks, tables, task lists

**Customization**
- 5 built-in themes (One Dark, Monokai, Dracula, Solarized Dark/Light)
- System font picker with Korean font support
- Bundled [Pretendard](https://github.com/orioncactus/pretendard) font
- Settings dialog: General / Font / Theme

## Install

Download the latest release from [Releases](../../releases):

| Platform | File |
|----------|------|
| Windows | `WSText_x.x.x_x64-setup.exe` or `.msi` |
| macOS (Apple Silicon) | `WSText_x.x.x_aarch64.dmg` |
| macOS (Intel) | `WSText_x.x.x_x64.dmg` |

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New file | `Ctrl+N` |
| Open file | `Ctrl+O` |
| Save | `Ctrl+S` |
| Save as | `Ctrl+Shift+S` |
| Close tab | `Ctrl+W` |
| Close all tabs | `Ctrl+Shift+W` |
| Toggle checkbox | `Ctrl+Enter` |
| Toggle preview | `Ctrl+Shift+M` |
| Zoom in/out | `Ctrl+Mouse wheel` |
| Next/prev tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |

## Build from Source

**Prerequisites**: Node.js 20+, Rust, platform build tools ([Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

```bash
# Install dependencies
npm install

# Dev mode
npm run tauri dev

# Release build
npm run tauri build
```

## Roadmap

- [x] Project mode — manage multiple files and folders
- [ ] Plugin system
- [ ] Linux support

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | [Tauri v2](https://v2.tauri.app) |
| Frontend | [Svelte 5](https://svelte.dev) |
| Editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| Markdown | [marked](https://marked.js.org) + [highlight.js](https://highlightjs.org) |
| Font | [Pretendard](https://github.com/orioncactus/pretendard) |

## License

MIT
