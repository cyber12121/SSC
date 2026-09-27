import fs from 'fs';
import path from 'path';
import os from 'os';
import { TelegramQuizQuestion, sanitizeTelegramQuiz, shuffle } from './quizData';

export type MistakeSource = 'telegram_drill' | 'website_mock';
export type MistakeFilter = 'all' | 'telegram_drill' | 'website_mock';

export interface RecordedMistake {
  id: string;
  userId: number;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness';
  topic: string;
  topicSlug: string;
  chapter?: string;
  source: MistakeSource;
  timestamp: number;
  wrongCount: number;
  mastered: boolean;
}

// ----------------------------------------------------
// PERSISTENT DISK STORE FOR TELEGRAM WRONG ANSWERS
// ----------------------------------------------------

const TMP_FILE = path.join(os.tmpdir(), 'cgl_user_mistakes.json');

// In-memory cache: userId -> Map<questionId, RecordedMistake>
const userMistakesMap = new Map<number, Map<string, RecordedMistake>>();

function saveToDisk() {
  try {
    const serialized: Record<string, RecordedMistake[]> = {};
    for (const [userId, map] of userMistakesMap.entries()) {
      serialized[String(userId)] = Array.from(map.values());
    }
    fs.writeFileSync(TMP_FILE, JSON.stringify(serialized), 'utf8');
  } catch (err) {
    console.error('[MistakeStore] Error saving to disk:', err);
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
      for (const [userIdStr, list] of Object.entries(parsed)) {
        const userId = Number(userIdStr);
        if (!userMistakesMap.has(userId)) {
          userMistakesMap.set(userId, new Map());
        }
        const userMap = userMistakesMap.get(userId)!;
        if (Array.isArray(list)) {
          for (const item of list as RecordedMistake[]) {
            userMap.set(item.id, item);
          }
        }
      }
    }
  } catch (err) {
    console.error('[MistakeStore] Error loading from disk:', err);
  }
}

loadFromDisk();

// ----------------------------------------------------
// WEBSITE MOCK ERRORS CACHE (STATIC IN-MEMORY BUNDLED FOR VERCEL)
// ----------------------------------------------------

import englishMockRaw from '../data/mock_errors/english.json';
import mathMockRaw from '../data/mock_errors/mathematics.json';
import reasMockRaw from '../data/mock_errors/reasoning.json';
import gaMockRaw from '../data/mock_errors/general_awareness.json';

const MOCK_RAW_DATA: Record<string, any[]> = {
  english: englishMockRaw as any[],
  mathematics: mathMockRaw as any[],
  reasoning: reasMockRaw as any[],
  general_awareness: gaMockRaw as any[],
};

const mockErrorsCache = new Map<'english' | 'mathematics' | 'reasoning' | 'general_awareness', TelegramQuizQuestion[]>();

function loadCachedMockErrors(subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness'): TelegramQuizQuestion[] {
  if (mockErrorsCache.has(subject)) {
    return mockErrorsCache.get(subject)!;
  }

  const results: TelegramQuizQuestion[] = [];
  try {
    const content = MOCK_RAW_DATA[subject] || [];
    if (Array.isArray(content)) {
      for (const item of content) {
        if (Array.isArray(item.questions)) {
          for (let idx = 0; idx < item.questions.length; idx++) {
            const q = item.questions[idx];
            const qText = (q.question || q.questionText || '').replace(/^\s*\[.*?\]\s*/g, '').trim();
            if (!qText) continue;

            const sanitized = sanitizeTelegramQuiz({
              id: q.id || `mock_${subject}_${idx}`,
              question: qText,
              options: q.options,
              correctOption: q.answer || q.correctOption || q.correct_answer,
              solution: q.solution,
              subject: subject === 'english' ? 'English' : subject === 'mathematics' ? 'Mathematics' : subject === 'reasoning' ? 'Reasoning' : 'General Awareness',
              topic: q.subtopic || q.topic || q.conceptTested || 'Error Bank',
              source: q.testName || '💻 Website Mock Error',
            });
            results.push(sanitized);
          }
        }
      }
    }
  } catch (err) {
    console.error(`[MistakeStore] Error loading mock errors for ${subject}:`, err);
  }

  mockErrorsCache.set(subject, results);
  return results;
}

