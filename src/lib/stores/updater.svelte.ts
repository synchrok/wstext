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
