import * as monaco from 'monaco-editor';

/**
 * Format the entire document using Monaco's built-in formatter.
 * Works for: JSON (built-in), YAML (monaco-yaml), HTML, CSS, TypeScript, JavaScript.
 */
export async function formatDocument(
  editor: monaco.editor.IStandaloneCodeEditor
): Promise<void> {
  await editor.getAction('editor.action.formatDocument')?.run();
}

/**
 * Format only the selected text.
 */
export async function formatSelection(
  editor: monaco.editor.IStandaloneCodeEditor
): Promise<void> {
  const action = editor.getAction('editor.action.formatSelection');
  if (action) {
    await action.run();
  } else {
    // Fallback to document format if selection format not available
    await formatDocument(editor);
  }
}