// ----------------------------------------------------
// INTELLIGENT TOPIC CLASSIFIER & NORMALIZER
// ----------------------------------------------------

export interface TopicInfo {
  slug: string;
  name: string;
}

export function classifySubjectAndTopic(q: TelegramQuizQuestion): {
  subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness';
  topic: string;
  topicSlug: string;
} {
  const text = `${q.question} ${q.explanation || ''} ${q.subject || ''} ${q.topic || ''} ${q.source || ''}`.toLowerCase();

  // 1. Determine Subject
  let subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness' = 'general_awareness';
  const subStr = (q.subject || '').toLowerCase();

  if (
    subStr.includes('eng') ||
    text.includes('synonym') ||
    text.includes('antonym') ||
    text.includes('idiom') ||
    text.includes('one word') ||
    text.includes('sentence') ||
    text.includes('misspelt')
  ) {
    subject = 'english';
  } else if (
    subStr.includes('math') ||
    subStr.includes('calc') ||
    subStr.includes('quant') ||
    text.includes('calculate') ||
    text.includes('triplet') ||
    text.includes('ratio') ||
    text.includes('circumference') ||
    text.includes('hypotenuse')
  ) {
    subject = 'mathematics';
  } else if (
    subStr.includes('reason') ||
    text.includes('syllogism') ||
    text.includes('analogy') ||
    text.includes('blood relation') ||
    text.includes('coding-decoding') ||
    text.includes('letter series')
  ) {
    subject = 'reasoning';
  }

  // 2. Classify Subtopic and assign short slug
  let topic = 'General Practice';
  let topicSlug = 'gen';

  if (subject === 'english') {
    if (text.includes('synonym') || text.includes('similar meaning')) {
      topic = 'Synonyms';
      topicSlug = 'syn';
    } else if (text.includes('antonym') || text.includes('opposite')) {
      topic = 'Antonyms';
      topicSlug = 'ant';
    } else if (text.includes('one word') || text.includes('ows') || text.includes('substituted')) {
      topic = 'One Word Substitution';
      topicSlug = 'ows';
    } else if (text.includes('idiom') || text.includes('phrase')) {
      topic = 'Idioms & Phrases';
      topicSlug = 'idioms';
    } else if (text.includes('spelling') || text.includes('misspelt') || text.includes('correctly spelt')) {
      topic = 'Spelling Errors';
      topicSlug = 'spell';
    } else if (text.includes('spotting') || text.includes('grammatical error') || text.includes('error spotting')) {
      topic = 'Spotting Errors';
      topicSlug = 'error';
    } else if (text.includes('improvement') || text.includes('filler') || text.includes('blank')) {
      topic = 'Sentence Improvement & Fillers';
      topicSlug = 'improve';
    } else if (text.includes('voice') || text.includes('passive')) {
      topic = 'Active & Passive Voice';
      topicSlug = 'voice';
    } else if (text.includes('narration') || text.includes('direct') || text.includes('indirect')) {
      topic = 'Direct & Indirect Speech';
      topicSlug = 'narration';
    } else if (text.includes('jumble') || text.includes('pqrs') || text.includes('rearrangement')) {
      topic = 'Para Jumbles (PQRS)';
      topicSlug = 'pqrs';
    } else if (text.includes('cloze') || text.includes('comprehension')) {
      topic = 'Cloze & Comprehension';
      topicSlug = 'cloze';
    } else {
      topic = 'Vocabulary & Grammar';
      topicSlug = 'vocab';
    }
  } else if (subject === 'general_awareness') {
    if (
      text.includes('polity') ||
      text.includes('article') ||
      text.includes('constitution') ||
      text.includes('amendment') ||
      text.includes('parliament') ||
      text.includes('president') ||
      text.includes('fundamental') ||
      text.includes('schedule') ||
      text.includes('court')
    ) {
      topic = 'Polity & Constitution';
      topicSlug = 'polity';
    } else if (
      text.includes('history') ||
      text.includes('sultanate') ||
      text.includes('mughal') ||
      text.includes('harappan') ||
      text.includes('mauryan') ||
      text.includes('british') ||
      text.includes('gandhi') ||
      text.includes('revolt') ||
      text.includes('vedic') ||
      text.includes('freedom movement')
    ) {
      topic = 'History (Ancient, Med, Mod)';
      topicSlug = 'history';
    } else if (
      text.includes('geography') ||
      text.includes('river') ||
      text.includes('mountain') ||
      text.includes('climate') ||
      text.includes('soil') ||
      text.includes('ocean') ||
      text.includes('ramsar') ||
      text.includes('national park')
    ) {
      topic = 'Geography & Environment';
      topicSlug = 'geo';
    } else if (
      text.includes('econom') ||
      text.includes('gdp') ||
      text.includes('inflation') ||
      text.includes('rbi') ||
      text.includes('budget') ||
      text.includes('fiscal') ||
      text.includes('monetary')
    ) {
      topic = 'Economics & Budget';
      topicSlug = 'eco';
    } else if (
      text.includes('physics') ||
      text.includes('chemistry') ||
      text.includes('biology') ||
      text.includes('cell') ||
      text.includes('vitamin') ||
      text.includes('disease') ||
      text.includes('acid') ||
      text.includes('energy')
    ) {
      topic = 'General Science';
      topicSlug = 'science';
    } else if (
      text.includes('dance') ||
      text.includes('festival') ||
      text.includes('temple') ||
      text.includes('music') ||
      text.includes('instrument') ||
      text.includes('painting') ||
      text.includes('heritage')
    ) {
      topic = 'Art, Culture & Dance';
      topicSlug = 'culture';
    } else if (text.includes('sport') || text.includes('trophy') || text.includes('cup') || text.includes('olympic') || text.includes('award')) {
      topic = 'Sports & Awards';
      topicSlug = 'sports';
    } else {
      topic = 'Static GK & Current Affairs';
      topicSlug = 'static';
    }
  } else if (subject === 'mathematics') {
    if (text.includes('percent')) {
      topic = 'Percentage';
      topicSlug = 'percent';
    } else if (text.includes('profit') || text.includes('loss') || text.includes('discount')) {
      topic = 'Profit, Loss & Discount';
      topicSlug = 'profit';
    } else if (text.includes('ratio') || text.includes('proportion') || text.includes('mixture') || text.includes('alligation') || text.includes('coin')) {
      topic = 'Ratio, Proportion & Mixture';
      topicSlug = 'ratio';
    } else if (text.includes('speed') || text.includes('distance') || text.includes('train') || text.includes('boat') || text.includes('stream')) {
      topic = 'Speed, Distance & Boats';
      topicSlug = 'tsd';
    } else if (text.includes('work') || text.includes('pipe') || text.includes('cistern') || text.includes('efficiency')) {
      topic = 'Time & Work / Pipes';
      topicSlug = 'work';
    } else if (text.includes('interest') || text.includes('ci') || text.includes('si') || text.includes('compound') || text.includes('simple interest')) {
      topic = 'Simple & Compound Interest';
      topicSlug = 'interest';
    } else if (text.includes('geometry') || text.includes('triangle') || text.includes('circle') || text.includes('triplet') || text.includes('chord')) {
      topic = 'Geometry & Triplets';
      topicSlug = 'geom';
    } else if (text.includes('mensuration') || text.includes('cylinder') || text.includes('sphere') || text.includes('cone') || text.includes('cuboid')) {
      topic = 'Mensuration 2D & 3D';
      topicSlug = 'mens';
    } else if (text.includes('algebra') || text.includes('polynomial') || text.includes('quadratic')) {
      topic = 'Algebra';
      topicSlug = 'algebra';
    } else if (text.includes('trigonometr') || text.includes('sin') || text.includes('cos') || text.includes('tan') || text.includes('height')) {
      topic = 'Trigonometry & Heights';
      topicSlug = 'trig';
    } else if (text.includes('number system') || text.includes('divisib') || text.includes('remainder') || text.includes('unit digit') || text.includes('lcm') || text.includes('hcf')) {
      topic = 'Number System, LCM & HCF';
      topicSlug = 'number';
    } else if (text.includes('table') || text.includes('square') || text.includes('cube') || text.includes('power') || text.includes('simplification')) {
      topic = 'Calculation Studio';
      topicSlug = 'calc';
    } else {
      topic = 'General Arithmetic';
      topicSlug = 'arith';
    }
  } else if (subject === 'reasoning') {
    if (text.includes('coding') || text.includes('decoding') || text.includes('letter code')) {
      topic = 'Coding-Decoding';
      topicSlug = 'coding';
    } else if (text.includes('syllogism') || text.includes('venn')) {
      topic = 'Syllogism & Venn';
      topicSlug = 'syllogism';
    } else if (text.includes('blood relation')) {
      topic = 'Blood Relations';
      topicSlug = 'blood';
    } else if (text.includes('series') || text.includes('pattern') || text.includes('missing number')) {
      topic = 'Series & Pattern';
      topicSlug = 'series';
    } else if (text.includes('analogy') || text.includes('classification') || text.includes('odd one')) {
      topic = 'Analogy & Classification';
      topicSlug = 'analogy';
    } else if (text.includes('direction')) {
      topic = 'Direction Sense';
      topicSlug = 'direction';
    } else if (text.includes('mirror') || text.includes('water image') || text.includes('paper folding') || text.includes('embedded')) {
      topic = 'Non-Verbal Reasoning';
      topicSlug = 'nonverbal';
    } else if (text.includes('dictionary') || text.includes('order') || text.includes('ranking') || text.includes('bodmas')) {
      topic = 'BODMAS & Ranking';
      topicSlug = 'bodmas';
    } else {
      topic = 'General Intelligence';
      topicSlug = 'logic';
    }
  }

  return { subject, topic, topicSlug };
}

