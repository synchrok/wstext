import { LazyStore } from '@tauri-apps/plugin-store';

const store = new LazyStore('updater.json');

interface UpdateState {
  dismissedVersion: string | null;
  availableVersion: string | null;
  updateUrl: string | null;
  isPortable: boolean;
  checking: boolean;
  downloading: boolean;
}

export const updateState = $state<UpdateState>({
  dismissedVersion: null,
  availableVersion: null,
  updateUrl: null,
  isPortable: false,
  checking: false,
  downloading: false,
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

/**
 * Main entry point. Detects portable vs installed and delegates.
 */
export async function checkForUpdate(): Promise<void> {
  if (updateState.checking) return;
  updateState.checking = true;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const portable = await invoke<boolean>('is_portable');
    updateState.isPortable = portable;
    if (portable) {
      await checkPortableUpdate();
    } else {
      await checkInstalledUpdate();
    }
  } catch (err) {
    console.warn('[updater] Failed to detect portable mode:', err);
  } finally {
    updateState.checking = false;
  }
}

/**
 * Check for updates via Tauri updater plugin (installed version).
 */
async function checkInstalledUpdate(): Promise<void> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update && update.version) {
      if (isDismissed(update.version)) return;
      updateState.availableVersion = update.version;
      updateState.updateUrl = '';
      // Store the update object reference for installUpdate
      pendingUpdate = update;
    }
  } catch (err) {
    console.warn('[updater] Update check failed (installed):', err);
  }
}

/**
 * Check for updates via GitHub API (portable version).
 */
async function checkPortableUpdate(): Promise<void> {
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    const currentVersion = await getVersion();
    const response = await fetch('https://api.github.com/repos/synchrok/wstext/releases/latest');
    if (!response.ok) return;
    const data = await response.json() as { tag_name: string; html_url: string };
    const remoteVersion = data.tag_name.replace(/^v/, '');
    if (isNewerVersion(currentVersion, remoteVersion)) {
      if (isDismissed(remoteVersion)) return;
      updateState.availableVersion = remoteVersion;
      updateState.updateUrl = data.html_url;
    }
  } catch (err) {
    console.warn('[updater] Update check failed (portable):', err);
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
