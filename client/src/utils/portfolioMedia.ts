export function getPortfolioMediaId(value: string): string | undefined {
  try {
    const url = new URL(value, 'http://portfolio.local');
    if (url.pathname.startsWith('/api/portfolio-media/')) {
      const id = url.searchParams.get('id');
      if (id) return id;
      const legacyId = url.pathname.slice('/api/portfolio-media/'.length);
      return /^file-[A-Za-z0-9-]+$/.test(legacyId) ? legacyId : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function buildPortfolioMediaUrl(file: { id: string; name: string }): string {
  return `/api/portfolio-media/${encodeURIComponent(file.name)}?id=${encodeURIComponent(file.id)}`;
}

export function isPortfolioMediaUrl(value: string): boolean {
  try {
    const url = new URL(value, 'http://portfolio.local');
    return url.origin === 'http://portfolio.local' &&
      url.pathname.startsWith('/api/portfolio-media/') &&
      Boolean(getPortfolioMediaId(value));
  } catch {
    return false;
  }
}
