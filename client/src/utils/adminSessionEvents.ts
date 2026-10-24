const ADMIN_SESSION_CHANNEL = 'win11-admin-session';
const ADMIN_SESSION_STORAGE_KEY = 'win11_admin_session_ended';
export const ADMIN_SESSION_ENDED_EVENT = 'win11-admin-session-ended';

export const isProtectedAdminRequest = (url: string): boolean =>
  url.startsWith('/api/admin/') || url.startsWith('/api/health/admin');

let channel: BroadcastChannel | null = null;

export const broadcastAdminSessionEnded = (lockScreen = true): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_ENDED_EVENT, { detail: { lockScreen } }));
  }
  if (typeof window === 'undefined') return;

  try {
    if ('BroadcastChannel' in window) {
      channel ??= new BroadcastChannel(ADMIN_SESSION_CHANNEL);
      channel.postMessage({ type: 'session-ended', lockScreen });
    }
  } catch (error) {
    console.error('[AdminSessionEvents] Could not broadcast admin session end.', error);
  }

  try {
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), lockScreen }));
  } catch (error) {
    console.error('[AdminSessionEvents] Could not notify other tabs about admin logout.', error);
  }
};

export const watchAdminSessionEnded = (handler: (lockScreen: boolean) => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const onLocalEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ lockScreen?: unknown }>).detail;
    handler(detail?.lockScreen !== false);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ADMIN_SESSION_STORAGE_KEY || !event.newValue) return;
    try {
      const state = JSON.parse(event.newValue) as { lockScreen?: unknown };
      handler(state.lockScreen !== false);
    } catch {
      handler(true);
    }
  };

  let sessionChannel: BroadcastChannel | null = null;
  try {
    if ('BroadcastChannel' in window) {
      sessionChannel = new BroadcastChannel(ADMIN_SESSION_CHANNEL);
      sessionChannel.onmessage = (event: MessageEvent<{ type?: string; lockScreen?: unknown }>) => {
        if (event.data?.type === 'session-ended') handler(event.data.lockScreen !== false);
      };
    }
  } catch (error) {
    console.error('[AdminSessionEvents] Could not subscribe to cross-tab logout notifications.', error);
  }

  window.addEventListener(ADMIN_SESSION_ENDED_EVENT, onLocalEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ADMIN_SESSION_ENDED_EVENT, onLocalEvent);
    window.removeEventListener('storage', onStorage);
    sessionChannel?.close();
  };
};
