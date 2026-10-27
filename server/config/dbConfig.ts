import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AdminAuditLogModel,
  AdminContentDraftModel,
  AdminContentRevisionModel,
  AdminProjectDraftModel,
  AnalyticsModel,
  CaptureModel,
  ContactModel,
  FileMetadataModel,
  PasswordResetTokenModel,
  ProjectModel,
  RateLimitBucketModel,
  SessionHistoryModel,
  SessionModel,
  SiteContentModel,
  TaskModel,
  UserModel,
} from '../models';

let mongoMemoryServer: MongoMemoryServer | null = null;
let isConnected = false;

export interface DatabaseConnectionInfo {
  uri: string;
  isMemoryServer: boolean;
  readyState: number;
}

export function allowsInMemoryMongoFallback(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'test' || (env.NODE_ENV === 'development' && env.ALLOW_IN_MEMORY_DB === 'true');
}

export function withDefaultMongoDatabase(uri: string, databaseName = 'portfolio'): string {
  const parsed = new URL(uri);
  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = `/${databaseName}`;
  }
  return parsed.toString();
}

const APPLICATION_MODELS = [
  UserModel,
  TaskModel,
  ContactModel,
  AnalyticsModel,
  ProjectModel,
  FileMetadataModel,
  PasswordResetTokenModel,
  SiteContentModel,
  SessionModel,
  SessionHistoryModel,
  CaptureModel,
  AdminContentDraftModel,
  AdminProjectDraftModel,
  AdminContentRevisionModel,
  AdminAuditLogModel,
  RateLimitBucketModel,
];

const RETIRED_APPLICATION_COLLECTIONS = ['revokedtokens'];

export async function ensureApplicationCollections(): Promise<string[]> {
  const database = mongoose.connection.db;
  if (mongoose.connection.readyState !== 1 || !database) {
    throw new Error('MongoDB must be connected before application collections can be initialized.');
  }

  const existingCollections = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );
  const createdCollections: string[] = [];

  for (const model of APPLICATION_MODELS) {
    const collectionName = model.collection.name;
    if (existingCollections.has(collectionName)) continue;
    try {
      await database.createCollection(collectionName);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 48) {
        throw error;
      }
    }
    existingCollections.add(collectionName);
    createdCollections.push(collectionName);
  }

  for (const collectionName of RETIRED_APPLICATION_COLLECTIONS) {
    if (!existingCollections.has(collectionName)) continue;
    const collection = database.collection(collectionName);
    if (await collection.estimatedDocumentCount() === 0) {
      await collection.drop();
      existingCollections.delete(collectionName);
      console.log(`[MongoDB] Removed unused empty collection: ${collectionName}.`);
    } else {
      console.warn(`[MongoDB] Retaining ${collectionName} because it contains historical records.`);
    }
  }

  const legacyFileMetadataCollection = 'filemetadatas';
  const currentFileMetadataCollection = FileMetadataModel.collection.name;
  if (
    legacyFileMetadataCollection !== currentFileMetadataCollection &&
    existingCollections.has(legacyFileMetadataCollection)
  ) {
    const source = database.collection(legacyFileMetadataCollection);
    const destination = database.collection(currentFileMetadataCollection);
    await destination.createIndex({ id: 1 }, { unique: true });

    let batch: Array<{ updateOne: { filter: { id: unknown }; update: { $setOnInsert: Record<string, unknown> }; upsert: true } }> = [];
    let migratedCount = 0;
    for await (const document of source.find({ __portfolioMetadataMigratedTo: { $ne: currentFileMetadataCollection } })) {
      if (typeof document.id !== 'string' || !document.id) {
        console.warn('[MongoDB] Skipping legacy file metadata without a valid id.');
        continue;
      }
      batch.push({
        updateOne: {
          filter: { id: document.id },
          update: { $setOnInsert: document },
          upsert: true,
        },
      });
      if (batch.length < 200) continue;

      const sourceIds = batch.map((operation) => operation.updateOne.filter.id);
      const result = await destination.bulkWrite(batch, { ordered: false });
      migratedCount += result.upsertedCount;
      await source.updateMany(
        { id: { $in: sourceIds } },
        { $set: { __portfolioMetadataMigratedTo: currentFileMetadataCollection } },
      );
      batch = [];
    }
    if (batch.length) {
      const sourceIds = batch.map((operation) => operation.updateOne.filter.id);
      const result = await destination.bulkWrite(batch, { ordered: false });
      migratedCount += result.upsertedCount;
      await source.updateMany(
        { id: { $in: sourceIds } },
        { $set: { __portfolioMetadataMigratedTo: currentFileMetadataCollection } },
      );
    }
    if (migratedCount) {
      console.log(`[MongoDB] Migrated ${migratedCount} file metadata record(s) from ${legacyFileMetadataCollection} to ${currentFileMetadataCollection}; legacy records were retained.`);
    }
  }

  const verifiedCollections = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );
  const missingCollections = APPLICATION_MODELS
    .map((model) => model.collection.name)
    .filter((name) => !verifiedCollections.has(name));
  if (missingCollections.length) {
    throw new Error(`MongoDB is missing required application collections: ${missingCollections.join(', ')}.`);
  }

  if (createdCollections.length) {
    console.log(`[MongoDB] Initialized required application collections: ${createdCollections.join(', ')}.`);
  }
  return createdCollections;
}

