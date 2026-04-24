import * as monaco from 'monaco-editor';
import type { TabState, ViewMode, Encoding } from '../types';

/** Generate a simple UUID-like ID */
function generateId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Reactive tab state — Svelte 5 runes.
 * NOTE: .svelte.ts extension required for $state runes.
 * NOTE: Using a single state object to avoid Svelte 5's restriction on
 *       exporting reassignable $state primitives.
 */
export const tabStore = $state({
  tabs: [] as TabState[],
  activeTabId: null as string | null,
});

/** View state cache: tabId → Monaco editor view state (cursor/scroll) */
const viewStateCache = new Map<string, monaco.editor.ICodeEditorViewState | null>();

/** Monaco model cache: tabId → ITextModel */
const modelCache = new Map<string, monaco.editor.ITextModel>();

/** Get the currently active tab object */
export function getActiveTab() {
  return tabStore.tabs.find((t) => t.id === tabStore.activeTabId) ?? null;
}

/**
 * Open a new tab with the given content.
 * Returns the new tab's ID.
 *
 * NOTE: each tab gets a unique Monaco URI that embeds the tab id, even for
 * file-backed tabs. Without the id, two tabs opening the same path would
 * share a single Monaco model — disposing one tab's model would crash the
 * other (classic cross-window drag-out symptom). The id disambiguates them
 * at the URI level while still giving Monaco a sensible path hint for
 * language detection.
 */
export function openTab(tabData: Omit<TabState, 'id'>): string {
  const id = generateId();
  const tab: TabState = { ...tabData, id };

  // Create Monaco model for this tab with a per-tab unique URI.
  const uri = tab.filePath
    ? monaco.Uri.parse(`file:///${id}/${tab.filePath.replace(/\\/g, '/').replace(/^\/+/, '')}`)
    : monaco.Uri.parse(`untitled:///${id}`);

  // Belt-and-braces: if something already owns this URI, dispose it first
  // so we can always create a fresh model owned by THIS tab.
  const existing = monaco.editor.getModel(uri);
  if (existing && !existing.isDisposed()) {
    try { existing.dispose(); } catch { /* ignore */ }
  }
  const model = monaco.editor.createModel(tab.content, tab.language, uri);
  if (tab.isLargeFile) {
    model.updateOptions({ tabSize: 4 });
  }
  modelCache.set(id, model);

  tabStore.tabs.push(tab);
  tabStore.activeTabId = id;
  return id;
}

/**
 * Switch to a different tab.
 * Saves the current tab's view state and restores the target tab's.
 */
export function switchTab(editor: monaco.editor.IStandaloneCodeEditor, tabId: string): void {
  // Save current view state before switching
  if (tabStore.activeTabId && tabStore.activeTabId !== tabId) {
    viewStateCache.set(tabStore.activeTabId, editor.saveViewState());
  }

  tabStore.activeTabId = tabId;

  // Switch Monaco model
  const model = modelCache.get(tabId);
  if (model) {
    editor.setModel(model);
    // Restore view state (cached from previous switch, or fall back to tab data)
    const vs = viewStateCache.get(tabId);
    if (vs) {
      editor.restoreViewState(vs);
    } else {
      // No cached view state — use tab's cursor/scroll (e.g. after session restore)
      const tab = tabStore.tabs.find(t => t.id === tabId);
      if (tab) {
        editor.setPosition({ lineNumber: tab.cursor.line, column: tab.cursor.column });
        editor.setScrollTop(tab.scrollTop);
      }
    }
    editor.focus();
  }
}

/**
 * Close a tab. Disposes Monaco model and removes from tabs.
 *
 * Ordering is critical:
 *   1. Compute which tab survives as the new active.
 *   2. Update reactive tab store (splice + activeTabId) so Svelte derived
 *      state (activeTab, titles, etc.) is consistent BEFORE Monaco work.
 *   3. Swap the editor onto a LIVE model matching the new activeTabId.
 *   4. Dispose the old model last — never while it's the editor's active
 *      model, or Monaco throws "Model is disposed!" from decorations / async
 *      rendering that run between dispose and the next setModel.
 */
