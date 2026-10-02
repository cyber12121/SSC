#!/usr/bin/env python3
"""Sanity-check every extracted pack before its unit is turned into a page.

Each check here corresponds to a defect that was actually observed in this
corpus, so a clean run means the pipeline's known failure modes are absent.

    python verify_packs.py
    python verify_packs.py --figures    # also list figure shapes per unit
"""
from __future__ import annotations

import collections
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
PACKS = HERE / "packs"

# fragments that were dropped ff/ft ligatures if they appear with a space after
LIGATURE_FRAGMENTS = ("diff", "coff", "traff", "giraff", "eiff", "fift",
                      "off", "aff", "eff", "aft", "oft")

# prose that belongs to the answer key's section headers, never to an answer
BLEED_MARKERS = ("Key to Exercises", "Key to Additional", "lingualib",
                 "facebook", "you have to use", "Example answers are given")

# byte sequences produced when UTF-8 is decoded as latin-1
MOJIBAKE = re.compile(r"[\u00c2\u00c3\u00e2][\u0080-\u00ff\u2013\u2014\u2018"
                      r"\u2019\u201c\u201d\u20ac\u2020\u2021\u2030\u0160"
                      r"\u2039\u0152\u017d\u201a\u201e\u2026\u203a]")

# a word split by a dropped ligature: fragment + space + lowercase continuation
SPLIT_LIGATURE = re.compile(
    r"\b(" + "|".join(LIGATURE_FRAGMENTS) + r")\s+([a-z]{2,})")
# ...unless the first fragment is a real word standing on its own
STANDALONE = {"off", "left", "lift", "staff", "soft", "half", "self", "stuff",
              "brief", "gulf", "shelf", "wolf", "calf", "first"}

# a figure whose colours barely vary is a sliver of empty space, not artwork
BLANK_SPREAD = 8.0


def image_stats(path: pathlib.Path) -> tuple[float, int]:
    """(colour spread, pixel count) of a rendered figure.

    A figure that is almost a single flat colour is not artwork: it is a sliver
    of white space or a rule that the seam detector should not have emitted.
    Images are thumbnailed first because the full renders are large.
    """
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        return -1.0, 0
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((160, 160))
        arr = np.asarray(im, dtype=np.int16)
    return float(arr.std()), int(arr.shape[0] * arr.shape[1])


def main(argv: list[str]) -> int:
    show_figures = "--figures" in argv
    check_images = "--no-images" not in argv
    files = sorted(PACKS.glob("unit-*.json"))
    if not files:
        print("no packs found; run extract_pack.py first")
        return 1

    problems: list[str] = []
    ligature_hits: list[str] = []
    bleed_hits: list[str] = []
    mojibake_hits: list[str] = []
    curly_hits: list[str] = []
    blank_figures: list[str] = []
    no_figures: list[int] = []
    wide_figures: list[tuple[int, str, float]] = []
    figure_counts: dict[int, int] = {}
    total_fig_bytes = 0

    for path in files:
        pack = json.loads(path.read_text(encoding="utf-8"))
        unit = pack["unit"]
        answers = [v for items in pack["answer_key"].values()
                   for v in items.values()]
        # answer text is scanned too: it is copied into the pages verbatim
        blob = "\n".join([pack["theory_text"], pack["exercise_text"], *answers])

        for m in SPLIT_LIGATURE.finditer(blob):
            if m.group(1) in STANDALONE:
                continue
            ligature_hits.append(f"unit {unit}: {m.group(0)!r}")

        for m in MOJIBAKE.finditer(blob):
            mojibake_hits.append(f"unit {unit}: {m.group(0)!r}")

        if "\u2019" in blob or "\u2018" in blob:
            curly_hits.append(f"unit {unit}: {blob.count(chr(0x2019))} curly "
                              f"apostrophes (the sample uses straight)")

        for ex, items in pack["answer_key"].items():
            if not items:
                problems.append(f"unit {unit}: exercise {ex} has no answers")
            for num, val in items.items():
                for marker in BLEED_MARKERS:
                    if marker in val:
                        bleed_hits.append(f"unit {unit} {ex}#{num}: {val[:60]!r}")
                if len(val) > 400:
                    problems.append(f"unit {unit} {ex}#{num}: answer is "
                                    f"{len(val)} chars (probably bleed)")

        figures = pack["figures"]
        figure_counts[unit] = len(figures)
        if not figures:
            no_figures.append(unit)
        for fig in figures:
            total_fig_bytes += fig["bytes"]
            asset = HERE.parent.parent / "public" / "murphy" / fig["file"]
            if not asset.is_file():
                problems.append(f"unit {unit}: missing asset {fig['file']}")
                continue
            if check_images:
                spread, pixels = image_stats(asset)
                if 0 <= spread < BLANK_SPREAD:
                    blank_figures.append(
                        f"unit {unit} {fig['file'].split('/')[-1]}: "
                        f"flat image (spread {spread:.1f})")
            if fig["width"] >= 700:
                wide_figures.append((unit, fig["file"].split("/")[-1],
                                     round(fig["bbox"][2] - fig["bbox"][0], 1)))
        if pack.get("warnings"):
            for w in pack["warnings"]:
                problems.append(f"unit {unit}: {w}")

    print(f"packs checked            : {len(files)}")
    print(f"figures total            : {sum(figure_counts.values())} "
          f"({total_fig_bytes / 1e6:.1f} MB)")
    print(f"units with no figures    : {len(no_figures)}")
    print(f"wide figures (>=700px)   : {len(wide_figures)}")
    print()
    print(f"split-ligature leftovers : {len(ligature_hits)}")
    for h in ligature_hits[:15]:
        print("   ", h)
    print(f"answer-key bleed         : {len(bleed_hits)}")
    for h in bleed_hits[:15]:
        print("   ", h)
    print(f"mojibake sequences       : {len(mojibake_hits)}")
    for h in mojibake_hits[:15]:
        print("   ", h)
    print(f"curly apostrophes        : {len(curly_hits)}")
    for h in curly_hits[:10]:
        print("   ", h)
    print(f"flat / blank figures     : {len(blank_figures)}")
    for h in blank_figures[:20]:
        print("   ", h)
    print(f"structural problems      : {len(problems)}")
    for p in problems[:25]:
        print("   ", p)

    if show_figures:
        print("\nfigures per unit (unit: count)")
        line = []
        for unit in sorted(figure_counts):
            line.append(f"{unit}:{figure_counts[unit]}")
            if len(line) == 12:
                print("   " + "  ".join(line))
                line = []
        if line:
            print("   " + "  ".join(line))
        print("\nwide figures (likely unsplit multi-panel strips):")
        for unit, name, width in wide_figures:
            print(f"   unit {unit:>3} {name} {width}pt")

    failed = bool(ligature_hits or bleed_hits or mojibake_hits
                  or curly_hits or blank_figures or problems)
    print("\nRESULT:", "FAIL" if failed else "clean")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
