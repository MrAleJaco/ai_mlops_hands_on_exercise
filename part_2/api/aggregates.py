"""Pure pandas aggregations behind every chart.

Each function takes the (already filtered) analysis frame - the readable
48,790 x 14 table built by ``census_pipeline.load_analysis_frame`` - and
returns JSON-ready dictionaries with plain Python types.

Keeping the maths here, away from HTTP, has three advantages:

* it can be unit-tested against the numbers ``make_charts.py`` printed in
  Task 1, so the app and the report cannot disagree;
* the endpoints stay thin and the cache key is just a pair of arguments;
* the browser never receives 48,790 raw rows for a chart that only needs a
  median, which is why no database is required (see ``reports/task2.md``).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from census_pipeline import CATEGORICAL_COLS, NUMERIC_COLS, TARGET

TARGET_LABELS = {"0": "<=50K", "1": ">50K"}
PALETTE = {
    "low": "#2E6F9E",
    "high": "#C0392B",
    "numeric": "#2E6F9E",
    "categorical": "#2E8B57",
}

# The four figures of designs/Charts.jpg, used by the highlights block so the
# Overview page can point at the evidence for each claim.
FIGURE_FILES = {
    "distribution": "01_distribution.png",
    "target_numeric": "02_target_vs_numeric.png",
    "target_categorical": "03_target_vs_categorical.png",
    "relation": "04_relation_numeric.png",
}


# ---------------------------------------------------------------------------
# Box-plot statistics
# ---------------------------------------------------------------------------
def _iqr_bounds(values: pd.Series) -> tuple[float, float]:
    q1, q3 = values.quantile([0.25, 0.75])
    iqr = q3 - q1
    return float(q1 - 1.5 * iqr), float(q3 + 1.5 * iqr)


def box_stats(values: pd.Series, max_points: int = 400) -> dict:
    """Five-number summary + outlier count, using the 1.5 x IQR rule.

    ``make_charts.outlier_count`` draws the same fence, so the count shown by
    the app is the count quoted in the Task 1 report. Outlier *points* are
    capped (hours-per-week alone has 13,486) but the count is exact.
    """
    clean = values.dropna()
    n = int(len(clean))
    if n == 0:
        return {"n": 0}

    q1, median, q3 = (float(v) for v in clean.quantile([0.25, 0.5, 0.75]))
    lower, upper = _iqr_bounds(clean)
    inliers = clean[(clean >= lower) & (clean <= upper)]
    outside = clean[(clean < lower) | (clean > upper)]
    sample = outside.sample(min(len(outside), max_points), random_state=0) if len(outside) else outside

    return {
        "n": n,
        "min": float(clean.min()),
        "whisker_low": float(inliers.min()) if len(inliers) else q1,
        "q1": q1,
        "median": median,
        "q3": q3,
        "whisker_high": float(inliers.max()) if len(inliers) else q3,
        "max": float(clean.max()),
        "mean": float(clean.mean()),
        "outliers": {
            "count": int(len(outside)),
            "share": 100.0 * len(outside) / n,
            "points": [float(v) for v in sample],
        },
    }


# ---------------------------------------------------------------------------
# Figure 1 - distribution of every column
# ---------------------------------------------------------------------------
def distribution(df: pd.DataFrame) -> dict:
    """Box stats per numeric column and category counts per categorical one."""
    numeric = []
    for col in NUMERIC_COLS:
        numeric.append({"column": col, **box_stats(df[col])})

    categorical = []
    rows = max(len(df), 1)
    for col in CATEGORICAL_COLS:
        counts = df[col].value_counts()
        levels = [
            {"label": str(label), "count": int(count), "share": 100.0 * count / rows}
            for label, count in counts.items()
        ]
        biggest, smallest = (levels[0], levels[-1]) if levels else (None, None)
        categorical.append(
            {
                "column": col,
                "levels": levels,
                "level_count": len(levels),
                "rarest": smallest,
                "commonest": biggest,
                # Native country (43,782 vs 1) would be a flat line on a
                # linear axis, exactly as noted in make_charts.py.
                "log_axis": bool(
                    levels and levels[0]["count"] / max(levels[-1]["count"], 1) >= 100
                ),
            }
        )

    return {"rows": len(df), "numeric": numeric, "categorical": categorical}


# ---------------------------------------------------------------------------
# Figure 2 - numeric columns against the target
# ---------------------------------------------------------------------------
def target_numeric(df: pd.DataFrame, column: str, bins: int = 30) -> dict:
    """Box stats and a density curve per income class for one numeric column."""
    if column not in NUMERIC_COLS:
        raise KeyError(column)

    classes = []
    for value, label in ((0, "<=50K"), (1, ">50K")):
        subset = df.loc[df[TARGET] == value, column].dropna()
        if subset.empty:
            continue

        density, edges = np.histogram(subset, bins=bins, density=True)
        classes.append(
            {
                "value": value,
                "label": label,
                "stats": box_stats(subset, max_points=250),
                "density": [
                    {"x": float((edges[i] + edges[i + 1]) / 2), "y": float(density[i])}
                    for i in range(len(density))
                ],
            }
        )

    medians = {c["value"]: c["stats"].get("median") for c in classes}
    shift = None
    if medians.get(0) not in (None, 0) and medians.get(1) is not None:
        shift = 100.0 * (medians[1] - medians[0]) / medians[0]

    return {
        "column": column,
        "classes": classes,
        "median_shift": shift,
        "overall": box_stats(df[column], max_points=0),
    }


# ---------------------------------------------------------------------------
# Figure 3 - categorical columns against the target
# ---------------------------------------------------------------------------
def _wilson(share: float, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson interval for a proportion, valid for small n."""
    if n == 0:
        return 0.0, 0.0
    denominator = 1.0 + z * z / n
    centre = (share + z * z / (2 * n)) / denominator
    half = z * np.sqrt(share * (1 - share) / n + z * z / (4 * n * n)) / denominator
    return float(100 * max(centre - half, 0.0)), float(100 * min(centre + half, 1.0))


