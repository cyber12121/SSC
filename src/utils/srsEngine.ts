import { SRSCard, SRSGrade, SRSSettings, DeckStatistics, ReviewHistoryItem, SRSContentType } from '../types/srs';
import { Question } from '../types';
import { safeStorage } from './safeStorage';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';

const STORAGE_KEY_CARDS = 'cgl_srs_cards_v1';
const STORAGE_KEY_SETTINGS = 'cgl_srs_settings_v1';
const STORAGE_KEY_LAST_SYNC = 'cgl_srs_last_sync';
export const SRS_UPDATED_EVENT = 'cgl_srs_updated';

// Format Date as 'YYYY-MM-DD'
export function formatDayString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDate(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return formatDayString(date);
}

export const DEFAULT_SRS_SETTINGS: SRSSettings = {
  autoAddWrongVocab: true,
  autoAddWrongGK: true,
  autoAddWrongMath: true,
  autoAddWrongReasoning: true,
  autoAddUnattempted: true,
  autoAddSpeedIssues: false,
  showConfirmationBeforeAutoEnroll: true,
  maxNewCardsPerDay: 30,
  maxReviewCardsPerDay: 100,
  defaultReviewMode: 'flashcard',
  // Anti-Overwhelm & Cognitive Burnout Prevention defaults
  dailyReviewCap: 30,
  sprintBatchSize: 10,
  leechThreshold: 4,
  autoCoolOffLeeches: true,
  zenModeDefault: false
};

// ── In-Memory & Local Storage Management ──

export function getSRSSettings(): SRSSettings {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) return { ...DEFAULT_SRS_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SRS_SETTINGS;
}

export function saveSRSSettings(settings: SRSSettings): void {
  try {
    safeStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(SRS_UPDATED_EVENT));
  } catch {}
}

// ── In-Memory Question Hydration Cache ──
const questionBankCache = new Map<string, Question>();

export function registerQuestionsInBank(questions: Question[]): void {
  if (!Array.isArray(questions)) return;
  questions.forEach(q => {
    if (!q) return;
    if (q.id) questionBankCache.set(String(q.id), q);
    if (q.question) {
      const slug = `srs_q_${(q.id || q.question.slice(0, 30)).replace(/[^a-z0-9]/gi, '_')}`;
      questionBankCache.set(slug, q);
    }
  });
}

export function findQuestionById(qId: string): Question | undefined {
  if (!qId) return undefined;
  if (questionBankCache.has(qId)) return questionBankCache.get(qId);

  // Search localStorage cached results
  try {
    const rawKeys = Object.keys(localStorage).filter(k => k.startsWith('cgl_user_results_cache_') || k.startsWith('offline_results_'));
    for (const k of rawKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const results = JSON.parse(raw);
        if (Array.isArray(results)) {
          for (const r of results) {
            for (const qd of (r.questionDetails || [])) {
              if (qd?.question && (String(qd.question.id) === qId || qd.questionId === qId || qd.id === qId)) {
                questionBankCache.set(qId, qd.question);
                return qd.question;
              }
            }
          }
        }
      }
    }
  } catch {}

  return undefined;
}

export function hydrateSRSCard(card: SRSCard): SRSCard {
  if (card.front && card.options && Object.keys(card.options).length > 0) {
    return card;
  }
  const qId = card.questionId || card.id.replace(/^srs_q_/, '');
  const q = findQuestionById(qId) || findQuestionById(card.id);
  if (q) {
    const cleanAns = (q.answer || '').toLowerCase();
    const correctOptText = q.options && cleanAns in q.options ? (q.options as any)[cleanAns] : '';
    let back = q.solution?.trim() || `Correct Answer: Option ${(q.answer || '').toUpperCase()}`;
    if (correctOptText && !back.includes(correctOptText)) {
      back = `**Correct Answer: (${cleanAns.toUpperCase()}) ${correctOptText}**\n\n${back}`;
    }
    return {
      ...card,
      questionId: card.questionId || (q.id ? String(q.id) : undefined),
      front: card.front || q.question,
      back: card.back || back,
      options: card.options || q.options,
      answer: card.answer || q.answer,
      conceptTested: card.conceptTested || q.conceptTested
    };
  }
  return card;
}

export function getStoredSRSCards(): SRSCard[] {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_CARDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(hydrateSRSCard);
    }
  } catch {}
  return [];
}

