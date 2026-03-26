<script lang="ts">
  import type { TabState } from '../types';

  interface Props {
    tabs?: TabState[];
    activeTabId?: string | null;
    bgColor?: string;
    tabActiveBg?: string;
    tabInactiveBg?: string;
    tabActiveFg?: string;
    tabInactiveFg?: string;
    borderColor?: string;
    onTabClick?: (tabId: string) => void;
    onTabClose?: (tabId: string) => void;
    onTabMiddleClick?: (tabId: string) => void;
  }

  let {
    tabs = [],
    activeTabId = null,
    bgColor = '#1e1f1c',
    tabActiveBg = '#272822',
    tabInactiveBg = '#1e1f1c',
    tabActiveFg = '#F8F8F2',
    tabInactiveFg = '#75715E',
    borderColor = '#3e3d32',
    onTabClick = undefined,
    onTabClose = undefined,
    onTabMiddleClick = undefined
  }: Props = $props();

  function handleMiddleClick(e: MouseEvent, tabId: string): void {
    if (e.button === 1) {
      e.preventDefault();
      onTabMiddleClick?.(tabId);
    }
  }
</script>

<div class="tab-bar" style:background-color={bgColor} style:border-bottom="1px solid {borderColor}">
  {#each tabs as tab (tab.id)}
    <div
      class="tab"
      class:active={tab.id === activeTabId}
      style:background-color={tab.id === activeTabId ? tabActiveBg : tabInactiveBg}
      style:color={tab.id === activeTabId ? tabActiveFg : tabInactiveFg}
      style:border-right="1px solid {borderColor}"
      role="tab"
      tabindex="0"
      aria-selected={tab.id === activeTabId}
      onclick={() => onTabClick?.(tab.id)}
      onkeydown={(e) => e.key === 'Enter' && onTabClick?.(tab.id)}
      onmousedown={(e) => handleMiddleClick(e, tab.id)}
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

<style>
  .tab-bar {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    height: 34px;
    scrollbar-width: none; /* Firefox */
  }

  .tab-bar::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
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
</style>
