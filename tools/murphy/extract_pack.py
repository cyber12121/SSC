#!/usr/bin/env python3
"""Extract per-unit source packs from the English Grammar in Use PDFs.

For every numbered unit this produces:

    tools/murphy/packs/unit-NNN.json      theory text, exercise text, answers, figures
    public/murphy/assets/unit-NNN/fig-NN.png   the unit's drawings, rendered from the PDF

Deterministic and idempotent. The source PDFs are only ever read.

Why render instead of extracting embedded images: the book's drawings are stored
as many small JPEG tiles (e.g. 24x31 pt slivers). Reassembling tiles is fragile,
so each cluster of tiles is rendered as one clipped high-DPI pixmap instead.

Usage:
    python extract_pack.py            # all 145 units
    python extract_pack.py 1 2 3      # only these units
    python extract_pack.py --report   # print a summary of the extracted packs
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import unicodedata

import fitz  # PyMuPDF
import numpy as np

BASE = pathlib.Path(r"C:\Users\panda\Downloads\grammar_chapters")
ANSWER_KEY = BASE / "12_Answer_Keys" / "Key to Exercises.pdf"

HERE = pathlib.Path(__file__).resolve().parent
PACKS = HERE / "packs"
ASSETS = HERE.parent.parent / "public" / "murphy" / "assets"

# --- figure detection tuning -------------------------------------------------
CLUSTER_GAP = 1.0     # pt; tiles of one drawing touch; distinct drawings do not
HAIRLINE = 3.0        # pt; tiles thinner than this are rules/dividers, not art
MIN_SIDE = 24.0       # pt; drop clusters thinner than this
MIN_AREA = 900.0      # pt^2; drop small decorative marks
RENDER_DPI = 300
PADDING = 3.0         # pt of margin around each rendered drawing

# Picture exercises print several drawings side by side in one bordered strip.
# Adjacent drawings can even overlap, so they are separated by finding the
# thin uniform border lines between them rather than by geometry.
STRIP_MIN_WIDTH = 140.0   # pt; only strips at least this wide are split
SEAM_STD = 20.0           # per-column colour spread below this counts as a border
SEAM_MAX_PX = 14          # a border line is narrow; flat artwork is far wider
SEAM_MIN_SEGMENT = 35.0   # pt; never emit a slice thinner than this
SEAM_MAX_SEGMENTS = 8     # a strip is a handful of pictures, not a mosaic
SEAM_ANALYSIS_DPI = 200
ROW_TOL = 12.0        # pt; drawings whose tops differ by less are one visual row
# A split is only accepted if every resulting cell looks like a picture. Very
# wide, short cells mean flat artwork was mistaken for a divider.
MIN_CELL_ASPECT = 0.36
MAX_CELL_ASPECT = 2.8
OVERLAP_MERGE = 0.5   # shared fraction of the smaller box that means "same drawing"
VECTOR_ADOPT_LIMIT = 300.0   # pt; cap on how far vector art may widen a cell crop

WATERMARKS = re.compile(r"(facebook\.com/LinguaLIB|vk\.com/lingualib)", re.I)

# These PDFs drop the ff / ft / fi / fl ligature glyph and leave whitespace
# behind, so words come out as "off ice", "aft ernoon", "diff erent" -- sometimes
# with a newline instead of a space. Each entry is (before the ligature, after
# it) and the whitespace between the two is deleted.
#
# Pairing the fragments exactly is what keeps genuine word pairs intact: "off
# the", "off my", "left the" and "lift it" are correct English and must not be
# glued together, while "off ice" and "aff ord" are always damage.
LIGATURE_PAIRS = [
    ("diff", "erences"), ("diff", "erence"), ("diff", "iculty"),
    ("aft", "erwards"), ("diff", "icult"), ("aft", "ernoon"),
    ("diff", "erent"), ("off", "ering"), ("off", "icer"),
    ("off", "ered"), ("traff", "ic"), ("giraff", "e"), ("fift", "een"),
    ("off", "ice"), ("aff", "ord"), ("eff", "ort"), ("coff", "ee"),
    ("eiff", "el"), ("off", "er"), ("aft", "er"), ("oft", "en"),
    ("fift", "y"),
]
LIGATURE_RE = re.compile(
    r"\b(" + "|".join(re.escape(pre) + r"\s+" + re.escape(post)
                      for pre, post in LIGATURE_PAIRS) + r")\b",
    re.IGNORECASE,
)
RE_UNIT_HEAD = re.compile(r"^\s*UNIT\s+(\d+)\s*$")
RE_EXERCISE = re.compile(r"^\s*(\d{1,3})\.(\d{1,2})\s*$")
RE_ITEM = re.compile(r"^\s*(\d{1,3})\s+(\S.*)$")
RE_PAGE_NUM = re.compile(r"^\s*\d{1,3}\s*$")
RE_UNIT_FILE = re.compile(r"^(\d{1,3})\s+(.*)$")

# a few keys label answers as a range, e.g. "2-6" or "10-12", optionally with the
# first answer on the same line
RE_ITEM_RANGE = re.compile(r"^\s*(\d{1,3})\s*[\u2013\u2014-]\s*(\d{1,3})\s*(\S.*)?$")
# bullet markers used by those blocks
RE_BULLET = re.compile(r"^\s*[\u2022\u00b7\u25cf\u25aa-]\s*(\S.*)$")
# a finished sentence inside a range block ends the current answer
RE_SENTENCE_END = re.compile(r"[.!?:]\s*$")

# The key repeats a title and a preamble at section boundaries. Landing in the
# middle of an item's answer, that text would otherwise be glued onto the value
# (unit 5's 5.1 #12 ended up as "She slept Key to Exercises In some of the ...").
RE_KEY_STOP = re.compile(
    r"^\s*(Key to (Exercises|Additional exercises|Study guide)"
    r"|In some of the exercises"
    r"|Example answers are given"
    r"|If possible, check your answers)",
    re.I,
)


# --------------------------------------------------------------------------- #
# text cleanup
# --------------------------------------------------------------------------- #
def clean_text(raw: str) -> str:
    """Normalize the extraction artefacts seen in these PDFs."""
    s = unicodedata.normalize("NFC", raw)
    # curly quotes -> straight (the sample and the answer data both use ')
    for src, dst in (("\u2018", "'"), ("\u2019", "'"), ("\u02bc", "'"),
                     ("\u201c", '"'), ("\u201d", '"')):
        s = s.replace(src, dst)
    s = s.replace("\u00ad", "")          # soft hyphen
    s = s.replace("\u2011", "-")         # non-breaking hyphen
    # repair the dropped ff / ft / fi / fl ligatures (see LIGATURE_PAIRS):
    # the two fragments were separated by whitespace, so just close the gap
    s = LIGATURE_RE.sub(lambda m: re.sub(r"\s+", "", m.group(0)), s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" ?\n ?", "\n", s)
    return s.strip()


def strip_page_furniture(page_text: str) -> str:
    """Drop watermarks and the trailing page number from one page's text."""
    lines = [ln for ln in page_text.splitlines() if not WATERMARKS.search(ln)]
    while lines and not lines[-1].strip():
        lines.pop()
    if lines and RE_PAGE_NUM.match(lines[-1]):
        lines.pop()
    # a repeated leading running head ("Key to Exercises")
    if lines and re.match(r"^\s*Key to (Exercises|Additional)", lines[0]):
        lines.pop(0)
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# answer key
# --------------------------------------------------------------------------- #
def parse_answer_key() -> dict[int, dict[str, dict[int, str]]]:
    """-> {unit: {exercise: {item_no: raw answer text}}}"""
    doc = fitz.open(ANSWER_KEY)
    units: dict[int, dict[str, dict[int, str]]] = {}

    cur_unit: int | None = None
    cur_ex: str | None = None
    cur_item: int | None = None
    last_key: tuple[int, str, int] | None = None

    # A few exercises label their answers as a range ("2-6") followed by a bullet
    # list or by one answer per line, instead of numbering every item. Those
    # blocks are walked here so the numbers are recovered.
    #
    # The declared upper bound is only a hint: unit 111.1 prints "10-12" above
    # four answers, so the block is consumed until the next heading rather than
    # cut at 12, which would split an answer mid-sentence.
    range_next: int | None = None
    range_bulleted = False

    def assign(u: int, e: str, n: int, value: str) -> None:
        nonlocal last_key
        units[u][e][n] = value.strip()
        last_key = (u, e, n)

    def append_to_last(value: str) -> None:
        if last_key is not None:
            u, e, i = last_key
            units[u][e][i] = (units[u][e][i] + " " + value.strip()).strip()

    def take_range_slot(u: int, e: str, value: str) -> bool:
        """Consume the next number in the active range."""
        nonlocal range_next
        if range_next is None:
            return False
        assign(u, e, range_next, value)
        range_next += 1
        return True

    for pno in range(doc.page_count):
        text = strip_page_furniture(doc[pno].get_text())
        for raw_line in text.splitlines():
            line = raw_line.rstrip()
            if not line.strip():
                continue

            m = RE_UNIT_HEAD.match(line)
            if m:
                cur_unit = int(m.group(1))
                units.setdefault(cur_unit, {})
                cur_ex, cur_item, last_key = None, None, None
                range_next = None
                continue

            m = RE_EXERCISE.match(line)
            if m and cur_unit is not None:
                cur_ex = f"{int(m.group(1))}.{int(m.group(2))}"
                units[cur_unit].setdefault(cur_ex, {})
                cur_item, last_key = None, None
                range_next = None
                continue

            m = RE_KEY_STOP.match(line)
            if m:
                # a section title / preamble: forget the current item so the
                # following prose is not appended to its answer
                cur_ex, cur_item, last_key = None, None, None
                range_next = None
                continue

            m = RE_ITEM_RANGE.match(line)
            if m and cur_unit is not None and cur_ex is not None:
                range_next = int(m.group(1))
                range_bulleted = False
                last_key = None
                inline = (m.group(3) or "").strip()
                if inline:
                    take_range_slot(cur_unit, cur_ex, inline)
                continue

            m = RE_ITEM.match(line)
            if m and cur_unit is not None and cur_ex is not None:
                cur_item = int(m.group(1))
                units[cur_unit][cur_ex][cur_item] = m.group(2).strip()
                last_key = (cur_unit, cur_ex, cur_item)
                range_next = None
                continue

            # inside a range block: bullets start items, everything else either
            # continues the current item (bulleted list) or is its own answer
            if cur_unit is not None and cur_ex is not None and \
                    range_next is not None:
                bullet = RE_BULLET.match(line)
                if bullet:
                    range_bulleted = True
                    take_range_slot(cur_unit, cur_ex, bullet.group(1))
                    continue
                if range_bulleted:
                    append_to_last(line)
                    continue
                # No bullets to delimit the answers, so a wrapped line is told
                # apart from a new answer by the previous line's ending: only a
                # sentence that finished starts the next item.
                prev = units[last_key[0]][last_key[1]][last_key[2]] if last_key else ""
                if last_key is None or RE_SENTENCE_END.search(prev):
                    if take_range_slot(cur_unit, cur_ex, line):
                        continue
                else:
                    append_to_last(line)
                    continue

            # continuation of the previous item (wrapped line, or "or" alternate)
            if last_key is not None:
                append_to_last(line)
                continue

            # anything else before the first item of a unit is a heading we ignore

    # The answer text comes straight off the page, so it still carries the book's
    # curly apostrophes (983 of them across the corpus) while every other field
    # is normalised. Run it through the same cleanup so a pack is internally
    # consistent and an author copying an answer gets the sample's straight
    # apostrophe without having to think about it.
    return {u: {e: {i: clean_text(v) for i, v in items.items()}
                for e, items in ex.items()}
            for u, ex in units.items()}


