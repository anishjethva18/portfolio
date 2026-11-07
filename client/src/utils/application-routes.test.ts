import assert from 'node:assert/strict';
import test from 'node:test';
import { APPS_LIST } from '../data/portfolioData';
import {
  APPLICATION_ROUTES,
  APPLICATION_ROUTE_SLUGS,
  getApplicationRoute,
  getPublicApplicationRoutes,
  getRestorableAppIds,
  isApplicationRouteAvailable,
  normalizeApplicationPath,
} from './applicationRoutes';

test('every registered application has a unique stable clean route', () => {
  assert.equal(APPLICATION_ROUTES.length, APPS_LIST.length);
  assert.equal(new Set(APPLICATION_ROUTES.map((route) => route.path)).size, APPS_LIST.length);
  for (const app of APPS_LIST) {
    assert.equal(typeof APPLICATION_ROUTE_SLUGS[app.id], 'string');
    assert.equal(APPLICATION_ROUTE_SLUGS[app.id].length > 0, true);
    assert.equal(APPLICATION_ROUTE_SLUGS[app.id].includes('#'), false);
  }
});

test('routes normalize trailing slashes and classify the protected admin application', () => {
  assert.equal(normalizeApplicationPath('/projects/'), '/projects');
  assert.equal(getApplicationRoute('/projects/')?.appId, 'projects');
  assert.equal(getApplicationRoute('/admin-control-center')?.access, 'admin-only');
  assert.equal(getApplicationRoute('/not-registered'), undefined);
});

test('published disabled applications cannot be opened or restored for visitors', () => {
  const disabledApps = ['browser', 'photos'];
  const browserRoute = getApplicationRoute('/web-browser');
  const projectsRoute = getApplicationRoute('/projects');
  assert.ok(browserRoute);
  assert.ok(projectsRoute);
  assert.equal(isApplicationRouteAvailable(browserRoute, disabledApps), false);
  assert.equal(isApplicationRouteAvailable(projectsRoute, disabledApps), true);
  assert.equal(getRestorableAppIds(disabledApps).includes('browser'), false);
  assert.equal(getRestorableAppIds(disabledApps).includes('photos'), false);
  assert.equal(getApplicationRoute('/admin-control-center')?.access, 'admin-only');
});

test('public application cards use registry URLs and exclude disabled or admin-only apps', () => {
  const routes = getPublicApplicationRoutes(['projects', 'camera']);
  assert.ok(routes.every((route) => route.access === 'public'));
  assert.ok(routes.every((route) => !['projects', 'camera', 'admin'].includes(route.appId)));
  assert.equal(routes.find((route) => route.appId === 'about')?.path, getApplicationRoute('/about-me')?.path);
  assert.ok(routes.every((route) => route.description.length > 0));
});
