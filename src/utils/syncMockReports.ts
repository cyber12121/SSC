import { MockScoreReport } from '../types/mockScore';

export const LEGACY_MOCK_ID_MAP: Record<string, string> = {
  'mock_1789504230140_a8wt2': 'mock_1789515022905_egyvl',
};

const DELETED_MOCKS_STORAGE_KEY = 'cgl_deleted_mock_ids';

export function getDeletedMockIds(): Set<string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(DELETED_MOCKS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    }
  } catch {}
  return new Set();
}

export function addDeletedMockId(id: string): void {
  if (!id) return;
  try {
    const set = getDeletedMockIds();
    set.add(id);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DELETED_MOCKS_STORAGE_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

/**
 * Normalizes title for comparison (case-insensitive, removes extra whitespace/punctuation)
 */
export function normalizeTestTitle(title: string = ''): string {
  return title
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synchronizes reports loaded from storage/API with canonical bundled reports.
 * - Respects user deleted mocks (never revives them)
 * - Migrates any legacy IDs (e.g. Full Test 7 rename)
 * - Updates canonical bundled mocks with latest metadata and canonical ID
 * - Preserves user custom uploaded mocks
 * - Inserts any new bundled mocks that are not yet in storage (unless deleted)
 */
export function syncMockReports(
  savedList: MockScoreReport[] = [],
  bundledList: MockScoreReport[] = []
): MockScoreReport[] {
  const deletedIds = getDeletedMockIds();

  const cleanSaved = (Array.isArray(savedList) ? savedList : []).filter(
    item => item && item.id && !deletedIds.has(item.id)
  );
  const cleanBundled = (Array.isArray(bundledList) ? bundledList : []).filter(
    item => item && item.id && !deletedIds.has(item.id)
  );

  if (cleanBundled.length === 0) {
    return cleanSaved;
  }

  if (cleanSaved.length === 0) {
    return [...cleanBundled];
  }


  // Remap legacy IDs in savedList
  const normalizedSaved = savedList.map(item => {
    if (!item) return item;
    const mappedId = LEGACY_MOCK_ID_MAP[item.id];
    if (mappedId) {
      return { ...item, id: mappedId };
    }
    return item;
  });

  const matchedBundledIds = new Set<string>();
  const result: MockScoreReport[] = [];

  // Match saved items against bundled reports
  for (const item of normalizedSaved) {
    if (!item || !item.id) continue;

    const normSavedTitle = normalizeTestTitle(item.title);
    const savedPlatform = (item.platform || '').toLowerCase();

    const match = cleanBundled.find(b => {
      if (b.id === item.id) return true;
      const normBundledTitle = normalizeTestTitle(b.title);
      const bundledPlatform = (b.platform || '').toLowerCase();
      return normBundledTitle === normSavedTitle && (
        !savedPlatform || !bundledPlatform || savedPlatform === bundledPlatform
      );
    });

    if (match) {
      matchedBundledIds.add(match.id);
      // Canonical bundled report takes precedence for ID, score, date, and structure
      result.push({
        ...item,
        ...match,
      });
    } else {
      // Custom user mock
      result.push(item);
    }
  }

  // Include any bundled mocks not present in saved (unless deleted)
  for (const b of cleanBundled) {
    if (!matchedBundledIds.has(b.id) && !deletedIds.has(b.id)) {
      result.push(b);
      matchedBundledIds.add(b.id);
    }
  }

  // Deduplicate and ensure no deleted mocks slip through
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  return result.filter(r => {
    if (!r || !r.id) return false;
    if (deletedIds.has(r.id)) return false;
    if (r.id === 'mock_1789390419229_wwxcs' || r.id === 'mock_1789389316470_i3i84') return false;
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);

    const key = `${r.platform || ''}|${normalizeTestTitle(r.title)}|${r.type}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);

    return true;
  });
}