def target_categorical(df: pd.DataFrame, column: str, min_n: int = 1) -> dict:
    """P(income >50K) per category, with n and a 95% interval.

    The interval is the honest answer to the thin categories: in Task 1
    ``native-country = France`` showed 42.1% on 38 rows, which looks like a
    finding until you see the error bar.
    """
    if column not in CATEGORICAL_COLS:
        raise KeyError(column)

    grouped = (
        df.groupby(column, observed=True)[TARGET]
        .agg(share="mean", n="size")
        .sort_values("share", ascending=True)
    )
    overall = float(df[TARGET].mean()) if len(df) else 0.0

    levels = []
    hidden = 0
    for label, row in grouped.iterrows():
        n = int(row["n"])
        share = float(row["share"])
        if n < min_n:
            hidden += 1
            continue
        low, high = _wilson(share, n)
        levels.append(
            {
                "label": str(label),
                "share": 100.0 * share,
                "n": n,
                "ci_low": low,
                "ci_high": high,
            }
        )

    return {
        "column": column,
        "overall_share": 100.0 * overall,
        "levels": levels,
        "hidden_below_min_n": hidden,
        "rows": len(df),
    }


# ---------------------------------------------------------------------------
# Figure 4 - relations between numeric columns
# ---------------------------------------------------------------------------
def _points(frame: pd.DataFrame, x: str, y: str, limit: int) -> list[list[float]]:
    if limit and len(frame) > limit:
        frame = frame.sample(limit, random_state=0)
    return frame[[x, y]].round(3).to_numpy().tolist()


