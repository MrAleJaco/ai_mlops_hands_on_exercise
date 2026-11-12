"""Census Income preprocessing pipeline.

Input : part_1/data/raw_data/census_income.csv
        (raw Kaggle Adult file, 48,842 rows x 15 messy columns)
Output: ONE unified DataFrame made of
        - 6 numeric columns, median-imputed
        - the one-hot encoded categorical columns
        - the binary target `income` (0 = "<=50K", 1 = ">50K")

The flow is the one drawn in part_1/data/designs/EDA.jpg:

    raw CSV
      -> clean the text (headers + cells)
      -> split into numeric / categorical
           numeric     -> fill with the median
           categorical -> fill with "Unknown" -> one-hot encode
      -> unify the two branches
      -> final DataFrame
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

# ---------------------------------------------------------------------------
# STEP 1 - Declare the schema once, at the top
# Why:     every later step (impute, encode, test) reads these lists, so the
#          pipeline cannot drift from the design.
# Gotcha:  the raw file has 15 columns. `education` is dropped because it is a
#          1-to-1 duplicate of `education-num` (16 strings for 16 numbers).
# ---------------------------------------------------------------------------
TARGET = "income"
UNKNOWN = "Unknown"

NUMERIC_COLS = [
    "age",
    "fnlwgt",
    "education-num",
    "capital-gain",
    "capital-loss",
    "hours-per-week",
]

CATEGORICAL_COLS = [
    "workclass",
    "marital-status",
    "occupation",
    "relationship",
    "race",
    "sex",
    "native-country",
]

DROPPED_COLS = ["education"]

NUMERIC_COLS_RAW = [*NUMERIC_COLS, *DROPPED_COLS]  # only used to validate the file

# Anything that means "no value" in the raw file. The CSV stores missing
# values as " ?" (a space and a question mark), which pandas reads as text.
MISSING_TOKENS = {"", "?", "n/a", "na", "nan", "none", "null", "unknown", "-"}

TARGET_MAP = {"<=50k": 0, ">50k": 1}


# ---------------------------------------------------------------------------
# STEP 2 - Read the file and fix the column names
# Why:     the CSV header is "age, workclass, fnlwgt, ..." with a space after
#          every comma, so pandas creates columns literally named " workclass".
#          skipinitialspace removes those spaces while parsing.
# Gotcha:  without this, df["workclass"] raises KeyError - a confusing error
#          that looks like a missing column.
# ---------------------------------------------------------------------------
def load_raw(path: str | Path) -> pd.DataFrame:
    """Read the raw CSV and return it with clean, stripped column names."""
    df = pd.read_csv(path, skipinitialspace=True)
    df.columns = [str(col).strip() for col in df.columns]

    expected = set(NUMERIC_COLS_RAW + CATEGORICAL_COLS + [TARGET])
    missing = expected - set(df.columns)
    if missing:
        raise ValueError(f"Raw file is missing expected columns: {sorted(missing)}")
    return df


# ---------------------------------------------------------------------------
# STEP 3 - Clean every text cell, then turn all missing flavours into NaN
# Why:     " ?", "  ", "N/A", "" and empty cells must all become ONE thing
#          (NaN) before imputation, otherwise the encoder would create a
#          separate column for each spelling.
# Gotcha:  strip() must come BEFORE comparing to "?", otherwise " ?" != "?".
#          Internal whitespace is collapsed to a single space, so tabs or
#          non-breaking spaces cannot create duplicate categories.
# ---------------------------------------------------------------------------
def clean_text(df: pd.DataFrame) -> pd.DataFrame:
    """Strip/collapse whitespace in text columns and normalise missing markers."""
    out = df.copy()
    for col in out.columns:
        if pd.api.types.is_numeric_dtype(out[col]):
            continue  # numbers have nothing to clean

        text = out[col].astype("string")
        text = text.str.replace(r"\s+", " ", regex=True).str.strip()

        is_missing = (
            text.isna()
            | text.eq("").fillna(False)
            | text.str.lower().isin(MISSING_TOKENS).fillna(False)
        )

        # NaN (not pd.NA) is what scikit-learn understands as "missing".
        out[col] = pd.Series(
            text.mask(is_missing).to_numpy(dtype=object, na_value=np.nan),
            index=out.index,
        )
    return out


# ---------------------------------------------------------------------------
# STEP 4 - Turn the label into 0 / 1
# Why:     the file was built by pasting the train and test splits together,
#          so the label has four spellings: "<=50K", "<=50K.", ">50K", ">50K.".
#          The trailing dot version is the test split.
# Gotcha:  strip the trailing "." first, then map; anything unmapped (e.g. an
#          unexpected label) raises instead of silently becoming NaN.
# ---------------------------------------------------------------------------
def normalise_target(series: pd.Series) -> pd.Series:
    """Map '<=50K.' / '>50K.' (any spacing, any trailing dot) to 0 / 1."""
    cleaned = series.astype("string").str.strip().str.rstrip(".").str.lower()
    encoded = cleaned.map(TARGET_MAP)

    unexpected = cleaned[encoded.isna() & cleaned.notna()].unique()
    if len(unexpected) > 0:
        raise ValueError(f"Unexpected income values: {sorted(map(str, unexpected))}")
    if encoded.isna().any():
        raise ValueError("The target column contains missing values.")

    return encoded.astype("int8").rename(TARGET)


# ---------------------------------------------------------------------------
# STEP 5 - Build the modelling table: clean, de-duplicate, split X / y
# Why:     52 rows are exact duplicates once the label spelling is fixed; left
#          in, they would double-count the same person.
# Gotcha:  numeric columns are coerced AFTER cleaning, so a "?" that ended up
#          in a numeric column becomes NaN and is caught by the median imputer.
# ---------------------------------------------------------------------------
def prepare(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Clean the raw frame and return aligned (features, target)."""
    df = clean_text(df)
    df[TARGET] = normalise_target(df[TARGET])
    df = df.drop(columns=DROPPED_COLS)

    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.drop_duplicates(ignore_index=True)

    features = df.drop(columns=TARGET)
    target = df[TARGET]
    return features, target


