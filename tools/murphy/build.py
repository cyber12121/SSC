#!/usr/bin/env python3
"""Assemble every generated unit, rebuild the index, then validate.

    python build.py            # everything that has a content fragment
    python build.py 3 4 5 6    # only these units (index still rebuilt)

Equivalent to running assemble.py, build_index.py and validate.py in order.
Run this after generating content for a batch of units.
"""
from __future__ import annotations

import subprocess
import sys
import pathlib

HERE = pathlib.Path(__file__).resolve().parent


def run(script: str, *args: str) -> int:
    cmd = [sys.executable, str(HERE / script), *args]
    print(f"\n=== {script} {' '.join(args)} ===")
    return subprocess.call(cmd)


def main(argv: list[str]) -> int:
    units = [a for a in argv if a.isdigit()]

    if run("assemble.py", *units) != 0:
        return 1
    if run("build_index.py") != 0:
        return 1
    return run("validate.py", *units)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
