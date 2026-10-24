export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export function resolveTimeZone(timeZone?: string): string {
  return timeZone && timeZone !== 'Local' ? timeZone : DEFAULT_TIME_ZONE;
}

export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
  timeZone = DEFAULT_TIME_ZONE
): string {
  const hasDateParts = ['weekday', 'era', 'year', 'month', 'day'].some((key) => key in options);
  const hasTimeParts = ['hour', 'minute', 'second', 'fractionalSecondDigits', 'dayPeriod', 'timeZoneName'].some((key) => key in options);
  return new Intl.DateTimeFormat('en-IN', {
    ...(!hasDateParts ? { dateStyle: 'medium' as const } : {}),
    ...(!hasTimeParts ? { timeStyle: 'short' as const } : {}),
    ...options,
    timeZone: resolveTimeZone(timeZone),
  }).format(new Date(value));
}

export function formatDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
  timeZone = DEFAULT_TIME_ZONE
): string {
  const hasDateParts = ['weekday', 'era', 'year', 'month', 'day'].some((key) => key in options);
  return new Intl.DateTimeFormat('en-IN', {
    ...(!hasDateParts ? { dateStyle: 'medium' as const } : {}),
    ...options,
    timeZone: resolveTimeZone(timeZone),
  }).format(new Date(value));
}

export function formatTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
  timeZone = DEFAULT_TIME_ZONE
): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
    timeZone: resolveTimeZone(timeZone),
  }).format(new Date(value));
}

export function formatBackupDateTime(value: string | number | Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: resolveTimeZone(timeZone),
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  return `${part('day')}-${part('month')}-${part('year')} ${part('hour')}:${part('minute')}:${part('second')}-${part('dayPeriod').toUpperCase()}`;
}

export function formatDateISO(value: string | number | Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = getZonedDateParts(value, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getZonedDateParts(value: string | number | Date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    timeZone: resolveTimeZone(timeZone),
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: get('weekday'),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    second: Number(get('second')),
  };
}
