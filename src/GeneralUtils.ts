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
