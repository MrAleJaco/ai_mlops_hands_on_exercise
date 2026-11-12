#!/bin/sh
# One-shot preprocessing job: turn the raw CSV into the artefacts the API
# serves. Runs as its own container, exits 0, and the API waits for it.
set -eu

artifacts="${ARTIFACT_DIR:-/data/artifacts}"

# A fresh named volume is created root-owned. The job starts as root only to
# fix that, then drops to the same uid as the API (10001) and does the work.
if [ "$(id -u)" = "0" ]; then
    mkdir -p "$artifacts"
    chown -R 10001:10001 "$artifacts"
    exec setpriv --reuid=10001 --regid=10001 --clear-groups "$0" "$@"
fi

raw="${CENSUS_RAW_PATH:-/data/raw/census_income.csv}"
if [ ! -f "$raw" ]; then
    raw="/data/datasets/census_income.csv"
fi
if [ ! -f "$raw" ]; then
    echo "No raw CSV found. Put census_income.csv in part_1/data/raw_data/ or datasets/." >&2
    exit 1
fi

out="${CENSUS_ENCODED_PATH:-$artifacts/census_income_final.csv}"
mkdir -p "$(dirname "$out")"

echo "Building artefacts from $raw as $(id -un) ($(id -u))"
exec python part_1/src/build_dataset.py --input "$raw" --output "$out"