export function saveStoredSRSCards(cards: SRSCard[], triggerSync = true): void {
  try {
    safeStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(cards));
    window.dispatchEvent(new CustomEvent(SRS_UPDATED_EVENT));
    if (triggerSync) {
      syncCardsToFirestore(cards).catch(() => {});
    }
  } catch (err) {
    console.warn('Error saving SRS cards:', err);
  }
}

// ── SM-2 Spaced Repetition Algorithm ──

export function calculateNextReview(card: SRSCard, grade: SRSGrade, timeSpentSec = 0): SRSCard {
  const today = formatDayString();
  let interval = card.intervalDays || 1;
  let ease = card.easeFactor || 2.5;
  let repetitions = card.repetitions || 0;
  let lapses = card.lapses || 0;
  let stage = card.stage || 0;

  if (grade === 'again') {
    // Failed recall: reset to beginning
    interval = 1;
    repetitions = 0;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.20);
    stage = 1;
  } else if (grade === 'hard') {
    // Recalled with significant struggle
    interval = Math.max(1, Math.round(interval * 1.2));
    repetitions += 1;
    ease = Math.max(1.3, ease - 0.15);
    stage = Math.max(1, stage);
  } else if (grade === 'good') {
    // Standard successful recall
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 3;
    } else {
      interval = Math.round(interval * ease);
    }
    repetitions += 1;
    stage = Math.min(5, stage + 1);
  } else if (grade === 'easy') {
    // Instant reflex
    if (repetitions === 0) {
      interval = 3;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease * 1.35);
    }
    repetitions += 1;
    ease = Math.min(3.5, ease + 0.15);
    stage = Math.min(5, stage + 2);
  }

  const dueDate = addDaysToDate(today, interval);
  const status = interval >= 45 ? 'mastered' : stage >= 2 ? 'review' : 'learning';
  const isLeech = Boolean(card.isLeech || lapses >= 4);

  const historyItem: ReviewHistoryItem = {
    date: new Date().toISOString(),
    grade,
    intervalBefore: card.intervalDays || 0,
    intervalAfter: interval,
    timeSpentSec
  };

  return {
    ...card,
    stage,
    intervalDays: interval,
    easeFactor: Math.round(ease * 100) / 100,
    repetitions,
    lapses,
    isLeech,
    dueDate,
    lastReviewedAt: new Date().toISOString(),
    status,
    history: [...(card.history || []), historyItem]
  };
}

// ── CRUD Operations ──

export function addSRSCard(newCard: Omit<SRSCard, 'id' | 'addedAt' | 'stage' | 'intervalDays' | 'easeFactor' | 'repetitions' | 'lapses' | 'dueDate' | 'status'> & Partial<SRSCard>): SRSCard {
  const cards = getStoredSRSCards();
  const id = newCard.id || `srs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tomorrow = addDaysToDate(formatDayString(), 1);

  const card: SRSCard = {
    id,
    addedAt: new Date().toISOString(),
    stage: 0,
    intervalDays: 1,
    easeFactor: 2.5,
    repetitions: 0,
    lapses: 0,
    dueDate: newCard.dueDate || tomorrow,
    status: 'learning',
    history: [],
    ...newCard
  };

  // Prevent exact duplicate by ID or exact front text
  const existingIdx = cards.findIndex(c => c.id === card.id || c.front.trim().toLowerCase() === card.front.trim().toLowerCase());
  let updatedCards: SRSCard[];

  if (existingIdx >= 0) {
    updatedCards = [...cards];
    updatedCards[existingIdx] = { ...updatedCards[existingIdx], ...card };
  } else {
    updatedCards = [card, ...cards];
  }

  saveStoredSRSCards(updatedCards);
  return card;
}

export function addSRSCardsBatch(newCards: Array<Partial<SRSCard>>): SRSCard[] {
  const existingCards = getStoredSRSCards();
  const existingIdSet = new Set(existingCards.map(c => c.id));
  const existingFrontSet = new Set(existingCards.map(c => c.front.trim().toLowerCase()));
  const tomorrow = addDaysToDate(formatDayString(), 1);

  const addedCards: SRSCard[] = [];

  newCards.forEach(item => {
    if (!item.front || !item.back) return;
    const cleanFront = item.front.trim().toLowerCase();
    if (existingFrontSet.has(cleanFront)) return;

    const id = item.id && !existingIdSet.has(item.id) 
      ? item.id 
      : `srs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const fullCard: SRSCard = {
      id,
      type: item.type || 'mixed',
      subject: normalizeSubject(item.subject),
      topic: item.topic || 'General',
      subtopic: item.subtopic,
      front: item.front.trim(),
      back: item.back.trim(),
      mnemonic: item.mnemonic,
      shortcutFormula: item.shortcutFormula,
      conceptTested: item.conceptTested,
      trapAlert: item.trapAlert,
      contextHint: item.contextHint,
      options: item.options,
      answer: item.answer,
      userPreviousAnswer: item.userPreviousAnswer,
      source: item.source || 'manual',
      sourceTitle: item.sourceTitle,
      addedAt: new Date().toISOString(),
      stage: item.stage || 0,
      intervalDays: item.intervalDays || 1,
      easeFactor: item.easeFactor || 2.5,
      repetitions: item.repetitions || 0,
      lapses: item.lapses || 0,
      dueDate: item.dueDate || tomorrow,
      status: item.status || 'learning',
      history: item.history || []
    };

    addedCards.push(fullCard);
    existingIdSet.add(fullCard.id);
    existingFrontSet.add(cleanFront);
  });

  if (addedCards.length > 0) {
    saveStoredSRSCards([...addedCards, ...existingCards]);
  }

  return addedCards;
}