# --------------------------------------------------------------------------- #
# figures
# --------------------------------------------------------------------------- #
def _merge_overlapping(items: list[tuple[fitz.Rect, int]]
                       ) -> list[tuple[fitz.Rect, int]]:
    """Fuse boxes that substantially overlap -- they are one drawing.

    Some pages place one image on top of another, so the tile groups do not
    touch and clustering yields two boxes covering the same area (unit 13 had a
    21-tile group sitting inside a 103-tile one). Left alone they render as
    duplicated, half-missing figures.
    """
    items = list(items)
    merged = True
    while merged:
        merged = False
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, ta = items[i]
                b, tb = items[j]
                inter = a & b
                if inter.is_empty or inter.width <= 0 or inter.height <= 0:
                    continue
                smaller = min(a.width * a.height, b.width * b.height)
                if smaller <= 0:
                    continue
                if (inter.width * inter.height) / smaller >= OVERLAP_MERGE:
                    items[i] = (a | b, ta + tb)
                    items.pop(j)
                    merged = True
                    break
            if merged:
                break
    return items


def _cluster(rects: list[fitz.Rect]) -> list[list[int]]:
    """Union-find grouping of rects that touch once expanded by CLUSTER_GAP."""
    parent = list(range(len(rects)))

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    expanded = [fitz.Rect(r.x0 - CLUSTER_GAP, r.y0 - CLUSTER_GAP,
                          r.x1 + CLUSTER_GAP, r.y1 + CLUSTER_GAP) for r in rects]
    for a in range(len(rects)):
        for b in range(a + 1, len(rects)):
            if expanded[a].intersects(expanded[b]):
                union(a, b)

    groups: dict[int, list[int]] = {}
    for idx in range(len(rects)):
        groups.setdefault(find(idx), []).append(idx)
    return list(groups.values())


