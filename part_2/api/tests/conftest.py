"""Shared fixtures: make both source trees importable and load the data once."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "part_1" / "src"))
sys.path.insert(0, str(REPO_ROOT / "part_2" / "api"))

from census_pipeline import load_analysis_frame  # noqa: E402

RAW_CSV = REPO_ROOT / "part_1" / "data" / "raw_data" / "census_income.csv"
ENCODED_CSV = REPO_ROOT / "part_1" / "data" / "processed" / "census_income_final.csv"


@pytest.fixture(scope="session")
def frame():
    """The same 48,790 x 14 frame every chart is drawn from."""
    if not RAW_CSV.is_file():
        pytest.skip(f"raw dataset not present at {RAW_CSV}")
    return load_analysis_frame(RAW_CSV)
