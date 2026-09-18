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
  S: {
    tag: 'S',
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

export interface SillySubTypeConfig {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  desc: string;
  badgeClass: string;
  activePillClass: string;
  inactivePillClass: string;
}

export const SILLY_SUB_TYPES: Record<string, SillySubTypeConfig> = {
  calculation: {
    id: 'calculation',
    label: 'Calculation Error',
    shortLabel: 'Calculation',
    icon: '🧮',
    desc: 'Math slip, arithmetic, multiplication, division, BODMAS, or sign error',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    activePillClass: 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs',
    inactivePillClass: 'bg-rose-50/80 hover:bg-rose-100 text-rose-800 border-rose-200'
  },
  misread: {
    id: 'misread',
    label: 'Misread Question',
    shortLabel: 'Misread',
    icon: '👁️',
    desc: 'Overlooked NOT / INCORRECT, misinterpreted statement, or rushed reading',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    activePillClass: 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs',
    inactivePillClass: 'bg-amber-50/80 hover:bg-amber-100 text-amber-800 border-amber-200'
  },
  option: {
    id: 'option',
    label: 'Marked Wrong Option',
    shortLabel: 'Wrong Option',
    icon: '🎯',
    desc: 'Solved correctly but marked or clicked the wrong option',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-200',
    activePillClass: 'bg-violet-600 text-white font-bold border-violet-600 shadow-xs',
    inactivePillClass: 'bg-violet-50/80 hover:bg-violet-100 text-violet-800 border-violet-200'
  },
  formula: {
    id: 'formula',
    label: 'Formula / Sign Slip',
    shortLabel: 'Formula / Sign',
    icon: '⚡',
    desc: 'Sign error (+/-), formula misapplication, or inverted ratio',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activePillClass: 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs',
    inactivePillClass: 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  rushed: {
    id: 'rushed',
    label: 'Rushed / Panic',
    shortLabel: 'Rushed',
    icon: '⏱️',
    desc: 'Rushed under time pressure or panicking near end of section',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    activePillClass: 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs',
    inactivePillClass: 'bg-blue-50/80 hover:bg-blue-100 text-blue-800 border-blue-200'
  },
  unit: {
    id: 'unit',
    label: 'Unit Missed',
    shortLabel: 'Unit Missed',
    icon: '📐',
    desc: 'Missed unit conversion (km/h vs m/s, cm vs m, grams vs kg)',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    activePillClass: 'bg-teal-600 text-white font-bold border-teal-600 shadow-xs',
    inactivePillClass: 'bg-teal-50/80 hover:bg-teal-100 text-teal-800 border-teal-200'
  },
  custom: {
    id: 'custom',
    label: 'Custom / Other Slip',
    shortLabel: 'Custom Slip',
    icon: '📝',
    desc: 'Specific custom user note or slip',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    activePillClass: 'bg-slate-700 text-white font-bold border-slate-700 shadow-xs',
    inactivePillClass: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
  },
  unspecified: {
    id: 'unspecified',
    label: 'Unspecified Slip',
    shortLabel: 'Unspecified',
    icon: '❓',
    desc: 'General silly mistake without specific sub-reason note',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    activePillClass: 'bg-gray-700 text-white font-bold border-gray-700 shadow-xs',
    inactivePillClass: 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
  }
};

export function getQuestionSillySubTypes(q: any): string[] {
  const explicitSub = (
    q?.rca?.subTag ||
    q?.subTag ||
    q?.rcaClassification?.subTag ||
    ''
  ).trim();

  const note = (
    q?.rca?.sillyMistakeNote ||
    q?.sillyMistakeNote ||
    q?.rcaClassification?.sillyMistakeNote ||
    ''
  ).trim();

  const matched: string[] = [];

  if (explicitSub && explicitSub !== 'all' && SILLY_SUB_TYPES[explicitSub]) {
    matched.push(explicitSub);
  }

  if (note && note.toLowerCase() !== 'unspecified silly mistake') {
    const lower = note.toLowerCase();
    if (/calculat|calc\b|arithmetic|multiplic|divid|addit|subtract|table|fraction|decimal|bodmas|\(\+\/\-\)/i.test(lower)) {
      if (!matched.includes('calculation')) matched.push('calculation');
    }
    if (/misread|read|overlook|keyword|not\b|incorrect|least|except|question \/ option/i.test(lower)) {
      if (!matched.includes('misread')) matched.push('misread');
    }
    if (/marked wrong|wrong option|bubbl|option swap|clicked wrong/i.test(lower)) {
      if (!matched.includes('option')) matched.push('option');
    }
    if (/formula|sign error|sign slip|plus|minus|negative|positive|\+\/\-/i.test(lower)) {
      if (!matched.includes('formula')) matched.push('formula');
    }
    if (/rush|panic|hurry|hasty|time pressure|last minute/i.test(lower)) {
      if (!matched.includes('rushed')) matched.push('rushed');
    }
    if (/unit|conversion|cm\b|meter|km\/h|m\/s|kg\b|gram/i.test(lower)) {
      if (!matched.includes('unit')) matched.push('unit');
    }
  }

  if (matched.length === 0) {
    if (note && note.toLowerCase() !== 'unspecified silly mistake') {
      matched.push('custom');
    } else {
      matched.push('unspecified');
    }
  }
  return matched;
}

export function matchesSillySubFilter(q: any, subFilter: string): boolean {
  if (!subFilter || subFilter === 'all') return true;
  const types = getQuestionSillySubTypes(q);
  return types.includes(subFilter);
}

export function getSillyPrimaryBadge(q: any): { 
  icon: string; 
  label: string; 
  shortLabel: string;
  subId: string;
  badgeClass: string; 
  noteText?: string 
} {
  const note = (
    q?.rca?.sillyMistakeNote ||
    q?.sillyMistakeNote ||
    q?.rcaClassification?.sillyMistakeNote ||
    ''
  ).trim();

  const types = getQuestionSillySubTypes(q);
  const primaryId = types[0] || 'unspecified';
  const cfg = SILLY_SUB_TYPES[primaryId] || SILLY_SUB_TYPES.unspecified;

  return {
    icon: cfg.icon,
    subId: primaryId,
    label: `⚡ Silly Mistake • ${cfg.label}`,
    shortLabel: cfg.label,
    badgeClass: cfg.badgeClass,
    noteText: note && note.toLowerCase() !== 'unspecified silly mistake' ? note : undefined
  };
}

/**
 * Generates an instant, dynamic Speed & Pattern Insight based on actual error questions
 * e.g.: "Out of my 6 calculation errors, 4 happened in Mensuration & Geometry when solving under 30 seconds."
 */
export function generatePatternInsight(questions: any[], subFilter?: string): string | null {
  if (!questions || questions.length === 0) return null;
  const total = questions.length;
  const cfg = subFilter && subFilter !== 'all' ? SILLY_SUB_TYPES[subFilter] : undefined;
  const subLabel = cfg ? cfg.label.toLowerCase() : 'silly mistake';

  const topicCounts: Record<string, number> = {};
  let under30Count = 0;
  let under45Count = 0;
  let over60Count = 0;

  questions.forEach(q => {
    const rawTopic = q.tags?.topic || q.topic || q.subject || 'General';
    const topic = String(rawTopic).trim() || 'General';
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;

    const time = Number(q.timeSpent || q.userTime || q.timeTaken || 0);
    if (time > 0 && time <= 30) under30Count++;
    else if (time > 0 && time <= 45) under45Count++;
    else if (time >= 60) over60Count++;
  });

  const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
  const [topTopic, topCount] = sortedTopics[0] || ['', 0];

  if (total === 1) {
    if (under30Count === 1) {
      return `Solved rapidly in under 30 seconds in ${topTopic} — check for hasty steps.`;
    }
    return `Occurred in ${topTopic}. Double-check intermediate operations before marking.`;
  }

  if (topTopic && topCount >= 2 && under30Count >= 2) {
    return `Out of your ${total} ${subLabel}s, ${topCount} happened in ${topTopic} when solving under 30 seconds.`;
  } else if (topTopic && topCount >= 2 && under45Count >= 2) {
    return `Out of your ${total} ${subLabel}s, ${topCount} happened in ${topTopic} when solving under 45 seconds.`;
  } else if (topTopic && topCount >= 2) {
    return `Out of your ${total} ${subLabel}s, ${topCount} happened in ${topTopic}.`;
  } else if (under30Count >= Math.ceil(total / 2)) {
    return `${under30Count} of ${total} ${subLabel}s happened when rushing under 30 seconds. Pacing avoids sign & calculation slips.`;
  } else if (over60Count >= 2) {
    return `${over60Count} of ${total} ${subLabel}s occurred after spending over 60 seconds under time pressure.`;
  }

  return `Out of your ${total} ${subLabel}s, most slips occurred in ${topTopic || 'calculations'}.`;
}

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
            if (q.rca && q.rca.tag && ['C', 'A', 'S', 'T', 'G'].includes(q.rca.tag)) {
              const tag = q.rca.tag === 'A' ? 'S' : q.rca.tag;
              const normalized = { ...q.rca, tag };
              if (q.id) map[q.id] = normalized;
              const textNorm = (q.question || q.questionText || '').trim().toLowerCase();
              if (textNorm) map[textNorm] = normalized;
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

function normalizeClassification(rca: any): RCAClassification | undefined {
  if (!rca || !rca.tag) return undefined;
  const tag = rca.tag === 'A' ? 'S' : rca.tag;
  if (!['C', 'S', 'T', 'G'].includes(tag)) return undefined;
  return { ...rca, tag };
}

export function findQuestionRca(
  q: any,
  globalStore?: Record<string, any>,
  bundledMap?: Record<string, RCAClassification>
): RCAClassification | undefined {
  if (q.rca && q.rca.tag && ['C', 'A', 'S', 'T', 'G'].includes(q.rca.tag)) {
    return normalizeClassification(q.rca);
  }
  if (q.rcaClassification && q.rcaClassification.tag && ['C', 'A', 'S', 'T', 'G'].includes(q.rcaClassification.tag)) {
    return normalizeClassification(q.rcaClassification);
  }

  const store = globalStore || getGlobalRcaStore();
  if (q.id && store[q.id]?.tag && ['C', 'A', 'S', 'T', 'G'].includes(store[q.id].tag)) {
    return normalizeClassification(store[q.id]);
  }

  const textNorm = (q.question || q.questionText || '').trim().toLowerCase();
  if (textNorm && store[textNorm]?.tag && ['C', 'A', 'S', 'T', 'G'].includes(store[textNorm].tag)) {
    return normalizeClassification(store[textNorm]);
  }

  const bMap = bundledMap || bundledRcaCache;
  if (bMap) {
    if (q.id && bMap[q.id]) return normalizeClassification(bMap[q.id]);
    if (textNorm && bMap[textNorm]) return normalizeClassification(bMap[textNorm]);
  }

  return undefined;
}

export function saveQuestionRca(
  targetQ: any,
  tag: RCATagType | null,
  sillyMistakeNote?: string,
  parentSubject?: string,
  subTag?: string
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

    // Map 'A' to 'S' if passed
    const effectiveTag: RCATagType = (tag as any) === 'A' ? 'S' : tag;

    const tagNames: Record<RCATagType, RCAClassification['tagName']> = {
      'C': 'Conceptual Gap',
      'S': 'Silly Mistake',
      'T': 'Time / Ego Trap',
      'G': 'Guesswork Failed'
    };

    const finalNote = effectiveTag === 'S' ? (sillyMistakeNote || targetQ.sillyMistakeNote || '') : undefined;
    let resolvedSubTag = subTag || targetQ.subTag || targetQ.rca?.subTag;
    if (effectiveTag === 'S' && !resolvedSubTag) {
      const derived = getQuestionSillySubTypes({ ...targetQ, rca: { sillyMistakeNote: finalNote } });
      resolvedSubTag = derived[0] || 'unspecified';
    }

    const newRca: RCAClassification = {
      tag: effectiveTag,
      tagName: tagNames[effectiveTag],
      sillyMistakeNote: finalNote,
      subTag: effectiveTag === 'S' ? resolvedSubTag : undefined,
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
