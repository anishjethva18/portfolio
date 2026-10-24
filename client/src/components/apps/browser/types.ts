export interface TabItem {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  isLoading?: boolean;
  history: string[];
  historyIndex: number;
}

export interface ShortcutItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  color?: string;
}

export interface ChromeTheme {
  id: string;
  name: string;
  tabBg: string;
  toolbarBg: string;
  activeTabBg: string;
  wallpaperUrl: string;
  wallpaperArtist?: string;
  wallpaperTitle?: string;
}
