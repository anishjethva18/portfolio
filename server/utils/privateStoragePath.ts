import fs from 'fs';
import path from 'path';

export function assertPrivateStoragePath(storagePath: string, label: string): string {
  const resolvedStoragePath = path.resolve(storagePath);
  let existingAncestor = resolvedStoragePath;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }
  const canonicalAncestor = fs.existsSync(existingAncestor)
    ? fs.realpathSync(existingAncestor)
    : existingAncestor;
  const canonicalStoragePath = path.resolve(
    canonicalAncestor,
    path.relative(existingAncestor, resolvedStoragePath)
  );
  const publicDirectories = [
    path.resolve(process.cwd(), 'client/public'),
    path.resolve(process.cwd(), 'client/dist'),
  ];

  for (const publicDirectory of publicDirectories) {
    const canonicalPublicDirectory = fs.existsSync(publicDirectory)
      ? fs.realpathSync(publicDirectory)
      : publicDirectory;
    const relativePath = path.relative(canonicalPublicDirectory, canonicalStoragePath);
    if (
      relativePath === '' ||
      (relativePath !== '..' &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath))
    ) {
      throw new Error(`${label} must not be located inside client/public or client/dist.`);
    }
  }

  return canonicalStoragePath;
}