export function updateSRSCard(cardId: string, updates: Partial<SRSCard>): SRSCard | null {
  const cards = getStoredSRSCards();
  const idx = cards.findIndex(c => c.id === cardId);
  if (idx === -1) return null;

  const updated = { ...cards[idx], ...updates };
  cards[idx] = updated;
  saveStoredSRSCards(cards);
  return updated;
}

export function deleteSRSCard(cardId: string): boolean {
  const cards = getStoredSRSCards();
  const filtered = cards.filter(c => c.id !== cardId);
  if (filtered.length === cards.length) return false;

  saveStoredSRSCards(filtered, false);

  // Also remove from Firestore if user logged in
  if (auth.currentUser) {
    deleteDoc(doc(db, 'users', auth.currentUser.uid, 'srs_cards', cardId)).catch(() => {});
  }
  return true;
}

export function bulkDeleteSRSCards(cardIds: string[]): number {
  const targetSet = new Set(cardIds);
  const cards = getStoredSRSCards();
  const remaining = cards.filter(c => !targetSet.has(c.id));
  const removedCount = cards.length - remaining.length;

  saveStoredSRSCards(remaining, false);

  if (auth.currentUser && removedCount > 0) {
    const batch = writeBatch(db);
    cardIds.forEach(id => {
      batch.delete(doc(db, 'users', auth.currentUser!.uid, 'srs_cards', id));
    });
    batch.commit().catch(() => {});
  }

  return removedCount;
}

export function resetSRSCardInterval(cardId: string): SRSCard | null {
  return updateSRSCard(cardId, {
    stage: 0,
    intervalDays: 1,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: addDaysToDate(formatDayString(), 1),
    status: 'learning'
  });
}

// ── Ingestion Helpers for Questions ──

export function detectQuestionSubjectType(rawSubject: string, rawSection = ''): { subject: string; type: SRSContentType } {
  const sub = (rawSubject + ' ' + rawSection).toLowerCase();
  if (/vocab|synonym|antonym|idiom|spelling|one word|ayush|english|verbal|comprehension/i.test(sub)) {
    return { subject: 'English', type: 'vocab' };
  }
  if (/gk|ga|aware|history|polity|geography|science|biology|physics|chemistry|static|current/i.test(sub)) {
    return { subject: 'General Awareness', type: 'gk' };
  }
  if (/quant|math|aptitude|arithmetic|advance|algebra|trigo|geometry|mensuration/i.test(sub)) {
    return { subject: 'Mathematics', type: 'math' };
  }
  if (/reason|logic|intel|series|coding|analogy|syllogism|puzzle/i.test(sub)) {
    return { subject: 'Reasoning', type: 'reasoning' };
  }
  return { subject: 'General Awareness', type: 'gk' };
}

export function parseTimeSeconds(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;
  const str = String(raw).trim();
  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const numeric = parseInt(str.replace(/[^0-9]/g, ''), 10);
  return isNaN(numeric) ? 0 : numeric;
}

export function getDefaultSubjectAvgTime(subject: string = ''): number {
  const s = subject.toLowerCase();
  if (s.includes('eng') || s.includes('vocab')) return 25;
  if (s.includes('gk') || s.includes('aware') || s.includes('gs')) return 20;
  if (s.includes('math') || s.includes('quant')) return 60;
  if (s.includes('reason')) return 45;
  return 35;
}