export function closeTab(editor: monaco.editor.IStandaloneCodeEditor, tabId: string): void {
  const idx = tabStore.tabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return;

  const wasActive = tabStore.activeTabId === tabId;
  const oldModel = modelCache.get(tabId);

  // 1. Compute the survivor BEFORE mutating.
  let newActiveId: string | null = tabStore.activeTabId;
  if (wasActive) {
    if (tabStore.tabs.length <= 1) {
      newActiveId = null;
    } else {
      const remaining = tabStore.tabs.filter((t) => t.id !== tabId);
      const newIdx = Math.min(idx, remaining.length - 1);
      newActiveId = remaining[newIdx]?.id ?? null;
    }
  }

  // 2. Update reactive state first (single consistent snapshot for Svelte).
  tabStore.tabs.splice(idx, 1);
  tabStore.activeTabId = newActiveId;

  // 3. Swap editor onto a live model.
  if (wasActive) {
    if (newActiveId) {
      const newModel = modelCache.get(newActiveId);
      if (newModel && !newModel.isDisposed()) {
        editor.setModel(newModel);
        const vs = viewStateCache.get(newActiveId);
        if (vs) {
          editor.restoreViewState(vs);
        } else {
          const survivorTab = tabStore.tabs.find((t) => t.id === newActiveId);
          if (survivorTab) {
            editor.setPosition({
              lineNumber: survivorTab.cursor.line,
              column: survivorTab.cursor.column,
            });
            editor.setScrollTop(survivorTab.scrollTop);
          }
        }
        editor.focus();
      }
    } else {
      const emptyModel = monaco.editor.createModel('', 'plaintext');
      editor.setModel(emptyModel);
    }
  }

  // 4. Dispose old model last.
  if (oldModel && !oldModel.isDisposed()) {
    try { oldModel.dispose(); } catch { /* ignore */ }
  }
  modelCache.delete(tabId);
  viewStateCache.delete(tabId);
}

/**
 * Update a tab's content and mark it as dirty.
 */
export function updateTabContent(tabId: string, content: string): void {
  const tab = tabStore.tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.content = content;
    tab.isDirty = true;
  }
}

/**
 * Mark a tab as clean (after save).
 */
export function markTabClean(tabId: string, newPath?: string, newTitle?: string): void {
  const tab = tabStore.tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.isDirty = false;
    if (newPath) tab.filePath = newPath;
    if (newTitle) tab.title = newTitle;
  }
}

/**
 * Update tab cursor position.
 */
export function updateTabCursor(tabId: string, line: number, column: number): void {
  const tab = tabStore.tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.cursor = { line, column };
  }
}

/**
 * Update tab view mode (editor/preview/split).
 */
export function updateTabViewMode(tabId: string, mode: ViewMode): void {
  const tab = tabStore.tabs.find((t) => t.id === tabId);
  if (tab) tab.viewMode = mode;
}

/**
 * Update tab language.
 */
export function updateTabLanguage(tabId: string, language: string): void {
  const tab = tabStore.tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.language = language;
    const model = modelCache.get(tabId);
    if (model) {
      monaco.editor.setModelLanguage(model, language);
    }
  }
}

/**
 * Update tab encoding.
 */
export function updateTabEncoding(tabId: string, encoding: Encoding, hasBOM: boolean): void {
  const tab = tabStore.tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.encoding = encoding;
    tab.hasBOM = hasBOM;
    tab.isDirty = true;
  }
}

/**
 * Get the Monaco model for a tab.
 */
export function getTabModel(tabId: string): monaco.editor.ITextModel | undefined {
  return modelCache.get(tabId);
}

/**
 * Switch to next tab (for Ctrl+Tab).
 */
export function nextTab(editor: monaco.editor.IStandaloneCodeEditor): void {
  if (tabStore.tabs.length < 2 || !tabStore.activeTabId) return;
  const idx = tabStore.tabs.findIndex((t) => t.id === tabStore.activeTabId);
  const nextIdx = (idx + 1) % tabStore.tabs.length;
  switchTab(editor, tabStore.tabs[nextIdx].id);
}

/**
 * Switch to previous tab (for Ctrl+Shift+Tab).
 */
export function prevTab(editor: monaco.editor.IStandaloneCodeEditor): void {
  if (tabStore.tabs.length < 2 || !tabStore.activeTabId) return;
  const idx = tabStore.tabs.findIndex((t) => t.id === tabStore.activeTabId);
  const prevIdx = (idx - 1 + tabStore.tabs.length) % tabStore.tabs.length;
  switchTab(editor, tabStore.tabs[prevIdx].id);
}

/**
 * Sync Monaco model content changes back to tab state.
 * Wire this to editor.onDidChangeModelContent().
 */
export function onEditorContentChanged(
  editor: monaco.editor.IStandaloneCodeEditor,
  tabId: string
): void {
  const content = editor.getValue();
  updateTabContent(tabId, content);
}
