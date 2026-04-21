import * as monaco from 'monaco-editor';

// Unicode checkbox characters used in the editor model
export const UNCHECKED = '☐';
export const CHECKED = '☑';

// Regex for display format (in editor)
const DISPLAY_TODO_REGEX = /[☐☑]/g;

/** Whether [v] is also recognized as checked */
let _supportV = true;

export function setSupportBracketV(enabled: boolean): void {
  _supportV = enabled;
}

/** Build the file-format regex based on current settings */
function getFileRegex(): RegExp {
  return _supportV ? /\[([ xv]?)\] ?/g : /\[([ x]?)\] ?/g;
}

/** Convert file format → display format (for loading into editor) */
export function fileToDisplay(text: string): string {
  return text.replace(getFileRegex(), (_, c) =>
    (c === 'x' || (_supportV && c === 'v')) ? CHECKED : UNCHECKED
  );
}

/** Convert display format → file format (for saving to disk) — always saves as [x] */
export function displayToFile(text: string): string {
  return text.replace(DISPLAY_TODO_REGEX, (c) => c === CHECKED ? '[x] ' : '[ ] ');
}

export class TodoManager {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private decorationIds: string[] = [];
  private disposables: monaco.IDisposable[] = [];
  private isReplacing = false;
  private _editorDom: HTMLElement | null = null;
  private _copyHandler: EventListener | null = null;

  /** Check if current model is markdown — skip native checkboxes for md */
  private isMarkdown(): boolean {
    const model = this.editor.getModel();
    if (!model) return false;
    const lang = model.getLanguageId();
    return lang === 'markdown' || lang === 'mdx';
  }

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;

    // On content change: auto-convert any [] or [ ] or [x] typed by user → ☐/☑
    const contentDisposable = editor.onDidChangeModelContent(() => {
      if (this.isReplacing) return;
      if (this.isMarkdown()) return; // md files use standard [ ]/[x] syntax
      this.autoReplace();
      this.refreshDecorations();
    });

    // Click on checkbox → toggle
    const mouseDisposable = editor.onMouseDown((e) => this.handleClick(e));

