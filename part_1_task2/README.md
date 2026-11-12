# Task 2 - Census Income Explorer

An interactive web app over the four figures of Task 1. The charts are no
longer PNGs: every view is drawn live from the same preprocessing pipeline,
with shared filters and a preview of the encoded 93-column artefact.

- **Front end:** React 19 + TypeScript + Vite, charts with Apache ECharts.
- **API:** FastAPI + pandas, serving server-side aggregates.
- **Deployment:** one `docker compose up` - a one-shot pipeline job, the API,
  and nginx serving the static bundle. No database.

The report with measured numbers and the trade-offs is in
[`reports/task2.md`](../reports/task2.md); screenshots of every view are in
[`reports/screenshots/`](reports/screenshots/).

## Views

| Route | What it shows |
| --- | --- |
| `/` | Four KPIs, the pipeline flow, and one card per Task 1 figure with its claim |
| `/distribution` | Figure 1: box plot per numeric column; counts or a box of category counts for categorical columns |
| `/target` | Figures 2 and 3: numeric columns split by class, or the share of high earners per category with 95% intervals |
| `/correlations` | Figure 4: the 6x6 scatter matrix, or one enlarged pair with the full data |
| `/data` | The encoded 48,790 x 93 table, paged and searchable by column |

The filter bar (income class, sex, workclass, native country, age range,
hours range) applies to every endpoint at once. The selection lives in the URL,
so any view can be bookmarked, shared or reloaded.

## Architecture

```
browser
   |  one origin: http://localhost:8080
   v
nginx (web:8080)  --- static bundle, SPA fallback
   |  /api/*  reverse proxy
   v
FastAPI (api:8000) --- analysis frame 48,790 x 14, encoded table 48,790 x 93
   ^                   in memory, aggregates cached by filter tuple
   |  reads artefacts from a named volume
pipeline (one-shot) --- build_dataset.py, exits 0 before the API starts
   ^
   |  read-only mounts
part_1_task1/data/raw_data/census_income.csv  (or datasets/census_income.csv)
```

Why no database: the analysis frame loads in 0.62 s and a cached aggregate
answers in ~2 ms (the uncached `/api/meta` audit takes ~24 ms because it
re-scans 48,790 rows for missing values). PostgreSQL would add a container, a
schema and a query layer without removing any of those costs. The API returns
0.9-105 KB of JSON per view instead of raw rows.

## Run it

**Prerequisites:** Docker Desktop (or Docker Engine + Compose v2) and the raw
file, which is deliberately not committed:

```bash
cp datasets/census_income.csv part_1_task1/data/raw_data/census_income.csv
```

Then, from the repository root:

```bash
cd part_1_task2/deploy
docker compose up -d --build
```

- App: <http://localhost:8080>
- API docs: <http://localhost:8080/docs>
- Health: <http://localhost:8080/healthz>

The `pipeline` service runs first and must exit 0; `api` starts only when it
has, and `web` only when the API is healthy. First start takes about a minute
(the pipeline writes the 9.5 MB encoded CSV); later starts are seconds because
the artefact stays in the `artifacts` volume.

Stop with `docker compose down` (keeps the volume) or
`docker compose down -v` (rebuilds the artefact next time).

### Configuration

Copy [`deploy/.env.example`](deploy/.env.example) to `deploy/.env` to change
host ports. Inside the containers the paths are fixed by compose:

| Variable | Default | Meaning |
| --- | --- | --- |
| `WEB_PORT` | `8080` | Host port of the nginx front end |
| `API_PORT` | `8000` | Host port of the API (bound to 127.0.0.1, for debugging) |
| `CENSUS_RAW_PATH` | `/data/raw/census_income.csv` | Raw CSV read by pipeline and API |
| `CENSUS_ENCODED_PATH` | `/data/artifacts/census_income_final.csv` | Where the pipeline writes the encoded table |
| `CORS_ORIGINS` | `http://localhost:5173` | Only needed for the dev server; production is same-origin |

### Development without Docker

```bash
# terminal 1 - repository root
uv sync
uv run uvicorn app:app --app-dir part_1_task2/api --reload --port 8000

# terminal 2
cd part_1_task2/app
npm install
npm run dev          # http://localhost:5173, proxies /api to :8000
```

