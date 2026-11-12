import { describe, expect, it } from 'vitest'
import { boxFromValues, outliers } from '../lib/stats'

describe('box statistics for the count box plots', () => {
  it('returns the five-number summary of a small set', () => {
    expect(boxFromValues([1, 2, 3, 4])).toEqual([1, 1.75, 2.5, 3.25, 4])
  })

  it('returns null for an empty set', () => {
    expect(boxFromValues([])).toBeNull()
  })

  it('detects rare categories as outliers', () => {
    expect(outliers([10, 11, 12, 13, 400])).toEqual([400])
    expect(outliers([10, 11, 12, 13])).toEqual([])
  })

  it('clamps the whiskers to the data', () => {
    const box = boxFromValues([1, 2, 3, 4, 100])
    expect(box?.[4]).toBeLessThan(100)
  })
})
