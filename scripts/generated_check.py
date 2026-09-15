"""Every committed artefact that a tool generates still matches what the tool generates.

    python scripts/generated_check.py

Runs each regeneration and then `git diff --exit-code` on what it writes; prints one line per
artefact; exits 1 on the first that differs (the diff is left in the tree for inspection), 2 when
a tool is missing. This is the check `release_check.py` runs as `gate.generated`, and the one
CI runs step by step; it exists as one command so that nobody has to remember four.
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
NPX = "npx.cmd" if os.name == "nt" else "npx"

# (name, regeneration command, extra environment, paths to diff, optional formatting command)
CHECKS = [
    ("conformance matrix", [NPX, "vitest", "run", "--silent"], {"UPDATE_MATRIX": "1"}, ["packages/protocol/data/compat-matrix.json"]),
    ("fuzz corpus", ["cargo", "test", "-p", "encastra-project", "--test", "fuzz_smoke", "--quiet"], {"UPDATE_FUZZ_CORPUS": "1"}, ["fuzz/corpus"]),
    # The Rust test writes the fixture unformatted and biome owns the formatting, so the
    # formatter runs before the diff — the same two steps a person takes.
    ("error kinds", ["cargo", "test", "-p", "encastra-desktop", "--quiet"], {"UPDATE_ERROR_KINDS": "1"}, ["apps/desktop/test/fixtures/error-kinds.json"], [NPX, "biome", "check", "--write", "apps/desktop/test/fixtures"]),
    ("third-party inventory", [sys.executable, "scripts/third_party.py", "--check"], {}, []),
    ("version and lock", [sys.executable, "scripts/version.py", "--check"], {}, []),
]


def main() -> int:
    for name, command, extra_env, paths, *post in CHECKS:
        env = {**os.environ, **extra_env}
        try:
            run = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=os.name == "nt")
        except OSError as error:
            print(f"{name}: cannot run {command[0]} ({error})", file=sys.stderr)
            return 2
        if run.returncode != 0:
            print(f"{name}: the regeneration itself failed (exit {run.returncode})", file=sys.stderr)
            print(run.stdout[-2000:] + run.stderr[-2000:], file=sys.stderr)
            return 1
        for formatter in post:
            subprocess.run(formatter, cwd=ROOT, capture_output=True, shell=os.name == "nt")
        if paths:
            diff = subprocess.run(["git", "diff", "--exit-code", "--stat", "--", *paths], cwd=ROOT, capture_output=True, text=True)
            if diff.returncode != 0:
                print(f"{name}: STALE — the committed copy differs from what the tree generates:", file=sys.stderr)
                print(diff.stdout, file=sys.stderr)
                return 1
        print(f"{name}: matches the tree")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
