<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { MENU_EVENTS } from '../menu';
  import { recentFiles } from '../stores/settings.svelte';

  interface Props {
    activeFileName?: string;
    activeFilePath?: string;
    bgColor?: string;
    fgColor?: string;
    fgMuted?: string;
    borderColor?: string;
    accentColor?: string;
  }

  let {
    activeFileName = '',
    activeFilePath = '',
    bgColor = '#1e1f1c',
    fgColor = '#F8F8F2',
    fgMuted = '#75715E',
    borderColor = '#3e3d32',
    accentColor = '#A6E22E'
  }: Props = $props();

  let activeMenu = $state<string | null>(null);
  let windowFocused = $state(true);

  onMount(() => {
    const onFocus = () => { windowFocused = true; };
    const onBlur = () => { windowFocused = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  });

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
    await closeWindow();
  }

  async function minimizeWindow() {
    await getCurrentWindow().minimize();
  }

  async function toggleMaximize() {
    await getCurrentWindow().toggleMaximize();
  }

  async function closeWindow() {
    try {
      // Save session first
      const { saveSessionMetadata } = await import('../session.svelte');
      await Promise.race([
        saveSessionMetadata(),
        new Promise(r => setTimeout(r, 1500)), // 1.5s timeout
      ]);
    } catch { /* proceed to exit */ }
    // Kill process directly — most reliable way to close in Tauri
    const { exit } = await import('@tauri-apps/plugin-process');
    await exit(0);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if activeMenu !== null}
  <div class="menu-overlay" onclick={closeMenu}></div>
{/if}

<!-- Title bar with window controls -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="title-bar" style:background-color={bgColor} data-tauri-drag-region ondblclick={toggleMaximize}>
  <span class="title-text" style:opacity={windowFocused ? 0.9 : 0.55} data-tauri-drag-region>
    <img class="title-icon" src="/wstext-icon.png" alt="" width="14" height="14" style:opacity={windowFocused ? 1 : 0.5} />
    <span style:color={windowFocused ? fgColor : fgMuted}>WSText</span>{#if activeFileName}<span style:color={fgMuted} style:opacity="0.5"> — </span><span style:color={windowFocused ? fgColor : fgMuted} style:opacity="0.7">{activeFileName}</span>{#if activeFilePath}<span style:color={fgMuted} style:opacity="0.35" class="title-path"> {activeFilePath.replace(/[\/][^\/]*$/, '')}</span>{/if}{/if}
  </span>
  <div class="title-window-controls">
    <button class="win-btn" onclick={minimizeWindow} aria-label="Minimize" title="Minimize" style:color={fgMuted}>
      <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1"/></svg>
    </button>
    <button class="win-btn" onclick={toggleMaximize} aria-label="Maximize" title="Maximize" style:color={fgMuted}>
      <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg>
    </button>
    <button class="win-btn win-close" onclick={closeWindow} aria-label="Close" title="Close" style:color={fgMuted}>
      <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1"/></svg>
    </button>
  </div>
</div>

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
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.OPEN_FOLDER)}>
            <span>Open Folder...</span>
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
          {#if recentFiles.length > 0}
            <div class="separator" style:background-color={borderColor}></div>
            <div class="menu-label">Recent Files</div>
            {#each recentFiles.slice(0, 5) as filePath}
              <button class="menu-item recent-item" onclick={() => { emit('wstext:open-path', filePath); }}>
                <span class="recent-name">{filePath.split(/[/\\]/).pop()}</span>
                <span class="recent-path" style:color={fgMuted}>{filePath.split(/[/\\]/).slice(0, -1).join('\\')}</span>
              </button>
            {/each}
          {/if}
          <div class="separator" style:background-color={borderColor}></div>
          <button class="menu-item" onclick={() => emit('wstext:open-settings')}>
            <span>Settings...</span>
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
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.TOGGLE_SIDEBAR)}>
            <span>Toggle Sidebar</span><span class="shortcut" style:color={fgMuted}>Ctrl+B</span>
          </button>
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
          <button class="menu-item" onclick={() => emit('wstext:toggle-checkbox')}>
            <span>Toggle Checkboxes</span>
          </button>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.TOGGLE_PREVIEW)}>
            <span>Toggle Preview</span><span class="shortcut" style:color={fgMuted}>Ctrl+Shift+M</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Help Menu -->
    <div class="menu-container">
      <button 
        class="menu-button" 
        class:active={activeMenu === 'help'}
        onclick={() => toggleMenu('help')}
        onmouseenter={() => handleMenuHover('help')}
      >
        Help
      </button>
      {#if activeMenu === 'help'}
        <div class="dropdown" style:background-color={bgColor} style:border-color={borderColor}>
          <button class="menu-item" onclick={() => emit(MENU_EVENTS.ABOUT)}>
            <span>About WSText</span>
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="drag-region" data-tauri-drag-region ondblclick={toggleMaximize}></div>
</div>

<style>
  .title-bar {
    display: flex;
    align-items: center;
    height: 28px;
    flex-shrink: 0;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    user-select: none;
    padding-left: 10px;
  }

  .title-text {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1;
    transition: opacity 0.15s ease;
  }

  .title-window-controls {
    display: flex;
    align-items: stretch;
    flex-shrink: 0;
    height: 100%;
  }

  .title-icon {
    flex-shrink: 0;
  }

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

  .recent-item {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 1px;
    padding: 4px 24px !important;
  }

  .recent-name {
    font-size: 13px;
  }

  .recent-path {
    font-size: 10px;
    opacity: 0.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 280px;
  }

  .separator {
    height: 1px;
    margin: 4px 0;
    width: 100%;
  }

  .menu-label {
    font-size: 11px;
    padding: 4px 16px;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .drag-region {
    flex: 1;
    min-width: 8px;
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
