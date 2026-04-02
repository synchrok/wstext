import { MENU_EVENTS } from './menu';

function emit(event: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(event, { detail }));
}

/**
 * Set up keyboard shortcuts that are not handled by the native menu.
 * Call this once during app initialization.
 */
export function setupKeyboardShortcuts(): void {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+N — new file
    if (ctrl && e.key === 'n' && !e.shiftKey) {
      e.preventDefault();
      emit(MENU_EVENTS.NEW_FILE);
      return;
    }

    // Ctrl+O — open file
    if (ctrl && e.key === 'o' && !e.shiftKey) {
      e.preventDefault();
      emit(MENU_EVENTS.OPEN_FILE);
      return;
    }

    // Ctrl+S — save file
    if (ctrl && e.key === 's' && !e.shiftKey) {
      e.preventDefault();
      emit(MENU_EVENTS.SAVE_FILE);
      return;
    }

    // Ctrl+Shift+S — save as
    if (ctrl && e.key === 'S' && e.shiftKey) {
      e.preventDefault();
      emit(MENU_EVENTS.SAVE_FILE_AS);
      return;
    }

    // Ctrl+W — close tab
    if (ctrl && e.key === 'w' && !e.shiftKey) {
      e.preventDefault();
      emit(MENU_EVENTS.CLOSE_TAB);
      return;
    }

    // Ctrl+Shift+W — close all tabs
    if (ctrl && e.key === 'W' && e.shiftKey) {
      e.preventDefault();
      emit('wstext:close-all-tabs');
      return;
    }

    // Ctrl+Shift+M — toggle markdown preview
    if (ctrl && e.key === 'M' && e.shiftKey) {
      e.preventDefault();
      emit(MENU_EVENTS.TOGGLE_PREVIEW);
      return;
    }

    // Ctrl+Tab — next tab
    if (ctrl && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      emit('wstext:next-tab');
      return;
    }

    // Ctrl+Shift+Tab — previous tab
    if (ctrl && e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      emit('wstext:prev-tab');
      return;
    }
  });
}

// Re-export for convenience
export { MENU_EVENTS };
