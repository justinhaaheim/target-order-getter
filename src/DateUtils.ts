import dayjs from 'dayjs';

export function getDateTimeString(date?: Date): string {
  return dayjs(date).format('YYYY-MM-DD__HH-mm-ss');
}

export function getPrettyDateTimeString(date?: Date): string {
  return dayjs(date).format('MMM D, YYYY h:mma');
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

export function parseDateToNativeDate(dateString?: string): Date | null {
  const d = dayjs(dateString).toDate();
  return isNaN(d.valueOf()) ? null : d;
}

export function parseAndGetTimeSinceValue(dateString?: string): number | null {
  const d = parseDateToNativeDate(dateString);
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
