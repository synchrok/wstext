import * as monaco from 'monaco-editor';
import type { ThemeName } from './types';

export interface ThemeColors {
  /** Main editor background */
  bgPrimary: string;
  /** Secondary background (tabs, panels) */
  bgSecondary: string;
  /** Tab bar background */
  tabBarBg: string;
  /** Status bar background */
  statusBarBg: string;
  /** Primary foreground / text color */
  fgPrimary: string;
  /** Muted foreground (comments, secondary text) */
  fgMuted: string;
  /** Active tab / accent color indicator */
  accent: string;
  /** Tab border / divider */
  border: string;
  /** Active tab background */
  tabActive: string;
  /** Inactive tab background */
  tabInactive: string;
  /** Active tab text color */
  tabActiveFg: string;
  /** Inactive tab text color */
  tabInactiveFg: string;
}

const THEME_COLORS: Record<ThemeName, ThemeColors> = {
  monokai: {
    bgPrimary: '#272822',
    bgSecondary: '#1e1f1c',
    tabBarBg: '#1e1f1c',
    statusBarBg: '#1e1f1c',
    fgPrimary: '#F8F8F2',
    fgMuted: '#75715E',
    accent: '#A6E22E',
    border: '#3e3d32',
    tabActive: '#272822',
    tabInactive: '#1e1f1c',
    tabActiveFg: '#F8F8F2',
    tabInactiveFg: '#75715E',
  },
  dracula: {
    bgPrimary: '#282A36',
    bgSecondary: '#21222C',
    tabBarBg: '#21222C',
    statusBarBg: '#191A21',
    fgPrimary: '#F8F8F2',
    fgMuted: '#6272A4',
    accent: '#BD93F9',
    border: '#44475A',
    tabActive: '#282A36',
    tabInactive: '#21222C',
    tabActiveFg: '#F8F8F2',
    tabInactiveFg: '#6272A4',
  },
  'one-dark': {
    bgPrimary: '#282C34',
    bgSecondary: '#21252B',
    tabBarBg: '#21252B',
    statusBarBg: '#21252B',
    fgPrimary: '#ABB2BF',
    fgMuted: '#5C6370',
    accent: '#61AFEF',
    border: '#3E4451',
    tabActive: '#282C34',
    tabInactive: '#21252B',
    tabActiveFg: '#ABB2BF',
    tabInactiveFg: '#5C6370',
  },
  'solarized-dark': {
    bgPrimary: '#002B36',
    bgSecondary: '#00212B',
    tabBarBg: '#073642',
    statusBarBg: '#073642',
    fgPrimary: '#839496',
    fgMuted: '#586E75',
    accent: '#268BD2',
    border: '#073642',
    tabActive: '#002B36',
    tabInactive: '#00212B',
    tabActiveFg: '#93A1A1',
    tabInactiveFg: '#586E75',
  },
  'solarized-light': {
    bgPrimary: '#FDF6E3',
    bgSecondary: '#EEE8D5',
    tabBarBg: '#EEE8D5',
    statusBarBg: '#EEE8D5',
    fgPrimary: '#657B83',
    fgMuted: '#93A1A1',
    accent: '#268BD2',
    border: '#D3CBB8',
    tabActive: '#FDF6E3',
    tabInactive: '#EEE8D5',
    tabActiveFg: '#586E75',
    tabInactiveFg: '#93A1A1',
  },
};

/**
 * Register all 5 built-in themes with Monaco.
 * MUST be called before the first monaco.editor.create() call.
 */
