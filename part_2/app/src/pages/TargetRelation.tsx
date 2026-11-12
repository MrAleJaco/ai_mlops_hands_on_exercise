import { useState } from 'react'
import type { TargetCategorical, TargetNumeric } from '../api/types'
import { BoxPlotChart } from '../components/charts/BoxPlot'
import { DensityChart } from '../components/charts/Density'
import { ShareBarsChart } from '../components/charts/ShareBars'
import { Card, Stat } from '../components/ui/Card'
import { Select, Status, Toggle } from '../components/ui/Controls'
import { useApi } from '../hooks/useApi'
import { toApiParams, useFilters } from '../hooks/useFilters'
import { count, number, percent, signed } from '../lib/format'
import { classes } from '../lib/palette'

type Mode = 'numeric' | 'categorical'
type SortKey = 'share' | 'n' | 'label'

/** Figures 2 and 3: does the distribution move between <=50K and >50K? */
export function TargetRelation() {
  const { filters } = useFilters()
  const params = toApiParams(filters)

  const [mode, setMode] = useState<Mode>('numeric')
  const [numericColumn, setNumericColumn] = useState('education-num')
  const [categoricalColumn, setCategoricalColumn] = useState('marital-status')
  const [showDensity, setShowDensity] = useState(true)
  const [minN, setMinN] = useState(30)
  const [sortKey, setSortKey] = useState<SortKey>('share')

  const numeric = useApi<TargetNumeric>(
    '/api/target-numeric',
    { ...params, column: numericColumn },
    mode === 'numeric',
  )
  const categorical = useApi<TargetCategorical>(
    '/api/target-categorical',
    { ...params, column: categoricalColumn, min_n: minN },
    mode === 'categorical',
  )

  const columns = numeric.data?.classes ?? []
  const levels = [...(categorical.data?.levels ?? [])].sort((left, right) => {
    if (sortKey === 'n') return right.n - left.n
    if (sortKey === 'label') return left.label.localeCompare(right.label)
    return left.share - right.share
  })

  return (
    <>
      <header className="page-header">
        <h1>Target relation</h1>
        <p>
          The same question for both kinds of column: does the row distribution change between the
          two income classes? Numeric columns get a box plot per class plus their densities;
          categorical columns get the share of high earners inside every category, with a 95%
          interval so thin categories cannot pretend to be findings.
        </p>
      </header>

      <Toggle
        label="Column type"
        value={mode}
        options={[
          { value: 'numeric', label: 'Numerical columns' },
          { value: 'categorical', label: 'Categorical columns' },
        ]}
        onChange={setMode}
      />

      {mode === 'numeric' && (
        <Status loading={numeric.isLoading} error={numeric.error}>
          {numeric.data && numeric.data.classes.length > 0 && (
            <>
              <Card
                title={`${numeric.data.column} by income class`}
                hint="One box per class; dots are rows outside 1.5 × IQR in their class."
                actions={
                  <>
                    <Select
                      label="Column"
                      value={numericColumn}
                      options={[
                        'age',
                        'fnlwgt',
                        'education-num',
                        'capital-gain',
                        'capital-loss',
                        'hours-per-week',
                      ].map((value) => ({ value, label: value }))}
                      onChange={setNumericColumn}
                    />
                    <Toggle
                      label="Density"
                      value={showDensity ? 'on' : 'off'}
                      options={[
                        { value: 'on', label: 'Show' },
                        { value: 'off', label: 'Hide' },
                      ]}
                      onChange={(value) => setShowDensity(value === 'on')}
                    />
                  </>
                }
              >
                <BoxPlotChart
                  series={columns.map((entry) => ({
                    label: entry.label,
                    stats: entry.stats,
                    color: classes.find((item) => item.value === entry.value)?.color ?? '#2E6F9E',
                  }))}
                  height={380}
                  label={`${numeric.data.column} split by income class`}
                />

                <div className="stat-row">
                  <Stat
                    label="Median shift"
                    value={numeric.data.median_shift === null ? '—' : signed(numeric.data.median_shift, 0)}
                    detail=">50K vs <=50K"
                  />
                  {columns.map((entry) => (
                    <Stat
                      key={entry.value}
                      label={`${entry.label} median`}
                      value={number(entry.stats.median, 1)}
                      detail={`mean ${number(entry.stats.mean, 1)} · n ${count(entry.stats.n)}`}
                    />
                  ))}
                </div>

                {showDensity && (
                  <DensityChart
                    series={columns.map((entry) => ({
                      label: entry.label,
                      color: classes.find((item) => item.value === entry.value)?.color ?? '#2E6F9E',
                      density: entry.density,
                    }))}
                    xName={numeric.data.column}
                    height={240}
                  />
                )}

                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>n</th>
                      <th>q1</th>
                      <th>Median</th>
                      <th>q3</th>
                      <th>Mean</th>
                      <th>Outliers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((entry) => (
                      <tr key={entry.value}>
                        <td>{entry.label}</td>
                        <td>{count(entry.stats.n)}</td>
                        <td>{number(entry.stats.q1, 1)}</td>
                        <td>{number(entry.stats.median, 1)}</td>
                        <td>{number(entry.stats.q3, 1)}</td>
                        <td>{number(entry.stats.mean, 1)}</td>
                        <td>
                          {count(entry.stats.outliers.count)} ({percent(entry.stats.outliers.share)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </Status>
      )}

      {mode === 'categorical' && (
        <Status loading={categorical.isLoading} error={categorical.error}>
          {categorical.data && (
            <Card
              title={`${categorical.data.column}: share earning more than 50K`}
              hint={`Overall ${percent(categorical.data.overall_share)} · ${categorical.data.hidden_below_min_n} categories hidden below n = ${minN}`}
              actions={
                <>
                  <Select
                    label="Column"
                    value={categoricalColumn}
                    options={[
                      'workclass',
                      'marital-status',
                      'occupation',
                      'relationship',
                      'race',
                      'sex',
                      'native-country',
                    ].map((value) => ({ value, label: value }))}
                    onChange={setCategoricalColumn}
                  />
                  <Select
                    label="Sort"
                    value={sortKey}
                    options={[
                      { value: 'share', label: 'Share' },
                      { value: 'n', label: 'Rows' },
                      { value: 'label', label: 'Name' },
                    ]}
                    onChange={(value) => setSortKey(value as SortKey)}
                  />
                </>
              }
            >
              <div className="slider-row">
                <label htmlFor="min-n">Minimum rows per category: {minN}</label>
                <input
                  id="min-n"
                  type="range"
                  min={1}
                  max={500}
                  step={5}
                  value={minN}
                  onChange={(event) => setMinN(Number(event.target.value))}
                />
                <span className="muted">
                  hide categories too small to trust (France: 42% on 38 rows)
                </span>
              </div>

              <ShareBarsChart
                levels={levels}
                overall={categorical.data.overall_share}
                height={Math.min(760, Math.max(260, levels.length * 26 + 80))}
                label={`Share above 50K per ${categorical.data.column} category`}
              />

              <p className="note">
                Bars are the share of rows in that category earning more than 50K; the grey line is
                the 95% Wilson interval and the dashed red line is the overall share for the current
                selection. Hover a bar for the raw counts.
              </p>
            </Card>
          )}
        </Status>
      )}
    </>
  )
}
