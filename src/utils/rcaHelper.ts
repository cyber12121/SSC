import { RCATagType, RCAClassification, Question } from '../types';
import { safeStorage } from './safeStorage';

export const mockQuestionModules = import.meta.glob('../data/mock_questions/*.json');

export interface RCABucketInfo {
  tag: RCATagType | 'unclassified';
  label: string;
  shortLabel: string;
  desc: string;
  badgeClass: string;
  pillClass: string;
  dotClass: string;
  lightClass: string;
  borderClass: string;
}

export const RCA_TAG_CONFIG: Record<RCATagType | 'unclassified', RCABucketInfo> = {
  C: {
    tag: 'C',
    label: 'Conceptual Gap',
    shortLabel: 'Concept',
    desc: 'Core logic, theorem, or formula missing or misunderstood.',
    badgeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    pillClass: 'bg-purple-600 text-white shadow-xs',
    dotClass: 'bg-purple-500',
    lightClass: 'bg-purple-50 text-purple-700 border-purple-200',
    borderClass: 'border-purple-500/40 hover:border-purple-500'
  },
  A: {
    tag: 'A',
    label: 'Silly Mistake',
    shortLabel: 'Silly',
    desc: 'Calculation slip, misread question, or rushed input.',
    badgeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    pillClass: 'bg-rose-600 text-white shadow-xs',
    dotClass: 'bg-rose-500',
    lightClass: 'bg-rose-50 text-rose-700 border-rose-200',
    borderClass: 'border-rose-500/40 hover:border-rose-500'
  },
  T: {
    tag: 'T',
    label: 'Time / Ego Trap',
    shortLabel: 'Time Trap',
    desc: 'Spent excessive time (>90s) and still got it wrong or skipped.',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    pillClass: 'bg-amber-600 text-white shadow-xs',
    dotClass: 'bg-amber-500',
    lightClass: 'bg-amber-50 text-amber-700 border-amber-200',
    borderClass: 'border-amber-500/40 hover:border-amber-500'
  },
  G: {
    tag: 'G',
    label: 'Guesswork Failed',
    shortLabel: 'Guesswork',
    desc: 'Gambled on 50-50 elimination or intuition and failed.',
    badgeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    pillClass: 'bg-blue-600 text-white shadow-xs',
    dotClass: 'bg-blue-500',
    lightClass: 'bg-blue-50 text-blue-700 border-blue-200',
    borderClass: 'border-blue-500/40 hover:border-blue-500'
  },
  unclassified: {
    tag: 'unclassified',
    label: 'Unclassified',
    shortLabel: 'Unclassified',
    desc: 'Error questions not yet classified into an RCA bucket.',
    badgeClass: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
    pillClass: 'bg-slate-700 text-white shadow-xs',
    dotClass: 'bg-slate-400',
    lightClass: 'bg-slate-50 text-slate-600 border-slate-200',
    borderClass: 'border-slate-700/40 hover:border-slate-600'
  }
};

