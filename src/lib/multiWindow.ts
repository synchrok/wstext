/**
 * Multi-window helpers.
 *
 * Design:
 * - Label scheme: main (boot) or `wstext-{timestamp}-{rand}` (created at runtime).
 * - Window manifest: persisted list of secondary labels used to restore secondaries
 *   after a relaunch. Stored inside `session.json` under the `windows` key so we
 *   share the same LazyStore and benefit from its atomic writes.
 * - Cross-window IPC: Tauri event bus. Window-local DOM events (window.dispatchEvent)
 *   are intentionally avoided for anything that must cross windows.
 */
import { WebviewWindow, getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, emitTo, once, listen } from '@tauri-apps/api/event';
import { load } from '@tauri-apps/plugin-store';
import type { TabState } from './types';

export const MAIN_WINDOW_LABEL = 'main';
export const SECONDARY_LABEL_PREFIX = 'wstext-';

// Cross-window event names.
export const MW_EVENTS = {
  READY: 'wstext:mw:ready',
  ADOPT_TAB: 'wstext:mw:adopt-tab',
  SETTINGS_CHANGED: 'wstext:mw:settings-changed',
} as const;

const MANIFEST_STORE_FILE = 'session.json';
const MANIFEST_KEY = 'windows';
const READY_TIMEOUT_MS = 5000;
const ADOPT_TIMEOUT_MS = 10000;
const CREATION_TIMEOUT_MS = 3000;

interface WindowManifest {
  windows: Array<{ label: string; createdAt: number }>;
}

let manifestStorePromise: ReturnType<typeof load> | null = null;
async function getManifestStore() {
  if (!manifestStorePromise) {
    manifestStorePromise = load(MANIFEST_STORE_FILE, { autoSave: false, defaults: {} });
  }
  return manifestStorePromise;
}

export function getWindowLabel(): string {
  return getCurrentWindow().label;
}

export function isMainWindow(): boolean {
  return getWindowLabel() === MAIN_WINDOW_LABEL;
}

export function isSecondaryWindow(): boolean {
  return getWindowLabel().startsWith(SECONDARY_LABEL_PREFIX);
}

export function isAdoptWindow(): boolean {
  try {
    return new URLSearchParams(location.search).has('adopt');
  } catch {
    return false;
  }
}

