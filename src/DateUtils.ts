import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const DEFAULT_TIMEZONE = getCurrentTimezone();

console.log('Current detected timezone:', getCurrentTimezone());

export function getCurrentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getDateTimeString(date?: Date): string {
  return dayjs(date).format('YYYY-MM-DD__HH-mm-ss');
}

export function getPrettyDateTimeString(date?: Date): string {
  return dayjs(date).format('MMM D, YYYY h:mma');
}

export function getPrettyDateTimeStringWithTz(date?: Date): string {
  return dayjs(date).format('MMM D, YYYY h:mma Z');
}

export function getPrettyDateTimeStringWithSeconds(date?: Date): string {
  return dayjs(date).format('MMM D, YYYY h:mm:ss a');
}

export function getDateString(date?: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

export function getTimePrettyString(date?: Date): string {
  return dayjs(date).format('h:mm a');
}
export function parseDateStringToNativeDate(dateString: string): Date | null {
  const d = dayjs(dateString).toDate();
  return isNaN(d.valueOf()) ? null : d;
}

export function parseDateStringToNativeDateThrows(dateString: string): Date {
  const d = dayjs(dateString).toDate();
  if (isNaN(d.valueOf())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return d;
}

export function parseDateStringToNativeDateWithTimezoneThrows(
  dateString: string,
  timezone: string = DEFAULT_TIMEZONE,
): Date | null {
  const d = dayjs.tz(dateString, timezone).toDate();
  if (isNaN(d.valueOf())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return d;
}

export function parseAndGetTimeSinceValue(dateString: string): number | null {
  const d = parseDateStringToNativeDate(dateString);
  if (d == null) {
    return null;
  }
  return Date.now() - d.valueOf();
}

export function getDurationString(durationMs: number): string {
  const durationMinutes = Math.floor(durationMs / 1000 / 60);
  if (durationMinutes < 60) {
    return `${durationMinutes}m`;
  }
  const durationHours = Math.floor(durationMinutes / 60);
  return `${durationHours}h ${durationMinutes % 60}m`;
}

export function getDurationStringWithSecondsBelow60(
  durationMs: number,
): string {
  const durationSeconds = Math.floor(durationMs / 1000);
  if (durationSeconds < 60) {
    return `${durationSeconds}s`;
  }
  const durationMinutes = Math.floor(durationMs / 1000 / 60);
  if (durationMinutes < 60) {
    return `${durationMinutes}m`;
  }
  const durationHours = Math.floor(durationMinutes / 60);
  return `${durationHours}h ${durationMinutes % 60}m`;
}
