import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ensureApplicationCollections } from '../config/dbConfig';

test('MongoDB initializes every supported portfolio collection without dropping empty collections', async (t) => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryServer.create({ instance: { dbName: 'portfolio_collections_test' } });
  await mongoose.connect(mongo.getUri());

  t.after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  const expectedCollections = [
    'adminauditlogs',
    'admincontentdrafts',
    'admincontentrevisions',
    'adminprojectdrafts',
    'analytics',
    'captures',
    'contacts',
    'filemetadata',
    'passwordresettokens',
    'projects',
    'ratelimitbuckets',
    'sessionhistories',
    'sessions',
    'sitecontents',
    'tasks',
    'users',
  ];
  await mongoose.connection.db!.createCollection('filemetadatas');
  await mongoose.connection.db!.createCollection('revokedtokens');
  await mongoose.connection.db!.collection('filemetadatas').insertOne({
    id: 'legacy-file-metadata-test',
    name: 'legacy-resume.pdf',
    path: 'Portfolio/Media/legacy-resume.pdf',
    parentId: 'Portfolio/Media',
    type: 'file',
    extension: 'pdf',
    size: '1 KB',
    modified: new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
  });

  const createdCollections = await ensureApplicationCollections();
  assert.ok(createdCollections.every((name) => expectedCollections.includes(name)));
  const { FileMetadataModel } = await import('../models/FileMetadata');
  const migratedMetadata = await FileMetadataModel.findOne({ id: 'legacy-file-metadata-test' }).lean();
  assert.equal(migratedMetadata?.name, 'legacy-resume.pdf');
  const retainedLegacyMetadata = await mongoose.connection.db!
    .collection('filemetadatas')
    .findOne({ id: 'legacy-file-metadata-test' });
  assert.equal(retainedLegacyMetadata?.__portfolioMetadataMigratedTo, 'filemetadata');
  assert.equal(
    await mongoose.connection.db!.listCollections({ name: 'revokedtokens' }, { nameOnly: true }).hasNext(),
    false,
  );

  const collections = await mongoose.connection.db!.listCollections({}, { nameOnly: true }).toArray();
  const collectionNames = collections
    .map(({ name }) => name)
    .filter((name) => name !== 'filemetadatas')
    .sort();
  assert.deepEqual(collectionNames, [...expectedCollections].sort());

  const secondInitialization = await ensureApplicationCollections();
  assert.deepEqual(secondInitialization, []);
  const collectionsAfterReinitialization = await mongoose.connection.db!.listCollections({}, { nameOnly: true }).toArray();
  assert.deepEqual(
    collectionsAfterReinitialization.map(({ name }) => name).filter((name) => name !== 'filemetadatas').sort(),
    [...expectedCollections].sort(),
  );

  await mongoose.connection.db!.createCollection('revokedtokens');
  await mongoose.connection.db!.collection('revokedtokens').insertOne({
    token: 'historical-revocation-record',
    revokedAt: new Date(),
  });
  await ensureApplicationCollections();
  assert.equal(
    await mongoose.connection.db!.collection('revokedtokens').countDocuments(),
    1,
  );
});
