#!/usr/bin/env python3
"""Validate the assembled public/murphy pages against the sample's contract.

Every check below exists because breaking it silently produces a page that looks
fine but misbehaves: an input nobody can answer, an exercise with no Check
button, an image that 404s, or a class the shared stylesheet does not define.

Usage:
    python validate.py            # all assembled pages
    python validate.py 1 2        # only these units
    python validate.py --quiet    # summary only
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

from lxml import html as lxml_html

HERE = pathlib.Path(__file__).resolve().parent
SHELL = HERE / "shell" / "head.html"
PACKS = HERE / "packs"
PUBLIC = HERE.parent.parent / "public" / "murphy"

REQUIRED_SECTIONS = ["theory", "exercises", "answers", "summary"]
HANDLERS = {"checkExercise(this)", "showAnswers(this)", "resetExercise(this)"}
PLACEHOLDER = re.compile(r"\{\{[A-Z_]+\}\}|<!--MURPHY_CONTENT-->")


def stylesheet_classes() -> set[str]:
    """Every class name the shared stylesheet actually defines."""
    head = SHELL.read_text(encoding="utf-8")
    style = head[head.index("<style>"):head.index("</style>")]
    return set(re.findall(r"\.([A-Za-z][\w-]*)", style))


def js_function_names() -> set[str]:
    head = SHELL.read_text(encoding="utf-8")
    tail = (HERE / "shell" / "tail.html").read_text(encoding="utf-8")
    return set(re.findall(r"function\s+([A-Za-z_]\w*)\s*\(", head + tail))


def check_page(unit: int, allowed_classes: set[str],
               defined_js: set[str]) -> list[str]:
    errors: list[str] = []
    page_path = PUBLIC / f"unit-{unit:03d}.html"
    if not page_path.is_file():
        return [f"missing page {page_path.name}"]

    raw = page_path.read_text(encoding="utf-8")

    # 9. no template leftovers
    if PLACEHOLDER.search(raw):
        errors.append(f"unreplaced template placeholder: "
                      f"{PLACEHOLDER.search(raw).group(0)!r}")

    # 8. parses and is a complete document
    try:
        doc = lxml_html.fromstring(raw)
    except Exception as exc:                       # noqa: BLE001
        return errors + [f"HTML does not parse: {exc}"]

    # 7. the four sections exist, in order
    ids = doc.xpath("//section/@id")
    if ids != REQUIRED_SECTIONS:
        errors.append(f"sections are {ids}, expected {REQUIRED_SECTIONS}")

    # 1. / 2. every answer field is answerable and uses the | separator
    fields = doc.xpath("//*[contains(@class,'fill-input') or "
                       "contains(@class,'match-select')]")
    if not fields:
        errors.append("no answer fields on the page")
    for el in fields:
        ans = el.get("data-answer")
        tag = el.tag
        if not ans or not ans.strip():
            errors.append(f"<{tag}> without a usable data-answer")
        elif "/" in ans:
            errors.append(f"data-answer uses '/' instead of '|': {ans!r}")

    # 3. every exercise has the three buttons and a feedback slot
    exercises = doc.xpath("//*[contains(@class,'exercise') and @data-ex]")
    if not exercises:
        errors.append("no exercises on the page")
    for ex in exercises:
        num = ex.get("data-ex")
        onclicks = [b.get("onclick") for b in ex.xpath(".//button")]
        missing = HANDLERS - set(onclicks)
        if missing:
            errors.append(f"exercise {num}: missing buttons {sorted(missing)}")
        if not ex.xpath(".//*[contains(@class,'feedback')]"):
            errors.append(f"exercise {num}: no .feedback element")
        if not ex.xpath(".//*[contains(@class,'fill-input') or "
                        "contains(@class,'match-select')]"):
            errors.append(f"exercise {num}: no answerable fields")

    # 10. only the known handlers are wired up
    for handler in doc.xpath("//@onclick"):
        if handler not in HANDLERS:
            errors.append(f"unexpected onclick handler {handler!r}")

    # 5. every referenced image, stylesheet and link resolves
    for src in doc.xpath("//img/@src"):
        target = (PUBLIC / src).resolve()
        if not target.is_file():
            errors.append(f"image not found: {src}")
    for href in doc.xpath("//a/@href"):
        if href.startswith(("http", "#", "mailto:")):
            continue
        if not (PUBLIC / href).resolve().is_file():
            errors.append(f"link target not found: {href}")

    # 6. only classes the shared stylesheet defines
    used: set[str] = set()
    for attr in doc.xpath("//@class"):
        used.update(attr.split())
    unknown = sorted(used - allowed_classes)
    if unknown:
        errors.append(f"classes not in the stylesheet: {unknown}")

    # 4. exercise numbers agree with the extracted answer key
    pack_path = PACKS / f"unit-{unit:03d}.json"
    if pack_path.is_file():
        pack = json.loads(pack_path.read_text(encoding="utf-8"))
        expected = set(pack["answer_key"])
        got = {ex.get("data-ex") for ex in exercises}
        if expected and expected != got:
            errors.append(f"exercise numbers {sorted(got)} != "
                          f"answer key {sorted(expected)}")
        # every answer-key exercise should have a matching reveal block
        reveals = len(doc.xpath("//details[contains(@class,'reveal')]"))
        if expected and reveals != len(expected):
            errors.append(f"{reveals} answer reveals for "
                          f"{len(expected)} exercises")

    # 8b. the interactive script is present and calls defined functions
    if "checkExercise" not in raw:
        errors.append("interactive script missing")
    for fn in ("checkExercise", "showAnswers", "resetExercise"):
        if fn not in defined_js:
            errors.append(f"script does not define {fn}()")

    return errors


def main(argv: list[str]) -> int:
    quiet = "--quiet" in argv
    wanted = [int(a) for a in argv if a.isdigit()]
    if wanted:
        units = wanted
    else:
        units = sorted(int(p.stem.split("-")[1])
                       for p in PUBLIC.glob("unit-*.html"))

    if not units:
        print("no assembled pages found in", PUBLIC)
        return 1

    allowed = stylesheet_classes()
    defined_js = js_function_names()

    failed = 0
    report: dict[str, list[str]] = {}
    for unit in units:
        errors = check_page(unit, allowed, defined_js)
        if errors:
            failed += 1
            report[f"unit-{unit:03d}"] = errors
            print(f"unit {unit:>3}  FAIL ({len(errors)})")
            if not quiet:
                for e in errors:
                    print(f"           - {e}")
        elif not quiet:
            print(f"unit {unit:>3}  ok")

    (HERE / "validate-report.json").write_text(
        json.dumps({"checked": len(units), "failed": failed, "report": report},
                   indent=1), encoding="utf-8")

    print(f"\n{len(units) - failed}/{len(units)} pages valid"
          f"  (report: {(HERE / 'validate-report.json').name})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