## API

Every chart endpoint accepts the same filter parameters; unknown column names
return 400 with the allowed list.

| Parameter | Type | Example |
| --- | --- | --- |
| `income` | `0` or `1` | `1` (= >50K) |
| `sex` | comma separated | `Male,Female` |
| `workclass` | comma separated | `Private` |
| `native-country` | comma separated | `United-States,Mexico` |
| `age_min`, `age_max` | number | `30`, `55` |
| `hours_min`, `hours_max` | number | `35`, `60` |

| Endpoint | Returns | Payload (all rows) |
| --- | --- | --- |
| `GET /healthz` | status and rows loaded | 0.1 KB |
| `GET /api/filters` | valid filter choices, country counts, axis ranges | 1.6 KB |
| `GET /api/meta` | row audit, five data issues, target balance | 1.6 KB |
| `GET /api/highlights` | the four Task 1 claims, recomputed on the selection | 0.9 KB |
| `GET /api/distribution` | box statistics per numeric column, counts per categorical column | 21.7 KB |
| `GET /api/target-numeric?column=` | box statistics and density per class | 4.0 KB |
| `GET /api/target-categorical?column=&min_n=` | share above 50K per level with a 95% Wilson interval | 0.9 KB |
| `GET /api/relation?x=&y=&full=` | scatter points, sampled per class unless `full=true` | 59.6 KB |
| `GET /api/relation-matrix?cap=` | 21 panels of the lower triangle | 105.5 KB |
| `GET /api/table?page=&size=&search=` | page of the encoded table, columns filtered by name | 7.1 KB |

Outlier points are capped at 400 per column (250 per class), the one-pair
scatter samples 4,000 rows per class and every matrix panel 350, so a payload
cannot grow without bound - but every **count** is exact. The one-pair view can
send all 48,790 rows on request.

## Layout

| Path | Responsibility |
| --- | --- |
| `api/app.py` | FastAPI app, endpoints, in-memory `State` cache, path resolution |
| `api/aggregates.py` | pure pandas maths behind every chart, no HTTP |
| `api/filters.py` | shared filter dataclass, mask and cache key |
| `api/tests/` | 22 pytest tests, pinned to the Task 1 numbers |
| `app/src/pages/` | one file per view |
| `app/src/components/charts/` | ECharts option builders, one per figure |
| `app/src/hooks/useFilters.ts` | URL is the single source of truth for the selection |
| `app/src/hooks/useApi.ts` | TanStack Query wrapper: cache key = endpoint + filters |
| `deploy/` | both Dockerfiles, nginx config, compose file, artefact builder |
| `reports/` | screenshots referenced by `reports/task2.md` |

## Checks

```bash
uv run pytest part_1_task1/tests part_1_task2/api/tests -q   # 41 tests
cd part_1_task2/app && npm run test                   # 13 Vitest tests
cd part_1_task2/app && npm run build                  # type-check + bundle
cd part_1_task2/app && npm run screenshots            # 7 views, fails on console errors
```

`npm run screenshots` needs the stack running (or `APP_URL` pointing at the dev
server) and writes one PNG per view to `reports/screenshots/`.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `pipeline` exits 1 with "No raw CSV found" | The raw file is missing from both mounted folders | Copy it to `part_1_task1/data/raw_data/`, then `docker compose up -d` |
| `pipeline` exits 1 with `PermissionError` on `/data/artifacts` | The named volume is root-owned the first time it is created | Nothing to do: the service starts as root only to `chown` the volume and then drops to uid 10001 |
| `sh: not found` or `\r: not found` from the build script | The script was checked out with CRLF line endings | `.gitattributes` pins `*.sh` to LF; re-clone or run `git add --renormalize part_1_task2/deploy` |
| Web loads but every chart says "Could not load this view" | The API container is down or still starting | `docker compose ps`, then `docker compose logs api` |
| `/distribution` returns a 404 on refresh | nginx is serving an old config without the SPA fallback | Rebuild: `docker compose up -d --build web` |
| Port 8080 already in use | Another service on the host | Set `WEB_PORT=8081` in `deploy/.env` and start again |
| Charts are empty after changing a filter | A filter combination selected no rows | The KPI line shows "Rows in view"; reset the filter bar |
