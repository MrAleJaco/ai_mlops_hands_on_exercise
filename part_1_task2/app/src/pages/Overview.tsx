import { Link } from 'react-router-dom'
import type { Highlights, Meta } from '../api/types'
import { Card, Stat } from '../components/ui/Card'
import { Status } from '../components/ui/Controls'
import { useApi } from '../hooks/useApi'
import { toApiParams, useFilters } from '../hooks/useFilters'
import { count, percent } from '../lib/format'

const pageFor: Record<string, string> = {
  '01_distribution.png': '/distribution',
  '02_target_vs_numeric.png': '/target',
  '03_target_vs_categorical.png': '/target',
  '04_relation_numeric.png': '/correlations',
}

export function Overview() {
  const { filters } = useFilters()
  const params = toApiParams(filters)
  const meta = useApi<Meta>('/api/meta', params)
  const highlights = useApi<Highlights>('/api/highlights', params)

  return (
    <>
      <header className="page-header">
        <h1>One view of the whole analysis</h1>
        <p>
          The four figures of <code>part_1_task1/src/make_charts.py</code>, drawn live from the same
          pipeline that produced the Task 1 report. Every number below is computed by the API on
          the current filter selection, not copied into the page.
        </p>
      </header>

      <Status loading={meta.isLoading} error={meta.error}>
        {meta.data && (
          <>
            <div className="kpi-grid">
              <Stat
                label="Rows in view"
                value={count(meta.data.rows_after_filter)}
                detail={`of ${count(meta.data.total_rows)} after de-duplication`}
              />
              <Stat
                label="High earners (>50K)"
                value={percent(meta.data.target.positive_share)}
                detail={`${count(meta.data.target.positive_rows)} rows`}
              />
              <Stat
                label="Rows with a missing field"
                value={count(meta.data.unknown_rows)}
                detail={`${percent(meta.data.unknown_share)} filled with "Unknown"`}
              />
              <Stat
                label="Encoded table"
                value={
                  meta.data.encoded_shape
                    ? `${count(meta.data.encoded_shape[0])} × ${meta.data.encoded_shape[1]}`
                    : 'not built'
                }
                detail="6 numeric + 86 one-hot + target"
              />
            </div>

            <Card
              title="Pipeline, as it runs today"
              hint="The API re-runs the Task 1 preprocessing at startup; the React app only receives aggregates."
            >
              <div className="flow">
                <div className="flow-step">
                  <span className="flow-label">Raw file</span>
                  <strong>
                    {count(meta.data.raw_rows)} × {meta.data.raw_columns}
                  </strong>
                  <small>padded headers, " ?" missing values, 4 label spellings</small>
                </div>
                <span className="flow-arrow" aria-hidden="true">
                  →
                </span>
                <div className="flow-step">
                  <span className="flow-label">Cleaned analysis frame</span>
                  <strong>
                    {count(meta.data.total_rows)} × 14
                  </strong>
                  <small>{count(meta.data.duplicates_dropped)} duplicates dropped, education removed</small>
                </div>
                <span className="flow-arrow" aria-hidden="true">
                  →
                </span>
                <div className="flow-step">
                  <span className="flow-label">Encoded table</span>
                  <strong>{meta.data.encoded_shape ? `× ${meta.data.encoded_shape[1]}` : '—'}</strong>
                  <small>median impute, "Unknown" fill, one-hot encode</small>
                </div>
              </div>
            </Card>

            <h2 className="section-title">What each figure claims</h2>
            <p className="section-lead">
              Each card links to its interactive view. The numbers are the Task 1 captions,
              recomputed on the rows currently selected in the filter bar.
            </p>
            <div className="claim-grid">
              {highlights.data?.claims.map((claim) => (
                <Link key={claim.figure} to={pageFor[claim.figure] ?? '/'} className="claim-card">
                  <img src={`/figures/${claim.figure}`} alt={`Reference figure: ${claim.title}`} loading="lazy" />
                  <div className="claim-body">
                    <h3>{claim.title}</h3>
                    <p>{claim.claim}</p>
                    <span className="claim-link">Open interactive view →</span>
                  </div>
                </Link>
              ))}
            </div>

            <Card title="Data issues found and fixed" hint="The same five items documented in the Task 1 report.">
              <table className="table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>What the pipeline does</th>
                  </tr>
                </thead>
                <tbody>
                  {meta.data.issues.map((issue) => (
                    <tr key={issue.title}>
                      <td>{issue.title}</td>
                      <td>{issue.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </Status>
    </>
  )
}
