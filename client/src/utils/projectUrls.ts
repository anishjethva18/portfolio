export const normalizeProjectDemoUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
};