# ---------------------------------------------------------------------------
# STEP 5b - The same cleaned table, but readable by a human
# Why:     charts must show "Private" and "United-States", not 86 one-hot
#          columns. This is the pipeline minus the encoding step, filled the
#          same way, so the charts and the model table cannot disagree.
# ---------------------------------------------------------------------------
def load_analysis_frame(path: str | Path) -> pd.DataFrame:
    """Return the cleaned, de-duplicated dataset with readable categories."""
    df = clean_text(load_raw(path))
    df[TARGET] = normalise_target(df[TARGET])
    df = df.drop(columns=DROPPED_COLS).drop_duplicates(ignore_index=True)

    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Same rule as the pipeline: every missing categorical value becomes the
    # literal "Unknown" category, so the charts show where the gaps are.
    for col in CATEGORICAL_COLS:
        df[col] = df[col].fillna(UNKNOWN)

    return df[[*NUMERIC_COLS, *CATEGORICAL_COLS, TARGET]]


# ---------------------------------------------------------------------------
# STEP 6 - The two branches of the drawing, as a scikit-learn transformer
# Why:     ColumnTransformer applies a different recipe per column group and
#          puts the results back together - that IS the "unify DF" step.
#          fit/transform keeps the same encoding for future data (Task 2).
# Gotcha:  handle_unknown="ignore" means an unseen category at prediction time
#          produces zeros instead of crashing. verbose_feature_names_out=False
#          keeps plain names ("age", "workclass_Private") instead of
#          "numeric__age", "categorical__workclass_Private".
# ---------------------------------------------------------------------------
def build_preprocessor() -> ColumnTransformer:
    """Return the unfitted numeric + one-hot preprocessor."""
    numeric_branch = Pipeline(
        steps=[
            # Median is robust to the very skewed money columns
            # (91.7% of capital-gain is zero, max 99,999).
            ("median_imputer", SimpleImputer(strategy="median")),
        ]
    )

    categorical_branch = Pipeline(
        steps=[
            # Every missing flavour arrives here as NaN and leaves as the
            # literal string "Unknown", a real category the encoder can use.
            (
                "unknown_imputer",
                SimpleImputer(strategy="constant", fill_value=UNKNOWN),
            ),
            # One-hot: one 0/1 column per category, so no fake ordering
            # is imposed on values like education levels.
            (
                "one_hot_encoder",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                    dtype=np.int8,
                ),
            ),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_branch, NUMERIC_COLS),
            ("categorical", categorical_branch, CATEGORICAL_COLS),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    ).set_output(transform="pandas")


# ---------------------------------------------------------------------------
# STEP 7 - Unify the branches into one final DataFrame
# Why:     the design ends with a single "FINAL DF"; concatenating the encoded
#          features with the target gives one table that can be saved as CSV.
# Gotcha:  concat on the index keeps every row aligned with its own label.
# ---------------------------------------------------------------------------
def build_final_frame(
    features: pd.DataFrame,
    target: pd.Series,
    preprocessor: ColumnTransformer,
) -> pd.DataFrame:
    """Fit the preprocessor, transform the features and append the target."""
    encoded = preprocessor.fit_transform(features)
    final = pd.concat([encoded, target], axis=1)

    # Median imputation turns integer columns into floats ("39.0"). Give the
    # whole-number columns their original integer type back, so the CSV reads
    # like the raw file. Columns that genuinely need a .5 median stay float.
    for col in NUMERIC_COLS:
        values = final[col]
        if values.notna().all() and (values == values.round()).all():
            final[col] = values.astype("int64")

    return final


# ---------------------------------------------------------------------------
# STEP 8 - Guard rails, so a dirty table can never be saved by accident
# Why:     "it ran" is not "it is correct". These checks are cheap and they
#          fail loudly during the build, not silently at interview time.
# ---------------------------------------------------------------------------
def validate_final_frame(final: pd.DataFrame) -> None:
    """Raise if the unified table still contains missing or dirty values."""
    if final.isna().any().any():
        bad = final.columns[final.isna().any()].tolist()
        raise ValueError(f"Missing values remain in columns: {bad}")

    if TARGET not in final.columns:
        raise ValueError(f"Target column {TARGET!r} is missing from the final frame")

    if set(final[TARGET].unique()) - {0, 1}:
        raise ValueError("The target must contain only 0 and 1")

    bad_names = [col for col in final.columns if col != col.strip()]
    if bad_names:
        raise ValueError(f"Column names have stray whitespace: {bad_names[:5]}")

    for col in final.select_dtypes(include=["object", "string", "str"]).columns:
        values = final[col].astype(str)
        dirty = values[values.str.strip().ne(values) | values.isin(["?", ""])]
        if not dirty.empty:
            raise ValueError(f"Uncleaned text values remain in {col!r}")
