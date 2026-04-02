import * as monaco from 'monaco-editor';

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 40;
const ZOOM_STEP = 2;

/**
 * Zoom in by increasing font size.
 */
export function zoomIn(editor: monaco.editor.IStandaloneCodeEditor): number {
  const current = editor.getOption(monaco.editor.EditorOption.fontSize);
  const newSize = Math.min(current + ZOOM_STEP, MAX_FONT_SIZE);
  editor.updateOptions({ fontSize: newSize });
  return newSize;
}

/**
 * Zoom out by decreasing font size.
 */
export function zoomOut(editor: monaco.editor.IStandaloneCodeEditor): number {
  const current = editor.getOption(monaco.editor.EditorOption.fontSize);
  const newSize = Math.max(current - ZOOM_STEP, MIN_FONT_SIZE);
  editor.updateOptions({ fontSize: newSize });
  return newSize;
}

/**
 * Reset zoom to default font size.
 */
export function resetZoom(editor: monaco.editor.IStandaloneCodeEditor): number {
  editor.updateOptions({ fontSize: DEFAULT_FONT_SIZE });
  return DEFAULT_FONT_SIZE;
}

/**
 * Set a specific font size.
 */
export function setFontSize(editor: monaco.editor.IStandaloneCodeEditor, size: number): number {
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  editor.updateOptions({ fontSize: clamped });
  return clamped;
}

/**
 * Get current font size.
 */
export function getFontSize(editor: monaco.editor.IStandaloneCodeEditor): number {
  return editor.getOption(monaco.editor.EditorOption.fontSize);
}

/**
 * Set up Ctrl+mousewheel zoom.
 * Uses window-level capture to intercept BEFORE Tauri WebView handles page zoom.
 * Returns cleanup function to remove the event listener.
 */
export function setupMouseWheelZoom(
  editor: monaco.editor.IStandaloneCodeEditor,
  onFontSizeChange: (size: number) => void
): () => void {
  const handleWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();

    const newSize = e.deltaY < 0
      ? zoomIn(editor)
      : zoomOut(editor);

    onFontSizeChange(newSize);
  };

  // Window-level capture phase — intercepts before WebView2 page zoom
  window.addEventListener('wheel', handleWheel, { passive: false, capture: true });

  return () => {
    window.removeEventListener('wheel', handleWheel, { capture: true });
  };
}

/**
 * Set font family on the editor.
 */
export function setFontFamily(
  editor: monaco.editor.IStandaloneCodeEditor,
  fontFamily: string
): void {
  editor.updateOptions({ fontFamily });
}

/**
 * Set tab size on all models or the active model.
 * If model is provided, updates that model only. Otherwise updates editor defaults.
 */
export function setTabSize(
  editor: monaco.editor.IStandaloneCodeEditor,
  tabSize: 2 | 4,
  model?: monaco.editor.ITextModel
): void {
  const target = model ?? editor.getModel();
  if (target) {
    target.updateOptions({ tabSize, insertSpaces: true });
  }
  editor.updateOptions({ tabSize });
}

/** Available monospace fonts for the font picker. */
export const MONOSPACE_FONTS: readonly string[] = [
  'Consolas',
  'Monaco',
  'Menlo',
  "'Cascadia Code'",
  "'Fira Code'",
  "'JetBrains Mono'",
  "'Source Code Pro'",
  "'Courier New'",
  'monospace',
] as const;