export function convertQuestionToSRSCardCandidate(
  q: Question,
  source: 'quiz_wrong' | 'quiz_unattempted' | 'mock_error' | 'bookmark' | 'speed_trap',
  sourceTitle = '',
  userChosenOption = '',
  timeMetrics?: { userTime?: number; avgTime?: number }
): SRSCard {
  const { subject, type } = detectQuestionSubjectType(q.subject || '', q.section || '');
  const topic = q.topic || q.tags?.topic || (type === 'vocab' ? 'Vocabulary' : subject);
  const subtopic = q.subtopic || q.tags?.subtopic || q.section;

  // Extract Mnemonic if present
  let mnemonic = '';
  const sol = q.solution || '';
  const mnemonicMatch = sol.match(/(?:💡|Mnemonic Trick:|Memory trick:|trick:)(.*?)(?:\n\n|\n[📖🎯📌]|$)/is);
  if (mnemonicMatch) {
    mnemonic = mnemonicMatch[1].trim();
  }

  // Extract Speed Trick / Shortcut if present
  let shortcutFormula = '';
  const trickMatch = sol.match(/(?:⚡|Alternate Method|Shortcut|Trick:|Formula:)(.*?)(?:\n\n|\n[📖🎯📌]|$)/is);
  if (trickMatch) {
    shortcutFormula = trickMatch[1].trim();
  }

  const conceptTested = q.conceptTested || q.tags?.conceptTested;
  
  let trapAlert: string | undefined;
  if (source === 'speed_trap' && timeMetrics?.userTime && timeMetrics?.avgTime) {
    trapAlert = `⚡ Speed Alert: You took ${timeMetrics.userTime}s (Avg: ${timeMetrics.avgTime}s). Master the shortcut trick to solve in under ${timeMetrics.avgTime}s!`;
  } else if (userChosenOption) {
    trapAlert = `You selected option (${userChosenOption.toUpperCase()}), but correct answer is (${(q.answer || '').toUpperCase()}).`;
  }

  // For Ayush Vocab: Front is concise, highlighted word
  let front = q.question.trim();
  let back = sol.trim() || `Correct Answer: Option ${(q.answer || '').toUpperCase()}`;

  const cleanAns = (q.answer || '').toLowerCase();
  const correctOptText = q.options && cleanAns in q.options ? (q.options as any)[cleanAns] : '';
  if (correctOptText && !back.includes(correctOptText)) {
    back = `**Correct Answer: (${cleanAns.toUpperCase()}) ${correctOptText}**\n\n${back}`;
  }

  const rawQId = q.id ? String(q.id) : undefined;
  const id = `srs_q_${(rawQId || q.question.slice(0, 30)).replace(/[^a-z0-9]/gi, '_')}`;

  // Cache question in memory for fast local hydration
  if (rawQId) {
    questionBankCache.set(rawQId, q);
    questionBankCache.set(id, q);
  }

  return {
    id,
    questionId: rawQId,
    type,
    subject,
    topic,
    subtopic,
    front,
    back,
    mnemonic: mnemonic || undefined,
    shortcutFormula: shortcutFormula || undefined,
    conceptTested,
    trapAlert,
    options: q.options,
    answer: q.answer,
    userPreviousAnswer: userChosenOption,
    source,
    sourceTitle,
    userTimeSpent: timeMetrics?.userTime,
    avgTimeSeconds: timeMetrics?.avgTime,
    addedAt: new Date().toISOString(),
    stage: 0,
    intervalDays: 1,
    easeFactor: 2.5,
    repetitions: 0,
    lapses: 0,
    dueDate: addDaysToDate(formatDayString(), 1),
    status: 'learning',
    history: []
  };
}

export const convertQuestionToSRSCard = convertQuestionToSRSCardCandidate;

// ── Classification & Subject Normalization Helpers ──

export type CanonicalSubject = 'English' | 'General Awareness' | 'Mathematics' | 'Reasoning';

export function normalizeSubject(rawSubject?: string): CanonicalSubject {
  if (!rawSubject) return 'General Awareness';
  const s = rawSubject.toLowerCase().trim();
  if (s.includes('eng') || s.includes('vocab') || s.includes('idiom') || s.includes('grammar') || s.includes('comprehension')) return 'English';
  if (s.includes('math') || s.includes('quant') || s.includes('arith') || s.includes('geom') || s.includes('algeb') || s.includes('trigo') || s.includes('mensur')) return 'Mathematics';
  if (s.includes('reason') || s.includes('intel') || s.includes('logic') || s.includes('mental') || s.includes('puzzle') || s.includes('series')) return 'Reasoning';
  return 'General Awareness';
}

