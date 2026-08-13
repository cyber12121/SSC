# Plan: Post-submit review should open the last-attempt review

## Context
The user wants: after submitting a (Mock) quiz, choosing **Review Questions** should show the
**last attempt's review** (the persistent `ReviewView`), and that same last attempt must be
reachable later when revisiting (Home card / Dashboard).

Prior fixes already addressed "revisit" (Home `latestResultByChapter` key no longer requires
matching `category`; results are refetched right after save). This plan resolves the remaining
inconsistency introduced by routing the in-quiz "Review Questions" button to
`onComplete(results, true)` and cleans up the now-dead inline review branch.

## Current behavior (after edits)
- `App.handleQuizComplete(results, openReviewAfter=false)`: saves the result, refetches, then
  either opens `ReviewView` (flag true) or goes `home` (flag false).
- `QuizContainer` summary "Review Questions" button (mock only) now calls
  `onComplete(results, true)` → immediately opens persistent `ReviewView`.
- The `isReviewMode` inline review branch in `QuizContainer` is now **dead** (never set true).

## Inconsistencies to resolve
1. **Dead `isReviewMode` code** in `QuizContainer.tsx` (state + header/action branches + `handleReattempt` reset). Unreachable; should be removed to avoid confusion.
2. **Score summary becomes unreachable** once "Review Questions" commits to persistent review. Decision below.
3. **`ReviewView` Back → Dashboard** instead of Home after a fresh submit (minor).

## Decision (CONFIRMED by user)
**Keep the score summary screen; route its "Review Questions" button to the persistent
ReviewView of the just-saved attempt.** This:
- preserves the score summary (correct/wrong %, time),
- makes "Review Questions" open the last-attempt `ReviewView` exactly as requested,
- keeps the inline `isReviewMode` "Back to Summary" toggle reachable (no dead-code removal needed).

## Tasks
1. `App.tsx`
   - `handleQuizComplete(results, openReviewAfter=false)` already opens `ReviewView` when
     flagged — keep.
   - Add prop `onReviewLastAttempt={(r) => handleQuizComplete(r, true)}` to `<QuizContainer>`.
   - Track review-entry origin so `ReviewView` `onBack` routes to `home` when opened directly
     from a fresh submit, and `dashboard` when opened from Home/Dashboard revisit. Simplest:
     add a `reviewBackTo` state (`'home' | 'dashboard'`) set in `openReview` (dashboard) /
     `handleQuizComplete(...,true)` (home), and pass `onBack={() => setView(reviewBackTo)}`.
2. `QuizContainer.tsx`
   - Revert the summary "Review Questions" button to `onClick={() => setIsReviewMode(true)}`
     (keeps the score summary on screen and the inline review reachable).
   - Add prop `onReviewLastAttempt?: (results: Omit<QuizResult,'userId'|'completedAt'>) => void`.
   - In the **inline review** branch (the `isReviewMode` header / action bar, currently dead
     because nothing sets it true), add an **"Open full review"** button that calls
     `onReviewLastAttempt(results)` — this is the link into the persistent last-attempt review.
   - Remove the now-redundant `openReviewAfter` second arg usage on the summary button (it
     should no longer call `onComplete(results, true)` directly).
3. No dead-code removal needed — `isReviewMode` stays reachable via the summary "Review
   Questions" → inline review → "Open full review".

## Files
- `src/App.tsx` — `handleQuizComplete`, `reviewBackTo` state, `<QuizContainer onReviewLastAttempt=...>`, `ReviewView onBack`.
- `src/components/QuizContainer.tsx` — `onReviewLastAttempt` prop; summary "Review Questions" → `setIsReviewMode(true)`; inline-review "Open full review" button.

## Validation
- Mock quiz → submit → score summary shows → "Review Questions" → inline review (solutions,
  Back to Summary) → "Open full review" → `ReviewView` of the just-saved attempt (palette
  colors, last answers, solutions).
- From `ReviewView`: Reattempt restarts quiz; Back returns to **Home** (after submit) / **Dashboard** (revisit).
- Revisit via Home card "Review" / Dashboard "Review" opens the same last-attempt `ReviewView`.
- Practice mode: no Review anywhere.
- `tsc --noEmit` passes (note: pre-existing errors for deleted FullMock/MockAnalysisView/MockMistakesView files are unrelated).

## Open question
None — decision confirmed (keep summary + link to review).
