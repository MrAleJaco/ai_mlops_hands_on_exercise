import { useApi } from '../../hooks/useApi'
import { AGE_LIMITS, HOURS_LIMITS, useFilters } from '../../hooks/useFilters'
import type { FilterOptions } from '../../api/types'
import { Chips, NumberRange, Select, Toggle } from '../ui/Controls'

/** The six filters every endpoint understands, written to the URL. */
export function FilterBar() {
  const { data: options, isLoading } = useApi<FilterOptions>('/api/filters')
  const { filters, update, reset, activeCount } = useFilters()

  if (isLoading || !options) {
    return (
      <div className="filterbar" aria-busy="true">
        <span className="muted">Loading filters…</span>
      </div>
    )
  }

  const workclassOptions = [
    { value: '', label: 'Any' },
    ...options.workclass.map((value) => ({ value, label: value })),
  ]
  const countryOptions = [
    { value: '', label: 'Any' },
    ...options['native-country'].map((item) => ({
      value: item.label,
      label: `${item.label} (${item.count.toLocaleString('en-US')})`,
    })),
  ]

  return (
    <div className="filterbar">
      <Toggle
        label="Income class"
        value={String(filters.income)}
        options={[
          { value: '', label: 'All' },
          { value: '0', label: '<=50K' },
          { value: '1', label: '>50K' },
        ]}
        onChange={(value) => update({ income: value === '' ? '' : (Number(value) as 0 | 1) })}
      />

      <Chips
        label="Sex"
        values={options.sex.map((value) => ({ value, label: value }))}
        selected={filters.sex}
        onToggle={(value) =>
          update({
            sex: filters.sex.includes(value)
              ? filters.sex.filter((item) => item !== value)
              : [...filters.sex, value],
          })
        }
      />

      <Select
        label="Workclass"
        value={filters.workclass[0] ?? ''}
        options={workclassOptions}
        onChange={(value) => update({ workclass: value ? [value] : [] })}
      />

      <Select
        label="Native country"
        value={filters.country[0] ?? ''}
        options={countryOptions}
        onChange={(value) => update({ country: value ? [value] : [] })}
      />

      <NumberRange
        label="Age"
        min={AGE_LIMITS.min}
        max={AGE_LIMITS.max}
        valueMin={filters.ageMin}
        valueMax={filters.ageMax}
        onChange={(ageMin, ageMax) => update({ ageMin, ageMax })}
      />

      <NumberRange
        label="Hours / week"
        min={HOURS_LIMITS.min}
        max={HOURS_LIMITS.max}
        valueMin={filters.hoursMin}
        valueMax={filters.hoursMax}
        onChange={(hoursMin, hoursMax) => update({ hoursMin, hoursMax })}
      />

      <div className="filterbar-actions">
        <button type="button" className="ghost" disabled={activeCount === 0} onClick={reset}>
          Reset{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>
    </div>
  )
}