function generateLabel(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${SECONDARY_LABEL_PREFIX}${Date.now()}-${rand}`;
}

// ─── Manifest ──────────────────────────────────────────────────────────

export async function readManifest(): Promise<WindowManifest> {
  try {
    const store = await getManifestStore();
    const saved = await store.get<WindowManifest>(MANIFEST_KEY);
    if (saved && Array.isArray(saved.windows)) return saved;
  } catch {
    /* fall through */
  }
  return { windows: [] };
}

async function writeManifest(manifest: WindowManifest): Promise<void> {
  try {
    const store = await getManifestStore();
    await store.set(MANIFEST_KEY, manifest);
    await store.save();
  } catch {
    /* non-critical */
  }
}

export async function addToManifest(label: string): Promise<void> {
  if (label === MAIN_WINDOW_LABEL) return;
  const manifest = await readManifest();
  if (manifest.windows.some((w) => w.label === label)) return;
  manifest.windows.push({ label, createdAt: Date.now() });
  await writeManifest(manifest);
}

export async function removeFromManifest(label: string): Promise<void> {
  if (label === MAIN_WINDOW_LABEL) return;
  const manifest = await readManifest();
  const next = manifest.windows.filter((w) => w.label !== label);
  if (next.length === manifest.windows.length) return;
  await writeManifest({ windows: next });
}

// ─── Window creation ───────────────────────────────────────────────────

interface NewWindowOptions {
  /** If true, new window boots in adopt mode (won't auto-create blank tab). */
  adopt?: boolean;
  /** Override label (used when restoring from manifest). */
  label?: string;
  /** Initial window position (screen coords). */
  position?: { x: number; y: number };
  /** Give focus after creation. Default true. */
  focus?: boolean;
}

/**
 * Build WebviewWindow options that mirror the main window's look
 * (custom title bar, transparent, no native decorations).
 *
 * We keep `transparent: false` for secondaries and show them immediately so
 * the user gets instant visual feedback when spawning a new window; the
 * loading cost of the JS bundle is unavoidable either way. A solid
 * backgroundColor hides the white flash.
 */
function buildWindowOptions(opts: NewWindowOptions): Record<string, unknown> {
  const url = opts.adopt ? '/?adopt=1' : '/';
  const options: Record<string, unknown> = {
    url,
    title: 'WSText',
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    decorations: false,
    shadow: false,
    transparent: true,
    dragDropEnabled: true,
    visible: true,
    backgroundColor: '#1e1f1c',
    focus: opts.focus !== false,
  };
  if (opts.position) {
    options.x = opts.position.x;
    options.y = opts.position.y;
  }
  return options;
}

/**
 * Create a new window. Registers it in the manifest so it survives relaunch.
 * Returns the assigned label.
 */
export async function createNewWindow(opts: NewWindowOptions = {}): Promise<string> {
  const label = opts.label ?? generateLabel();
  const options = buildWindowOptions(opts);

  // Register in manifest BEFORE creating. If creation fails, we clean up.
  await addToManifest(label);

  try {
    const win = new WebviewWindow(label, options);
    // Wait for the webview to confirm creation (or fail loudly).
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Window creation timeout')), CREATION_TIMEOUT_MS);
      win.once('tauri://created', () => {
        clearTimeout(timer);
        resolve();
      });
      win.once('tauri://error', (e) => {
        clearTimeout(timer);
        reject(new Error(`Window error: ${JSON.stringify(e)}`));
      });
    });
  } catch (err) {
    await removeFromManifest(label);
    throw err;
  }

  return label;
}

/**
 * Describes a known WSText window and its current bounds on screen.
 * Used to decide whether a drag-out should land in an existing window
 * (drag-in) versus spawning a brand-new one.
 */
export interface WindowBounds {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Return bounds for every other WSText webview (i.e. excluding the current
 * window). Coordinates are in OS screen space so they match mouse `screenX/Y`.
 */
export async function getOtherWindowBounds(): Promise<WindowBounds[]> {
  const myLabel = getWindowLabel();
  const all = await getAllWebviewWindows();
  const out: WindowBounds[] = [];
  for (const w of all) {
    if (w.label === myLabel) continue;
    try {
      const [pos, size, factor] = await Promise.all([
        w.outerPosition(),
        w.outerSize(),
        w.scaleFactor(),
      ]);
      // outerPosition/outerSize are in physical pixels; convert to logical
      // pixels so they align with `screenX/Y`, which are logical on modern
      // browsers/Chromium. (Tauri 2 returns PhysicalPosition/Size.)
      out.push({
        label: w.label,
        x: pos.x / factor,
        y: pos.y / factor,
        width: size.width / factor,
        height: size.height / factor,
      });
    } catch {
      // Window may have been destroyed between list & query — skip.
    }
  }
  return out;
}

/**
 * Pick the window whose bounds contain the given screen point.
 * Returns null if none match. If multiple match (overlap), the first wins.
 */
export function findWindowAt(
  screenX: number,
  screenY: number,
  windows: WindowBounds[]
): WindowBounds | null {
  for (const w of windows) {
    if (
      screenX >= w.x &&
      screenX <= w.x + w.width &&
      screenY >= w.y &&
      screenY <= w.y + w.height
    ) {
      return w;
    }
  }
  return null;
}

/**
 * Send a tab to an existing WSText window (drag-in).
 * The target window must already have an adopt listener registered — this
 * is true for every WSText window since App.svelte registers one on mount.
 */
export async function sendTabToExistingWindow(
  targetLabel: string,
  tabData: TabState
): Promise<void> {
  await emitTo(targetLabel, MW_EVENTS.ADOPT_TAB, { tabData });
  // Best effort: focus the receiving window so the user sees the landing tab.
  try {
    const all = await getAllWebviewWindows();
    const win = all.find((w) => w.label === targetLabel);
    if (win) {
      await win.unminimize().catch(() => {});
      await win.setFocus().catch(() => {});
    }
  } catch {
    /* non-critical */
  }
}

/**
 * Hand a tab off to a brand-new adoption window.
 *
 * Flow:
 *   1. pre-register a `wstext:mw:ready` listener
 *   2. create the new window (hidden, `?adopt=1`)
 *   3. when the new window signals ready, emitTo it the tab payload
 *
 * Returns quickly once the event is dispatched — the caller can then remove
 * the tab from the source window.
 */
export async function handOffTabToNewWindow(
  tabData: TabState,
  opts: { position?: { x: number; y: number } } = {}
): Promise<{ label: string; delivered: boolean }> {
  const label = generateLabel();
  await addToManifest(label);

  // Register the ready listener BEFORE creating the window so we can't miss
  // the signal due to a race. `once` fires and auto-unlistens on match; we
  // also wrap it with our own filter in case another new window races.
  let resolveReady: () => void;
  let rejectReady: (err: Error) => void;
  const readyPromise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const unlistenReady = await listen<{ label: string }>(MW_EVENTS.READY, (evt) => {
    if (evt.payload?.label === label) {
      resolveReady();
    }
  });
  const readyTimer = setTimeout(() => {
    rejectReady(new Error('Adoption handshake timeout'));
  }, READY_TIMEOUT_MS);

  try {
    const win = new WebviewWindow(label, buildWindowOptions({ adopt: true, position: opts.position }));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Adoption window creation timeout')), CREATION_TIMEOUT_MS);
      win.once('tauri://created', () => {
        clearTimeout(timer);
        resolve();
      });
      win.once('tauri://error', (e) => {
        clearTimeout(timer);
        reject(new Error(`Adoption window error: ${JSON.stringify(e)}`));
      });
    });

    await readyPromise;

    await emitTo(label, MW_EVENTS.ADOPT_TAB, { tabData, source: getWindowLabel() });
    return { label, delivered: true };
  } catch (err) {
    await removeFromManifest(label);
    throw err;
  } finally {
    clearTimeout(readyTimer);
    unlistenReady();
  }
}

// ─── Event helpers ─────────────────────────────────────────────────────

/**
 * Announce this window is mounted and ready to receive adoption events.
 * Target = source window that created us. We don't know the source label,
 * so we broadcast. `handOffTabToNewWindow` filters by our own label.
 */
export async function announceReady(): Promise<void> {
  try {
    await emit(MW_EVENTS.READY, { label: getWindowLabel() });
  } catch {
    /* best effort */
  }
}

/**
 * Register an adoption listener. Returns the unlisten function.
 * Caller should invoke once the first adoption completes (or on dispose).
 */
export async function onAdoptTab(
  handler: (tab: TabState) => void
): Promise<() => void> {
  const unlisten = await listen<{ tabData: TabState }>(MW_EVENTS.ADOPT_TAB, (evt) => {
    if (evt.payload?.tabData) handler(evt.payload.tabData);
  });
  return unlisten;
}

export const ADOPT_FALLBACK_TIMEOUT_MS = ADOPT_TIMEOUT_MS;