def _axis_seams(profile: np.ndarray, offset: float, span: float,
                total_px: int) -> list[float]:
    """Dividers along one axis, given a per-line colour-spread profile.

    A divider is a narrow run of lines whose colour barely varies along the
    perpendicular axis: the printed border between two pictures. Broad flat
    artwork (a sky, a road) is rejected by the width test.
    """
    uniform = profile < SEAM_STD
    runs: list[list[int]] = []
    for i in range(total_px):
        if not uniform[i]:
            continue
        if runs and i - runs[-1][1] <= 2:
            runs[-1][1] = i
        else:
            runs.append([i, i])

    scale = 72.0 / SEAM_ANALYSIS_DPI
    seams: list[float] = []
    for a, b in runs:
        if b - a + 1 > SEAM_MAX_PX:
            continue
        # never treat the strip's own outer frame as an interior divider
        if a <= 2 or b >= total_px - 3:
            continue
        seams.append(offset + (a + b + 1) / 2.0 * scale)

    edges = [offset] + seams + [offset + span]
    kept: list[float] = []
    for i in range(1, len(edges) - 1):
        if edges[i] - (kept[-1] if kept else offset) >= SEAM_MIN_SEGMENT and \
           offset + span - edges[i] >= SEAM_MIN_SEGMENT:
            kept.append(edges[i])
    return kept