export function matchesSubject(cardSubject: string = '', filter: string = ''): boolean {
  if (!filter || filter === 'all') return true;
  const f = filter.toLowerCase().trim();
  const s = cardSubject.toLowerCase().trim();

  // Exact match
  if (s === f) return true;

  // English check
  if (f === 'english' || f.includes('eng') || f.includes('vocab')) {
    return s.includes('eng') || s.includes('vocab') || s.includes('idiom') || s.includes('comprehension') || s.includes('grammar');
  }

  // GK / General Knowledge / General Awareness / GS check
  if (
    f === 'gk' ||
    f === 'ga' ||
    f === 'gs' ||
    f.includes('aware') ||
    f.includes('knowledg') ||
    f.includes('general') ||
    f.includes('static')
  ) {
    return (
      s.includes('aware') ||
      s.includes('gk') ||
      s.includes('ga') ||
      s.includes('gs') ||
      s.includes('knowledg') ||
      s.includes('general') ||
      s.includes('hist') ||
      s.includes('polit') ||
      s.includes('geog') ||
      s.includes('sci') ||
      s.includes('econ') ||
      s.includes('static') ||
      s.includes('affair')
    );
  }

  // Mathematics check
  if (f === 'mathematics' || f.includes('math') || f.includes('quant')) {
    return s.includes('math') || s.includes('quant') || s.includes('arith') || s.includes('geom') || s.includes('algeb') || s.includes('trigo');
  }

  // Reasoning check
  if (f === 'reasoning' || f.includes('reason') || f.includes('intel')) {
    return s.includes('reason') || s.includes('intel') || s.includes('logic') || s.includes('mental') || s.includes('puzzle');
  }

  return s.includes(f) || f.includes(s);
}

export function isTestQuestionCard(card: Partial<SRSCard>): boolean {
  return (
    card.source === 'quiz_wrong' ||
    card.source === 'quiz_unattempted' ||
    card.source === 'mock_error' ||
    card.source === 'speed_trap' ||
    Boolean(card.questionRef) ||
    Boolean(card.userPreviousAnswer) ||
    Boolean(card.options && Object.keys(card.options).length > 0)
  );
}

