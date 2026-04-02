<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    visible: boolean;
    currentFontFamily: string;
    bgColor?: string;
    fgColor?: string;
    fgMuted?: string;
    borderColor?: string;
    accentColor?: string;
    onSave?: (fontFamily: string) => void;
    onClose?: () => void;
  }

  let {
    visible,
    currentFontFamily,
    bgColor = '#1e1f1c',
    fgColor = '#F8F8F2',
    fgMuted = '#75715E',
    borderColor = '#3e3d32',
    accentColor = '#A6E22E',
    onSave,
    onClose
  }: Props = $props();

  let primaryFont = $state('');
  let fallbackFont = $state('');
  let filterText = $state('');
  let systemFonts = $state<string[]>([]);

  // Parse currentFontFamily into primary + fallback on init
  onMount(() => {
    const parts = currentFontFamily.split(',').map(p => p.trim().replace(/^['"]|['"]$/g, ''));
    if (parts.length > 0) {
      primaryFont = parts[0];
      if (parts.length > 1) {
        fallbackFont = parts.slice(1).join(', ');
      }
    }

    loadSystemFonts();
  });

  async function loadSystemFonts() {
    try {
      if ('queryLocalFonts' in window) {
        const fonts = await (window as any).queryLocalFonts();
        const families = new Set<string>();
        for (const font of fonts) {
          families.add(font.family);
        }
        systemFonts = [...families].sort((a, b) => a.localeCompare(b));
      } else {
        throw new Error('queryLocalFonts not available');
      }
    } catch {
      systemFonts = [
        'Arial', 'Consolas', 'Courier New', 'D2Coding', 'Georgia',
        'Gulim', 'Malgun Gothic', 'Meiryo', 'Monaco', 'Nanum Gothic',
        'Nanum Gothic Coding', 'Noto Sans KR', 'Pretendard',
        'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana',
      ];
    }
  }

  function handleSave() {
    const parts: string[] = [];
    if (primaryFont.trim()) {
      const p = primaryFont.trim();
      parts.push(p.includes(' ') ? `'${p}'` : p);
    }
    if (fallbackFont.trim()) {
      parts.push(fallbackFont.trim());
    }
    if (parts.length === 0) parts.push('monospace');
    onSave?.(parts.join(', '));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose?.();
    }
  }

  let filteredFonts = $derived(
    systemFonts.filter(f => f.toLowerCase().includes(filterText.toLowerCase()))
  );

  let previewFontFamily = $derived(() => {
    const parts: string[] = [];
    if (primaryFont.trim()) {
      const p = primaryFont.trim();
      parts.push(p.includes(' ') ? `'${p}'` : p);
    }
    if (fallbackFont.trim()) {
      parts.push(fallbackFont.trim());
    }
    if (parts.length === 0) parts.push('monospace');
    return parts.join(', ');
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={onClose} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      class="dialog" 
      style:background-color={bgColor} 
      style:color={fgColor}
      style:border-color={borderColor}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      tabindex="-1"
    >
      <h2 style:border-bottom-color={borderColor}>Font Settings</h2>
      
      <div class="content">
        <div class="field">
          <label for="primary-font" style:color={fgMuted}>Primary Font</label>
          <input 
            id="primary-font" 
            type="text" 
            bind:value={primaryFont} 
            style:background-color="rgba(0,0,0,0.2)"
            style:color={fgColor}
            style:border-color={borderColor}
          />
        </div>

        <div class="field">
          <label for="font-filter" style:color={fgMuted}>Filter System Fonts</label>
          <input 
            id="font-filter" 
            type="text" 
            bind:value={filterText} 
            placeholder="Search fonts..."
            style:background-color="rgba(0,0,0,0.2)"
            style:color={fgColor}
            style:border-color={borderColor}
          />
        </div>

        <div class="font-list" style:border-color={borderColor} style:background-color="rgba(0,0,0,0.1)">
          {#each filteredFonts as font}
            <button 
              class="font-item" 
              class:selected={primaryFont === font}
              style:font-family={font}
              style:color={primaryFont === font ? accentColor : fgColor}
              onclick={() => primaryFont = font}
            >
              {font}
            </button>
          {/each}
        </div>

        <div class="field">
          <label for="fallback-font" style:color={fgMuted}>Fallback Font(s)</label>
          <input 
            id="fallback-font" 
            type="text" 
            bind:value={fallbackFont} 
            placeholder="e.g. 'Courier New', monospace"
            style:background-color="rgba(0,0,0,0.2)"
            style:color={fgColor}
            style:border-color={borderColor}
          />
        </div>

        <div class="preview-box" style:border-color={borderColor} style:background-color="rgba(0,0,0,0.2)">
          <div class="preview-label" style:color={fgMuted} style:background-color={bgColor}>Preview</div>
          <div class="preview-text" style:font-family={previewFontFamily()}>
            가나다라 AaBbCc 012345
          </div>
        </div>
      </div>

      <div class="actions" style:border-top-color={borderColor}>
        <button 
          class="btn-cancel" 
          style:color={fgMuted}
          onclick={onClose}
        >
          Cancel
        </button>
        <button 
          class="btn-save" 
          style:background-color={accentColor}
          style:color={bgColor}
          onclick={handleSave}
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .dialog {
    width: 480px;
    max-width: 90vw;
    border: 1px solid;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  h2 {
    margin: 0;
    padding: 16px 20px;
    font-size: 16px;
    font-weight: 600;
    border-bottom: 1px solid;
  }

  .content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 12px;
    font-weight: 500;
  }

  input {
    padding: 8px 12px;
    border: 1px solid;
    border-radius: 4px;
    font-size: 13px;
    outline: none;
  }

  input:focus {
    border-color: var(--accent, #A6E22E) !important;
  }

  .font-list {
    height: 200px;
    overflow-y: auto;
    border: 1px solid;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
  }

  .font-item {
    padding: 8px 12px;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
  }

  .font-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .font-item.selected {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .preview-box {
    margin-top: 8px;
    padding: 16px;
    border: 1px solid;
    border-radius: 4px;
    position: relative;
  }

  .preview-label {
    position: absolute;
    top: -8px;
    left: 12px;
    padding: 0 4px;
    font-size: 11px;
  }

  .preview-text {
    font-size: 18px;
    text-align: center;
    word-break: break-all;
  }

  .actions {
    padding: 16px 20px;
    border-top: 1px solid;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  button {
    font-family: inherit;
  }

  .btn-cancel {
    background: none;
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    border-radius: 4px;
  }

  .btn-cancel:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .btn-save {
    border: none;
    padding: 8px 20px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    border-radius: 4px;
  }

  .btn-save:hover {
    filter: brightness(1.1);
  }
</style>