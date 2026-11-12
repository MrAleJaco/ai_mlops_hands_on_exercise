import { useState } from 'react'
import type { Meta, TablePage } from '../api/types'
import { Card, Stat } from '../components/ui/Card'
import { Status } from '../components/ui/Controls'
import { useApi } from '../hooks/useApi'
import { count } from '../lib/format'

/** The artefact the pipeline writes: 48,790 x 93, one row per person. */
export function ProcessedData() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const meta = useApi<Meta>('/api/meta', {})
  const table = useApi<TablePage>('/api/table', { page, size: 25, search })

  return (
    <>
      <header className="page-header">
        <h1>Processed data</h1>
        <p>
          The encoded table that <code>part_1_task1/src/build_dataset.py</code> writes, served page by
          page. This is the only view that uses the 93-column artefact; every chart reads the
          readable 14-column analysis frame instead, because one-hot columns make charts unreadable.
        </p>
      </header>

      <Status loading={meta.isLoading} error={meta.error}>
        {meta.data && (
          <div className="kpi-grid">
            <Stat
              label="Encoded shape"
              value={meta.data.encoded_shape ? `${count(meta.data.encoded_shape[0])} × ${meta.data.encoded_shape[1]}` : 'not built'}
              detail="rows × columns"
            />
            <Stat label="Analysis frame" value={`${count(meta.data.total_rows)} × 14`} detail="what the charts use" />
            <Stat label="Duplicates dropped" value={count(meta.data.duplicates_dropped)} detail="exact duplicates after label fix" />
            <Stat label="Missing cells" value="0" detail="validate_final_frame() refuses anything else" />
          </div>
        )}
      </Status>

      <Card
        title="Encoded table"
        hint={
          table.data
            ? `${count(table.data.total_rows)} rows · ${count(table.data.columns.length)} columns shown · page ${table.data.page} of ${count(table.data.pages)}`
            : undefined
        }
        actions={
          <label className="field">
            <span>Column search</span>
            <input
              type="search"
              value={search}
              placeholder="workclass, age, income…"
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </label>
        }
      >
        <Status loading={table.isLoading} error={table.error}>
          {table.data && (
            <>
              <div className="table-scroll">
                <table className="table compact numeric">
                  <thead>
                    <tr>
                      {table.data.columns.map((column) => (
                        <th key={column} className={column === table.data?.target_column ? 'target-col' : undefined}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.data.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={
                              table.data?.columns[cellIndex] === table.data?.target_column ? 'target-col' : undefined
                            }
                          >
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pager">
                <button type="button" className="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  ← Previous
                </button>
                <span className="muted">
                  rows {(page - 1) * 25 + 1}–{Math.min(page * 25, table.data.total_rows)} of {count(table.data.total_rows)}
                </span>
                <button
                  type="button"
                  className="ghost"
                  disabled={page >= table.data.pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </Status>
      </Card>

      <Card title="Why this shape" hint="Each step is enforced by part_1_task1/src/census_pipeline.py and its 19 tests.">
        <ul className="bullets">
          <li>
            <strong>6 numeric columns</strong> stay numeric and are median-imputed by the
            preprocessor (on this file nothing is missing, so the branch never fires).
          </li>
          <li>
            <strong>7 categorical columns</strong> are filled with the literal <code>"Unknown"</code>{' '}
            and one-hot encoded, giving 86 dummy columns; unseen categories are ignored at transform
            time.
          </li>
          <li>
            <strong>education</strong> is dropped: it is a 1-to-1 copy of <code>education-num</code>.
          </li>
          <li>
            <strong>The target</strong> is the last column, 0 = <code>&lt;=50K</code>, 1 ={' '}
            <code>&gt;50K</code>.
          </li>
        </ul>
      </Card>
    </>
  )
}