/**
 * Connects to persistent MongoDB. Memory Mongo is restricted to tests or explicitly opted-in development.
 */
export async function connectMongo(): Promise<DatabaseConnectionInfo> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return {
      uri: mongoose.connection.host || 'connected',
      isMemoryServer: Boolean(mongoMemoryServer),
      readyState: mongoose.connection.readyState,
    };
  }

  const configuredUri = process.env.MONGODB_URI?.trim();
  const explicitUri = configuredUri ? withDefaultMongoDatabase(configuredUri) : undefined;
  const isProduction = process.env.NODE_ENV === 'production';
  const canUseMemory = allowsInMemoryMongoFallback();

  // Set up Mongoose connection event listeners
  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('[MongoDB] Successfully connected to MongoDB database.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('[MongoDB] Connection disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('[MongoDB] Connection restored.');
  });

  if (isProduction && !explicitUri) {
    throw new Error('Production startup requires MONGODB_URI.');
  }

  // Try configured persistent MongoDB first.
  if (explicitUri) {
    try {
      console.log(`[MongoDB] Connecting to configured MONGODB_URI...`);
      await mongoose.connect(explicitUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });
      isConnected = true;
      return {
        uri: explicitUri,
        isMemoryServer: false,
        readyState: mongoose.connection.readyState,
      };
    } catch {
      await mongoose.disconnect().catch(() => {});
      if (!canUseMemory) {
        throw new Error('MongoDB connection failed; refusing to start without persistent database storage.');
      }
      console.warn('[MongoDB] Configured MongoDB unavailable; using explicitly enabled isolated test/development memory storage.');
    }
  }

  // Try the local default only outside production.
  const defaultLocalUri = 'mongodb://127.0.0.1:27017/portfolio';
  if (!explicitUri && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    try {
      console.log(`[MongoDB] Attempting connection to local MongoDB instance...`);
      await mongoose.connect(defaultLocalUri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 3000,
      });
      isConnected = true;
      return {
        uri: defaultLocalUri,
        isMemoryServer: false,
        readyState: mongoose.connection.readyState,
      };
    } catch {
      await mongoose.disconnect().catch(() => {});
    }
  }

  if (!canUseMemory) {
    throw new Error('MongoDB is unavailable. Set ALLOW_IN_MEMORY_DB=true only for isolated development, or use NODE_ENV=test.');
  }

  // Isolated fallback for test and explicitly opted-in development only.
  try {
    console.log('[MongoDB] Starting MongoMemoryServer for isolated persistent simulation...');
    if (!mongoMemoryServer) {
      const instance: { dbName: string; dbPath?: string } = { dbName: 'portfolio' };
      if (process.env.NODE_ENV === 'development') {
        instance.dbPath = path.resolve(process.cwd(), 'server/storage/.development-db');
        fs.mkdirSync(instance.dbPath, { recursive: true });
      }
      mongoMemoryServer = await MongoMemoryServer.create({
        instance,
      });
    }
    const targetUri = mongoMemoryServer.getUri();

    await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[MongoDB] Connected to active MongoDB engine at: ${targetUri}`);

    return {
      uri: targetUri,
      isMemoryServer: true,
      readyState: mongoose.connection.readyState,
    };
  } catch {
    throw new Error('Unable to initialize isolated in-memory MongoDB.');
  }
}

/**
 * Disconnects from MongoDB and stops memory server if active
 */
export async function disconnectMongo(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
      mongoMemoryServer = null;
    }
    isConnected = false;
    console.log('[MongoDB] Safely disconnected from database.');
  } catch (err: any) {
    console.error('[MongoDB] Error during disconnect:', err);
  }
}
