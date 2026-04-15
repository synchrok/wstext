<script lang="ts">
  import { onMount } from 'svelte';
  import { getVersion } from '@tauri-apps/api/app';
  import { openUrl } from '@tauri-apps/plugin-opener';

  interface Props {
    visible: boolean;
    bgColor?: string;
    fgColor?: string;
    fgMuted?: string;
    borderColor?: string;
    accentColor?: string;
    onClose?: () => void;
  }

  let {
    visible,
    bgColor = '#1e1f1c',
    fgColor = '#F8F8F2',
    fgMuted = '#75715E',
    borderColor = '#3e3d32',
    accentColor = '#A6E22E',
    onClose
  }: Props = $props();

  let version = $state('');

  onMount(async () => {
    try {
      version = await getVersion();
    } catch (e) {
      console.error('Failed to get version', e);
      version = 'Unknown';
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose?.();
    }
  }

  function handleLinkClick(e: MouseEvent) {
    e.preventDefault();
    openUrl('https://github.com/synchrok/wstext');
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={onClose} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      class="dialog" 
      style:background-color={bgColor} 
      style:color={fgColor}
      style:border-color={borderColor}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      tabindex="-1"
    >
      <div class="content">
        <div class="logo" style:color={accentColor}>WSText</div>
        <h2 class="title">WSText</h2>
        <div class="version" style:color={fgMuted}>Version {version}</div>
        <div class="desc">A tiny, fast text editor</div>
        
        <div class="links">
          <a 
            href="https://github.com/synchrok/wstext" 
            onclick={handleLinkClick}
            style:color={accentColor}
          >
            github.com/synchrok/wstext
          </a>
        </div>
        
        <div class="license" style:color={fgMuted}>License: AGPL-3.0</div>
      </div>

      <div class="actions" style:border-top-color={borderColor}>
        <button 
          class="btn-close" 
          style:background-color={accentColor}
          style:color={bgColor}
          onclick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .dialog {
    width: 320px;
    max-width: 90vw;
    border: 1px solid;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .content {
    padding: 32px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .logo {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -2px;
    margin-bottom: 16px;
    line-height: 1;
  }

  .title {
    margin: 0 0 4px 0;
    font-size: 20px;
    font-weight: bold;
  }

  .version {
    font-size: 13px;
    margin-bottom: 16px;
  }

  .desc {
    font-size: 14px;
    margin-bottom: 24px;
  }

  .links {
    margin-bottom: 16px;
    font-size: 13px;
  }

  .links a {
    text-decoration: none;
  }

  .links a:hover {
    text-decoration: underline;
  }

  .license {
    font-size: 12px;
  }

  .actions {
    padding: 16px 20px;
    border-top: 1px solid;
    display: flex;
    justify-content: center;
  }

  button {
    font-family: inherit;
  }

  .btn-close {
    border: none;
    padding: 8px 32px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    border-radius: 4px;
    transition: filter 0.2s;
  }

  .btn-close:hover {
    filter: brightness(1.1);
  }
</style>