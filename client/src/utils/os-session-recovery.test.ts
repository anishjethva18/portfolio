import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OS_SESSION_STORAGE_KEY,
  readOsSessionSnapshot,
  writeOsSessionSnapshot,
} from './osSessionRecovery';

const createStorage = (initialValue?: string) => {
  let value = initialValue ?? null;
  return {
    getItem: (key: string) => key === OS_SESSION_STORAGE_KEY ? value : null,
    setItem: (key: string, nextValue: string) => {
      if (key === OS_SESSION_STORAGE_KEY) value = nextValue;
    },
  };
};

test('OS session recovery preserves window layout while excluding unsaved form and credential data', () => {
  const storage = createStorage();
  writeOsSessionSnapshot(storage, {
    windows: [{
      id: 'win-projects-1',
      appId: 'projects',
      title: 'Projects',
      icon: 'Projects',
      isMinimized: false,
      isMaximized: true,
      isFocused: true,
      position: { x: 28, y: 44 },
      size: { width: 900, height: 600 },
      zIndex: 3,
      desktopId: 'desktop-2',
      args: {
        message: 'do not persist this',
        password: 'never persist this',
        forceNewWindow: true,
      },
    }],
    activeWindowId: 'win-projects-1',
    currentDesktopId: 'desktop-2',
  });

  const serialized = storage.getItem(OS_SESSION_STORAGE_KEY) || '';
  assert.doesNotMatch(serialized, /do not persist|never persist|forceNewWindow/);
  const restored = readOsSessionSnapshot(storage);
  assert.equal(restored.windows.length, 1);
  assert.equal(restored.windows[0].position.x, 28);
  assert.equal(restored.windows[0].position.y, 44);
  assert.equal(restored.windows[0].isMaximized, true);
  assert.equal(restored.windows[0].args, undefined);
  assert.equal(restored.activeWindowId, 'win-projects-1');
  assert.equal(restored.currentDesktopId, 'desktop-2');
});

test('OS session recovery sanitizes launch arguments and rejects invalid window records', () => {
  const storage = createStorage(JSON.stringify({
    windows: [
      {
        id: 'browser-1',
        appId: 'browser',
        title: 'Browser',
        icon: 'Globe',
        isMinimized: false,
        isMaximized: false,
        isFocused: true,
        position: { x: 5, y: 10 },
        size: { width: 800, height: 600 },
        zIndex: 1,
        args: {
          initialUrl: 'https://example.test/path?token=private#section',
          message: 'private form content',
        },
      },
      { id: 'invalid', appId: 'unknown', position: {}, size: {} },
    ],
    activeWindowId: 'browser-1',
    currentDesktopId: 'unknown-desktop',
  }));

  const restored = readOsSessionSnapshot(storage, ['desktop-1']);
  assert.equal(restored.windows.length, 1);
  assert.deepEqual(restored.windows[0].args, { initialUrl: 'https://example.test/path' });
  assert.equal(restored.currentDesktopId, 'desktop-1');
});

test('OS session recovery never restores the authenticated admin application', () => {
  const storage = createStorage(JSON.stringify({
    windows: [{
      id: 'admin-1',
      appId: 'admin',
      title: 'Admin Control Center',
      icon: 'ShieldCheck',
      isMinimized: false,
      isMaximized: true,
      isFocused: true,
      position: { x: 0, y: 0 },
      size: { width: 900, height: 600 },
      zIndex: 1,
      desktopId: 'desktop-1',
    }],
    activeWindowId: 'admin-1',
    currentDesktopId: 'desktop-1',
  }));
  assert.deepEqual(readOsSessionSnapshot(storage).windows, []);
  assert.equal(readOsSessionSnapshot(storage).activeWindowId, null);
});

test('OS session recovery excludes applications hidden in the last published availability snapshot', () => {
  const storage = createStorage(JSON.stringify({
    windows: [
      {
        id: 'hidden-browser-1',
        appId: 'browser',
        title: 'Web Browser',
        icon: 'Globe',
        isMinimized: false,
        isMaximized: true,
        isFocused: true,
        position: { x: 0, y: 0 },
        size: { width: 900, height: 600 },
        zIndex: 1,
        desktopId: 'desktop-1',
      },
      {
        id: 'visible-projects-1',
        appId: 'projects',
        title: 'Projects',
        icon: 'Projects',
        isMinimized: false,
        isMaximized: true,
        isFocused: false,
        position: { x: 24, y: 24 },
        size: { width: 900, height: 600 },
        zIndex: 2,
        desktopId: 'desktop-1',
      },
    ],
    activeWindowId: 'hidden-browser-1',
    currentDesktopId: 'desktop-1',
  }));
  const restored = readOsSessionSnapshot(storage, ['desktop-1'], ['browser']);
  assert.deepEqual(restored.windows.map((window) => window.appId), ['projects']);
  assert.equal(restored.activeWindowId, 'visible-projects-1');
});
