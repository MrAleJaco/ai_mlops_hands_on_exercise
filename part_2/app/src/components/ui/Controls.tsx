import type { ReactNode } from 'react'

interface SelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  id?: string
}

export function Select({ label, value, options, onChange, id }: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <label className="field" htmlFor={selectId}>
      <span>{label}</span>
      <select id={selectId} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

interface ToggleProps<T extends string | number> {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function Toggle<T extends string | number>({ label, value, options, onChange }: ToggleProps<T>) {
  return (
    <div className="toggle-group" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={option.value === value ? 'toggle active' : 'toggle'}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Chips({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string
  values: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="chips" role="group" aria-label={label}>
        {values.map((item) => (
          <button
            key={item.value}
            type="button"
            className={selected.includes(item.value) ? 'chip active' : 'chip'}
            aria-pressed={selected.includes(item.value)}
            onClick={() => onToggle(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface NumberRangeProps {
  label: string
  min: number
  max: number
  valueMin: number
  valueMax: number
  step?: number
  onChange: (min: number, max: number) => void
}

export function NumberRange({ label, min, max, valueMin, valueMax, step = 1, onChange }: NumberRangeProps) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="range">
        <input
          aria-label={`${label} minimum`}
          type="number"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(event) => onChange(Math.min(Number(event.target.value), valueMax), valueMax)}
        />
        <span className="range-sep">to</span>
        <input
          aria-label={`${label} maximum`}
          type="number"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(event) => onChange(valueMin, Math.max(Number(event.target.value), valueMin))}
        />
      </div>
    </div>
  )
}

export function Status({ loading, error, children }: { loading: boolean; error: unknown; children: ReactNode }) {
  if (loading) {
    return (
      <div className="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" /> Loading data…
      </div>
    )
  }
  if (error) {
    return (
      <div className="status error" role="alert">
        <strong>Could not load this view.</strong>
        <span>{error instanceof Error ? error.message : String(error)}</span>
      </div>
    )
  }
  return <>{children}</>
}
