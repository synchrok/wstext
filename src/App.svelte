<script lang="ts">
  import { onMount, tick } from 'svelte';
  import * as monaco from 'monaco-editor';
  import { ask, confirm } from '@tauri-apps/plugin-dialog';

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
  import { isCodeLanguage } from './lib/utils/fileLanguage';
  import { TodoManager, injectTodoStyles, setSupportBracketV, setCopyAsCheckbox } from './lib/todo';
  import { FileWatcher } from './lib/fileWatcher.svelte';
  import { updateState, checkForUpdate, installUpdate, dismissVersion, loadUpdateState } from './lib/stores/updater.svelte';
  import {
    createNewWindow,
    handOffTabToNewWindow,
    sendTabToExistingWindow,
    getOtherWindowBounds,
    findWindowAt,
    onAdoptTab,
    announceReady,
    isMainWindow,
    isAdoptWindow,
    MW_EVENTS,
    ADOPT_FALLBACK_TIMEOUT_MS,
  } from './lib/multiWindow';
  import { listen } from '@tauri-apps/api/event';
  import { setSuppressBroadcast } from './lib/stores/settings.svelte';
  import { isMac } from './lib/platform';
  import type { Encoding, AppSettings, TabState } from './lib/types';

  // Components
  import MenuBar from './lib/components/MenuBar.svelte';
  import TabBar from './lib/components/TabBar.svelte';
  import StatusBar from './lib/components/StatusBar.svelte';
  import MarkdownPreview from './lib/components/MarkdownPreview.svelte';
  import SettingsDialog from './lib/components/SettingsDialog.svelte';
  import AboutDialog from './lib/components/AboutDialog.svelte';
  import FolderSidebar from './lib/components/FolderSidebar.svelte';
  import UpdateNotification from './lib/components/UpdateNotification.svelte';

  // Editor state
  let editorContainer: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor;
  let todoManager: TodoManager | null = null;
  let fileWatcher = $state<FileWatcher | null>(null);
  let zoomCleanup: (() => void) | null = null;
  let eventAbort: AbortController | null = null;
  let suppressEditorContentSync = false;

  // UI state
  let showLangPicker = $state(false);
  let showEncPicker = $state(false);
  let showSpacesPicker = $state(false);
  let showSettings = $state(false);
  let showAbout = $state(false);

  let notification = $state<{ message: string; type: string } | null>(null);
  let notificationTimer: ReturnType<typeof setTimeout> | undefined;
  let splitPercent = $state(50);
  let previewOriginalTheme = $state<string | null>(null);
  const adoptWindow = isAdoptWindow();
  const mainWindow = isMainWindow();
  let adoptReceived = false;
  // Buffer of adoption payloads received before the editor is ready.
  // Flushed once Monaco is created.
  let pendingAdoptedTabs: TabState[] = [];
  let editorReady = false;

  // Kick off the adoption handshake immediately (before Monaco loads).
  // This lets the source window deliver the tab payload in parallel with
  // our Monaco bootstrap instead of waiting for it to finish.
  let earlyAdoptUnlisten: (() => void) | null = null;
  if (typeof window !== 'undefined') {
    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const myLabel = getCurrentWindow().label;
        earlyAdoptUnlisten = await listen<{ tabData: TabState; source?: string }>(
          MW_EVENTS.ADOPT_TAB,
          (evt) => {
            if (!evt.payload?.tabData) return;
            // Ignore any adopt event we emitted ourselves. This can happen
            // because emit()-style events are delivered to every listener in
            // the app — including the sender — and emitTo() has historically
            // been flaky about cross-window isolation. Treat "we are the
            // source" as an unconditional skip.
            if (evt.payload.source && evt.payload.source === myLabel) return;
            adoptReceived = true;
            if (editorReady) {
              adoptIntoEditor(evt.payload.tabData);
            } else {
              pendingAdoptedTabs.push(evt.payload.tabData);
            }
          }
        );
        // Announce readiness right away — the source's emit can now land
        // even before Monaco has mounted.
        if (adoptWindow) {
          void announceReady();
        }
      } catch (err) {
        console.warn('[app] early adopt listener failed:', err);
      }
    })();
  }

  function adoptIntoEditor(tabData: TabState): void {
    if (!editor) return;
    // Strip the incoming id — openTab assigns a fresh one so Monaco model
    // URIs don't clash with anything restored from session.
    const { id: _drop, ...rest } = tabData;
    const newId = openTab(rest as Omit<TabState, 'id'>);
    switchTab(editor, newId);
    // Make sure the receiving window comes to the foreground.
    void (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const w = getCurrentWindow();
        await w.show().catch(() => {});
        await w.unminimize().catch(() => {});
        await w.setFocus().catch(() => {});
      } catch { /* non-critical */ }
    })();
  }
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

  // Font family and size applied to Monaco both depend on the active tab's
  // language: code/data files use codeFontFamily/codeFontSize, text files
  // (markdown, mdx, plaintext) use the default fontFamily/fontSize.
  let isCodeTab = $derived(!!activeTab && isCodeLanguage(activeTab.language));
  let effectiveFontFamily = $derived(
    isCodeTab ? appSettings.codeFontFamily : appSettings.fontFamily
  );
  let effectiveFontSize = $derived(
    isCodeTab ? appSettings.codeFontSize : appSettings.fontSize
  );

  // Current status bar values
  let statusLine = $state(1);
  let statusColumn = $state(1);

  // Track previous font family to remeasure Monaco's char-width cache only
  // when the font actually changes (NOT on zoom/theme tweaks). Plain `let`
  // (non-reactive in Svelte 5 runes mode) is intentional.
  let prevFontFamily = '';

  let updateCheckToast = $state<string | null>(null);
  let updateCheckToastTimer: ReturnType<typeof setTimeout> | null = null;
  function showUpdateCheckToast(msg: string): void {
    if (updateCheckToastTimer) clearTimeout(updateCheckToastTimer);
    updateCheckToast = msg;
    updateCheckToastTimer = setTimeout(() => {
      updateCheckToast = null;
      updateCheckToastTimer = null;
    }, 3000);
  }

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
    setCopyAsCheckbox(appSettings.copyAsCheckbox);

      // Wait for web fonts (Pretendard) before creating editor —
      // Monaco caches font metrics on first render; if Pretendard isn't loaded yet,
      // it caches fallback metrics and the cursor/lines drift on later input.
      // Esp. critical on macOS WKWebView, which honors subpixel font metric changes.
      try {
        await document.fonts.ready;
      } catch {
        /* FontFaceSet unavailable — proceed without explicit wait. */
      }

      // macOS-only Monaco stability fixes. These were added to fix WKWebView
      // line-jitter / IME / Pretendard fake-bold issues but they actively
      // *break* rendering on Windows (ClearType + WebView2):
      //   - Hard-coded `lineHeight: 20` ignores the user's font-size and
      //     causes adjacent lines to overlap on zoom.
      //   - `fontWeight: '450'` makes ClearType render text noticeably bolder
      //     than the Pretendard 400 weight users expect.
      //   - `disableMonospaceOptimizations` slows Monaco's renderer; only
      //     needed because Pretendard is proportional and WKWebView caches
      //     wrong char widths.
      //   - `fontLigatures: false` is harmless on Windows but kept Mac-side
      //     for symmetry with the original jitter fix.
      const macStabilityOpts: monaco.editor.IEditorOptions = isMac
        ? {
            lineHeight: 20,
            disableMonospaceOptimizations: true,
            fontLigatures: false,
            fontWeight: '450',
          }
        : {};

      // Create Monaco editor
      editor = monaco.editor.create(editorContainer, {
        theme: appSettings.theme,
        automaticLayout: true,
        minimap: {
          enabled: appSettings.minimap,
          scale: 1,
          renderCharacters: false,
        },
        fontSize: effectiveFontSize,
        fontFamily: effectiveFontFamily,
        ...macStabilityOpts,
        // Cross-platform: keep editor calm during input.
        smoothScrolling: false,
        cursorSurroundingLines: 0,
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

      // Force a font remeasure now that the real Pretendard is available —
      // ensures Monaco's internal char-width cache reflects the actual font.
      monaco.editor.remeasureFonts();

      // Force settings — workaround for Monaco sometimes ignoring creation options
      requestAnimationFrame(() => {
        editor.updateOptions({
          wordWrap: 'on',
          scrollbar: { horizontal: 'hidden', horizontalScrollbarSize: 0 },
        });
      });

      // Register tab functions (editor reference needed for switchTab)
      registerTabFunctions(openTab, (id) => switchTab(editor, id));

      // Setup zoom (Ctrl+mousewheel). The new size is routed to either
      // fontSize or codeFontSize based on the active tab's language so the
      // two sizes track independently.
      zoomCleanup = setupMouseWheelZoom(editor, (size) => {
        updateSetting(isCodeTab ? 'codeFontSize' : 'fontSize', size);
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
          void handleCloseTabRequest(activeTabId);
        }
      }, sig);
      window.addEventListener('wstext:close-all-tabs', () => void handleCloseAllTabs(), sig);
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
      window.addEventListener(MENU_EVENTS.ABOUT, () => (showAbout = true), sig);
      window.addEventListener(MENU_EVENTS.CHECK_FOR_UPDATES, async () => {
        if (updateState.checking) return;
        await checkForUpdate(true);
        if (updateState.manualCheckOutcome === 'latest') {
          showUpdateCheckToast('이미 최신 버전입니다');
        } else if (updateState.manualCheckOutcome === 'error') {
          showUpdateCheckToast('업데이트 확인 실패');
        }
      }, sig);
      window.addEventListener('wstext:next-tab', () => nextTab(editor), sig);
      window.addEventListener('wstext:prev-tab', () => prevTab(editor), sig);
      window.addEventListener('wstext:new-window', async () => {
        try { await createNewWindow({ focus: true }); }
        catch (err) { console.warn('[app] new window failed:', err); }
      }, sig);
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

      // Monaco scroll tracking
      editor.onDidScrollChange((e) => {
        if (activeTabId && e.scrollTopChanged) {
          const tab = tabStore.tabs.find(t => t.id === activeTabId);
          if (tab) tab.scrollTop = e.scrollTop;
        }
      });

      // Monaco content changes → dirty tracking + todo decorations
      editor.onDidChangeModelContent(() => {
        if (suppressEditorContentSync) return;
        if (activeTabId) {
          updateTabContent(activeTabId, editor.getValue());
        }
      });

      // Initialize todo manager
      todoManager = new TodoManager(editor);
      fileWatcher = new FileWatcher({
        getTab: (tabId) => tabStore.tabs.find((tab) => tab.id === tabId),
        onReload: async (tabId, payload) => {
          replaceTabContent(tabId, payload.content, {
            preserveDirty: false,
            encoding: payload.encoding,
            hasBOM: payload.hasBOM,
          });
        },
        onError: (message) => showNotif({ message, type: 'error' }),
      });

      // Restore session only if no tabs exist (guards against HMR re-mount)
      if (tabStore.tabs.length === 0) {
        const { initSession } = await import('./lib/session.svelte');
        await initSession();
      }

      // Main window: after self-restore, recreate any secondary windows from manifest.
      if (mainWindow && !adoptWindow) {
        try {
          const { restoreSecondaryWindowsFromManifest } = await import('./lib/session.svelte');
          await restoreSecondaryWindowsFromManifest();
        } catch (err) { console.warn('[app] secondary restore failed:', err); }
      }

      // Mark editor ready and flush any adoption payloads that arrived early.
      // (The early listener was registered before Monaco finished booting.)
      editorReady = true;
      for (const buffered of pendingAdoptedTabs) {
        adoptIntoEditor(buffered);
      }
      pendingAdoptedTabs = [];
      ac.signal.addEventListener('abort', () => earlyAdoptUnlisten?.());

      if (adoptWindow) {
        // Re-announce in case the source listener only registered after our
        // first announceReady (race protection, cheap broadcast).
        void announceReady();
        // Reveal the window now that the editor is mounted.
        void (async () => {
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().show().catch(() => {});
          } catch { /* non-critical */ }
        })();
        setTimeout(() => {
          if (!adoptReceived && tabStore.tabs.length === 0) {
            newFile();
          }
        }, ADOPT_FALLBACK_TIMEOUT_MS);
      } else if (tabStore.tabs.length === 0) {
        // Normal windows always start with at least one blank tab.
        newFile();
      }

      // Non-main, non-adopt windows (restored secondaries) also need an
      // explicit show() since we launch them hidden to avoid FOUC.
      if (!adoptWindow && !mainWindow) {
        void (async () => {
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().show().catch(() => {});
          } catch { /* non-critical */ }
        })();
      }

      // Cross-window settings sync: apply changes coming from other windows
      // without re-broadcasting them.
      const unlistenSettings = await listen<{ source: string; changes: Partial<AppSettings> }>(
        MW_EVENTS.SETTINGS_CHANGED,
        ({ payload }) => {
          if (!payload || payload.source === undefined) return;
          // Ignore our own echo.
          const myLabel = (async () => (await import('./lib/multiWindow')).getWindowLabel())();
          void myLabel.then((label) => {
            if (payload.source === label) return;
            setSuppressBroadcast(true);
            try {
              Object.assign(appSettings, payload.changes);
            } finally {
              setSuppressBroadcast(false);
            }
          });
        }
      );
      ac.signal.addEventListener('abort', () => unlistenSettings());

      // After session restore: switch editor to the active tab's model + refresh decorations
      if (tabStore.activeTabId) {
        // Force model switch (openTab sets activeTabId but doesn't switch editor model)
        const savedActiveId = tabStore.activeTabId;
        tabStore.activeTabId = null; // Reset so switchTab doesn't skip
        switchTab(editor, savedActiveId);
        // Restore cursor position and scroll from session data
        const restoredTab = tabStore.tabs.find(t => t.id === savedActiveId);
        if (restoredTab) {
          editor.setPosition({ lineNumber: restoredTab.cursor.line, column: restoredTab.cursor.column });
          editor.setScrollTop(restoredTab.scrollTop);
          editor.revealPositionInCenter({ lineNumber: restoredTab.cursor.line, column: restoredTab.cursor.column });
        }
        // Refresh todo decorations on the now-loaded model
        todoManager?.refreshDecorations();
      }

      // OS-level "Open With" / argv handling.
      // - Cold start: drain any file paths passed on the command line.
      // - Warm start (single-instance): the Rust side emits `wstext:open-files`
      //   when a second invocation is intercepted.
      // Only the main window participates so files don't get duplicated into
      // every secondary window the user happens to have open.
      if (mainWindow && !adoptWindow) {
        const { openFileByPath } = await import('./lib/fileOps.svelte');
        const openMany = async (paths: string[]) => {
          for (const p of paths) {
            try { await openFileByPath(p); } catch (err) { console.warn('[app] open-with failed:', p, err); }
          }
          // Surface the window so the user sees the file they just opened.
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const w = getCurrentWindow();
            await w.show().catch(() => {});
            await w.unminimize().catch(() => {});
            await w.setFocus().catch(() => {});
          } catch { /* non-critical */ }
        };

        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const startup = await invoke<string[]>('take_startup_files');
          if (startup && startup.length > 0) {
            void openMany(startup);
          }
        } catch (err) {
          console.warn('[app] take_startup_files failed:', err);
        }

        const unlistenOpenFiles = await listen<string[]>('wstext:open-files', ({ payload }) => {
          if (Array.isArray(payload) && payload.length > 0) {
            void openMany(payload);
          }
        });
        ac.signal.addEventListener('abort', () => unlistenOpenFiles());
      }

      // Check for updates after UI is ready (non-blocking).
      // Only the main window runs the check — secondary windows share the store but
      // must not display duplicate notifications.
      if (mainWindow) {
        loadUpdateState().then(() => checkForUpdate());
      } else {
        void loadUpdateState();
      }
    })();

    return () => {
      eventAbort?.abort(); // Remove ALL event listeners at once
      zoomCleanup?.();
      fileWatcher?.dispose();
      todoManager?.dispose();
      editor?.dispose();
    };
  });

  // React to settings changes → update editor.
  // Also reacts to active-tab language changes via `effectiveFontFamily` /
  // `effectiveFontSize`, so switching between markdown and JSON swaps font
  // and size automatically.
  $effect(() => {
    if (!editor) return;
    editor.updateOptions({
      theme: appSettings.theme,
      fontSize: effectiveFontSize,
      fontFamily: effectiveFontFamily,
      wordWrap: 'on',
      minimap: { enabled: appSettings.minimap },
      scrollbar: { horizontal: 'hidden', horizontalScrollbarSize: 0 },
    });
    setTheme(appSettings.theme);

    // When the font family actually changes (settings dialog OR tab switch
    // across the code/text boundary), force Monaco to refresh its cached
    // char-width metrics. Skipped on zoom/theme changes to avoid measurement
    // churn on the hot path.
    if (effectiveFontFamily !== prevFontFamily) {
      prevFontFamily = effectiveFontFamily;
      monaco.editor.remeasureFonts();
    }
  });

  // React to active tab changes → update todo manager.
  // `force: true` is critical: Monaco occasionally drops inline decoration
  // classes from a model's previous render when `setModel()` re-attaches the
  // same model (tab switch back), so the checkboxes lose their color and
  // render as plain ☐. The content-keyed short-circuit inside
  // refreshDecorations would otherwise see "nothing changed" and skip the
  // re-application, leaving the visual bug until the next edit / tab switch.
  $effect(() => {
    const tabId = activeTabId;
    if (!todoManager || !tabId) return;

    const tab = tabs.find(t => t.id === tabId);
    if (tab && (tab.language === 'markdown' || tab.language === 'plaintext')) {
      todoManager.refreshDecorations(true);
    }
  });

  $effect(() => {
    if (!fileWatcher) return;
    void fileWatcher.reconcile(tabs);
  });

  function getTabById(tabId: string) {
    return tabStore.tabs.find((tab) => tab.id === tabId) ?? null;
  }

  function replaceTabContent(
    tabId: string,
    content: string,
    options: {
      preserveDirty: boolean;
      encoding?: Encoding;
      hasBOM?: boolean;
    }
  ): void {
    const tab = getTabById(tabId);
    const model = getTabModel(tabId);
    if (!tab || !model) return;

    const wasDirty = tab.isDirty;
    const isActiveModel = editor?.getModel() === model;
    const viewState = isActiveModel ? editor.saveViewState() : null;

    if (model.getValue() !== content) {
      suppressEditorContentSync = true;
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: content }], () => null);
      suppressEditorContentSync = false;
    }

    tab.content = content;
    tab.isDirty = options.preserveDirty ? wasDirty : false;
    if (options.encoding) tab.encoding = options.encoding;
    if (options.hasBOM !== undefined) tab.hasBOM = options.hasBOM;

    if (isActiveModel && viewState) {
      editor.restoreViewState(viewState);
      editor.focus();
    }

    todoManager?.refreshDecorations();
  }

  async function saveTabById(tabId: string): Promise<boolean> {
    const tab = getTabById(tabId);
    const model = getTabModel(tabId);
    if (!tab || !model) return false;

    tab.content = model.getValue();
    if (tab.filePath) {
      fileWatcher?.markSelfSave(tabId, tab.filePath);
    }

    const success = await saveFile(tab);
    if (success) {
      markTabClean(tabId);
    }
    return success;
  }

  async function requestCloseTab(tabId: string): Promise<boolean> {
    const tab = getTabById(tabId);
    if (!tab) return true;

    if (tab.isDirty) {
      const shouldSave = await ask('저장하지 않은 변경사항이 있습니다.\n저장하시겠습니까?', {
        title: tab.title,
        kind: 'warning',
        okLabel: '저장',
        cancelLabel: '저장 안 함',
      });

      if (shouldSave) {
        const saved = await saveTabById(tabId);
        if (!saved) return false;
      }
    }

    closeTab(editor, tabId);
    return true;
  }

  function ensureBlankTabIfNeeded(): void {
    if (tabStore.tabs.length === 0) {
      newFile();
    }
  }

  async function handleCloseTabRequest(tabId: string): Promise<void> {
    const closed = await requestCloseTab(tabId);
    if (closed) {
      ensureBlankTabIfNeeded();
    }
  }

  async function handleTabDragOut(tabId: string, screenX: number, screenY: number): Promise<void> {
    const tab = getTabById(tabId);
    if (!tab) return;

    // Snapshot a detached copy of the tab. Guard against disposed models
    // (can happen if the tab was closed mid-drag).
    let latestContent = tab.content;
    try {
      const model = getTabModel(tabId);
      if (tabId === activeTabId && editor) {
        latestContent = editor.getValue();
      } else if (model && !model.isDisposed()) {
        latestContent = model.getValue();
      }
    } catch {
      // Fall back to cached content from the tab state.
    }

    const tabCopy: TabState = {
      ...tab,
      content: latestContent,
    };

    // Decide: drop into an existing window, or spawn a new one?
    let targetLabel: string | null = null;
    try {
      const others = await getOtherWindowBounds();
      const hit = findWindowAt(screenX, screenY, others);
      if (hit) targetLabel = hit.label;
    } catch {
      // If bounds query fails, fall back to new-window behaviour.
    }

    try {
      if (targetLabel) {
        // Drag-in: send to the existing window. Show a hint so the user knows
        // what happened when the window may be obscured.
        await sendTabToExistingWindow(targetLabel, tabCopy);
      } else {
        showNotif({ message: 'Opening new window…', type: 'info' });
        await handOffTabToNewWindow(tabCopy, {
          position: { x: Math.max(0, screenX - 60), y: Math.max(0, screenY - 20) },
        });
      }

      // Only remove from source AFTER the payload is delivered/emitted.
      // This avoids disposing the model before we've read its content.
      closeTab(editor, tabId);

      // Let Svelte flush the reactive update so the tab bar + title bar
      // reflect the new active tab before any follow-up work.
      await tick();

      // Explicitly switch to the new active tab. closeTab already swaps the
      // editor's model, but we also want cursor/scroll restoration and
      // decoration refresh to happen via our normal switchTab path.
      if (tabStore.activeTabId) {
        switchTab(editor, tabStore.activeTabId);
        todoManager?.refreshDecorations();
      }

      // If this is a secondary window and we're now empty, close the window
      // instead of spawning a blank tab. This mirrors VS Code / browser tab
      // drag-out behaviour: dragging the last tab out closes the source window.
      //
      // We use destroy() directly (skipping onCloseRequested's session save)
      // because:
      //   1. The window has no tabs left — no user data to save.
      //   2. close() goes through onCloseRequested, which does async IO
      //      (saveSessionMetadata) and sometimes never reaches destroy() if
      //      another window is concurrently writing the same store.
      // We also drop ourselves from the manifest so a relaunch won't recreate
      // an empty window.
      if (tabStore.tabs.length === 0 && !mainWindow) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const { removeFromManifest } = await import('./lib/multiWindow');
          const w = getCurrentWindow();
          await removeFromManifest(w.label).catch(() => {});
          // Remove any stale sentinel for this window so startup won't flag
          // a false crash next time.
          try {
            const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
            await remove(`.wstext-running-${w.label}`, { baseDir: BaseDirectory.AppData })
              .catch(() => {});
          } catch { /* ignore */ }
          await w.destroy();
        } catch (err) {
          console.warn('[app] destroy failed, falling back to blank tab:', err);
          ensureBlankTabIfNeeded();
        }
        return;
      }

      ensureBlankTabIfNeeded();
    } catch (err) {
      showNotif({
        message: `Drag-out failed: ${err instanceof Error ? err.message : String(err)}`,
        type: 'error',
      });
    }
  }

  async function handleCloseAllTabs(): Promise<void> {
    const tabIds = tabStore.tabs.map((tab) => tab.id);

    for (const tabId of tabIds) {
      if (!getTabById(tabId)) continue;
      const closed = await requestCloseTab(tabId);
      if (!closed) return;
    }

    ensureBlankTabIfNeeded();
  }

  async function handleSave(): Promise<void> {
    if (!activeTab || !activeTabId) return;
    // Sync latest editor content to tab before saving
    if (editor) {
      updateTabContent(activeTabId, editor.getValue());
    }
    if (activeTab.filePath) {
      fileWatcher?.markSelfSave(activeTabId, activeTab.filePath);
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
    const prevLang = activeTab?.language;
    updateTabLanguage(activeTabId, lang);

    if ((lang === 'markdown' || lang === 'mdx') && prevLang !== 'markdown' && prevLang !== 'mdx') {
      suppressEditorContentSync = true;
      try {
        todoManager?.revertToFileFormat();
      } finally {
        suppressEditorContentSync = false;
      }
      const tab = getTabById(activeTabId);
      if (tab) {
        tab.content = editor.getValue();
      }
    }

    if ((prevLang === 'markdown' || prevLang === 'mdx') && lang !== 'markdown' && lang !== 'mdx') {
      suppressEditorContentSync = true;
      try {
        todoManager?.convertToDisplayFormat();
      } finally {
        suppressEditorContentSync = false;
      }
      const tab = getTabById(activeTabId);
      if (tab) {
        tab.content = editor.getValue();
      }
    }

    todoManager?.refreshDecorations();
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
    activeFilePath={activeTab?.filePath ?? ''}
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
    onTabClose={(id) => void handleCloseTabRequest(id)}
    onTabMiddleClick={(id) => void handleCloseTabRequest(id)}
    onTabReorder={(from, to) => {
      const tab = tabStore.tabs.splice(from, 1)[0];
      tabStore.tabs.splice(to, 0, tab);
    }}
    onTabDragOut={(id, x, y) => { void handleTabDragOut(id, x, y); }}
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
          {#key activeTabId}
            <MarkdownPreview
              source={activeTab.content}
              filePath={activeTab.filePath ?? undefined}
              mode={activeTab.viewMode === 'split' ? 'split' : 'toggle'}
              isDark={!LIGHT_THEMES.has(appSettings.theme)}
              initialScrollTop={activeTab.previewScrollTop ?? 0}
              onScroll={(top) => { const t = getActiveTab(); if (t) t.previewScrollTop = top; }}
            />
          {/key}
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
        codeFontFamily: appSettings.codeFontFamily,
        fontSize: appSettings.fontSize,
        codeFontSize: appSettings.codeFontSize,
        tabSize: appSettings.tabSize,
        minimap: appSettings.minimap,
        checkboxEnabled: appSettings.checkboxEnabled,
        supportBracketV: appSettings.supportBracketV,
        excludedExtensions: appSettings.excludedExtensions,
        copyAsCheckbox: appSettings.copyAsCheckbox,
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
        if (
          changes.fontFamily ||
          changes.codeFontFamily ||
          changes.fontSize ||
          changes.codeFontSize
        ) {
          // Resolve font + size for the currently active tab using the same
          // text/code rule as the $effect above, applying any pending changes.
          const nextTextFamily = changes.fontFamily ?? appSettings.fontFamily;
          const nextCodeFamily = changes.codeFontFamily ?? appSettings.codeFontFamily;
          const nextTextSize = changes.fontSize ?? appSettings.fontSize;
          const nextCodeSize = changes.codeFontSize ?? appSettings.codeFontSize;
          editor.updateOptions({
            fontFamily: isCodeTab ? nextCodeFamily : nextTextFamily,
            fontSize: isCodeTab ? nextCodeSize : nextTextSize,
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
        if (changes.copyAsCheckbox !== undefined) {
          setCopyAsCheckbox(changes.copyAsCheckbox);
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

  {#if showAbout}
    <AboutDialog
      visible={showAbout}
      bgColor={themeColors.bgSecondary}
      fgColor={themeColors.fgPrimary}
      fgMuted={themeColors.fgMuted}
      accentColor={themeColors.accent}
      borderColor={themeColors.border}
      onClose={() => (showAbout = false)}
    />
  {/if}

  <UpdateNotification
    visible={mainWindow && updateState.availableVersion !== null && !updateState.checking}
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

  {#if updateCheckToast}
    <div class="update-check-toast" style="background:{themeColors.bgSecondary};color:{themeColors.fgPrimary};border-color:{themeColors.border}">
      {updateCheckToast}
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

  .update-check-toast {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    border: 1px solid;
    border-radius: 4px;
    font-size: 13px;
    z-index: 1001;
    pointer-events: none;
  }

</style>
