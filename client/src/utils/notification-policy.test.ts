import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getInitialNotifications,
  markWelcomeNotificationShown,
  WELCOME_NOTIFICATION_SHOWN_KEY,
} from './notificationPolicy';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
};

test('welcome notification is initialized once across navigation, refresh, and session recovery', () => {
  const storage = createStorage();
  const firstVisitNotifications = getInitialNotifications(storage);
  assert.equal(firstVisitNotifications.length, 1);
  assert.equal(firstVisitNotifications[0].id, 'welcome-1');

  markWelcomeNotificationShown(storage);
  for (const navigation of ['/media', '/home', '/projects', 'close-window', 'back', 'forward', 'refresh', 'recovery']) {
    assert.deepEqual(getInitialNotifications(storage), [], `${navigation} must not initialize it again`);
  }
  assert.equal(storage.getItem(WELCOME_NOTIFICATION_SHOWN_KEY), 'true');
});

test('welcome policy does not alter unrelated notification records', () => {
  const storage = createStorage();
  const legitimateNotification = {
    id: 'notif-1',
    title: 'Saved',
    message: 'Your file was saved.',
    timestamp: '10:00',
    type: 'success' as const,
    read: false,
  };
  markWelcomeNotificationShown(storage);
  assert.deepEqual(legitimateNotification, {
    id: 'notif-1',
    title: 'Saved',
    message: 'Your file was saved.',
    timestamp: '10:00',
    type: 'success',
    read: false,
  });
});
