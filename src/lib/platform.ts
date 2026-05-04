/**
 * Platform detection for the renderer (WebView).
 *
 * The Monaco / WebKit stability fixes added across the macOS jitter, IME, and
 * Pretendard-readability commits are macOS-specific. Applied unconditionally on
 * Windows (Edge/WebView2) they cause the opposite problems:
 *   - `fontWeight: '450'` + `-webkit-font-smoothing: antialiased` make text
 *     look too bold and tight under ClearType.
 *   - A hard-coded 20px line-height causes adjacent lines to overlap as soon
 *     as the user zooms past the default font size.
 *
 * `isMac` is evaluated once at module load. We tag <html> with `is-mac` /
 * `is-windows` so CSS can scope rules without re-querying.
 */
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const isMac = /Mac|iPhone|iPad|iPod/.test(ua);
export const isWindows = /Windows/.test(ua);

if (typeof document !== 'undefined') {
  const root = document.documentElement;
  if (isMac) root.classList.add('is-mac');
  else if (isWindows) root.classList.add('is-windows');
}
