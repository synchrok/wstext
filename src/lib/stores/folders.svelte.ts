import { readDir } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import type { FolderEntry } from '../types';
import { appSettings, updateSetting } from './settings.svelte';

/**
 * Reactive folder sidebar state — Svelte 5 runes.
 *
 * Manages root folders, expanded states, directory contents cache,
 * and extension filtering for the folder tree sidebar.
 */

/** Expanded folder paths (absolute). Key = normalized path, value = true. */
export const expandedPaths: Record<string, boolean> = $state({});

/** Cached directory contents: path → entries. */
const contentsCache = new Map<string, FolderEntry[]>();

/** Normalize path separators to forward slashes for consistent comparison. */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Join parent path with child name using OS-appropriate separator. */
function joinPath(parent: string, child: string): string {
  // Preserve the original separator style from the parent path
  const sep = parent.includes('\\') ? '\\' : '/';
  const trimmed = parent.endsWith(sep) ? parent.slice(0, -1) : parent;
  return `${trimmed}${sep}${child}`;
}

/** Check if a filename should be excluded based on extension filters. */
function isExcluded(name: string): boolean {
  const extensions = appSettings.excludedExtensions;
  if (extensions.length === 0) return false;
  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext.toLowerCase()));
}

/**
 * Read directory contents, filtering excluded extensions.
 * Returns sorted entries: directories first (alphabetical), then files (alphabetical).
 */
async function readDirSorted(dirPath: string): Promise<FolderEntry[]> {
  const raw = await readDir(dirPath);

  const entries: FolderEntry[] = raw
    .filter((e) => !isExcluded(e.name))
    .map((e) => ({
      name: e.name,
      path: joinPath(dirPath, e.name),
      isDirectory: e.isDirectory,
      children: null,
    }));

  // Sort: directories first, then files, both alphabetical (case-insensitive)
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return entries;
}

/**
 * Load (or reload) contents of a specific directory.
 * Updates the cache and returns the entries.
 */
export async function loadFolderContents(dirPath: string): Promise<FolderEntry[]> {
  try {
    const entries = await readDirSorted(dirPath);
    contentsCache.set(normalizePath(dirPath), entries);
    return entries;
  } catch (err) {
    console.warn(`[folders] Failed to read directory: ${dirPath}`, err);
    return [];
  }
}

/**
 * Get cached contents for a directory, or load them if not cached.
 */
export async function getFolderContents(dirPath: string): Promise<FolderEntry[]> {
  const key = normalizePath(dirPath);
  const cached = contentsCache.get(key);
  if (cached) return cached;
  return loadFolderContents(dirPath);
}

/**
 * Toggle a folder's expanded state.
 * If expanding, loads its contents.
 * Returns the new expanded state.
 */
export async function toggleFolder(dirPath: string): Promise<boolean> {
  const key = normalizePath(dirPath);
  if (expandedPaths[key]) {
    delete expandedPaths[key];
    return false;
  } else {
    expandedPaths[key] = true;
    // Ensure contents are loaded
    await getFolderContents(dirPath);
    return true;
  }
}

/** Check if a folder is currently expanded. */
export function isFolderExpanded(dirPath: string): boolean {
  return !!expandedPaths[normalizePath(dirPath)];
}

/**
 * Add a root folder via native folder picker dialog.
 * Returns the selected path, or null if cancelled.
 */
export async function addRootFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  if (selected === null || Array.isArray(selected)) return null;

  // Don't add duplicates
  const normalized = normalizePath(selected);
  const alreadyExists = appSettings.sidebarRoots.some(
    (r) => normalizePath(r) === normalized
  );
  if (alreadyExists) return selected;

  const newRoots = [...appSettings.sidebarRoots, selected];
  updateSetting('sidebarRoots', newRoots);

  // Auto-expand the new root
  expandedPaths[normalized] = true;
  await loadFolderContents(selected);

  // Show sidebar if hidden
  if (!appSettings.sidebarVisible) {
    updateSetting('sidebarVisible', true);
  }

  return selected;
}

/**
 * Add a root folder by path (drag-drop, session restore, etc.).
 * Auto-expands the folder and shows the sidebar.
 */
export async function addRootFolderByPath(folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  const alreadyExists = appSettings.sidebarRoots.some(
    (r) => normalizePath(r) === normalized
  );
  if (alreadyExists) return;

  const newRoots = [...appSettings.sidebarRoots, folderPath];
  updateSetting('sidebarRoots', newRoots);

  // Auto-expand and preload
  expandedPaths[normalized] = true;
  await loadFolderContents(folderPath);

  // Show sidebar if hidden
  if (!appSettings.sidebarVisible) {
    updateSetting('sidebarVisible', true);
  }
}

/**
 * Remove a root folder from the sidebar.
 */
export function removeRootFolder(folderPath: string): void {
  const normalized = normalizePath(folderPath);
  const newRoots = appSettings.sidebarRoots.filter(
    (r) => normalizePath(r) !== normalized
  );
  updateSetting('sidebarRoots', newRoots);

  // Clean up expanded state and cache for this root and all children
  for (const key of Object.keys(expandedPaths)) {
    if (key === normalized || key.startsWith(normalized + '/')) {
      delete expandedPaths[key];
    }
  }
  for (const key of contentsCache.keys()) {
    if (key === normalized || key.startsWith(normalized + '/')) {
      contentsCache.delete(key);
    }
  }
}

/**
 * Refresh a specific directory (re-read from disk, clearing cache).
 */
export async function refreshFolder(dirPath: string): Promise<FolderEntry[]> {
  const key = normalizePath(dirPath);
  contentsCache.delete(key);
  return loadFolderContents(dirPath);
}

/**
 * Refresh all expanded directories (e.g., after excluded extensions change).
 */
export async function refreshAllFolders(): Promise<void> {
  contentsCache.clear();
  // Re-load all expanded directories
  const paths = Object.keys(expandedPaths);
  await Promise.all(paths.map((p) => loadFolderContents(p)));
}

/**
 * Toggle sidebar visibility.
 */
export function toggleSidebar(): void {
  updateSetting('sidebarVisible', !appSettings.sidebarVisible);
}

/**
 * Reorder root folders by moving one from `fromIdx` to `toIdx`.
 */
export function reorderRoots(fromIdx: number, toIdx: number): void {
  const roots = [...appSettings.sidebarRoots];
  if (fromIdx < 0 || fromIdx >= roots.length) return;
  if (toIdx < 0 || toIdx >= roots.length) return;
  const [moved] = roots.splice(fromIdx, 1);
  roots.splice(toIdx, 0, moved);
  updateSetting('sidebarRoots', roots);
}

/**
 * Update excluded extensions and refresh tree.
 */
export function setExcludedExtensions(extensions: string[]): void {
  // Normalize: ensure each extension starts with a dot
  const normalized = extensions.map((ext) =>
    ext.startsWith('.') ? ext : `.${ext}`
  );
  updateSetting('excludedExtensions', normalized);
  void refreshAllFolders();
}
