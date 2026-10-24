import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createPortableBackup, PortfolioBackup, verifyBackupIntegrity } from '../services/backupService';

test('portable full backups omit account credentials and contact records without mutating source', () => {
  const fullSnapshot: PortfolioBackup = {
    metadata: {
      timestamp: '2026-10-20T10:00:00.000Z',
      version: '3.0.0',
      type: 'full-portfolio-assets',
    },
    collections: {
      publishedContent: { profile: { name: 'Portfolio owner' } },
      draftContent: { profile: { name: 'Portfolio owner' } },
      projects: [{ id: 'project-1' }],
      media: [],
      users: [{ id: 'user-1', passwordHash: 'sensitive-hash' }],
      contacts: [{ id: 'contact-1', email: 'private@example.test' }],
    },
  };
  const integrityPayload = {
    metadata: {
      timestamp: fullSnapshot.metadata.timestamp,
      version: fullSnapshot.metadata.version,
      type: fullSnapshot.metadata.type,
    },
    collections: fullSnapshot.collections,
  };
  fullSnapshot.metadata.integrity = {
    algorithm: 'sha256',
    digest: crypto.createHash('sha256').update(JSON.stringify(integrityPayload)).digest('hex'),
  };

  const portable = createPortableBackup(fullSnapshot);

  assert.equal(portable.metadata.type, 'full-portfolio-assets');
  assert.equal(portable.collections.users, undefined);
  assert.equal(portable.collections.contacts, undefined);
  assert.deepEqual(portable.collections.projects, fullSnapshot.collections.projects);
  assert.equal(fullSnapshot.collections.users?.[0].passwordHash, 'sensitive-hash');
  assert.equal(fullSnapshot.collections.contacts?.length, 1);
  assert.equal(verifyBackupIntegrity(portable), true);

  const tampered = structuredClone(portable);
  tampered.collections.projects[0].id = 'tampered-project';
  assert.equal(verifyBackupIntegrity(tampered), false);

  const digestRemoved = structuredClone(portable);
  delete digestRemoved.metadata.integrity;
  digestRemoved.metadata.version = '3.1.0';
  assert.equal(verifyBackupIntegrity(digestRemoved), false);
});
