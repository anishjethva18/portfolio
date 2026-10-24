const CHANNEL_NAME = 'portfolio-data-sync';
const EVENT_NAME = 'portfolio-data-updated';
const STORAGE_KEY = 'portfolio-data-sync-event';

let channel: BroadcastChannel | null = null;

function dispatch(detail: { path?: string; method?: string; timestamp?: number }) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  }
}

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', (event: MessageEvent) => dispatch(event.data || {}));
  } catch {
    channel = null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { dispatch(JSON.parse(event.newValue)); } catch { dispatch({}); }
  });
}

/** Notify open admin and portfolio views that persisted server data changed. */
export function notifyPortfolioDataUpdated(path: string, method: string) {
  const detail = { path, method, timestamp: Date.now() };
  dispatch(detail);
  try { channel?.postMessage(detail); } catch {}
  if (!channel) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(detail)); } catch {}
  }
}

export function isPortfolioDataMutation(path: string, method: string) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return false;
  if (/^\/api\/auth\//i.test(path) || /^\/api\/analytics\//i.test(path)) return false;
  // Uploading a media file alone does not publish portfolio data. The editor
  // emits portfolio-media-changed after linking it to a draft field.
  if (/^\/api\/files\/(?:portfolio-media|upload)(?:\/|$)/i.test(path)) return false;
  return /^\/api\//i.test(path);
}
