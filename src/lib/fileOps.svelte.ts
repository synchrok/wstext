import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { readFile, stat } from '@tauri-apps/plugin-fs';
import type { TabState } from './types';
import { displayToFile, fileToDisplay } from './todo';
import { readFileWithEncoding, writeFileWithEncoding } from './utils/encoding';
import { isBinaryFile } from './utils/binaryDetection';
import { detectLanguage } from './utils/fileLanguage';
import { addRecentFile } from './stores/settings.svelte';
import { tabStore } from './stores/tabs.svelte';

/** Emit a notification toast — simple wrapper */
function showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
  window.dispatchEvent(new CustomEvent('wstext:notification', { detail: { message, type } }));
}

/** Counter for untitled file numbering */
let untitledCounter = $state(0);

/** setActiveTab function — needs editor reference, provided by App.svelte */
let _setActiveTab: ((tabId: string) => void) | null = null;
let _openTabFn: ((tab: Omit<TabState, 'id'>) => string) | null = null;

/**
 * Register the tab management functions.
 * Called by App.svelte once editor is ready.
 */
export function registerTabFunctions(
  openTabFn: (tab: Omit<TabState, 'id'>) => string,
  setActiveTabFn: (tabId: string) => void
): void {
  _openTabFn = openTabFn;
  _setActiveTab = setActiveTabFn;
}

/** Create a new empty untitled tab. */
export function newFile(): string | null {
  if (!_openTabFn) return null;
  untitledCounter++;

  const tabId = _openTabFn({
    filePath: null,
    title: `Untitled-${untitledCounter}`,
    content: '',
    isDirty: false,
    cursor: { line: 1, column: 1 },
    scrollTop: 0,
    viewMode: 'editor',
    encoding: 'utf-8',
    hasBOM: false,
    language: 'plaintext'
  });

  if (_setActiveTab) _setActiveTab(tabId);

  return tabId;
}

/** Open a file via native file picker dialog. */
export async function openFile(): Promise<string | null> {
  const path = await open({
    multiple: false,
    filters: [
      {
        name: 'All Files',
        extensions: ['*']
      },
      {
        name: 'Text Files',
        extensions: ['txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml', 'html', 'css', 'scss', 'rs', 'go', 'py']
      }
    ]
  });

  if (path === null || Array.isArray(path)) return null;
  return openFileByPath(path);
}

/** Open a specific file by path (called from drag-drop or session restore). */
export async function openFileByPath(path: string): Promise<string | null> {
  if (!_openTabFn) return null;

  // Check if already open — normalize path comparison
  const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
  const existing = tabStore.tabs.find(
    (t) => t.filePath !== null && t.filePath.replace(/\\/g, '/').toLowerCase() === normalizedPath
  );
  if (existing) {
    if (_setActiveTab) _setActiveTab(existing.id);
    return existing.id;
  }

  try {
    // Read raw bytes (NEVER readTextFile — UTF-8 only)
    const bytes = await readFile(path);

    // Check binary
    if (isBinaryFile(bytes)) {
      showNotification('이 파일은 바이너리 파일입니다. 표시할 수 없습니다.', 'error');
      return null;
    }

    // Large file policy
    const sizeMB = bytes.length / (1024 * 1024);
    const isLargeFile = sizeMB > 5;
    if (sizeMB > 50) {
      showNotification(`파일이 너무 큽니다 (${sizeMB.toFixed(1)}MB). 50MB 이하 파일만 열 수 있습니다.`, 'error');
      return null;
    }
    if (isLargeFile) {
      showNotification(`큰 파일입니다 (${sizeMB.toFixed(1)}MB). 미니맵과 일부 기능이 비활성화됩니다.`, 'warning');
    }

    // Decode with encoding detection
    const { content, encoding, hasBOM } = await readFileWithEncoding(path);

    // Detect language from extension
    const language = detectLanguage(path);
    const fileName = path.split(/[/\\]/).pop() ?? path;

    const tabId = _openTabFn({
      filePath: path,
      title: fileName,
      content: language === 'markdown' ? content : fileToDisplay(content),
      isDirty: false,
      cursor: { line: 1, column: 1 },
      scrollTop: 0,
      viewMode: language === 'markdown' ? 'split' : 'editor',
      encoding,
      hasBOM,
      language,
      isLargeFile
    });

    if (_setActiveTab) _setActiveTab(tabId);
    void addRecentFile(path);

    return tabId;
  } catch (err) {
    showNotification(`파일을 열 수 없습니다: ${err instanceof Error ? err.message : String(err)}`, 'error');
    return null;
  }
}

/** Save the current tab to its file path. If untitled, opens SaveAs dialog. */
export async function saveFile(tab: TabState): Promise<boolean> {
  if (tab.filePath === null) {
    return saveFileAs(tab);
  }

  try {
    const isMarkdown = tab.language === 'markdown';
    const output = isMarkdown ? tab.content : displayToFile(tab.content);
    await writeFileWithEncoding(tab.filePath, output, tab.encoding, tab.hasBOM);
    return true;
  } catch (err) {
    showNotification(`저장 실패: ${err instanceof Error ? err.message : String(err)}`, 'error');
    return false;
  }
}

/** Save file via native Save As dialog. Returns true if saved, false if cancelled/failed. */
export async function saveFileAs(tab: TabState): Promise<boolean> {
  const suggestedName = tab.filePath ? (tab.filePath.split(/[/\\]/).pop() ?? tab.title) : `${tab.title}.txt`;

  const path = await save({
    defaultPath: suggestedName,
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Text Files', extensions: ['txt', 'md', 'ts', 'js', 'json'] }
    ]
  });

  if (path === null) return false;

  try {
    const isMarkdown = tab.language === 'markdown';
    const output = isMarkdown ? tab.content : displayToFile(tab.content);
    await writeFileWithEncoding(path, output, tab.encoding, tab.hasBOM);

    // Notify tab store to update path/title and clear dirty state
    window.dispatchEvent(
      new CustomEvent('wstext:tab-saved-as', {
        detail: { tabId: tab.id, newPath: path }
      })
    );
    return true;
  } catch (err) {
    showNotification(`저장 실패: ${err instanceof Error ? err.message : String(err)}`, 'error');
    return false;
  }
}

let fileDropRegistered = false;

/** Set up file drag-and-drop handling on the Tauri webview. */
export async function setupFileDrop(): Promise<void> {
  if (fileDropRegistered) return; // Prevent duplicate registration (HMR)
  fileDropRegistered = true;
  try {
    const webview = getCurrentWebview();
    await webview.onDragDropEvent((event) => {
      if (event.payload.type === 'drop') {
        const paths = event.payload.paths ?? [];
        for (const path of paths) {
          void handleDroppedPath(path);
        }
      }
    });
  } catch {
    // File drop not critical — fail silently
  }
}

/**
 * Route a dropped path: directories → folder sidebar, files → editor tab.
 */
async function handleDroppedPath(path: string): Promise<void> {
  try {
    const info = await stat(path);
    if (info.isDirectory) {
      window.dispatchEvent(
        new CustomEvent('wstext:drop-folder', { detail: path })
      );
    } else {
      void openFileByPath(path);
    }
  } catch {
    // stat failed — try opening as file (fallback)
    void openFileByPath(path);
  }
}