def relation(df: pd.DataFrame, x: str, y: str, full: bool = False, cap: int = 8000) -> dict:
    """Scatter points for one pair, coloured by income class.

    ``cap`` is split evenly between the classes so the rarer >50K class is not
    swamped; ``full=True`` sends every row (used by the "all points" toggle).
    """
    for column in (x, y):
        if column not in NUMERIC_COLS:
            raise KeyError(column)

    limit = 0 if full else max(cap // 2, 1)
    classes = []
    for value, label in ((0, "<=50K"), (1, ">50K")):
        subset = df[df[TARGET] == value]
        classes.append(
            {
                "value": value,
                "label": label,
                "n": int(len(subset)),
                "points": _points(subset, x, y, limit),
            }
        )

    return {
        "x": x,
        "y": y,
        "classes": classes,
        "sampled": not full,
        "total_rows": len(df),
    }


def relation_matrix(df: pd.DataFrame, cap: int = 700) -> dict:
    """The lower triangle of the 6x6 scatter matrix in one payload.

    21 panels of 48,790 points would be ~1M points in the browser, so every
    off-diagonal panel is stratified-sampled and the diagonal shows the
    per-class density instead.
    """
    columns = list(NUMERIC_COLS)
    panels = []

    for row_index, row_name in enumerate(columns):
        for col_index, col_name in enumerate(columns):
            if col_index > row_index:
                continue  # upper triangle is empty, as in the PNG

            if row_index == col_index:
                classes = []
                for value, label in ((0, "<=50K"), (1, ">50K")):
                    subset = df.loc[df[TARGET] == value, col_name].dropna()
                    density, edges = np.histogram(subset, bins=30, density=True)
                    classes.append(
                        {
                            "value": value,
                            "label": label,
                            "density": [
                                {
                                    "x": float((edges[i] + edges[i + 1]) / 2),
                                    "y": float(density[i]),
                                }
                                for i in range(len(density))
                            ],
                        }
                    )
                panels.append(
                    {
                        "row": row_index,
                        "col": col_index,
                        "kind": "density",
                        "classes": classes,
                    }
                )
            else:
                classes = []
                for value, label in ((0, "<=50K"), (1, ">50K")):
                    subset = df[df[TARGET] == value]
                    classes.append(
                        {
                            "value": value,
                            "label": label,
                            "points": _points(subset, col_name, row_name, max(cap // 2, 1)),
                        }
                    )
                panels.append(
                    {
                        "row": row_index,
                        "col": col_index,
                        "kind": "scatter",
                        "classes": classes,
                    }
                )

    return {
        "columns": columns,
        "panels": panels,
        "sampled": True,
        "cap_per_class": max(cap // 2, 1),
        "total_rows": len(df),
    }


# ---------------------------------------------------------------------------
# Metadata and the four claims of Task 1
# ---------------------------------------------------------------------------
def meta(
    df: pd.DataFrame,
    *,
    total_rows: int,
    raw_rows: int,
    raw_columns: int,
    encoded_shape: list[int] | None,
    duplicates: int,
    unknown_rows: int,
    filters: dict,
) -> dict:
    positive_share = 100.0 * df[TARGET].mean() if len(df) else 0.0
    return {
        "rows": len(df),
        "total_rows": total_rows,
        "raw_rows": raw_rows,
        "raw_columns": raw_columns,
        "duplicates_dropped": duplicates,
        "encoded_shape": encoded_shape,
        "unknown_rows": unknown_rows,
        "unknown_share": 100.0 * unknown_rows / max(total_rows, 1),
        "target": {
            "name": TARGET,
            "labels": TARGET_LABELS,
            "positive_share": positive_share,
            "positive_rows": int(df[TARGET].sum()),
        },
        "numeric_columns": list(NUMERIC_COLS),
        "categorical_columns": list(CATEGORICAL_COLS),
        "dropped_columns": ["education"],
        "level_counts": {col: int(df[col].nunique()) for col in CATEGORICAL_COLS},
        "palette": PALETTE,
        "filters_applied": filters,
        "rows_after_filter": len(df),
        "issues": [
            {
                "title": "Padded headers and cells",
                "detail": f"All {raw_columns} raw columns except age start with a space; "
                "names and values are stripped on load.",
            },
            {
                "title": "Missing values stored as ' ?'",
                "detail": f"{unknown_rows:,} rows ({100.0 * unknown_rows / max(total_rows, 1):.1f}%) "
                "carry a ' ?' marker, normalised to NaN and filled with 'Unknown'.",
            },
            {
                "title": "Four spellings of the label",
                "detail": "'<=50K', '<=50K.', '>50K', '>50K.' (train and test pasted together) "
                "are mapped to 0/1; unknown labels raise.",
            },
            {
                "title": "Exact duplicate rows",
                "detail": f"{duplicates:,} duplicates appear once the label spelling is fixed; "
                "they are dropped before encoding.",
            },
            {
                "title": "education duplicates education-num",
                "detail": "1-to-1 in every raw row, so the text column is dropped and the "
                "numeric code is kept.",
            },
        ],
    }


def highlights(df: pd.DataFrame) -> dict:
    """The four claims of Task 1, recomputed on the current selection."""
    dist = distribution(df)

    zero_gain = 100.0 * (df["capital-gain"] == 0).mean()
    zero_loss = 100.0 * (df["capital-loss"] == 0).mean()
    rarest = min(
        (c["rarest"] for c in dist["categorical"] if c["rarest"]),
        key=lambda level: level["count"],
        default=None,
    )
    distribution_claim = (
        f"{zero_gain:.1f}% of capital-gain and {zero_loss:.1f}% of capital-loss rows are zero, "
        f"so both columns are mostly one spike"
        + (
            f"; the rarest level is {rarest['label']} with {rarest['count']:,} row(s)."
            if rarest
            else "."
        )
    )

    shifts = {}
    for column in NUMERIC_COLS:
        result = target_numeric(df, column, bins=1)
        if result["median_shift"] is not None:
            shifts[column] = result["median_shift"]
    biggest = max(shifts, key=shifts.get) if shifts else "n/a"
    numeric_claim = (
        f"{biggest} shows the largest relative median shift ({shifts.get(biggest, 0):+.0f}%) "
        f"between the classes; fnlwgt moves only {shifts.get('fnlwgt', 0):+.1f}%, so the "
        "sampling weight is not a behavioural signal."
    )

    marital = target_categorical(df, "marital-status", min_n=1)["levels"]
    top = max(marital, key=lambda level: level["share"]) if marital else None
    bottom = min(marital, key=lambda level: level["share"]) if marital else None
    categorical_claim = (
        f"marital-status separates the classes most: {top['label']} reaches "
        f"{top['share']:.1f}% high earners (n={top['n']:,}) against {bottom['share']:.1f}% "
        f"for {bottom['label']}."
        if top and bottom
        else "Not enough rows in the current selection."
    )

    at_cap = 100.0 * (df["capital-gain"] == df["capital-gain"].max()).mean()
    relation_claim = (
        f"age and education-num are the only columns whose clouds separate the classes "
        f"cleanly; capital-gain sits on a hard cap at {df['capital-gain'].max():,.0f} "
        f"({at_cap:.2f}% of rows), which is how the variable was recorded, not behaviour."
    )

    return {
        "rows": len(df),
        "claims": [
            {"figure": FIGURE_FILES["distribution"], "title": "Distribution", "claim": distribution_claim},
            {"figure": FIGURE_FILES["target_numeric"], "title": "Target vs numeric", "claim": numeric_claim},
            {"figure": FIGURE_FILES["target_categorical"], "title": "Target vs categorical", "claim": categorical_claim},
            {"figure": FIGURE_FILES["relation"], "title": "Relations", "claim": relation_claim},
        ],
    }
