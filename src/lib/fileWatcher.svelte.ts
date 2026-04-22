import { stat } from '@tauri-apps/plugin-fs';
import { confirm } from '@tauri-apps/plugin-dialog';
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

const POLL_INTERVAL_MS = 1500;
const SELF_SAVE_IGNORE_MS = 2000;

function isMarkdownLanguage(language: string): boolean {
  return language === 'markdown' || language === 'mdx';
}

export class FileWatcher {
  private mtimeByTabId = new Map<string, number>();
  private selfSaveUntil = new Map<string, number>();
  private pendingReloads = new Set<string>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private trackedTabs = new Map<string, string>(); // tabId → filePath

  constructor(private options: FileWatcherOptions) {
    this.intervalId = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  reconcile(tabs: TabState[]): void {
    this.trackedTabs.clear();
    for (const tab of tabs) {
      if (tab.filePath) {
        this.trackedTabs.set(tab.id, tab.filePath);
      }
    }
  }

  markSelfSave(_tabId: string, filePath?: string | null): void {
    if (!filePath) return;
    this.selfSaveUntil.set(filePath, Date.now() + SELF_SAVE_IGNORE_MS);
  }

  dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.mtimeByTabId.clear();
    this.selfSaveUntil.clear();
    this.trackedTabs.clear();
    this.pendingReloads.clear();
  }

  private async poll(): Promise<void> {
    for (const [tabId, filePath] of this.trackedTabs) {
      if (this.pendingReloads.has(tabId)) continue;

      try {
        const info = await stat(filePath);
        const mtime = info.mtime instanceof Date ? info.mtime.getTime() : 0;

        const prevMtime = this.mtimeByTabId.get(tabId);
        this.mtimeByTabId.set(tabId, mtime);

        // Skip first poll (just record mtime)
        if (prevMtime === undefined) continue;
        // No change
        if (mtime === prevMtime) continue;
        // Self-save guard
        const ignoreUntil = this.selfSaveUntil.get(filePath);
        if (ignoreUntil && ignoreUntil > Date.now()) continue;

        this.selfSaveUntil.delete(filePath);
        await this.handleChange(tabId);
      } catch {
        // File might not exist yet or be inaccessible
      }
    }
  }

  private async handleChange(tabId: string): Promise<void> {
    const tab = this.options.getTab(tabId);
    if (!tab?.filePath) return;

    this.pendingReloads.add(tabId);
    try {
      if (tab.isDirty) {
        const shouldReload = await confirm(
          '이 파일이 외부에서 변경되었습니다. 다시 불러올까요?\n저장하지 않은 수정사항이 사라집니다.',
          { title: tab.title, kind: 'warning', okLabel: '예', cancelLabel: '아니오' }
        );
        if (!shouldReload) return;
      }

      const { content, encoding, hasBOM } = await readFileWithEncoding(tab.filePath);
      await this.options.onReload(tabId, {
        content: isMarkdownLanguage(tab.language) ? content : fileToDisplay(content),
        encoding,
        hasBOM,
      });
      // Update mtime after reload
      try {
        const info = await stat(tab.filePath);
        this.mtimeByTabId.set(tabId, info.mtime instanceof Date ? info.mtime.getTime() : 0);
      } catch {}
    } catch (err) {
      this.options.onError(
        `외부 변경 내용을 다시 불러오지 못했습니다: ${tab.title} (${err instanceof Error ? err.message : String(err)})`
      );
    } finally {
      this.pendingReloads.delete(tabId);
    }
  }
}