export function getCardCorrectAnswer(card: Partial<SRSCard>): string {
  if (card.answer) return String(card.answer).toLowerCase().trim();
  if (card.questionRef?.answer) return String(card.questionRef.answer).toLowerCase().trim();

  // Try to parse from card.back if string
  if (card.back) {
    const match = card.back.match(/(?:correct\s*answer|answer)\s*:\s*(?:\(?option\s*)?\(?([a-d])\)?/i);
    if (match) return match[1].toLowerCase();
  }

  return '';
}

export function isAnkiFlashcard(card: Partial<SRSCard>): boolean {
  return !isTestQuestionCard(card);
}

// ── Query & Statistics Helpers ──

// ── Anti-Overwhelm & Cognitive Burnout Prevention Helpers ──

export function isLeechCard(card: Partial<SRSCard>, threshold = 4): boolean {
  return Boolean(card.isLeech || (typeof card.lapses === 'number' && card.lapses >= threshold));
}

export function coolOffCard(cardId: string, days = 2): SRSCard | null {
  const coolOffDate = addDaysToDate(formatDayString(), days);
  return updateSRSCard(cardId, {
    coolOffUntil: coolOffDate,
    dueDate: coolOffDate
  });
}

export function resetLeechCard(cardId: string): SRSCard | null {
  return updateSRSCard(cardId, {
    isLeech: false,
    lapses: 0,
    easeFactor: 2.5,
    stage: 0,
    intervalDays: 1,
    coolOffUntil: undefined,
    dueDate: formatDayString(),
    status: 'learning'
  });
}

export function getOverdueCardsCount(cards: SRSCard[]): number {
  const today = formatDayString();
  return cards.filter(c => c.status !== 'suspended' && c.dueDate < today).length;
}

export function triageOverdueBacklog(cards: SRSCard[], daysToSpread = 5): SRSCard[] {
  const today = formatDayString();
  const overdueCards = cards.filter(c => c.status !== 'suspended' && c.dueDate < today);
  if (overdueCards.length === 0) return cards;

  const overdueIdSet = new Set(overdueCards.map(c => c.id));
  const spreadCount = Math.max(2, daysToSpread);

  let counter = 0;
  const updatedCards = cards.map(c => {
    if (overdueIdSet.has(c.id)) {
      // Distribute evenly across 1 to spreadCount days from today
      const offsetDays = (counter % spreadCount) + 1;
      counter++;
      const newDueDate = addDaysToDate(today, offsetDays);
      return { ...c, dueDate: newDueDate };
    }
    return c;
  });

  saveStoredSRSCards(updatedCards);
  return updatedCards;
}

// ── Query & Statistics Helpers ──

export interface ChapterDeckSummary {
  chapterName: string;
  subject: string;
  totalCards: number;
  dueToday: number;
  mastered: number;
  learning: number;
}

export interface SubjectDeckGroup {
  subject: 'English' | 'General Awareness' | 'Mathematics' | 'Reasoning';
  displayName: string;
  totalCards: number;
  dueToday: number;
  mastered: number;
  chapters: ChapterDeckSummary[];
}

export function computeSubjectChapterGroups(cards: SRSCard[]): SubjectDeckGroup[] {
  const today = formatDayString();
  const subjects: Array<{ key: 'English' | 'General Awareness' | 'Mathematics' | 'Reasoning'; label: string }> = [
    { key: 'English', label: 'English Vocab' },
    { key: 'General Awareness', label: 'General Knowledge & GA' },
    { key: 'Mathematics', label: 'Quantitative Aptitude (Math)' },
    { key: 'Reasoning', label: 'General Intelligence & Reasoning' }
  ];

  return subjects.map(sub => {
    const subCards = cards.filter(c => matchesSubject(c.subject, sub.key));
    const chapterMap = new Map<string, SRSCard[]>();

    subCards.forEach(c => {
      const rawName = (c.topic || c.subtopic || 'General Topics').trim();
      const chapterName = rawName || 'General Topics';
      const existing = chapterMap.get(chapterName) || [];
      existing.push(c);
      chapterMap.set(chapterName, existing);
    });

    const chapters: ChapterDeckSummary[] = Array.from(chapterMap.entries()).map(([chapterName, chCards]) => {
      let dueToday = 0;
      let mastered = 0;
      let learning = 0;

      chCards.forEach(c => {
        const isDue = c.status !== 'suspended' && (!c.coolOffUntil || c.coolOffUntil <= today) && c.dueDate <= today;
        const isMastered = c.status === 'mastered' || c.intervalDays >= 45;
        if (isDue) dueToday++;
        if (isMastered) mastered++;
        else if (c.stage <= 1) learning++;
      });

      return {
        chapterName,
        subject: sub.key,
        totalCards: chCards.length,
        dueToday,
        mastered,
        learning
      };
    }).sort((a, b) => {
      if (b.dueToday !== a.dueToday) return b.dueToday - a.dueToday;
      return b.totalCards - a.totalCards;
    });

    let totalDue = 0;
    let totalMastered = 0;
    subCards.forEach(c => {
      if (c.status !== 'suspended' && (!c.coolOffUntil || c.coolOffUntil <= today) && c.dueDate <= today) totalDue++;
      if (c.status === 'mastered' || c.intervalDays >= 45) totalMastered++;
    });

    return {
      subject: sub.key,
      displayName: sub.label,
      totalCards: subCards.length,
      dueToday: totalDue,
      mastered: totalMastered,
      chapters
    };
  });
}

export function getDueSRSCards(
  cards: SRSCard[],
  subjectFilter: string | 'all' = 'all',
  limit?: number,
  chapterFilter: string | 'all' = 'all'
): SRSCard[] {
  const today = formatDayString();
  const due = cards.filter(card => {
    if (card.status === 'suspended') return false;
    // Hide cards currently in a cool-off rest period
    if (card.coolOffUntil && card.coolOffUntil > today) return false;
    if (subjectFilter !== 'all' && !matchesSubject(card.subject, subjectFilter)) {
      return false;
    }
    if (chapterFilter !== 'all') {
      const cardChap = (card.topic || card.subtopic || '').trim();
      if (cardChap !== chapterFilter) return false;
    }
    return card.dueDate <= today;
  });

  if (typeof limit === 'number' && limit > 0) {
    return due.slice(0, limit);
  }
  return due;
}

export function computeDeckStats(cards: SRSCard[]): DeckStatistics {
  const today = formatDayString();
  let dueToday = 0;
  let learning = 0;
  let review = 0;
  let mastered = 0;

  const bySubject = {
    english: { total: 0, due: 0, mastered: 0 },
    gk: { total: 0, due: 0, mastered: 0 },
    mathematics: { total: 0, due: 0, mastered: 0 },
    reasoning: { total: 0, due: 0, mastered: 0 },
  };

  cards.forEach(card => {
    const isDue = card.status !== 'suspended' && (!card.coolOffUntil || card.coolOffUntil <= today) && card.dueDate <= today;
    const isMastered = card.status === 'mastered' || card.intervalDays >= 45;
    const isLearning = card.stage <= 1;

    if (isDue) dueToday++;
    if (isMastered) mastered++;
    else if (isLearning) learning++;
    else review++;

    if (matchesSubject(card.subject, 'english')) {
      bySubject.english.total++;
      if (isDue) bySubject.english.due++;
      if (isMastered) bySubject.english.mastered++;
    } else if (matchesSubject(card.subject, 'gk')) {
      bySubject.gk.total++;
      if (isDue) bySubject.gk.due++;
      if (isMastered) bySubject.gk.mastered++;
    } else if (matchesSubject(card.subject, 'mathematics')) {
      bySubject.mathematics.total++;
      if (isDue) bySubject.mathematics.due++;
      if (isMastered) bySubject.mathematics.mastered++;
    } else if (matchesSubject(card.subject, 'reasoning')) {
      bySubject.reasoning.total++;
      if (isDue) bySubject.reasoning.due++;
      if (isMastered) bySubject.reasoning.mastered++;
    }
  });

  // Calculate Streak and Today's Retention Rate from review history
  let reviewsToday = 0;
  let successfulReviewsToday = 0;
  const activeDays = new Set<string>();

  cards.forEach(card => {
    card.history?.forEach(h => {
      const day = h.date.slice(0, 10);
      activeDays.add(day);
      if (day === today) {
        reviewsToday++;
        if (h.grade === 'good' || h.grade === 'easy') {
          successfulReviewsToday++;
        }
      }
    });
  });

  // Calculate consecutive streak
  let streakDays = 0;
  let checkDate = new Date();
  while (true) {
    const dayStr = formatDayString(checkDate);
    if (activeDays.has(dayStr)) {
      streakDays++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Allow today to not break streak if user hasn't studied yet today
      if (streakDays === 0 && dayStr === today) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    }
  }

  const retentionRateToday = reviewsToday > 0 
    ? Math.round((successfulReviewsToday / reviewsToday) * 100) 
    : 100;

  return {
    totalCards: cards.length,
    dueToday,
    learning,
    review,
    mastered,
    streakDays,
    retentionRateToday,
    bySubject
  };
}

// ── Firebase Firestore Cloud Sync ──

export async function syncCardsToFirestore(cards: SRSCard[]): Promise<void> {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  try {
    const batch = writeBatch(db);
    // Write up to 250 cards in batch
    const toSync = cards.slice(0, 250);
    toSync.forEach(card => {
      const cardRef = doc(db, 'users', uid, 'srs_cards', card.id);
      
      let payload: any;
      // If card has a questionId, keep Firebase ultra-lightweight:
      // Store only the pointer ID and SM-2 metadata, omitting heavy question text, options, and questionRef
      if (card.questionId) {
        payload = {
          id: card.id,
          questionId: card.questionId,
          type: card.type,
          subject: card.subject,
          topic: card.topic || '',
          subtopic: card.subtopic || '',
          source: card.source,
          sourceTitle: card.sourceTitle || '',
          answer: card.answer || '',
          userPreviousAnswer: card.userPreviousAnswer || '',
          userTimeSpent: card.userTimeSpent || 0,
          avgTimeSeconds: card.avgTimeSeconds || 0,
          addedAt: card.addedAt,
          stage: card.stage,
          intervalDays: card.intervalDays,
          easeFactor: card.easeFactor,
          repetitions: card.repetitions,
          lapses: card.lapses,
          dueDate: card.dueDate,
          lastReviewedAt: card.lastReviewedAt || null,
          status: card.status,
          history: card.history || [],
          conceptTested: card.conceptTested || '',
          trapAlert: card.trapAlert || ''
        };
      } else {
        // Conceptual card (e.g. vocab flashcard, GK fact): strip questionRef if present
        const { questionRef, ...cleanCard } = card as any;
        payload = cleanCard;
      }

      const sanitized = JSON.parse(JSON.stringify(payload));
      batch.set(cardRef, sanitized, { merge: true });
    });
    await batch.commit();
    safeStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());
  } catch (e) {
    console.warn('Firestore SRS sync deferred (offline or permission):', e);
  }
}

