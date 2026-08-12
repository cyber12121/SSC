# Quiz: Mock-only Review + Test-style Review Window

## Goal
Refine the just-added **Review** feature so that:
1. **Mock-only** — Review is available only for quizzes attempted in **Mock** mode. In Practice mode there is no Review (neither the persistent buttons nor the post-submit "Review Questions" button).
2. **Test-style window** — The Review screen shows one question at a time in the same two-pane layout as the real quiz (question panel + question palette with correct/incorrect/skipped colors and jump-to-question navigation), instead of the current stacked "all questions one-by-one" list.

## Verified context
- `QuizResult` (types.ts:47-57) currently has no `mode` field. `QuizContainer` builds the saved result (QuizContainer.tsx:~206-220) from props `chapter, category, mode` but does **not** write `mode` into the object.
- Persistent Review currently: `Review.tsx` renders a vertical stack of every `QuestionCard` (showSolution) — this is the "one-by-one" list to replace.
- Entry points to gate: Home chapter cards (App.tsx:~871), Dashboard rows (App.tsx:~1299), in-quiz summary "Review Questions" (QuizContainer.tsx:~253-259). All use `mode`/latest result.
- `latestResultByChapter` (App.tsx:~187) maps `subject|chapter_title|category` → newest `QuizResult`.

## Changes

### 1. Store `mode` on the result
- `types.ts` `QuizResult`: add `mode?: 'practice' | 'mock'` (optional for legacy docs).
- `QuizContainer.tsx` results object: add `mode,` so saved results record which mode was used.

### 2. Gate Review to Mock mode only
- **In-quiz summary** (QuizContainer.tsx "Review Questions" button): render it only when `mode === 'mock'`. In Practice, the summary shows only **Reattempt** + **Back to Dashboard**.
- **Home card** (App.tsx): the Review button currently shows when `latestResultByChapter.has(key)`. Change to also require `latestResultByChapter.get(key)?.mode === 'mock'`.
- **Dashboard row** (App.tsx): the Review button shows only when `result.mode === 'mock'` (use optional chaining for legacy results without `mode`).

### 3. Replace stacked list with a test-style Review window
Rewrite `src/components/Review.tsx` into a read-only, test-like review:
- Props unchanged: `result: QuizResult`, `onReattempt`, `onBack`.
- Derive `items = result.questionDetails` (each has `question`, `selectedAnswer`, `isCorrect`, `timeSpent`, `q_num`). Guard per item: if `!item.question`, render a minimal "Question data unavailable" fallback card instead of `QuestionCard`.
- Layout mirrors `QuizContainer`'s review mode:
  - Outer: `flex flex-col lg:flex-row h-[calc(100vh-80px)] bg-gray-100`.
  - **Header** (slate-700): `Review: {result.chapter_title}` on the left; on the right a **Back to Dashboard** button (`onBack`) and a **Reattempt** button (`onReattempt`).
  - **Left column** (question area): a single `QuestionCard` for `items[currentIdx].question` with `showSolution={true}`, `selectedAnswer={items[currentIdx].selectedAnswer || null}`, `onAnswer={() => {}}`, `isAdmin={false}`, `timeSpentSeconds={items[currentIdx].timeSpent}`. Below it, **Previous / Next** buttons (disabled at ends) to navigate `currentIdx`.
  - **Right column** (palette): a legend (Correct / Incorrect / Skipped) and a `grid grid-cols-4` of numbered buttons. Color each by status: correct → green, incorrect (`selectedAnswer && !isCorrect`) → red, skipped (`!selectedAnswer`) → gray; active question gets a ring. Clicking jumps to that question (`setCurrentIdx`).
- Keep it fully read-only (no answer submission, no timer, no auto-advance).

> Alternative considered: reuse `QuizContainer` in a forced review mode by passing the saved result's answers. Rejected — it would require threading saved answers into `QuizContainer`'s live state and risks changing quiz behavior. A dedicated read-only component is lower-risk.

## Edge cases
- Legacy `results` docs without `mode`: treated as `undefined` → Review hidden (safe; only mock shows Review). Once new attempts save `mode`, Mock attempts gain Review.
- Practice attempts: no Review anywhere (per user). Results are still saved for Dashboard history; only the Review affordance is suppressed.
- Saved attempt whose source question was later edited/deleted: review uses the stored `question` snapshot, so it stays valid; palette/colors derive from `selectedAnswer`/`isCorrect` stored in the result.
- Virtual/bookmark ("All X", "Bookmarked: …") mock attempts: Review works (full `question` stored); Reattempt stays disabled (chapter not reconstructable) — unchanged.
- `npm run lint` must stay green after adding `mode` and removing the stacked-list code path.

## Files touched
- `src/types.ts` — `QuizResult` add `mode?: 'practice' | 'mock'`.
- `src/components/QuizContainer.tsx` — add `mode` to saved result; conditionally render in-quiz "Review Questions" only when `mode === 'mock'`.
- `src/App.tsx` — gate Home-card and Dashboard-row Review buttons on `mode === 'mock'`.
- `src/components/Review.tsx` — rewrite as test-style two-pane review (question + palette navigation).

## Validation
- `npm run lint` (tsc --noEmit) passes.
- `npm run build` succeeds.
- Manual (`npm run dev` + authorized Google login):
  1. Take a **Mock** quiz, submit → summary shows **Review Questions**; clicking it opens the test-style window (one question + palette, correct/incorrect/skipped colors, jump/nav, solutions shown). Leaving and returning (Home card / Dashboard row) still shows **Review** for that mock attempt.
  2. Take a **Practice** quiz, submit → summary has **no** Review Questions button (only Reattempt + Back). Home/Dashboard show **no** Review button for that practice attempt.
  3. Reattempt from Review restarts the quiz; completing again updates the last attempt Review shows.
