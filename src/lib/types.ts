/**
 * Supported file encodings for wstext editor.
 */
export type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'latin1';

/**
 * Editor view mode — plain editor, markdown preview only, or split view.
 */
export type ViewMode = 'editor' | 'preview' | 'split';

/**
 * Available built-in themes.
 */
export type ThemeName = 'monokai' | 'dracula' | 'one-dark' | 'solarized-dark' | 'solarized-light';

/**
 * Represents a single open editor tab.
 */
export interface TabState {
  /** Stable UUID, never changes even if tab is reordered. */
  id: string;
  /** Absolute file path, or null for unsaved buffers. */
  filePath: string | null;
  /** Display name for the tab (filename or "Untitled-N"). */
  title: string;
  /** Full text content — only stored for untitled/unsaved buffers. File-backed tabs re-read from disk. */
  content: string;
  /** True if content has changed since last file save (Ctrl+S). */
  isDirty: boolean;
  /** Last known cursor position. */
  cursor: { line: number; column: number };
  /** Scroll offset in pixels from top. */
  scrollTop: number;
  /** Current view mode for this tab. */
  viewMode: ViewMode;
  /** Encoding of the file (for round-trip preservation). */
  encoding: Encoding;
  /** Whether a BOM was present when the file was opened. */
  hasBOM: boolean;
  /** Monaco language ID (e.g. 'typescript', 'json', 'plaintext'). */
  language: string;
  /** If true, this tab was from a large file (>5MB) and runs in degraded mode. */
  isLargeFile?: boolean;
}

/**
 * Persisted session state — stored to $APPDATA/session.json.
 */
export interface SessionState {
  /** Schema version for migrations. Increment when structure changes. */
  version: number;
  /** ID of the active tab, or null if no tabs open. */
  activeTabId: string | null;
  /** All open tabs. */
  tabs: TabState[];
  /** Unix timestamp (ms) when the session was last saved. */
  savedAt: number;
}

/**
 * Application settings — stored to $APPDATA/settings.json.
 */
export interface AppSettings {
  /** Active Monaco theme name. */
  theme: ThemeName;
  /** Font family for the editor (CSS font-family value). */
  fontFamily: string;
  /** Font size in pixels. */
  fontSize: number;
  /** Number of spaces per tab indent (2 or 4). */
  tabSize: 2 | 4;
  /** Monaco word wrap setting. */
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  /** Whether the minimap is visible. */
  minimap: boolean;
}

/**
 * File metadata after reading from disk.
 */
export interface FileInfo {
  /** Absolute file path. */
  path: string;
  /** Detected or specified encoding. */
  encoding: Encoding;
  /** Whether the file had a BOM. */
  hasBOM: boolean;
  /** File size in bytes. */
  size: number;
  /** Detected Monaco language ID from file extension. */
  language: string;
}

/** Current session schema version. Increment on breaking changes to SessionState. */
export const SESSION_VERSION = 1;

/** Default app settings used when no settings.json exists. */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'monokai',
  fontFamily: "Consolas, 'Courier New', monospace",
  fontSize: 14,
  tabSize: 4,
  wordWrap: 'on',
  minimap: true,
};
