#!/usr/bin/env python3
# Cursor (AI-assisted).
"""Prepend tool attribution to source files under crafter-rollout-app.

Default tool is **Cursor**. For Claude Code–authored files, run:

  ATTRIBUTION_TOOL=claude-code python scripts/prepend_ai_attribution.py

Recognizes existing headers for either tool so files are not re-tagged.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = frozenset(
    {"node_modules", "dist", ".git", "__pycache__", ".venv", "checkpoints", "build"}
)


def _label_lines() -> tuple[str, str, str]:
    tool = os.environ.get("ATTRIBUTION_TOOL", "cursor").strip().lower().replace("_", "-")
    if tool in ("claude", "claude-code"):
        name = "Claude Code"
    else:
        name = "Cursor"
    line = f"{name} (AI-assisted)."
    return f"# {line}", f"// {line}", f"/* {line} */"


def _already_tagged(text: str) -> bool:
    known = {
        "# Cursor (AI-assisted).",
        "// Cursor (AI-assisted).",
        "/* Cursor (AI-assisted). */",
        "# Claude Code (AI-assisted).",
        "// Claude Code (AI-assisted).",
        "/* Claude Code (AI-assisted). */",
    }
    for line in text.splitlines()[:24]:
        if line.strip() in known:
            return True
    return False


def _py(text: str, py_line: str) -> str:
    lines = text.splitlines(keepends=True)
    if not lines:
        return py_line + "\n"
    if lines[0].startswith("#!"):
        return lines[0] + py_line + "\n" + "".join(lines[1:])
    return py_line + "\n" + text


def _ts(text: str, ts_line: str) -> str:
    if text.startswith("///"):
        i = text.find("\n")
        if i == -1:
            return text + "\n" + ts_line + "\n"
        return text[: i + 1] + ts_line + "\n" + text[i + 1 :]
    return ts_line + "\n\n" + text


def _css(text: str, css_line: str) -> str:
    return css_line + "\n\n" + text


def _yml(text: str, py_line: str) -> str:
    return py_line + "\n\n" + text


def main() -> int:
    py_line, ts_line, css_line = _label_lines()
    handlers = {
        ".py": lambda t: _py(t, py_line),
        ".ts": lambda t: _ts(t, ts_line),
        ".tsx": lambda t: _ts(t, ts_line),
        ".css": lambda t: _css(t, css_line),
        ".yml": lambda t: _yml(t, py_line),
        ".yaml": lambda t: _yml(t, py_line),
    }
    n = 0
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(p in SKIP_PARTS for p in path.parts):
            continue
        fn = handlers.get(path.suffix.lower())
        if not fn:
            continue
        try:
            raw = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if _already_tagged(raw):
            continue
        path.write_text(fn(raw), encoding="utf-8")
        n += 1
        print(path.relative_to(ROOT))
    print(f"Updated {n} files (ATTRIBUTION_TOOL={os.environ.get('ATTRIBUTION_TOOL', 'cursor')!r}).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
