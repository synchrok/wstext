<script lang="ts">
  import { onMount } from 'svelte';
  import * as monaco from 'monaco-editor';

  let editorContainer: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor;

  onMount(() => {
    editor = monaco.editor.create(editorContainer, {
      value: '// Welcome to wstext\n// A SublimeText-inspired editor\n\nconsole.log("Hello, wstext!");',
      language: 'javascript',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: {
        enabled: true,
        scale: 1,
        renderCharacters: false,
      },
      fontSize: 14,
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      renderLineHighlight: 'all',
    });

    return () => editor.dispose();
  });
</script>

<div class="app">
  <div class="editor-container" bind:this={editorContainer}></div>
</div>

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #272822;
  }

  .app {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    background: #272822;
  }

  .editor-container {
    flex: 1;
    width: 100%;
    height: 100%;
  }
</style>