def _evenly_spaced(values: list[float], tolerance: float = 0.35) -> bool:
    """True when all segments are about the same size.

    Pictures printed side by side in a strip are uniform. A split that produces
    wildly uneven segments means flat artwork was mistaken for a divider (unit 6
    sliced one panel into a 36pt sliver plus two halves), which is worse than
    not splitting at all.
    """
    if len(values) < 2:
        return True
    mean = sum(values) / len(values)
    if mean <= 0:
        return False
    return all(abs(v - mean) / mean <= tolerance for v in values)


def analyse_grid(page: "fitz.Page", box: fitz.Rect) -> tuple[list[float], list[float]]:
    """Interior dividers of a drawing block, as (x_seams, y_seams)."""
    if box.width < STRIP_MIN_WIDTH and box.height < STRIP_MIN_WIDTH:
        return [], []

    pix = page.get_pixmap(clip=box, dpi=SEAM_ANALYSIS_DPI)
    if pix.width < 12 or pix.height < 12:
        return [], []
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height, pix.width, pix.n
    )[:, :, :3].astype(np.int16)

    x_seams = _axis_seams(arr.std(axis=0).mean(axis=1), box.x0, box.width, pix.width)
    y_seams = _axis_seams(arr.std(axis=1).mean(axis=1), box.y0, box.height, pix.height)

    # a grid is at most SEAM_MAX_SEGMENTS cells on a side
    if len(x_seams) + 1 > SEAM_MAX_SEGMENTS:
        x_seams = []
    if len(y_seams) + 1 > SEAM_MAX_SEGMENTS:
        y_seams = []

    # reject uneven splits in either axis
    if x_seams:
        xs = [box.x0] + x_seams + [box.x1]
        if not _evenly_spaced([xs[i + 1] - xs[i] for i in range(len(xs) - 1)]):
            x_seams = []
    if y_seams:
        ys = [box.y0] + y_seams + [box.y1]
        if not _evenly_spaced([ys[i + 1] - ys[i] for i in range(len(ys) - 1)]):
            y_seams = []

    # Reject a split whose cells are not plausibly shaped like pictures.
    #
    # This is what separates a genuine row of pictures from one drawing that
    # happens to have a flat band across it: unit 5's Mozart illustration and
    # unit 118's house both split into long letterbox strips (aspect 2.9-3.5)
    # and are really single drawings, whereas unit 13's and unit 4's real
    # picture grids yield cells of about 2.6 or less. Note this only ever
    # rejects a *proposed* split -- a drawing with no dividers keeps whatever
    # shape it has, so genuinely wide single pictures are never affected.
    xs = [box.x0] + x_seams + [box.x1]
    ys = [box.y0] + y_seams + [box.y1]
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            w = xs[i + 1] - xs[i]
            h = ys[j + 1] - ys[j]
            if h <= 0 or w <= 0:
                return [], []
            aspect = w / h
            if not (MIN_CELL_ASPECT <= aspect <= MAX_CELL_ASPECT):
                return [], []

    return x_seams, y_seams


