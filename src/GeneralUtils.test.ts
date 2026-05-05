import {range} from './GeneralUtils';

describe('range', () => {
  test('creates a range starting from 0 and stopping before end', () => {
    expect(range(5)).toEqual([0, 1, 2, 3, 4]);
  });

  test('creates a range starting from start and stopping before end', () => {
    expect(range(2, 6)).toEqual([2, 3, 4, 5]);
  });

  test('returns an empty array if end is set to 0', () => {
    expect(range(0)).toEqual([]);
  });

  test('returns an empty array if start and end are the same', () => {
    expect(range(4, 4)).toEqual([]);
  });

  test('returns an empty array if start > end', () => {
    expect(range(1, 0)).toEqual([]);
  });

  test('returns an empty array if start > end - larger', () => {
    expect(range(5, 0)).toEqual([]);
  });
});
