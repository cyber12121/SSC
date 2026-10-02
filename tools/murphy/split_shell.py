#!/usr/bin/env python3
"""Split the approved sample page into a reusable shell + a golden Unit 1 reference.

The sample (deepseek_html_20261001_b1f728.html) is the canonical design. This
script copies its <style> and <script> blocks VERBATIM into:

    tools/murphy/shell/head.html   doctype .. topbar,     with {{TITLE}} and <!--MURPHY_CONTENT-->
    tools/murphy/shell/tail.html   footer .. </html>,     with footer nav placeholders
    tools/murphy/reference/unit-001-sample.html
                                   the sample's hero + <main>, the golden reference
                                   for validating the generated Unit 1

Run once. It only reads the sample; it never modifies it.
"""
from __future__ import annotations

import pathlib
import sys

SAMPLE = pathlib.Path(
    r"C:\Users\panda\Downloads\deepseek_html_20261001_b1f728.html"
)
HERE = pathlib.Path(__file__).resolve().parent
SHELL = HERE / "shell"
REFERENCE = HERE / "reference"

HERO_MARK = '<header class="hero">'
FOOTER_MARK = "<footer>"
MAIN_END = "</main>"

TITLE_LINE = "<title>Unit 1 — Present Continuous (I am doing) | English Grammar in Use</title>"
NEXT_LINE = '  <a class="next-unit" href="#">Next: Unit 2 — Present Simple (I do) →</a>'

# Two additions to the sample's stylesheet, both required by this project:
#   .pic-img            the sample used .pic-emoji; real extracted drawings need <img>
#   .footer-nav / .prev real prev-next links instead of the sample's href="#"
CSS_ADDITIONS = """
  /* ---- project additions (real figures + prev/next nav) ---- */
  .pic-img {
    display: block; width: 100%; height: auto;
    border-radius: 8px; margin: 8px 0 12px;
    background: #fff;
  }
  .theory-fig {
    max-width: 320px; width: 100%;
    margin: 16px auto 4px;
  }
  a.pic-card { text-decoration: none; color: inherit; }
  a.pic-card:hover { border-color: var(--accent); background: var(--accent-light); }
  .chapter-list { list-style: none; padding: 0; margin: 18px 0 8px; }
  .chapter-list li { border-bottom: 1px solid var(--border); }
  .chapter-list li:first-child { border-top: 1px solid var(--border); }
  .chapter-list a {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 16px; padding: 13px 4px; text-decoration: none; color: var(--ink);
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 15px; font-weight: 600; transition: color 0.2s;
  }
  .chapter-list a:hover { color: var(--accent); }
  .chapter-list .range { color: var(--muted); font-weight: 500; font-size: 13px; }
  .footer-nav {
    display: flex; gap: 12px; justify-content: center;
    flex-wrap: wrap; margin-top: 16px;
  }
  .footer-nav .next-unit { margin-top: 0; }
  footer .next-unit.prev {
    background: transparent; color: var(--accent);
    border: 1px solid var(--accent); padding: 11px 26px;
  }
  footer .next-unit.prev:hover { background: var(--accent-light); }
"""


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if not SAMPLE.is_file():
        fail(f"sample not found: {SAMPLE}")

    text = SAMPLE.read_text(encoding="utf-8")

    for mark in ('<style>', "</style>", HERO_MARK, FOOTER_MARK, MAIN_END):
        if mark not in text:
            fail(f"sample is missing expected marker: {mark}")

    hero_at = text.index(HERO_MARK)
    footer_at = text.index(FOOTER_MARK)
    main_end_at = text.index(MAIN_END)

    if not hero_at < main_end_at < footer_at:
        fail("sample markers are not in the expected order")

    head = text[:hero_at]
    content = text[hero_at : main_end_at + len(MAIN_END)]
    tail = text[footer_at:]

    # --- head: template the title, inject the two CSS additions ---
    if TITLE_LINE not in head:
        fail("expected <title> line not found verbatim in the sample head")
    head = head.replace(TITLE_LINE, "<title>{{TITLE}}</title>", 1)

    style_close = head.rindex("</style>")
    head = head[:style_close] + CSS_ADDITIONS + head[style_close:]

    # --- tail: real prev/next navigation instead of href="#" ---
    if NEXT_LINE not in tail:
        fail("expected next-unit footer line not found verbatim in the sample tail")
    tail = tail.replace(
        NEXT_LINE,
        '  <div class="footer-nav">\n'
        '    <a class="next-unit prev" href="{{PREV_HREF}}">{{PREV_LABEL}}</a>\n'
        '    <a class="next-unit" href="{{NEXT_HREF}}">{{NEXT_LABEL}}</a>\n'
        "  </div>",
        1,
    )

    # head ends right before the hero; the content fragment starts with the hero,
    # so append the content placeholder marker to head for assembly.
    head = head.rstrip() + "\n\n<!--MURPHY_CONTENT-->\n"

    SHELL.mkdir(parents=True, exist_ok=True)
    REFERENCE.mkdir(parents=True, exist_ok=True)

    (SHELL / "head.html").write_text(head, encoding="utf-8")
    (SHELL / "tail.html").write_text(tail, encoding="utf-8")
    (REFERENCE / "unit-001-sample.html").write_text(content, encoding="utf-8")

    print(f"head.html      {len(head):>7} bytes")
    print(f"tail.html      {len(tail):>7} bytes")
    print(f"unit-001 ref   {len(content):>7} bytes")
    print(f"written under  {HERE}")


if __name__ == "__main__":
    main()
