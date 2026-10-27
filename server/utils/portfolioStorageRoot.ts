import path from 'path';

export function getPortfolioStorageRoot(): string {
  const projectStorageRoot = path.resolve(process.cwd(), 'server/storage');
  const configuredRoot = process.env.PORTFOLIO_STORAGE_DIR?.trim();
  if (!configuredRoot) return projectStorageRoot;

  return path.resolve(configuredRoot);
}

export function getPortfolioBackupRoot(storageRoot = getPortfolioStorageRoot()): string {
  const projectBackupRoot = path.resolve(storageRoot, 'backup');
  const configuredRoot = process.env.PORTFOLIO_BACKUP_DIR?.trim();
  if (!configuredRoot) return projectBackupRoot;

  return path.resolve(configuredRoot);
}