export function registerAllThemes(): void {
  monaco.editor.defineTheme('monokai', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'F8F8F2', background: '272822' },
      { token: 'comment', foreground: '75715E', fontStyle: 'italic' },
      { token: 'string', foreground: 'E6DB74' },
      { token: 'keyword', foreground: 'F92672' },
      { token: 'keyword.operator', foreground: 'F92672' },
      { token: 'number', foreground: 'AE81FF' },
      { token: 'type', foreground: '66D9EF', fontStyle: 'italic' },
      { token: 'class', foreground: 'A6E22E' },
      { token: 'function', foreground: 'A6E22E' },
      { token: 'variable', foreground: 'F8F8F2' },
      { token: 'constant', foreground: 'AE81FF' },
      { token: 'operator', foreground: 'F92672' },
      { token: 'delimiter', foreground: 'F8F8F2' },
      { token: 'tag', foreground: 'F92672' },
      { token: 'attribute.name', foreground: 'A6E22E' },
      { token: 'attribute.value', foreground: 'E6DB74' },
    ],
    colors: {
      'editor.background': '#272822',
      'editor.foreground': '#F8F8F2',
      'editorCursor.foreground': '#F8F8F0',
      'editor.lineHighlightBackground': '#3E3D32',
      'editor.selectionBackground': '#49483E',
      'editorLineNumber.foreground': '#75715E',
      'editorIndentGuide.background1': '#3B3A32',
      'editorWhitespace.foreground': '#3B3A32',
      'editor.findMatchBackground': '#FFE792',
      'editor.findMatchHighlightBackground': '#FFE79266',
    },
  });

  monaco.editor.defineTheme('dracula', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'F8F8F2', background: '282A36' },
      { token: 'comment', foreground: '6272A4', fontStyle: 'italic' },
      { token: 'string', foreground: 'F1FA8C' },
      { token: 'keyword', foreground: 'FF79C6' },
      { token: 'keyword.operator', foreground: 'FF79C6' },
      { token: 'number', foreground: 'BD93F9' },
      { token: 'type', foreground: '8BE9FD', fontStyle: 'italic' },
      { token: 'function', foreground: '50FA7B' },
      { token: 'variable', foreground: 'F8F8F2' },
      { token: 'constant', foreground: 'BD93F9' },
      { token: 'operator', foreground: 'FF79C6' },
      { token: 'class', foreground: '8BE9FD' },
      { token: 'delimiter', foreground: 'F8F8F2' },
      { token: 'tag', foreground: 'FF79C6' },
      { token: 'attribute.name', foreground: '50FA7B' },
      { token: 'attribute.value', foreground: 'F1FA8C' },
    ],
    colors: {
      'editor.background': '#282A36',
      'editor.foreground': '#F8F8F2',
      'editorCursor.foreground': '#F8F8F0',
      'editor.lineHighlightBackground': '#44475A',
      'editor.selectionBackground': '#44475A',
      'editorLineNumber.foreground': '#6272A4',
      'editorIndentGuide.background1': '#44475A',
      'editorWhitespace.foreground': '#44475A',
      'editor.findMatchBackground': '#FFB86C',
      'editor.findMatchHighlightBackground': '#FFB86C66',
    },
  });

  monaco.editor.defineTheme('one-dark', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'ABB2BF', background: '282C34' },
      { token: 'comment', foreground: '5C6370', fontStyle: 'italic' },
      { token: 'string', foreground: '98C379' },
      { token: 'keyword', foreground: 'C678DD' },
      { token: 'keyword.operator', foreground: '56B6C2' },
      { token: 'number', foreground: 'D19A66' },
      { token: 'type', foreground: 'E5C07B' },
      { token: 'function', foreground: '61AFEF' },
      { token: 'variable', foreground: 'E06C75' },
      { token: 'constant', foreground: 'D19A66' },
      { token: 'operator', foreground: '56B6C2' },
      { token: 'class', foreground: 'E5C07B' },
      { token: 'delimiter', foreground: 'ABB2BF' },
      { token: 'tag', foreground: 'E06C75' },
      { token: 'attribute.name', foreground: 'D19A66' },
      { token: 'attribute.value', foreground: '98C379' },
    ],
    colors: {
      'editor.background': '#282C34',
      'editor.foreground': '#ABB2BF',
      'editorCursor.foreground': '#528BFF',
      'editor.lineHighlightBackground': '#2C313C',
      'editor.selectionBackground': '#3E4451',
      'editorLineNumber.foreground': '#4B5263',
      'editorIndentGuide.background1': '#3B4048',
      'editorWhitespace.foreground': '#3B4048',
    },
  });

  monaco.editor.defineTheme('solarized-dark', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: '839496', background: '002B36' },
      { token: 'comment', foreground: '586E75', fontStyle: 'italic' },
      { token: 'string', foreground: '2AA198' },
      { token: 'keyword', foreground: '859900' },
      { token: 'keyword.operator', foreground: '859900' },
      { token: 'number', foreground: 'D33682' },
      { token: 'type', foreground: '268BD2' },
      { token: 'function', foreground: '268BD2' },
      { token: 'variable', foreground: 'CB4B16' },
      { token: 'constant', foreground: 'D33682' },
      { token: 'operator', foreground: '859900' },
      { token: 'class', foreground: '268BD2' },
      { token: 'delimiter', foreground: '657B83' },
      { token: 'tag', foreground: 'CB4B16' },
      { token: 'attribute.name', foreground: '93A1A1' },
      { token: 'attribute.value', foreground: '2AA198' },
    ],
    colors: {
      'editor.background': '#002B36',
      'editor.foreground': '#839496',
      'editorCursor.foreground': '#819090',
      'editor.lineHighlightBackground': '#073642',
      'editor.selectionBackground': '#073642',
      'editorLineNumber.foreground': '#586E75',
      'editorIndentGuide.background1': '#073642',
    },
  });

  monaco.editor.defineTheme('solarized-light', {
    base: 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: '657B83', background: 'FDF6E3' },
      { token: 'comment', foreground: '93A1A1', fontStyle: 'italic' },
      { token: 'string', foreground: '2AA198' },
      { token: 'keyword', foreground: '859900' },
      { token: 'keyword.operator', foreground: '859900' },
      { token: 'number', foreground: 'D33682' },
      { token: 'type', foreground: '268BD2' },
      { token: 'function', foreground: '268BD2' },
      { token: 'variable', foreground: 'CB4B16' },
      { token: 'constant', foreground: 'D33682' },
      { token: 'operator', foreground: '859900' },
      { token: 'class', foreground: '268BD2' },
      { token: 'delimiter', foreground: '657B83' },
      { token: 'tag', foreground: 'CB4B16' },
      { token: 'attribute.name', foreground: '657B83' },
      { token: 'attribute.value', foreground: '2AA198' },
    ],
    colors: {
      'editor.background': '#FDF6E3',
      'editor.foreground': '#657B83',
      'editorCursor.foreground': '#586E75',
      'editor.lineHighlightBackground': '#EEE8D5',
      'editor.selectionBackground': '#D3CBB8',
      'editorLineNumber.foreground': '#93A1A1',
      'editorIndentGuide.background1': '#EEE8D5',
    },
  });
}

/**
 * Apply a theme to all Monaco editor instances globally.
 */
export function setTheme(name: ThemeName): void {
  monaco.editor.setTheme(name);
}

/**
 * Get UI color values for the given theme.
 * Used to apply matching colors to TabBar, StatusBar, and other non-Monaco UI.
 */
export function getThemeColors(name: ThemeName): ThemeColors {
  return THEME_COLORS[name];
}
