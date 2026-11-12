import { useState } from 'react'
import type { Relation, RelationMatrix } from '../api/types'
import { ScatterChart } from '../components/charts/Scatter'
import { ScatterMatrixChart } from '../components/charts/ScatterMatrix'
import { Card } from '../components/ui/Card'
import { Select, Status, Toggle } from '../components/ui/Controls'
import { useApi } from '../hooks/useApi'
import { toApiParams, useFilters } from '../hooks/useFilters'
import { count } from '../lib/format'

type Mode = 'matrix' | 'pair'

const numericColumns = ['age', 'fnlwgt', 'education-num', 'capital-gain', 'capital-loss', 'hours-per-week']

/** Figure 4: relations between the numerical columns. */
export function Correlations() {
  const { filters } = useFilters()
  const params = toApiParams(filters)

  const [mode, setMode] = useState<Mode>('matrix')
  const [x, setX] = useState('age')
  const [y, setY] = useState('education-num')
  const [full, setFull] = useState(false)
  const [logX, setLogX] = useState(false)
  const [logY, setLogY] = useState(false)

  const matrix = useApi<RelationMatrix>('/api/relation-matrix', { ...params, cap: 700 }, mode === 'matrix')
  const pair = useApi<Relation>('/api/relation', { ...params, x, y, full }, mode === 'pair')

  return (
    <>
      <header className="page-header">
        <h1>Relations between variables</h1>
        <p>
          The scatter matrix shows every pair at once and is the fastest way to spot the disguised
          duplicate columns, the hard cap in capital-gain and the pairs that separate the classes.
          The pair view enlarges one combination and can send every row. Categorical × categorical
          is <code>N/A</code> in the design and is not drawn.
        </p>
      </header>

      <Toggle
        label="View"
        value={mode}
        options={[
          { value: 'matrix', label: 'Scatter matrix' },
          { value: 'pair', label: 'One pair' },
        ]}
        onChange={setMode}
      />

      {mode === 'matrix' && (
        <Status loading={matrix.isLoading} error={matrix.error}>
          {matrix.data && (
            <Card
              title="Lower triangle, coloured by income class"
              hint={`${count(matrix.data.total_rows)} rows in view · up to ${count(
                matrix.data.cap_per_class,
              )} sampled points per class per panel · diagonal shows the per-class density`}
            >
              <ScatterMatrixChart data={matrix.data} height={780} />
              <p className="note">
                Sampling keeps the canvas responsive: 21 panels of {count(matrix.data.total_rows)} rows
                would be over a million points. Use “One pair” to see a single panel with the full data.
              </p>
            </Card>
          )}
        </Status>
      )}

      {mode === 'pair' && (
        <Status loading={pair.isLoading} error={pair.error}>
          {pair.data && (
            <Card
              title={`${pair.data.x} against ${pair.data.y}`}
              hint={
                pair.data.sampled
                  ? `Sampled: up to 4,000 rows per class of ${count(pair.data.total_rows)} in view`
                  : `All ${count(pair.data.total_rows)} rows in view`
              }
              actions={
                <>
                  <Select
                    label="X"
                    value={x}
                    options={numericColumns.map((value) => ({ value, label: value }))}
                    onChange={setX}
                  />
                  <Select
                    label="Y"
                    value={y}
                    options={numericColumns.map((value) => ({ value, label: value }))}
                    onChange={setY}
                  />
                  <Toggle
                    label="Points"
                    value={full ? 'all' : 'sample'}
                    options={[
                      { value: 'sample', label: 'Sample' },
                      { value: 'all', label: 'All rows' },
                    ]}
                    onChange={(value) => setFull(value === 'all')}
                  />
                  <Toggle
                    label="X axis"
                    value={logX ? 'log' : 'linear'}
                    options={[
                      { value: 'linear', label: 'Linear' },
                      { value: 'log', label: 'Log' },
                    ]}
                    onChange={(value) => setLogX(value === 'log')}
                  />
                  <Toggle
                    label="Y axis"
                    value={logY ? 'log' : 'linear'}
                    options={[
                      { value: 'linear', label: 'Linear' },
                      { value: 'log', label: 'Log' },
                    ]}
                    onChange={(value) => setLogY(value === 'log')}
                  />
                </>
              }
            >
              <ScatterChart data={pair.data} logX={logX} logY={logY} height={470} />
              <p className="note">
                {pair.data.classes.map((entry) => `${entry.label}: ${count(entry.n)}`).join(' · ')}.
                {(logX || logY) &&
                  ' A log axis cannot position zero values, so the 91.7% of capital-gain rows at zero disappear in that mode.'}
              </p>
            </Card>
          )}
        </Status>
      )}
    </>
  )
}
