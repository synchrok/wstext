<script lang="ts">
  import type { FolderEntry } from '../types';
  import {
    toggleFolder,
    getFolderContents,
    isFolderExpanded,
  } from '../stores/folders.svelte';
  import TreeNode from './TreeNode.svelte';

  interface Props {
    entry: FolderEntry;
    depth?: number;
    activeFilePath?: string | null;
    fgColor?: string;
    fgMuted?: string;
    accentColor?: string;
    onFileClick?: (filePath: string) => void;
  }

  let {
    entry,
    depth = 1,
    activeFilePath = null,
    fgColor = '#ABB2BF',
    fgMuted = '#5C6370',
    accentColor = '#61AFEF',
    onFileClick = undefined,
  }: Props = $props();

  /** Children of this folder once loaded. */
  let children = $state<FolderEntry[]>([]);
  let isLoading = $state(false);

  function normPath(p: string): string {
    return p.replace(/\\/g, '/').toLowerCase();
  }

  function getExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  }

  function isActiveFile(filePath: string): boolean {
    if (!activeFilePath) return false;
    return normPath(filePath) === normPath(activeFilePath);
  }

  async function handleToggle(): Promise<void> {
    isLoading = true;
    try {
      const expanded = await toggleFolder(entry.path);
      if (expanded) {
        children = await getFolderContents(entry.path);
      }
    } finally {
      isLoading = false;
    }
  }

  function handleFileClick(filePath: string): void {
    onFileClick?.(filePath);
  }

  let paddingLeft = $derived(`${8 + depth * 16}px`);
</script>

{#if entry.isDirectory}
  <!-- Folder node -->
  <button
    class="tree-item folder-item"
    style:padding-left={paddingLeft}
    style:color={fgColor}
    onclick={handleToggle}
    title={entry.path}
  >
    <span class="arrow">{isFolderExpanded(entry.path) ? '▼' : '▶'}</span>
    <span class="node-icon">📁</span>
    <span class="tree-label">{entry.name}</span>
  </button>

  <!-- Children -->
  {#if isFolderExpanded(entry.path)}
    {#if isLoading && children.length === 0}
      <div class="loading" style:color={fgMuted} style:padding-left="{8 + (depth + 1) * 16}px">
        Loading...
      </div>
    {:else}
      {#each children as child (child.path)}
        <TreeNode
          entry={child}
          depth={depth + 1}
          {activeFilePath}
          {fgColor}
          {fgMuted}
          {accentColor}
          {onFileClick}
        />
      {/each}
    {/if}
  {/if}
{:else}
  <!-- File node -->
  <button
    class="tree-item file-item"
    class:active={isActiveFile(entry.path)}
    style:padding-left={paddingLeft}
    style:color={isActiveFile(entry.path) ? fgColor : fgMuted}
    style:background-color={isActiveFile(entry.path) ? `${accentColor}22` : 'transparent'}
    onclick={() => handleFileClick(entry.path)}
    title={entry.path}
  >
    <span class="node-icon file-ext-{getExtension(entry.name)}">📄</span>
    <span class="tree-label">{entry.name}</span>
  </button>
{/if}

<style>
  .tree-item {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
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
    padding-top: 1px;
    padding-bottom: 1px;
    padding-right: 8px;
  }

  .tree-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .tree-item.active {
    background-color: rgba(255, 255, 255, 0.08);
  }

  .arrow {
    font-size: 10px;
    width: 14px;
    flex-shrink: 0;
    text-align: center;
    opacity: 0.7;
  }

  .node-icon {
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

  .loading {
    font-size: 12px;
    padding: 2px 8px;
    font-style: italic;
  }
</style>
