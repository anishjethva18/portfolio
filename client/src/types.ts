export type AppId =
  | 'about'
  | 'projects'
  | 'resume'
  | 'contact'
  | 'explorer'
  | 'terminal'
  | 'browser'
  | 'notepad'
  | 'settings'
  | 'taskmanager'
  | 'recycle'
  | 'minesweeper'
  | 'snake'
  | 'calculator'
  | 'camera'
  | 'photos'
  | 'admin';

export interface AppMetadata {
  id: AppId;
  name: string;
  icon: string; // Lucide icon identifier or custom svg key
  category: 'System' | 'Portfolio' | 'Utilities' | 'Games';
  description?: string;
  pinnedToTaskbar: boolean;
  pinnedToStart: boolean;
  desktopShortcut: boolean;
  defaultWidth: number;
  defaultHeight: number;
}

export interface VirtualDesktop {
  id: string;
  name: string;
}

export interface ClipboardHistoryEntry {
  id: string;
  type: 'text' | 'code' | 'link' | 'image';
  content: string;
  label?: string;
  pinned?: boolean;
  timestamp: string;
}

export interface WindowState {
  id: string; // unique instance id
  appId: AppId;
  title: string;
  icon: string;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  desktopId?: string; // Virtual desktop ID association
  args?: Record<string, any>; // Pass initial state, e.g. open file path in notepad/explorer
}

export interface DesktopIconItem {
  id: string;
  appId?: AppId;
  filePath?: string;
  url?: string;
  name: string;
  icon: string;
  position: { gridX: number; gridY: number };
  type: 'app' | 'folder' | 'file';
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  extension?: 'txt' | 'md' | 'json' | 'pdf' | 'png' | 'url' | 'lnk' | 'zip' | 'csv' | 'bin' | 'iso' | 'exe' | string;
  content?: string;
  size?: string;
  modified: string;
  deletedAt?: number; // timestamp in milliseconds when moved to recycle bin
  parentId: string; // parent folder path
  icon?: string;
  poster?: string;
  hidden?: boolean;
  readOnly?: boolean;
  legacyDHidden?: boolean;
  localCaptureId?: string;
  captureStatus?: 'local-only' | 'uploading' | 'archived' | 'archive-failed';
  archiveId?: string;
}

export type WallpaperId =
  | 'bloom'
  | 'darkbloom'
  | 'aurora'
  | 'cyberpunk'
  | 'sunset'
  | 'minimal'
  | 'live-matrix'
  | 'live-waves'
  | 'live-cyberpunk'
  | 'live-aurora'
  | 'custom';

export interface SystemSettings {
  wallpaper: WallpaperId;
  customWallpaperUrl?: string;
  theme: 'dark' | 'light' | 'auto';
  accentColor: string; // hex
  iconColor?: string; // hex for desktop/app icons
  syncIconColorWithAccent?: boolean;
  iconStyleMode?: 'outline_tint' | 'fluent_3d';
  transparency: boolean;
  iconSize: 'small' | 'medium' | 'large';
  clockFormat: '12h' | '24h';
  dateFormat?:
    | 'MM/DD/YYYY'
    | 'DD/MM/YYYY'
    | 'YYYY-MM-DD'
    | 'MMM D, YYYY'
    | 'ddd, MMM D, YYYY'
    | 'D MMMM YYYY'
    | 'DD-MM-YYYY';
  timeZone?: string;
  wifiEnabled?: boolean;
  wifiSSID?: string;
  bluetoothEnabled?: boolean;
  airplaneMode?: boolean;
  batterySaverEnabled?: boolean;
  nightLightEnabled?: boolean;
  nightLightIntensity?: number; // 0-100
  focusMode?: 'off' | 'priority' | 'alarms';
  gameModeEnabled?: boolean;
  highContrast?: boolean;
  textScale?: number; // 100-150%
  colorFilter?: 'none' | 'grayscale' | 'inverted' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  magnifierEnabled?: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0 to 1
  systemActionSoundsEnabled?: boolean;
  brightness: number; // 0.2 to 1
  taskbarAlignment: 'center' | 'left';
  taskbarAutoHide?: boolean;
  showSearchOnTaskbar?: 'box' | 'icon' | 'hide';
  showWidgetsOnTaskbar?: boolean;
  showWifiOnTaskbar?: boolean;
  showSoundOnTaskbar?: boolean;
  showBatteryOnTaskbar?: boolean;
  showNotificationsOnTaskbar?: boolean;
  showSecondsInClock?: boolean;
  showDateOnMobileStatusBar?: boolean;
  animationsEnabled: boolean;
  customAppIcons?: Record<string, string>;
  wallpaperFit?: 'fill' | 'fit' | 'stretch' | 'tile' | 'center' | 'span';
  lockScreenWallpaper?: string;
  customLockScreenUrl?: string;
  lockScreenFit?: 'fill' | 'fit' | 'stretch' | 'tile' | 'center' | 'span';
  lockPortrait?: boolean;
  hapticsEnabled?: boolean;
  showTouchKeyboardOnTaskbar?: boolean;
  lastSettingsTab?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'system' | 'error';
  appId?: AppId;
  actionApp?: AppId;
  read: boolean;
}