export async function loadCardsFromFirestore(): Promise<SRSCard[]> {
  if (!auth.currentUser) return getStoredSRSCards();
  const uid = auth.currentUser.uid;
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'srs_cards'));
    if (!snapshot.empty) {
      const remoteCards: SRSCard[] = [];
      snapshot.forEach(d => remoteCards.push(d.data() as SRSCard));

      // Merge remote with local cards
      const localCards = getStoredSRSCards();
      const localMap = new Map(localCards.map(c => [c.id, c]));

      remoteCards.forEach(rc => {
        const local = localMap.get(rc.id);
        if (!local) {
          // Hydrate from question bank if stored as a lightweight pointer
          localMap.set(rc.id, hydrateSRSCard(rc));
        } else {
          // Merge remote progress while preserving local rich question content
          const shouldUpdate = !local.lastReviewedAt || (rc.lastReviewedAt && rc.lastReviewedAt > local.lastReviewedAt);
          localMap.set(rc.id, {
            ...local,
            ...(shouldUpdate ? rc : {}),
            // Always retain full question details if remote document omitted them
            front: local.front || rc.front,
            back: local.back || rc.back,
            options: local.options || rc.options,
            answer: local.answer || rc.answer,
            questionId: local.questionId || rc.questionId,
            questionRef: local.questionRef
          });
        }
      });

      const merged = Array.from(localMap.values());
      saveStoredSRSCards(merged, false);
      return merged;
    }
  } catch (e) {
    console.warn('Could not load cards from Firestore, using local:', e);
  }
  return getStoredSRSCards();
}

