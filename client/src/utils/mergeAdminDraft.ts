const missing = Symbol('missing');

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeValue(base: unknown, local: unknown, latest: unknown): unknown {
  if (base === local || equal(base, local)) return latest === missing ? missing : clone(latest);
  if (local === missing) return missing;
  if (base === missing) return clone(local);
  if (!isRecord(base) || !isRecord(local)) return clone(local);

  const merged: Record<string, unknown> = {};
  const latestRecord = isRecord(latest) ? latest : {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(latestRecord)]);
  for (const key of keys) {
    const baseValue = Object.prototype.hasOwnProperty.call(base, key) ? base[key] : missing;
    const localValue = Object.prototype.hasOwnProperty.call(local, key) ? local[key] : missing;
    const latestValue = Object.prototype.hasOwnProperty.call(latestRecord, key) ? latestRecord[key] : missing;
    const value = mergeValue(baseValue, localValue, latestValue);
    if (value !== missing) merged[key] = value;
  }
  return merged;
}

export function mergeAdminDraft<T>(base: T, local: T, latest: T): T {
  return mergeValue(base, local, latest) as T;
}
