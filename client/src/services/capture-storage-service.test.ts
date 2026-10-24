import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { CaptureStorageService, type LocalCaptureRecord } from './captureStorageService';

test('local camera captures survive service recreation and archive status updates', async () => {
  const id = `phase6_capture_${Date.now()}`;
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const record: LocalCaptureRecord = {
    id,
    fileName: 'camera-photo.jpg',
    filePath: 'D:/Pictures/Camera/camera-photo.jpg',
    mediaType: 'photo',
    mimeType: 'image/jpeg',
    blob: new Blob([bytes], { type: 'image/jpeg' }),
    createdAt: new Date().toISOString(),
    archiveStatus: 'local-only',
  };
  const cameraStorage = new CaptureStorageService();
  await cameraStorage.save(record);

  const reopenedStorage = new CaptureStorageService();
  const persisted = await reopenedStorage.get(id);
  assert.ok(persisted);
  assert.equal(persisted.archiveStatus, 'local-only');
  assert.equal(persisted.fileName, record.fileName);
  assert.deepEqual(new Uint8Array(await persisted.blob.arrayBuffer()), bytes);

  await reopenedStorage.update(id, { archiveStatus: 'archived', archiveId: 'private-server-copy' });
  const updated = await cameraStorage.get(id);
  assert.ok(updated);
  assert.equal(updated?.archiveStatus, 'archived');
  assert.equal(updated?.archiveId, 'private-server-copy');
  assert.deepEqual(new Uint8Array(await updated.blob.arrayBuffer()), bytes);

  await cameraStorage.delete(id);
  assert.equal(await reopenedStorage.get(id), null);
});
