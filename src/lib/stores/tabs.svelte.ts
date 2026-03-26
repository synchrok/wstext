import * as monaco from 'monaco-editor';
import type { TabState, ViewMode, Encoding } from '../types';

/** Generate a simple UUID-like ID */
function generateId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Reactive tab state — Svelte 5 runes.
 * NOTE: .svelte.ts extension required for $state runes.
 */

/** All open tabs */
export let tabs = $state<TabState[]>([]);

/** ID of the currently active tab */
export let activeTabId = $state<string | null>(null);

/** View state cache: tabId → Monaco editor view state (cursor/scroll) */
const viewStateCache = new Map<string, monaco.editor.ICodeEditorViewState | null>();

/** Monaco model cache: tabId → ITextModel */
const modelCache = new Map<string, monaco.editor.ITextModel>();

/** Derived: the currently active tab object */
export const activeTab = $derived(tabs.find((t) => t.id === activeTabId) ?? null);

/**
 * Open a new tab with the given content.
 * Returns the new tab's ID.
 */
export function openTab(tabData: Omit<TabState, 'id'>): string {
  const id = generateId();
  const tab: TabState = { ...tabData, id };

  // Create Monaco model for this tab
  const uri = tab.filePath
    ? monaco.Uri.parse(`file:///${tab.filePath.replace(/\\/g, '/')}`)
    : monaco.Uri.parse(`untitled:///${id}`);

  // Check if a model already exists for this URI (shouldn't happen but defensive)
  let model = monaco.editor.getModel(uri);
  if (!model) {
    model = monaco.editor.createModel(tab.content, tab.language, uri);
    if (tab.isLargeFile) {
      model.updateOptions({ tabSize: 4 });
    }
  }
  modelCache.set(id, model);

  tabs.push(tab);
  activeTabId = id;
  return id;
}

/**
 * Switch to a different tab.
 * Saves the current tab's view state and restores the target tab's.
 */
export function switchTab(editor: monaco.editor.IStandaloneCodeEditor, tabId: string): void {
  if (tabId === activeTabId) return;

  // Save current view state
  if (activeTabId) {
    viewStateCache.set(activeTabId, editor.saveViewState());
  }

  activeTabId = tabId;

  // Switch Monaco model
  const model = modelCache.get(tabId);
  if (model) {
    editor.setModel(model);
    // Restore view state
    const vs = viewStateCache.get(tabId);
    if (vs) {
      editor.restoreViewState(vs);
    }
    editor.focus();
  }
}

/**
 * Close a tab. Disposes Monaco model and removes from tabs.
 * If there's only one tab and it has no content, just clear it instead.
 */
export function closeTab(editor: monaco.editor.IStandaloneCodeEditor, tabId: string): void {
  const idx = tabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return;

  // Dispose model
  const model = modelCache.get(tabId);
  if (model) {
    model.dispose();
    modelCache.delete(tabId);
  }
  viewStateCache.delete(tabId);

  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    activeTabId = null;
    // Clear editor
    const emptyModel = monaco.editor.createModel('', 'plaintext');
    editor.setModel(emptyModel);
    return;
  }

  // Switch to nearest tab
  const newIdx = Math.min(idx, tabs.length - 1);
  const newTabId = tabs[newIdx].id;
  activeTabId = newTabId;

  const newModel = modelCache.get(newTabId);
  if (newModel) {
    editor.setModel(newModel);
    const vs = viewStateCache.get(newTabId);
    if (vs) editor.restoreViewState(vs);
  }
}

/**
 * Update a tab's content and mark it as dirty.
 */
export function updateTabContent(tabId: string, content: string): void {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.content = content;
    tab.isDirty = true;
  }
}

/**
 * Mark a tab as clean (after save).
 */
export function markTabClean(tabId: string, newPath?: string, newTitle?: string): void {
  const tab = tabs.find((t) => t.id === tabId);
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
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.cursor = { line, column };
  }
}

/**
 * Update tab view mode (editor/preview/split).
 */
export function updateTabViewMode(tabId: string, mode: ViewMode): void {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) tab.viewMode = mode;
}

/**
 * Update tab language.
 */
export function updateTabLanguage(tabId: string, language: string): void {
  const tab = tabs.find((t) => t.id === tabId);
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
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.encoding = encoding;
    tab.hasBOM = hasBOM;
    tab.isDirty = true; // Mark dirty since save behavior changes
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
  if (tabs.length < 2 || !activeTabId) return;
  const idx = tabs.findIndex((t) => t.id === activeTabId);
  const nextIdx = (idx + 1) % tabs.length;
  switchTab(editor, tabs[nextIdx].id);
}

/**
 * Switch to previous tab (for Ctrl+Shift+Tab).
 */
export function prevTab(editor: monaco.editor.IStandaloneCodeEditor): void {
  if (tabs.length < 2 || !activeTabId) return;
  const idx = tabs.findIndex((t) => t.id === activeTabId);
  const prevIdx = (idx - 1 + tabs.length) % tabs.length;
  switchTab(editor, tabs[prevIdx].id);
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
