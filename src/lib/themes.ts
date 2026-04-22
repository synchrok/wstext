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
  mariana: {
    bgPrimary: '#303841',
    bgSecondary: '#2B333B',
    tabBarBg: '#2B333B',
    statusBarBg: '#2B333B',
    fgPrimary: '#D8DEE9',
    fgMuted: '#A6ACB9',
    accent: '#5FB4B4',
    border: '#3D4752',
    tabActive: '#303841',
    tabInactive: '#2B333B',
    tabActiveFg: '#D8DEE9',
    tabInactiveFg: '#A6ACB9',
  },
  sixteen: {
    bgPrimary: '#151515',
    bgSecondary: '#101010',
    tabBarBg: '#101010',
    statusBarBg: '#101010',
    fgPrimary: '#D0D0D0',
    fgMuted: '#505050',
    accent: '#6A9FB5',
    border: '#2A2A2A',
    tabActive: '#151515',
    tabInactive: '#101010',
    tabActiveFg: '#D0D0D0',
    tabInactiveFg: '#505050',
  },
  breakers: {
    bgPrimary: '#1B2B34',
    bgSecondary: '#16252E',
    tabBarBg: '#16252E',
    statusBarBg: '#16252E',
    fgPrimary: '#CDD3DE',
    fgMuted: '#65737E',
    accent: '#6699CC',
    border: '#2D3F4A',
    tabActive: '#1B2B34',
    tabInactive: '#16252E',
    tabActiveFg: '#CDD3DE',
    tabInactiveFg: '#65737E',
  },
  celeste: {
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F0F0F0',
    tabBarBg: '#F0F0F0',
    statusBarBg: '#F0F0F0',
    fgPrimary: '#333333',
    fgMuted: '#999999',
    accent: '#3B5BB5',
    border: '#DCDCDC',
    tabActive: '#FFFFFF',
    tabInactive: '#F0F0F0',
    tabActiveFg: '#333333',
    tabInactiveFg: '#999999',
  },
  notepad: {
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F5F5F5',
    tabBarBg: '#F5F5F5',
    statusBarBg: '#F5F5F5',
    fgPrimary: '#1E1E1E',
    fgMuted: '#888888',
    accent: '#0078D4',
    border: '#E0E0E0',
    tabActive: '#FFFFFF',
    tabInactive: '#F5F5F5',
    tabActiveFg: '#1E1E1E',
    tabInactiveFg: '#888888',
  },
  'notepad-warm': {
    bgPrimary: '#FFF8F0',
    bgSecondary: '#F5EDE3',
    tabBarBg: '#F5EDE3',
    statusBarBg: '#F5EDE3',
    fgPrimary: '#3C3836',
    fgMuted: '#928374',
    accent: '#D65D0E',
    border: '#E8DDD1',
    tabActive: '#FFF8F0',
    tabInactive: '#F5EDE3',
    tabActiveFg: '#3C3836',
    tabInactiveFg: '#928374',
  },
};

/** Light theme names — used to determine dark/light mode for UI. */
export const LIGHT_THEMES: ReadonlySet<ThemeName> = new Set([
  'solarized-light',
  'celeste',
  'notepad',
  'notepad-warm',
]);