def _adopt_vector_art(cell: fitz.Rect, drawings: list[dict],
                      page_area: float) -> fitz.Rect:
    """Grow a picture cell to cover speech bubbles drawn over it.

    The book draws a picture's speech bubble as vector art while the picture
    itself is a raster tile group, and the two only partly overlap. Clipping to
    the raster alone slices the bubble mid-word (unit 4's exercise 4.2 showed
    "...ny today)" and "(I / thi"), so any bubble substantially sitting on the
    cell is pulled into it.
    """
    grown = fitz.Rect(cell)
    for drawing in drawings:
        r = drawing["rect"]
        area = r.width * r.height
        if area <= 0 or area > 0.4 * page_area:
            continue                       # a page background, not a bubble
        if r.width < 8 or r.height < 8:
            continue                       # a rule or a tick
        inter = cell & r
        if inter.is_empty or inter.width <= 0 or inter.height <= 0:
            continue
        if (inter.width * inter.height) / area < 0.25:
            continue                       # mostly outside this cell
        grown = grown | r
    # never let a stray shape drag the crop across the page
    if grown.width > cell.width + VECTOR_ADOPT_LIMIT or \
       grown.height > cell.height + VECTOR_ADOPT_LIMIT:
        return cell
    return grown


def _save_segment(page: "fitz.Page", clip: fitz.Rect, out_dir: pathlib.Path,
                  unit: int, n: int, tiles: int, pno: int,
                  figures: list[dict]) -> None:
    clip = clip & page.rect
    if clip.width < 8 or clip.height < 8:
        return
    pix = page.get_pixmap(clip=clip, dpi=RENDER_DPI)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"fig-{n:02d}.png"
    pix.save(out_dir / name)
    figures.append({
        "file": f"assets/unit-{unit:03d}/{name}",
        "page": pno + 1,
        "tiles": tiles,
        "bbox": [round(v, 1) for v in (clip.x0, clip.y0, clip.x1, clip.y1)],
        "width": pix.width,
        "height": pix.height,
        "bytes": (out_dir / name).stat().st_size,
    })