export interface ProcessMetric {
  appId: AppId;
  name: string;
  pid: number;
  cpu: number; // percentage
  memory: number; // MB
  status: 'Running' | 'Suspended';
}

export interface ProjectData {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  image: string;
  technologies: string[];
  features: string[];
  githubUrl: string;
  liveUrl?: string;
  stars?: number;
  featured: boolean;
  visible?: boolean;
  sortOrder?: number;
  slug?: string;
  type?: string;
  stack?: string;
  screenshots?: string[];
  overview?: string;
  summary?: string;
  caseStudy?: {
    goal?: string;
    approach?: string;
    architecture?: string[];
    engineeringHighlights?: string[];
    delivered?: string;
  };
}

export interface SkillCategory {
  id: string;
  title: string;
  normalizedName: string;
  icon: string;
  iconImage?: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  skills: SkillTechnology[];
}

export interface SkillTechnology {
  id: string;
  name: string;
  normalizedName: string;
  categoryId: string;
  iconIdentifier: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertiesTarget {
  name: string;
  type: string;
  location: string;
  size?: string;
  created?: string;
  modified?: string;
  icon?: string;
  drivePath?: string;
  usedGB?: string;
  freeGB?: string;
  totalGB?: string;
  fileSystem?: string;
  hidden?: boolean;
  readOnly?: boolean;
  file?: FileItem;
  item?: any;
}

export type ContextMenuType =
  | { type: 'desktop'; x: number; y: number }
  | { type: 'desktop-icon'; x: number; y: number; iconId: string }
  | { type: 'explorer-space'; x: number; y: number; currentPath: string }
  | { type: 'explorer-item'; x: number; y: number; file: FileItem; files?: FileItem[] }
  | { type: 'taskbar-space'; x: number; y: number }
  | { type: 'taskbar-app'; x: number; y: number; appId: AppId }
  | { type: 'start-app'; x: number; y: number; appId: AppId }
  | { type: 'browser-tab'; x: number; y: number; tabId: string }
  | null;

export interface ClipboardItem {
  file: FileItem;
  files?: FileItem[];
  action: 'copy' | 'cut';
}

export interface ExperienceItem {
  role: string;
  company: string;
  period: string;
  location: string;
  description: string[];
  skills: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  period: string;
  details: string;
}

export interface ContactSubmissionPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  _honeypot?: string;
  attachments?: Array<{
    name: string;
    path?: string;
    size?: string;
    type?: string;
    content?: string;
  }>;
}

export interface ContactSubmissionResponse {
  success: boolean;
  messageId?: string;
  timestamp?: string;
  status?: 'delivered' | 'failed' | 'simulated';
  emailSent?: boolean;
  provider?: string;
  receiver?: string;
  note?: string;
  error?: string;
  errors?: Record<string, string>;
  attachments?: Array<{
    name: string;
    path?: string;
    size?: string;
    type?: string;
  }>;
}
