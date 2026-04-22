import MarkdownIt from 'markdown-it';
// @ts-ignore — no types for markdown-it-task-lists
import markdownItTaskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js/lib/core';
import DOMPurify from 'dompurify';
import { convertFileSrc } from '@tauri-apps/api/core';

// Selective language import — avoids 1MB+ bundle from full hljs import
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';

// Register languages
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml); // reuse xml tokenizer for html
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);

/**
 * Singleton markdown-it instance.
 * Creating a new instance per render is expensive — create once at module level.
 */
const md = new MarkdownIt({
  html: true,        // GitHub Flavored Markdown supports inline HTML
  linkify: false,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code class="language-${lang}">${highlighted}</code></pre>`;
      } catch {
        // Fall through to default
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
})

// Generate GitHub-style heading IDs for anchor links
const slugCounts = new Map();
md.core.ruler.push('heading_anchors', (state) => {
  for (const token of state.tokens) {
    if (token.type === 'heading_open') {
      const inline = state.tokens[state.tokens.indexOf(token) + 1];
      if (inline && inline.type === 'inline') {
        const text = inline.children
          ?.filter(t => t.type === 'text' || t.type === 'code_inline')
          .map(t => t.content)
          .join('') ?? '';
        let slug = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ\u3400-\u9FFF-]/g, '')
          .replace(/ /g, '-')
          .replace(/^-|-$/g, '');
        // Handle duplicates
        const count = slugCounts.get(slug) || 0;
        slugCounts.set(slug, count + 1);
        if (count > 0) slug += '-' + count;
        token.attrSet('id', slug);
      }
    }
  }
  slugCounts.clear();
});

md
  .use(markdownItTaskLists, { enabled: true, label: true })
  .enable('table')
  .enable('strikethrough');

/**
 * Render markdown source to sanitized HTML.
 *
 * @param source - Raw markdown text
 * @returns Sanitized HTML string safe for innerHTML
 */
export function renderMarkdown(source: string, basePath?: string): string {
  const raw = md.render(source);
  // DOMPurify strips dangerous HTML even in Tauri webview (JS can still execute)
  let sanitized = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr', 'div', 'span', 'sub', 'sup', 'b', 'i', 'u',
      'details', 'summary', // GitHub collapsible sections
      'input', 'label',     // task list checkboxes
      'kbd', 'var', 'samp', 'mark',
      'dl', 'dt', 'dd',
      'picture', 'source', 'video', 'audio',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'name',
      'type', 'checked', 'disabled',
      'colspan', 'rowspan',
      'align', 'valign', 'width', 'height',  // GitHub HTML: <p align="center">, <img width="128">
      'start', 'reversed',                    // ordered list attrs
      'open',                                 // <details open>
      'for',                                  // <label for>
    ],
  });

  // Resolve relative image paths to Tauri asset URLs
  if (basePath) {
    const dir = basePath.replace(/[\\/][^\\/]*$/, '');
    sanitized = sanitized.replace(
      /(<img[^>]+src=")([^"]+)(")/g,
      (match, before, src, after) => {
        if (/^(https?:|data:|blob:|asset:|\/\/)/.test(src)) return match;
        const sep = dir.includes('\\') ? '\\' : '/';
        const abs = dir + sep + src.replace(/[\\/]/g, sep);
        return before + convertFileSrc(abs) + after;
      }
    );
  }

  return sanitized;
}