def extract_figures(doc: "fitz.Document", unit: int, warnings: list[str]) -> list[dict]:
    """Render each drawing in the unit to public/murphy/assets/unit-NNN/.

    Figures come out in reading order (page, then top-to-bottom, left-to-right)
    so that a picture exercise's figures line up with its numbered items.
    """
    out_dir = ASSETS / f"unit-{unit:03d}"
    figures: list[dict] = []

    # collect every drawing first so the whole unit can be ordered globally
    found: list[tuple[int, float, float, fitz.Rect, int]] = []
    for pno in range(doc.page_count):
        page = doc[pno]
        # hairline tiles are rules and dividers, never artwork
        rects = [r for r in (fitz.Rect(i["bbox"])
                             for i in page.get_image_info(xrefs=True))
                 if r.width > HAIRLINE and r.height > HAIRLINE]
        if not rects:
            continue

        candidates: list[tuple[fitz.Rect, int]] = []
        for group in _cluster(rects):
            members = [rects[i] for i in group]
            box = members[0]
            for r in members[1:]:
                box = box | r
            if box.width < MIN_SIDE or box.height < MIN_SIDE:
                continue
            if box.width * box.height < MIN_AREA:
                continue
            candidates.append((box, len(members)))

        # two tile groups can describe the same drawing
        for box, tiles in _merge_overlapping(candidates):
            found.append((pno, box.y0, box.x0, box, tiles))

    # Reading order: page, then visual row (top to bottom), then left to right.
    # Row grouping needs a tolerance because drawings on the same row differ
    # slightly in their top edge.
    found.sort(key=lambda t: (t[0], round(t[1], 1), round(t[2], 1)))
    ordered: list[tuple[int, float, float, fitz.Rect, int]] = []
    row: list[tuple[int, float, float, fitz.Rect, int]] = []
    for item in found:
        if row and item[0] == row[0][0] and abs(item[1] - row[0][1]) <= ROW_TOL:
            row.append(item)
        else:
            if row:
                ordered.extend(sorted(row, key=lambda t: t[2]))
            row = [item]
    if row:
        ordered.extend(sorted(row, key=lambda t: t[2]))

    for pno, _, _, box, tile_count in ordered:
        page = doc[pno]
        x_seams, y_seams = analyse_grid(page, box)
        page_area = page.rect.width * page.rect.height
        drawings = page.get_drawings()

        if x_seams or y_seams:
            # Cut exactly on the dividers. Horizontal padding would pull in the
            # neighbouring picture, so the cells are inset vertically only.
            xs = [box.x0] + x_seams + [box.x1]
            ys = [box.y0] + y_seams + [box.y1]
            for j in range(len(ys) - 1):
                for i in range(len(xs) - 1):
                    top = ys[j] - (PADDING if j == 0 else 0)
                    bottom = ys[j + 1] + (PADDING if j == len(ys) - 2 else 0)
                    seg = fitz.Rect(xs[i], top, xs[i + 1], bottom)
                    seg = _adopt_vector_art(seg, drawings, page_area)
                    _save_segment(page, seg, out_dir, unit, len(figures) + 1,
                                  tile_count, pno, figures)
        else:
            clip = fitz.Rect(box.x0 - PADDING, box.y0 - PADDING,
                             box.x1 + PADDING, box.y1 + PADDING)
            clip = _adopt_vector_art(clip, drawings, page_area)
            _save_segment(page, clip, out_dir, unit, len(figures) + 1,
                          tile_count, pno, figures)

    if len(figures) > 20:
        warnings.append(f"{len(figures)} figures detected (unusually many; review)")
    return figures


