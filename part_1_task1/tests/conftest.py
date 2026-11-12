"""Make `part_1_task1/src` importable when pytest runs from the repository root."""

import sys
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC_DIR))
