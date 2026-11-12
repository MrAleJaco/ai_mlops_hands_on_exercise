"""Build the single, unified modelling table for the Census Income dataset.

Usage (from the repository root):

    uv run python part_1_task1/src/build_dataset.py

    uv run python part_1_task1/src/build_dataset.py \
        --input  part_1_task1/data/raw_data/census_income.csv \
        --output part_1_task1/data/processed/census_income_final.csv

The script follows the design in part_1_task1/data/designs/EDA.jpg and writes ONE
CSV: no train/test split, no intermediate files.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from census_pipeline import (
    CATEGORICAL_COLS,
    NUMERIC_COLS,
    TARGET,
    UNKNOWN,
    build_final_frame,
    build_preprocessor,
    load_raw,
    prepare,
    validate_final_frame,
)

# ---------------------------------------------------------------------------
# STEP 1 - Work out the default paths from this file's location
# Why:     "python part_1_task1/src/build_dataset.py" must work from any directory,
#          so paths are relative to the repository, not to the shell.
# ---------------------------------------------------------------------------
PART_DIR = Path(__file__).resolve().parents[1]  # .../part_1_task1
DEFAULT_INPUT = PART_DIR / "data" / "raw_data" / "census_income.csv"
DEFAULT_OUTPUT = PART_DIR / "data" / "processed" / "census_income_final.csv"


def parse_args() -> argparse.Namespace:
    """Define the two knobs: where to read from and where to write to."""
    parser = argparse.ArgumentParser(
        description="Build one unified Census Income feature table."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Raw CSV.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output CSV.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # -----------------------------------------------------------------------
    # STEP 2 - Load and clean
    # Why:  cleaning already removed the header spaces, the " ?" markers and
    #       the duplicate rows, so the numbers printed below are the real ones.
    # -----------------------------------------------------------------------
    raw = load_raw(args.input)
    raw_rows, raw_cols = raw.shape

    features, target = prepare(raw)

    # Cells that were "", "?", "N/A", whitespace-only, ... become NaN here,
    # and are filled with "Unknown" by the pipeline in the next step.
    missing_counts = features[CATEGORICAL_COLS].isna().sum()

    # -----------------------------------------------------------------------
    # STEP 3 - Run the drawing: impute + one-hot + unify
    # Why:  build_final_frame fits on the whole cleaned dataset because this
    #       artefact is for analysis (Task 1), not for scoring unseen data.
    # -----------------------------------------------------------------------
    final = build_final_frame(features, target, build_preprocessor())

    # -----------------------------------------------------------------------
    # STEP 4 - Refuse to write a dirty file
    # Why:  a saved CSV is what every later task and the report will use, so
    #       it is worth failing here rather than debugging downstream.
    # -----------------------------------------------------------------------
    validate_final_frame(final)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    final.to_csv(args.output, index=False)

    # -----------------------------------------------------------------------
    # STEP 5 - Print a short audit trail for the report
    # Why:  every number below is a claim you can defend in the presentation.
    # -----------------------------------------------------------------------
    rows_kept = len(final)
    duplicates = raw_rows - rows_kept
    positives = int(final[TARGET].sum())
    negative = rows_kept - positives

    print(f"Raw file            : {args.input}")
    print(f"Raw shape           : {raw_rows:,} rows x {raw_cols} columns")
    print(f"Duplicate rows      : {duplicates:,} dropped")
    print(f"Rows kept           : {rows_kept:,}")

    print(f"\nMissing values filled with {UNKNOWN!r}:")
    for col in CATEGORICAL_COLS:
        count = int(missing_counts[col])
        share = 100 * count / rows_kept if rows_kept else 0.0
        print(f"  {col:<16} {count:>6,} ({share:5.2f}%)")

    print(f"\nNumeric features    : {len(NUMERIC_COLS)}")
    print(f"Encoded features    : {final.shape[1] - 1}")
    print(f"Final shape         : {final.shape[0]:,} rows x {final.shape[1]} columns")
    print(
        f"Target balance      : 0 (<=50K) {negative:,} "
        f"({100 * negative / rows_kept:.1f}%) | "
        f"1 (>50K) {positives:,} ({100 * positives / rows_kept:.1f}%)"
    )
    print(f"Missing cells left  : {int(final.isna().sum().sum())}")
    print(f"Written to          : {args.output}")


if __name__ == "__main__":
    main()
