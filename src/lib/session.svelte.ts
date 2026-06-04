import { load } from '@tauri-apps/plugin-store';
import { readTextFile, writeTextFile, exists, mkdir, remove, stat } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/plugin-fs';
import { confirm } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { SessionState, TabState } from './types';
import { SESSION_VERSION } from './types';
import { tabStore } from './stores/tabs.svelte';
import { displayToFile, fileToDisplay } from './todo';
import { atomicWriteText } from './utils/atomicWrite';
import {
  MAIN_WINDOW_LABEL,
  getWindowLabel,
  isMainWindow,
  isAdoptWindow,
  removeFromManifest,
} from './multiWindow';

const LEGACY_SESSION_KEY = 'session';
const BACKUP_DIR = 'backups';

function getSessionKey(): string {
  return `session:${getWindowLabel()}`;
}

function getSentinelPath(): string {
  return `.wstext-running-${getWindowLabel()}`;
}

/** Session status state — wrapped in object to avoid Svelte 5 export-reassignment restriction */
export const sessionStatus = $state({
  wasCrash: false,
  isRestoring: false,
});

let sessionSaveTimer: ReturnType<typeof setInterval> | undefined;
let contentBackupTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Lazy store for session metadata (tab list, cursor, scroll).
 * autoSave: false — we manage saves manually for crash safety.
 */
let sessionStore: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!sessionStore) {
    sessionStore = await load('session.json', { autoSave: false, defaults: {} });
  }
  return sessionStore;
}

/**
 * Initialize session system on app startup.
 * 1. Check for crash sentinel
 * 2. Load & restore last session
 * 3. Write new sentinel
 * 4. Start auto-save timers
 */
export async function initSession(): Promise<void> {
  // Ensure backup directory exists
  try {
    const backupExists = await exists(BACKUP_DIR, { baseDir: BaseDirectory.AppData });
    if (!backupExists) {
      await mkdir(BACKUP_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
    }
  } catch {
    // Non-critical — proceed anyway
  }

  // Check for crash sentinel (per-window)
  const sentinelPath = getSentinelPath();
  try {
    const sentinelExists = await exists(sentinelPath, { baseDir: BaseDirectory.AppData });
    sessionStatus.wasCrash = sentinelExists;
  } catch {
    sessionStatus.wasCrash = false;
  }

  // Restore session — skip entirely for adoption windows (they receive a tab via emit)
  sessionStatus.isRestoring = true;
  try {
    if (!isAdoptWindow()) {
      await restoreSession();
    }
  } finally {
    sessionStatus.isRestoring = false;
  }

  // Write sentinel (marks that we're running)
  try {
    await writeTextFile(sentinelPath, new Date().toISOString(), {
      baseDir: BaseDirectory.AppData,
    });
  } catch {
    // Non-critical
  }

  // Start auto-save timers
  startAutoSave();

  // Register clean exit handler
  const appWindow = getCurrentWindow();
  await appWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    // Force destroy after 3s regardless
    const forceQuit = setTimeout(() => appWindow.destroy(), 3000);
    try {
      await handleCleanExit();
    } catch { /* ignore */ }
    clearTimeout(forceQuit);
    await appWindow.destroy();
  });
}

/**
 * Restore session from last save.
 * Handles corrupted session gracefully (fresh start).
 */
async function restoreSession(): Promise<void> {
  try {
    const store = await getStore();
    const sessionKey = getSessionKey();
    let saved = await store.get<SessionState>(sessionKey);

    // Migration: the main window adopts the legacy `session` key if present
    // and its own `session:main` key doesn't exist yet. Preserves existing users.
    if ((!saved || !saved.tabs?.length) && isMainWindow()) {
      const legacy = await store.get<SessionState>(LEGACY_SESSION_KEY);
      if (legacy && legacy.version === SESSION_VERSION && legacy.tabs?.length) {
        saved = legacy;
        // Re-save under the new key so we only migrate once.
        try {
          await store.set(sessionKey, legacy);
          await store.save();
        } catch { /* non-critical */ }
      }
    }

    if (!saved || saved.version !== SESSION_VERSION || !saved.tabs.length) {
      return; // No session or schema mismatch — fresh start
    }

    // Restore each tab. `savedAt` is the sync point: any disk mtime newer
    // than this means the file was externally modified while WSText was
    // closed (which only matters for dirty tabs — see restoreTab).
    const savedAt = typeof saved.savedAt === 'number' ? saved.savedAt : 0;
    for (const tabData of saved.tabs) {
      await restoreTab(tabData, savedAt);
    }
  } catch {
    // Corrupted session — fresh start (no error shown)
  }
}

