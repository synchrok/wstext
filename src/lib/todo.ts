import * as monaco from 'monaco-editor';

export const UNCHECKED = '☐';
export const CHECKED = '☑';

const DISPLAY_TODO_REGEX = /[☐☑]/g;

/** Whether [v] is also recognized as checked */
let _supportV = true;
let _copyAsCheckbox = false;

export function setSupportBracketV(enabled: boolean): void {
  _supportV = enabled;
}

export function setCopyAsCheckbox(enabled: boolean): void {
  _copyAsCheckbox = enabled;
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
  // Use createDecorationsCollection — manual decorationIds + deltaDecorations
  // goes stale on tab/model switch and causes inline classes to silently detach
  // (the "white checkbox" bug). Collection auto-tracks model lifecycle.
  private decorationsCollection: monaco.editor.IEditorDecorationsCollection;
  private disposables: monaco.IDisposable[] = [];
  private isReplacing = false;
  private _editorDom: HTMLElement | null = null;
  private _copyHandler: EventListener | null = null;
  private lastDecorationKey: string = '';

  /** Only plaintext files participate in todo behavior (auto-convert + decorations) */
  private isPlaintext(): boolean {
    const model = this.editor.getModel();
    if (!model) return false;
    return model.getLanguageId() === 'plaintext';
  }

  private shouldConvertCheckboxes(): boolean {
    return this.isPlaintext();
  }

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
    this.decorationsCollection = editor.createDecorationsCollection();

    // On content change: auto-convert any [] or [ ] or [x] typed by user → ☐/☑
    const contentDisposable = editor.onDidChangeModelContent(() => {
      if (this.isReplacing) return;
      if (!this.shouldConvertCheckboxes()) return;
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

    // Override Ctrl+C / Ctrl+X to convert ☐/☑ → [ ]/[x]
    // Get text from editor (selection or current line)
    const getEditorText = (): string => {
      const model = this.editor.getModel();
      if (!model) return '';
      const selection = this.editor.getSelection();
      if (!selection || selection.isEmpty()) {
        const pos = this.editor.getPosition();
        if (!pos) return '';
        return model.getLineContent(pos.lineNumber) + model.getEOL();
      }
      return model.getValueInRange(selection);
    };

    const copyOverride = editor.addAction({
      id: 'wstext.copy',
      label: 'Copy',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC],
      run: () => {
        let text = getEditorText();
        if (!text) return;
        // Convert only when setting is OFF (default)
        if (!_copyAsCheckbox) {
          text = displayToFile(text);
        }
        navigator.clipboard.writeText(text);
      },
    });

    const cutOverride = editor.addAction({
      id: 'wstext.cut',
      label: 'Cut',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX],
      run: () => {
        let text = getEditorText();
        if (!text) return;
        if (!_copyAsCheckbox) {
          text = displayToFile(text);
        }
        navigator.clipboard.writeText(text);
        // Delete selection or current line
        const selection = editor.getSelection();
        if (selection && !selection.isEmpty()) {
          editor.executeEdits('wstext.cut', [{ range: selection, text: '' }]);
        } else {
          const pos = editor.getPosition();
          if (pos) {
            const model = editor.getModel();
            if (model) {
              const lineNum = pos.lineNumber;
              const totalLines = model.getLineCount();
              if (totalLines === 1) {
                const range = model.getFullModelRange();
                editor.executeEdits('wstext.cut', [{ range, text: '' }]);
              } else {
                const startLine = lineNum;
                const endLine = lineNum < totalLines ? lineNum + 1 : lineNum;
                const range = new monaco.Range(
                  startLine, 1,
                  endLine, endLine === lineNum ? model.getLineMaxColumn(endLine) : 1
                );
                editor.executeEdits('wstext.cut', [{ range, text: '' }]);
              }
            }
          }
        }
      },
    });

    this.disposables.push(contentDisposable, mouseDisposable, keyDisposable, toggleAction, copyOverride, cutOverride);
    this._editorDom = null;
    this._copyHandler = null;

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

  /**
   * Apply color decorations to ☐ and ☑ characters.
   *
   * @param force Skip the layout-key short-circuit and re-apply unconditionally.
   *   Required after `editor.setModel()` (tab switch) — Monaco can drop inline
   *   classes from the previous render of a reused model, leaving checkboxes
   *   visually unstyled until the next edit. Caching by content key would
   *   silently skip the re-application because the key is unchanged.
   */
  refreshDecorations(force: boolean = false): void {
    const model = this.editor.getModel();
    if (!model) {
      this.decorationsCollection.clear();
      this.lastDecorationKey = '';
      return;
    }
    if (force) {
      // Drop the prior decoration ids so the next `set()` is a fresh
      // delta from the editor's POV. Re-issuing the same decorations
      // through the same collection ids can be a no-op for Monaco's
      // view-line renderer when the model was just re-attached.
      this.decorationsCollection.clear();
      this.lastDecorationKey = '';
    }
    // Only plaintext files use unicode checkboxes; other languages must keep their syntax untouched.
    if (!this.isPlaintext()) {
      const nonPlainKey = `np:${model.id}`;
      if (nonPlainKey !== this.lastDecorationKey) {
        this.decorationsCollection.clear();
        this.lastDecorationKey = nonPlainKey;
      }
      return;
    }

    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    const keyParts: string[] = [`m:${model.id}`];
    const lineCount = model.getLineCount();

    for (let line = 1; line <= lineCount; line++) {
      const lineContent = model.getLineContent(line);
      const boxes: { col: number; checked: boolean }[] = [];
      for (let i = 0; i < lineContent.length; i++) {
        if (lineContent[i] === UNCHECKED) boxes.push({ col: i + 1, checked: false });
        else if (lineContent[i] === CHECKED) boxes.push({ col: i + 1, checked: true });
      }
      if (boxes.length === 0) continue;

      // maxCol must always be in the key: when Monaco redraws a view-line on
      // input it can drop our inline classes, and skipping deltaDecorations
      // here would leave the checkbox visually unstyled until the next edit.
      const maxCol = model.getLineMaxColumn(line);
      keyParts.push(
        `${line}@${maxCol}:` + boxes.map(b => `${b.col}${b.checked ? 'C' : 'U'}`).join(',')
      );

      for (let b = 0; b < boxes.length; b++) {
        const box = boxes[b];
        decorations.push({
          range: new monaco.Range(line, box.col, line, box.col + 1),
          options: {
            inlineClassName: box.checked ? 'todo-checked' : 'todo-unchecked',
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });

        if (box.checked) {
          const textStart = box.col + 1;
          const textEnd = (b + 1 < boxes.length) ? boxes[b + 1].col : maxCol;
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

    // Skip when checkbox layout is unchanged: even no-op deltaDecorations
    // triggers Monaco layout passes that amplify macOS WKWebView jitter.
    const key = keyParts.join('|');
    if (key === this.lastDecorationKey) return;
    this.lastDecorationKey = key;
    this.decorationsCollection.set(decorations);
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
    this.decorationsCollection.clear();
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
    .monaco-editor .margin { user-select: none; -webkit-user-select: none; }
    .monaco-editor .line-numbers { user-select: none; -webkit-user-select: none; pointer-events: none; }
  `;
  document.head.appendChild(style);
}
