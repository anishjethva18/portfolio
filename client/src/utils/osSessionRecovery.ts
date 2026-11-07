import { APPS_LIST } from '../data/portfolioData';
import type { AppId, WindowState } from '../types';
import { getRestorableAppIds } from './applicationRoutes';

export const OS_SESSION_STORAGE_KEY = 'win11_os_session_recovery_v1';

export interface OsSessionSnapshot {
  windows: WindowState[];
  activeWindowId: string | null;
  currentDesktopId: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const appIds = new Set(APPS_LIST.map((app) => app.id));
const visitorRestorableAppIds = new Set(getRestorableAppIds([]));
const safeArgumentKeys: Partial<Record<AppId, readonly string[]>> = {
  browser: ['initialUrl'],
  explorer: ['initialPath', 'path'],
  notepad: ['filePath'],
  photos: ['filePath', 'initialMediaId', 'initialMediaName', 'initialMediaExtension', 'cameraDirectView'],
  settings: ['tab'],
};

const defaultSnapshot = (): OsSessionSnapshot => ({
  windows: [],
  activeWindowId: null,
  currentDesktopId: 'desktop-1',
});

const safeText = (value: unknown, maxLength = 256): string | null =>
  typeof value === 'string' && value.length <= maxLength && !/[\u0000-\u001f]/.test(value)
    ? value
    : null;

const sanitizeBrowserUrl = (value: unknown): string | null => {
  const rawUrl = safeText(value, 2048);
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

const sanitizeWindowArgs = (appId: AppId, value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const allowedKeys = safeArgumentKeys[appId] || [];
  const sanitized: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    const argument = (value as Record<string, unknown>)[key];
    if (appId === 'browser' && key === 'initialUrl') {
      const safeUrl = sanitizeBrowserUrl(argument);
      if (safeUrl) sanitized[key] = safeUrl;
    } else if (key === 'cameraDirectView' && typeof argument === 'boolean') {
      sanitized[key] = argument;
    } else {
      const safeValue = safeText(argument, key === 'filePath' || key === 'initialPath' || key === 'path' ? 1024 : 256);
      if (safeValue !== null) sanitized[key] = safeValue;
    }
  }

  return Object.keys(sanitized).length ? sanitized : undefined;
};

const sanitizeWindow = (value: unknown, desktopIds: Set<string>): WindowState | null => {
  if (!value || typeof value !== 'object') return null;
  const window = value as Record<string, unknown>;
  if (typeof window.appId !== 'string' || !appIds.has(window.appId as AppId)) return null;
  const appId = window.appId as AppId;
  if (!visitorRestorableAppIds.has(appId)) return null;
  const position = window.position as Record<string, unknown> | null;
  const size = window.size as Record<string, unknown> | null;
  const x = position?.x;
  const y = position?.y;
  const width = size?.width;
  const height = size?.height;
  const zIndex = window.zIndex;
  const id = safeText(window.id, 128);

  if (
    !id ||
    typeof x !== 'number' || !Number.isFinite(x) ||
    typeof y !== 'number' || !Number.isFinite(y) ||
    typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
    typeof height !== 'number' || !Number.isFinite(height) || height <= 0 ||
    typeof zIndex !== 'number' || !Number.isFinite(zIndex)
  ) {
    return null;
  }

  const desktopId = safeText(window.desktopId, 128);
  const validDesktopId = desktopId && desktopIds.has(desktopId) ? desktopId : 'desktop-1';

  return {
    id,
    appId,
    title: safeText(window.title, 256) || APPS_LIST.find((app) => app.id === appId)?.name || appId,
    icon: safeText(window.icon, 128) || APPS_LIST.find((app) => app.id === appId)?.icon || '',
    isMinimized: window.isMinimized === true,
    isMaximized: window.isMaximized === true,
    isFocused: false,
    position: { x, y },
    size: { width, height },
    zIndex,
    desktopId: validDesktopId,
    args: sanitizeWindowArgs(appId, window.args),
  };
};

export const readOsSessionSnapshot = (
  storage: StorageLike,
  knownDesktopIds: string[] = ['desktop-1', 'desktop-2'],
  unavailableAppIds: readonly string[] = [],
): OsSessionSnapshot => {
  try {
    const serialized = storage.getItem(OS_SESSION_STORAGE_KEY);
    if (!serialized) return defaultSnapshot();
    const value = JSON.parse(serialized) as Record<string, unknown>;
    const desktopIds = new Set(knownDesktopIds.length ? knownDesktopIds : ['desktop-1']);
    const windows = Array.isArray(value.windows)
      ? value.windows
          .slice(0, 20)
          .map((window) => sanitizeWindow(window, desktopIds))
          .filter((window): window is WindowState => window !== null)
      : [];
    const uniqueWindows = windows.filter((window, index) =>
      windows.findIndex((candidate) => candidate.id === window.id) === index
    ).filter((window) => !unavailableAppIds.includes(window.appId));
    const activeWindowId = safeText(value.activeWindowId, 128);
    const activeWindow = uniqueWindows.find((window) => window.id === activeWindowId && !window.isMinimized)
      || uniqueWindows
        .filter((window) => !window.isMinimized)
        .sort((left, right) => right.zIndex - left.zIndex)[0]
      || null;
    const fallbackDesktopId = knownDesktopIds[0] || 'desktop-1';
    const savedDesktopId = safeText(value.currentDesktopId, 128);
    const currentDesktopId = savedDesktopId && desktopIds.has(savedDesktopId)
      ? savedDesktopId
      : fallbackDesktopId;

    return {
      windows: uniqueWindows.map((window) => ({
        ...window,
        isFocused: activeWindow?.id === window.id,
      })),
      activeWindowId: activeWindow?.id || null,
      currentDesktopId,
    };
  } catch {
    return defaultSnapshot();
  }
};

export const writeOsSessionSnapshot = (storage: StorageLike, snapshot: OsSessionSnapshot): void => {
  const knownDesktopIds = new Set([
    snapshot.currentDesktopId,
    ...snapshot.windows
      .map((window) => window.desktopId)
      .filter((desktopId): desktopId is string => typeof desktopId === 'string'),
  ]);
  const windows = snapshot.windows
    .slice(0, 20)
    .map((window) => sanitizeWindow(window, knownDesktopIds))
    .filter((window): window is WindowState => window !== null);
  const activeWindow = windows.find((window) =>
    window.id === snapshot.activeWindowId && !window.isMinimized
  );
  const sanitizedSnapshot: OsSessionSnapshot = {
    windows: windows.map((window) => ({
      ...window,
      isFocused: activeWindow?.id === window.id,
    })),
    activeWindowId: activeWindow?.id || null,
    currentDesktopId: safeText(snapshot.currentDesktopId, 128) || 'desktop-1',
  };
  storage.setItem(OS_SESSION_STORAGE_KEY, JSON.stringify(sanitizedSnapshot));
};
