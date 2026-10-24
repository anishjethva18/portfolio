import { FileItem } from '../types';
import { formatDateISO } from '../utils/dateTime';

const DB_NAME = 'Win11PortfolioOS_DB_v9';
const DB_VERSION = 1;
const STORE_FILES = 'vfs_files';
const STORE_META = 'vfs_meta';
const STORE_DELETED = 'vfs_deleted';
const LOCALSTORAGE_KEY = 'win11_portfolio_vfs_backup_v9';
const LOCALSTORAGE_DELETED_KEY = 'win11_portfolio_vfs_deleted_v9';
const SYNC_CHANNEL_NAME = 'win11_portfolio_vfs_sync';

export class FileStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      } catch (e) {
        console.warn('[FileStorageService] BroadcastChannel init warning:', e);
      }
    }
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          const fileStore = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
          fileStore.createIndex('path', 'path', { unique: false });
          fileStore.createIndex('parentId', 'parentId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_DELETED)) {
          db.createObjectStore(STORE_DELETED, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('[FileStorageService] IndexedDB open error, falling back to localStorage');
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Broadcast change event across tabs/windows
   */
  public broadcastChange(action: string, data?: any): void {
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ action, timestamp: Date.now(), data });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vfs-storage-change', { detail: { action, data } }));
      }
    } catch {}
  }

  /**
   * Listen for changes from other tabs/windows
   */
  public onSync(callback: (event: any) => void): () => void {
    if (this.broadcastChannel) {
      const handler = (e: MessageEvent) => callback(e.data);
      this.broadcastChannel.addEventListener('message', handler);
      return () => this.broadcastChannel?.removeEventListener('message', handler);
    }
    return () => {};
  }

  /**
   * Save all files to IndexedDB with localStorage fallback
   */
  public async saveFiles(files: FileItem[]): Promise<void> {
    const uniqueFiles = this.deduplicate(files);
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      const metaStore = tx.objectStore(STORE_META);

      // Clear old entries and bulk insert
      await new Promise<void>((resolve, reject) => {
        const clearReq = store.clear();
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => reject(clearReq.error);
      });

      for (const file of uniqueFiles) {
        store.put(file);
      }

      metaStore.put({ key: 'last_saved', timestamp: Date.now(), count: uniqueFiles.length });

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      this.broadcastChange('files_saved', { count: uniqueFiles.length });
    } catch (e) {
      // Fallback to localStorage
      try {
        const serialized = JSON.stringify(uniqueFiles);
        localStorage.setItem(LOCALSTORAGE_KEY, serialized);
        this.broadcastChange('files_saved', { count: uniqueFiles.length });
      } catch (lsErr) {
        console.warn('[FileStorageService] LocalStorage quota limit reached:', lsErr);
      }
    }
  }

  /**
   * Save or update a single file
   */
  public async saveFile(file: FileItem): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      store.put(file);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      this.broadcastChange('file_updated', { id: file.id, path: file.path });
    } catch {
      // Fallback
      const files = (await this.loadFiles()) || [];
      const updated = [...files.filter((f) => f.id !== file.id && f.path !== file.path), file];
      await this.saveFiles(updated);
    }
  }

  /**
   * Get a single file by ID or Path
   */
  public async getFile(idOrPath: string): Promise<FileItem | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);

      const byId = await new Promise<FileItem | undefined>((resolve) => {
        const req = store.get(idOrPath);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });

      if (byId) return byId;

      const pathIndex = store.index('path');
      const byPath = await new Promise<FileItem | undefined>((resolve) => {
        const req = pathIndex.get(idOrPath);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });

      return byPath || null;
    } catch {
      const files = (await this.loadFiles()) || [];
      return files.find((f) => f.id === idOrPath || f.path === idOrPath) || null;
    }
  }

  /**
   * Deduplicate items by ID and path
   */
  private deduplicate(items: FileItem[]): FileItem[] {
    const seenIds = new Set<string>();
    const seenPaths = new Set<string>();
    const result: FileItem[] = [];
    for (const item of items) {
      if (!item || !item.id) continue;
      if (!seenIds.has(item.id) && !seenPaths.has(item.path)) {
        seenIds.add(item.id);
        seenPaths.add(item.path);
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Fetch all persistent files stored in the backend server
   */
  public async loadServerFiles(): Promise<FileItem[]> {
    try {
      const res = await fetch('/api/files/list', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data.files)) {
        return data.files.map((sFile: any) => ({
          id: sFile.id,
          name: sFile.name,
          path: sFile.path,
          parentId: sFile.parentId || sFile.path.substring(0, sFile.path.lastIndexOf('/')) || 'D:/Documents',
          type: sFile.type || 'file',
          extension: sFile.extension || 'txt',
          size: sFile.size || '1 KB',
          modified: sFile.modified || formatDateISO(new Date()),
          content: sFile.url || sFile.content || '',
        }));
      }
    } catch (e) {
      console.warn('[FileStorageService] Could not reach backend files API:', e);
    }
    return [];
  }

  /**
   * Upload a file directly to the backend server API at /api/files/upload
   * The server saves the physical file into the persistent uploads/ folder and stores metadata in database.
   */
  public async uploadFileToServer(targetFolder: string, file: File, desiredPath?: string): Promise<FileItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetFolder', targetFolder);
    if (desiredPath) {
      formData.append('path', desiredPath);
    }

    const res = await fetch('/api/files/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Upload failed with status ${res.status}`);
    }

    const data = await res.json();
    const sFile = data.file;

    const fileItem: FileItem = {
      id: sFile.id,
      name: sFile.name,
      path: sFile.path,
      parentId: sFile.parentId || targetFolder,
      type: 'file',
      extension: sFile.extension || 'txt',
      size: sFile.size || `${Math.max(0.1, file.size / 1024).toFixed(1)} KB`,
      modified: sFile.modified || formatDateISO(new Date()),
      content: sFile.url || '',
    };

    // Keep local cache in sync as well
    await this.saveFile(fileItem);
    this.broadcastChange('file_uploaded', fileItem);

    return fileItem;
  }

  /**
   * Delete file on backend server
   */
  public async deleteFileFromServer(id: string): Promise<void> {
    try {
      await fetch(`/api/files/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (e) {
      console.warn('[FileStorageService] Failed to delete file on server:', e);
    }
  }

  /**
   * Load files from IndexedDB or LocalStorage, merging persistent server files as source of truth
   */
  public async loadFiles(): Promise<FileItem[] | null> {
    let localFiles: FileItem[] = [];

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);

      const allFiles = await new Promise<FileItem[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (allFiles && allFiles.length > 0) {
        localFiles = this.deduplicate(allFiles);
      }
    } catch (e) {
      console.warn('[FileStorageService] IndexedDB load failed, trying localStorage fallback');
    }

    // Try LocalStorage if empty
    if (localFiles.length === 0) {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localFiles = this.deduplicate(parsed);
          }
        }
      } catch {}
    }

    // Load server files as source of truth
    const serverFiles = await this.loadServerFiles();
    if (serverFiles.length > 0) {
      // Merge server files with local files (server files take precedence)
      const mergedMap = new Map<string, FileItem>();
      localFiles.forEach((f) => mergedMap.set(f.path, f));
      serverFiles.forEach((f) => mergedMap.set(f.path, f));
      const combined = Array.from(mergedMap.values());
      // Save combined so IndexedDB has the updated state too
      this.saveFiles(combined).catch(() => {});
      return this.deduplicate(combined);
    }

    return localFiles.length > 0 ? this.deduplicate(localFiles) : null;
  }

  /**
   * Save deleted files (Recycle Bin)
   */
  public async saveDeletedFiles(deleted: FileItem[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_DELETED, 'readwrite');
      const store = tx.objectStore(STORE_DELETED);
      store.clear();
      for (const item of deleted) {
        store.put(item);
      }
    } catch {}
    try {
      localStorage.setItem(LOCALSTORAGE_DELETED_KEY, JSON.stringify(deleted));
    } catch {}
  }

  /**
   * Load deleted files (Recycle Bin)
   */
  public async loadDeletedFiles(): Promise<FileItem[] | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_DELETED, 'readonly');
      const store = tx.objectStore(STORE_DELETED);
      const items = await new Promise<FileItem[]>((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      if (items.length > 0) return items;
    } catch {}

    try {
      const raw = localStorage.getItem(LOCALSTORAGE_DELETED_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  /**
   * Reset / Clear custom files back to system defaults
   */
  public async resetFileSystem(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_FILES, STORE_META, STORE_DELETED], 'readwrite');
      tx.objectStore(STORE_FILES).clear();
      tx.objectStore(STORE_META).clear();
      tx.objectStore(STORE_DELETED).clear();
    } catch {}
    localStorage.removeItem(LOCALSTORAGE_KEY);
    localStorage.removeItem(LOCALSTORAGE_DELETED_KEY);
    this.broadcastChange('vfs_reset');
  }

  public async clearAll(): Promise<void> {
    return this.resetFileSystem();
  }

  /**
   * Export all files as downloadable JSON
   */
  public exportBackupJson(files: FileItem[]): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(files, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `PortfolioOS_Backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  /**
   * Import backup JSON string and save
   */
  public async importBackupJson(jsonString: string): Promise<FileItem[]> {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) throw new Error('Invalid backup file format');
    const validFiles = this.deduplicate(parsed);
    await this.saveFiles(validFiles);
    return validFiles;
  }
}

export const storageService = new FileStorageService();
export const fileStorageService = storageService;
