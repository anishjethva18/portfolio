import { FileItem } from '../types';

export interface DriveMetric {
  id: string;
  letter: string;
  name: string;
  path: string;
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
  usedFormatted: string;
  totalFormatted: string;
  freeFormatted: string;
  summaryText: string;
  percent: number;
  hasWindows: boolean;
}

// Drive base definitions with fixed realistic capacities
// C: Drive: 174 GB total capacity
// D: Drive: 149 GB total capacity
const C_TOTAL_BYTES = 174 * 1024 * 1024 * 1024; // 174 GB
const D_TOTAL_BYTES = 149 * 1024 * 1024 * 1024; // 149 GB

// Baseline simulated system data keeps drive usage realistic without exposing C: child files.
const C_BASE_USED_BYTES = 128.4 * 1024 * 1024 * 1024; // ~128.4 GB used base -> ~45.6 GB free
const D_BASE_USED_BYTES = 29.0 * 1024 * 1024 * 1024;  // ~29.0 GB used base -> ~120 GB free

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = bytes / 1024;
  if (kb >= 1) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export function parseFileSizeToBytes(size: string | number | undefined, fallbackContent?: string): number {
  if (typeof size === 'number') return size;
  if (typeof size === 'string') {
    const s = size.toUpperCase().trim();
    const match = s.match(/^([\d.]+)\s*(TB|GB|MB|KB|B)?$/i);
    if (match) {
      const val = parseFloat(match[1]) || 0;
      const unit = (match[2] || 'KB').toUpperCase();
      if (unit === 'TB') return val * 1024 * 1024 * 1024 * 1024;
      if (unit === 'GB') return val * 1024 * 1024 * 1024;
      if (unit === 'MB') return val * 1024 * 1024;
      if (unit === 'KB') return val * 1024;
      if (unit === 'B') return val;
    }
  }
  if (fallbackContent) {
    return fallbackContent.length;
  }
  return 1024;
}

export function calculateDriveMetrics(
  files: FileItem[],
  driveLabels: Record<string, string> = {}
): DriveMetric[] {
  // Sum dynamically authored virtual files on C: vs D:
  let extraBytesC = 0;
  let extraBytesD = 0;

  files.forEach((f) => {
    const size = parseFileSizeToBytes(f.size, f.content);
    if (f.path.startsWith('D:')) {
      extraBytesD += size;
    } else {
      extraBytesC += size;
    }
  });

  // Calculate C:
  const cUsed = Math.min(C_TOTAL_BYTES, C_BASE_USED_BYTES + extraBytesC);
  const cFree = Math.max(0, C_TOTAL_BYTES - cUsed);
  const cPercent = Math.min(100, Math.max(1, Math.round((cUsed / C_TOTAL_BYTES) * 100)));
  const cLabel = driveLabels['C:'] || 'Local Disk';

  // Calculate D:
  const dUsed = Math.min(D_TOTAL_BYTES, D_BASE_USED_BYTES + extraBytesD);
  const dFree = Math.max(0, D_TOTAL_BYTES - dUsed);
  const dPercent = Math.min(100, Math.max(1, Math.round((dUsed / D_TOTAL_BYTES) * 100)));
  const dLabel = driveLabels['D:'] || 'New Volume';

  return [
    {
      id: 'c',
      letter: 'C:',
      name: `${cLabel} (C:)`,
      path: 'C:',
      usedBytes: cUsed,
      totalBytes: C_TOTAL_BYTES,
      freeBytes: cFree,
      usedFormatted: formatBytes(cUsed),
      totalFormatted: formatBytes(C_TOTAL_BYTES),
      freeFormatted: formatBytes(cFree),
      summaryText: `${formatBytes(cFree)} free of ${formatBytes(C_TOTAL_BYTES)}`,
      percent: cPercent,
      hasWindows: true,
    },
    {
      id: 'd',
      letter: 'D:',
      name: `${dLabel} (D:)`,
      path: 'D:',
      usedBytes: dUsed,
      totalBytes: D_TOTAL_BYTES,
      freeBytes: dFree,
      usedFormatted: formatBytes(dUsed),
      totalFormatted: formatBytes(D_TOTAL_BYTES),
      freeFormatted: formatBytes(dFree),
      summaryText: `${formatBytes(dFree)} free of ${formatBytes(D_TOTAL_BYTES)}`,
      percent: dPercent,
      hasWindows: false,
    },
  ];
}
