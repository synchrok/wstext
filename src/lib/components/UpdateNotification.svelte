<script lang="ts">
  import { onMount } from 'svelte';
  import { openUrl } from '@tauri-apps/plugin-opener';

  interface Props {
    visible: boolean;
    isPortable: boolean;
    version: string;
    updateUrl: string;
    downloading: boolean;
    hasDirtyTabs: boolean;
    bgColor?: string;
    fgColor?: string;
    accentColor?: string;
    borderColor?: string;
    fgMuted?: string;
    onUpdate?: () => void;
    onDismiss?: () => void;
  }

  let {
    visible,
    isPortable,
    version,
    updateUrl,
    downloading,
    hasDirtyTabs,
    bgColor = '#272822',
    fgColor = '#F8F8F2',
    accentColor = '#A6E22E',
    borderColor = '#3e3d32',
    fgMuted = '#75715E',
    onUpdate,
    onDismiss
  }: Props = $props();

  onMount(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        onDismiss?.();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  async function handleDownload() {
    try {
      await openUrl(updateUrl);
    } catch {}
    onDismiss?.();
  }
</script>

{#if visible}
  {#if isPortable}
    <!-- 포터블: 토스트 알림 (수동 닫기) -->
    <div class="update-toast" style="background:{bgColor};color:{fgColor};border-color:{borderColor}">
      <span class="update-toast-text">새 버전 {version} 사용 가능</span>
      <button class="update-toast-download" onclick={handleDownload} style="color:{accentColor}">
        다운로드
      </button>
      <button class="update-toast-close" onclick={() => onDismiss?.()} style="color:{fgMuted}" aria-label="닫기">×</button>
    </div>
  {:else}
    <!-- 설치 버전: 모달 다이얼로그 -->
    <div class="update-overlay" role="presentation" onclick={() => onDismiss?.()}>
      <div class="update-modal" role="presentation" style="background:{bgColor};color:{fgColor};border-color:{borderColor}"
           onclick={(e) => e.stopPropagation()}>
        <h3 class="update-title">업데이트 사용 가능</h3>
        <p class="update-version" style="color:{fgMuted}">새 버전: {version}</p>
        {#if hasDirtyTabs}
          <p class="update-warning" style="color:#e67e22">
            저장하지 않은 파일이 있습니다. 먼저 저장해 주세요.
          </p>
        {/if}
        {#if downloading}
          <p class="update-downloading" style="color:{accentColor}">업데이트 다운로드 중...</p>
        {/if}
        <div class="update-actions">
          <button
            class="update-btn-primary"
            onclick={() => onUpdate?.()}
            disabled={hasDirtyTabs || downloading}
            style="background:{accentColor};color:{bgColor}"
          >
            {downloading ? '설치 중...' : '업데이트'}
          </button>
          <button
            class="update-btn-secondary"
            onclick={() => onDismiss?.()}
            disabled={downloading}
            style="color:{fgMuted};border-color:{borderColor}"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* 포터블 토스트 */
  .update-toast {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    border: 1px solid;
    border-radius: 4px;
    font-size: 13px;
    z-index: 1001;
    animation: fadeIn 0.2s ease;
    max-width: 480px;
  }
  .update-toast-text { flex: 1; }
  .update-toast-download {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: bold;
    padding: 0;
    text-decoration: underline;
  }
  .update-toast-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 0 2px;
    line-height: 1;
  }
  /* 설치 버전 다이얼로그 */
  .update-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .update-modal {
    border: 1px solid;
    border-radius: 6px;
    padding: 24px;
    min-width: 320px;
    max-width: 400px;
  }
  .update-title {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
  }
  .update-version {
    margin: 0 0 12px 0;
    font-size: 13px;
  }
  .update-warning, .update-downloading {
    margin: 0 0 12px 0;
    font-size: 12px;
  }
  .update-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 16px;
  }
  .update-btn-primary {
    padding: 6px 16px;
    border: none;
    border-radius: 3px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 600;
  }
  .update-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .update-btn-secondary {
    padding: 6px 16px;
    background: none;
    border: 1px solid;
    border-radius: 3px;
    font-size: 13px;
    cursor: pointer;
  }
  .update-btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>