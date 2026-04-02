<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { MENU_EVENTS } from '../menu';
  import { MONOSPACE_FONTS } from '../zoom';

  interface Props {
    bgColor?: string;
    fgColor?: string;
    fgMuted?: string;
    borderColor?: string;
    accentColor?: string;
  }

  let {
    bgColor = '#1e1f1c',
    fgColor = '#F8F8F2',
    fgMuted = '#75715E',
    borderColor = '#3e3d32',
    accentColor = '#A6E22E'
  }: Props = $props();

  let activeMenu = $state<string | null>(null);

  function toggleMenu(menu: string) {
    if (activeMenu === menu) {
      activeMenu = null;
    } else {
      activeMenu = menu;
    }
  }

  function closeMenu() {
    activeMenu = null;
  }

  function handleMenuHover(menu: string) {
    if (activeMenu !== null && activeMenu !== menu) {
      activeMenu = menu;
    }
  }

  function emit(event: string, detail?: unknown) {
    window.dispatchEvent(new CustomEvent(event, { detail }));
    closeMenu();
  }

  async function quit() {
    closeMenu();
    await getCurrentWindow().close();
  }

  async function minimizeWindow() {
    await getCurrentWindow().minimize();
  }

  async function toggleMaximize() {
    await getCurrentWindow().toggleMaximize();
  }

  async function closeWindow() {
    const win = getCurrentWindow();
    // Force destroy after 2s if clean close hangs
    const fallback = setTimeout(() => win.destroy(), 2000);
    try {
      await win.close();
    } catch {
      clearTimeout(fallback);
      await win.destroy();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if activeMenu !== null}
  <div class="menu-overlay" onclick={closeMenu}></div>
{/if}

<div class="menu-bar" style:background-color={bgColor} style:color={fgColor}>
  <div class="menus">
    <!-- File Menu -->
    <div class="menu-container">
      <button 
        class="menu-button" 
        class:active={activeMenu === 'file'}
        onclick={() => toggleMenu('file')}
        onmouseenter={() => handleMenuHover('file')}
      >
        File
      </button>
      {#if activeMenu === 'file'}
        <div class="dropdown" style:background-color={bgColor} style:border-color={borderColor}>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.NEW_FILE)}>
            <span>New File</span><span class="shortcut" style:color={fgMuted}>Ctrl+N</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.OPEN_FILE)}>
            <span>Open...</span><span class="shortcut" style:color={fgMuted}>Ctrl+O</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.SAVE_FILE)}>
            <span>Save</span><span class="shortcut" style:color={fgMuted}>Ctrl+S</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.SAVE_FILE_AS)}>
            <span>Save As...</span><span class="shortcut" style:color={fgMuted}>Ctrl+Shift+S</span>
          </button>
          <div class="separator" style:background-color={borderColor}></div>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.CLOSE_TAB)}>
            <span>Close Tab</span><span class="shortcut" style:color={fgMuted}>Ctrl+W</span>
          </button>
          <button class="menu-item" onclick={() => emit('wstext:close-all-tabs')}>
            <span>Close All Tabs</span><span class="shortcut" style:color={fgMuted}>Ctrl+Shift+W</span>
          </button>
          <div class="separator" style:background-color={borderColor}></div>
          <button class="menu-item" onclick={quit}>
            <span>Quit</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Edit Menu -->
    <div class="menu-container">
      <button 
        class="menu-button" 
        class:active={activeMenu === 'edit'}
        onclick={() => toggleMenu('edit')}
        onmouseenter={() => handleMenuHover('edit')}
      >
        Edit
      </button>
      {#if activeMenu === 'edit'}
        <div class="dropdown" style:background-color={bgColor} style:border-color={borderColor}>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.FORMAT_DOCUMENT)}>
            <span>Format Document</span><span class="shortcut" style:color={fgMuted}>Shift+Alt+F</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- View Menu -->
    <div class="menu-container">
      <button 
        class="menu-button" 
        class:active={activeMenu === 'view'}
        onclick={() => toggleMenu('view')}
        onmouseenter={() => handleMenuHover('view')}
      >
        View
      </button>
      {#if activeMenu === 'view'}
        <div class="dropdown" style:background-color={bgColor} style:border-color={borderColor}>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.TOGGLE_MINIMAP)}>
            <span>Toggle Minimap</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.TOGGLE_WORD_WRAP)}>
            <span>Toggle Word Wrap</span><span class="shortcut" style:color={fgMuted}>Alt+Z</span>
          </button>
          <div class="separator" style:background-color={borderColor}></div>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.ZOOM_IN)}>
            <span>Zoom In</span><span class="shortcut" style:color={fgMuted}>Ctrl+=</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.ZOOM_OUT)}>
            <span>Zoom Out</span><span class="shortcut" style:color={fgMuted}>Ctrl+-</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.RESET_ZOOM)}>
            <span>Reset Zoom</span><span class="shortcut" style:color={fgMuted}>Ctrl+0</span>
          </button>
          <div class="separator" style:background-color={borderColor}></div>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.TOGGLE_PREVIEW)}>
            <span>Toggle Preview</span><span class="shortcut" style:color={fgMuted}>Ctrl+Shift+M</span>
          </button>
          <div class="menu-separator"></div>
          <div class="menu-label">Font</div>
          {#each MONOSPACE_FONTS as font}
            <button class="menu-item" onclick={() => emit('wstext:set-font', font)}>
              <span style="font-family: {font}">{font.replace(/'/g, '')}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Theme Menu -->
    <div class="menu-container">
      <button 
        class="menu-button" 
        class:active={activeMenu === 'theme'}
        onclick={() => toggleMenu('theme')}
        onmouseenter={() => handleMenuHover('theme')}
      >
        Theme
      </button>
      {#if activeMenu === 'theme'}
        <div class="dropdown" style:background-color={bgColor} style:border-color={borderColor}>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.SET_THEME, 'monokai')}>
            <span>Monokai</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.SET_THEME, 'dracula')}>
            <span>Dracula</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.SET_THEME, 'one-dark')}>
            <span>One Dark</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.SET_THEME, 'solarized-dark')}>
            <span>Solarized Dark</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.SET_THEME, 'solarized-light')}>
            <span>Solarized Light</span>
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="drag-region" data-tauri-drag-region ondblclick={toggleMaximize}></div>

  <div class="window-controls">
    <button class="win-btn" onclick={minimizeWindow} aria-label="Minimize" title="Minimize">
      <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1"/></svg>
    </button>
    <button class="win-btn" onclick={toggleMaximize} aria-label="Maximize" title="Maximize">
      <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg>
    </button>
    <button class="win-btn win-close" onclick={closeWindow} aria-label="Close" title="Close">
      <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1"/></svg>
    </button>
  </div>
