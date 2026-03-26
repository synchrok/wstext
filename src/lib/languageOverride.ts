import * as monaco from 'monaco-editor';
import { SUPPORTED_LANGUAGES } from './utils/fileLanguage';

/**
 * Change the language of a Monaco editor model.
 * This changes syntax highlighting without affecting file content.
 */
export function setLanguage(
  model: monaco.editor.ITextModel,
  languageId: string
): void {
  monaco.editor.setModelLanguage(model, languageId);
}

/**
 * Get the current language of a model.
 */
export function getLanguage(model: monaco.editor.ITextModel): string {
  return model.getLanguageId();
}

/**
 * Get all available Monaco language IDs for the language picker.
 */
export function getLanguageList(): string[] {
  return SUPPORTED_LANGUAGES;
}

/**
 * Get a human-readable display name for a language ID.
 */
export function getLanguageDisplayName(languageId: string): string {
  const names: Record<string, string> = {
    plaintext: 'Plain Text',
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    json: 'JSON',
    yaml: 'YAML',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'Less',
    markdown: 'Markdown',
    python: 'Python',
    rust: 'Rust',
    go: 'Go',
    java: 'Java',
    kotlin: 'Kotlin',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    shell: 'Shell Script',
    powershell: 'PowerShell',
    sql: 'SQL',
    xml: 'XML',
    dockerfile: 'Dockerfile',
  };
  return names[languageId] ?? languageId.charAt(0).toUpperCase() + languageId.slice(1);
}
