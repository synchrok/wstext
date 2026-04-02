import { load } from '@tauri-apps/plugin-store';
import { readTextFile, writeTextFile, exists, mkdir, remove } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/plugin-fs';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { SessionState, TabState } from './types';
import { SESSION_VERSION } from './types';
import { tabStore } from './stores/tabs.svelte';
import { displayToFile, fileToDisplay } from './todo';
import { atomicWriteText } from './utils/atomicWrite';

const SENTINEL_FILE = '.wstext-running';
const SESSION_STORE_KEY = 'session';
const BACKUP_DIR = 'backups';

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

  // Check for crash sentinel
  try {
    const sentinelExists = await exists(SENTINEL_FILE, { baseDir: BaseDirectory.AppData });
    sessionStatus.wasCrash = sentinelExists;
  } catch {
    sessionStatus.wasCrash = false;
  }

  // Restore session
  sessionStatus.isRestoring = true;
  try {
    await restoreSession();
  } finally {
    sessionStatus.isRestoring = false;
  }

  // Write sentinel (marks that we're running)
  try {
    await writeTextFile(SENTINEL_FILE, new Date().toISOString(), {
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
    await handleCleanExit();
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
    const saved = await store.get<SessionState>(SESSION_STORE_KEY);

    if (!saved || saved.version !== SESSION_VERSION || !saved.tabs.length) {
      return; // No session or schema mismatch — fresh start
    }

    // Restore each tab
    for (const tabData of saved.tabs) {
      await restoreTab(tabData);
    }
  } catch {
    // Corrupted session — fresh start (no error shown)
  }
}

/**
 * Restore a single tab from session data.
 */
async function restoreTab(tab: TabState): Promise<void> {
  try {
    let content = tab.content;

    if (tab.filePath) {
      // File-backed tab: re-read from disk (use cached content as fallback)
      try {
        const { readFileWithEncoding } = await import('./utils/encoding');
        const result = await readFileWithEncoding(tab.filePath);
        content = result.content;
      } catch {
        // File read failed — silently use whatever content we have from session cache
        // (content may be empty string for new/empty files — that's fine)
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

    content = fileToDisplay(content);

    // Open tab via global event (tabs store handles the actual tab creation)
    window.dispatchEvent(
      new CustomEvent('wstext:restore-tab', {
        detail: { ...tab, content },
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
      // Always store full content — Tauri FS scope may block re-read on restore
      content: displayToFile(t.content),
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
    await store.set(SESSION_STORE_KEY, buildSessionState());
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

    // Remove sentinel (marks clean exit)
    await remove(SENTINEL_FILE, { baseDir: BaseDirectory.AppData });
  } catch {
    // Non-critical — exit anyway
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