/**
 * Restore a single tab from session data.
 *
 * Content-source policy for file-backed tabs:
 *
 *           |   disk.mtime <= savedAt   |   disk.mtime > savedAt
 *   --------+--------------------------+----------------------------
 *   CLEAN   |   re-read disk           |   re-read disk
 *           |   (idempotent)           |   (picks up external edits)
 *   --------+--------------------------+----------------------------
 *   DIRTY   |   use session content    |   CONFLICT — ask the user
 *           |   (preserves unsaved     |   (both sides have changes
 *           |    edits — the original  |    since the last sync)
 *           |    bug fix)              |
 *
 * Untitled tabs always restore from the per-tab backup file when one exists,
 * falling back to the session snapshot.
 */
async function restoreTab(tab: TabState, sessionSavedAt: number): Promise<void> {
  try {
    let content = tab.content;
    let isDirty = tab.isDirty;
    let encoding = tab.encoding;
    let hasBOM = tab.hasBOM;

    if (tab.filePath) {
      if (!tab.isDirty) {
        // Clean tab — prefer fresh disk content so external edits show up.
        try {
          const { readFileWithEncoding } = await import('./utils/encoding');
          const result = await readFileWithEncoding(tab.filePath);
          content = result.content;
        } catch {
          // File read failed — silently use whatever content we have from
          // session cache (content may be empty string for new/empty files).
        }
      } else {
        // Dirty tab — check whether disk was externally modified while
        // WSText was closed (the only situation where preferring session
        // content alone could lose external work).
        let diskMtimeMs = 0;
        try {
          const info = await stat(tab.filePath);
          diskMtimeMs = info.mtime instanceof Date ? info.mtime.getTime() : 0;
        } catch {
          // File missing or unreadable — fall through; session content wins.
        }

        if (diskMtimeMs > 0 && diskMtimeMs > sessionSavedAt) {
          // Conflict: both session and disk have changes after the last
          // sync point. Ask the user which side wins. Default (cancel/ESC)
          // = keep the user's unsaved edits — never silently destroy work.
          const useDisk = await confirm(
            '이 파일이 외부에서 변경되었지만, 저장하지 않은 편집사항도 남아있습니다.\n\n' +
              '"디스크 내용 사용": 외부의 최신 내용을 불러옵니다 (저장하지 않은 편집사항은 사라집니다)\n' +
              '"내 편집 유지": 저장하지 않은 편집사항을 그대로 유지합니다',
            {
              title: tab.title,
              kind: 'warning',
              okLabel: '디스크 내용 사용',
              cancelLabel: '내 편집 유지',
            }
          );
          if (useDisk) {
            try {
              const { readFileWithEncoding } = await import('./utils/encoding');
              const result = await readFileWithEncoding(tab.filePath);
              content = result.content;
              encoding = result.encoding;
              hasBOM = result.hasBOM;
              isDirty = false; // User accepted disk content — tab is now clean.
            } catch {
              // Disk read failed despite stat succeeding — keep session.
            }
          }
          // else: keep session content (already in `content`); tab stays dirty.
        }
        // else: disk is older or same age as the session snapshot. Session
        // contains the latest version — use it. This is the auto-update /
        // normal-close path that was previously losing user data.
      }
    } else {
      // Untitled tab: try backup file first
      try {
        const backupPath = `${BACKUP_DIR}/${tab.id}.txt`;
        const backupExists = await exists(backupPath, { baseDir: BaseDirectory.AppData });
        if (backupExists) {
          content = await readTextFile(backupPath, { baseDir: BaseDirectory.AppData });
        }
      } catch {
        // Backup not found — use session content
      }
    }

    // Checkbox conversion is plaintext-only — keep yaml/json/source files untouched.
    if (tab.language === 'plaintext') {
      content = fileToDisplay(content);
    }

    // Open tab via global event (tabs store handles the actual tab creation)
    window.dispatchEvent(
      new CustomEvent('wstext:restore-tab', {
        detail: { ...tab, content, isDirty, encoding, hasBOM },
      })
    );
  } catch {
    // Skip this tab silently
  }
}

