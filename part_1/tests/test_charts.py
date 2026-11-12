"""Smoke tests for the EDA figures.

They do not judge the design; they guarantee that:
- the chart source is the same cleaned table the pipeline uses;
- every figure still renders to a non-empty PNG after a refactor.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import pytest
from matplotlib import pyplot as plt

from census_pipeline import CATEGORICAL_COLS, NUMERIC_COLS, TARGET, load_analysis_frame
from make_charts import (
    plot_distribution,
    plot_relation_numeric,
    plot_target_vs_categorical,
    plot_target_vs_numeric,
)

RAW_FILE = Path(__file__).resolve().parents[1] / "data" / "raw_data" / "census_income.csv"

pytestmark = pytest.mark.skipif(
    not RAW_FILE.exists(), reason="raw dataset not available"
)


@pytest.fixture(scope="module")
def analysis_frame():
    """Load the cleaned chart table once for every figure test."""
    return load_analysis_frame(RAW_FILE)


def test_analysis_frame_is_clean_and_readable(analysis_frame) -> None:
    """One row per person, real category names, no missing categoricals."""
    assert len(analysis_frame) == 48_790
    assert list(analysis_frame.columns) == [*NUMERIC_COLS, *CATEGORICAL_COLS, TARGET]
    assert set(analysis_frame[TARGET].unique()) == {0, 1}

    for column in CATEGORICAL_COLS:
        assert analysis_frame[column].notna().all(), column
        assert not analysis_frame[column].astype(str).str.contains(r"\?").any(), column

    # The gaps are visible as a category instead of disappearing.
    assert "Unknown" in set(analysis_frame["workclass"])


@pytest.mark.parametrize(
    ("plotter", "filename"),
    [
        (plot_distribution, "01_distribution.png"),
        (plot_target_vs_numeric, "02_target_vs_numeric.png"),
        (plot_target_vs_categorical, "03_target_vs_categorical.png"),
        (plot_relation_numeric, "04_relation_numeric.png"),
    ],
)
def test_figure_renders(plotter, filename, analysis_frame, tmp_path) -> None:
    """Each design node produces a real PNG file."""
    output = tmp_path / filename

    claim = plotter(analysis_frame, output, RAW_FILE.name)

    assert output.exists()
    assert output.stat().st_size > 20_000  # not a blank canvas
    assert isinstance(claim, str) and claim  # every figure carries a claim
    plt.close("all")
