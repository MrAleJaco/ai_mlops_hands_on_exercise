"""Shared query-string filters for every endpoint.

The charts must all agree on what "the current selection" means, so the
browser sends one flat set of query parameters and every endpoint applies the
same mask. Keeping this in one dataclass also makes the cache key obvious:
two requests with the same filters are the same request.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from census_pipeline import TARGET


def split_csv(value: str | None) -> tuple[str, ...]:
    """Turn "Male,Female" into ("Male", "Female"); ignore blanks."""
    if not value:
        return ()
    return tuple(part.strip() for part in value.split(",") if part.strip())


@dataclass(frozen=True)
class Filters:
    """The subset of rows the user is looking at right now."""

    income: int | None = None
    sex: tuple[str, ...] = ()
    workclass: tuple[str, ...] = ()
    native_country: tuple[str, ...] = ()
    age_min: float | None = None
    age_max: float | None = None
    hours_min: float | None = None
    hours_max: float | None = None

    def mask(self, df: pd.DataFrame) -> pd.Series:
        """Boolean mask, True where the row survives the selection."""
        keep = pd.Series(True, index=df.index)

        if self.income is not None:
            keep &= df[TARGET] == self.income
        if self.sex:
            keep &= df["sex"].isin(self.sex)
        if self.workclass:
            keep &= df["workclass"].isin(self.workclass)
        if self.native_country:
            keep &= df["native-country"].isin(self.native_country)
        if self.age_min is not None:
            keep &= df["age"] >= self.age_min
        if self.age_max is not None:
            keep &= df["age"] <= self.age_max
        if self.hours_min is not None:
            keep &= df["hours-per-week"] >= self.hours_min
        if self.hours_max is not None:
            keep &= df["hours-per-week"] <= self.hours_max

        return keep

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return only the selected rows, index reset so positions are 0..n-1."""
        return df.loc[self.mask(df)].reset_index(drop=True)

    def cache_key(self) -> tuple:
        """Hashable, order-independent identity of this selection."""
        return (
            self.income,
            tuple(sorted(self.sex)),
            tuple(sorted(self.workclass)),
            tuple(sorted(self.native_country)),
            self.age_min,
            self.age_max,
            self.hours_min,
            self.hours_max,
        )

    def as_dict(self) -> dict:
        """The filters as the browser sent them, for echoing back."""
        return {
            "income": self.income,
            "sex": list(self.sex),
            "workclass": list(self.workclass),
            "native-country": list(self.native_country),
            "age_min": self.age_min,
            "age_max": self.age_max,
            "hours_min": self.hours_min,
            "hours_max": self.hours_max,
        }
