import { isWebUrl } from '../domain/game'

/**
 * Opens a web link in the user's default browser. In the desktop app this goes through
 * the opener plugin (the webview itself never navigates away); in the browser build it
 * opens a new tab. Non-http(s) URLs are ignored.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isWebUrl(url)) return
  const { isTauri } = await import('@tauri-apps/api/core')
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
