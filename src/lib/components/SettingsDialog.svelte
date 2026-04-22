<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    visible: boolean;
    settings: {
      theme: string;
      fontFamily: string;
      fontSize: number;
      tabSize: 2 | 4;
      minimap: boolean;
      checkboxEnabled: boolean;
      supportBracketV: boolean;
      copyCheckboxAsBrackets: boolean;
      excludedExtensions: string[];
    };
    bgColor?: string;
    fgColor?: string;
    fgMuted?: string;
    borderColor?: string;
    accentColor?: string;
    onSave?: (changes: Record<string, any>) => void;
    onClose?: () => void;
    onPreviewTheme?: (theme: string) => void;
  }

  let {
    visible,
    settings,
    bgColor = '#1e1f1c',
    fgColor = '#F8F8F2',
    fgMuted = '#75715E',
    borderColor = '#3e3d32',
    accentColor = '#A6E22E',
    onSave,
    onClose,
    onPreviewTheme
  }: Props = $props();

  let activeTab = $state<'general' | 'font' | 'theme'>('general');

  // Local state for settings
  let localSettings = $state({ ...settings });

  // Excluded extensions as comma-separated text
  let excludedExtText = $state(settings.excludedExtensions?.join(', ') ?? '.meta');

  // Font tab state
  let primaryFont = $state('');
  let fallbackFont = $state('');
  let filterText = $state('');
  let systemFonts = $state<string[]>([]);

  // Snapshot of the initial theme before any preview — used to detect actual changes
  const initialTheme = settings.theme;

  // Theme definitions
  const themes = [
    { id: 'monokai', name: 'Monokai', bg: '#272822', fg: '#F8F8F2', accent: '#A6E22E' },
    { id: 'dracula', name: 'Dracula', bg: '#282a36', fg: '#f8f8f2', accent: '#ff79c6' },
    { id: 'one-dark', name: 'One Dark', bg: '#282c34', fg: '#abb2bf', accent: '#61afef' },
    { id: 'mariana', name: 'Mariana', bg: '#303841', fg: '#D8DEE9', accent: '#5FB4B4' },
    { id: 'sixteen', name: 'Sixteen', bg: '#151515', fg: '#D0D0D0', accent: '#6A9FB5' },
    { id: 'breakers', name: 'Breakers', bg: '#1B2B34', fg: '#CDD3DE', accent: '#6699CC' },
    { id: 'solarized-dark', name: 'Solarized Dark', bg: '#002b36', fg: '#839496', accent: '#2aa198' },
    { id: 'solarized-light', name: 'Solarized Light', bg: '#fdf6e3', fg: '#657b83', accent: '#2aa198' },
    { id: 'celeste', name: 'Celeste', bg: '#FFFFFF', fg: '#333333', accent: '#3B5BB5' },
    { id: 'notepad', name: 'Notepad', bg: '#FFFFFF', fg: '#1E1E1E', accent: '#0078D4' },
    { id: 'notepad-warm', name: 'Notepad Warm', bg: '#FFF8F0', fg: '#3C3836', accent: '#D65D0E' },
  ];

  onMount(() => {
    // Parse currentFontFamily into primary + fallback
    const parts = localSettings.fontFamily.split(',').map(p => p.trim().replace(/^['"]|['"]$/g, ''));
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
    const changes: Record<string, any> = {};
    
    // Check general settings
    if (localSettings.tabSize !== settings.tabSize) changes.tabSize = localSettings.tabSize;
    if (localSettings.minimap !== settings.minimap) changes.minimap = localSettings.minimap;
    if (localSettings.checkboxEnabled !== settings.checkboxEnabled) changes.checkboxEnabled = localSettings.checkboxEnabled;
    if (localSettings.supportBracketV !== settings.supportBracketV) changes.supportBracketV = localSettings.supportBracketV;
    if (localSettings.copyCheckboxAsBrackets !== settings.copyCheckboxAsBrackets) changes.copyCheckboxAsBrackets = localSettings.copyCheckboxAsBrackets;
    
    // Check font settings
    const fontParts: string[] = [];
    if (primaryFont.trim()) {
      const p = primaryFont.trim();
      fontParts.push(p.includes(' ') ? `'${p}'` : p);
    }
    if (fallbackFont.trim()) {
      fontParts.push(fallbackFont.trim());
    }
    if (fontParts.length === 0) fontParts.push('monospace');
    const newFontFamily = fontParts.join(', ');
    
    if (newFontFamily !== settings.fontFamily) changes.fontFamily = newFontFamily;
    if (localSettings.fontSize !== settings.fontSize) changes.fontSize = localSettings.fontSize;
    
    // Check excluded extensions
    const newExts = excludedExtText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => (s.startsWith('.') ? s : `.${s}`));
    const oldExts = settings.excludedExtensions ?? [];
    if (JSON.stringify(newExts) !== JSON.stringify(oldExts)) {
      changes.excludedExtensions = newExts;
    }

    // Check theme settings (compare against initial snapshot, not reactive prop)
    if (localSettings.theme !== initialTheme) changes.theme = localSettings.theme;

    if (Object.keys(changes).length > 0) {
      onSave?.(changes);
    } else {
      onClose?.();
    }
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
      <div class="tab-bar" style:border-bottom-color={borderColor}>
        <button 
          class="tab-btn" 
          class:active={activeTab === 'general'}
          style:color={activeTab === 'general' ? fgColor : fgMuted}
          style:border-bottom-color={activeTab === 'general' ? accentColor : 'transparent'}
          onclick={() => activeTab = 'general'}
        >
          General
        </button>
        <button 
          class="tab-btn" 
          class:active={activeTab === 'font'}
          style:color={activeTab === 'font' ? fgColor : fgMuted}
          style:border-bottom-color={activeTab === 'font' ? accentColor : 'transparent'}
          onclick={() => activeTab = 'font'}
        >
          Font
        </button>
        <button 
          class="tab-btn" 
          class:active={activeTab === 'theme'}
          style:color={activeTab === 'theme' ? fgColor : fgMuted}
          style:border-bottom-color={activeTab === 'theme' ? accentColor : 'transparent'}
          onclick={() => activeTab = 'theme'}
        >
          Theme
        </button>
      </div>
      
      <div class="content">
        {#if activeTab === 'general'}
          <div class="tab-content">
            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-title">Enable Checkboxes (☐/☑)</div>
                <div class="setting-desc" style:color={fgMuted}>Show interactive checkboxes in markdown lists</div>
              </div>
              <label class="toggle">
                <input type="checkbox" bind:checked={localSettings.checkboxEnabled} />
                <span class="slider" style:background-color={localSettings.checkboxEnabled ? accentColor : borderColor}></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-title">Support [v] as checked</div>
                <div class="setting-desc" style:color={fgMuted}>Recognize [v] in addition to [x] as checked checkbox</div>
              </div>
              <label class="toggle">
                <input type="checkbox" bind:checked={localSettings.supportBracketV} />
                <span class="slider" style:background-color={localSettings.supportBracketV ? accentColor : borderColor}></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-title">Copy checkbox as [ ]</div>
                <div class="setting-desc" style:color={fgMuted}>Convert ☐/☑ to [ ]/[x] when copying text</div>
              </div>
              <label class="toggle">
                <input type="checkbox" bind:checked={localSettings.copyCheckboxAsBrackets} />
                <span class="slider" style:background-color={localSettings.copyCheckboxAsBrackets ? accentColor : borderColor}></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-title">Minimap</div>
                <div class="setting-desc" style:color={fgMuted}>Show code minimap on the right side</div>
              </div>
              <label class="toggle">
                <input type="checkbox" bind:checked={localSettings.minimap} />
                <span class="slider" style:background-color={localSettings.minimap ? accentColor : borderColor}></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-title">Tab Size</div>
                <div class="setting-desc" style:color={fgMuted}>Number of spaces per indentation level</div>
              </div>
              <div class="radio-group" style:border-color={borderColor}>
                <button 
                  class="radio-btn" 
                  class:active={localSettings.tabSize === 2}
                  style:background-color={localSettings.tabSize === 2 ? 'rgba(255,255,255,0.1)' : 'transparent'}
                  style:color={localSettings.tabSize === 2 ? accentColor : fgColor}
                  onclick={() => localSettings.tabSize = 2}
                >
                  2
                </button>
                <div class="radio-divider" style:background-color={borderColor}></div>
                <button 
                  class="radio-btn" 
                  class:active={localSettings.tabSize === 4}
                  style:background-color={localSettings.tabSize === 4 ? 'rgba(255,255,255,0.1)' : 'transparent'}
                  style:color={localSettings.tabSize === 4 ? accentColor : fgColor}
                  onclick={() => localSettings.tabSize = 4}
                >
                  4
                </button>
              </div>
            </div>

            <div class="setting-row" style="align-items: flex-start;">
              <div class="setting-info">
                <div class="setting-title">Excluded Extensions</div>
                <div class="setting-desc" style:color={fgMuted}>Hide files with these extensions in folder sidebar (comma-separated)</div>
              </div>
              <input
                type="text"
                class="ext-input"
                bind:value={excludedExtText}
                placeholder=".meta, .tmp"
                style:background-color="rgba(0,0,0,0.2)"
                style:color={fgColor}
                style:border-color={borderColor}
              />
            </div>
          </div>
        {:else if activeTab === 'font'}
          <div class="tab-content">
            <div class="field-row">
              <div class="field flex-1">
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
              <div class="field size-field">
                <label for="font-size" style:color={fgMuted}>Size</label>
                <input 
                  id="font-size" 
                  type="number" 
                  min="8" max="40"
                  bind:value={localSettings.fontSize} 
                  style:background-color="rgba(0,0,0,0.2)"
                  style:color={fgColor}
                  style:border-color={borderColor}
                />
              </div>
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
              <div class="preview-text" style:font-family={previewFontFamily()} style:font-size="{localSettings.fontSize}px">
                가나다라 AaBbCc 012345
              </div>
            </div>
          </div>
        {:else if activeTab === 'theme'}
          <div class="tab-content theme-grid">
            {#each themes as theme}
              <button 
                class="theme-card" 
                class:active={localSettings.theme === theme.id}
                style:border-color={localSettings.theme === theme.id ? accentColor : borderColor}
                style:background-color="rgba(0,0,0,0.1)"
                onclick={() => { localSettings.theme = theme.id; onPreviewTheme?.(theme.id); }}
              >
                <div class="theme-preview" style:background-color={theme.bg}>
                  <div class="color-dot" style:background-color={theme.fg}></div>
                  <div class="color-dot" style:background-color={theme.accent}></div>
                </div>
                <div class="theme-name" style:color={localSettings.theme === theme.id ? accentColor : fgColor}>
                  {theme.name}
                </div>
              </button>
            {/each}
          </div>
        {/if}
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
    width: 520px;
    max-width: 90vw;
    max-height: 90vh;
    border: 1px solid;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid;
    padding: 0 12px;
  }

  .tab-btn {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 16px 20px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-btn:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex: 1;
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* General Tab */
  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
  }

  .setting-title {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .setting-desc {
    font-size: 12px;
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    transition: .2s;
    border-radius: 22px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .2s;
    border-radius: 50%;
  }

  input:checked + .slider:before {
    transform: translateX(18px);
  }

  .radio-group {
    display: flex;
    border: 1px solid;
    border-radius: 4px;
    overflow: hidden;
  }

  .radio-btn {
    background: none;
    border: none;
    padding: 6px 16px;
    font-size: 13px;
    cursor: pointer;
  }

  .radio-divider {
    width: 1px;
  }

  .ext-input {
    width: 150px;
    padding: 6px 10px;
    border: 1px solid;
    border-radius: 4px;
    font-size: 13px;
    outline: none;
    font-family: inherit;
    flex-shrink: 0;
  }

  /* Font Tab */
  .field-row {
    display: flex;
    gap: 12px;
  }

  .flex-1 {
    flex: 1;
  }

  .size-field {
    width: 80px;
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

  input[type="text"], input[type="number"] {
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
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .preview-label {
    position: absolute;
    top: -8px;
    left: 12px;
    padding: 0 4px;
    font-size: 11px;
  }

  .preview-text {
    text-align: center;
    word-break: break-all;
  }

  /* Theme Tab */
  .theme-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .theme-card {
    border: 1px solid;
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .theme-card:hover {
    background-color: rgba(255, 255, 255, 0.05) !important;
  }

  .theme-preview {
    height: 60px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid rgba(0,0,0,0.2);
  }

  .color-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .theme-name {
    font-size: 14px;
    font-weight: 500;
    text-align: center;
  }

  /* Actions */
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