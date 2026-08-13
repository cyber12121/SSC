# Plan: Review screen "Test Mode" (hide correct answers, browse + reattempt)

## Context
The user wants the persistent `ReviewView` (`src/components/Review.tsx`) to support a **test-mode** view
that mimics a blank test booklet: the correct/wrong answers and solutions are **hidden**, and the only
action available (besides browsing the questions) is **Reattempt**. This prevents a user from seeing the
correct answers while reviewing. They also asked to make the review screen "full" — it already renders in
a full-width `<main>` for `view==='review'` (App.tsx:634), so no layout change is required for that.

Behavior confirmed with user:
- Test mode ON → hide all correctness/solutions but let the user **browse** questions (Previous / Next /
  palette) and show **only the Reattempt button** (Back is hidden/replaced while in test mode).
- Applies to **both mock and practice** reviews (do not gate on `result.mode`).

## Current behavior
- `ReviewView` always renders `QuestionCard` with `showSolution={true}` → green/red option coloring, check/
  cross icons, and the solution block are shown.
- Palette colors each item correct/wrong/skipped via `getStatus(d.selectedAnswer, d.isCorrect)`.
- Header + action bar both expose **Reattempt** and **Back to Dashboard** buttons.

## Design
Add a `testMode` toggle (local `useState(false)`) to `ReviewView`:
- When `testMode` is false → works exactly as today (full solutions + Reattempt + Back).
- When `testMode` is true → "browse + reattempt" experience:
  - `QuestionCard` rendered with `showSolution={false}` so no green/red highlighting, no check/cross,
    no solution block. The user's previously selected answer is still shown as selected (radio filled)
    but NOT marked right/wrong — `QuestionCard` already only colors when `showSolution` is true, so
    passing `showSolution={false}` achieves the hidden-correctness behavior for free.
  - Palette rendered **grayscale** (all items same neutral color, no correct/wrong/skipped differentiation).
  - Header shows a single **Reattempt** button; **Back** is hidden while in test mode (so the user cannot
    leave to a screen that reveals answers by accident — keep Back reachable by toggling test mode off,
    or show a small "Exit test mode" control). Simplest robust option: header keeps **Reattempt** +
    **Exit Test Mode** (turns testMode off, restoring Back). Action bar likewise shows Previous/Next +
    **Reattempt** only (no Back) when testMode is on.
  - A clear toggle control (e.g. a "Test Mode" switch/button in the header or palette) lets the user enter
    and exit test mode.

## Tasks (only `src/components/Review.tsx`)
1. Add `const [testMode, setTestMode] = useState(false);` inside `ReviewView`.
2. Compute `showSolution = !testMode;` and pass `showSolution={showSolution}` to `QuestionCard` (replace
   the hardcoded `showSolution={true}`).
3. Palette: when `testMode`, render every item with the neutral `bg-gray-200 text-gray-700` style
   (ignore `getStatus` correctness), keeping the active `ring-2 ring-blue-400` and `d.marked` ring so the
   user can still navigate. When not testMode, keep existing colored palette.
4. Header: add a "Test Mode" toggle button. When `testMode`:
   - show **Reattempt** (calls `onReattempt`) and an **Exit Test Mode** button (sets `setTestMode(false)`);
     hide the regular **Back to Dashboard** button.
   - When not testMode: show existing **Reattempt** + **Back to Dashboard** as today.
5. Action bar (bottom): when `testMode`, replace the "Back to Dashboard" button with a **Reattempt** button
   (`onReattempt`); keep Previous/Next. When not testMode, keep existing layout.
6. No changes needed in `App.tsx` — `onReattempt` / `onBack` already wired; ReviewView is already full-width.
   No `result.mode` gating (applies to mock + practice). Practice mode still never *opens* review (existing
   rule preserved upstream in `App`/`QuizContainer`).

## Files
- `src/components/Review.tsx` — the entire change. No other files touched.

## Validation
- `tsc --noEmit` passes.
- Mock or practice attempt → open review → toggle **Test Mode**:
  - options show no green/red, no check/cross, no solution block;
  - palette is all gray;
  - only Reattempt (+ Exit Test Mode) visible; Back hidden.
- Toggle **Exit Test Mode** → solutions, colored palette, and Back return.
- Previous / Next / palette navigation works in both modes.
- Reattempt from test mode restarts the quiz (same as today).
- Standard (non-test) review behavior unchanged for both mock and practice.

## Open questions
None — both key decisions confirmed by user.
