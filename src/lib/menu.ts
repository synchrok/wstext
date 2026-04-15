import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
} from '@tauri-apps/api/menu';
import type { ThemeName } from './types';

/**
 * Event names emitted by menu actions.
 * Listen with: window.addEventListener('wstext:menu', handler)
 */
export const MENU_EVENTS = {
  NEW_FILE: 'wstext:new-file',
  OPEN_FILE: 'wstext:open-file',
  OPEN_FOLDER: 'wstext:open-folder',
  SAVE_FILE: 'wstext:save-file',
  SAVE_FILE_AS: 'wstext:save-file-as',
  CLOSE_TAB: 'wstext:close-tab',
  TOGGLE_MINIMAP: 'wstext:toggle-minimap',
  TOGGLE_WORD_WRAP: 'wstext:toggle-word-wrap',
  TOGGLE_SIDEBAR: 'wstext:toggle-sidebar',
  ZOOM_IN: 'wstext:zoom-in',
  ZOOM_OUT: 'wstext:zoom-out',
  RESET_ZOOM: 'wstext:reset-zoom',
  TOGGLE_PREVIEW: 'wstext:toggle-preview',
  SET_THEME: 'wstext:set-theme',
  FORMAT_DOCUMENT: 'wstext:format-document',
  ABOUT: 'wstext:about',
} as const;

function emit(event: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(event, { detail }));
}

/**
 * Build and set the native application menu.
 * IMPORTANT: All items must be inside Submenus — macOS ignores top-level items.
 * Call this once during app initialization.
 */
export async function setupMenu(): Promise<void> {
  const menu = await Menu.new({
    items: [
      await Submenu.new({
        text: 'File',
        items: [
          await MenuItem.new({
            id: 'new-file',
            text: 'New File',
            accelerator: 'CmdOrCtrl+N',
            action: () => emit(MENU_EVENTS.NEW_FILE),
          }),
          await MenuItem.new({
            id: 'open-file',
            text: 'Open...',
            accelerator: 'CmdOrCtrl+O',
            action: () => emit(MENU_EVENTS.OPEN_FILE),
          }),
          await MenuItem.new({
            id: 'save-file',
            text: 'Save',
            accelerator: 'CmdOrCtrl+S',
            action: () => emit(MENU_EVENTS.SAVE_FILE),
          }),
          await MenuItem.new({
            id: 'save-file-as',
            text: 'Save As...',
            accelerator: 'CmdOrCtrl+Shift+S',
            action: () => emit(MENU_EVENTS.SAVE_FILE_AS),
          }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await MenuItem.new({
            id: 'close-tab',
            text: 'Close Tab',
            accelerator: 'CmdOrCtrl+W',
            action: () => emit(MENU_EVENTS.CLOSE_TAB),
          }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await PredefinedMenuItem.new({ item: 'Quit' }),
        ],
      }),
      await Submenu.new({
        text: 'Edit',
        items: [
          await PredefinedMenuItem.new({ item: 'Undo' }),
          await PredefinedMenuItem.new({ item: 'Redo' }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await PredefinedMenuItem.new({ item: 'Cut' }),
          await PredefinedMenuItem.new({ item: 'Copy' }),
          await PredefinedMenuItem.new({ item: 'Paste' }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await PredefinedMenuItem.new({ item: 'SelectAll' }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await MenuItem.new({
            id: 'format-document',
            text: 'Format Document',
            accelerator: 'Shift+Alt+F',
            action: () => emit(MENU_EVENTS.FORMAT_DOCUMENT),
          }),
        ],
      }),
      await Submenu.new({
        text: 'View',
        items: [
          await MenuItem.new({
            id: 'toggle-minimap',
            text: 'Toggle Minimap',
            action: () => emit(MENU_EVENTS.TOGGLE_MINIMAP),
          }),
          await MenuItem.new({
            id: 'toggle-word-wrap',
            text: 'Toggle Word Wrap',
            accelerator: 'Alt+Z',
            action: () => emit(MENU_EVENTS.TOGGLE_WORD_WRAP),
          }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await MenuItem.new({
            id: 'zoom-in',
            text: 'Zoom In',
            accelerator: 'CmdOrCtrl+Equal',
            action: () => emit(MENU_EVENTS.ZOOM_IN),
          }),
          await MenuItem.new({
            id: 'zoom-out',
            text: 'Zoom Out',
            accelerator: 'CmdOrCtrl+Minus',
            action: () => emit(MENU_EVENTS.ZOOM_OUT),
          }),
          await MenuItem.new({
            id: 'reset-zoom',
            text: 'Reset Zoom',
            accelerator: 'CmdOrCtrl+0',
            action: () => emit(MENU_EVENTS.RESET_ZOOM),
          }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await MenuItem.new({
            id: 'toggle-preview',
            text: 'Toggle Markdown Preview',
            accelerator: 'CmdOrCtrl+Shift+M',
            action: () => emit(MENU_EVENTS.TOGGLE_PREVIEW),
          }),
        ],
      }),
      await Submenu.new({
        text: 'Theme',
        items: [
          await MenuItem.new({
            id: 'theme-monokai',
            text: 'Monokai',
            action: () => emit(MENU_EVENTS.SET_THEME, 'monokai' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-dracula',
            text: 'Dracula',
            action: () => emit(MENU_EVENTS.SET_THEME, 'dracula' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-one-dark',
            text: 'One Dark',
            action: () => emit(MENU_EVENTS.SET_THEME, 'one-dark' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-mariana',
            text: 'Mariana',
            action: () => emit(MENU_EVENTS.SET_THEME, 'mariana' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-sixteen',
            text: 'Sixteen',
            action: () => emit(MENU_EVENTS.SET_THEME, 'sixteen' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-breakers',
            text: 'Breakers',
            action: () => emit(MENU_EVENTS.SET_THEME, 'breakers' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-solarized-dark',
            text: 'Solarized Dark',
            action: () => emit(MENU_EVENTS.SET_THEME, 'solarized-dark' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-solarized-light',
            text: 'Solarized Light',
            action: () => emit(MENU_EVENTS.SET_THEME, 'solarized-light' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-celeste',
            text: 'Celeste',
            action: () => emit(MENU_EVENTS.SET_THEME, 'celeste' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-notepad',
            text: 'Notepad',
            action: () => emit(MENU_EVENTS.SET_THEME, 'notepad' as ThemeName),
          }),
          await MenuItem.new({
            id: 'theme-notepad-warm',
            text: 'Notepad Warm',
            action: () => emit(MENU_EVENTS.SET_THEME, 'notepad-warm' as ThemeName),
          }),
        ],
      }),
      await Submenu.new({
        text: 'Help',
        items: [
          await MenuItem.new({
            id: 'about',
            text: 'About WSText',
            action: () => emit(MENU_EVENTS.ABOUT),
          }),
        ],
      }),
    ],
  });

  await menu.setAsAppMenu();
}
