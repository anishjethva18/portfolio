export const DEFAULT_TIME_ZONE = process.env.TZ || 'Asia/Kolkata';

export function formatEmailTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  const parts = new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: DEFAULT_TIME_ZONE,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';

  return `${value('day')} ${value('month')} ${value('year')}, ${value('hour')}:${value('minute')} ${value('dayPeriod').toUpperCase()} IST`;
}
