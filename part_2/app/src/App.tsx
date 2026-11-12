import { NavLink, Route, Routes } from 'react-router-dom'
import { FilterBar } from './components/layout/FilterBar'
import { Correlations } from './pages/Correlations'
import { Distribution } from './pages/Distribution'
import { Overview } from './pages/Overview'
import { ProcessedData } from './pages/ProcessedData'
import { TargetRelation } from './pages/TargetRelation'

const links = [
  { to: '/', label: 'Overview', end: true },
  { to: '/distribution', label: 'Distribution' },
  { to: '/target', label: 'Target relation' },
  { to: '/correlations', label: 'Correlations' },
  { to: '/data', label: 'Processed data' },
]

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <strong>Census Income Explorer</strong>
            <span className="brand-sub">Task 1 charts, interactive</span>
          </div>
        </div>
        <nav aria-label="Views">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
          <a className="nav-link" href="/docs" target="_blank" rel="noreferrer">
            API docs
          </a>
        </nav>
      </header>

      <FilterBar />

      <main className="content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/distribution" element={<Distribution />} />
          <Route path="/target" element={<TargetRelation />} />
          <Route path="/correlations" element={<Correlations />} />
          <Route path="/data" element={<ProcessedData />} />
          <Route path="*" element={<p className="muted">Unknown view.</p>} />
        </Routes>
      </main>

      <footer className="footer">
        <span>Census Income · 48,790 rows after cleaning · data served by FastAPI, charts by ECharts</span>
        <span>Source: part_1/src/census_pipeline.py + build_dataset.py</span>
      </footer>
    </div>
  )
}
