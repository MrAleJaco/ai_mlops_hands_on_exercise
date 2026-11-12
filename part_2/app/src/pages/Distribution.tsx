import { useState } from 'react'
import type { Distribution as DistributionData } from '../api/types'
import { BoxPlotChart } from '../components/charts/BoxPlot'
import { CountsChart } from '../components/charts/CountsChart'
import { Card, Stat } from '../components/ui/Card'
import { Select, Status, Toggle } from '../components/ui/Controls'
import { useApi } from '../hooks/useApi'
import { toApiParams, useFilters } from '../hooks/useFilters'
import { count, number, percent } from '../lib/format'
import { colors } from '../lib/palette'

/** Figure 1: box plots expose the outliers, per column. */
export function Distribution() {
  const { filters } = useFilters()
  const params = toApiParams(filters)
  const { data, isLoading, error } = useApi<DistributionData>('/api/distribution', params)

  const [numericColumn, setNumericColumn] = useState('age')
  const [categoricalColumn, setCategoricalColumn] = useState('native-country')
  const [catMode, setCatMode] = useState<'bars' | 'box'>('bars')
  const [logChoice, setLogChoice] = useState<'auto' | 'linear' | 'log'>('auto')

  const numeric = data?.numeric.find((row) => row.column === numericColumn) ?? data?.numeric[0]
  const categorical =
    data?.categorical.find((row) => row.column === categoricalColumn) ?? data?.categorical[0]
  const logAxis = logChoice === 'auto' ? Boolean(categorical?.log_axis) : logChoice === 'log'

  return (
    <>
      <header className="page-header">
        <h1>Distribution</h1>
        <p>
          One box per column. For numeric columns the box shows quartiles and the dots are rows
          outside 1.5 × IQR; for categorical columns the box is built from the <em>category counts</em>,
          so a rare level appears as a flier — exactly what the design asked the box plots to reveal.
        </p>
      </header>

      <Status loading={isLoading} error={error}>
        {data && numeric && (
          <>
            <Card
              title="Numerical columns"
              hint={`${count(data.rows)} rows in the current selection`}
              actions={
                <Select
                  label="Column"
                  value={numeric.column}
                  options={data.numeric.map((row) => ({ value: row.column, label: row.column }))}
                  onChange={setNumericColumn}
                />
              }
            >
              <BoxPlotChart
                series={[{ label: numeric.column, stats: numeric, color: colors.numeric }]}
                height={360}
                label={`Box plot of ${numeric.column}`}
              />
              <div className="stat-row">
                <Stat label="Median" value={number(numeric.median, 1)} detail={`mean ${number(numeric.mean, 1)}`} />
                <Stat label="IQR" value={`${number(numeric.q1, 1)} – ${number(numeric.q3, 1)}`} detail="q1 to q3" />
                <Stat
                  label="Outliers"
                  value={count(numeric.outliers.count)}
                  detail={`${percent(numeric.outliers.share)} of rows · max ${number(numeric.max, 0)}`}
                />
                <Stat label="Range" value={`${number(numeric.min, 0)} – ${number(numeric.max, 0)}`} detail="min to max" />
              </div>

              <details className="details">
                <summary>All numeric columns at a glance</summary>
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Median</th>
                      <th>Mean</th>
                      <th>Outliers</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.numeric.map((row) => (
                      <tr
                        key={row.column}
                        className={row.column === numeric.column ? 'selected' : undefined}
                        onClick={() => setNumericColumn(row.column)}
                      >
                        <td>{row.column}</td>
                        <td>{number(row.median, 1)}</td>
                        <td>{number(row.mean, 1)}</td>
                        <td>{count(row.outliers.count)}</td>
                        <td>{percent(row.outliers.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Card>

            <Card
              title="Categorical columns"
              hint={
                categorical
                  ? `${categorical.level_count} levels · commonest ${categorical.commonest?.label} (${count(
                      categorical.commonest?.count ?? 0,
                    )}) · rarest ${categorical.rarest?.label} (${count(categorical.rarest?.count ?? 0)})`
                  : undefined
              }
              actions={
                <>
                  <Select
                    label="Column"
                    value={categorical?.column ?? ''}
                    options={data.categorical.map((row) => ({ value: row.column, label: row.column }))}
                    onChange={setCategoricalColumn}
                  />
                  <Toggle
                    label="View"
                    value={catMode}
                    options={[
                      { value: 'bars', label: 'Counts' },
                      { value: 'box', label: 'Box of counts' },
                    ]}
                    onChange={setCatMode}
                  />
                  <Toggle
                    label="Axis"
                    value={logChoice}
                    options={[
                      { value: 'auto', label: 'Auto' },
                      { value: 'linear', label: 'Linear' },
                      { value: 'log', label: 'Log' },
                    ]}
                    onChange={setLogChoice}
                  />
                </>
              }
            >
              {categorical && (
                <>
                  <CountsChart
                    levels={categorical.levels}
                    column={categorical.column}
                    mode={catMode}
                    logAxis={logAxis}
                    height={Math.min(560, Math.max(280, categorical.levels.length * 22 + 90))}
                  />
                  <p className="note">
                    {categorical.log_axis
                      ? 'Counts span more than 100×, so the auto axis is logarithmic — on a linear axis every rare level would be invisible next to the commonest one.'
                      : 'Counts span less than 100×, so a linear axis is readable.'}
                  </p>

                  <details className="details">
                    <summary>Levels and shares</summary>
                    <table className="table compact">
                      <thead>
                        <tr>
                          <th>Level</th>
                          <th>Rows</th>
                          <th>Share of view</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categorical.levels.slice(0, 15).map((level) => (
                          <tr key={level.label}>
                            <td>{level.label}</td>
                            <td>{count(level.count)}</td>
                            <td>{percent(level.share, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {categorical.levels.length > 15 && (
                      <p className="note">Showing the 15 commonest of {categorical.level_count} levels.</p>
                    )}
                  </details>
                </>
              )}
            </Card>
          </>
        )}
      </Status>
    </>
  )
}
