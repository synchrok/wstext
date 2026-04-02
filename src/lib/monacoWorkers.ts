// @ts-ignore - Vite ?worker imports are handled at build time, not TypeScript-visible
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
// @ts-ignore
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
// @ts-ignore
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
// @ts-ignore
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
// @ts-ignore
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
// @ts-ignore - Local re-export required (direct import of monaco-yaml/yaml.worker.js fails in Vite)
import yamlWorker from './yaml.worker?worker';
import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';

// @ts-ignore - MonacoEnvironment is a Vite-specific global
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'yaml') return new yamlWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};

// Configure YAML language support
configureMonacoYaml(monaco, {
  validate: true,
  enableSchemaRequest: false,
  schemas: [],
});
