import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';

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

  const explicitUri = process.env.MONGODB_URI?.trim();
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
  const defaultLocalUri = 'mongodb://127.0.0.1:27017/win11portfolio';
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
      const instance: { dbName: string; dbPath?: string } = { dbName: 'win11portfolio' };
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
