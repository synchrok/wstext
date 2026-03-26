<script lang="ts">
  import { onMount } from 'svelte';
  import * as monaco from 'monaco-editor';

  // Lib imports
  import { registerAllThemes, setTheme, getThemeColors } from './lib/themes';
  import { appSettings, loadSettings, updateSetting } from './lib/stores/settings.svelte';
  import {
    tabs,
    activeTabId,
    activeTab,
    openTab,
    switchTab,
    closeTab,
    nextTab,
    prevTab,
    updateTabContent,
    markTabClean,
    updateTabCursor,
    updateTabLanguage,
    updateTabEncoding,
    getTabModel,
  } from './lib/stores/tabs.svelte';
  import {
    newFile,
    openFile,
    saveFile,
    saveFileAs,
    setupFileDrop,
    registerTabFunctions,
  } from './lib/fileOps.svelte';
  import { setupMenu, MENU_EVENTS } from './lib/menu';
  import { setupKeyboardShortcuts } from './lib/shortcuts';
  import {
    setupMouseWheelZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setFontFamily,
    setTabSize,
    getFontSize,
  } from './lib/zoom';
  import { formatDocument } from './lib/formatting';
  import { setLanguage, getLanguageDisplayName } from './lib/languageOverride';
  import { TodoManager, injectTodoStyles } from './lib/todo';

  // Components
  import TabBar from './lib/components/TabBar.svelte';
  import StatusBar from './lib/components/StatusBar.svelte';
  import MarkdownPreview from './lib/components/MarkdownPreview.svelte';

  // Editor state
  let editorContainer: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor;
  let todoManager: TodoManager | null = null;
  let zoomCleanup: (() => void) | null = null;

  // UI state
  let showLangPicker = $state(false);
  let showEncPicker = $state(false);
  let showSpacesPicker = $state(false);
  let notification = $state<{ message: string; type: string } | null>(null);
  let notificationTimer: ReturnType<typeof setTimeout> | undefined;

  // Derived theme colors
  let themeColors = $derived(getThemeColors(appSettings.theme));

  // Derived: is current tab markdown?
  let isMarkdown = $derived(activeTab?.language === 'markdown');

  // Derived: show preview
  let showPreview = $derived(
    isMarkdown && (activeTab?.viewMode === 'preview' || activeTab?.viewMode === 'split')
  );

  // Derived: split view?
  let isSplit = $derived(activeTab?.viewMode === 'split');

  // Current status bar values
  let statusLine = $state(1);
  let statusColumn = $state(1);

  onMount(() => {
    (async () => {
      // Load settings first
      await loadSettings();

      // Register themes BEFORE creating editor
      registerAllThemes();
      injectTodoStyles();

      // Create Monaco editor
      editor = monaco.editor.create(editorContainer, {
        theme: appSettings.theme,
        automaticLayout: true,
        minimap: {
          enabled: appSettings.minimap,
          scale: 1,
          renderCharacters: false,
        },
        fontSize: appSettings.fontSize,
        fontFamily: appSettings.fontFamily,
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        wordWrap: appSettings.wordWrap,
        tabSize: appSettings.tabSize,
        insertSpaces: true,
      });

      // Register tab functions (avoids circular imports)
      registerTabFunctions(tabs, openTab, (id) => switchTab(editor, id));

      // Setup zoom (Ctrl+mousewheel)
      zoomCleanup = setupMouseWheelZoom(editor, (size) => {
        updateSetting('fontSize', size);
      });

      // Setup menu
      await setupMenu();

      // Setup keyboard shortcuts
      setupKeyboardShortcuts();

      // Setup file drop
      await setupFileDrop();

      // Wire menu events
      window.addEventListener(MENU_EVENTS.NEW_FILE, () => newFile());
      window.addEventListener(MENU_EVENTS.OPEN_FILE, () => openFile());
      window.addEventListener(MENU_EVENTS.SAVE_FILE, async () => {
        if (activeTab) await handleSave();
      });
      window.addEventListener(MENU_EVENTS.SAVE_FILE_AS, async () => {
        if (activeTab) await handleSaveAs();
      });
      window.addEventListener(MENU_EVENTS.CLOSE_TAB, () => {
        if (activeTabId) closeTab(editor, activeTabId);
      });
      window.addEventListener(MENU_EVENTS.ZOOM_IN, () => {
        const size = zoomIn(editor);
        updateSetting('fontSize', size);
      });
      window.addEventListener(MENU_EVENTS.ZOOM_OUT, () => {
        const size = zoomOut(editor);
        updateSetting('fontSize', size);
      });
      window.addEventListener(MENU_EVENTS.RESET_ZOOM, () => {
        const size = resetZoom(editor);
        updateSetting('fontSize', size);
      });
      window.addEventListener(MENU_EVENTS.FORMAT_DOCUMENT, () => {
        if (editor) formatDocument(editor);
      });
      window.addEventListener(MENU_EVENTS.TOGGLE_MINIMAP, () => {
        const newVal = !appSettings.minimap;
        updateSetting('minimap', newVal);
        editor.updateOptions({ minimap: { enabled: newVal } });
      });
      window.addEventListener(MENU_EVENTS.TOGGLE_WORD_WRAP, () => {
        const newVal = appSettings.wordWrap === 'off' ? 'on' : 'off';
        updateSetting('wordWrap', newVal);
        editor.updateOptions({ wordWrap: newVal });
      });
      window.addEventListener(MENU_EVENTS.TOGGLE_PREVIEW, () => {
        togglePreview();
      });
      window.addEventListener(MENU_EVENTS.SET_THEME, (e) => {
        const themeName = (e as CustomEvent).detail;
        updateSetting('theme', themeName);
        setTheme(themeName);
      });
      window.addEventListener('wstext:next-tab', () => nextTab(editor));
      window.addEventListener('wstext:prev-tab', () => prevTab(editor));
      window.addEventListener('wstext:tab-saved-as', (e) => {
        const { tabId, newPath } = (e as CustomEvent).detail;
        const fileName = newPath.split(/[/\\]/).pop() ?? newPath;
        markTabClean(tabId, newPath, fileName);
      });
      window.addEventListener('wstext:notification', (e) => {
        showNotif((e as CustomEvent).detail);
      });
      // Session restore: open tabs from session
      window.addEventListener('wstext:restore-tab', (e) => {
        const tabData = (e as CustomEvent).detail;
        openTab(tabData);
      });

      // Monaco cursor position tracking
      editor.onDidChangeCursorPosition((e) => {
        statusLine = e.position.lineNumber;
        statusColumn = e.position.column;
        if (activeTabId) {
          updateTabCursor(activeTabId, e.position.lineNumber, e.position.column);
        }
      });

      // Monaco content changes → dirty tracking + todo decorations
      editor.onDidChangeModelContent(() => {
        if (activeTabId) {
          updateTabContent(activeTabId, editor.getValue());
        }
      });

      // Initialize todo manager
      todoManager = new TodoManager(editor);

      // Start session if no tabs open
      const { initSession } = await import('./lib/session.svelte');
      await initSession();

      // If still no tabs after session restore, create a new file
      if (tabs.length === 0) {
        // Show empty state — don't auto-create
      }
    })();

    return () => {
      zoomCleanup?.();
      todoManager?.dispose();
      editor?.dispose();
    };
  });

  // React to settings changes → update editor
  $effect(() => {
    if (!editor) return;
    editor.updateOptions({
      theme: appSettings.theme,
      fontSize: appSettings.fontSize,
      fontFamily: appSettings.fontFamily,
      wordWrap: appSettings.wordWrap,
      minimap: { enabled: appSettings.minimap },
    });
    setTheme(appSettings.theme);
  });

  // React to active tab changes → update todo manager
  $effect(() => {
    const tabId = activeTabId;
    if (!todoManager || !tabId) return;

    const tab = tabs.find(t => t.id === tabId);
    if (tab && (tab.language === 'markdown' || tab.language === 'plaintext')) {
      todoManager.refresh();
    }
  });

  async function handleSave(): Promise<void> {
    if (!activeTab) return;
    const success = await saveFile(activeTab);
    if (success && activeTabId) {
      markTabClean(activeTabId);
    }
  }

  async function handleSaveAs(): Promise<void> {
    if (!activeTab) return;
    await saveFileAs(activeTab);
  }

  function togglePreview(): void {
    if (!activeTabId) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    if (tab.viewMode === 'editor') {
      // Switch to toggle preview
      import('./lib/stores/tabs.svelte').then(({ updateTabViewMode }) => {
        updateTabViewMode(activeTabId!, 'preview');
      });
    } else if (tab.viewMode === 'preview') {
      import('./lib/stores/tabs.svelte').then(({ updateTabViewMode }) => {
        updateTabViewMode(activeTabId!, 'split');
      });
    } else {
      import('./lib/stores/tabs.svelte').then(({ updateTabViewMode }) => {
        updateTabViewMode(activeTabId!, 'editor');
      });
    }
  }

  function showNotif(detail: { message: string; type: string }): void {
    notification = detail;
    if (notificationTimer) clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => {
      notification = null;
      notificationTimer = undefined;
    }, 4000);
  }

  function handleTabSizeChange(size: 2 | 4): void {
    updateSetting('tabSize', size);
    setTabSize(editor, size);
    showSpacesPicker = false;
  }

  function handleLanguageChange(lang: string): void {
    if (!activeTabId) return;
    updateTabLanguage(activeTabId, lang);
    showLangPicker = false;
  }

  function handleEncodingChange(enc: string): void {
    if (!activeTabId) return;
    updateTabEncoding(activeTabId, enc as 'utf-8' | 'utf-16le' | 'utf-16be', false);
    showEncPicker = false;
  }

  // Window title update
  $effect(() => {
    const tab = activeTab;
    let title = 'wstext';
    if (tab) {
      title = `${tab.isDirty ? tab.title + '*' : tab.title} — wstext`;
    }
    document.title = title;
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().setTitle(title).catch(() => {});
    });
  });