/**
 * Register all built-in themes with Monaco.
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
      { token: 'string.key.json', foreground: '98C379' },
      { token: 'string.value.json', foreground: 'E06C75' },
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

  monaco.editor.defineTheme('mariana', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'D8DEE9', background: '303841' },
      { token: 'comment', foreground: 'A6ACB9', fontStyle: 'italic' },
      { token: 'string', foreground: '99C794' },
      { token: 'keyword', foreground: 'C695C6' },
      { token: 'keyword.operator', foreground: 'C695C6' },
      { token: 'number', foreground: 'F9AE58' },
      { token: 'type', foreground: '5FB4B4', fontStyle: 'italic' },
      { token: 'function', foreground: '5FB4B4' },
      { token: 'variable', foreground: 'D8DEE9' },
      { token: 'constant', foreground: 'F9AE58' },
      { token: 'operator', foreground: 'C695C6' },
      { token: 'class', foreground: '5FB4B4' },
      { token: 'delimiter', foreground: 'D8DEE9' },
      { token: 'tag', foreground: 'EC5F66' },
      { token: 'attribute.name', foreground: '5FB4B4' },
      { token: 'attribute.value', foreground: '99C794' },
    ],
    colors: {
      'editor.background': '#303841',
      'editor.foreground': '#D8DEE9',
      'editorCursor.foreground': '#F8F8F0',
      'editor.lineHighlightBackground': '#38424C',
      'editor.selectionBackground': '#44515E',
      'editorLineNumber.foreground': '#A6ACB9',
      'editorIndentGuide.background1': '#3D4752',
      'editorWhitespace.foreground': '#3D4752',
    },
  });

  monaco.editor.defineTheme('sixteen', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'D0D0D0', background: '151515' },
      { token: 'comment', foreground: '505050', fontStyle: 'italic' },
      { token: 'string', foreground: '90A959' },
      { token: 'keyword', foreground: 'D28445' },
      { token: 'keyword.operator', foreground: 'D28445' },
      { token: 'number', foreground: 'AA759F' },
      { token: 'type', foreground: '6A9FB5' },
      { token: 'function', foreground: '6A9FB5' },
      { token: 'variable', foreground: 'D0D0D0' },
      { token: 'constant', foreground: 'AA759F' },
      { token: 'operator', foreground: 'D28445' },
      { token: 'class', foreground: 'F4BF75' },
      { token: 'delimiter', foreground: 'D0D0D0' },
      { token: 'tag', foreground: 'AC4142' },
      { token: 'attribute.name', foreground: '6A9FB5' },
      { token: 'attribute.value', foreground: '90A959' },
    ],
    colors: {
      'editor.background': '#151515',
      'editor.foreground': '#D0D0D0',
      'editorCursor.foreground': '#D0D0D0',
      'editor.lineHighlightBackground': '#202020',
      'editor.selectionBackground': '#303030',
      'editorLineNumber.foreground': '#505050',
      'editorIndentGuide.background1': '#2A2A2A',
      'editorWhitespace.foreground': '#2A2A2A',
    },
  });

  monaco.editor.defineTheme('breakers', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'CDD3DE', background: '1B2B34' },
      { token: 'comment', foreground: '65737E', fontStyle: 'italic' },
      { token: 'string', foreground: '99C794' },
      { token: 'keyword', foreground: 'C594C5' },
      { token: 'keyword.operator', foreground: '5FB3B3' },
      { token: 'number', foreground: 'F99157' },
      { token: 'type', foreground: '6699CC' },
      { token: 'function', foreground: '6699CC' },
      { token: 'variable', foreground: 'CDD3DE' },
      { token: 'constant', foreground: 'F99157' },
      { token: 'operator', foreground: '5FB3B3' },
      { token: 'class', foreground: 'FAC863' },
      { token: 'delimiter', foreground: 'CDD3DE' },
      { token: 'tag', foreground: 'EC5F67' },
      { token: 'attribute.name', foreground: '6699CC' },
      { token: 'attribute.value', foreground: '99C794' },
    ],
    colors: {
      'editor.background': '#1B2B34',
      'editor.foreground': '#CDD3DE',
      'editorCursor.foreground': '#C0C5CE',
      'editor.lineHighlightBackground': '#243039',
      'editor.selectionBackground': '#2D3F4A',
      'editorLineNumber.foreground': '#65737E',
      'editorIndentGuide.background1': '#2D3F4A',
      'editorWhitespace.foreground': '#2D3F4A',
    },
  });

  monaco.editor.defineTheme('celeste', {
    base: 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: '333333', background: 'FFFFFF' },
      { token: 'comment', foreground: '999999', fontStyle: 'italic' },
      { token: 'string', foreground: '3D8B37' },
      { token: 'keyword', foreground: '7A3E9D' },
      { token: 'keyword.operator', foreground: '7A3E9D' },
      { token: 'number', foreground: 'D64292' },
      { token: 'type', foreground: '3B5BB5' },
      { token: 'function', foreground: '3B5BB5' },
      { token: 'variable', foreground: '333333' },
      { token: 'constant', foreground: 'D64292' },
      { token: 'operator', foreground: '7A3E9D' },
      { token: 'class', foreground: '3B5BB5' },
      { token: 'delimiter', foreground: '333333' },
      { token: 'tag', foreground: 'C33720' },
      { token: 'attribute.name', foreground: '3B5BB5' },
      { token: 'attribute.value', foreground: '3D8B37' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#333333',
      'editorCursor.foreground': '#000000',
      'editor.lineHighlightBackground': '#F5F5F5',
      'editor.selectionBackground': '#C9DDF5',
      'editorLineNumber.foreground': '#999999',
      'editorIndentGuide.background1': '#E8E8E8',
      'editorWhitespace.foreground': '#E8E8E8',
    },
  });

  monaco.editor.defineTheme('notepad', {
    base: 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: '1E1E1E', background: 'FFFFFF' },
      { token: 'comment', foreground: '888888', fontStyle: 'italic' },
      { token: 'string', foreground: '0B7C0A' },
      { token: 'keyword', foreground: '0000FF' },
      { token: 'keyword.operator', foreground: '000000' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267F99' },
      { token: 'function', foreground: '795E26' },
      { token: 'variable', foreground: '1E1E1E' },
      { token: 'constant', foreground: '098658' },
      { token: 'operator', foreground: '000000' },
      { token: 'class', foreground: '267F99' },
      { token: 'delimiter', foreground: '1E1E1E' },
      { token: 'tag', foreground: '800000' },
      { token: 'attribute.name', foreground: 'FF0000' },
      { token: 'attribute.value', foreground: '0000FF' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#1E1E1E',
      'editorCursor.foreground': '#000000',
      'editor.lineHighlightBackground': '#F7F7F7',
      'editor.selectionBackground': '#ADD6FF',
      'editorLineNumber.foreground': '#AAAAAA',
      'editorIndentGuide.background1': '#EDEDED',
      'editorWhitespace.foreground': '#EDEDED',
    },
  });

  monaco.editor.defineTheme('notepad-warm', {
    base: 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: '3C3836', background: 'FFF8F0' },
      { token: 'comment', foreground: '928374', fontStyle: 'italic' },
      { token: 'string', foreground: '79740E' },
      { token: 'keyword', foreground: '9D0006' },
      { token: 'keyword.operator', foreground: '9D0006' },
      { token: 'number', foreground: '8F3F71' },
      { token: 'type', foreground: '076678' },
      { token: 'function', foreground: '427B58' },
      { token: 'variable', foreground: '3C3836' },
      { token: 'constant', foreground: '8F3F71' },
      { token: 'operator', foreground: '9D0006' },
      { token: 'class', foreground: '076678' },
      { token: 'delimiter', foreground: '3C3836' },
      { token: 'tag', foreground: 'CC241D' },
      { token: 'attribute.name', foreground: '427B58' },
      { token: 'attribute.value', foreground: '79740E' },
    ],
    colors: {
      'editor.background': '#FFF8F0',
      'editor.foreground': '#3C3836',
      'editorCursor.foreground': '#3C3836',
      'editor.lineHighlightBackground': '#F9F0E5',
      'editor.selectionBackground': '#EBDBB2',
      'editorLineNumber.foreground': '#928374',
      'editorIndentGuide.background1': '#EDE4D8',
      'editorWhitespace.foreground': '#EDE4D8',
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