    // Backspace at right of checkbox → delete it (leave nothing or [)
    const keyDisposable = editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Backspace && !e.ctrlKey && !e.shiftKey) {
        if (this.handleBackspace()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    // Ctrl+Enter — toggle checkbox(es) on selected lines
    const toggleAction = editor.addAction({
      id: 'wstext.toggleTodo',
      label: 'Toggle Checkbox',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => this.toggleLines(),
    });

    // Intercept copy/cut → convert ☐/☑ back to [ ]/[x] in clipboard
    const copyHandler = (e: ClipboardEvent) => {
      const selection = this.editor.getSelection();
      if (!selection || selection.isEmpty()) return;
      const model = this.editor.getModel();
      if (!model) return;
      const selectedText = model.getValueInRange(selection);
      // Only intercept if selection contains checkbox chars
      if (selectedText.includes(UNCHECKED) || selectedText.includes(CHECKED)) {
        e.preventDefault();
        const converted = displayToFile(selectedText);
        e.clipboardData?.setData('text/plain', converted);
      }
    };
    const editorDom = this.editor.getDomNode();
    if (editorDom) {
      editorDom.addEventListener('copy', copyHandler as EventListener);
      editorDom.addEventListener('cut', copyHandler as EventListener);
    }

    this.disposables.push(contentDisposable, mouseDisposable, keyDisposable, toggleAction);
    // Store DOM ref for cleanup
    this._editorDom = editorDom;
    this._copyHandler = copyHandler as EventListener;

    // Initial decoration pass
    this.refreshDecorations();
  }

  /** Auto-replace any file-format checkboxes the user typed with unicode chars */
  private autoReplace(): void {
    const model = this.editor.getModel();
    if (!model) return;

    const text = model.getValue();
    const regex = getFileRegex();
    const edits: { range: monaco.Range; text: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + match[0].length);
      const replacement = (match[1] === 'x' || (_supportV && match[1] === 'v')) ? CHECKED : UNCHECKED;
      edits.push({
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        text: replacement,
      });
    }

    if (edits.length > 0) {
      this.isReplacing = true;
      model.pushEditOperations([], edits, () => null);
      this.isReplacing = false;
    }
  }

  private replaceModelText(nextText: string): void {
    const model = this.editor.getModel();
    if (!model) return;

    const currentText = model.getValue();
    if (currentText === nextText) return;

    this.isReplacing = true;
    try {
      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: nextText }],
        () => null
      );
    } finally {
      this.isReplacing = false;
    }
  }

  /** Convert ☐/☑ back to [ ]/[x] in the current model */
  revertToFileFormat(): void {
    const model = this.editor.getModel();
    if (!model) return;
    this.replaceModelText(displayToFile(model.getValue()));
  }

  /** Convert [ ]/[x] in the current model to ☐/☑ */
  convertToDisplayFormat(): void {
    const model = this.editor.getModel();
    if (!model) return;
    this.replaceModelText(fileToDisplay(model.getValue()));
  }

  /** Apply color decorations to ☐ and ☑ characters */
  refreshDecorations(): void {
    const model = this.editor.getModel();
    if (!model) { this.decorationIds = []; return; }
    // Skip decorations for markdown files
    if (this.isMarkdown()) {
      this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
      return;
    }

    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    const lineCount = model.getLineCount();

    for (let line = 1; line <= lineCount; line++) {
      const lineContent = model.getLineContent(line);
      // Collect all checkbox positions on this line
      const boxes: { col: number; checked: boolean }[] = [];
      for (let i = 0; i < lineContent.length; i++) {
        if (lineContent[i] === UNCHECKED) boxes.push({ col: i + 1, checked: false });
        else if (lineContent[i] === CHECKED) boxes.push({ col: i + 1, checked: true });
      }

      for (let b = 0; b < boxes.length; b++) {
        const box = boxes[b];
        // Color the checkbox character
        decorations.push({
          range: new monaco.Range(line, box.col, line, box.col + 1),
          options: {
            inlineClassName: box.checked ? 'todo-checked' : 'todo-unchecked',
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });

        // Semi-transparent text after checked checkbox — only until next checkbox or line end
        if (box.checked) {
          const textStart = box.col + 1;
          const textEnd = (b + 1 < boxes.length) ? boxes[b + 1].col : model.getLineMaxColumn(line);
          if (textStart < textEnd) {
            decorations.push({
              range: new monaco.Range(line, textStart, line, textEnd),
              options: {
                inlineClassName: 'todo-checked-text',
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              },
            });
          }
        }
      }
    }

    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, decorations);
  }

  private handleClick(e: monaco.editor.IEditorMouseEvent): void {
    if (!e.target.position) return;
    const model = this.editor.getModel();
    if (!model) return;
    const pos = e.target.position;
    const lineContent = model.getLineContent(pos.lineNumber);
    const charIndex = pos.column - 1;
    const char = lineContent[charIndex];

    if (char === UNCHECKED || char === CHECKED) {
      const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + 1);
      const newChar = char === UNCHECKED ? CHECKED : UNCHECKED;
      this.isReplacing = true;
      model.pushEditOperations([], [{ range, text: newChar }], () => null);
      this.isReplacing = false;
      this.refreshDecorations();
    }
  }

  private toggleLines(): void {
    const model = this.editor.getModel();
    if (!model) return;
    const selection = this.editor.getSelection();
    if (!selection) return;

    const isMultiLine = selection.startLineNumber !== selection.endLineNumber ||
                        selection.startColumn !== selection.endColumn;
    const edits: { range: monaco.Range; text: string }[] = [];

    if (isMultiLine) {
      // Multi-line/range selection: toggle ALL checkboxes in selected lines
      for (let line = selection.startLineNumber; line <= selection.endLineNumber; line++) {
        const lineContent = model.getLineContent(line);
        for (let i = 0; i < lineContent.length; i++) {
          if (lineContent[i] === UNCHECKED || lineContent[i] === CHECKED) {
            const range = new monaco.Range(line, i + 1, line, i + 2);
            edits.push({ range, text: lineContent[i] === UNCHECKED ? CHECKED : UNCHECKED });
          }
        }
      }
    } else {
      // Single cursor: toggle the nearest checkbox on this line
      const pos = this.editor.getPosition();
      if (!pos) return;
      const lineContent = model.getLineContent(pos.lineNumber);

      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < lineContent.length; i++) {
        if (lineContent[i] === UNCHECKED || lineContent[i] === CHECKED) {
          const dist = Math.abs((i + 1) - pos.column);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        }
      }

      if (bestIdx >= 0) {
        const range = new monaco.Range(pos.lineNumber, bestIdx + 1, pos.lineNumber, bestIdx + 2);
        edits.push({ range, text: lineContent[bestIdx] === UNCHECKED ? CHECKED : UNCHECKED });
      }
    }

    if (edits.length > 0) {
      this.isReplacing = true;
      model.pushEditOperations([], edits, () => null);
      this.isReplacing = false;
      this.refreshDecorations();
    }
  }

  private handleBackspace(): boolean {
    const model = this.editor.getModel();
    if (!model) return false;
    const pos = this.editor.getPosition();
    if (!pos || pos.column <= 1) return false;

    const lineContent = model.getLineContent(pos.lineNumber);
    const charBefore = lineContent[pos.column - 2]; // char before cursor
    if (charBefore === UNCHECKED || charBefore === CHECKED) {
      // Delete the checkbox character
      const range = new monaco.Range(pos.lineNumber, pos.column - 1, pos.lineNumber, pos.column);
      model.pushEditOperations([], [{ range, text: '' }], () => null);
      return true;
    }
    return false;
  }

  dispose(): void {
    if (this._editorDom && this._copyHandler) {
      this._editorDom.removeEventListener('copy', this._copyHandler);
      this._editorDom.removeEventListener('cut', this._copyHandler);
    }
    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

/** Inject CSS for checkbox coloring (NOT hiding — they're real chars now) */
export function injectTodoStyles(): void {
  if (document.getElementById('wstext-todo-styles')) return;
  const style = document.createElement('style');
  style.id = 'wstext-todo-styles';
  style.textContent = `
    .todo-unchecked { color: #4fc3f7 !important; cursor: pointer; margin-right: 0.25em; }
    .todo-checked { color: #66bb6a !important; cursor: pointer; margin-right: 0.25em; }
    .todo-checked-text { opacity: 0.4; }
  `;
  document.head.appendChild(style);
}
