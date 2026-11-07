import { APPS_LIST } from '../data/portfolioData';
import type { AppId, AppMetadata } from '../types';

export const APPLICATION_ROUTE_SLUGS: Record<AppId, string> = {
  about: 'about-me',
  calculator: 'calculator',
  camera: 'camera',
  contact: 'contact-me',
  explorer: 'file-explorer',
  photos: 'media',
  minesweeper: 'minesweeper',
  notepad: 'notepad',
  projects: 'projects',
  recycle: 'recycle-bin',
  resume: 'resume-cv',
  snake: 'retro-snake',
  settings: 'settings',
  taskmanager: 'task-manager',
  terminal: 'terminal',
  admin: 'admin-control-center',
  browser: 'web-browser',
};

export type ApplicationAccess = 'public' | 'admin-only';

export interface ApplicationRoute {
  app: AppMetadata;
  appId: AppId;
  slug: string;
  path: string;
  access: ApplicationAccess;
  description: string;
}

export const APPLICATION_DESCRIPTIONS: Record<AppId, string> = {
  about: 'A brief introduction to Anish and his professional profile.',
  calculator: 'Perform calculations in the desktop workspace.',
  camera: 'Capture photos with the portfolio camera.',
  contact: 'Find contact details and send a message.',
  explorer: 'Explore the portfolio’s interactive file workspace.',
  photos: 'View media in the portfolio workspace.',
  minesweeper: 'Play the classic logic puzzle.',
  notepad: 'Create and edit notes in the desktop workspace.',
  projects: 'Browse selected projects and published work.',
  recycle: 'Review deleted files in the virtual workspace.',
  resume: 'View or download the published CV.',
  snake: 'Play the retro Snake game.',
  settings: 'Personalize the desktop experience.',
  taskmanager: 'View running apps and system activity.',
  terminal: 'Use the portfolio’s command-line application.',
  admin: 'Manage published portfolio settings.',
  browser: 'Browse the web inside the desktop.',
};

export const APPLICATION_ROUTES: ApplicationRoute[] = APPS_LIST.map((app) => ({
  app,
  appId: app.id,
  slug: APPLICATION_ROUTE_SLUGS[app.id],
  path: `/${APPLICATION_ROUTE_SLUGS[app.id]}`,
  access: app.id === 'admin' ? 'admin-only' : 'public',
  description: APPLICATION_DESCRIPTIONS[app.id],
}));

const routeByPath = new Map(APPLICATION_ROUTES.map((route) => [route.path, route]));

export const normalizeApplicationPath = (pathname: string): string => {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
};

export const getApplicationRoute = (pathname: string): ApplicationRoute | undefined =>
  routeByPath.get(normalizeApplicationPath(pathname));

export const getApplicationRouteById = (appId: AppId): ApplicationRoute | undefined =>
  APPLICATION_ROUTES.find((route) => route.appId === appId);

export const isApplicationRouteAvailable = (
  route: ApplicationRoute,
  disabledAppIds: readonly string[],
): boolean => route.access === 'admin-only' || !disabledAppIds.includes(route.appId);

export const getRestorableAppIds = (disabledAppIds: readonly string[]): AppId[] =>
  APPLICATION_ROUTES
    .filter((route) => route.access === 'public' && !disabledAppIds.includes(route.appId))
    .map((route) => route.appId);

export const getPublicApplicationRoutes = (disabledAppIds: readonly string[]): ApplicationRoute[] =>
  APPLICATION_ROUTES.filter((route) =>
    route.access === 'public' && !disabledAppIds.includes(route.appId)
  );

export const PUBLIC_APPLICATION_COUNT = APPLICATION_ROUTES.filter((route) => route.access === 'public').length;
