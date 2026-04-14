<script lang="ts">
  import { onMount } from 'svelte';
  import * as monaco from 'monaco-editor';

  // Lib imports
  import { registerAllThemes, setTheme, getThemeColors, LIGHT_THEMES } from './lib/themes';
  import { appSettings, loadSettings, updateSetting } from './lib/stores/settings.svelte';
  import {
    tabStore,
    getActiveTab,
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
  import { MENU_EVENTS } from './lib/menu';
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
  import { TodoManager, injectTodoStyles, setSupportBracketV } from './lib/todo';
  import { updateState, checkForUpdate, installUpdate, dismissVersion, loadUpdateState } from './lib/stores/updater.svelte';

  // Components
  import MenuBar from './lib/components/MenuBar.svelte';
  import TabBar from './lib/components/TabBar.svelte';
  import StatusBar from './lib/components/StatusBar.svelte';
  import MarkdownPreview from './lib/components/MarkdownPreview.svelte';
  import SettingsDialog from './lib/components/SettingsDialog.svelte';
  import FolderSidebar from './lib/components/FolderSidebar.svelte';
  import UpdateNotification from './lib/components/UpdateNotification.svelte';

  // Editor state
  let editorContainer: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor;
  let todoManager: TodoManager | null = null;
  let zoomCleanup: (() => void) | null = null;
  let eventAbort: AbortController | null = null;

  // UI state
  let showLangPicker = $state(false);
  let showEncPicker = $state(false);
  let showSpacesPicker = $state(false);
  let showSettings = $state(false);
  let notification = $state<{ message: string; type: string } | null>(null);
  let notificationTimer: ReturnType<typeof setTimeout> | undefined;
  let splitPercent = $state(50);
  let previewOriginalTheme = $state<string | null>(null);
  let sidebarWidth = $derived(appSettings.sidebarWidth);
  let sidebarVisible = $derived(appSettings.sidebarVisible);

  // Local reactive aliases for tabStore
  let tabs = $derived(tabStore.tabs);
  let activeTabId = $derived(tabStore.activeTabId);
  let activeTab = $derived(getActiveTab());

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
      const { loadRecentFiles } = await import('./lib/stores/settings.svelte');
      await loadRecentFiles();

      // Register themes BEFORE creating editor
      registerAllThemes();
      injectTodoStyles();
      setSupportBracketV(appSettings.supportBracketV);

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
        scrollBeyondLastLine: true,
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        wordWrap: 'on',
        tabSize: appSettings.tabSize,
        insertSpaces: true,
        scrollbar: {
          horizontal: 'hidden',
          horizontalScrollbarSize: 0,
        },
        autoClosingBrackets: 'never',
      });

      // Force settings — workaround for Monaco sometimes ignoring creation options
      requestAnimationFrame(() => {
        editor.updateOptions({
          wordWrap: 'on',
          scrollbar: { horizontal: 'hidden', horizontalScrollbarSize: 0 },
        });
      });

      // Register tab functions (editor reference needed for switchTab)
      registerTabFunctions(openTab, (id) => switchTab(editor, id));

      // Setup zoom (Ctrl+mousewheel)
      zoomCleanup = setupMouseWheelZoom(editor, (size) => {
        updateSetting('fontSize', size);
      });

      // AbortController — ensures ALL event listeners are removed on HMR/unmount
      const ac = new AbortController();
      const sig = { signal: ac.signal };

      // Setup keyboard shortcuts (pass signal for cleanup)
      setupKeyboardShortcuts(ac.signal);

      // Setup file drop (returns unlisten function)
      const unlistenDrop = await setupFileDrop();
      eventAbort = ac;
      // Store drop cleanup for unmount
      const origAbort = ac;
      ac.signal.addEventListener('abort', () => unlistenDrop());

      // Wire menu events (all use AbortController for cleanup)
      window.addEventListener(MENU_EVENTS.NEW_FILE, () => newFile(), sig);
      window.addEventListener(MENU_EVENTS.OPEN_FILE, () => openFile(), sig);
      window.addEventListener('wstext:open-path', async (e) => {
        const path = (e as CustomEvent).detail;
        const { openFileByPath } = await import('./lib/fileOps.svelte');
        await openFileByPath(path);
      }, sig);
      window.addEventListener(MENU_EVENTS.SAVE_FILE, async () => {
        if (activeTab) await handleSave();
      }, sig);
      window.addEventListener(MENU_EVENTS.SAVE_FILE_AS, async () => {
        if (activeTab) await handleSaveAs();
      }, sig);
      window.addEventListener(MENU_EVENTS.CLOSE_TAB, () => {
        if (activeTabId) {
          closeTab(editor, activeTabId);
          // Always keep at least one blank tab open
          if (tabStore.tabs.length === 0) {
            newFile();
          }
        }
      }, sig);
      window.addEventListener('wstext:close-all-tabs', () => {
        // Close all tabs
        while (tabStore.tabs.length > 0) {
          closeTab(editor, tabStore.tabs[0].id);
        }
        // Create one blank tab
        newFile();
      }, sig);
      window.addEventListener(MENU_EVENTS.ZOOM_IN, () => {
        const size = zoomIn(editor);
        updateSetting('fontSize', size);
      }, sig);
      window.addEventListener(MENU_EVENTS.ZOOM_OUT, () => {
        const size = zoomOut(editor);
        updateSetting('fontSize', size);
      }, sig);
      window.addEventListener(MENU_EVENTS.RESET_ZOOM, () => {
        const size = resetZoom(editor);
        updateSetting('fontSize', size);
      }, sig);
      window.addEventListener(MENU_EVENTS.FORMAT_DOCUMENT, () => {
        if (editor) formatDocument(editor);
      }, sig);
      window.addEventListener(MENU_EVENTS.TOGGLE_MINIMAP, () => {
        const newVal = !appSettings.minimap;
        updateSetting('minimap', newVal);
        editor.updateOptions({ minimap: { enabled: newVal } });
      }, sig);
      window.addEventListener(MENU_EVENTS.TOGGLE_WORD_WRAP, () => {
        const newVal = appSettings.wordWrap === 'off' ? 'on' : 'off';
        updateSetting('wordWrap', newVal);
        editor.updateOptions({ wordWrap: newVal });
      }, sig);
      window.addEventListener(MENU_EVENTS.TOGGLE_PREVIEW, () => {
        togglePreview();
      }, sig);
      window.addEventListener('wstext:open-settings', () => {
        previewOriginalTheme = null;
        showSettings = true;
      }, sig);
      window.addEventListener('wstext:next-tab', () => nextTab(editor), sig);
      window.addEventListener('wstext:prev-tab', () => prevTab(editor), sig);
      window.addEventListener('wstext:tab-saved-as', (e) => {
        const { tabId, newPath } = (e as CustomEvent).detail;
        const fileName = newPath.split(/[/\\]/).pop() ?? newPath;
        markTabClean(tabId, newPath, fileName);
      }, sig);
      window.addEventListener('wstext:notification', (e) => {
        showNotif((e as CustomEvent).detail);
      }, sig);
      window.addEventListener('wstext:toggle-sidebar', async () => {
        const { toggleSidebar } = await import('./lib/stores/folders.svelte');
        toggleSidebar();
      }, sig);
      window.addEventListener('wstext:open-folder', async () => {
        const { addRootFolder } = await import('./lib/stores/folders.svelte');
        await addRootFolder();
      }, sig);
      window.addEventListener('wstext:drop-folder', async (e) => {
        const folderPath = (e as CustomEvent).detail;
        const { addRootFolderByPath } = await import('./lib/stores/folders.svelte');
        await addRootFolderByPath(folderPath);
      }, sig);
      // Session restore: open tabs from session
      window.addEventListener('wstext:restore-tab', (e) => {
        const tabData = (e as CustomEvent).detail;
        openTab(tabData);
      }, sig);

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

      // Restore session only if no tabs exist (guards against HMR re-mount)
      if (tabStore.tabs.length === 0) {
        const { initSession } = await import('./lib/session.svelte');
        await initSession();
      }

      // Always start with at least one blank tab
      if (tabStore.tabs.length === 0) {
        newFile();
      }

      // After session restore: switch editor to the active tab's model + refresh decorations
      if (tabStore.activeTabId) {
        // Force model switch (openTab sets activeTabId but doesn't switch editor model)
        const savedActiveId = tabStore.activeTabId;
        tabStore.activeTabId = null; // Reset so switchTab doesn't skip
        switchTab(editor, savedActiveId);
        // Refresh todo decorations on the now-loaded model
        todoManager?.refreshDecorations();
      }

      // Check for updates after UI is ready (non-blocking)
      loadUpdateState().then(() => checkForUpdate());
    })();

    return () => {
      eventAbort?.abort(); // Remove ALL event listeners at once
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
      wordWrap: 'on',
      minimap: { enabled: appSettings.minimap },
      scrollbar: { horizontal: 'hidden', horizontalScrollbarSize: 0 },
    });
    setTheme(appSettings.theme);
  });

  // React to active tab changes → update todo manager
  $effect(() => {
    const tabId = activeTabId;
    if (!todoManager || !tabId) return;

    const tab = tabs.find(t => t.id === tabId);
    if (tab && (tab.language === 'markdown' || tab.language === 'plaintext')) {
      todoManager.refreshDecorations();
    }
  });

  async function handleSave(): Promise<void> {
    if (!activeTab || !activeTabId) return;
    // Sync latest editor content to tab before saving
    if (editor) {
      updateTabContent(activeTabId, editor.getValue());
    }
    const success = await saveFile(activeTab);
    if (success) {
      markTabClean(activeTabId);
    }
  }

  async function handleSaveAs(): Promise<void> {
    if (!activeTab || !activeTabId) return;
    if (editor) {
      updateTabContent(activeTabId, editor.getValue());
    }
    await saveFileAs(activeTab);
  }

  function togglePreview(): void {
    if (!activeTabId) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    // 3-stage toggle: editor → split → preview → editor
    const cycle = { editor: 'split', split: 'preview', preview: 'editor' } as const;
    const newMode = cycle[tab.viewMode as keyof typeof cycle] ?? 'editor';
    import('./lib/stores/tabs.svelte').then(({ updateTabViewMode }) => {
      updateTabViewMode(activeTabId!, newMode as any);
    });
  }

  function startSidebarDrag(e: MouseEvent): void {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(140, Math.min(500, ev.clientX));
      updateSetting('sidebarWidth', newWidth);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  async function handleSidebarFileClick(filePath: string): Promise<void> {
    const { openFileByPath } = await import('./lib/fileOps.svelte');
    await openFileByPath(filePath);
  }

  function startSplitDrag(e: MouseEvent): void {
    e.preventDefault();
    const editorArea = (e.target as HTMLElement).parentElement!;
    const rect = editorArea.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      splitPercent = Math.max(20, Math.min(80, pct));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
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
  <!-- Tab bar (always visible — acts as drag region + window controls) -->
  <MenuBar
    activeFileName={activeTab?.title ?? ''}
    bgColor={themeColors.bgSecondary}
    fgColor={themeColors.fgPrimary}
    fgMuted={themeColors.fgMuted}
    borderColor={themeColors.border}
    accentColor={themeColors.accent}
  />
  <TabBar
    {tabs}
    {activeTabId}
    {sidebarVisible}
    bgColor={themeColors.tabBarBg}
    tabActiveBg={themeColors.tabActive}
    tabInactiveBg={themeColors.tabInactive}
    tabActiveFg={themeColors.tabActiveFg}
    tabInactiveFg={themeColors.tabInactiveFg}
    accentColor={themeColors.accent}
    borderColor={themeColors.border}
    onTabClick={(id) => switchTab(editor, id)}
    onTabClose={(id) => {
      closeTab(editor, id);
      if (tabStore.tabs.length === 0) newFile();
    }}
    onTabMiddleClick={(id) => {
      closeTab(editor, id);
      if (tabStore.tabs.length === 0) newFile();
    }}
    onTabReorder={(from, to) => {
      const tab = tabStore.tabs.splice(from, 1)[0];
      tabStore.tabs.splice(to, 0, tab);
    }}
  />

  <!-- Main content area (sidebar + editor) -->
  <div class="main-content">
    <!-- Folder sidebar -->
    {#if sidebarVisible}
      <div class="sidebar-panel" style:width="{sidebarWidth}px" style:min-width="{sidebarWidth}px">
        <FolderSidebar
          activeFilePath={activeTab?.filePath ?? null}
          bgColor={themeColors.bgSecondary}
          fgColor={themeColors.fgPrimary}
          fgMuted={themeColors.fgMuted}
          borderColor={themeColors.border}
          accentColor={themeColors.accent}
          onFileClick={handleSidebarFileClick}
        />
      </div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sidebar-handle" onmousedown={startSidebarDrag}></div>
    {/if}

    <!-- Editor area -->
    <div class="editor-area" class:split-view={isSplit && showPreview}>

      <!-- Monaco editor (hidden when in toggle preview mode) -->
      <div
        class="editor-container"
        class:hidden={activeTab?.viewMode === 'preview'}
        style:flex={isSplit && activeTab?.viewMode === 'split' ? `0 0 ${splitPercent}%` : ''}
      >
        <div bind:this={editorContainer} class="monaco-container"></div>
      </div>

      <!-- Split handle + Markdown preview -->
      {#if showPreview && activeTab}
        {#if activeTab.viewMode === 'split'}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="split-handle"
            onmousedown={startSplitDrag}
          ></div>
        {/if}
        <div class="preview-container" style:flex={activeTab.viewMode === 'split' ? `0 0 ${100 - splitPercent}%` : ''}>
          <MarkdownPreview
            source={activeTab.content}
            mode={activeTab.viewMode === 'split' ? 'split' : 'toggle'}
            isDark={!LIGHT_THEMES.has(appSettings.theme)}
          />
        </div>
      {/if}

    </div>
  </div>

  <!-- Status bar -->
  <StatusBar
    line={statusLine}
    column={statusColumn}
    encoding={activeTab?.encoding ?? 'utf-8'}
    tabSize={appSettings.tabSize}
    language={activeTab ? getLanguageDisplayName(activeTab.language) : 'Plain Text'}
    viewMode={activeTab?.viewMode ?? 'editor'}
    bgColor={themeColors.statusBarBg}
    fgColor={themeColors.fgPrimary}
    fgMuted={themeColors.fgMuted}
    accentColor={themeColors.accent}
    onEncodingClick={() => (showEncPicker = !showEncPicker)}
    onTabSizeClick={() => (showSpacesPicker = !showSpacesPicker)}
    onLanguageClick={() => (showLangPicker = !showLangPicker)}
    onPreviewToggle={() => togglePreview()}
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

  {#if showSettings}
    <SettingsDialog
      visible={showSettings}
      settings={{
        theme: appSettings.theme,
        fontFamily: appSettings.fontFamily,
        fontSize: appSettings.fontSize,
        tabSize: appSettings.tabSize,
        minimap: appSettings.minimap,
        checkboxEnabled: appSettings.checkboxEnabled,
        supportBracketV: appSettings.supportBracketV,
        excludedExtensions: appSettings.excludedExtensions,
      }}
      bgColor={themeColors.bgSecondary}
      fgColor={themeColors.fgPrimary}
      fgMuted={themeColors.fgMuted}
      borderColor={themeColors.border}
      accentColor={themeColors.accent}
      onPreviewTheme={(theme) => {
        if (previewOriginalTheme === null) {
          previewOriginalTheme = appSettings.theme;
        }
        appSettings.theme = theme as any;
        setTheme(theme as any);
      }}
      onSave={(changes) => {
        previewOriginalTheme = null;
        for (const [key, value] of Object.entries(changes)) {
          updateSetting(key as any, value);
        }
        if (changes.theme) {
          setTheme(changes.theme);
        }
        if (changes.fontFamily || changes.fontSize) {
          editor.updateOptions({
            fontFamily: changes.fontFamily ?? appSettings.fontFamily,
            fontSize: changes.fontSize ?? appSettings.fontSize,
          });
        }
        if (changes.minimap !== undefined) {
          editor.updateOptions({ minimap: { enabled: changes.minimap } });
        }
        if (changes.tabSize) {
          editor.updateOptions({ tabSize: changes.tabSize });
        }
        if (changes.checkboxEnabled !== undefined) {
          if (changes.checkboxEnabled) {
            todoManager?.refreshDecorations();
          } else {
            todoManager?.dispose();
            todoManager = new TodoManager(editor);
          }
        }
        if (changes.supportBracketV !== undefined) {
          setSupportBracketV(changes.supportBracketV);
        }
        if (changes.excludedExtensions !== undefined) {
          import('./lib/stores/folders.svelte').then(({ setExcludedExtensions }) => {
            setExcludedExtensions(changes.excludedExtensions);
          });
        }
        showSettings = false;
      }}
      onClose={() => {
        if (previewOriginalTheme !== null) {
          appSettings.theme = previewOriginalTheme as any;
          setTheme(previewOriginalTheme as any);
          previewOriginalTheme = null;
        }
        showSettings = false;
      }}
    />
  {/if}

  <UpdateNotification
    visible={updateState.availableVersion !== null && !updateState.checking}
    isPortable={updateState.isPortable}
    version={updateState.availableVersion ?? ''}
    updateUrl={updateState.updateUrl ?? ''}
    downloading={updateState.downloading}
    hasDirtyTabs={tabs.some(t => t.isDirty)}
    bgColor={themeColors.bgSecondary}
    fgColor={themeColors.fgPrimary}
    fgMuted={themeColors.fgMuted}
    accentColor={themeColors.accent}
    borderColor={themeColors.border}
    onUpdate={() => installUpdate()}
    onDismiss={() => dismissVersion(updateState.availableVersion!)}
  />
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

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: row;
    overflow: hidden;
  }

  .sidebar-panel {
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .sidebar-handle {
    width: 3px;
    cursor: col-resize;
    background: transparent;
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .sidebar-handle:hover {
    background: rgba(128, 128, 128, 0.4);
  }

  .editor-area {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
    min-width: 0;
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

  .split-handle {
    width: 4px;
    cursor: col-resize;
    background: rgba(128, 128, 128, 0.2);
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .split-handle:hover {
    background: rgba(128, 128, 128, 0.5);
  }

  .preview-container {
    flex: 1;
    overflow: hidden;
    min-width: 0;
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
