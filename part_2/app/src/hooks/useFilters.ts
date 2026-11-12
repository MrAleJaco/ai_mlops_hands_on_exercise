import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ParamValue } from '../api/client'

export const AGE_LIMITS = { min: 17, max: 90 }
export const HOURS_LIMITS = { min: 1, max: 99 }

export interface Filters {
  income: '' | 0 | 1
  sex: string[]
  workclass: string[]
  country: string[]
  ageMin: number
  ageMax: number
  hoursMin: number
  hoursMax: number
}

export const DEFAULT_FILTERS: Filters = {
  income: '',
  sex: [],
  workclass: [],
  country: [],
  ageMin: AGE_LIMITS.min,
  ageMax: AGE_LIMITS.max,
  hoursMin: HOURS_LIMITS.min,
  hoursMax: HOURS_LIMITS.max,
}

function splitList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function readNumber(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && value !== null && value !== '' ? parsed : fallback
}

/** Read the filter object out of the URL, so a view is shareable. */
export function parseFilters(params: URLSearchParams): Filters {
  const incomeRaw = params.get('income')
  return {
    income: incomeRaw === '1' ? 1 : incomeRaw === '0' ? 0 : '',
    sex: splitList(params.get('sex')),
    workclass: splitList(params.get('workclass')),
    country: splitList(params.get('native-country')),
    ageMin: clamp(readNumber(params.get('age_min'), AGE_LIMITS.min), AGE_LIMITS.min, AGE_LIMITS.max),
    ageMax: clamp(readNumber(params.get('age_max'), AGE_LIMITS.max), AGE_LIMITS.min, AGE_LIMITS.max),
    hoursMin: clamp(readNumber(params.get('hours_min'), HOURS_LIMITS.min), HOURS_LIMITS.min, HOURS_LIMITS.max),
    hoursMax: clamp(readNumber(params.get('hours_max'), HOURS_LIMITS.max), HOURS_LIMITS.min, HOURS_LIMITS.max),
  }
}

/** Query parameters for the API; defaults are omitted to keep URLs short. */
export function toApiParams(filters: Filters): Record<string, ParamValue> {
  return {
    income: filters.income === '' ? undefined : filters.income,
    sex: filters.sex.length ? filters.sex.join(',') : undefined,
    workclass: filters.workclass.length ? filters.workclass.join(',') : undefined,
    'native-country': filters.country.length ? filters.country.join(',') : undefined,
    age_min: filters.ageMin === AGE_LIMITS.min ? undefined : filters.ageMin,
    age_max: filters.ageMax === AGE_LIMITS.max ? undefined : filters.ageMax,
    hours_min: filters.hoursMin === HOURS_LIMITS.min ? undefined : filters.hoursMin,
    hours_max: filters.hoursMax === HOURS_LIMITS.max ? undefined : filters.hoursMax,
  }
}

/** Apply a patch to the URL, deleting parameters that returned to default. */
export function applyFilters(current: URLSearchParams, patch: Partial<Filters>): URLSearchParams {
  const next = new URLSearchParams(current)
  const filters: Filters = { ...parseFilters(current), ...patch }
  const api = toApiParams(filters)
  const mapping: Record<string, string> = {
    income: 'income',
    sex: 'sex',
    workclass: 'workclass',
    'native-country': 'native-country',
    age_min: 'age_min',
    age_max: 'age_max',
    hours_min: 'hours_min',
    hours_max: 'hours_max',
  }
  for (const [param, key] of Object.entries(mapping)) {
    const value = api[key]
    if (value === undefined) next.delete(param)
    else next.set(param, String(value))
  }
  return next
}

export function activeFilterCount(filters: Filters): number {
  let count = 0
  if (filters.income !== '') count += 1
  if (filters.sex.length) count += 1
  if (filters.workclass.length) count += 1
  if (filters.country.length) count += 1
  if (filters.ageMin !== AGE_LIMITS.min || filters.ageMax !== AGE_LIMITS.max) count += 1
  if (filters.hoursMin !== HOURS_LIMITS.min || filters.hoursMax !== HOURS_LIMITS.max) count += 1
  return count
}

export function useFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])

  const update = useCallback(
    (patch: Partial<Filters>) => {
      setParams((previous) => applyFilters(new URLSearchParams(previous), patch), { replace: true })
    },
    [setParams],
  )

  const reset = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true })
  }, [setParams])

  return { filters, update, reset, activeCount: activeFilterCount(filters) }
}