</div>

<style>
  .menu-bar {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    height: 28px;
    flex-shrink: 0;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    user-select: none;
  }

  .menus {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    padding: 0 4px;
  }

  .menu-container {
    position: relative;
    display: flex;
  }

  .menu-button {
    background: none;
    border: none;
    color: inherit;
    padding: 0 8px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    display: flex;
    align-items: center;
    border-radius: 4px;
    margin: 2px 0;
  }

  .menu-button:hover, .menu-button.active {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 220px;
    border: 1px solid;
    border-radius: 4px;
    padding: 4px 0;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
  }

  .menu-item {
    background: none;
    border: none;
    color: inherit;
    padding: 6px 16px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
    width: 100%;
  }

  .menu-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .shortcut {
    font-size: 12px;
    margin-left: 16px;
  }

  .separator {
    height: 1px;
    margin: 4px 0;
    width: 100%;
  }

  .menu-separator {
    height: 1px;
    margin: 4px 0;
    width: 100%;
    background-color: rgba(255, 255, 255, 0.2);
  }

  .menu-label {
    padding: 4px 24px;
    font-size: 11px;
    opacity: 0.5;
    cursor: default;
  }

  .drag-region {
    flex: 1;
    min-width: 8px;
  }

  .window-controls {
    display: flex;
    align-items: stretch;
    flex-shrink: 0;
  }

  .win-btn {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    width: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: background-color 0.1s ease, opacity 0.1s ease;
  }

  .win-btn:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .win-close:hover {
    background-color: #e81123;
    opacity: 1;
  }
</style>
