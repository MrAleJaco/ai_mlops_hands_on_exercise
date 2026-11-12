"""Tests for the Census Income preprocessing pipeline.

They encode the promises the pipeline makes, so a future edit that breaks one
of them fails loudly instead of silently producing a wrong CSV:

- every missing flavour ends up as the literal "Unknown" category;
- no NaN, "?", or stray whitespace survives;
- the output is ONE DataFrame, and transforming one row keeps the same columns;
- the target is binary.
"""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from census_pipeline import (
    TARGET,
    build_final_frame,
    build_preprocessor,
    clean_text,
    load_raw,
    normalise_target,
    prepare,
    validate_final_frame,
)

# ---------------------------------------------------------------------------
# Fixture: a tiny hand-made version of the raw file
# Why: unit tests must be fast and readable, so each row isolates one problem
#      (a "?", a blank cell, an "N/A", an "Unknown", a duplicate, a dot label).
# ---------------------------------------------------------------------------


def make_raw(include_duplicate: bool = False) -> pd.DataFrame:
    """Return a 6-row (or 7-row) raw frame with every kind of dirty value."""
    columns = [
        "age",
        "workclass",
        "fnlwgt",
        "education",
        "education-num",
        "marital-status",
        "occupation",
        "relationship",
        "race",
        "sex",
        "capital-gain",
        "capital-loss",
        "hours-per-week",
        "native-country",
        "income",
    ]
    rows = [
        # workclass "Private" (clean), label without dot
        (39, "Private", 77516, "Bachelors", 13, "Never-married", "Adm-clerical",
         "Not-in-family", "White", "Male", 2174, 0, 40, "United-States", "<=50K"),
        # workclass " ?" (space + question mark), label with dot
        (50, " ?", 83311, "Bachelors", 13, "Married-civ-spouse", "Exec-managerial",
         "Husband", "White", "Male", 0, 0, 13, "United-States", "<=50K."),
        # whitespace-only workclass, "?" occupation AND country
        (38, "  ", 215646, "HS-grad", 9, "Divorced", " ?",
         "Not-in-family", "White", "Female", 0, 0, 40, " ?", ">50K"),
        # "N/A" workclass
        (27, "N/A", 234721, "11th", 7, "Never-married", "Handlers-cleaners",
         "Own-child", "Black", "Male", 0, 0, 40, "United-States", ">50K."),
        # literal "Unknown" occupation
        (43, "State-gov", 215646, "HS-grad", 9, "Divorced", "Unknown",
         "Not-in-family", "White", "Female", 0, 0, 40, "Mexico", "<=50K"),
        # fully clean row
        (58, "Self-emp-not-inc", 215646, "HS-grad", 9, "Divorced", "Tech-support",
         "Not-in-family", "White", "Male", 0, 0, 40, "United-States", "<=50K"),
    ]
    if include_duplicate:
        # Same person, label spelled with the dot -> only visible after
        # normalisation, which is why dedupe happens after the label step.
        rows.append(
            (39, "Private", 77516, "Bachelors", 13, "Never-married", "Adm-clerical",
             "Not-in-family", "White", "Male", 2174, 0, 40, "United-States", "<=50K.")
        )
    return pd.DataFrame(rows, columns=columns)


def fit_small() -> tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    """Fit the preprocessor on the synthetic frame and return X, y, encoded."""
    features, target = prepare(make_raw())
    encoded = build_preprocessor().fit_transform(features)
    return features, target, encoded


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


def test_load_raw_strips_column_names(tmp_path: Path) -> None:
    """The real CSV writes a space after every comma; headers must be stripped."""
    # Write the file by hand because pandas only accepts a 1-character delimiter,
    # and we need to reproduce the ", " separator of the real Kaggle file.
    raw_frame = make_raw()
    lines = [", ".join(raw_frame.columns)]
    lines += [", ".join(str(value) for value in row) for row in raw_frame.itertuples(index=False)]
    path = tmp_path / "raw.csv"
    path.write_text("\n".join(lines), encoding="utf-8")

    raw = load_raw(path)

    assert "workclass" in raw.columns
    assert " workclass" not in raw.columns
    assert "income" in raw.columns


def test_load_raw_rejects_incomplete_file(tmp_path: Path) -> None:
    """A malformed file fails with a clear message, not a KeyError later."""
    path = tmp_path / "raw.csv"
    pd.DataFrame({"age": [1], "income": ["<=50K"]}).to_csv(path, index=False)

    with pytest.raises(ValueError, match="missing expected columns"):
        load_raw(path)


# ---------------------------------------------------------------------------
# Cleaning
# ---------------------------------------------------------------------------


