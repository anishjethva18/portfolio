export type PortfolioAnalyticsCategory = 'navigation' | 'interaction';

const getVisitorId = (): string | undefined => {
  try {
    const storageKey = 'portfolio_analytics_visitor';
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;

    const visitorId = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(storageKey, visitorId);
    return visitorId;
  } catch {
    return undefined;
  }
};

export const trackPortfolioAnalytics = async (
  eventName: string,
  category: PortfolioAnalyticsCategory,
  page: string,
  metadata: Record<string, unknown> = {},
  eventId = createAnalyticsEventId(),
): Promise<void> => {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    eventId,
    eventName,
    category,
    page,
    metadata: { ...metadata, visitorId: getVisitorId() },
  });

  try {
    const response = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
    if (!response.ok) {
      console.warn(`Portfolio analytics event was rejected (${response.status}).`);
      return;
    }
    window.dispatchEvent(new Event('portfolio-analytics-updated'));
  } catch (error) {
    console.warn('Portfolio analytics event could not be recorded.', error);
  }
};

const createAnalyticsEventId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