// ── Export & Backup Helpers ──

export function exportCardsToJson(cards: SRSCard[], filename = 'cgl_anki_deck_backup.json'): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cards, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportCardsToCsv(cards: SRSCard[], filename = 'cgl_anki_deck.csv'): void {
  const headers = ['Front', 'Back', 'Mnemonic/Trick', 'Subject', 'Topic', 'Shortcut/Formula'];
  const escapeCsv = (str?: string) => {
    if (!str) return '""';
    return '"' + str.replace(/"/g, '""').replace(/\n/g, ' ') + '"';
  };

  const rows = cards.map(c => [
    escapeCsv(c.front),
    escapeCsv(c.back),
    escapeCsv(c.mnemonic || ''),
    escapeCsv(c.subject),
    escapeCsv(c.topic || ''),
    escapeCsv(c.shortcutFormula || '')
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
}

export async function parseImportedDeckFile(file: File): Promise<Array<Partial<SRSCard>>> {
  const text = await file.text();
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.json')) {
    const parsed = JSON.parse(text);
    const rawList = Array.isArray(parsed) ? parsed : (parsed.cards || []);
    return rawList.map((item: any) => ({
      front: item.front || item.question || '',
      back: item.back || item.answer || item.solution || '',
      mnemonic: item.mnemonic || item.trick,
      shortcutFormula: item.shortcutFormula || item.formula,
      subject: normalizeSubject(item.subject),
      topic: item.topic || 'General',
      subtopic: item.subtopic,
      source: 'imported_backup' as any
    })).filter((c: any) => c.front && c.back);
  }

  // Otherwise assume CSV / TSV
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0].toLowerCase();
  const isHeader = firstLine.includes('front') && (firstLine.includes('back') || firstLine.includes('answer'));
  const dataLines = isHeader ? lines.slice(1) : lines;

  return dataLines.map(line => {
    const delimiter = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
    const parts: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        parts.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    parts.push(cur.trim());

    const front = parts[0] || '';
    const back = parts[1] || '';
    const mnemonic = parts[2] || undefined;
    const subject = parts[3] ? normalizeSubject(parts[3]) : 'General Awareness';
    const topic = parts[4] || 'Imported';
    const shortcutFormula = parts[5] || undefined;

    return {
      front,
      back,
      mnemonic,
      subject,
      topic,
      shortcutFormula,
      source: 'imported_backup' as any
    };
  }).filter((c: any) => c.front && c.back);
}

