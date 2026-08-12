# Quiz: Reattempt + Persistent "Review Last Attempt"

## Goal
Replace the previously-added **Analysis** feature with a persistent **Review last attempt** feature, and keep **Reattempt**. The idea: the post-submit "Review Questions" experience (see each question with your answer, the correct answer, and the solution) should be **saved and reopenable at any time** from the main listings — not just for the live session.

Remove: the Analysis view (Correct/Incorrect/Skipped stat cards + filter tabs).
Keep: Reattempt (summary screen + Dashboard), the in-quiz "Review Questions" button, and saving results (incl. the full `Question`) to Firestore.

## Verified context
- Submit saves `results` to Firestore via `handleQuizComplete` (App.tsx) with `questionDetails` that now include `question?: Question` (types.ts), `isCorrect`, `selectedAnswer`, `timeSpent`. This already persists everything needed to replay a past attempt in review style.
- The in-quiz review uses `QuestionCard` with `showSolution` + `selectedAnswer` to highlight correct (green) / your wrong (red) and show the solution (QuestionCard.tsx). A persistent review reuses exactly this.
- Currently present (to be changed): `AnalysisView.tsx`, `analysisResult` state, `view:'analysis'`, `openAnalysis`, and Analysis buttons on Home cards (App.tsx) + Dashboard rows.

## Changes

### 1. Remove Analysis
- Delete `src/components/AnalysisView.tsx`.
- `App.tsx`:
  - Remove `view: 'analysis'` from the `view` state union.
  - Remove `analysisResult` state and `openAnalysis` handler.
  - Remove the `{view === 'analysis' && analysisResult && (...)}` render block.
  - Remove the Analysis button from Home chapter cards (the `BarChart3` button with `openAnalysis`).
  - Remove the Analysis button from Dashboard recent-activity rows.
  - Remove now-unused imports: `AnalysisView`, `BarChart3` (if used only for Analysis).

### 2. Add ReviewView (reuses AnalysisView shape, minus stats/tabs)
- Create `src/components/ReviewView.tsx` (mirrors AnalysisView but **no** Correct/Incorrect/Skipped stat cards and **no** filter tabs):
  - Props: `result: QuizResult`, `onReattempt: () => void`, `onBack: () => void`.
  - Header: chapter title, subject, `completedAt` date, score `score/totalQuestions`.
  - Render each `result.questionDetails` entry via `QuestionCard` with `showSolution`, `selectedAnswer={d.selectedAnswer || null}`, `onAnswer={() => {}}`, `isAdmin={false}`, `timeSpentSeconds={d.timeSpent}`.
  - Guard: if `!d.question`, render a minimal fallback line ("Question data unavailable (older attempt format)").
  - Footer: **Reattempt** (calls `onReattempt`) + **Back** (calls `onBack`).
  - Wrap in `motion.div` (initial/animate/exit) for consistency with other views.

### 3. Wire Review into App.tsx
- Add `view` union member `'review'` and `reviewResult: QuizResult | null` state.
- Add `openReview(result: QuizResult)` → `setReviewResult(result); setView('review');`.
- Add a **Review** button (reuse the `BarChart3` icon or a `History`/`Eye` icon) on:
  - **Home chapter cards** (where the Analysis button was): render only when `latestResultByChapter.has(\`${chapter.subject}|${chapter.chapter_title}|${category}\`)`; `onClick` uses `stopPropagation()` so it doesn't start the quiz; calls `openReview(latestResult)`.
  - **Dashboard recent-activity rows**: next to the existing **Reattempt** button; calls `openReview(result)`.
- Add render block `{view === 'review' && reviewResult && (<ReviewView result={reviewResult} onReattempt={() => reattemptFromResult(reviewResult)} onBack={() => setView('dashboard')} />)}`.

### 4. Keep (no change)
- `reattemptFromResult` (Reattempt from Dashboard + Review view). For non-reconstructable virtual/bookmark quizzes, the Reattempt button stays disabled.
- `latestResultByChapter` map (drives Review-button visibility).
- In-quiz "Review Questions" button on the post-submit summary (QuizContainer.tsx) — unchanged.
- `QuestionProgress.question?` stays (required by ReviewView to render questions).

## Edge cases
- Legacy `results` docs without `question`: ReviewView falls back per-item; still shows score/header.
- Virtual/bookmark quizzes ("All X", "Bookmarked: ..."): Review works (full `Question` stored); Reattempt disabled (chapter not reconstructable) — unchanged behavior.
- No prior attempt: Review button hidden on Home; Dashboard rows always have a result (they are results).
- Review shows the **newest** saved attempt (matches "last attempt").
- `npm run lint` must stay green after removing `AnalysisView`/unused imports.

## Files touched
- Delete `src/components/AnalysisView.tsx`.
- Create `src/components/ReviewView.tsx`.
- `src/App.tsx` — remove Analysis (state/handler/buttons/render/imports); add `review` view + `reviewResult` + `openReview`; add Review buttons on Home cards + Dashboard rows; import `ReviewView`.
- `src/types.ts` — unchanged (keep `question?: Question`).

## Validation
- `npm run lint` (tsc --noEmit) passes (no unused imports / missing symbols after removing Analysis).
- `npm run build` succeeds.
- Manual (`npm run dev` + authorized Google login):
  1. Complete a chapter quiz → summary shows **Review Questions** + **Reattempt** (unchanged).
  2. Leave to Home; the chapter card now shows a **Review** button → opens the last attempt with each question in review style (correct green, your wrong red, solution shown).
  3. Dashboard row shows **Review** + **Reattempt**; Review opens the same last-attempt review.
  4. Reattempt restarts the quiz; after completing again, Review shows the newer attempt.