export function getGlobalRcaStore(): Record<string, any> {
  try {
    const raw = safeStorage.getItem('cgl_rca_global_store');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// In-memory cache for bundled mock questions RCA tags
let bundledRcaCache: Record<string, RCAClassification> | null = null;
let bundledRcaPromise: Promise<Record<string, RCAClassification>> | null = null;

export async function loadBundledMockRcaMap(): Promise<Record<string, RCAClassification>> {
  if (bundledRcaCache) return bundledRcaCache;
  if (bundledRcaPromise) return bundledRcaPromise;

  bundledRcaPromise = (async () => {
    const map: Record<string, RCAClassification> = {};
    for (const [, loader] of Object.entries(mockQuestionModules)) {
      try {
        const mod: any = await (loader as () => Promise<any>)();
        const raw = mod?.default || mod;
        const list = Array.isArray(raw) ? raw : (raw?.questions || raw?.data || []);
        if (Array.isArray(list)) {
          list.forEach((q: any) => {
            if (q.rca && q.rca.tag && ['C', 'A', 'T', 'G'].includes(q.rca.tag)) {
              if (q.id) map[q.id] = q.rca;
              const textNorm = (q.question || q.questionText || '').trim().toLowerCase();
              if (textNorm) map[textNorm] = q.rca;
            }
          });
        }
      } catch {}
    }
    bundledRcaCache = map;
    return map;
  })();

  return bundledRcaPromise;
}

export function getBundledMockRcaMapSync(): Record<string, RCAClassification> {
  return bundledRcaCache || {};
}

export function findQuestionRca(
  q: any,
  globalStore?: Record<string, any>,
  bundledMap?: Record<string, RCAClassification>
): RCAClassification | undefined {
  if (q.rca && q.rca.tag && ['C', 'A', 'T', 'G'].includes(q.rca.tag)) {
    return q.rca;
  }
  if (q.rcaClassification && q.rcaClassification.tag && ['C', 'A', 'T', 'G'].includes(q.rcaClassification.tag)) {
    return q.rcaClassification;
  }

  const store = globalStore || getGlobalRcaStore();
  if (q.id && store[q.id]?.tag && ['C', 'A', 'T', 'G'].includes(store[q.id].tag)) {
    return store[q.id];
  }

  const textNorm = (q.question || q.questionText || '').trim().toLowerCase();
  if (textNorm && store[textNorm]?.tag && ['C', 'A', 'T', 'G'].includes(store[textNorm].tag)) {
    return store[textNorm];
  }

  const bMap = bundledMap || bundledRcaCache;
  if (bMap) {
    if (q.id && bMap[q.id]) return bMap[q.id];
    if (textNorm && bMap[textNorm]) return bMap[textNorm];
  }

  return undefined;
}

export function saveQuestionRca(
  targetQ: any,
  tag: RCATagType | null,
  sillyMistakeNote?: string,
  parentSubject?: string
): RCAClassification | undefined {
  try {
    const globalStore = getGlobalRcaStore();
    const qId = targetQ.id || `${targetQ.parentSubject || parentSubject || 'mock'}_${Date.now()}`;
    const textNorm = (targetQ.question || targetQ.questionText || '').trim().toLowerCase();

    if (!tag) {
      if (qId) delete globalStore[qId];
      if (textNorm) delete globalStore[textNorm];
      safeStorage.setItem('cgl_rca_global_store', JSON.stringify(globalStore));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cgl_rca_updated', { detail: { qId, textNorm, rca: null } }));
      }
      return undefined;
    }

    const tagNames: Record<RCATagType, RCAClassification['tagName']> = {
      'C': 'Conceptual Gap',
      'A': 'Silly Mistake',
      'T': 'Time / Ego Trap',
      'G': 'Guesswork Failed'
    };

    const newRca: RCAClassification = {
      tag,
      tagName: tagNames[tag],
      sillyMistakeNote: tag === 'A' ? (sillyMistakeNote || targetQ.sillyMistakeNote || '') : undefined,
      classifiedAt: new Date().toISOString()
    };

    const entry = {
      ...newRca,
      id: qId,
      mockId: targetQ.mockId || targetQ.testId,
      mockTitle: targetQ.mockTitle || targetQ.testName,
      subject: targetQ.parentSubject || targetQ.subject || parentSubject || 'General Awareness',
      topic: targetQ.detectedTopic || targetQ.tags?.topic || targetQ.topic || 'General',
      questionText: targetQ.question || targetQ.questionText,
      options: targetQ.options,
      answer: targetQ.answer,
      solution: targetQ.solution,
      image: targetQ.image,
      status: targetQ.status || targetQ.errorType || 'wrong',
      errorType: targetQ.errorType || 'wrong',
      isCorrect: false
    };

    globalStore[qId] = entry;
    if (textNorm) globalStore[textNorm] = entry;
    safeStorage.setItem('cgl_rca_global_store', JSON.stringify(globalStore));

    // Also update cached mock test if mockId exists
    const mId = targetQ.mockId || targetQ.testId;
    if (mId) {
      try {
        const cachedRaw = safeStorage.getItem(`cgl_mock_questions_${mId}`);
        if (cachedRaw) {
          const cachedList = JSON.parse(cachedRaw);
          if (Array.isArray(cachedList)) {
            const updated = cachedList.map((item: any) => {
              const itText = (item.question || item.questionText || '').trim().toLowerCase();
              if ((item.id && item.id === qId) || (textNorm && itText === textNorm)) {
                return { ...item, rca: newRca, rcaClassification: newRca };
              }
              return item;
            });
            safeStorage.setItem(`cgl_mock_questions_${mId}`, JSON.stringify(updated));
          }
        }
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cgl_rca_updated', { detail: { qId, textNorm, rca: newRca } }));
    }

    return newRca;
  } catch (e) {
    console.error('Error saving RCA:', e);
    return undefined;
  }
}
