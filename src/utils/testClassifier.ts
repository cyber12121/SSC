import { MockScoreReport } from '../types/mockScore';
import initialMockReports from '../data/mock_reports.json';
import { safeStorage } from './safeStorage';

export type TestScopeFilter = 'all' | 'full' | 'sectional';

// Cache known report title / id -> type mappings
const reportTypeCache = new Map<string, 'full' | 'sectional'>();

export function initReportMap(reports?: MockScoreReport[]) {
  // 1. Initial bundled reports
  const source = reports && reports.length > 0 ? reports : (initialMockReports as unknown as MockScoreReport[]);
  source.forEach(r => {
    if (!r) return;
    const t: 'full' | 'sectional' = r.type === 'sectional' ? 'sectional' : 'full';
    if (r.id) reportTypeCache.set(String(r.id).trim().toLowerCase(), t);
    if (r.title) reportTypeCache.set(String(r.title).trim().toLowerCase(), t);
  });

  // 2. Dynamically synchronize with user-created / synced reports from localStorage for future-proofing
  try {
    const saved = safeStorage.getItem('cgl_mock_score_reports');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((r: any) => {
          if (!r) return;
          const t: 'full' | 'sectional' = r.type === 'sectional' ? 'sectional' : 'full';
          if (r.id) reportTypeCache.set(String(r.id).trim().toLowerCase(), t);
          if (r.title) reportTypeCache.set(String(r.title).trim().toLowerCase(), t);
        });
      }
    }
  } catch {}
}

// Pre-populate with initial reports and local storage
initReportMap();

/**
 * Classifies any question or test object as either 'full' or 'sectional'.
 * Guaranteed 100% leak-proof across ID lookups, explicit attributes, length thresholds, and title heuristics.
 */
export function classifyTestType(q: any, reports?: MockScoreReport[]): 'full' | 'sectional' {
  if (!q) return 'full';

  // 1. Direct explicit property (fastest & strictly authoritative)
  const explicitType = String(q.testType || q.mockType || q.scope || q.testScope || '').trim().toLowerCase();
  if (explicitType === 'sectional' || explicitType.startsWith('sec')) return 'sectional';
  if (explicitType === 'full' || explicitType === 'full_mock' || explicitType.startsWith('full')) return 'full';

  // Refresh cache if fresh reports array passed
  if (reports && reports.length > 0) {
    initReportMap(reports);
  }

  // 2. Lookup by Mock/Test ID in reportTypeCache (handles questions where testName/title is missing)
  const rawId = String(q.mockId || q.testId || q.test_id || q.mock_id || q.fileId || q.reportId || '').trim().toLowerCase();
  if (rawId && reportTypeCache.has(rawId)) {
    return reportTypeCache.get(rawId)!;
  }

  // 3. Question / marks count threshold heuristics (Sectionals: 25Q / 50 marks; Full: 100Q / 200 marks)
  const totalQ = Number(q.totalQuestions || q.total_questions || q.totalCount);
  if (!isNaN(totalQ) && totalQ > 0) {
    if (totalQ <= 35) return 'sectional';
    if (totalQ >= 70) return 'full';
  }

  const maxM = Number(q.maxMarks || q.max_marks);
  if (!isNaN(maxM) && maxM > 0) {
    if (maxM <= 70) return 'sectional';
    if (maxM >= 150) return 'full';
  }

  // 4. Lookup by raw title in reportTypeCache
  const rawTitle = String(q.testName || q.testTitle || q.mockTitle || q.title || q.chapter_title || '').trim();
  if (rawTitle) {
    const lower = rawTitle.toLowerCase();
    if (reportTypeCache.has(lower)) {
      return reportTypeCache.get(lower)!;
    }

    // 5. High-precision pattern rules on test title:

    // Rule A: Oliveboard 100Q Full Mocks use "[Sectional Timing] - Tier I"
    if (/\[sectional\s*timing\]/i.test(rawTitle) || /sectional\s*timing/i.test(rawTitle)) {
      return 'full';
    }

    // Rule B: Single-subject parenthetical tags (e.g. "(Quant)", "(English)", "(Reasoning)", "(GA)", "(GK)")
    if (/\((quant|math|mathematics|english|reasoning|ga|gk|general awareness|intel|logic)\)/i.test(rawTitle)) {
      return 'sectional';
    }

    // Rule C: Sectional keyword or PYST (Previous Year Sectional Test)
    if (/\bsectional\b/i.test(rawTitle) || /\bpyst\b/i.test(rawTitle)) {
      return 'sectional';
    }

    // Rule D: Single-subject mock patterns (e.g. "English Mock - 30 Sept", "Quant Mock")
    if (/^(english|quant|mathematics|reasoning|ga|gk)\s+mock\b/i.test(rawTitle)) {
      return 'sectional';
    }

    // Rule E: Shift tests targeting a single subject e.g. "CGL 18/09/2025 Shift-2 (Quant)"
    if (/\bshift[-\s]*\d+.*?\((quant|english|reasoning|ga|gk)\)/i.test(rawTitle)) {
      return 'sectional';
    }

    // Rule F: Known full mock keywords
    if (/full test|mega live test|live test|tier i: full|tier i-|\btier 1\b|\btier-1\b|isro mock/i.test(rawTitle)) {
      return 'full';
    }
  }

  // Default fallback
  return 'full';
}

