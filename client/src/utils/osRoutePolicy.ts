export const OS_LOCK_STORAGE_KEY = 'win11_portfolio_is_locked';

export interface SessionStorageReader {
  getItem(key: string): string | null;
}

export function getInitialLockState(pathname: string, storage: SessionStorageReader): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return true;
  if (path === '/home') return false;

  try {
    return storage.getItem(OS_LOCK_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}
