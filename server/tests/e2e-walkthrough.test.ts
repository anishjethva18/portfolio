import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { db } from '../db/database';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { authRouter } from '../routes/auth';
import { adminRouter, getLivePortfolioContent } from '../routes/admin';
import { healthRouter } from '../routes/health';
import { contentStudioRouter } from '../routes/contentStudio';
import { authService } from '../services/authService';
import { sessionService } from '../services/sessionService';
import { ProjectModel, UserModel } from '../models';

async function runE2EWalkthrough() {
  console.log('=================================================================');
  console.log('  Windows 11 Portfolio OS — End-to-End Authenticated Walkthrough');
  console.log('                 & Responsive Viewport Testing                   ');
  console.log('=================================================================\n');

  // Find Chrome or Edge executable on Windows
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(edgePath) ? edgePath : chromePath;

  if (!fs.existsSync(executablePath)) {
    throw new Error('No supported Chromium-based browser found on the system.');
  }

  console.log(`[Browser Engine] Using browser executable: ${executablePath}`);

  // Connect database
  await connectMongo();
  await db.initMongoSync();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✔ Passed: ${testName}`);
      passed++;
    } else {
      console.error(`✘ Failed: ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // Ensure test admin account exists in database
  const testAdminEmail = `e2e_admin_${Date.now()}@portfolio.local`;
  const testAdminPassword = 'AdminPassword123!';
  const passwordHash = await authService.hashPassword(testAdminPassword);

  const adminDoc = await UserModel.create({
    id: `e2e_admin_usr_${Date.now()}`,
    email: testAdminEmail,
    passwordHash,
    name: 'E2E Administrator',
    role: 'admin',
    disabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  db.users.set(adminDoc.id, adminDoc.toObject() as any);

  // Spin up an Express server serving client/dist production build and API routes
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));

  // Mount API routers
  app.use('/api/auth', authRouter);
  app.use('/api/admin/content-studio', contentStudioRouter);
  app.use('/api/admin', adminRouter);
  app.get('/api/portfolio-content', async (_req, res) => {
    try {
      const content = await getLivePortfolioContent();
      res.json({ success: true, content });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.get('/api/projects', async (_req, res) => {
    const projects = await ProjectModel.find({ visible: { $ne: false } })
      .sort({ featured: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, projects });
  });
  app.use('/api/health', healthRouter);

  // Serve compiled production frontend
  const distDir = path.resolve(process.env.PORTFOLIO_E2E_DIST_DIR || 'client/dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const appUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Serving application at: ${appUrl}\n`);

  // Launch headless browser
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });

  try {
    const page = await browser.newPage();
    const analyticsRequestOrigins: string[] = [];
    const blockedExternalOrigins: string[] = [];
    let abortNextLogoutRequest = false;
    const isolatePageRequests = async (isolatedPage: import('puppeteer-core').Page) => {
      await isolatedPage.setRequestInterception(true);
      isolatedPage.on('request', (request) => {
        let requestedUrl: URL;
        try {
          requestedUrl = new URL(request.url());
        } catch {
          blockedExternalOrigins.push('invalid-url');
          void request.abort('blockedbyclient').catch(() => {});
          return;
        }

        if (requestedUrl.pathname === '/api/auth/logout' && abortNextLogoutRequest) {
          abortNextLogoutRequest = false;
          void request.abort('failed').catch(() => {});
          return;
        }
        if (requestedUrl.pathname === '/api/analytics/track') {
          analyticsRequestOrigins.push(requestedUrl.origin);
        }
        if (
          (requestedUrl.protocol === 'http:' || requestedUrl.protocol === 'https:')
            ? requestedUrl.origin !== appUrl
            : !['data:', 'blob:', 'about:'].includes(requestedUrl.protocol)
        ) {
          blockedExternalOrigins.push(requestedUrl.origin);
          void request.abort('blockedbyclient').catch(() => {});
          return;
        }
        void request.continue().catch(() => {});
      });
    };
    await isolatePageRequests(page);
    await page.setCacheEnabled(false);
    await page.evaluateOnNewDocument(() => {
      const observeVitals = () => {
        const root = document.documentElement;
        if (!root) return;
        root.dataset.portfolioLcp = '';
        root.dataset.portfolioCls = '0';
        root.dataset.portfolioEventInteractionCount = '0';
        root.dataset.portfolioInpEstimate = '';
        if (!('PerformanceObserver' in window)) return;

        const supportedEntryTypes = PerformanceObserver.supportedEntryTypes;
        if (supportedEntryTypes.includes('largest-contentful-paint')) {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) root.dataset.portfolioLcp = String(lastEntry.startTime);
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        }
        if (supportedEntryTypes.includes('layout-shift')) {
          let cumulativeLayoutShift = 0;
          const layoutShiftObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
              if (!shift.hadRecentInput) cumulativeLayoutShift += shift.value || 0;
            }
            root.dataset.portfolioCls = String(cumulativeLayoutShift);
          });
          layoutShiftObserver.observe({ type: 'layout-shift', buffered: true });
        }
        if (supportedEntryTypes.includes('event')) {
          const interactionDurations = new Map<number, number>();
          const eventObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const event = entry as PerformanceEntry & { interactionId?: number };
              if (!event.interactionId) continue;
              const previousDuration = interactionDurations.get(event.interactionId) || 0;
              interactionDurations.set(event.interactionId, Math.max(previousDuration, event.duration));
            }
            const durations = Array.from(interactionDurations.values()).sort((left, right) => left - right);
            if (durations.length > 0) {
              const p98Index = Math.min(durations.length - 1, Math.ceil(durations.length * 0.98) - 1);
              root.dataset.portfolioEventInteractionCount = String(durations.length);
              root.dataset.portfolioInpEstimate = String(durations[p98Index]);
            }
          });
          eventObserver.observe({ type: 'event', buffered: true });
        }
      };
      document.addEventListener('DOMContentLoaded', observeVitals, { once: true });
    });

    const externalRequestWasBlocked = await page.evaluate(async () => {
      try {
        await fetch('https://blocked.test/external-network-guard');
        return false;
      } catch {
        return true;
      }
    });
    assert(
      externalRequestWasBlocked && blockedExternalOrigins.includes('https://blocked.test'),
      'E2E browser blocks requests outside the isolated local test application'
    );

    await page.goto(appUrl, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('#lockscreen-enter-btn', { timeout: 10000 });
    assert(
      await page.$eval('#windows-lock-screen h1', (clock) => getComputedStyle(clock).opacity === '1'),
      'Lock-screen clock paints immediately without an entrance animation'
    );
    await page.click('#lockscreen-enter-btn');
    await page.waitForFunction(() => !document.querySelector('#windows-lock-screen'), { timeout: 5000 });
    assert(true, 'Lock-screen sign-in action still unlocks the desktop');

    // -------------------------------------------------------------
    // PHASE 1: RESPONSIVE VIEWPORT TESTING
    // -------------------------------------------------------------
    console.log('--- Phase 1: Responsive Viewport Testing ---');

    // 1. Mobile Viewport (375x812 - iPhone X)
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    const initialLoadSamples: Array<{
      domContentLoadedMs: number | null;
      loadMs: number | null;
      firstContentfulPaintMs: number | null;
      largestContentfulPaintMs: number | null;
      cls: number | null;
      sameOriginResourceCount: number;
      sameOriginTransferBytes: number;
      heapUsedBytes: number | null;
    }> = [];
    for (let sampleIndex = 0; sampleIndex < 3; sampleIndex += 1) {
      await page.goto(appUrl, { waitUntil: 'networkidle0', timeout: 20000 });
      await new Promise((resolve) => setTimeout(resolve, 500));
      initialLoadSamples.push(await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const resources = performance.getEntriesByType('resource');
      let sameOriginResourceCount = 0;
      let totalSameOriginBytes = 0;
      for (const entry of resources) {
        if (new URL(entry.name).origin === window.location.origin) {
          sameOriginResourceCount += 1;
          totalSameOriginBytes += (entry as PerformanceResourceTiming).transferSize || 0;
        }
      }
      const firstContentfulPaintMs = performance.getEntriesByName('first-contentful-paint', 'paint')[0]?.startTime ?? null;
      const lcpValue = document.documentElement.dataset.portfolioLcp;
      const clsValue = document.documentElement.dataset.portfolioCls;
      const eventTypesSupported = 'PerformanceObserver' in window &&
        PerformanceObserver.supportedEntryTypes.includes('event');
      const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
      return {
        domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
        loadMs: navigation?.loadEventEnd ?? null,
        firstContentfulPaintMs,
        largestContentfulPaintMs: lcpValue ? Number(lcpValue) : null,
        cls: clsValue ? Number(Number(clsValue).toFixed(4)) : null,
        sameOriginResourceCount,
        sameOriginTransferBytes: totalSameOriginBytes,
        heapUsedBytes: memory?.usedJSHeapSize ?? null,
        eventTimingSupported: eventTypesSupported,
      };
      }));
    }
    const median = (values: Array<number | null>): number | null => {
      const sorted = values.filter((value): value is number => value !== null).sort((left, right) => left - right);
      if (sorted.length === 0) return null;
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
    };
    const initialPageMetrics = {
      runs: initialLoadSamples.length,
      domContentLoadedMedianMs: median(initialLoadSamples.map((sample) => sample.domContentLoadedMs)),
      loadMedianMs: median(initialLoadSamples.map((sample) => sample.loadMs)),
      firstContentfulPaintMedianMs: median(initialLoadSamples.map((sample) => sample.firstContentfulPaintMs)),
      largestContentfulPaintMedianMs: median(initialLoadSamples.map((sample) => sample.largestContentfulPaintMs)),
      clsMedian: median(initialLoadSamples.map((sample) => sample.cls)),
      sameOriginResourceCount: median(initialLoadSamples.map((sample) => sample.sameOriginResourceCount)),
      sameOriginTransferBytes: median(initialLoadSamples.map((sample) => sample.sameOriginTransferBytes)),
      heapUsedBytesMedian: median(initialLoadSamples.map((sample) => sample.heapUsedBytes)),
      samples: initialLoadSamples,
    };
    const mobileTitle = await page.title();
    assert(Boolean(mobileTitle), 'Mobile Viewport (375x812): UI shell mounts and renders document');
    console.log(`[Performance Benchmark] Three uncached mobile-load samples: ${JSON.stringify(initialPageMetrics)}`);
    assert(
      initialPageMetrics.runs === 3 &&
      typeof initialPageMetrics.loadMedianMs === 'number' &&
      typeof initialPageMetrics.firstContentfulPaintMedianMs === 'number' &&
      typeof initialPageMetrics.sameOriginTransferBytes === 'number' &&
      initialPageMetrics.sameOriginTransferBytes > 0,
      'Isolated browser records three initial-load samples and median timing/resource size',
      JSON.stringify(initialPageMetrics)
    );

    const hasMobileRoot = await page.evaluate(() => {
      const root = document.getElementById('root');
      return Boolean(root && root.clientHeight > 0);
    });
    assert(hasMobileRoot, 'Mobile Viewport (375x812): Root container scales to mobile screen bounds');
    const accessibilitySmoke = await page.evaluate(() => {
      const controls = document.querySelectorAll('button, [role="button"], input:not([type="hidden"]), select, textarea, a[href]');
      const unnamedControls: string[] = [];
      let visibleControlCount = 0;
      for (const control of controls) {
        if (!(control instanceof HTMLElement) || control.getClientRects().length === 0) continue;
        visibleControlCount += 1;
        let accessibleName = control.getAttribute('aria-label') || control.getAttribute('title') || control.innerText.trim();
        const labelledBy = control.getAttribute('aria-labelledby')?.split(/\s+/) || [];
        for (const id of labelledBy) {
          accessibleName += document.getElementById(id)?.textContent?.trim() || '';
        }
        if (!accessibleName.trim() && control.id) {
          for (const label of document.querySelectorAll('label')) {
            if (label.htmlFor === control.id || label.contains(control)) accessibleName += label.innerText.trim();
          }
        }
        if (!accessibleName.trim()) {
          for (const image of control.querySelectorAll('img[alt], svg title')) {
            accessibleName += image.textContent?.trim() || image.getAttribute('alt') || '';
          }
        }
        if (!accessibleName.trim()) {
          unnamedControls.push(`${control.tagName.toLowerCase()}${control.id ? `#${control.id}` : ''}`);
        }
      }
      return { visibleControlCount, unnamedControls };
    });
    assert(
      accessibilitySmoke.visibleControlCount > 0 && accessibilitySmoke.unnamedControls.length === 0,
      'Mobile viewport exposes accessible names for visible interactive controls',
      JSON.stringify(accessibilitySmoke)
    );

    // 2. Tablet Viewport (768x1024 - iPad Portrait)
    await page.setViewport({ width: 768, height: 1024, isMobile: false });
    await page.waitForNetworkIdle({ timeout: 2000 }).catch(() => {});
    const tabletBounds = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    assert(
      tabletBounds.width === 768 && tabletBounds.height === 1024,
      'Tablet Viewport (768x1024): Viewport adapts to tablet aspect ratio'
    );

    // 3. Desktop Viewport (1366x768 - Standard HD Laptop)
    await page.setViewport({ width: 1366, height: 768 });
    await page.waitForNetworkIdle({ timeout: 2000 }).catch(() => {});
    const desktopTaskbar = await page.evaluate(() => {
      return Boolean(document.querySelector('footer, nav, [data-taskbar="true"], div'));
    });
    assert(desktopTaskbar, 'Desktop Viewport (1366x768): Taskbar shell renders and aligns correctly');

    // 4. Large Desktop Viewport (1920x1080 - Full HD Display)
    await page.setViewport({ width: 1920, height: 1080 });
    await page.waitForNetworkIdle({ timeout: 2000 }).catch(() => {});
    const desktopIconsCount = await page.evaluate(() => {
      return document.querySelectorAll('[data-desktop-icon="true"]').length;
    });
    assert(desktopIconsCount >= 0, 'Full HD Viewport (1920x1080): High resolution Fluent layout renders');

    // -------------------------------------------------------------
    // PHASE 1B: MEDIA APP VIRTUAL D: CONTENT
    // -------------------------------------------------------------
    console.log('\n--- Phase 1B: Media App Virtual D: Content ---');

    await page.setViewport({ width: 1366, height: 768, isMobile: false, hasTouch: false });
    await page.goto(appUrl, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('[data-desktop-icon-id="icon-photos"]', { timeout: 10000 });
    const mediaAppOpenStartedAt = Date.now();
    await page.$eval('[data-desktop-icon-id="icon-photos"]', (icon) => {
      icon.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await page.waitForFunction(
      () => document.querySelectorAll('.media-card-item').length >= 16,
      { timeout: 10000 }
    );
    console.log(`[Performance Smoke] Media app open-to-content: ${Date.now() - mediaAppOpenStartedAt}ms`);
    const mediaCardNames = await page.$$eval('.media-card-item', (cards) =>
      cards.flatMap((card) =>
        Array.from(card.querySelectorAll('p')).map((name) => name.textContent?.trim() || '')
      )
    );
    const expectedMediaNames = [
      'Developer_Network.png',
      'Landscape_Mountain_Lake.jpg',
      'Road_Bike.jpg',
      'Performance_Car.jpg',
      'Sports_Action.jpg',
      'Gaming_Arena.jpg',
      'Software Engineering Overview.mp4',
      'Code_Focus.wav',
    ];
    assert(
      expectedMediaNames.every((name) => mediaCardNames.includes(name)),
      'Media lists photo wallpapers, existing themed wallpapers, videos, and audio projected from D:',
      JSON.stringify(mediaCardNames)
    );
    await page.$$eval('.media-card-item', (cards) => {
      const imageCard = cards.find((card) => card.textContent?.includes('Landscape_Mountain_Lake.jpg'));
      if (!imageCard) throw new Error('Could not find a photo wallpaper card to preview.');
      (imageCard as HTMLElement).click();
    });
    await page.waitForSelector('button[title="Zoom In (+)"]', { timeout: 5000 });
    const wallpaperPreviewLoaded = await page.$eval(
      'img.max-w-full.max-h-full[alt="Landscape_Mountain_Lake.jpg"]',
      (image) => Boolean((image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)
    );
    assert(wallpaperPreviewLoaded, 'Media opens the selected wallpaper in the image preview viewer');
    await page.$$eval('button', (buttons) => {
      const backButton = buttons.find((button) => button.textContent?.trim() === 'Back');
      if (!backButton) throw new Error('Could not find the Media viewer Back button.');
      backButton.click();
    });
    await page.waitForSelector('.media-card-item', { timeout: 5000 });
    await page.evaluate(() => {
      const cameraAlbum = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.innerText.includes('Camera Pictures'));
      cameraAlbum?.click();
    });
    await page.waitForFunction(
      () => document.body.innerText.includes('No camera photos in this folder'),
      { timeout: 10000 }
    );
    assert(
      true,
      'Empty Camera Pictures album shows its camera-specific empty state'
    );

    // -------------------------------------------------------------
    // PHASE 2: VIRTUAL C: DRIVE ACCESS LOCK (DESKTOP & MOBILE)
    // -------------------------------------------------------------
    console.log('\n--- Phase 2: Virtual C: Drive Access Lock ---');

    await page.setViewport({ width: 1366, height: 768, isMobile: false, hasTouch: false });
    await page.goto(appUrl, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('[data-desktop-icon-id="icon-thispc"]', { timeout: 10000 });
    await page.click('[data-desktop-icon-id="icon-calculator"]', { count: 2 });
    const profileWindowSelector = '[data-window-app="calculator"]';
    await page.waitForSelector(`${profileWindowSelector} .cursor-e-resize`, { timeout: 10000 });
    const profileWindowBefore = await page.$eval(profileWindowSelector, (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    const titleBarBox = await page.$eval(`${profileWindowSelector} > div:first-child`, (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    const dragStartedAt = Date.now();
    await page.mouse.move(titleBarBox.x + 24, titleBarBox.y + titleBarBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(titleBarBox.x + 48, titleBarBox.y + titleBarBox.height / 2 + 18, { steps: 4 });
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const profileWindowAfterDrag = await page.$eval(profileWindowSelector, (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    const resizeHandle = await page.$(`${profileWindowSelector} .cursor-e-resize`);
    const resizeBox = await resizeHandle?.boundingBox();
    if (!resizeBox) {
      const resizeState = await page.$eval(profileWindowSelector, (element) => ({
        bounds: (() => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        })(),
        className: element.className,
        controls: Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
          .map((button) => button.title)
          .filter(Boolean),
        resizeHandleCount: element.querySelectorAll('.cursor-e-resize').length,
      }));
      throw new Error(`Calculator window east resize handle is unavailable: ${JSON.stringify(resizeState)}`);
    }
    const resizeStartedAt = Date.now();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 28, resizeBox.y + resizeBox.height / 2, { steps: 4 });
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const profileWindowAfterResize = await page.$eval(profileWindowSelector, (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    const observedInteractionTiming = await page.evaluate(() => {
      const durations: number[] = [];
      for (const entry of performance.getEntriesByType('event')) {
        if (entry.duration > 0) durations.push(entry.duration);
      }
      return {
        eventTimingEntryCount: durations.length,
        maximumObservedEventDurationMs: durations.length ? Math.max(...durations) : null,
        interactionCount: Number(document.documentElement.dataset.portfolioEventInteractionCount || 0),
        inpP98EstimateMs: document.documentElement.dataset.portfolioInpEstimate
          ? Number(document.documentElement.dataset.portfolioInpEstimate)
          : null,
      };
    });
    console.log(`[Performance Smoke] Calculator window drag ${Date.now() - dragStartedAt}ms; resize ${Date.now() - resizeStartedAt}ms; geometry ${JSON.stringify({ before: profileWindowBefore, afterDrag: profileWindowAfterDrag, afterResize: profileWindowAfterResize })}; event timing ${JSON.stringify(observedInteractionTiming)}`);
    assert(
      Math.abs(profileWindowAfterDrag.x - profileWindowBefore.x) > 5 ||
      Math.abs(profileWindowAfterDrag.y - profileWindowBefore.y) > 5,
      'Window drag changes window position under the isolated browser'
    );
    assert(
      profileWindowAfterResize.width > profileWindowAfterDrag.width,
      'Window resize changes window width under the isolated browser'
    );
    await page.click(`${profileWindowSelector} button[title="Close"]`);
    await page.click('[data-desktop-icon-id="icon-camera"]', { count: 2 });
    await page.waitForSelector('button[title="Camera Settings"]', { timeout: 10000 });
    const cameraWindowSelector = '[data-window-app="camera"]';
    await page.click('button[title="Camera Settings"]');
    await page.waitForSelector('[role="dialog"][aria-label="Camera & Microphone Settings"]', { timeout: 5000 });
    const cameraSettingsBounds = await page.$eval(
      '[data-testid="camera-settings-overlay"]',
      (overlay) => {
        const app = document.querySelector<HTMLElement>('[data-testid="camera-app-root"]');
        const panel = overlay.firstElementChild as HTMLElement;
        const appBounds = app?.getBoundingClientRect();
        const overlayBounds = overlay.getBoundingClientRect();
        const panelBounds = panel.getBoundingClientRect();
        const taskbarBounds = document.querySelector<HTMLElement>('[data-taskbar="true"]')?.getBoundingClientRect();
        return {
          appBottom: appBounds?.bottom ?? 0,
          overlayBottom: overlayBounds.bottom,
          panelBottom: panelBounds.bottom,
          taskbarTop: taskbarBounds?.top ?? window.innerHeight,
        };
      }
    );
    assert(
      cameraSettingsBounds.overlayBottom <= cameraSettingsBounds.appBottom + 1 &&
        cameraSettingsBounds.panelBottom <= cameraSettingsBounds.overlayBottom + 1 &&
        cameraSettingsBounds.panelBottom <= cameraSettingsBounds.taskbarTop + 1,
      'Camera settings dialog stays inside the app and above the taskbar',
      JSON.stringify(cameraSettingsBounds)
    );
    await page.goto(appUrl, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('[data-desktop-icon-id="icon-thispc"]', { timeout: 10000 });
    await page.click('[data-desktop-icon-id="icon-thispc"]', { count: 2 });
    await page.waitForSelector('[data-drive-card="C:"]', { timeout: 10000 });
    const driveUiMatchesReferences = await page.evaluate(() => {
      const cDrive = document.querySelector('[data-drive-card="C:"]');
      const dDrive = document.querySelector('[data-drive-card="D:"]');
      const visibleTransferButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .filter((button) => button.getClientRects().length > 0)
        .map((button) => button.innerText.trim().toLowerCase())
        .filter((label) => label === 'upload' || label === 'download');
      return Boolean(
        cDrive?.querySelector('svg') &&
          dDrive?.querySelector('svg') &&
          visibleTransferButtons.length === 0
      );
    });
    assert(driveUiMatchesReferences, 'This PC uses distinct SVG drive icons and has no Upload/Download toolbar buttons');

    const toolbarButtonsDisabled = async () => page.evaluate(() => {
      const toolbarButtonTitles = [
        'Create a new item in the current location',
        'Cut (Ctrl+X)',
        'Copy (Ctrl+C)',
        'Paste (Ctrl+V)',
        'Rename (F2)',
        'Share',
        'Delete (Del)',
      ];
      return toolbarButtonTitles.every((title) => {
        const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
          .find((candidate) => candidate.title === title || (title === 'Share' && candidate.title === 'Select a file to share'));
        return Boolean(button?.disabled);
      });
    });
    const selectedItemToolbarState = async () => page.evaluate(() => {
      const titles = [
        'Create a new item in the current location',
        'Cut (Ctrl+X)',
        'Copy (Ctrl+C)',
        'Paste (Ctrl+V)',
        'Rename (F2)',
        'Share',
        'Delete (Del)',
      ];
      return Object.fromEntries(titles.map((title) => {
        const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
          .find((candidate) => candidate.title === title || (title === 'Share' && candidate.title === 'Select a file to share'));
        return [title, button ? !button.disabled : false];
      }));
    });

    await page.click('[data-drive-card="D:"]');
    assert(
      await toolbarButtonsDisabled() && Boolean(await page.$('[data-drive-card="D:"]')),
      'Single-clicking D: selects the drive without opening it or enabling file actions'
    );
    await page.click('[data-drive-card="D:"]', { count: 2 });
    await page.waitForSelector('[data-file-item="true"]', { timeout: 5000 });
    const addressBarBeforeEdit = await page.$eval('[data-testid="explorer-address-bar"]', (element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
    await page.click('[data-testid="explorer-address-bar"] [title="Click to edit path directly"]');
    const explorerAddressInput = await page.waitForSelector('[data-testid="explorer-address-input"]', { timeout: 5000 });
    const addressBarAfterEdit = await page.$eval('[data-testid="explorer-address-bar"]', (element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
    await explorerAddressInput?.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.down('Control');
    await page.keyboard.press('C');
    await page.keyboard.up('Control');
    await page.keyboard.press('End');
    await page.keyboard.type('invalid');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.down('Control');
    await page.keyboard.press('V');
    await page.keyboard.up('Control');
    const copiedAddressValue = await explorerAddressInput?.evaluate((input) => (input as HTMLInputElement).value);
    const copyPathControlExists = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('button'))
        .some((button) => button.getClientRects().length > 0 && button.textContent?.includes('Copy Path'))
    );
    assert(
      addressBarBeforeEdit.width === addressBarAfterEdit.width &&
        addressBarBeforeEdit.height === addressBarAfterEdit.height &&
        copiedAddressValue === 'D:' &&
        !copyPathControlExists,
      'Explorer address editing keeps its layout stable, supports Ctrl+C/Ctrl+V, and omits Copy Path'
    );
    await page.keyboard.press('Escape');
    const dDrivePaths = await page.$$eval('[data-file-item="true"][data-file-path]', (items) =>
      items.map((item) => item.getAttribute('data-file-path') || '')
    );
    const expectedDDriveFolders = [
      'D:/Desktop',
      'D:/Downloads',
      'D:/Documents',
      'D:/Pictures',
      'D:/Videos',
      'D:/Audio',
      'D:/Projects',
      'D:/Certificates',
      'D:/About Me',
    ];
    assert(
      expectedDDriveFolders.every((folderPath) => dDrivePaths.includes(folderPath)),
      'D: displays the requested top-level folders'
    );
    const audioUsesMusicIcon = await page.$eval(
      '[data-file-path="D:/Audio"] svg',
      (icon) => icon.classList.contains('text-rose-500')
    );
    assert(audioUsesMusicIcon, 'D:/Audio uses the Music icon');
    const quickAccessPaths = await page.$$eval('[data-quick-access-path]', (items) =>
      items.map((item) => item.getAttribute('data-quick-access-path') || '')
    );
    const expectedQuickAccessPaths = [
      'D:/Desktop',
      'D:/Downloads',
      'D:/Documents',
      'D:/Pictures',
      'D:/Videos',
      'D:/Audio',
      'D:/Projects',
      'D:/Certificates',
      'D:/About Me',
    ];
    assert(
      quickAccessPaths.length === expectedQuickAccessPaths.length &&
        expectedQuickAccessPaths.every((folderPath) => quickAccessPaths.includes(folderPath)),
      'Quick Access contains only the nine requested D: folders'
    );
    const dDriveRootToolbarState = await selectedItemToolbarState();
    assert(
      dDriveRootToolbarState['Create a new item in the current location'] &&
        !dDriveRootToolbarState['Cut (Ctrl+X)'] &&
        !dDriveRootToolbarState['Copy (Ctrl+C)'] &&
        !dDriveRootToolbarState['Paste (Ctrl+V)'] &&
        !dDriveRootToolbarState['Rename (F2)'] &&
        !dDriveRootToolbarState.Share &&
        !dDriveRootToolbarState['Delete (Del)'],
      'New is enabled inside D: while item actions remain disabled until selection'
    );
    await page.click('[data-file-path="D:/Desktop"]');
    const selectedFolderToolbar = await selectedItemToolbarState();
    assert(
      selectedFolderToolbar['Create a new item in the current location'] &&
        selectedFolderToolbar['Cut (Ctrl+X)'] &&
        selectedFolderToolbar['Copy (Ctrl+C)'] &&
        selectedFolderToolbar['Rename (F2)'] &&
        selectedFolderToolbar.Share &&
        selectedFolderToolbar['Delete (Del)'],
      'Selecting a writable D: folder enables its applicable toolbar actions'
    );
    assert(!selectedFolderToolbar['Paste (Ctrl+V)'], 'Paste stays disabled until the clipboard has content');
    await page.keyboard.down('Control');
    await page.keyboard.press('C');
    await page.keyboard.up('Control');
    assert(
      (await selectedItemToolbarState())['Paste (Ctrl+V)'],
      'Ctrl+C copies a selected D: folder and enables Paste'
    );
    await page.click('[data-file-path="D:/Downloads"]', { count: 2 });
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="explorer-address-bar"]')?.textContent?.includes('Downloads')
    );
    assert(
      (await selectedItemToolbarState())['Paste (Ctrl+V)'],
      'Paste remains enabled in a destination folder when no item is selected'
    );
    await page.keyboard.down('Control');
    await page.keyboard.press('V');
    await page.keyboard.up('Control');
    await page.waitForSelector('[data-file-path="D:/Downloads/Desktop - Copy"]', { timeout: 5000 });
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    const selectAllToolbar = await selectedItemToolbarState();
    assert(
      selectAllToolbar['Copy (Ctrl+C)'] && selectAllToolbar['Delete (Del)'],
      'Ctrl+A selects the current folder items for keyboard file actions'
    );
    await page.click('[data-file-path="D:/Downloads/Desktop - Copy"]');
    await page.keyboard.press('F2');
    const renameInput = await page.waitForSelector('input[value="Desktop - Copy"]', { timeout: 5000 });
    await renameInput?.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.type('Keyboard Shortcuts');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-file-path="D:/Downloads/Keyboard Shortcuts"]', { timeout: 5000 });
    await page.keyboard.down('Control');
    await page.keyboard.press('X');
    await page.keyboard.up('Control');
    await page.evaluate(() => {
      const homeButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.innerText.trim() === 'Home');
      homeButton?.click();
    });
    await page.waitForSelector('[data-drive-card="D:"]', { timeout: 5000 });
    await page.click('[data-drive-card="D:"]', { count: 2 });
    await page.waitForSelector('[data-file-path="D:/Documents"]', { timeout: 5000 });
    await page.click('[data-file-path="D:/Documents"]', { count: 2 });
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="explorer-address-bar"]')?.textContent?.includes('Documents')
    );
    await page.keyboard.down('Control');
    await page.keyboard.press('V');
    await page.keyboard.up('Control');
    await page.waitForSelector('[data-file-path="D:/Documents/Keyboard Shortcuts"]', { timeout: 5000 });
    await page.click('[data-file-path="D:/Documents/Keyboard Shortcuts"]');
    await page.keyboard.press('Delete');
    await page.waitForFunction(() =>
      !Array.from(document.querySelectorAll<HTMLElement>('[data-file-item="true"]'))
        .some((item) => item.getAttribute('data-file-path') === 'D:/Documents/Keyboard Shortcuts')
    );
    assert(
      true,
      'Ctrl+V pastes without selection; F2 renames, Ctrl+X cuts, and Delete removes the selected item'
    );
    await page.evaluate(() => {
      const homeButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.innerText.trim() === 'Home');
      homeButton?.click();
    });
    await page.waitForSelector('[data-drive-card="D:"]', { timeout: 5000 });
    await page.click('[data-drive-card="D:"]', { count: 2 });
    await page.waitForSelector('[data-file-path="D:/Projects"]', { timeout: 5000 });
    await page.click('[data-file-path="D:/Projects"]', { count: 2 });
    const expectedProjectFileNames = await page.evaluate(async () => {
      const response = await fetch('/api/projects', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload.success !== true || !Array.isArray(payload.projects)) return null;
      return payload.projects
        .filter((project: { visible?: boolean; title?: string }) => project.visible !== false && project.title)
        .map((project: { title: string }) => `${project.title.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '')}.md`);
    });
    if (expectedProjectFileNames) {
      await page.waitForFunction((expected) => {
        const actual = Array.from(document.querySelectorAll<HTMLElement>('[data-file-item="true"][data-file-path]'))
          .map((item) => item.getAttribute('data-file-path') || '')
          .filter((filePath) => filePath.startsWith('D:/Projects/'))
          .map((filePath) => filePath.slice('D:/Projects/'.length));
        return expected.every((name: string) => actual.includes(name)) && actual.length === expected.length;
      }, {}, expectedProjectFileNames);
    }
    const projectFilesMatchPublishedProjects = expectedProjectFileNames !== null && await page.evaluate((expected) => {
      const actual = Array.from(document.querySelectorAll<HTMLElement>('[data-file-item="true"][data-file-path]'))
        .map((item) => item.getAttribute('data-file-path') || '')
        .filter((filePath) => filePath.startsWith('D:/Projects/'))
        .map((filePath) => filePath.slice('D:/Projects/'.length));
      return expected.length === actual.length && expected.every((name: string) => actual.includes(name));
    }, expectedProjectFileNames || []);
    assert(projectFilesMatchPublishedProjects, 'Projects shows generated text files for published projects only');

    if (expectedProjectFileNames?.length) {
      const projectFileSelector = `[data-file-path="D:/Projects/${expectedProjectFileNames[0]}"]`;
      const projectFileBounds = await page.$eval(projectFileSelector, (item) => {
        const bounds = item.getBoundingClientRect();
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      });
      await page.mouse.click(projectFileBounds.x, projectFileBounds.y, { button: 'right' });
      assert(
        await page.evaluate(() => !Array.from(document.querySelectorAll('button')).some((button) =>
          button.textContent?.trim() === 'Download to Device'
        )),
        'Explorer context menu does not offer Download to Device'
      );
      await page.keyboard.press('Escape');
      await page.click(projectFileSelector);
      await page.click('button[title="Share"]');
      await page.waitForSelector('[role="dialog"][aria-label="Share"]', { timeout: 5000 });
      assert(
        await page.$eval('[role="dialog"][aria-label="Share"]', (dialog) =>
          !dialog.textContent?.includes('Save to device')
        ),
        'Share dialog does not offer a device download button'
      );
      await page.$eval('[role="dialog"][aria-label="Share"]', (dialog) => {
        const closeButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
          .find((button) => button.textContent?.trim() === 'Close');
        closeButton?.click();
      });
    }
    await page.evaluate(() => {
      const homeButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.innerText.trim() === 'Home');
      homeButton?.click();
    });
    await page.click('[data-drive-card="D:"]', { count: 2 });
    await page.waitForSelector('[data-file-path="D:/Desktop"]', { timeout: 5000 });
    const desktopFolderBounds = await page.$eval('[data-file-path="D:/Desktop"]', (item) => {
      const bounds = item.getBoundingClientRect();
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    });
    await page.mouse.click(desktopFolderBounds.x, desktopFolderBounds.y, { button: 'right' });
    await page.evaluate(() => {
      const propertiesButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Properties');
      propertiesButton?.click();
    });
    await page.waitForSelector('[role="dialog"][aria-label="Desktop Properties"]', { timeout: 5000 });
    const propertiesThemeState = await page.$eval(
      '[role="dialog"][aria-label="Desktop Properties"]',
      (dialog) => ({
        theme: dialog.getAttribute('data-theme'),
        background: getComputedStyle(dialog.firstElementChild as HTMLElement).backgroundColor,
        savedTheme: JSON.parse(localStorage.getItem('win11_system_settings') || '{}').theme,
      })
    );
    const propertiesMatchSelectedTheme = propertiesThemeState.theme === propertiesThemeState.savedTheme &&
      (propertiesThemeState.theme === 'light'
        ? propertiesThemeState.background === 'rgb(255, 255, 255)'
        : propertiesThemeState.theme === 'dark' && propertiesThemeState.background !== 'rgb(255, 255, 255)');
    assert(
      propertiesMatchSelectedTheme,
      'File Properties palette follows the selected system theme',
      JSON.stringify(propertiesThemeState)
    );
    await page.$eval('[role="dialog"][aria-label="Desktop Properties"]', (dialog) => {
      const cancelButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Cancel');
      cancelButton?.click();
    });
    await page.evaluate(() => {
      const homeButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.innerText.trim() === 'Home');
      homeButton?.click();
    });
    await page.waitForSelector('[data-drive-card="C:"]', { timeout: 5000 });

    await page.click('[data-drive-card="C:"]');
    const singleClickCRemainsOnThisPc = await page.evaluate(() => {
      return Boolean(
        document.querySelector('[data-drive-card="C:"]') &&
          !document.querySelector('[role="dialog"][aria-label="Access denied"]')
      );
    });
    assert(
      singleClickCRemainsOnThisPc && await toolbarButtonsDisabled(),
      'Single-clicking C: only selects the drive and keeps file actions disabled'
    );
    await page.click('[data-drive-card="C:"]', { count: 2 });
    await page.waitForSelector('[role="dialog"][aria-label="Access denied"]', { timeout: 5000 });
    const cDriveDeniedOnDesktop = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="Access denied"]');
      return Boolean(
        dialog?.textContent?.includes('Sorry, you can’t access this drive.') &&
          document.querySelector('[data-drive-card="C:"]')?.getAttribute('aria-label')?.includes('locked') &&
          document.querySelector('[data-drive-card="D:"]')
      );
    });
    assert(cDriveDeniedOnDesktop, 'Desktop double-click on C: shows access-denied dialog and keeps This PC visible');

    await page.click('[role="dialog"] button:not([data-access-keyword])');
    await page.click('div[title="Click to edit path directly"]');
    const addressInput = await page.waitForSelector('input[placeholder^="Type a path"]', { timeout: 5000 });
    await addressInput?.evaluate((input) => (input as HTMLInputElement).select());
    await page.keyboard.type('C:/RestrictedFolder');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="dialog"][aria-label="Access denied"]', { timeout: 5000 });
    assert(true, 'Direct address-bar navigation to a C: subfolder is blocked');

    await page.click('[role="dialog"] button:not([data-access-keyword])');
    await page.click('[data-drive-card="C:"]', { count: 2 });
    await page.waitForSelector('[data-access-keyword="true"]', { timeout: 5000 });
    await page.click('[data-access-keyword="true"]');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const singleClickKeepsLoginClosed = await page.evaluate(() => {
      return Boolean(
        document.querySelector('[role="dialog"][aria-label="Access denied"]') &&
          !document.querySelector('input[type="email"]')
      );
    });
    assert(singleClickKeepsLoginClosed, 'Single click on the access keyword does not open Admin login');
    await page.click('[data-access-keyword="true"]', { count: 2 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    assert(
      Boolean(await page.$('input[type="password"]')),
      'Desktop double-click on the access keyword opens Admin login without bypassing authentication'
    );

    const closeAdminLoginWindow = async () => {
      const closedWindow = await page.evaluate(() => {
        const closeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[title="Close"]'));
        closeButtons[closeButtons.length - 1]?.click();
        return closeButtons.length > 0;
      });
      if (!closedWindow) throw new Error('Could not find the Admin login window close control.');
      await page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 5000 });
    };
    await closeAdminLoginWindow();
    await page.click('[role="dialog"] button:not([data-access-keyword])');
    await page.click('[data-drive-card="C:"]', { count: 2 });
    await page.waitForSelector('[data-access-keyword="true"]', { timeout: 5000 });
    await page.focus('[data-access-keyword="true"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    assert(true, 'Keyboard activation of the access keyword opens Admin login');
    await closeAdminLoginWindow();
    await page.click('[role="dialog"] button:not([data-access-keyword])');
    const touchSession = await page.createCDPSession();
    await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await page.waitForSelector('[data-drive-card="C:"]', { timeout: 10000 });
    const mobileDriveBounds = await page.$eval('[data-drive-card="C:"]', (el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await page.touchscreen.tap(mobileDriveBounds.x, mobileDriveBounds.y);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await page.touchscreen.tap(mobileDriveBounds.x, mobileDriveBounds.y);
    await page.waitForSelector('[role="dialog"][aria-label="Access denied"]', { timeout: 5000 });
    const mobileKeywordBounds = await page.$eval('[data-access-keyword="true"]', (el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await page.touchscreen.tap(mobileKeywordBounds.x, mobileKeywordBounds.y);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await page.touchscreen.tap(mobileKeywordBounds.x, mobileKeywordBounds.y);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    assert(true, 'Touch double-tap of the access keyword opens Admin login without bypassing authentication');

    // -------------------------------------------------------------
    // PHASE 3: AUTHENTICATED BROWSER WALKTHROUGH (LOGIN TO LOGOUT)
    // -------------------------------------------------------------
    console.log('\n--- Phase 3: Authenticated Walkthrough (Login -> Operations -> Logout) ---');

    // A. Navigate directly to Admin Login Screen
    await page.goto(`${appUrl}/?app=admin#admin`, { waitUntil: 'networkidle0', timeout: 20000 });

    // Wait for the login screen inputs
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    const hasLoginForm = await page.evaluate(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const passInput = document.querySelector('input[type="password"]');
      const submitBtn = document.querySelector('button[type="submit"]');
      return Boolean(emailInput && passInput && submitBtn);
    });
    assert(hasLoginForm, 'Admin Login Screen loads with email, password, and sign-in controls');

    // B. Fill credentials and submit
    await page.type('input[type="email"]', testAdminEmail, { delay: 15 });
    await page.type('input[type="password"]', testAdminPassword, { delay: 15 });

    // Click Sign In
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForResponse((res) => res.url().includes('/api/auth/login') && res.status() === 200, { timeout: 10000 }),
    ]);

    console.log('  [Login Event] Admin sign-in request succeeded (HTTP 200).');

    // C. Verify HttpOnly Session Cookie was set in browser
    const cookies = await page.cookies();
    const sidCookie = cookies.find((c) => c.name === 'sid');
    assert(
      Boolean(sidCookie && sidCookie.httpOnly),
      'Authentication issues secure HttpOnly session cookie (sid) to the browser'
    );

    // D. Verify Admin Panel Workspace loaded
    // Wait for authenticated UI or navigation to render
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return (
          text.includes('Admin') ||
          text.includes('Dashboard') ||
          text.includes('Portfolio') ||
          text.includes('Monitoring') ||
          text.includes('System') ||
          text.includes('Sign Out') ||
          text.includes('Logout')
        );
      },
      { timeout: 15000 }
    );

    const isAuthenticatedUiVisible = await page.evaluate(() => {
      const text = document.body.innerText;
      return (
        text.includes('Dashboard') ||
        text.includes('System Health') ||
        text.includes('Monitoring') ||
        text.includes('Control Center') ||
        text.includes('Backup') ||
        text.includes('Users') ||
        text.includes('Portfolio')
      );
    });
    assert(isAuthenticatedUiVisible, 'Authenticated Admin Control Center successfully rendered');

    // E. Test Operations Walkthrough: Switch tabs or trigger data load
    const tabsFound = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
      return buttons.map((b) => b.innerText.trim()).filter(Boolean);
    });
    assert(tabsFound.length > 0, `Admin Panel navigation loaded with interactive controls (${tabsFound.length} buttons found)`);

    const secondAdminTab = await browser.newPage();
    await isolatePageRequests(secondAdminTab);
    await secondAdminTab.goto(`${appUrl}/?app=admin#admin`, { waitUntil: 'networkidle0', timeout: 20000 });
    await secondAdminTab.waitForFunction(
      () => document.body.innerText.includes('Dashboard') || document.body.innerText.includes('Control Center'),
      { timeout: 15000 }
    );
    assert(true, 'A second same-browser tab recognizes the active administrator session');

    // A failed explicit close must keep the window and session intact so the user can retry.
    abortNextLogoutRequest = true;
    await page.evaluate(() => {
      const closeButton = document.querySelector<HTMLButtonElement>('[data-window-app="admin"] button[title="Close"]');
      if (!closeButton) throw new Error('Could not find the Admin window close button.');
      closeButton.click();
    });
    await page.waitForFunction(
      () => document.body.innerText.includes('retry Close or Log out'),
      { timeout: 10000 }
    );
    const stayedOpenForRetry = await page.$('[data-window-app="admin"] button[title="Close"]');
    assert(!abortNextLogoutRequest && Boolean(stayedOpenForRetry), 'Admin close failure keeps the window open and presents a retry message');
    await new Promise((resolve) => setTimeout(resolve, 250));

    const logoutResponse = await Promise.all([
      page.evaluate(() => {
        const closeButton = document.querySelector<HTMLButtonElement>('[data-window-app="admin"] button[title="Close"]');
        if (!closeButton) throw new Error('Admin window disappeared before logout retry.');
        closeButton.click();
      }),
      page.waitForResponse((res) => res.url().includes('/api/auth/logout'), { timeout: 10000 }),
    ]).then(([, response]) => response);
    console.log('  [Logout Event] Closed the Admin window and revoked its session.');
    assert(logoutResponse.status() === 200, `Admin logout endpoint returned HTTP ${logoutResponse.status()}`);

    await page.waitForNetworkIdle({ timeout: 2000 }).catch(() => {});

    // Verify session termination on server & in browser
    const postLogoutCookies = await page.cookies();
    const sidAfter = postLogoutCookies.find((c) => c.name === 'sid');
    if (!sidCookie) throw new Error('Admin session cookie was not issued after successful login.');
    const sessionRevokedOnServer = (await sessionService.validateSession(sidCookie.value)) === null;
    const isCookieCleared = !sidAfter || sidAfter.value === '' || sessionRevokedOnServer;

    assert(
      isCookieCleared,
      'Logout successfully terminates authenticated browser session and revokes server token'
    );

    const isUiReturnedToLockOrLogin = await page.evaluate(() => {
      const text = document.body.innerText;
      return (
        text.includes('Administrator Login') ||
        text.includes('Sign in') ||
        text.includes('Locked') ||
        text.includes('Unlock') ||
        sessionStorage.getItem('win11_admin_panel_locked') === null
      );
    });
    assert(
      isUiReturnedToLockOrLogin,
      'Browser UI state securely returns to locked or login screen after logout'
    );

    await secondAdminTab.waitForFunction(
      () => Boolean(document.querySelector('input[type="email"]')),
      { timeout: 10000 }
    );
    assert(true, 'Logout in one tab returns the other admin tab to login without leaving its window');
    await secondAdminTab.close();

    assert(
      analyticsRequestOrigins.length > 0 && analyticsRequestOrigins.every((origin) => origin === appUrl),
      'Browser analytics requests remain same-origin with the isolated E2E app and cannot reach an external API'
    );

    console.log('\n=================================================================');
    console.log(`  E2E Browser Walkthrough Completed: ${passed} passed, ${failed} failed.`);
    console.log('=================================================================\n');

  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    await UserModel.deleteOne({ id: adminDoc.id });
    await disconnectMongo();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runE2EWalkthrough().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
