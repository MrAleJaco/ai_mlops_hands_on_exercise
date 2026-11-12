import { describe, expect, it } from 'vitest'
import {
  AGE_LIMITS,
  DEFAULT_FILTERS,
  applyFilters,
  parseFilters,
  toApiParams,
} from '../hooks/useFilters'

describe('filter <-> URL round trip', () => {
  it('reads an empty URL as the default selection', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('reads every supported parameter', () => {
    const filters = parseFilters(
      new URLSearchParams('income=1&sex=Male,Female&workclass=Private&native-country=France&age_min=30&hours_max=60'),
    )
    expect(filters.income).toBe(1)
    expect(filters.sex).toEqual(['Male', 'Female'])
    expect(filters.workclass).toEqual(['Private'])
    expect(filters.country).toEqual(['France'])
    expect(filters.ageMin).toBe(30)
    expect(filters.hoursMax).toBe(60)
  })

  it('omits defaults from the API parameters', () => {
    const params = toApiParams(DEFAULT_FILTERS)
    expect(params.income).toBeUndefined()
    expect(params.age_min).toBeUndefined()
    expect(params['native-country']).toBeUndefined()
  })

  it('adds and removes parameters without dropping the others', () => {
    const withSex = applyFilters(new URLSearchParams(), { sex: ['Male'] })
    const withAge = applyFilters(withSex, { ageMin: 30, ageMax: AGE_LIMITS.max - 1 })
    expect(withAge.get('sex')).toBe('Male')
    expect(withAge.get('age_min')).toBe('30')
    expect(withAge.get('age_max')).toBe('89')

    const cleared = applyFilters(withAge, { sex: [] })
    expect(cleared.get('sex')).toBeNull()
    expect(cleared.get('age_min')).toBe('30')
  })

  it('clamps out-of-range values instead of trusting the URL', () => {
    const filters = parseFilters(new URLSearchParams('age_min=5&age_max=200'))
    expect(filters.ageMin).toBe(AGE_LIMITS.min)
    expect(filters.ageMax).toBe(AGE_LIMITS.max)
  })
})
