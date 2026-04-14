<script lang="ts">
  import { renderMarkdown } from '../markdown';

  interface Props {
    source?: string;
    mode?: 'toggle' | 'split';
    isDark?: boolean;
  }

  let {
    source = '',
    mode = 'toggle',
    isDark = true,
  }: Props = $props();

  let rendered = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Re-render with 150ms debounce — fast enough to feel live
  $effect(() => {
    const text = source; // Track reactivity on source
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      rendered = renderMarkdown(text);
      debounceTimer = undefined;
    }, 150);

    return () => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
    };
  });
</script>

<div
  class="markdown-preview"
  class:dark={isDark}
  class:split={mode === 'split'}
>
  <div class="markdown-content">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html rendered}
  </div>
</div>

<style>
  .markdown-preview {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background-color: #f8f9fa;
    color: #24292e;
    box-sizing: border-box;
  }

  .markdown-preview.dark {
    background-color: #1e1e1e;
    color: #d4d4d4;
  }

  .markdown-preview.split {
    border-left: 1px solid rgba(128, 128, 128, 0.3);
  }

  .markdown-content {
    padding: 20px 28px;
    max-width: 860px;
    margin: 0 auto;
    line-height: 1.6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 15px;
  }

  /* Headings */
  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4),
  .markdown-content :global(h5),
  .markdown-content :global(h6) {
    margin-top: 24px;
    margin-bottom: 8px;
    font-weight: 600;
    line-height: 1.25;
  }

  .markdown-content :global(h1) { font-size: 2em; border-bottom: 1px solid rgba(128,128,128,0.3); padding-bottom: 0.3em; }
  .markdown-content :global(h2) { font-size: 1.5em; border-bottom: 1px solid rgba(128,128,128,0.3); padding-bottom: 0.3em; }

  /* Code blocks */
  .markdown-content :global(pre.hljs) {
    background-color: #282c34;
    color: #abb2bf;
    border-radius: 6px;
    padding: 16px;
    overflow-x: auto;
    margin: 16px 0;
    font-size: 13px;
    line-height: 1.5;
  }

  .markdown-content :global(code) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.875em;
    background-color: rgba(128,128,128,0.15);
    padding: 0.2em 0.4em;
    border-radius: 3px;
  }

  .markdown-content :global(pre code) {
    background: none;
    padding: 0;
    font-size: inherit;
  }

  /* Tables */
  .markdown-content :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    border: 1px solid rgba(128,128,128,0.3);
    padding: 6px 13px;
    text-align: left;
  }

  .markdown-content :global(th) {
    font-weight: 600;
    background-color: rgba(128,128,128,0.1);
  }

  /* Task lists */
  .markdown-content :global(.task-list-item) {
    list-style: none;
    margin-left: -1.5em;
  }

  .markdown-content :global(.task-list-item input[type="checkbox"]) {
    margin-right: 8px;
  }

  /* Blockquotes */
  .markdown-content :global(blockquote) {
    border-left: 4px solid rgba(128,128,128,0.4);
    padding: 0 1em;
    margin: 0;
    color: rgba(128,128,128,0.8);
  }

  /* Links */
  .markdown-content :global(a) {
    color: #0969da;
    text-decoration: none;
  }

  .markdown-preview.dark .markdown-content :global(a) {
    color: #58a6ff;
  }

  .markdown-content :global(a:hover) {
    text-decoration: underline;
  }

  /* Horizontal rule */
  .markdown-content :global(hr) {
    border: none;
    border-top: 1px solid rgba(128,128,128,0.3);
    margin: 24px 0;
  }

  /* GitHub HTML: align="center" support */
  .markdown-content :global([align="center"]) {
    text-align: center;
  }
  .markdown-content :global([align="right"]) {
    text-align: right;
  }

  /* Images */
  .markdown-content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }

  /* Inline code inside headings/links */
  .markdown-content :global(h1 code),
  .markdown-content :global(h2 code),
  .markdown-content :global(h3 code) {
    font-size: 0.85em;
  }

  /* kbd element (keyboard shortcut) */
  .markdown-content :global(kbd) {
    display: inline-block;
    padding: 2px 6px;
    font-size: 0.8em;
    font-family: 'SFMono-Regular', Consolas, monospace;
    line-height: 1.4;
    border: 1px solid rgba(128,128,128,0.4);
    border-radius: 3px;
    background-color: rgba(128,128,128,0.1);
  }

  /* Details/summary (collapsible) */
  .markdown-content :global(details) {
    margin: 8px 0;
    padding: 8px 12px;
    border: 1px solid rgba(128,128,128,0.3);
    border-radius: 4px;
  }
  .markdown-content :global(summary) {
    cursor: pointer;
    font-weight: 600;
  }

  /* Lists: tighter spacing */
  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    padding-left: 2em;
    margin: 8px 0;
  }
  .markdown-content :global(li) {
    margin: 2px 0;
  }
  .markdown-content :global(li > p) {
    margin: 4px 0;
  }

  /* Paragraphs */
  .markdown-content :global(p) {
    margin: 12px 0;
  }

  /* Strong/em */
  .markdown-content :global(strong) {
    font-weight: 600;
  }

  /* Strikethrough */
  .markdown-content :global(del) {
    opacity: 0.6;
  }
</style>
