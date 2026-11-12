"""Smoke tests over HTTP: the contract the React app depends on."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import app

ENCODED_CSV = (
    Path(__file__).resolve().parents[3] / "part_1" / "data" / "processed" / "census_income_final.csv"
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:  # `with` runs the lifespan hook
        yield test_client


def test_healthz(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["rows"] == 48790


def test_meta(client):
    payload = client.get("/api/meta").json()
    assert payload["rows"] == 48790
    assert payload["raw_rows"] == 48842
    assert payload["encoded_shape"] == [48790, 93]
    assert len(payload["issues"]) == 5


def test_meta_reflects_filters(client):
    payload = client.get("/api/meta", params={"income": 1, "sex": "Male"}).json()
    assert payload["rows_after_filter"] < payload["total_rows"]
    assert payload["target"]["positive_share"] == 100.0
    assert payload["filters_applied"]["sex"] == ["Male"]


def test_filter_options(client):
    payload = client.get("/api/filters").json()
    assert payload["sex"] == ["Female", "Male"]
    assert len(payload["native-country"]) == 42
    assert payload["age"] == {"min": 17, "max": 90}


def test_distribution_has_all_panels(client):
    payload = client.get("/api/distribution").json()
    assert len(payload["numeric"]) == 6
    assert len(payload["categorical"]) == 7


def test_target_categorical_respects_min_n(client):
    every = client.get("/api/target-categorical", params={"column": "native-country"}).json()
    filtered = client.get(
        "/api/target-categorical", params={"column": "native-country", "min_n": 100}
    ).json()
    assert len(filtered["levels"]) < len(every["levels"])
    assert filtered["hidden_below_min_n"] > 0


def test_relation_matrix_payload(client):
    payload = client.get("/api/relation-matrix", params={"cap": 100}).json()
    assert len(payload["panels"]) == 21


@pytest.mark.parametrize(
    "path,params",
    [
        ("/api/target-numeric", {"column": "sex"}),
        ("/api/target-categorical", {"column": "age"}),
        ("/api/relation", {"x": "age", "y": "sex"}),
    ],
)
def test_unknown_columns_are_rejected(client, path, params):
    assert client.get(path, params=params).status_code == 400


@pytest.mark.skipif(not ENCODED_CSV.is_file(), reason="build_dataset.py has not been run")
def test_table_preview(client):
    payload = client.get("/api/table", params={"size": 10}).json()
    assert len(payload["columns"]) == 93
    assert len(payload["rows"]) == 10
    assert payload["pages"] == 4879

    searched = client.get("/api/table", params={"search": "workclass"}).json()
    assert all("workclass" in column for column in searched["columns"])
    assert len(searched["columns"]) >= 8
