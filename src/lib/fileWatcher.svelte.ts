import { confirm } from '@tauri-apps/plugin-dialog';
import { watchImmediate, type UnwatchFn, type WatchEvent } from '@tauri-apps/plugin-fs';
import { fileToDisplay } from './todo';
import type { Encoding, TabState } from './types';
import { readFileWithEncoding } from './utils/encoding';

interface ReloadPayload {
  content: string;
  encoding: Encoding;
  hasBOM: boolean;
}

interface FileWatcherOptions {
  getTab: (tabId: string) => TabState | undefined;
  onReload: (tabId: string, payload: ReloadPayload) => Promise<void> | void;
  onError: (message: string) => void;
}

const SELF_SAVE_IGNORE_MS = 1500;

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

function isMarkdownLanguage(language: string): boolean {
  return language === 'markdown' || language === 'mdx';
}

function isRelevantWatchEvent(type: WatchEvent['type']): boolean {
  if (type === 'any') return true;
  if (type === 'other') return true;
  if ('access' in type) return false;
  if ('remove' in type) return false;
  return true;
}

export class FileWatcher {
  private unwatchByTabId = new Map<string, UnwatchFn>();
  private watchedPathByTabId = new Map<string, string>();
  private pendingPathByTabId = new Map<string, string>();
  private pendingReloads = new Set<string>();
  private selfSaveIgnoreUntil = new Map<string, number>();

  constructor(private options: FileWatcherOptions) {}

  async reconcile(tabs: TabState[]): Promise<void> {
    const nextPaths = new Map<string, string>();

    for (const tab of tabs) {
      if (tab.filePath) {
        nextPaths.set(tab.id, normalizePath(tab.filePath));
      }
    }

    for (const [tabId, watchedPath] of Array.from(this.watchedPathByTabId.entries())) {
      const nextPath = nextPaths.get(tabId);
      if (!nextPath || nextPath !== watchedPath) {
        this.unwatchTab(tabId);
      }
    }

    await Promise.all(
      tabs
        .filter((tab) => tab.filePath !== null)
        .map((tab) => this.ensureWatch(tab.id, tab.filePath!))
    );
  }

  markSelfSave(tabId: string, filePath?: string | null): void {
    const resolvedPath = filePath ?? this.options.getTab(tabId)?.filePath;
    if (!resolvedPath) return;
    this.selfSaveIgnoreUntil.set(normalizePath(resolvedPath), Date.now() + SELF_SAVE_IGNORE_MS);
  }

  dispose(): void {
    for (const unwatch of this.unwatchByTabId.values()) {
      unwatch();
    }

    this.unwatchByTabId.clear();
    this.watchedPathByTabId.clear();
    this.pendingPathByTabId.clear();
    this.pendingReloads.clear();
    this.selfSaveIgnoreUntil.clear();
  }

  private async ensureWatch(tabId: string, filePath: string): Promise<void> {
    const normalizedPath = normalizePath(filePath);
    if (this.watchedPathByTabId.get(tabId) === normalizedPath) return;
    if (this.pendingPathByTabId.get(tabId) === normalizedPath) return;

    this.unwatchTab(tabId);
    this.pendingPathByTabId.set(tabId, normalizedPath);

    try {
      const unwatch = await watchImmediate(filePath, (event) => {
        void this.handleWatchEvent(tabId, event);
      });

      if (this.pendingPathByTabId.get(tabId) !== normalizedPath) {
        unwatch();
        return;
      }

      this.unwatchByTabId.set(tabId, unwatch);
      this.watchedPathByTabId.set(tabId, normalizedPath);
    } catch (err) {
      const tab = this.options.getTab(tabId);
      this.options.onError(
        `파일 감시를 시작할 수 없습니다: ${tab?.title ?? filePath} (${err instanceof Error ? err.message : String(err)})`
      );
    } finally {
      if (this.pendingPathByTabId.get(tabId) === normalizedPath) {
        this.pendingPathByTabId.delete(tabId);
      }
    }
  }

  private unwatchTab(tabId: string): void {
    this.unwatchByTabId.get(tabId)?.();
    this.unwatchByTabId.delete(tabId);
    this.watchedPathByTabId.delete(tabId);
    this.pendingPathByTabId.delete(tabId);
    this.pendingReloads.delete(tabId);
  }

  private shouldIgnoreSelfSave(filePath: string): boolean {
    const normalizedPath = normalizePath(filePath);
    const ignoreUntil = this.selfSaveIgnoreUntil.get(normalizedPath);

    if (!ignoreUntil) return false;
    if (ignoreUntil > Date.now()) return true;

    this.selfSaveIgnoreUntil.delete(normalizedPath);
    return false;
  }

  private async handleWatchEvent(tabId: string, event: WatchEvent): Promise<void> {
    const tab = this.options.getTab(tabId);
    if (!tab?.filePath) return;
    if (!isRelevantWatchEvent(event.type)) return;

    const tabPath = normalizePath(tab.filePath);
    if (event.paths.length > 0 && !event.paths.some((path) => normalizePath(path) === tabPath)) {
      return;
    }

    if (this.shouldIgnoreSelfSave(tab.filePath)) return;
    if (this.pendingReloads.has(tabId)) return;

    this.pendingReloads.add(tabId);

    try {
      const latestTab = this.options.getTab(tabId);
      if (!latestTab?.filePath) return;

      if (latestTab.isDirty) {
        const shouldReload = await confirm(
          '이 파일이 외부에서 변경되었습니다. 다시 불러올까요? 저장하지 않은 수정사항이 사라집니다.',
          {
            title: latestTab.title,
            kind: 'warning',
            okLabel: '예',
            cancelLabel: '아니오',
          }
        );

        if (!shouldReload) return;
      }

      const { content, encoding, hasBOM } = await readFileWithEncoding(latestTab.filePath);
      await this.options.onReload(tabId, {
        content: isMarkdownLanguage(latestTab.language) ? content : fileToDisplay(content),
        encoding,
        hasBOM,
      });
    } catch (err) {
      const failedTab = this.options.getTab(tabId);
      this.options.onError(
        `외부 변경 내용을 다시 불러오지 못했습니다: ${failedTab?.title ?? tab.filePath} (${err instanceof Error ? err.message : String(err)})`
      );
    } finally {
      this.pendingReloads.delete(tabId);
    }
  }
}
