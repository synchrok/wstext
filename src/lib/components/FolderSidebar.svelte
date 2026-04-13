<script lang="ts">
  import { onMount } from 'svelte';
  import type { FolderEntry } from '../types';
  import { appSettings } from '../stores/settings.svelte';
  import {
    toggleFolder,
    getFolderContents,
    addRootFolder,
    removeRootFolder,
    refreshFolder,
    isFolderExpanded,
    reorderRoots,
    toggleSidebar,
  } from '../stores/folders.svelte';
  import TreeNode from './TreeNode.svelte';

  interface Props {
    activeFilePath?: string | null;
    bgColor?: string;
    fgColor?: string;
    fgMuted?: string;
    borderColor?: string;
    accentColor?: string;
    onFileClick?: (filePath: string) => void;
  }

  let {
    activeFilePath = null,
    bgColor = '#21252B',
    fgColor = '#ABB2BF',
    fgMuted = '#5C6370',
    borderColor = '#3E4451',
    accentColor = '#61AFEF',
    onFileClick = undefined,
  }: Props = $props();

  /**
   * Reactive map of loaded root directory contents.
   * Key: forward-slash-normalized folder path, Value: FolderEntry[]
   */
  let loadedContents = $state<Record<string, FolderEntry[]>>({});

  /** Track loading states per root. */
  let loadingPaths = $state(new Set<string>());

  /** Drag-reorder state for root folders. */
  let dragIdx = $state(-1);
  let dragOverIdx = $state(-1);
  let isDragging = false;
  let dragStartY = 0;

  function handleRootMouseDown(e: MouseEvent, idx: number): void {
    if (e.button !== 0) return;
    dragStartY = e.clientY;
    const startIdx = idx;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging && Math.abs(ev.clientY - dragStartY) > 5) {
        isDragging = true;
        dragIdx = startIdx;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      if (!isDragging) return;

      const container = document.querySelector('.sidebar-content');
      if (!container) return;
      const rootEls = container.querySelectorAll('.root-folder');
      for (let i = 0; i < rootEls.length; i++) {
        const rect = rootEls[i].getBoundingClientRect();
        if (ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
          dragOverIdx = i;
          break;
        }
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (isDragging && dragIdx >= 0 && dragOverIdx >= 0 && dragIdx !== dragOverIdx) {
        reorderRoots(dragIdx, dragOverIdx);
      }
      isDragging = false;
      dragIdx = -1;
      dragOverIdx = -1;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /** Display name from full path. */
  function displayName(fullPath: string): string {
    return fullPath.split(/[/\\]/).pop() ?? fullPath;
  }

  /** Parent folder name for disambiguation (e.g. "C:\Users\foo\Data" → "foo"). */
  function parentName(fullPath: string): string {
    const parts = fullPath.split(/[/\\]/).filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 2] : '';
  }

  /** Compute which display names appear more than once among root folders. */
  function getDuplicateNames(roots: string[]): Set<string> {
    const counts: Record<string, number> = {};
    for (const r of roots) {
      const n = displayName(r);
      counts[n] = (counts[n] || 0) + 1;
    }
    const dupes = new Set<string>();
    for (const [name, count] of Object.entries(counts)) {
      if (count > 1) dupes.add(name);
    }
    return dupes;
  }

  /** Load contents for all root folders. */
  async function loadRootContents(): Promise<void> {
    for (const root of appSettings.sidebarRoots) {
      const key = root.replace(/\\/g, '/');
      if (!loadedContents[key]) {
        await loadAndCache(root);
      }
    }
  }

  /** Load a single directory and update reactive state. */
  async function loadAndCache(dirPath: string): Promise<void> {
    const key = dirPath.replace(/\\/g, '/');
    loadingPaths.add(key);
    loadingPaths = new Set(loadingPaths);
    try {
      const entries = await getFolderContents(dirPath);
      loadedContents[key] = entries;
      loadedContents = { ...loadedContents };
    } finally {
      loadingPaths.delete(key);
      loadingPaths = new Set(loadingPaths);
    }
  }

  /** Toggle root folder expand/collapse. */
  async function handleToggleRoot(dirPath: string): Promise<void> {
    const expanded = await toggleFolder(dirPath);
    if (expanded) {
      await loadAndCache(dirPath);
    }
  }

  /** Refresh a root folder. */
  async function handleRefresh(dirPath: string): Promise<void> {
    const key = dirPath.replace(/\\/g, '/');
    loadingPaths.add(key);
    loadingPaths = new Set(loadingPaths);
    try {
      const entries = await refreshFolder(dirPath);
      loadedContents[key] = entries;
      loadedContents = { ...loadedContents };
    } finally {
      loadingPaths.delete(key);
      loadingPaths = new Set(loadingPaths);
    }
  }

  /** Open folder picker and add a root. */
  async function handleAddFolder(): Promise<void> {
    const path = await addRootFolder();
    if (path) {
      await loadAndCache(path);
    }
  }

  /** Remove a root folder. */
  function handleRemoveRoot(rootPath: string): void {
    const key = rootPath.replace(/\\/g, '/');
    removeRootFolder(rootPath);
    delete loadedContents[key];
    loadedContents = { ...loadedContents };
  }

  /** Handle externally added folder (drag-drop, menu). */
  function handleExternalFolderAdd(e: Event): void {
    const folderPath = (e as CustomEvent).detail as string;
    void loadAndCache(folderPath);
  }

  onMount(() => {
    void loadRootContents();

    // Listen for folders added externally (drag-drop / programmatic)
    window.addEventListener('wstext:drop-folder', handleExternalFolderAdd);
    window.addEventListener('wstext:open-folder-done', handleExternalFolderAdd);
    return () => {
      window.removeEventListener('wstext:drop-folder', handleExternalFolderAdd);
      window.removeEventListener('wstext:open-folder-done', handleExternalFolderAdd);
    };
  });
</script>

<div class="sidebar" style:background-color={bgColor} style:border-right="1px solid {borderColor}">
  <!-- Header -->
  <div class="sidebar-header" style:color={fgMuted} style:border-bottom="1px solid {borderColor}">
    <span class="header-title">FOLDERS</span>
    <div class="header-actions">
      <button
        class="header-btn"
        title="Open Folder"
        onclick={handleAddFolder}
        style:color={fgMuted}
      >+</button>
      <button
        class="header-btn"
        title="Close Sidebar (Ctrl+B)"
        onclick={toggleSidebar}
        style:color={fgMuted}
      >✕</button>
    </div>
  </div>

  <!-- Tree content -->
  <div class="sidebar-content">
    {#if appSettings.sidebarRoots.length === 0}
      <div class="empty-state" style:color={fgMuted}>
        <span>No folders opened.</span>
        <button class="open-folder-btn" onclick={handleAddFolder} style:color={accentColor}>
          Open Folder
        </button>
      </div>
    {:else}
      {@const dupeNames = getDuplicateNames(appSettings.sidebarRoots)}
      {#each appSettings.sidebarRoots as rootPath, idx (rootPath)}
        {@const rootKey = rootPath.replace(/\\/g, '/')}
        {@const rootChildren = loadedContents[rootKey] ?? []}
        {@const isLoading = loadingPaths.has(rootKey)}
        {@const showPath = dupeNames.has(displayName(rootPath))}

        <!-- Root folder header -->
        <div
          class="root-folder"
          class:drag-source={dragIdx === idx}
          class:drag-over={dragOverIdx === idx && dragIdx !== idx}
        >
          <button
            class="tree-item root-item"
            onclick={() => { if (!isDragging) handleToggleRoot(rootPath); }}
            onmousedown={(e) => handleRootMouseDown(e, idx)}
            style:color={fgColor}
            title={rootPath}
          >
            <span class="arrow">{isFolderExpanded(rootPath) ? '▼' : '▶'}</span>
            <span class="folder-icon">📁</span>
            <span class="tree-label root-label">{displayName(rootPath)}</span>
            {#if showPath}
              <span class="root-disambig" style:color={fgMuted}>{parentName(rootPath)}</span>
            {/if}
          </button>
          <div class="root-actions">
            <button
              class="action-btn"
              title="Refresh"
              onclick={() => handleRefresh(rootPath)}
              style:color={fgMuted}
            >↻</button>
            <button
              class="action-btn"
              title="Remove Folder"
              onclick={() => handleRemoveRoot(rootPath)}
              style:color={fgMuted}
            >×</button>
          </div>
        </div>

        <!-- Root children -->
        {#if isFolderExpanded(rootPath)}
          {#if isLoading && rootChildren.length === 0}
            <div class="loading" style:color={fgMuted}>Loading...</div>
          {:else}
            {#each rootChildren as child (child.path)}
              <TreeNode
                entry={child}
                depth={1}
                {activeFilePath}
                {fgColor}
                {fgMuted}
                {accentColor}
                {onFileClick}
              />
            {/each}
          {/if}
        {/if}
      {/each}
    {/if}
  </div>
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    user-select: none;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .header-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 2px;
    opacity: 0.6;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    color: inherit;
  }

  .header-btn:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 12px;
    font-size: 12px;
    text-align: center;
  }

  .open-folder-btn {
    background: none;
    border: 1px solid currentColor;
    border-radius: 4px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    opacity: 0.8;
    color: inherit;
  }

  .open-folder-btn:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.05);
  }

  .root-folder {
    display: flex;
    align-items: center;
    transition: border-color 0.1s;
    border-top: 2px solid transparent;
  }

  .root-folder.drag-source {
    opacity: 0.4;
  }

  .root-folder.drag-over {
    border-top-color: var(--accent, #61AFEF);
  }

  .root-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-right: 4px;
    opacity: 0;
    transition: opacity 0.1s;
  }

  .root-folder:hover .root-actions {
    opacity: 1;
  }

  .action-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 2px;
    opacity: 0.6;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: inherit;
  }

  .action-btn:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .tree-item {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 2px 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: inherit;
    min-height: 24px;
  }

  .tree-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .root-item {
    flex: 1;
    min-width: 0;
    font-weight: 600;
  }

  .arrow {
    font-size: 10px;
    width: 14px;
    flex-shrink: 0;
    text-align: center;
    opacity: 0.7;
  }

  .folder-icon {
    font-size: 14px;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }

  .tree-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .root-label {
    text-transform: uppercase;
    font-size: 12px;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .root-disambig {
    font-size: 11px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    opacity: 0.75;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    margin-left: 2px;
  }

  .loading {
    font-size: 12px;
    padding: 4px 8px;
    font-style: italic;
  }
</style>
