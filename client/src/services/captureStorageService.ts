export type LocalCaptureStatus = 'local-only' | 'uploading' | 'archived' | 'archive-failed';
export type LocalCaptureType = 'photo' | 'video';

export interface LocalCaptureRecord {
  id: string;
  fileName: string;
  filePath: string;
  mediaType: LocalCaptureType;
  mimeType: string;
  blob: Blob;
  createdAt: string;
  archiveStatus: LocalCaptureStatus;
  archiveId?: string;
  archiveError?: string;
}

const DB_NAME = 'Win11PortfolioCameraCaptures';
const DB_VERSION = 1;
const STORE_NAME = 'captures';

export const MAX_CAPTURE_BYTES = 100 * 1024 * 1024;
export const LOCAL_CAPTURE_CONTENT_PREFIX = 'local-capture:';

export const dispatchCaptureStorageChange = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('local-captures-updated'));
  }
};

export class CaptureStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('This browser does not support IndexedDB camera storage.'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error || new Error('Could not open local camera storage.'));
      };
      request.onblocked = () => {
        this.dbPromise = null;
        reject(new Error('Local camera storage is blocked by another open tab. Close other portfolio tabs and retry.'));
      };
    });
    return this.dbPromise;
  }

  async save(record: LocalCaptureRecord): Promise<void> {
    if (record.blob.size === 0) throw new Error('The capture is empty and cannot be saved.');
    if (record.blob.size > MAX_CAPTURE_BYTES) {
      throw new Error(`Captures larger than ${Math.floor(MAX_CAPTURE_BYTES / 1024 / 1024)} MB cannot be saved.`);
    }

    const existingCapture = await this.get(record.id);
    const additionalBytes = Math.max(0, record.blob.size - (existingCapture?.blob.size || 0));
    if (additionalBytes > 0 && typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.usage !== undefined && estimate.quota - estimate.usage < additionalBytes) {
        throw new Error('There is not enough browser storage available for this capture. Free device storage and try again.');
      }
    }

    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not persist the capture locally.'));
      transaction.onabort = () => reject(transaction.error || new Error('Local capture storage was aborted.'));
    });
    dispatchCaptureStorageChange();
  }

  async get(id: string): Promise<LocalCaptureRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as LocalCaptureRecord | undefined) || null);
      request.onerror = () => reject(request.error || new Error('Could not read the local capture.'));
    });
  }

  async list(): Promise<LocalCaptureRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as LocalCaptureRecord[]) || []);
      request.onerror = () => reject(request.error || new Error('Could not list local captures.'));
    });
  }

  async update(id: string, updates: Partial<Pick<LocalCaptureRecord, 'archiveStatus' | 'archiveId' | 'archiveError'>>): Promise<void> {
    const capture = await this.get(id);
    if (!capture) throw new Error('The local capture is no longer available.');
    await this.save({ ...capture, ...updates });
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not permanently remove the local capture.'));
      transaction.onabort = () => reject(transaction.error || new Error('Local capture deletion was aborted.'));
    });
    dispatchCaptureStorageChange();
  }
}

export const captureStorageService = new CaptureStorageService();
