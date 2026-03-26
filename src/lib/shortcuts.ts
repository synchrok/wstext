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
