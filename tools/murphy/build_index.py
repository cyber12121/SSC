#!/usr/bin/env python3
"""Build public/murphy/index.html — the table of contents for all units.

Reuses the same shell as the unit pages, so the index shares their stylesheet.
Units are grouped by the section they came from in the source folder, and each
card links to that unit's page.

Usage:
    python build_index.py
"""
from __future__ import annotations

import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
PACKS = HERE / "packs"
SHELL = HERE / "shell"
PUBLIC = HERE.parent.parent / "public" / "murphy"

BRAND = "English Grammar in Use"

FOOTER_NAV = (
    '  <div class="footer-nav">\n'
    '    <a class="next-unit prev" href="{{PREV_HREF}}">{{PREV_LABEL}}</a>\n'
    '    <a class="next-unit" href="{{NEXT_HREF}}">{{NEXT_LABEL}}</a>\n'
    "  </div>"
)


def escape(text: str) -> str:
    return (text.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace('"', "&quot;"))


def main() -> int:
    packs = []
    for path in sorted(PACKS.glob("unit-*.json")):
        packs.append(json.loads(path.read_text(encoding="utf-8")))
    if not packs:
        print("no packs found; run extract_pack.py first")
        return 1
    packs.sort(key=lambda p: p["unit"])

    # group by source section, preserving unit order
    sections: dict[str, list[dict]] = {}
    for pack in packs:
        sections.setdefault(pack.get("section") or "Units", []).append(pack)

    def span_of(items: list[dict]) -> str:
        first, last = items[0]["unit"], items[-1]["unit"]
        return (f"Unit {first}" if first == last
                else f"Units {first}\u2013{last}")

    parts = [
        '<header class="hero">',
        '  <span class="unit-badge">English Grammar in Use</span>',
        "  <h1>Grammar Units<span class=\"sub\">I am doing &amp; I do</span></h1>",
        f'  <p class="lede">{len(packs)} interactive units in '
        f"{len(sections)} chapters — theory, exercises with instant marking, "
        "answer keys and a summary for every unit.</p>",
        "</header>",
        "",
        "<main>",
        "",
        '  <section id="chapters">',
        "    <h2>Chapters</h2>",
        '    <p class="ex-instruction">Jump to a chapter, or scroll down for '
        "every unit.</p>",
        '    <ul class="chapter-list">',
    ]

    # chapters overview first, each linking to its unit group below
    for index, (section, items) in enumerate(sections.items(), start=1):
        count = len(items)
        parts.append(
            f'      <li><a href="#units-{index}">'
            f'<span>{escape(section)}</span>'
            f'<span class="range">{span_of(items)} \u00b7 {count} '
            f'unit{"s" if count != 1 else ""}</span></a></li>')

    parts += [
        "    </ul>",
        "  </section>",
        "",
        '  <section id="units">',
        "    <h2>All Units</h2>",
        "  </section>",
        "",
    ]

    # then the units themselves, grouped per chapter
    for index, (section, items) in enumerate(sections.items(), start=1):
        parts.append(f'  <section id="units-{index}">')
        parts.append(f"    <h2>{escape(section)}</h2>")
        parts.append(f'    <p class="ex-instruction">{span_of(items)} \u00b7 '
                     f'{len(items)} unit{"s" if len(items) != 1 else ""}</p>')
        parts.append('    <div class="pic-grid">')
        for pack in items:
            unit = pack["unit"]
            parts.append(f'      <a class="pic-card" href="unit-{unit:03d}.html">')
            parts.append(f'        <span class="pic-num">Unit {unit}</span>')
            parts.append(f'        <p class="pic-text">{escape(pack["title"])}</p>')
            parts.append("      </a>")
        parts.append("    </div>")
        parts.append("  </section>")
        parts.append("")

    parts.append("</main>")

    head = (SHELL / "head.html").read_text(encoding="utf-8")
    tail = (SHELL / "tail.html").read_text(encoding="utf-8")

    head = head.replace("{{TITLE}}", f"All Units | {BRAND}", 1)
    # the section anchors belong to unit pages, not to the index
    head = head.replace(
        '    <nav class="nav-links">\n'
        '      <a href="#theory">Theory</a>\n'
        '      <a href="#exercises">Exercises</a>\n'
        '      <a href="#answers">Answers</a>\n'
        '      <a href="#summary">Summary</a>\n'
        "    </nav>\n", "")
    head = head.replace("<!--MURPHY_CONTENT-->", "\n".join(parts), 1)

    if FOOTER_NAV not in tail:
        print("ERROR: footer navigation block not found in shell/tail.html")
        return 1
    tail = tail.replace(
        FOOTER_NAV,
        '  <a class="next-unit" href="unit-001.html">'
        "Start with Unit 1 \u2192</a>", 1)

    page = head + tail
    if "{{" in page:
        leftovers = sorted({page[i:i + 18] for i in range(len(page))
                            if page.startswith("{{", i)})
        print(f"ERROR unreplaced placeholders: {leftovers}")
        return 1

    PUBLIC.mkdir(parents=True, exist_ok=True)
    out = PUBLIC / "index.html"
    out.write_text(page, encoding="utf-8")
    print(f"{len(packs)} units in {len(sections)} sections -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
