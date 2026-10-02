# Murphy unit page — content generation brief

You are producing **one** file: `tools/murphy/content/unit-NNN.html`.

That file is a **fragment**, not a full page. It is inserted into a shared shell by
`tools/murphy/assemble.py`. It must contain exactly two top-level blocks, in this
order, and nothing else — no `<!DOCTYPE>`, no `<html>`, no `<head>`, no `<style>`,
no `<script>`:

```html
<header class="hero">
  ...
</header>

<main>
  ...
</main>
```

## Hard constraints — read before you start

- **Write exactly one file:** `tools/murphy/content/unit-NNN.html`. Nothing else.
- **Do not run** `assemble.py`, `build_index.py`, `validate.py`, `build.py` or
  `extract_pack.py`. The parent runs those once for the whole batch. Running them
  concurrently rewrites shared outputs (`public/murphy/*.html`,
  `validate-report.json`) and corrupts other units' results as well as yours.
- **Do not modify or reformat** anything under `packs/`, `shell/`, `reference/` or
  `public/`. The packs are already text-clean; do not "fix" them.
- **Do not create scratch, probe or temp files anywhere in the repository.** If you
  need to experiment, write to the system temp directory and clean up after
  yourself.
- If you believe something upstream is wrong, **report it in your reply** — do not
  patch it yourself.

## Inputs

1. `tools/murphy/packs/unit-NNN.json` — everything about this unit:
   - `unit` (number), `title` (e.g. `Present simple (I do)`), `section` (chapter name)
   - `theory_text` — page 1 of the book: the A/B/C/D… teaching points
   - `exercise_text` — page 2 of the book: the numbered exercises
   - `answer_key` — `{"2.1": {"2": "go", "3": "causes", ...}, ...}`, keyed by
     exercise number then item number
   - `figures` — `[{file, page, bbox, width, height}, ...]` in reading order
2. `tools/murphy/content/unit-002.html` — **the style exemplar. Read it fully
   before writing.** Match its structure, tone, density and markup habits.
3. `tools/murphy/shell/head.html` — the stylesheet. Every `class` you use must be
   one that appears in it. Never invent a class.

## Required structure

```html
<header class="hero">
  <span class="unit-badge">Unit N</span>
  <h1>Main Title<span class="sub">the parenthetical part</span></h1>
  <p class="lede">One or two sentences on what this unit teaches.</p>
</header>

<main>
  <section>
    <h2>Learning Objectives</h2>
    <ul class="objectives">
      <li>...</li>   <!-- 4-6 items derived from the theory -->
    </ul>
  </section>

  <section id="theory">      <h2>Part A — Theory</h2>      ... </section>
  <section id="exercises">   <h2>Part B — Exercises</h2>   ... </section>
  <section id="answers">     <h2>Answer Key</h2>           ... </section>
  <section id="summary">     <h2>Summary</h2>              ... </section>
</main>
```

All four `id`s are required, in that order.

Split `title` for the `h1`: `Present continuous (I am doing)` becomes
`<h1>Present Continuous<span class="sub">I am doing</span></h1>`.

## Class vocabulary (the only classes you may use)

- Layout: `hero`, `unit-badge`, `sub`, `lede`, `objectives`, `card`, `exercise`,
  `exercise-header`, `ex-number`, `ex-title`, `ex-instruction`, `ex-list`,
  `btn-row`, `feedback`, `check-btn`, `show-btn`, `reset-btn`
- Grammar boxes: `example-box`, `label`, `conj-table`, `summary-table`,
  `verb-bank`, `verb-chip`
- Inline: `highlight` (the target form), `wrong-note` (italic grey `(not …)`)
- Pictures: `pic-grid`, `pic-card`, `pic-img`, `theory-fig`, `pic-text`,
  `pic-num` (see the pictures rule)
- Matching: `match-grid`, `match-col`, `match-row`, `match-num`, `match-letter`,
  `match-select`
- Answer key: `reveal`, `reveal-content`
- Index only: `chapter-list` — **do not use in unit pages**

Inline `style="min-width:...px;"` on an `<input>` is allowed and encouraged so a
gap is wide enough for its answer. The `<code style="…">` formula chip pattern is
used exactly as in the exemplar.

## Theory section

Reproduce the book's teaching points faithfully, in the book's order, one `h3`
per point, using the boxes above:

- Prose → `<p>`; a set of examples → `<div class="card">` with `<p>` per example.
- Mark the target form with `<span class="highlight">`, and the book's `(not …)`
  corrections with `<span class="wrong-note">(not …)</span>`.
- Verg paradigms and "we say" contrasts → `<table class="conj-table">`.
- Word/verb lists the book sets out in a row → `<div class="verb-bank">` of
  `<span class="verb-chip">`.
- A key rule worth memorising → `<div class="example-box">` with
  `<span class="label">Remember</span>`.
- Finish with the cross-reference line the book prints, e.g.
  `<p>Present simple and present continuous ➜ Units 3–4</p>`.

## Exercise section

One `<div class="exercise" data-ex="N.M">` per exercise in `answer_key`, in
order. `data-ex` must match the key exactly. Each exercise is:

