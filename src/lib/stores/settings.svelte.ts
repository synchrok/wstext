import { LazyStore } from '@tauri-apps/plugin-store';
import type { AppSettings, ThemeName } from '../types';
import { DEFAULT_SETTINGS } from '../types';

// LazyStore loads on first access — better startup performance than load()
const store = new LazyStore('settings.json');

/**
 * Reactive application settings using Svelte 5 runes.
 * Changes are automatically persisted with a 300ms debounce.
 * 
 * NOTE: This file uses .svelte.ts extension — required for Svelte 5 runes in modules.
 */
export const appSettings = $state<AppSettings>({ ...DEFAULT_SETTINGS });

let saveDebounceTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Load settings from Tauri persistent store.
 * Call this once on app startup before rendering.
 */
export async function loadSettings(): Promise<void> {
  try {
    const saved = await store.get<AppSettings>('settings');
    if (saved) {
      // Merge saved settings with defaults to handle new fields in future versions
      Object.assign(appSettings, { ...DEFAULT_SETTINGS, ...saved });
    }
  } catch (err) {
    // Failed to load — use defaults (non-blocking)
    console.warn('[settings] Failed to load settings, using defaults:', err);
  }
}

/**
 * Persist current settings to store immediately.
 */
export async function saveSettings(): Promise<void> {
  try {
    await store.set('settings', { ...appSettings });
    await store.save();
  } catch (err) {
    console.warn('[settings] Failed to save settings:', err);
  }
}

/**
 * Update a single setting and schedule a debounced save.
 */
export function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): void {
  appSettings[key] = value;

  // Debounced persist — avoids excessive disk writes during rapid changes
  if (saveDebounceTimer !== undefined) {
    clearTimeout(saveDebounceTimer);
  }
  saveDebounceTimer = setTimeout(() => {
    saveSettings();
    saveDebounceTimer = undefined;
  }, 300);
}

/**
 * Convenience function to change the active theme.
 */
export function updateTheme(theme: ThemeName): void {
  updateSetting('theme', theme);
}

/**
 * Convenience function to change font size.
 */
export function updateFontSize(size: number): void {
  const clamped = Math.max(8, Math.min(40, size)) as AppSettings['fontSize'];
  updateSetting('fontSize', clamped);
}
