# Quiz: Reattempt + Previous-Session Analysis

## Goal
Two improvements to the CGL quiz app (`src/`):
1. **Reattempt** — retry the same quiz from the post-submit summary screen and from the Dashboard history.
2. **Analysis of previous session** — when revisiting a quiz you've attempted before, open an "Analysis" view showing **correct / incorrect / skipped** from the last saved attempt. The summary is already persisted to Firestore on submit (`handleQuizComplete` → `results` collection); we just surface it.

No "weak questions" pool is built (per user). Scope is strictly reattempt + analysis.

## Verified context
- Submit flow: `QuizContainer` builds `results` (QuizContainer.tsx:185-257) → `onComplete` → `handleQuizComplete` (App.tsx:414-429) saves to Firestore `results` `orderBy('completedAt','desc')`.
- `QuestionProgress` (types.ts:40-57) currently stores only `q_num, timeSpent, isCorrect, selectedAnswer` — **no question text / options / solution**.
- `QuestionCard` (QuestionCard.tsx:35) already highlights the correct option (green) and the user's wrong selection (red) and shows the solution when `showSolution` is true → **Analysis reuses `QuestionCard`** (pass `showSolution`, `selectedAnswer={d.selectedAnswer}`, `onAnswer={() => {}}`, `isAdmin=false`). No custom render needed.
- `src/data` questions contain **no images** (no `"image"` literal anywhere) → storing the full `Question` per result is safe well under Firestore's 1 MB/doc limit.
- Build/typecheck: `npm run lint` (tsc --noEmit). Local run: `npm run dev` (needs firebase config + authorized Google login).

## Changes

### 1. Enrich saved result so Analysis can render full questions
- `types.ts` `QuestionProgress`: add optional `question?: Question` (optional for legacy Firestore docs that lack it).
- `QuizContainer.tsx:200-205`: in `questionDetails.map`, add `question: q` (full `Question`). Self-contained, mirrors `Bookmark` storing the whole question.
- Analysis guards on `d.question` presence (legacy docs still show counts, detail line says "Question data unavailable").

### 2. Reattempt from results screen
- `QuizContainer.tsx`: add `handleReattempt` resetting all state:
  `setAnswers({})`, `setTimeSpent({})`, `setVisited(new Set([0]))`, `setMarkedForReview(new Set())`, `setIsFinished(false)`, `setIsReviewMode(false)`, `setCurrentIdx(0)`, `setCurrentTimer(0)`, `setIsPaused(false)`, `setTimeLeft(totalQuizTime)`.
- Add a **Reattempt** button on the finished summary (QuizContainer.tsx:238-253), beside "Review Questions" / "Back to Dashboard". (Review mode returns to summary via its existing "Back to Summary" button; reattempt lives on the summary only — keep it minimal.)

### 3. Reattempt from Dashboard
- `App.tsx` add `reattemptFromResult(result: QuizResult)`:
  - `const data = result.category === 'mockErrors' ? mockData : bankData;`
  - `const chapter = (data[result.subject] || []).find(ch => ch.chapter_title === result.chapter_title);`
  - Found → `setCategory(result.category); startQuiz(chapter);` — else render the button **disabled** (covers virtual/bookmark quizzes that can't be reconstructed).
- Add **Reattempt** button per recent-activity row (App.tsx:1206-1243).

### 4. Make prior attempts visible on Home (enable per-chapter Analysis)
- `App.tsx`: relax the results-fetch effect (App.tsx:208-229) to run whenever `user` is present (not only `view === 'dashboard'`), so `userResults` is available on Home. Re-fetch also triggers when quiz completes → `setView('home')` (effect deps include `view`).
- Derive `latestResultByChapter` (useMemo): `key = ${subject}|${chapter_title}|${category}` → first (newest) `QuizResult` in `userResults`.
- Home chapter cards (App.tsx:822-844): if `latestResultByChapter.has(key)` for that chapter, render a small **Analysis** button (e.g. bar-chart icon) next to "Start Practice". Use `onClick={(e)=>{e.stopPropagation(); openAnalysis(result);}}` so it doesn't trigger `startQuiz`.

### 5. Analysis view (new `view: 'analysis'`)
- `App.tsx`: add `view` value `'analysis'` and `analysisResult: QuizResult | null`. `openAnalysis(result)` sets both and `setView('analysis')`.
- Launch points:
  - Home chapter card Analysis button (only when prior attempt exists).
  - Dashboard recent-activity row Analysis button (alongside Reattempt).
- New `motion.div` for `view === 'analysis'`, rendering `analysisResult` (newest prior attempt):
  - Header: chapter title, subject, completedAt date, score `score/totalQuestions`.
  - Three stat cards (the user explicitly asked for these): **Correct** (`d.isCorrect`), **Incorrect** (`!d.isCorrect && d.selectedAnswer`), **Skipped** (`!d.selectedAnswer`). Plus total time.
  - Filterable per-question list, tabs **All / Correct / Incorrect / Skipped**, each item reuses `QuestionCard` with `showSolution`, `selectedAnswer={d.selectedAnswer}`, `onAnswer={() => {}}`, `isAdmin={false}`. If `!d.question`, render a minimal fallback line instead of `QuestionCard`.
  - Footer: **Reattempt** (calls `reattemptFromResult(analysisResult)`) and **Back to Practice/Dashboard**.

### 6. Nav
- No new nav item; Analysis is launched contextually (Home card + Dashboard row), consistent with existing view-based navigation.

## Edge cases
- Virtual/bookmark quizzes ("All X", "Bookmarked: ..."): Reattempt disabled on Dashboard (chapter not reconstructable); Analysis still works because the full `Question` is stored in the result itself.
- Deleted/edited source questions: Analysis reads the stored snapshot, so it stays valid even if the live question was later deleted.
- Legacy `results` docs without `question`: stats (correct/incorrect/skipped) still computable from `isCorrect`/`selectedAnswer`; detail guarded.
- Unauthenticated users: results/analysis require login (existing gate); no behavior change.
- "Skipped" = no selection (`selectedAnswer === ''`), including marked-for-review-but-unanswered.
- Analysis always shows the **newest** prior attempt (matches "previous session").

## Files touched
- `src/types.ts` — `QuestionProgress` add optional `question?: Question`.
- `src/components/QuizContainer.tsx` — `handleReattempt`, Reattempt button, add `question` to `questionDetails`.
- `src/App.tsx` — relax results fetch; `latestResultByChapter`; Home Analysis button (stopPropagation); Dashboard Reattempt + Analysis buttons; `reattemptFromResult`; `openAnalysis`; new `analysis` view reusing `QuestionCard`.

## Validation
- `npm run lint` passes (added `question` field optional → no breakage for legacy reads).
- Manual (`npm run dev` + authorized Google login):
  1. Complete a chapter quiz → summary shows **Reattempt**; clicking it restarts the same quiz clean (timer/answers/scores reset).
  2. Dashboard row shows **Reattempt** + **Analysis**; Reattempt relaunches the chapter; Analysis shows Correct/Incorrect/Skipped matching the submitted attempt, with each question rendered via `QuestionCard` (correct green, wrong red, solution shown).
  3. Revisit the same chapter later from Home → **Analysis** button present → opens previous session breakdown (newest attempt).
  4. Skipped questions appear only under "Skipped", never under Correct/Incorrect.
