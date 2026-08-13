# Remove Mock Analysis & Mock Mistakes Features

## Goal
Completely remove the "Mock Analysis" and "Mock Mistakes" pages and all their
supporting code (state, Firestore reads/writes, nav buttons, types, components,
and Firestore security rules).

## Scope (what to remove)
- `src/components/MockAnalysisView.tsx` — delete file
- `src/components/MockMistakesView.tsx` — delete file
- `src/components/FullMock.tsx` — delete file (unused leftover)
- `src/types.ts` — remove `MockRecord`, `MockMistake`, `MistakeCategory`
- `src/App.tsx`:
  - Remove imports: `MockRecord, MockMistake` (from `./types`), `MockAnalysisView`, `MockMistakesView`
  - Remove `'mockAnalysis' | 'mockMistakes'` from `view` state union (line 91)
  - Remove `mocks`/`mockMistakes` state (lines 189-190)
  - Remove `fetchMocks` + `fetchMockMistakes` functions and their combined `useEffect` (lines ~192-223)
  - Remove `addMock`, `deleteMock`, `addMockMistake`, `deleteMockMistake` handlers (lines ~397-441)
  - Remove the two nav buttons "Mock Analysis" (BarChart3) and "Mock Mistakes" (Target) (lines ~660-672)
  - Remove the two view render blocks `view === 'mockAnalysis'` and `view === 'mockMistakes'` (lines ~1459-1493)
  - Remove now-unused icon imports `BarChart3, Target` if no longer used elsewhere
- `firestore.rules` — remove the `mocks` and `mockMistakes` match blocks (lines 55-69)

## Out of scope (keep)
- Full-screen Mock test mode (`requestFullscreen`/`exitFullscreen` in App.tsx) — keep
- `quizMode` practice/mock toggle — keep
- `FullMock.tsx` — currently unwired leftover; decision pending (see Open Questions)

## Validation
1. `npm run build` succeeds with no type errors.
2. Search confirms zero references to `MockRecord`, `MockMistake`, `MockAnalysisView`, `MockMistakesView`, `mocks`, `mockMistakes` (other than unrelated `mockMode`/`mockErrors` chapter bank).
3. Nav no longer shows "Mock Analysis" / "Mock Mistakes".
4. Existing features (Practice/Bookmark/Dashboard/Heatmap) still work after login.

## Open Questions
- Resolved: delete `src/components/FullMock.tsx` too (unused leftover).
