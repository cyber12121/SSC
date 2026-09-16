import { MockScoreReport } from '../types/mockScore';
import initialMockReports from '../data/mock_reports.json';

export type TestScopeFilter = 'all' | 'full' | 'sectional';

// Cache known report title / id -> type mappings
const reportTypeCache = new Map<string, 'full' | 'sectional'>();

export function initReportMap(reports?: MockScoreReport[]) {
  const source = reports && reports.length > 0 ? reports : (initialMockReports as unknown as MockScoreReport[]);
  source.forEach(r => {
    if (r.title && r.type) {
      reportTypeCache.set(r.title.trim().toLowerCase(), r.type === 'sectional' ? 'sectional' : 'full');
    }
    if (r.id && r.type) {
      reportTypeCache.set(r.id.trim().toLowerCase(), r.type === 'sectional' ? 'sectional' : 'full');
    }
  });
}

// Pre-populate with initial reports
initReportMap();

/**
 * Classifies any question or test object as either 'full' or 'sectional'.
 */
export function classifyTestType(q: any, reports?: MockScoreReport[]): 'full' | 'sectional' {
  if (!q) return 'full';

  // 1. Direct explicit property
  const explicitType = String(q.testType || q.mockType || '').trim().toLowerCase();
  if (explicitType === 'sectional' || explicitType.startsWith('sec')) return 'sectional';
  if (explicitType === 'full' || explicitType === 'full_mock' || explicitType.startsWith('full')) return 'full';

  // 2. Lookup in reports cache (or refresh cache if reports array passed)
  if (reports && reports.length > 0) {
    initReportMap(reports);
  }

  const rawTitle = String(q.testName || q.testTitle || q.mockTitle || q.title || '').trim();
  if (rawTitle) {
    const lower = rawTitle.toLowerCase();
    if (reportTypeCache.has(lower)) {
      return reportTypeCache.get(lower)!;
    }
  }

  // 3. Fallback heuristics on title
  if (rawTitle) {
    // Single subject indicators in parentheses e.g. (English), (Quant), (Reasoning), (GA), (GK) -> sectional
    if (/\((quant|math|english|reasoning|ga|gk|general awareness|intel|logic)\)/i.test(rawTitle)) {
      return 'sectional';
    }
    // Explicit sectional keyword (excluding "[Sectional Timing]" which is a Tier-I Full Mock format)
    if (/\bsectional\b/i.test(rawTitle) && !/sectional timing/i.test(rawTitle)) {
      return 'sectional';
    }
    // Live full tests / Full tests / Tier I mocks
    if (/full test|mega live test|live test|tier i: full|tier i-|\btier 1\b|\btier-1\b/i.test(rawTitle)) {
      return 'full';
    }
  }

  // Default fallback
  return 'full';
}
