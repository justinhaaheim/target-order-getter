import fs from 'fs';
import path from 'path';

/**
 *
 * @param start
 * @param endArg
 * @returns array of numbers from start to end, not inclusive of end
 */
export function range(start: number, endArg?: number): number[] {
  let end = endArg;
  if (end == null) {
    end = start;
    start = 0;
  }
  return Array.from({length: end - start}, (_, i) => start + i);
}

const COMPACT_FORMATTER = Intl.NumberFormat(undefined, {notation: 'compact'});
const STANDARD_FORMATTER = Intl.NumberFormat(undefined, {notation: 'standard'});

export function formatCompactNumber(n: number): string {
  return COMPACT_FORMATTER.format(n);
}

export function formatStandardNumber(n: number): string {
  return STANDARD_FORMATTER.format(n);
}

export function generateUniqueFilePath(
  baseFilePath: string,
  suffix: string,
): string {
  const dir = path.dirname(baseFilePath);
  const ext = path.extname(baseFilePath);
  const baseName = path.basename(baseFilePath, ext);
  let newFilePath = path.join(dir, `${baseName}${suffix}${ext}`);
  let counter = 1;

  while (fs.existsSync(newFilePath)) {
    newFilePath = path.join(dir, `${baseName}${suffix}-${counter}${ext}`);
    counter++;
  }

  return newFilePath;
}

export function getFileSize(filePath: string): number | null {
  const stats = fs.statSync(filePath, {throwIfNoEntry: false});
  return stats?.size ?? null;
}