/**
 * Build current session state snapshot.
 */
function buildSessionState(): SessionState {
  return {
    version: SESSION_VERSION,
    activeTabId: tabStore.activeTabId,
    tabs: tabStore.tabs.map((t) => ({
      ...t,
      // Always store full content — Tauri FS scope may block re-read on restore.
      // Only plaintext tabs hold display-format checkboxes; everything else is stored verbatim.
      content: t.language === 'plaintext' ? displayToFile(t.content) : t.content,
    })),
    savedAt: Date.now(),
  };
}

/**
 * Save session metadata (tab list, cursor, scroll).
 */
export async function saveSessionMetadata(): Promise<void> {
  try {
    const store = await getStore();
    await store.set(getSessionKey(), buildSessionState());
    await store.save();
  } catch {
    // Non-critical — auto-save will retry
  }
}

/**
 * Save content backup for a dirty untitled tab.
 */
async function saveContentBackup(tab: TabState): Promise<void> {
  if (!tab.isDirty) return;
  if (tab.filePath) return; // Only back up untitled tabs

  try {
    const backupPath = `${BACKUP_DIR}/${tab.id}.txt`;
    await atomicWriteText(backupPath, tab.content, BaseDirectory.AppData);
  } catch {
    // Non-critical
  }
}

/**
 * Start the 2-tier auto-save timers.
 * Tier 1: Session metadata every 5 seconds
 * Tier 2: Content backups every 30 seconds
 */
function startAutoSave(): void {
  // Tier 1: Metadata — 5 seconds
  sessionSaveTimer = setInterval(() => {
    saveSessionMetadata();
  }, 5000);

  // Tier 2: Content backups — 30 seconds
  contentBackupTimer = setInterval(() => {
    for (const tab of tabStore.tabs) {
      if (tab.isDirty && !tab.filePath) {
        saveContentBackup(tab);
      }
    }
  }, 30000);
}

/**
 * Stop auto-save timers.
 */
function stopAutoSave(): void {
  if (sessionSaveTimer !== undefined) {
    clearInterval(sessionSaveTimer);
    sessionSaveTimer = undefined;
  }
  if (contentBackupTimer !== undefined) {
    clearInterval(contentBackupTimer);
    contentBackupTimer = undefined;
  }
}

/**
 * Handle clean application exit:
 * 1. Save final session state
 * 2. Remove sentinel file
 */
async function handleCleanExit(): Promise<void> {
  stopAutoSave();

  try {
    // Final session save
    await saveSessionMetadata();

    // Back up any dirty untitled tabs
    for (const tab of tabStore.tabs) {
      if (tab.isDirty && !tab.filePath) {
        await saveContentBackup(tab);
      }
    }

    // Remove sentinel (marks clean exit) — per-window
    await remove(getSentinelPath(), { baseDir: BaseDirectory.AppData });
  } catch {
    // Non-critical — exit anyway
  }

  // Secondary windows drop themselves from the manifest so they won't be
  // recreated on the next startup. The main window never removes itself.
  try {
    if (!isMainWindow()) {
      await removeFromManifest(getWindowLabel());
    }
  } catch {
    /* non-critical */
  }
}

/**
 * Restore any secondary windows recorded in the window manifest.
 * ONLY call from the main window at startup. Each created window will
 * run its own `initSession()` and pull its own `session:{label}` key.
 */
export async function restoreSecondaryWindowsFromManifest(): Promise<void> {
  if (!isMainWindow()) return;
  try {
    const { readManifest, createNewWindow } = await import('./multiWindow');
    const manifest = await readManifest();
    for (const entry of manifest.windows) {
      if (entry.label === MAIN_WINDOW_LABEL) continue;
      try {
        await createNewWindow({ label: entry.label, focus: false });
      } catch {
        // If restore fails for one window, skip it but keep manifest intact —
        // user can try again next relaunch.
      }
    }
  } catch {
    /* non-critical */
  }
}

/**
 * Clean up a tab's backup file when it's saved or closed.
 */
export async function cleanupTabBackup(tabId: string): Promise<void> {
  try {
    const backupPath = `${BACKUP_DIR}/${tabId}.txt`;
    const backupExists = await exists(backupPath, { baseDir: BaseDirectory.AppData });
    if (backupExists) {
      await remove(backupPath, { baseDir: BaseDirectory.AppData });
    }
  } catch {
    // Non-critical
  }
}
