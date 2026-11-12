"""HTTP layer of the Census Income explorer.

One FastAPI process serves the aggregates the React app draws. It owns two
frames:

* the *analysis* frame, built by ``census_pipeline.load_analysis_frame`` from
  the raw CSV - this is what every chart reads;
* the *encoded* frame, the 93-column table written by
  ``build_dataset.py`` - this is only previewed on the "Processed data" page.

Both are read once at startup and kept in memory: the file is 5.7 MB and the
aggregates take ~13 ms, so a database would add a hop without removing a
bottleneck (see reports/task2.md).

Run locally:

    uv run uvicorn app:app --app-dir part_2/api --reload --port 8000
"""

from __future__ import annotations

import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

API_DIR = Path(__file__).resolve().parent
REPO_ROOT = API_DIR.parents[1]
SRC_DIR = REPO_ROOT / "part_1" / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import aggregates  # noqa: E402  (needs SRC_DIR on sys.path)
from census_pipeline import (  # noqa: E402
    CATEGORICAL_COLS,
    NUMERIC_COLS,
    TARGET,
    UNKNOWN,
    load_analysis_frame,
    load_raw,
)
from filters import Filters, split_csv  # noqa: E402


# ---------------------------------------------------------------------------
# Where the data lives
# ---------------------------------------------------------------------------
def resolve_raw_path() -> Path:
    """First readable candidate wins, so the same image works in Docker and
    from a fresh clone: env var, the part_1 copy, then the datasets folder."""
    candidates = [
        os.getenv("CENSUS_RAW_PATH"),
        REPO_ROOT / "part_1" / "data" / "raw_data" / "census_income.csv",
        REPO_ROOT / "datasets" / "census_income.csv",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    raise FileNotFoundError(
        "No raw CSV found. Set CENSUS_RAW_PATH or copy datasets/census_income.csv "
        "to part_1/data/raw_data/census_income.csv"
    )


def resolve_encoded_path() -> Path:
    return Path(
        os.getenv("CENSUS_ENCODED_PATH")
        or REPO_ROOT / "part_1" / "data" / "processed" / "census_income_final.csv"
    )


# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------
class State:
    """Frames, file facts and a small cache, built once at startup."""

    def __init__(self) -> None:
        self.analysis: pd.DataFrame | None = None
        self.raw_rows = 0
        self.raw_columns = 0
        self.raw_path: Path | None = None
        self.encoded: pd.DataFrame | None = None
        self.load_seconds = 0.0
        self._selections: dict[tuple, pd.DataFrame] = {}
        self._results: dict[tuple, dict] = {}

    def load(self) -> None:
        started = time.perf_counter()
        self.raw_path = resolve_raw_path()
        self.analysis = load_analysis_frame(self.raw_path)
        raw = load_raw(self.raw_path)
        self.raw_rows, self.raw_columns = raw.shape
        self.load_seconds = time.perf_counter() - started

    def filtered(self, filters: Filters) -> pd.DataFrame:
        key = filters.cache_key()
        if key not in self._selections:
            if len(self._selections) > 64:  # a demo, not a multitenant service
                self._selections.clear()
            self._selections[key] = filters.apply(self.analysis)
        return self._selections[key]

    def encoded_frame(self) -> pd.DataFrame | None:
        """Load the encoded table on first use; tolerate it being absent."""
        if self.encoded is None:
            path = resolve_encoded_path()
            if path.is_file():
                self.encoded = pd.read_csv(path)
        return self.encoded

    def cached(self, key: tuple, build) -> dict:
        if key not in self._results:
            if len(self._results) > 128:
                self._results.clear()
            self._results[key] = build()
        return self._results[key]


state = State()


@asynccontextmanager
async def lifespan(app: FastAPI):
    state.load()
    state.encoded_frame()  # warm the 93-column table too
    yield


app = FastAPI(
    title="Census Income Explorer API",
    version="1.0.0",
    description="Aggregates for the four Task 1 figures, computed on demand.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Shared dependencies
# ---------------------------------------------------------------------------
def filters_dependency(
    income: int | None = Query(None, ge=0, le=1, description="0 = <=50K, 1 = >50K"),
    sex: str | None = Query(None, description="comma separated"),
    workclass: str | None = Query(None, description="comma separated"),
    native_country: str | None = Query(None, alias="native-country", description="comma separated"),
    age_min: float | None = Query(None, ge=0, le=120),
    age_max: float | None = Query(None, ge=0, le=120),
    hours_min: float | None = Query(None, ge=0, le=168),
    hours_max: float | None = Query(None, ge=0, le=168),
) -> Filters:
    """One filter object for every endpoint, documented in /docs."""
    return Filters(
        income=income,
        sex=split_csv(sex),
        workclass=split_csv(workclass),
        native_country=split_csv(native_country),
        age_min=age_min,
        age_max=age_max,
        hours_min=hours_min,
        hours_max=hours_max,
    )


def _require_numeric(column: str) -> None:
    if column not in NUMERIC_COLS:
        raise HTTPException(
            status_code=400, detail=f"Unknown numeric column {column!r}. Use one of {NUMERIC_COLS}"
        )


def _require_categorical(column: str) -> None:
    if column not in CATEGORICAL_COLS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown categorical column {column!r}. Use one of {CATEGORICAL_COLS}",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/healthz", tags=["ops"])
def healthz() -> dict:
    return {
        "status": "ok",
        "rows": len(state.analysis) if state.analysis is not None else 0,
        "load_seconds": round(state.load_seconds, 3),
    }


@app.get("/api/filters", tags=["meta"])
def api_filters() -> dict:
    """Valid choices for the filter bar, computed on the full frame."""
    frame = state.analysis
    return {
        "sex": sorted(frame["sex"].unique().tolist()),
        "workclass": sorted(frame["workclass"].unique().tolist()),
        "native-country": [
            {"label": str(label), "count": int(count)}
            for label, count in frame["native-country"].value_counts().items()
        ],
        "age": {"min": int(frame["age"].min()), "max": int(frame["age"].max())},
        "hours": {"min": int(frame["hours-per-week"].min()), "max": int(frame["hours-per-week"].max())},
        "income": [
            {"value": 0, "label": "<=50K"},
            {"value": 1, "label": ">50K"},
        ],
    }


@app.get("/api/meta", tags=["meta"])
def api_meta(filters: Filters = Depends(filters_dependency)) -> dict:
    df = state.filtered(filters)
    unknown_rows = int((state.analysis[CATEGORICAL_COLS] == UNKNOWN).any(axis=1).sum())
    encoded = state.encoded_frame()
    return aggregates.meta(
        df,
        total_rows=len(state.analysis),
        raw_rows=state.raw_rows,
        raw_columns=state.raw_columns,
        encoded_shape=list(encoded.shape) if encoded is not None else None,
        duplicates=state.raw_rows - len(state.analysis),
        unknown_rows=unknown_rows,
        filters=filters.as_dict(),
    )


@app.get("/api/highlights", tags=["meta"])
def api_highlights(filters: Filters = Depends(filters_dependency)) -> dict:
    return state.cached(("highlights", filters.cache_key()), lambda: aggregates.highlights(state.filtered(filters)))


@app.get("/api/distribution", tags=["charts"])
def api_distribution(filters: Filters = Depends(filters_dependency)) -> dict:
    return state.cached(
        ("distribution", filters.cache_key()),
        lambda: aggregates.distribution(state.filtered(filters)),
    )


@app.get("/api/target-numeric", tags=["charts"])
def api_target_numeric(
    column: str = Query(..., description="one of numeric_columns"),
    filters: Filters = Depends(filters_dependency),
) -> dict:
    _require_numeric(column)
    return state.cached(
        ("target-numeric", column, filters.cache_key()),
        lambda: aggregates.target_numeric(state.filtered(filters), column),
    )


@app.get("/api/target-categorical", tags=["charts"])
def api_target_categorical(
    column: str = Query(..., description="one of categorical_columns"),
    min_n: int = Query(1, ge=1, le=50000, description="hide categories with fewer rows"),
    filters: Filters = Depends(filters_dependency),
) -> dict:
    _require_categorical(column)
    return state.cached(
        ("target-categorical", column, min_n, filters.cache_key()),
        lambda: aggregates.target_categorical(state.filtered(filters), column, min_n),
    )


@app.get("/api/relation", tags=["charts"])
def api_relation(
    x: str = Query(...),
    y: str = Query(...),
    full: bool = Query(False, description="send every row instead of a sample"),
    filters: Filters = Depends(filters_dependency),
) -> dict:
    _require_numeric(x)
    _require_numeric(y)
    return state.cached(
        ("relation", x, y, full, filters.cache_key()),
        lambda: aggregates.relation(state.filtered(filters), x, y, full=full),
    )


@app.get("/api/relation-matrix", tags=["charts"])
def api_relation_matrix(
    cap: int = Query(700, ge=100, le=4000, description="sampled points per panel"),
    filters: Filters = Depends(filters_dependency),
) -> dict:
    return state.cached(
        ("relation-matrix", cap, filters.cache_key()),
        lambda: aggregates.relation_matrix(state.filtered(filters), cap=cap),
    )


@app.get("/api/table", tags=["data"])
def api_table(
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=5, le=200),
    search: str = Query("", description="keep columns whose name contains this text"),
) -> dict:
    """Paginated preview of the encoded table produced by build_dataset.py."""
    encoded = state.encoded_frame()
    if encoded is None:
        raise HTTPException(
            status_code=503,
            detail="Encoded table not built yet. Run part_1/src/build_dataset.py.",
        )

    columns = [str(name) for name in encoded.columns]
    if search:
        columns = [name for name in columns if search.lower() in name.lower()]
    if not columns:
        return {"columns": [], "rows": [], "total_rows": len(encoded), "page": page, "size": size, "pages": 0}

    start = (page - 1) * size
    window = encoded.loc[:, columns].iloc[start : start + size]
    return {
        "columns": columns,
        "rows": window.to_numpy().tolist(),
        "total_rows": len(encoded),
        "page": page,
        "size": size,
        "pages": max(1, -(-len(encoded) // size)),
        "showing": [str(value) for value in (encoded.columns[0], columns[-1])],
        "target_column": TARGET,
    }
