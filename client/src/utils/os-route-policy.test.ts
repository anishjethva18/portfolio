import assert from 'node:assert/strict';
import test from 'node:test';
import { getInitialLockState, OS_LOCK_STORAGE_KEY } from './osRoutePolicy';

const storage = (locked: string | null) => ({
  getItem: (key: string) => key === OS_LOCK_STORAGE_KEY ? locked : null,
});

test('root always starts on the lock screen while home always starts unlocked', () => {
  assert.equal(getInitialLockState('/', storage('false')), true);
  assert.equal(getInitialLockState('/home', storage('true')), false);
});

test('application routes preserve the current session lock state', () => {
  assert.equal(getInitialLockState('/projects', storage('false')), false);
  assert.equal(getInitialLockState('/projects', storage('true')), true);
  assert.equal(getInitialLockState('/projects', storage(null)), true);
});