</script>

<!-- App shell -->
<div
  class="app"
  style:--bg-primary={themeColors.bgPrimary}
  style:--bg-secondary={themeColors.bgSecondary}
  style:--fg-primary={themeColors.fgPrimary}
  style:--fg-muted={themeColors.fgMuted}
  style:--border={themeColors.border}
  style:--accent={themeColors.accent}
  style:background-color={themeColors.bgPrimary}
>
  <!-- Tab bar -->
  {#if tabs.length > 0}
    <TabBar
      {tabs}
      {activeTabId}
      bgColor={themeColors.tabBarBg}
      tabActiveBg={themeColors.tabActive}
      tabInactiveBg={themeColors.tabInactive}
      tabActiveFg={themeColors.tabActiveFg}
      tabInactiveFg={themeColors.tabInactiveFg}
      borderColor={themeColors.border}
      onTabClick={(id) => switchTab(editor, id)}
      onTabClose={(id) => closeTab(editor, id)}
      onTabMiddleClick={(id) => closeTab(editor, id)}
    />
  {/if}

  <!-- Main content area -->
  <div class="editor-area" class:split-view={isSplit && showPreview}>

    <!-- Monaco editor (hidden when in toggle preview mode) -->
    <div
      class="editor-container"
      class:hidden={activeTab?.viewMode === 'preview'}
    >
      <div bind:this={editorContainer} class="monaco-container"></div>
    </div>

    <!-- Markdown preview -->
    {#if showPreview && activeTab}
      <div class="preview-container">
        <MarkdownPreview
          source={activeTab.content}
          mode={activeTab.viewMode === 'split' ? 'split' : 'toggle'}
          isDark={appSettings.theme !== 'solarized-light'}
        />
      </div>
    {/if}

    <!-- Empty state -->
    {#if tabs.length === 0}
      <div class="empty-state" style:color={themeColors.fgMuted}>
        <div class="empty-icon">📄</div>
        <p class="empty-title" style:color={themeColors.fgPrimary}>wstext</p>
        <p class="empty-hint">
          Open a file <kbd>Ctrl+O</kbd> or create new <kbd>Ctrl+N</kbd>
        </p>
      </div>
    {/if}
  </div>

  <!-- Status bar -->
  <StatusBar
    line={statusLine}
    column={statusColumn}
    encoding={activeTab?.encoding ?? 'utf-8'}
    tabSize={appSettings.tabSize}
    language={activeTab ? getLanguageDisplayName(activeTab.language) : 'Plain Text'}
    bgColor={themeColors.statusBarBg}
    fgColor={themeColors.fgPrimary}
    fgMuted={themeColors.fgMuted}
    onEncodingClick={() => (showEncPicker = !showEncPicker)}
    onTabSizeClick={() => (showSpacesPicker = !showSpacesPicker)}
    onLanguageClick={() => (showLangPicker = !showLangPicker)}
  />

  <!-- Notification toast -->
  {#if notification}
    <div
      class="notification"
      class:error={notification.type === 'error'}
      class:warning={notification.type === 'warning'}
    >
      {notification.message}
    </div>
  {/if}

  <!-- Dropdowns -->
  {#if showSpacesPicker}
    <div class="dropdown-overlay" onclick={() => (showSpacesPicker = false)} role="presentation"></div>
    <div class="dropdown picker-spaces" style:background-color={themeColors.bgSecondary} style:color={themeColors.fgPrimary}>
      <button class="picker-item" onclick={() => handleTabSizeChange(2)}>Spaces: 2</button>
      <button class="picker-item" onclick={() => handleTabSizeChange(4)}>Spaces: 4</button>
    </div>
  {/if}

  {#if showEncPicker}
    <div class="dropdown-overlay" onclick={() => (showEncPicker = false)} role="presentation"></div>
    <div class="dropdown picker-encoding" style:background-color={themeColors.bgSecondary} style:color={themeColors.fgPrimary}>
      {#each ['utf-8', 'utf-16le', 'utf-16be'] as enc}
        <button class="picker-item" onclick={() => handleEncodingChange(enc)}>
          {enc === 'utf-8' ? 'UTF-8' : enc === 'utf-16le' ? 'UTF-16 LE' : 'UTF-16 BE'}
        </button>
      {/each}
    </div>
  {/if}

  {#if showLangPicker}
    <div class="dropdown-overlay" onclick={() => (showLangPicker = false)} role="presentation"></div>
    <div class="dropdown picker-language" style:background-color={themeColors.bgSecondary} style:color={themeColors.fgPrimary}>
      {#each ['plaintext', 'typescript', 'javascript', 'json', 'yaml', 'html', 'css', 'markdown', 'python', 'rust', 'go', 'java', 'cpp', 'shell', 'sql'] as lang}
        <button class="picker-item" onclick={() => handleLanguageChange(lang)}>
          {getLanguageDisplayName(lang)}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .editor-area {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .editor-area.split-view {
    flex-direction: row;
  }

  .editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .editor-container.hidden {
    display: none;
  }

  .monaco-container {
    flex: 1;
    width: 100%;
    height: 100%;
  }

  .preview-container {
    flex: 1;
    overflow: hidden;
    min-width: 0;
  }

  /* Empty state */
  .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    user-select: none;
    pointer-events: none;
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.3;
  }

  .empty-title {
    font-size: 24px;
    font-weight: 300;
    letter-spacing: 2px;
    opacity: 0.7;
    margin: 0;
  }

  .empty-hint {
    font-size: 13px;
    opacity: 0.5;
    margin: 0;
  }

  .empty-hint kbd {
    display: inline-block;
    padding: 1px 6px;
    border: 1px solid currentColor;
    border-radius: 3px;
    font-family: monospace;
    font-size: 11px;
    opacity: 0.7;
    margin: 0 2px;
  }

  /* Notification toast */
  .notification {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: #fff;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    max-width: 480px;
    text-align: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  .notification.error {
    background: #c0392b;
  }

  .notification.warning {
    background: #e67e22;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* Dropdown overlay */
  .dropdown-overlay {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .dropdown {
    position: fixed;
    bottom: 26px;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 0;
    z-index: 100;
    min-width: 140px;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .picker-spaces { right: 180px; }
  .picker-encoding { right: 100px; }
  .picker-language { right: 20px; }

  .picker-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 5px 12px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: inherit;
    font-family: inherit;
  }

  .picker-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
</style>