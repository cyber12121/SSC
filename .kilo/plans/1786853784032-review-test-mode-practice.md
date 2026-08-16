# Plan: Review "Test Mode" → re-answer with instant solution (practice-style)

## Context
The Review screen currently has a **Test Mode** toggle (`src/components/Review.tsx:22`) that only hides
answers and lets the user *browse* a blank booklet (interaction disabled via `onAnswer={() => {}}`).
The user wants Test Mode to instead behave like the live **Practice mode**: when turned on, the user can
**re-answer each question** and the **solution is revealed immediately after answering** (green/red + solution block),
with the user's new selections tracked separately from the saved attempt.

`QuestionCard` already supports this natively: with `showSolution={false}` the radio is enabled and calls
`onAnswer`; with `showSolution={true}` it locks and shows correctness + solution (see `QuestionCard.tsx:138-195`).
So no changes are needed outside `Review.tsx`.

## Behavior
- **Test Mode OFF** (unchanged): full review — `showSolution` always true, `selectedAnswer` is the saved attempt's
  answer, palette colored by `d.isCorrect`/`d.selectedAnswer`, Back + Reattempt visible.
- **Test Mode ON**:
  - Track fresh answers in a new `testAnswers` state keyed by question index (separate from `result.questionDetails`).
  - `QuestionCard` is interactive: `onAnswer` records into `testAnswers`; `selectedAnswer` = `testAnswers[currentIdx] ?? null`
    (starts blank, NOT pre-filled with the old attempt).
  - `showSolution` = `!!testAnswers[currentIdx]` → solution + correctness appears only after the user answers
    (identical to practice mode).
  - Palette: answered questions colored green/red by the new answer vs `d.question.answer`; unanswered stay neutral gray.
  - Hide the old attempt's "Time Taken" badge while in test mode (`timeSpentSeconds={testMode ? undefined : current.timeSpent}`).
  - Header/action bar keep existing test-mode layout (Reattempt + Exit Test Mode; Back hidden). Exit Test Mode restores
    the full review.

## Tasks (`src/components/Review.tsx` only)
1. Add state: `const [testAnswers, setTestAnswers] = useState<Record<number, string>>({});`
2. Add handler: `const handleTestAnswer = (ans: 'a' | 'b' | 'c' | 'd') => setTestAnswers(prev => ({ ...prev, [currentIdx]: ans }));`
3. Replace `const showSolution = !testMode;` with:
   - `const selectedAnswer = testMode ? (testAnswers[currentIdx] ?? null) : (current.selectedAnswer || null);`
   - `const showSolution = testMode ? !!testAnswers[currentIdx] : true;`
4. On the Test Mode toggle button, reset answers when toggling:
   `onClick={() => { setTestMode(t => !t); setTestAnswers({}); }}`
5. Pass to `QuestionCard`:
   - `onAnswer={testMode ? handleTestAnswer : () => {}}`
   - `selectedAnswer={selectedAnswer}`
   - `showSolution={showSolution}`
   - `timeSpentSeconds={testMode ? undefined : current.timeSpent}`
6. Palette mapping: when `testMode`, compute per-item status from `testAnswers[idx]` vs `d.question.answer`
   (green/red shapes like the existing correct/wrong branches); when not `testMode`, keep the existing
   `getStatus(d.selectedAnswer, d.isCorrect)` coloring. Keep the `isActive` and `d.marked` rings.

## Files
- `src/components/Review.tsx` — entire change. No other files touched. No new props/interface changes.

## Validation
- `npx tsc --noEmit` passes.
- Open a mock (or practice) review → toggle **Test Mode**:
  - options are clickable; after selecting one, the chosen option is locked, correct/wrong highlighting appears,
    and the Solution block shows (instant feedback, practice-style).
  - changing questions and returning preserves the new answer for that index.
  - palette shows green/red for answered items, gray for unanswered.
  - "Time Taken" badge (old attempt) is hidden.
- Toggle **Exit Test Mode** → returns to full review (saved attempt answers + always-visible solutions + Back).
- Non-test review behavior unchanged (mock and practice).
- Reattempt still restarts the quiz as before.

## Open questions
None.
