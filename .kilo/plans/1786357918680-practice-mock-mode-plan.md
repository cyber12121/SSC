# Plan: Add Practice Mode and Mock Mode (global setting)

## Goal
Introduce a global **Practice / Mock** toggle that changes quiz behavior. This is independent of the existing Chapter Bank / Mock Errors category toggle and the existing per-question countdown timer.

- **Practice Mode** (default): Click a question's answer → solution appears immediately. No per-question time limit, but the time spent on each question is tracked and displayed live.
- **Mock Mode**: Answer like a test (tick options). Solutions and correct/wrong marking are hidden until the quiz is submitted. A total time spent is tracked per question and shown only after submit (in review/summary).

## Decisions (confirmed with user)
- Mode is a **global setting** in the top nav (persists for the session via state; optional localStorage).
- Mock mode: select options, no solution until final submit/review.
- Existing Mock Errors category + 36s/45s countdown timer are **kept untouched** — mode is a separate behavior layer.
- Practice mode tracks **and displays** a live per-question timer (no limit).

## Where behavior lives today
- `src/App.tsx`: owns `view`, `category`, renders `QuizContainer` (lines ~898-914). Passes `category` to `QuizContainer`.
- `src/components/QuizContainer.tsx`: controls timer, answers, solution visibility (`isShowSolution = !!answers[currentIdx]` at line 256), review mode, submit, summary.
- `src/components/QuestionCard.tsx`: renders options + solution block (`showSolution` prop).

## Implementation steps

### 1. Add global mode state in `App.tsx`
- Add `const [quizMode, setQuizMode] = useState<'practice' | 'mock'>('practice')`.
- (Optional) init from `localStorage` and persist on change.
- Add a Practice/Mock toggle button in the `<nav>` (near the Dashboard/Heatmap items), styled similar to existing toggle (e.g. `bg-slate-100 p-1.5 rounded-2xl` segmented control). Active = white pill.

### 2. Pass `mode` prop into `QuizContainer`
- Update `QuizContainerProps` to add `mode: 'practice' | 'mock'`.
- Pass `mode={quizMode}` at the `<QuizContainer ...>` call in App.tsx.

### 3. Update `QuizContainer.tsx` behavior based on `mode`
- **Per-question time tracking (both modes):**
  - Current `currentTimer`/`startTimeRef` logic already tracks per-question time. Ensure it runs in BOTH modes (it currently only increments when `!answers[currentIdx]`; keep that, it works for both).
  - In **Practice** mode, display this live per-question timer in the header always (no overall countdown).
  - In **Mock** mode, the existing total-quiz countdown (`totalQuizTime`) behavior is unchanged; per-question `timeSpent` is still recorded and surfaced only after submit (already shown via `timeSpentSeconds` in review/summary).
- **Solution visibility:**
  - Replace `const isShowSolution = !!answers[currentIdx]` with mode-aware logic:
    - Practice: `const isShowSolution = mode === 'practice' ? !!answers[currentIdx] : false;` (instant on answer).
    - Mock: `false` during the quiz.
  - Summary/review (`isReviewMode`) keeps `showSolution={true}` (unchanged).
- **Option interactivity during quiz (non-review):**
  - Already guarded by `showSolution` in `QuestionCard`. For Mock, since `showSolution` stays false, users can freely change answers (like a test) — good. For Practice, after answering `showSolution` becomes true and options lock (existing behavior) — good.
- **Header timer display:**
  - When `mode === 'practice'`: show the per-question `currentTimer` (mm:ss) instead of the quiz countdown (the `totalQuizTime != null && timeLeft != null` branch). Keep the countdown branch for Mock/chapter-bank.
  - Guard the countdown auto-submit: it is already gated on `totalQuizTime != null` (only chapter bank), so Mock mode + chapter bank still auto-submits; Mock + mockErrors (no countdown) won't. This is acceptable and consistent with "keep existing timer as-is".
- **Summary screen:** unchanged — already shows total time and per-question time in review. Both modes show it after submit.

### 4. `QuestionCard.tsx`
- No structural change required. `showSolution` and `timeSpentSeconds` props already drive solution display and the "Time Taken" pill. Ensure `timeSpentSeconds` is still passed in review (it is, line 400).
- Optional: in Practice live mode you may also pass `timeSpentSeconds` to the card so the per-question timer shows on the card too. If desired, pass `mode === 'practice' && !isReviewMode ? currentTimer : (isReviewMode ? timeSpent[currentIdx] : undefined)` to `timeSpentSeconds`.

## Validation
- `npm run lint` (tsc --noEmit) must pass.
- `npm run dev` and verify:
  1. Nav shows Practice/Mock toggle; default Practice.
  2. Practice: answering a question instantly reveals solution + correct/wrong; a live per-question timer counts up; no overall limit.
  3. Mock: answering shows selection only (no solution); timer behaves as before (countdown for chapter bank, none for mock errors); after Submit → summary + Review shows solutions and per-question times.
  4. Existing category toggle (Chapter Bank / Mock Errors) and countdown still work.

## Notes / risks
- "total time per question" in Mock was interpreted as per-question time recorded and revealed post-submit (not a cumulative global clock). Matches current data model (`timeSpent[idx]`).
- Do not alter `types.ts`, scoring, Firestore save, or bookmark logic.
