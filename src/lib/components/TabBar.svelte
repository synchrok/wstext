<script lang="ts">
  import type { TabState } from '../types';
  import { MENU_EVENTS } from '../menu';

  interface Props {
    tabs?: TabState[];
    activeTabId?: string | null;
    sidebarVisible?: boolean;
    bgColor?: string;
    tabActiveBg?: string;
    tabInactiveBg?: string;
    tabActiveFg?: string;
    tabInactiveFg?: string;
    accentColor?: string;
    borderColor?: string;
    onTabClick?: (tabId: string) => void;
    onTabClose?: (tabId: string) => void;
    onTabMiddleClick?: (tabId: string) => void;
    onTabReorder?: (fromIndex: number, toIndex: number) => void;
    onTabDragOut?: (tabId: string, screenX: number, screenY: number) => void;
  }

  let {
    tabs = [],
    activeTabId = null,
    sidebarVisible = false,
    bgColor = '#1e1f1c',
    tabActiveBg = '#272822',
    tabInactiveBg = '#1e1f1c',
    tabActiveFg = '#F8F8F2',
    tabInactiveFg = '#75715E',
    accentColor = '#A6E22E',
    borderColor = '#3e3d32',
    onTabClick = undefined,
    onTabClose = undefined,
    onTabMiddleClick = undefined,
    onTabReorder = undefined,
    onTabDragOut = undefined,
  }: Props = $props();

  /** Pixels outside the tab-bar vertical bounds that triggers a drag-out. */
  const DRAG_OUT_THRESHOLD_Y = 50;

  function emit(event: string) {
    window.dispatchEvent(new CustomEvent(event));
  }

  let dragIdx = $state(-1);
  let dragOverIdx = $state(-1);
  let isDragging = false;
  let isDraggedOut = $state(false);
  let dragStartX = 0;

  function handleTabMouseDown(e: MouseEvent, idx: number): void {
    if (e.button === 1) { // middle click
      e.preventDefault();
      onTabMiddleClick?.(tabs[idx]?.id ?? '');
      return;
    }
    if (e.button !== 0) return;

    dragStartX = e.clientX;
    const startIdx = idx;

    const onMove = (ev: MouseEvent) => {
      // Start drag after 5px threshold
      if (!isDragging && Math.abs(ev.clientX - dragStartX) > 5) {
        isDragging = true;
        dragIdx = startIdx;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      if (!isDragging) return;

      // Detect drag-out: mouse moved vertically past the tab bar edges.
      const bar = document.querySelector('.tab-bar');
      if (bar) {
        const barRect = bar.getBoundingClientRect();
        const outside =
          ev.clientY < barRect.top - DRAG_OUT_THRESHOLD_Y ||
          ev.clientY > barRect.bottom + DRAG_OUT_THRESHOLD_Y;
        if (outside !== isDraggedOut) {
          isDraggedOut = outside;
          document.body.style.cursor = outside ? 'alias' : 'grabbing';
        }
      }

      // Only update inner-reorder target when NOT dragged out.
      if (!isDraggedOut) {
        const tabsArea = (ev.target as HTMLElement)?.closest?.('.tabs-area') ??
          document.querySelector('.tabs-area');
        if (!tabsArea) return;

        const tabEls = tabsArea.querySelectorAll('.tab');
        for (let i = 0; i < tabEls.length; i++) {
          const rect = tabEls[i].getBoundingClientRect();
          if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
            dragOverIdx = i;
            break;
          }
        }
      } else {
        dragOverIdx = -1;
      }
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (isDragging && isDraggedOut && dragIdx >= 0) {
        const tabId = tabs[dragIdx]?.id;
        if (tabId && onTabDragOut) {
          onTabDragOut(tabId, ev.screenX, ev.screenY);
        }
      } else if (isDragging && dragIdx >= 0 && dragOverIdx >= 0 && dragIdx !== dragOverIdx) {
        onTabReorder?.(dragIdx, dragOverIdx);
      }
      isDragging = false;
      isDraggedOut = false;
      dragIdx = -1;
      dragOverIdx = -1;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleMiddleClick(e: MouseEvent, tabId: string): void {
    if (e.button === 1) {
      e.preventDefault();
      onTabMiddleClick?.(tabId);
    }
  }

  /** Whether the "open tabs" dropdown is showing. */
  let showTabMenu = $state(false);

  function toggleTabMenu(): void {
    showTabMenu = !showTabMenu;
  }

  function selectFromMenu(tabId: string): void {
    showTabMenu = false;
    onTabClick?.(tabId);
    // After the active tab updates, scroll it into view within the strip so
    // the user can see the tab they just jumped to.
    setTimeout(() => {
      const el = document.querySelector('.tabs-area .tab.active');
      el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }, 0);
  }
</script>

<div class="tab-bar" style:background-color={bgColor} style:border-bottom="1px solid {borderColor}">
  <!-- Sidebar toggle -->
  <button
    class="sidebar-toggle"
    class:active={sidebarVisible}
    onclick={() => emit(MENU_EVENTS.TOGGLE_SIDEBAR)}
    title="Toggle Sidebar (Ctrl+B)"
    style:color={sidebarVisible ? accentColor : tabInactiveFg}
    style:border-right="1px solid {borderColor}"
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="12" rx="1" stroke="currentColor" stroke-width="1.3"/>
      <line x1="5.5" y1="2" x2="5.5" y2="14" stroke="currentColor" stroke-width="1.3"/>
    </svg>
  </button>
  <!-- Tab list — NO drag region, tabs must be clickable -->
  <div class="tabs-area">
    {#each tabs as tab, idx (tab.id)}
      <div
        class="tab"
        class:active={tab.id === activeTabId}
        class:drag-over={dragOverIdx === idx && dragIdx !== idx}
        style:background-color={tab.id === activeTabId ? tabActiveBg : tabInactiveBg}
        style:color={tab.id === activeTabId ? tabActiveFg : tabInactiveFg}
        style:border-right="1px solid {borderColor}"
        style:opacity={dragIdx === idx ? '0.4' : '1'}
        role="tab"
        tabindex="0"
        aria-selected={tab.id === activeTabId}
        onclick={() => { if (!isDragging) onTabClick?.(tab.id); }}
        onkeydown={(e) => e.key === 'Enter' && onTabClick?.(tab.id)}
        onmousedown={(e) => handleTabMouseDown(e, idx)}
      >
        <span class="tab-title" title={tab.filePath ?? tab.title}>
          {tab.title}
        </span>
        {#if tab.isDirty}
          <span class="tab-dirty" title="Unsaved changes">●</span>
        {/if}
        <button
          class="tab-close"
          type="button"
          title="Close tab"
          onclick={(e) => {
            e.stopPropagation();
            onTabClose?.(tab.id);
          }}
          aria-label="Close {tab.title}"
        >
          ×
        </button>
      </div>
    {/each}
  </div>

  <!-- Open-tabs dropdown: lists every tab so they're reachable even when the
       strip overflows horizontally. -->
  {#if tabs.length > 0}
    <button
      class="tab-menu-button"
      class:active={showTabMenu}
      onclick={toggleTabMenu}
      title="Open tabs ({tabs.length})"
      aria-label="Show all open tabs"
      style:color={showTabMenu ? accentColor : tabInactiveFg}
      style:border-left="1px solid {borderColor}"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  {/if}
</div>

{#if showTabMenu}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tab-menu-overlay" onclick={() => (showTabMenu = false)}></div>
  <div
    class="tab-menu"
    style:background-color={bgColor}
    style:border="1px solid {borderColor}"
  >
    {#each tabs as tab (tab.id)}
      <button
        class="tab-menu-item"
        class:active={tab.id === activeTabId}
        type="button"
        onclick={() => selectFromMenu(tab.id)}
        style:color={tab.id === activeTabId ? tabActiveFg : tabInactiveFg}
        title={tab.filePath ?? tab.title}
      >
        {#if tab.id === activeTabId}
          <span class="tab-menu-marker" style:color={accentColor}>▸</span>
        {:else}
          <span class="tab-menu-marker"></span>
        {/if}
        <span class="tab-menu-title">{tab.title}</span>
        {#if tab.isDirty}
          <span class="tab-menu-dirty" title="Unsaved changes">●</span>
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .tab-bar {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    flex-shrink: 0;
    height: 34px;
    position: relative;
  }

  .sidebar-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.1s, background-color 0.1s;
  }

  .sidebar-toggle:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.06);
  }

  .sidebar-toggle.active {
    opacity: 0.9;
  }

  .tabs-area {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 1;
    min-width: 0;
    scrollbar-width: none;
    flex: 1;
  }

  .tabs-area::-webkit-scrollbar {
    display: none;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px 0 12px;
    min-width: 80px;
    max-width: 200px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    border-top: 2px solid transparent;
    flex-shrink: 0;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: background-color 0.1s ease;
  }

  .tab.active {
    border-top-color: #A6E22E;
  }

  .tab.drag-over {
    border-left: 2px solid #A6E22E;
  }

  .tab:hover:not(.active) {
    filter: brightness(1.2);
  }

  .tab-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
  }

  .tab-dirty {
    font-size: 10px;
    opacity: 0.8;
    color: #E6DB74;
    margin-left: 2px;
  }

  .tab-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 2px;
    opacity: 0;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .tab:hover .tab-close,
  .tab.active .tab-close {
    opacity: 0.6;
  }

  .tab-close:hover {
    opacity: 1 !important;
    background-color: rgba(255, 255, 255, 0.15);
  }

  .tab-menu-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.1s, background-color 0.1s;
  }

  .tab-menu-button:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.06);
  }

  .tab-menu-button.active {
    opacity: 1;
  }

  .tab-menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .tab-menu {
    position: absolute;
    top: 34px;
    right: 0;
    z-index: 100;
    min-width: 180px;
    max-width: 320px;
    max-height: 60vh;
    overflow-y: auto;
    border-radius: 0 0 4px 4px;
    padding: 4px 0;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  .tab-menu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    text-align: left;
    padding: 5px 12px 5px 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    white-space: nowrap;
  }

  .tab-menu-item:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }

  .tab-menu-item.active {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .tab-menu-marker {
    flex-shrink: 0;
    width: 10px;
    font-size: 11px;
    text-align: center;
  }

  .tab-menu-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-menu-dirty {
    flex-shrink: 0;
    font-size: 10px;
    color: #E6DB74;
    margin-left: 4px;
  }
</style>