def test_clean_text_strips_and_collapses_whitespace() -> None:
    """Tabs, non-breaking spaces and padding all become one clean string."""
    dirty = pd.DataFrame({"raw": ["  Private ", "Self-emp\tnot-inc", "A\u00a0B"]})

    cleaned = clean_text(dirty)

    assert cleaned["raw"].tolist() == ["Private", "Self-emp not-inc", "A B"]


# ---------------------------------------------------------------------------
# Target
# ---------------------------------------------------------------------------


def test_normalise_target_accepts_all_four_spellings() -> None:
    """'<=50K', '<=50K.', '>50K', '>50K.' all map to 0 / 1."""
    labels = pd.Series(["<=50K", "<=50K.", " >50K", ">50K."], dtype="string")

    assert normalise_target(labels).tolist() == [0, 0, 1, 1]


def test_normalise_target_rejects_unknown_label() -> None:
    """An unexpected label raises instead of becoming a silent NaN."""
    with pytest.raises(ValueError, match="Unexpected income values"):
        normalise_target(pd.Series(["maybe"], dtype="string"))


def test_target_is_binary_and_duplicates_are_dropped() -> None:
    """7 raw rows, one duplicate -> 6 rows, two classes."""
    _, target = prepare(make_raw(include_duplicate=True))

    assert len(target) == 6
    assert set(target.unique()) == {0, 1}


# ---------------------------------------------------------------------------
# The core promise: missing values become "Unknown"
# ---------------------------------------------------------------------------


def test_every_missing_flavour_becomes_unknown() -> None:
    """' ?', '   ', 'N/A' and 'Unknown' collapse into a single category."""
    _, _, encoded = fit_small()

    assert encoded["workclass_Unknown"].sum() == 3  # " ?", "   ", "N/A"
    assert encoded["occupation_Unknown"].sum() == 2  # " ?", "Unknown"
    assert encoded["native-country_Unknown"].sum() == 1  # " ?"


def test_no_missing_values_in_output() -> None:
    """The unified table is complete: the median / Unknown fills did their job."""
    _, _, encoded = fit_small()

    assert not encoded.isna().any().any()


def test_output_has_no_question_marks_or_padding() -> None:
    """No cell is left as '?', ' ?' or padded with spaces."""
    features, _, _ = fit_small()

    for column in features.columns:
        values = features[column].dropna().astype(str)
        assert not values.str.contains(r"\?", regex=True).any(), column
        assert values.eq(values.str.strip()).all(), column


# ---------------------------------------------------------------------------
# Shape and reuse
# ---------------------------------------------------------------------------


def test_output_is_one_dataframe_with_target_last() -> None:
    """The numeric and one-hot branches are unified into a single frame."""
    features, target, _ = fit_small()
    final = build_final_frame(features, target, build_preprocessor())

    assert isinstance(final, pd.DataFrame)
    assert final.columns[-1] == TARGET
    assert len(final) == len(target)


def test_transforming_one_row_keeps_the_schema() -> None:
    """Task 2 will score single rows: unseen categories must not crash or shift columns."""
    preprocessor = build_preprocessor()
    features, _, encoded = fit_small()
    preprocessor.fit(features)

    single = make_raw().iloc[[0]].copy()
    single["workclass"] = "Martian"  # never seen during fit
    transformed = preprocessor.transform(single)

    assert list(transformed.columns) == list(encoded.columns)
    assert transformed.shape[0] == 1


# ---------------------------------------------------------------------------
# Guard rails
# ---------------------------------------------------------------------------


def test_validate_rejects_missing_values() -> None:
    """A frame with NaN can never be written by the build script."""
    dirty = pd.DataFrame({TARGET: [0, 1], "age": [39.0, np.nan]})

    with pytest.raises(ValueError, match="Missing values remain"):
        validate_final_frame(dirty)


def test_validate_rejects_non_binary_target() -> None:
    """The target must stay 0 / 1."""
    dirty = pd.DataFrame({TARGET: [0, 2]})

    with pytest.raises(ValueError, match="only 0 and 1"):
        validate_final_frame(dirty)


# ---------------------------------------------------------------------------
# End-to-end on the real file
# ---------------------------------------------------------------------------

RAW_FILE = Path(__file__).resolve().parents[1] / "data" / "raw_data" / "census_income.csv"


@pytest.mark.skipif(not RAW_FILE.exists(), reason="raw dataset not available")
def test_real_dataset_end_to_end() -> None:
    """The shipped CSV produces the expected, complete, unified table."""
    features, target = prepare(load_raw(RAW_FILE))
    final = build_final_frame(features, target, build_preprocessor())
    validate_final_frame(final)

    assert len(final) == 48_790  # 48,842 raw rows - 52 duplicates
    assert final.shape[1] == 93  # 6 numeric + 86 one-hot + target
    assert set(final[TARGET].unique()) == {0, 1}
    assert int(final.isna().sum().sum()) == 0