# --------------------------------------------------------------------------- #
# unit discovery
# --------------------------------------------------------------------------- #
def discover_units() -> dict[int, dict]:
    found: dict[int, dict] = {}
    for folder in sorted(BASE.iterdir()):
        if not folder.is_dir():
            continue
        for pdf in sorted(folder.iterdir()):
            if pdf.suffix.lower() != ".pdf":
                continue
            m = RE_UNIT_FILE.match(pdf.stem)
            if not m:
                continue
            num = int(m.group(1))
            if num in found:
                raise SystemExit(f"duplicate unit {num}: {pdf} and {found[num]['source']}")
            found[num] = {
                "unit": num,
                "title": m.group(2).strip(),
                "section_folder": folder.name,
                "source": str(pdf),
            }
    if not found:
        raise SystemExit(f"no numbered unit PDFs found under {BASE}")
    return found


def section_label(folder: str) -> str:
    """'02_Tenses_Basics_Units_1-18' -> 'Tenses Basics (Units 1-18)'"""
    s = re.sub(r"^\d+_", "", folder).replace("_", " ")
    s = re.sub(r"\s*Units\s+", " (Units ", s, flags=re.I)
    if "(Units" in s and not s.endswith(")"):
        s += ")"
    return s


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main(argv: list[str]) -> int:
    units = discover_units()
    key = parse_answer_key()

    if "--report" in argv:
        report(units, key)
        return 0

    wanted = [int(a) for a in argv if a.isdigit()]
    targets = sorted(wanted) if wanted else sorted(units)
    PACKS.mkdir(parents=True, exist_ok=True)

    total_figs = 0
    total_bytes = 0
    problems: list[str] = []

    for num in targets:
        if num not in units:
            problems.append(f"unit {num}: no source PDF")
            continue
        meta = units[num]
        warnings: list[str] = []

        doc = fitz.open(meta["source"])
        if doc.page_count != 2:
            warnings.append(f"expected 2 pages, found {doc.page_count}")

        theory = clean_text(strip_page_furniture(doc[0].get_text()))
        exercise = clean_text(
            strip_page_furniture(doc[1].get_text()) if doc.page_count > 1 else ""
        )
        figures = extract_figures(doc, num, warnings)
        doc.close()

        answers = key.get(num, {})
        if not answers:
            warnings.append("no answer-key section found")

        pack = {
            "unit": num,
            "title": meta["title"],
            "section": section_label(meta["section_folder"]),
            "section_folder": meta["section_folder"],
            "source": meta["source"],
            "theory_text": theory,
            "exercise_text": exercise,
            "answer_key": {e: {str(k): v for k, v in sorted(items.items())}
                           for e, items in sorted(answers.items())},
            "figures": figures,
            "warnings": warnings,
        }
        (PACKS / f"unit-{num:03d}.json").write_text(
            json.dumps(pack, ensure_ascii=False, indent=1), encoding="utf-8"
        )

        total_figs += len(figures)
        total_bytes += sum(f["bytes"] for f in figures)
        print(f"unit {num:>3}  theory={len(theory):>5}  ex={len(exercise):>5}  "
              f"figs={len(figures):>3}  key_ex={len(answers)}"
              + (f"  WARN: {'; '.join(warnings)}" if warnings else ""))

    print(f"\n{len(targets)} pack(s) -> {PACKS}")
    print(f"figures: {total_figs}  ({total_bytes / 1e6:.1f} MB)")
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  " + p)
        return 1
    return 0


def report(units: dict[int, dict], key: dict) -> None:
    no_figs, no_key = [], []
    for num in sorted(units):
        if num not in key or not key[num]:
            no_key.append(num)
    print(f"units discovered: {len(units)}")
    print(f"units with answers: {len(key)}")
    if no_key:
        print(f"WITHOUT answer section ({len(no_key)}): {no_key}")
    for num in (1, 2, 145):
        if num in key:
            print(f"\n--- unit {num} answers ---")
            print(json.dumps({e: {str(k): v for k, v in sorted(i.items())}
                              for e, i in sorted(key[num].items())},
                             ensure_ascii=False, indent=1)[:1200])
    if no_figs:
        print(no_figs)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