// ----------------------------------------------------
// RECORD & UPDATE MISTAKES
// ----------------------------------------------------

export function recordMistake(
  userId: number,
  q: TelegramQuizQuestion,
  source: MistakeSource = 'telegram_drill'
) {
  loadFromDisk();

  if (!userMistakesMap.has(userId)) {
    userMistakesMap.set(userId, new Map());
  }

  const userMap = userMistakesMap.get(userId)!;
  const { subject, topic, topicSlug } = classifySubjectAndTopic(q);
  const qId = q.id || `mistake_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const existing = userMap.get(qId);
  if (existing) {
    existing.wrongCount += 1;
    existing.timestamp = Date.now();
    existing.mastered = false;
  } else {
    userMap.set(qId, {
      id: qId,
      userId,
      question: q.question,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation || '',
      subject,
      topic,
      topicSlug,
      source,
      timestamp: Date.now(),
      wrongCount: 1,
      mastered: false,
    });
  }

  saveToDisk();
}

export function markMistakeMastered(userId: number, qId: string) {
  loadFromDisk();
  const userMap = userMistakesMap.get(userId);
  if (userMap && userMap.has(qId)) {
    const item = userMap.get(qId)!;
    item.mastered = true;
    saveToDisk();
  }
}

// ----------------------------------------------------
// PERSISTENT DELETED QUESTIONS TRACKER (SYNCED WITH FIRESTORE)
// ----------------------------------------------------

const DELETED_FILE = path.join(os.tmpdir(), 'cgl_deleted_mistakes.json');
const deletedQuestionsSet = new Set<string>();

function saveDeletedToDisk() {
  try {
    fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(deletedQuestionsSet)), 'utf8');
  } catch (err) {
    console.error('[MistakeStore] Error saving deleted questions to disk:', err);
  }
}

function loadDeletedFromDisk() {
  try {
    if (fs.existsSync(DELETED_FILE)) {
      const list = JSON.parse(fs.readFileSync(DELETED_FILE, 'utf8'));
      if (Array.isArray(list)) {
        for (const id of list) {
          if (id) deletedQuestionsSet.add(String(id).trim().toLowerCase());
        }
      }
    }
  } catch (err) {
    console.error('[MistakeStore] Error loading deleted questions from disk:', err);
  }
}

loadDeletedFromDisk();

export function isQuestionDeleted(id?: string, text?: string): boolean {
  loadDeletedFromDisk();
  if (id && deletedQuestionsSet.has(id.trim().toLowerCase())) return true;
  if (text) {
    const clean = text.trim().toLowerCase();
    if (deletedQuestionsSet.has(clean)) return true;
  }
  return false;
}

export function deleteMistake(userId: number | undefined, qId: string, qText?: string) {
  loadFromDisk();
  loadDeletedFromDisk();

  if (qId) deletedQuestionsSet.add(qId.trim().toLowerCase());
  if (qText) deletedQuestionsSet.add(qText.trim().toLowerCase());
  saveDeletedToDisk();

  if (userId && userMistakesMap.has(userId)) {
    userMistakesMap.get(userId)!.delete(qId);
  } else {
    for (const map of userMistakesMap.values()) {
      map.delete(qId);
      for (const [k, v] of map.entries()) {
        if (v.question === qText || v.id === qId) {
          map.delete(k);
        }
      }
    }
  }
  saveToDisk();
}

export function syncDeletedQuestions(ids: string[]) {
  loadDeletedFromDisk();
  for (const id of ids) {
    if (id) deletedQuestionsSet.add(String(id).trim().toLowerCase());
  }
  saveDeletedToDisk();
}

export function getDeletedQuestionIds(): string[] {
  loadDeletedFromDisk();
  return Array.from(deletedQuestionsSet);
}

export function getAllRecordedMistakes(
  filter: MistakeFilter = 'all',
  subject?: 'english' | 'mathematics' | 'reasoning' | 'general_awareness',
  topicSlug?: string
): RecordedMistake[] {
  loadFromDisk();
  loadDeletedFromDisk();

  const results: RecordedMistake[] = [];
  const seenIds = new Set<string>();

  // 1. Dynamic Telegram mistakes
  if (filter === 'all' || filter === 'telegram_drill') {
    for (const map of userMistakesMap.values()) {
      for (const item of map.values()) {
        if (item.mastered) continue;
        if (isQuestionDeleted(item.id, item.question)) continue;
        if (subject && item.subject !== subject) continue;
        if (topicSlug && topicSlug !== '_' && item.topicSlug !== topicSlug) continue;

        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    }
  }

  // 2. Website Mock Mistakes
  if (filter === 'all' || filter === 'website_mock') {
    const subjectsToLoad: ('english' | 'mathematics' | 'reasoning' | 'general_awareness')[] = subject
      ? [subject]
      : ['english', 'mathematics', 'reasoning', 'general_awareness'];

    for (const sub of subjectsToLoad) {
      const mockList = loadCachedMockErrors(sub);
      for (const mq of mockList) {
        if (seenIds.has(mq.id)) continue;
        if (isQuestionDeleted(mq.id, mq.question)) continue;
        const classified = classifySubjectAndTopic(mq);
        if (topicSlug && topicSlug !== '_' && classified.topicSlug !== topicSlug) continue;

        seenIds.add(mq.id);
        results.push({
          id: mq.id,
          userId: 0,
          question: mq.question,
          options: mq.options,
          correctOptionIndex: mq.correctOptionIndex,
          explanation: mq.explanation || '',
          subject: classified.subject,
          topic: classified.topic,
          topicSlug: classified.topicSlug,
          source: 'website_mock',
          timestamp: Date.now(),
          wrongCount: 1,
          mastered: false,
        });
      }
    }
  }

  return results;
}

// ----------------------------------------------------
// QUERY & FILTER MISTAKES
// ----------------------------------------------------

export function getUserMistakes(
  userId: number,
  filter: MistakeFilter = 'all',
  subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness' | undefined = undefined,
  topicSlug: string | undefined = undefined
): TelegramQuizQuestion[] {
  loadFromDisk();
  loadDeletedFromDisk();

  const results: TelegramQuizQuestion[] = [];
  const seenQIds = new Set<string>();

  // 1. Dynamic mistakes recorded from Telegram bot
  if (filter === 'all' || filter === 'telegram_drill') {
    const userMap = userMistakesMap.get(userId);
    if (userMap) {
      for (const item of userMap.values()) {
        if (item.mastered) continue;
        if (isQuestionDeleted(item.id, item.question)) continue;
        if (filter !== 'all' && item.source !== filter) continue;
        if (subject && item.subject !== subject) continue;
        if (topicSlug && topicSlug !== '_' && item.topicSlug !== topicSlug) continue;

        seenQIds.add(item.id);
        results.push({
          id: item.id,
          question: item.question,
          options: item.options,
          correctOptionIndex: item.correctOptionIndex,
          explanation: item.explanation,
          subject: item.subject,
          topic: item.topic,
          source: '📱 Telegram Drill Mistake',
        });
      }
    }
  }

  // 2. Website Mock Errors
  if (filter === 'all' || filter === 'website_mock') {
    const subjectsToLoad: ('english' | 'mathematics' | 'reasoning' | 'general_awareness')[] = subject
      ? [subject]
      : ['english', 'mathematics', 'reasoning', 'general_awareness'];

    for (const sub of subjectsToLoad) {
      const mockList = loadCachedMockErrors(sub);
      for (const mq of mockList) {
        if (seenQIds.has(mq.id)) continue;
        if (isQuestionDeleted(mq.id, mq.question)) continue;
        const classified = classifySubjectAndTopic(mq);
        if (topicSlug && topicSlug !== '_' && classified.topicSlug !== topicSlug) continue;

        seenQIds.add(mq.id);
        results.push(mq);
      }
    }
  }

  return results;
}

// ----------------------------------------------------
// COUNTS BY SUBJECT & TOPIC (FOR FILTER MENUS)
// ----------------------------------------------------

export interface TopicStat {
  topic: string;
  slug: string;
  count: number;
}

export interface SubjectMistakeStats {
  subjectId: 'english' | 'mathematics' | 'reasoning' | 'general_awareness';
  shortCode: 'eng' | 'math' | 'reas' | 'ga';
  title: string;
  total: number;
  topics: TopicStat[];
}

export function getMistakeStats(
  userId: number,
  filter: MistakeFilter = 'all'
): SubjectMistakeStats[] {
  loadFromDisk();
  loadDeletedFromDisk();

  const subjects: {
    id: 'english' | 'mathematics' | 'reasoning' | 'general_awareness';
    shortCode: 'eng' | 'math' | 'reas' | 'ga';
    title: string;
  }[] = [
    { id: 'english', shortCode: 'eng', title: '📖 English' },
    { id: 'mathematics', shortCode: 'math', title: '📐 Mathematics' },
    { id: 'reasoning', shortCode: 'reas', title: '🧠 Reasoning' },
    { id: 'general_awareness', shortCode: 'ga', title: '🏛️ General Awareness' },
  ];

  return subjects.map((sub) => {
    const topicMap = new Map<string, { topic: string; slug: string; count: number }>();
    let total = 0;
    const seenQIds = new Set<string>();

    // 1. Dynamic Telegram errors
    if (filter === 'all' || filter === 'telegram_drill') {
      const userMap = userMistakesMap.get(userId);
      if (userMap) {
        for (const item of userMap.values()) {
          if (item.mastered) continue;
          if (isQuestionDeleted(item.id, item.question)) continue;
          if (filter !== 'all' && item.source !== filter) continue;
          if (item.subject === sub.id) {
            seenQIds.add(item.id);
            total++;
            const existing = topicMap.get(item.topicSlug) || {
              topic: item.topic,
              slug: item.topicSlug,
              count: 0,
            };
            existing.count++;
            topicMap.set(item.topicSlug, existing);
          }
        }
      }
    }

    // 2. Website Mock Errors
    if (filter === 'all' || filter === 'website_mock') {
      const mockList = loadCachedMockErrors(sub.id);
      for (const mq of mockList) {
        if (seenQIds.has(mq.id)) continue;
        if (isQuestionDeleted(mq.id, mq.question)) continue;
        const classified = classifySubjectAndTopic(mq);
        seenQIds.add(mq.id);
        total++;
        const existing = topicMap.get(classified.topicSlug) || {
          topic: classified.topic,
          slug: classified.topicSlug,
          count: 0,
        };
        existing.count++;
        topicMap.set(classified.topicSlug, existing);
      }
    }

    const topics = Array.from(topicMap.values()).sort((a, b) => b.count - a.count);

    return {
      subjectId: sub.id,
      shortCode: sub.shortCode,
      title: sub.title,
      total,
      topics,
    };
  });
}

export function getTotalMistakesSummary(userId: number): {
  all: number;
  telegram_drill: number;
  website_mock: number;
} {
  const allStats = getMistakeStats(userId, 'all');
  const tgStats = getMistakeStats(userId, 'telegram_drill');
  const webStats = getMistakeStats(userId, 'website_mock');

  return {
    all: allStats.reduce((acc, s) => acc + s.total, 0),
    telegram_drill: tgStats.reduce((acc, s) => acc + s.total, 0),
    website_mock: webStats.reduce((acc, s) => acc + s.total, 0),
  };
}
