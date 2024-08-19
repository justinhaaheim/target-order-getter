/**
 * This is needed because typescript's definition of array.filter doesn't assume type narrowing.
 *
 * In order to avoid errors with user-defined type guards I'm defining this once here and reusing it across the codebase.
 *
 * References:
 * * https://stackoverflow.com/a/62033938
 * * https://stackoverflow.com/questions/57988567/filter-to-remove-undefined-items-is-not-picked-up-by-typescript/57989288#57989288
 * * https://www.chakshunyu.com/blog/how-to-filter-nullable-values-from-an-array-using-typescript/
 *
 */

export default function isNonNullable<TValue>(
  value: TValue | null | undefined,
): value is TValue {
  return value !== null && value !== undefined;
}
