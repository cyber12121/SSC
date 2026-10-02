#!/usr/bin/env python3
"""Assemble public/murphy/unit-NNN.html from shell + generated content.

    tools/murphy/shell/head.html      (verbatim sample CSS/topbar, {{TITLE}})
  + tools/murphy/content/unit-NNN.html (generated <header class="hero"> + <main>)
  + tools/murphy/shell/tail.html      (verbatim sample footer/script, nav links)

The shell is never regenerated here, so every page shares one stylesheet and one
copy of the interactive script. Everything is deterministic: give the same
inputs and you get byte-identical output.

Usage:
    python assemble.py            # every unit that has a content fragment
    python assemble.py 1 2        # only these units
"""
from __future__ import annotations

import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
PACKS = HERE / "packs"
CONTENT = HERE / "content"
SHELL = HERE / "shell"
OUT = HERE.parent.parent / "public" / "murphy"

BRAND = "English Grammar in Use"


def load_pack(unit: int) -> dict | None:
    path = PACKS / f"unit-{unit:03d}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def nav_labels(packs: dict[int, dict], unit: int, present: set[int]) -> dict[str, str]:
    """Prev/next links that skip units without a generated page."""
    below = sorted(n for n in present if n < unit)
    above = sorted(n for n in present if n > unit)

    if below:
        p = below[-1]
        prev_href, prev_label = (f"unit-{p:03d}.html",
                                 f"\u2190 Unit {p} \u2014 {packs[p]['title']}")
    else:
        prev_href, prev_label = "index.html", "\u2190 All units"

    if above:
        n = above[0]
        next_href, next_label = (f"unit-{n:03d}.html",
                                 f"Next: Unit {n} \u2014 {packs[n]['title']} \u2192")
    else:
        next_href, next_label = "index.html", "All units \u2192"

    return {
        "{{PREV_HREF}}": prev_href,
        "{{PREV_LABEL}}": prev_label,
        "{{NEXT_HREF}}": next_href,
        "{{NEXT_LABEL}}": next_label,
    }


def main(argv: list[str]) -> int:
    head = (SHELL / "head.html").read_text(encoding="utf-8")
    tail = (SHELL / "tail.html").read_text(encoding="utf-8")

    wanted = sorted(int(a) for a in argv if a.isdigit())
    if wanted:
        units = wanted
    else:
        units = sorted(int(p.stem.split("-")[1]) for p in CONTENT.glob("unit-*.html"))

    if not units:
        print("no content fragments found in", CONTENT)
        return 1

    present = {int(p.stem.split("-")[1]) for p in CONTENT.glob("unit-*.html")}
    packs = {n: (load_pack(n) or {"title": "", "unit": n}) for n in present | set(units)}

    OUT.mkdir(parents=True, exist_ok=True)
    built = 0
    for unit in units:
        fragment_path = CONTENT / f"unit-{unit:03d}.html"
        if not fragment_path.is_file():
            print(f"unit {unit:>3}  SKIP (no content fragment)")
            continue

        pack = packs[unit]
        fragment = fragment_path.read_text(encoding="utf-8").strip()

        page = head.replace("{{TITLE}}",
                            f"Unit {unit} \u2014 {pack['title']} | {BRAND}", 1)
        page = page.replace("<!--MURPHY_CONTENT-->", fragment, 1)
        page = page + tail
        for key, value in nav_labels(packs, unit, present).items():
            page = page.replace(key, value)

        if "{{" in page:
            leftovers = sorted({page[i:i + 20] for i in
                                range(len(page)) if page.startswith("{{", i)})
            print(f"unit {unit:>3}  ERROR unreplaced placeholders: {leftovers}")
            return 1

        out_path = OUT / f"unit-{unit:03d}.html"
        out_path.write_text(page, encoding="utf-8")
        built += 1
        print(f"unit {unit:>3}  {len(page):>7} bytes  ->  {out_path.name}")

    print(f"\n{built} page(s) -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
