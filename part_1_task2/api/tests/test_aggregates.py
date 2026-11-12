"""The aggregates must reproduce the numbers quoted in reports/task1.md.

Each test names the Task 1 claim it protects, so a change in the API that
silently changes a chart is caught here instead of in the presentation.
"""

from __future__ import annotations

import math

import aggregates
from filters import Filters


def test_frame_shape_and_duplicates(frame):
    assert frame.shape == (48790, 14)
    assert 48842 - len(frame) == 52


def test_meta_reports_the_pipeline_audit(frame):
    result = aggregates.meta(
        frame,
        total_rows=len(frame),
        raw_rows=48842,
        raw_columns=15,
        encoded_shape=[48790, 93],
        duplicates=52,
        unknown_rows=3615,
        filters=Filters().as_dict(),
    )
    assert result["rows"] == 48790
    assert result["target"]["labels"] == {"0": "<=50K", "1": ">50K"}
    assert math.isclose(result["target"]["positive_share"], 23.94, abs_tol=0.01)
    assert result["issues"][1]["detail"].startswith("3,615 rows (7.4%)")


def test_box_stats_match_the_1_5_iqr_rule(frame):
    stats = aggregates.box_stats(frame["hours-per-week"])
    assert stats["outliers"]["count"] == 13486
    assert math.isclose(stats["outliers"]["share"], 27.64, abs_tol=0.01)
    assert stats["max"] == 99
    # Outlier points are capped even though the count is exact.
    assert len(stats["outliers"]["points"]) == 400


def test_distribution_covers_every_column(frame):
    result = aggregates.distribution(frame)
    assert [row["column"] for row in result["numeric"]] == list(aggregates.NUMERIC_COLS)
    assert [row["column"] for row in result["categorical"]] == list(aggregates.CATEGORICAL_COLS)

    native = next(row for row in result["categorical"] if row["column"] == "native-country")
    assert native["level_count"] == 42
    assert native["rarest"]["label"] == "Holand-Netherlands"
    assert native["rarest"]["count"] == 1
    assert native["log_axis"] is True

    sex = next(row for row in result["categorical"] if row["column"] == "sex")
    assert sex["log_axis"] is False


def test_target_numeric_median_shift(frame):
    education = aggregates.target_numeric(frame, "education-num")
    medians = {c["value"]: c["stats"]["median"] for c in education["classes"]}
    assert medians == {0: 9, 1: 12}
    assert math.isclose(education["median_shift"], 33.333, abs_tol=0.01)

    fnlwgt = aggregates.target_numeric(frame, "fnlwgt")
    assert abs(fnlwgt["median_shift"]) < 3  # the noise column moves little


def test_target_categorical_marital_status(frame):
    result = aggregates.target_categorical(frame, "marital-status")
    levels = {level["label"]: level for level in result["levels"]}
    married = levels["Married-civ-spouse"]
    assert married["n"] == 22366
    assert math.isclose(married["share"], 44.61, abs_tol=0.05)
    assert 0 <= married["ci_low"] < married["share"] < married["ci_high"] <= 100
    # A big category must have a narrower interval than a tiny one.
    assert (married["ci_high"] - married["ci_low"]) < 2


def test_min_n_hides_unreliable_categories(frame):
    everything = aggregates.target_categorical(frame, "native-country")
    filtered = aggregates.target_categorical(frame, "native-country", min_n=100)
    assert len(filtered["levels"]) < len(everything["levels"])
    assert filtered["hidden_below_min_n"] == len(everything["levels"]) - len(filtered["levels"])
    assert all(level["n"] >= 100 for level in filtered["levels"])


def test_relation_is_sampled_and_can_be_full(frame):
    sampled = aggregates.relation(frame, "age", "education-num", cap=2000)
    assert sampled["sampled"] is True
    assert all(len(c["points"]) <= 1000 for c in sampled["classes"])

    full = aggregates.relation(frame, "age", "education-num", full=True)
    assert full["sampled"] is False
    assert sum(len(c["points"]) for c in full["classes"]) == len(frame)


def test_relation_matrix_is_a_lower_triangle(frame):
    result = aggregates.relation_matrix(frame, cap=200)
    assert result["columns"] == list(aggregates.NUMERIC_COLS)
    assert len(result["panels"]) == len(aggregates.NUMERIC_COLS) * (len(aggregates.NUMERIC_COLS) + 1) // 2
    assert all(panel["col"] <= panel["row"] for panel in result["panels"])
    diagonal = [p for p in result["panels"] if p["kind"] == "density"]
    assert len(diagonal) == len(aggregates.NUMERIC_COLS)


def test_filters_are_composable(frame):
    men = Filters(sex=("Male",)).apply(frame)
    wealthy_men = Filters(sex=("Male",), income=1).apply(frame)
    assert 0 < len(wealthy_men) < len(men) < len(frame)
    assert (wealthy_men["income"] == 1).all()
    assert (wealthy_men["sex"] == "Male").all()

    older = Filters(age_min=40, age_max=50).apply(frame)
    assert older["age"].between(40, 50).all()

    assert Filters(income=1).cache_key() == Filters(income=1).cache_key()
    assert Filters(income=1).cache_key() != Filters(income=0).cache_key()


def test_highlights_produce_four_claims(frame):
    result = aggregates.highlights(frame)
    assert len(result["claims"]) == 4
    assert all(claim["claim"] for claim in result["claims"])
    assert "marital-status" in result["claims"][2]["claim"]
    assert "education-num" in result["claims"][1]["claim"]
