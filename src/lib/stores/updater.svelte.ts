import { LazyStore } from '@tauri-apps/plugin-store';

const store = new LazyStore('updater.json');

interface UpdateState {
  dismissedVersion: string | null;
  availableVersion: string | null;
  updateUrl: string | null;
  isPortable: boolean;
  checking: boolean;
  downloading: boolean;
  // Outcome of the most recent MANUAL check (menu trigger). Auto-checks leave this null.
  manualCheckOutcome: 'available' | 'latest' | 'error' | null;
}

export const updateState = $state<UpdateState>({
  dismissedVersion: null,
  availableVersion: null,
  updateUrl: null,
  isPortable: false,
  checking: false,
  downloading: false,
  manualCheckOutcome: null,
});

export async function loadUpdateState(): Promise<void> {
  try {
    const saved = await store.get<{ dismissedVersion: string | null }>('updateState');
    if (saved?.dismissedVersion !== undefined) {
      updateState.dismissedVersion = saved.dismissedVersion;
    }
  } catch (err) {
    console.warn('[updater] Failed to load update state:', err);
  }
}

export async function dismissVersion(version: string): Promise<void> {
  updateState.dismissedVersion = version;
  updateState.availableVersion = null;
  try {
    await store.set('updateState', { dismissedVersion: version });
    await store.save();
  } catch (err) {
    console.warn('[updater] Failed to save dismiss state:', err);
  }
}

export function isDismissed(version: string): boolean {
  return updateState.dismissedVersion === version;
}

export function resetUpdateState(): void {
  updateState.availableVersion = null;
  updateState.updateUrl = null;
  updateState.checking = false;
  updateState.downloading = false;
}

// ─── Update Check Logic ────────────────────────────────────────────────

/**
 * Compare two semver strings. Returns true if remote > current.
 * Strips leading 'v' prefix if present.
 */
function isNewerVersion(current: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [cMaj, cMin, cPatch] = parse(current);
  const [rMaj, rMin, rPatch] = parse(remote);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPatch > cPatch;
}

/** force=true (menu trigger) bypasses dismissedVersion and sets manualCheckOutcome for toast UI. */
export async function checkForUpdate(force: boolean = false): Promise<void> {
  if (updateState.checking) return;
  updateState.checking = true;
  if (force) updateState.manualCheckOutcome = null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const portable = await invoke<boolean>('is_portable');
    updateState.isPortable = portable;
    if (portable) {
      await checkPortableUpdate(force);
    } else {
      await checkInstalledUpdate(force);
    }
  } catch (err) {
    console.warn('[updater] Failed to detect portable mode:', err);
    if (force) updateState.manualCheckOutcome = 'error';
  } finally {
    updateState.checking = false;
  }
}

/**
 * Check for updates via Tauri updater plugin (installed version).
 */
async function checkInstalledUpdate(force: boolean): Promise<void> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update && update.version) {
      if (!force && isDismissed(update.version)) return;
      updateState.availableVersion = update.version;
      updateState.updateUrl = '';
      pendingUpdate = update;
      if (force) updateState.manualCheckOutcome = 'available';
    } else if (force) {
      updateState.manualCheckOutcome = 'latest';
    }
  } catch (err) {
    console.warn('[updater] Update check failed (installed):', err);
    if (force) updateState.manualCheckOutcome = 'error';
  }
}

/**
 * Check for updates via GitHub API (portable version).
 */
async function checkPortableUpdate(force: boolean): Promise<void> {
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    const currentVersion = await getVersion();
    const response = await fetch('https://api.github.com/repos/synchrok/wstext/releases/latest');
    if (!response.ok) {
      if (force) updateState.manualCheckOutcome = 'error';
      return;
    }
    const data = await response.json() as { tag_name: string; html_url: string };
    const remoteVersion = data.tag_name.replace(/^v/, '');
    if (isNewerVersion(currentVersion, remoteVersion)) {
      if (!force && isDismissed(remoteVersion)) return;
      updateState.availableVersion = remoteVersion;
      updateState.updateUrl = data.html_url;
      if (force) updateState.manualCheckOutcome = 'available';
    } else if (force) {
      updateState.manualCheckOutcome = 'latest';
    }
  } catch (err) {
    console.warn('[updater] Update check failed (portable):', err);
    if (force) updateState.manualCheckOutcome = 'error';
  }
}

// Hold pending update object for installUpdate
let pendingUpdate: { downloadAndInstall: () => Promise<void> } | null = null;

/**
 * Download and install update, then relaunch (installed version only).
 */
export async function installUpdate(): Promise<void> {
  if (!pendingUpdate) return;
  updateState.downloading = true;
  try {
    await pendingUpdate.downloadAndInstall();
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (err) {
    console.warn('[updater] Install failed:', err);
    updateState.downloading = false;
  }
}