```html
<div class="exercise" data-ex="2.1">
  <div class="exercise-header">
    <span class="ex-number">2.1</span>
    <p class="ex-title">The book's instruction line</p>
  </div>
  <div class="verb-bank"><!-- only if the book gives a word box --></div>
  <ol class="ex-list">
    <li>Sentence … <input class="fill-input" data-answer="…" placeholder="…" style="min-width:140px;"> … rest.</li>
  </ol>
  <div class="btn-row">
    <button class="check-btn" onclick="checkExercise(this)">Check answers</button>
    <button class="show-btn" onclick="showAnswers(this)">Show answers</button>
    <button class="reset-btn" onclick="resetExercise(this)">Reset</button>
  </div>
  <div class="feedback"></div>
</div>
```

Pick the shape that fits the exercise:

| The book shows | Use |
|---|---|
| Gapped sentences | `ol.ex-list` with `.fill-input` |
| Numbered pictures to describe | `.pic-grid` of `.pic-card` |
| Two columns to link with letters | `.match-grid` of two `.match-col` |
| A table to complete | `.conj-table` with `.fill-input` in the cells |

### Answers — the rules that matter most

- **`data-answer` uses `|` between accepted variants. Never `/`.** The validator
  fails the page otherwise. The answer key's `/` means "either is correct":
  `He's tying / He is tying` → `data-answer="He's tying|He is tying"`.
- **Add contraction and full-form variants** even when the key lists only one, and
  likewise for negatives: `doesn't drink` → `doesn't drink|does not drink`. The
  page's own checker already ignores case and expands contractions, so prefer the
  book's exact wording first, then add the obvious equivalent forms.
- **Worked examples** — items the book already fills in — are the item numbers
  **missing** from `answer_key` for that exercise (e.g. if 2.1 starts at `"2"`,
  item 1 is given). Render those as prefilled, read-only:

  ```html
  <input class="fill-input" data-answer="speaks" value="speaks" readonly>
  ```

  `Reset` restores exactly these values, so they must be the book's printed answer.
- Where the key gives an answer spanning two gaps (`"takes … does it take"`), use
  two inputs sharing the same item.
- Keep the book's own gap prompts (e.g. `(the banks / close)`) as the input's
  `placeholder`, in parentheses, exactly as the book prints them.
- Add `<p class="ex-instruction">` only when there is something genuinely useful
  to say (e.g. that both contractions and full forms are accepted).

### Pictures

`figures` is in reading order: page order, then top-to-bottom, then left-to-right.
Figures on **page 1** illustrate the theory. Figures on **page 2** belong to the
exercises, and when a picture exercise has *N* items and *N* page-2 figures, item
*i* uses figure *i*.

A figure is usually **one** picture, but it can be a **multi-panel strip** — two or
more pictures printed side by side and rendered as a single image (and, just as
often, one picture rendered as a single image that happens to be wide). You cannot
tell which from the metadata, so **look at the image with the read tool before
deciding**. If a figure clearly contains several pictures, show it once at full
width and list the numbered sentences beneath it — never try to split, crop or
slice the artwork yourself.

In a `.pic-card`, use the real drawing and **omit `.pic-num`** — the picture's
number is already printed inside the rendered image:

```html
<div class="pic-card">
  <img class="pic-img" src="assets/unit-NNN/fig-03.png" alt="A woman taking a picture">
  <p class="pic-text">She's <input class="fill-input" data-answer="taking" value="taking" readonly> a picture.</p>
</div>
```

For a theory illustration use `<img class="pic-img theory-fig" src="…" alt="…">`
inside the relevant `.card`, with a short description in `alt`. `src` is always
relative — `assets/unit-NNN/fig-NN.png`, never a leading `/`.

Always write a real, specific `alt` describing what the picture shows.

If a unit has no figures, do not use `.pic-*` at all. If a `.pic-card` has no
usable drawing, leave it out rather than inventing one.

## Answer key section

One collapsible block per exercise, in the same order, with the **same count** as
the exercises (the validator checks this):

```html
<details class="reveal">
  <summary>Exercise 2.1 — Complete the sentences</summary>
  <div class="reveal-content">
    <ol>
      <li>Tanya <strong>speaks</strong> German very well.</li>
    </ol>
  </div>
</details>
```

Include every item, including the ones given as examples, and show variants as
`<strong>doesn't drink</strong> / <strong>does not drink</strong>`.

## Summary section

A `.summary-table` with `Use` / `Example` columns, one row per teaching point,
`<em>` around the target form exactly as in the exemplar.

## Text rules

- Copy the book's English **verbatim**. Do not paraphrase, modernise or shorten it.
- Text is extracted from a PDF, so fix obvious extraction damage (stray single
  letters on their own line, words broken across lines) but **never invent content
  that is not in the source**.
- Use **straight ASCII apostrophes** — the character `'` (U+0027). The approved
  sample contains 419 of them and not a single curly one, so match that: write
  `I'm`, `doesn't`, `the book's`, never `I’m`. The page's answer checker treats
  both the same, so this is purely about the pages being internally consistent.
- Use `…`, `–` and `—` as the book does, and escape `&` as `&amp;` and `<` as
  `&lt;` in prose.

## Before you finish

- Every `class` you used appears in `shell/head.html`.
- Every `data-answer` is non-empty and contains no `/`.
- Every `.exercise` has `data-ex`, the three buttons and a `.feedback`.
- Exercise numbers match `answer_key` exactly, and the number of `<details>`
  blocks equals the number of exercises.
- Every `<img src>` points at a file listed in `figures`.
- The file starts with `<header class="hero">` and ends with `</main>`.
