import type { WallpaperId } from '../types';

const WALLPAPER_BY_SITE_VALUE: Record<string, WallpaperId> = {
  bloom: 'bloom',
  darkbloom: 'darkbloom',
  aurora: 'aurora',
  cyberpunk: 'cyberpunk',
  sunset: 'sunset',
  minimal: 'minimal',
  'live-matrix': 'live-matrix',
  'live-waves': 'live-waves',
  'live-cyberpunk': 'live-cyberpunk',
  'live-aurora': 'live-aurora',
  'Windows11.jpg': 'darkbloom',
  'Windows_11.jpg': 'bloom',
  'Glow.jpg': 'aurora',
  'Sunrise.jpg': 'sunset',
  'Flow.jpg': 'live-waves',
};

export function getDefaultDesktopWallpaper(value: unknown): WallpaperId | undefined {
  return typeof value === 'string' ? WALLPAPER_BY_SITE_VALUE[value] : undefined;
}
