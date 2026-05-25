/**
 * Map file extensions to Monaco Editor language identifiers.
 * Returns 'plaintext' for unknown/missing extensions.
 */

const EXTENSION_MAP: Record<string, string> = {
  // TypeScript
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  // JavaScript
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  svelte: 'html',
  // Data formats
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  xml: 'xml',
  svg: 'xml',
  // Markdown
  md: 'markdown',
  mdx: 'mdx',
  // Programming languages
  py: 'python',
  pyw: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  // Shell
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'powershell',
  psm1: 'powershell',
  // Database
  sql: 'sql',
  // Text
  txt: 'plaintext',
  log: 'plaintext',
};

/**
 * Detect Monaco language ID from a file path or filename.
 *
 * @param filePath - Absolute or relative file path, or just a filename
 * @returns Monaco language identifier string
 */
export function detectLanguage(filePath: string): string {
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  // Special filenames without extension
  const lowerName = fileName.toLowerCase();
  if (lowerName === 'dockerfile') return 'dockerfile';
  if (lowerName === 'makefile') return 'makefile';
  if (lowerName === '.gitignore' || lowerName === '.npmignore') return 'plaintext';

  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === 0) return 'plaintext';

  const ext = fileName.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_MAP[ext] ?? 'plaintext';
}

const TEXT_LANGUAGES = new Set(['markdown', 'mdx', 'plaintext']);

export function isCodeLanguage(language: string): boolean {
  return !TEXT_LANGUAGES.has(language);
}

/** All supported language IDs for the language picker dropdown. */
export const SUPPORTED_LANGUAGES: string[] = [
  'plaintext',
  'abap', 'apex', 'azcli', 'bat', 'bicep', 'c', 'cameligo', 'clojure',
  'coffeescript', 'cpp', 'csharp', 'css', 'cypher', 'dart', 'dockerfile',
  'ecl', 'elixir', 'fsharp', 'go', 'graphql', 'handlebars', 'hcl', 'html',
  'ini', 'java', 'javascript', 'json', 'julia', 'kotlin', 'less', 'lexon',
  'liquid', 'lua', 'm3', 'markdown', 'mips', 'msdax', 'mysql', 'objective-c',
  'pascal', 'pascaligo', 'perl', 'pgsql', 'php', 'postiats', 'powerquery',
  'powershell', 'proto', 'pug', 'python', 'qsharp', 'r', 'razor', 'redis',
  'redshift', 'restructuredtext', 'ruby', 'rust', 'sb', 'scala', 'scheme',
  'scss', 'shell', 'solidity', 'sophia', 'sparql', 'sql', 'st', 'swift',
  'systemverilog', 'tcl', 'twig', 'typescript', 'typespec', 'vb', 'wgsl',
  'xml', 'yaml',
];
