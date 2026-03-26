import * as monaco from 'monaco-editor';

/** CSS class applied to unchecked `[ ]` todo items. */
export const TODO_UNCHECKED_CLASS = 'todo-unchecked';
/** CSS class applied to checked `[x]` todo items. */
export const TODO_CHECKED_CLASS = 'todo-checked';

/** Regex to find todo patterns: [ ] or [x] */
const TODO_REGEX = /\[([ x])\]/g;

/**
 * Manages todo checkbox decorations for a Monaco editor instance.
 * Uses CSS decorations (not Content Widgets) to avoid overlay positioning issues.
 */
export class TodoManager {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private decorationIds: string[] = [];
  private refreshDebounce: ReturnType<typeof setTimeout> | undefined;
  private disposables: monaco.IDisposable[] = [];

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

    this.disposables.push(contentDisposable, mouseDisposable);
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
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column
        ),
        options: {
          inlineClassName: isChecked ? TODO_CHECKED_CLASS : TODO_UNCHECKED_CLASS,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    // Apply new decorations, replacing old ones
    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, decorations);
  }

  /** Handle mouse click — toggle todo if click lands on a decoration. */
  private handleClick(e: monaco.editor.IEditorMouseEvent): void {
    if (!e.target.position) return;
    const pos = e.target.position;
    const model = this.editor.getModel();
    if (!model) return;

    // Check decorations at click position
    const decorationsAtPos = model.getDecorationsInRange(
      new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + 1)
    );

    const todoDecoration = decorationsAtPos?.find(
      d => d.options.inlineClassName === TODO_UNCHECKED_CLASS ||
           d.options.inlineClassName === TODO_CHECKED_CLASS
    );

    if (!todoDecoration) return;

    const range = todoDecoration.range;
    const currentText = model.getValueInRange(range);
    const newText = currentText === '[ ]' ? '[x]' : '[ ]';

    // Use pushEditOperations to make toggle undoable
    model.pushEditOperations(
      [],
      [{ range, text: newText }],
      () => null
    );
  }

  /** Remove all decorations and event listeners. Call when switching tabs. */
  dispose(): void {
    if (this.refreshDebounce !== undefined) clearTimeout(this.refreshDebounce);
    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

/**
 * Create and inject the CSS rules for todo decorations.
 * Call this once during app initialization.
 */
export function injectTodoStyles(): void {
  if (document.getElementById('wstext-todo-styles')) return; // Already injected

  const style = document.createElement('style');
  style.id = 'wstext-todo-styles';
  style.textContent = `
    .todo-unchecked {
      cursor: pointer;
    }
    .todo-unchecked::before {
      content: '☐';
      color: #4fc3f7;
      font-size: 1em;
      margin-right: 1px;
    }
    .todo-checked::before {
      content: '☑';
      color: #66bb6a;
      font-size: 1em;
      margin-right: 1px;
      text-decoration: none;
    }
    .todo-checked {
      cursor: pointer;
      text-decoration: line-through;
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);
}
