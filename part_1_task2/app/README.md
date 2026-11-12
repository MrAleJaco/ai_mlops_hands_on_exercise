# Census Income Explorer - front end

React 19 + TypeScript + Vite + Apache ECharts. See [`../README.md`](../README.md)
for the full stack, the API contract and the deployment.

## Development

The app expects the API on port 8000; Vite proxies `/api` to it.

```bash
# terminal 1 (repository root)
uv run uvicorn app:app --app-dir part_1_task2/api --reload --port 8000

# terminal 2
cd part_1_task2/app
npm install
npm run dev          # http://localhost:5173
```

## Checks

```bash
npm run build        # tsc -b && vite build
npm run test         # 13 Vitest tests (filters, box statistics, pages)
npm run screenshots  # Playwright smoke test against a running stack
```

`npm run screenshots` writes one PNG per view to `../reports/screenshots/`
and fails if the browser logs an error, so it is both the evidence for the
report and a regression check.

## Layout

| Path | Responsibility |
| --- | --- |
| `src/pages/` | one file per view: Overview, Distribution, TargetRelation, Correlations, ProcessedData |
| `src/components/charts/` | ECharts option builders, one per figure (`BoxPlot`, `CountsChart`, `ShareBars`, `Density`, `Scatter`, `ScatterMatrix`) |
| `src/components/Chart.tsx` | the only place that touches the ECharts runtime (init, resize, dispose) |
| `src/hooks/useFilters.ts` | filters live in the URL: parse, apply, reset |
| `src/hooks/useApi.ts` | TanStack Query wrapper: cache key = endpoint + filters |
| `src/api/` | typed fetch client and hand-written response types |
