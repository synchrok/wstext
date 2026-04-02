import * as monaco from 'monaco-editor';

/** CSS class applied to unchecked `[ ]` todo items — hides brackets, shows checkbox icon. */
export const TODO_UNCHECKED_CLASS = 'todo-unchecked';
/** CSS class applied to checked `[x]` todo items — hides brackets, shows checked icon. */
export const TODO_CHECKED_CLASS = 'todo-checked';
/** CSS class applied to text after a checked item — semi-transparent. */
export const TODO_CHECKED_TEXT_CLASS = 'todo-checked-text';

/** Regex to find todo patterns: [], [ ], or [x] */
const TODO_REGEX = /\[([ x]?)\]/g;

/**
 * Manages todo checkbox decorations for a Monaco editor instance.
 */
export class TodoManager {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private decorationIds: string[] = [];
  private refreshDebounce: ReturnType<typeof setTimeout> | undefined;
  private disposables: monaco.IDisposable[] = [];
  /** Track last cursor column to determine movement direction */
  private lastCursorColumn = 0;

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
    this.refresh();

    // Re-apply decorations when content changes
    const contentDisposable = editor.onDidChangeModelContent(() => {
      if (this.refreshDebounce !== undefined) clearTimeout(this.refreshDebounce);
      this.refreshDebounce = setTimeout(() => {
        this.refresh();
        this.refreshDebounce = undefined;
      }, 100);
    });

    // Handle clicks on todo decorations
    const mouseDisposable = editor.onMouseDown((e) => {
      this.handleClick(e);
    });

    // Cursor skip: treat checkbox as single atomic unit
    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      if (e.reason === monaco.editor.CursorChangeReason.Explicit) {
        this.handleCursorSkip(e);
      }
      this.lastCursorColumn = e.position.column;
    });

    // Ctrl+Enter — toggle checkbox on current line
    const toggleAction = editor.addAction({
      id: 'wstext.toggleTodo',
      label: 'Toggle Checkbox',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => this.toggleCurrentLine(),
    });

    this.disposables.push(contentDisposable, mouseDisposable, cursorDisposable, toggleAction);
  }

  /** Apply decorations for all todo patterns in the current model. */
  refresh(): void {
    const model = this.editor.getModel();
    if (!model) {
      this.decorationIds = [];
      return;
    }

    const text = model.getValue();
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];

    let match: RegExpExecArray | null;
    TODO_REGEX.lastIndex = 0;

    while ((match = TODO_REGEX.exec(text)) !== null) {
      const isChecked = match[1] === 'x';
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + match[0].length);

      decorations.push({
        range: new monaco.Range(
          startPos.lineNumber, startPos.column,
          endPos.lineNumber, endPos.column
        ),
        options: {
          inlineClassName: isChecked ? TODO_CHECKED_CLASS : TODO_UNCHECKED_CLASS,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });

      if (isChecked) {
        const lineMaxCol = model.getLineMaxColumn(startPos.lineNumber);
        if (endPos.column < lineMaxCol) {
          decorations.push({
            range: new monaco.Range(
              startPos.lineNumber, endPos.column,
              startPos.lineNumber, lineMaxCol
            ),
            options: {
              inlineClassName: TODO_CHECKED_TEXT_CLASS,
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            },
          });
        }
      }
    }

    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, decorations);
  }

  /** Handle mouse click — toggle todo if click lands on a decoration. */
  private handleClick(e: monaco.editor.IEditorMouseEvent): void {
    if (!e.target.position) return;
    const pos = e.target.position;
    const model = this.editor.getModel();
    if (!model) return;

    const decorationsAtPos = model.getDecorationsInRange(
      new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + 1)
    );

    const todoDecoration = decorationsAtPos?.find(
      d => d.options.inlineClassName === TODO_UNCHECKED_CLASS ||
           d.options.inlineClassName === TODO_CHECKED_CLASS
    );

    if (!todoDecoration) return;
    this.toggleRange(todoDecoration.range);
  }

  /** Toggle checkbox on the current cursor line (Ctrl+Enter). */
  private toggleCurrentLine(): void {
    const model = this.editor.getModel();
    if (!model) return;
    const pos = this.editor.getPosition();
    if (!pos) return;

    // Find a checkbox decoration on this line
    const lineDecos = model.getLineDecorations(pos.lineNumber);
    const todoDeco = lineDecos?.find(
      d => d.options.inlineClassName === TODO_UNCHECKED_CLASS ||
           d.options.inlineClassName === TODO_CHECKED_CLASS
    );

    if (todoDeco) {
      this.toggleRange(todoDeco.range);
    }
  }

  /** Toggle a checkbox range between checked/unchecked. */
  private toggleRange(range: monaco.Range): void {
    const model = this.editor.getModel();
    if (!model) return;
    const currentText = model.getValueInRange(range);
    const newText = (currentText === '[ ]' || currentText === '[]') ? '[x]' : '[ ]';
    model.pushEditOperations([], [{ range, text: newText }], () => null);
  }

  /** Skip cursor over checkbox ranges — direction-aware. */
  private handleCursorSkip(e: monaco.editor.ICursorPositionChangedEvent): void {
    const model = this.editor.getModel();
    if (!model) return;
    const pos = e.position;

    for (const id of this.decorationIds) {
      const deco = model.getDecorationRange(id);
      if (!deco) continue;
      const opts = model.getDecorationOptions(id);
      if (!opts || (opts.inlineClassName !== TODO_UNCHECKED_CLASS && opts.inlineClassName !== TODO_CHECKED_CLASS)) continue;

      // Cursor strictly inside checkbox range
      if (pos.lineNumber === deco.startLineNumber &&
          pos.column > deco.startColumn &&
          pos.column < deco.endColumn) {
        // Use previous position to determine direction
        const movingLeft = pos.column < this.lastCursorColumn;
        const targetCol = movingLeft ? deco.startColumn : deco.endColumn;
        this.editor.setPosition({ lineNumber: pos.lineNumber, column: targetCol });
        return;
      }
    }
  }

  dispose(): void {
    if (this.refreshDebounce !== undefined) clearTimeout(this.refreshDebounce);
    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

/**
 * Create and inject the CSS rules for todo decorations.
 */
export function injectTodoStyles(): void {
  if (document.getElementById('wstext-todo-styles')) return;

  const style = document.createElement('style');
  style.id = 'wstext-todo-styles';
  style.textContent = `
    .todo-unchecked {
      color: transparent !important;
      font-size: 0.01px !important;
      letter-spacing: -1em;
      cursor: pointer;
    }
    .todo-unchecked::before {
      content: '☐ ';
      color: #4fc3f7;
      font-size: 14px;
      letter-spacing: normal;
    }
    .todo-checked {
      color: transparent !important;
      font-size: 0.01px !important;
      letter-spacing: -1em;
      cursor: pointer;
    }
    .todo-checked::before {
      content: '☑ ';
      color: #66bb6a;
      font-size: 14px;
      letter-spacing: normal;
    }
    .todo-checked-text {
      opacity: 0.4;
    }
  `;
  document.head.appendChild(style);
}
