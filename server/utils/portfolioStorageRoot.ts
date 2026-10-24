import path from 'path';

export function getPortfolioStorageRoot(): string {
  const projectStorageRoot = path.resolve(process.cwd(), 'server/storage');
  const configuredRoot = process.env.PORTFOLIO_STORAGE_DIR?.trim();
  if (!configuredRoot) return projectStorageRoot;

  const resolvedConfiguredRoot = path.resolve(configuredRoot);
  if (process.env.NODE_ENV === 'test') return resolvedConfiguredRoot;
  if (resolvedConfiguredRoot.toLowerCase() !== projectStorageRoot.toLowerCase()) {
    console.warn('[StorageConfig] Ignoring an external storage root; using project server/storage.');
  }
  return projectStorageRoot;
}

export function getPortfolioBackupRoot(storageRoot = getPortfolioStorageRoot()): string {
  const projectBackupRoot = path.resolve(storageRoot, 'backup');
  const configuredRoot = process.env.PORTFOLIO_BACKUP_DIR?.trim();
  if (!configuredRoot) return projectBackupRoot;

  const resolvedConfiguredRoot = path.resolve(configuredRoot);
  if (process.env.NODE_ENV === 'test') return resolvedConfiguredRoot;
  if (resolvedConfiguredRoot.toLowerCase() !== projectBackupRoot.toLowerCase()) {
    console.warn('[StorageConfig] Ignoring an external backup root; using server/storage/backup.');
  }
  return projectBackupRoot;
}
