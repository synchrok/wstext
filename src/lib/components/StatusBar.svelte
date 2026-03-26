<script lang="ts">
  import type { Encoding } from '../types';

  interface Props {
    line?: number;
    column?: number;
    encoding?: Encoding;
    tabSize?: 2 | 4;
    language?: string;
    bgColor?: string;
    fgColor?: string;
    fgMuted?: string;
    onEncodingClick?: () => void;
    onTabSizeClick?: () => void;
    onLanguageClick?: () => void;
  }

  let {
    line = 1,
    column = 1,
    encoding = 'utf-8',
    tabSize = 4,
    language = 'Plain Text',
    bgColor = '#1e1f1c',
    fgColor = '#F8F8F2',
    fgMuted = '#75715E',
    onEncodingClick = undefined,
    onTabSizeClick = undefined,
    onLanguageClick = undefined,
  }: Props = $props();

  /** Display name for the language (capitalize first letter) */
  let languageDisplay = $derived(
    language === 'plaintext' ? 'Plain Text' :
    language.charAt(0).toUpperCase() + language.slice(1)
  );

  /** Display encoding — show "UTF-8" more clearly */
  let encodingDisplay = $derived(
    encoding === 'utf-8' ? 'UTF-8' :
    encoding === 'utf-16le' ? 'UTF-16 LE' :
    encoding === 'utf-16be' ? 'UTF-16 BE' :
    encoding === 'latin1' ? 'Latin-1' :
    'UTF-8'
  );
</script>

<div class="status-bar" style:background-color={bgColor} style:color={fgMuted}>
  <!-- Left: Cursor position -->
  <div class="status-section status-left">
    <span class="status-item status-position" title="Cursor position">
      Ln {line}, Col {column}
    </span>
  </div>

  <!-- Center: Encoding + Spaces -->
  <div class="status-section status-center">
    <button
      class="status-item status-button"
      style:color={fgMuted}
      onclick={onEncodingClick}
      title="Click to change encoding"
      type="button"
    >
      {encodingDisplay}
    </button>
    <span class="status-separator">·</span>
    <button
      class="status-item status-button"
      style:color={fgMuted}
      onclick={onTabSizeClick}
      title="Click to change indentation"
      type="button"
    >
      Spaces: {tabSize}
    </button>
  </div>

  <!-- Right: Language -->
  <div class="status-section status-right">
    <button
      class="status-item status-button"
      style:color={fgMuted}
      onclick={onLanguageClick}
      title="Click to change language mode"
      type="button"
    >
      {languageDisplay}
    </button>
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    user-select: none;
    flex-shrink: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    gap: 0;
  }

  .status-section {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-left {
    flex: 1;
    justify-content: flex-start;
  }

  .status-center {
    flex: 1;
    justify-content: center;
  }

  .status-right {
    flex: 1;
    justify-content: flex-end;
  }

  .status-item {
    padding: 0 4px;
    line-height: 22px;
    white-space: nowrap;
  }

  .status-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    padding: 0 4px;
    border-radius: 2px;
    line-height: 22px;
  }

  .status-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .status-separator {
    opacity: 0.4;
    font-size: 10px;
  }
</style>
