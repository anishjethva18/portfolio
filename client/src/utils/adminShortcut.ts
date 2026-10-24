export const ADMIN_SHORTCUT_STORAGE_KEY = 'portfolio_admin_keyboard_shortcut';
export const DEFAULT_ADMIN_SHORTCUT = 'Alt+A';
const PREVIOUS_DEFAULT_ADMIN_SHORTCUT = 'Ctrl+Alt+A';

function normalizeKey(key: string): string {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function getShortcutKey(event: KeyboardEvent): string {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  return normalizeKey(event.key);
}

export function formatAdminShortcut(event: KeyboardEvent): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return null;
  if (!event.ctrlKey && !event.altKey && !event.metaKey) return null;

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(getShortcutKey(event));
  return parts.join('+');
}

export function getAdminShortcut(): string {
  try {
    const saved = localStorage.getItem(ADMIN_SHORTCUT_STORAGE_KEY);
    if (saved === PREVIOUS_DEFAULT_ADMIN_SHORTCUT) {
      localStorage.setItem(ADMIN_SHORTCUT_STORAGE_KEY, DEFAULT_ADMIN_SHORTCUT);
      return DEFAULT_ADMIN_SHORTCUT;
    }
    return saved || DEFAULT_ADMIN_SHORTCUT;
  } catch {
    return DEFAULT_ADMIN_SHORTCUT;
  }
}

export function setAdminShortcut(shortcut: string): void {
  localStorage.setItem(ADMIN_SHORTCUT_STORAGE_KEY, shortcut);
}

export function matchesAdminShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const pressed = formatAdminShortcut(event);
  return pressed !== null && pressed.toLowerCase() === shortcut.toLowerCase();
}
