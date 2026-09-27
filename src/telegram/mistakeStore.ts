import fs from 'fs';
import path from 'path';
import os from 'os';
import { TelegramQuizQuestion, sanitizeTelegramQuiz, shuffle } from './quizData';

export type MistakeSource = 'telegram_quiz' | 'website_quiz';
export type MistakeFilter = 'all' | 'telegram_quiz' | 'website_quiz';

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
// PERSISTENT DISK STORE FOR LIVE USER QUIZ MISTAKES
// ----------------------------------------------------

const TMP_FILE = path.join(os.tmpdir(), 'cgl_quiz_mistakes.json');

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
    console.error('[MistakeStore] Error saving quiz mistakes to disk:', err);
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, 'utf8');
      const parsed: Record<string, RecordedMistake[]> = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [userIdStr, list] of Object.entries(parsed)) {
          if (!Array.isArray(list)) continue;
          const uid = Number(userIdStr);
          const map = new Map<string, RecordedMistake>();
          for (const item of list) {
            map.set(item.id, item);
          }
          userMistakesMap.set(uid, map);
        }
      }
    }
  } catch (err) {
    console.error('[MistakeStore] Error loading quiz mistakes from disk:', err);
  }
}

loadFromDisk();

// ----------------------------------------------------
// DELETED QUESTIONS SET (PERSISTENT FILTER)
// ----------------------------------------------------

const DELETED_FILE = path.join(os.tmpdir(), 'cgl_deleted_mistakes.json');
const deletedQuestionsSet = new Set<string>();

function loadDeletedFromDisk() {
  try {
    if (fs.existsSync(DELETED_FILE)) {
      const raw = fs.readFileSync(DELETED_FILE, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((id) => deletedQuestionsSet.add(String(id)));
      }
    }
  } catch (err) {
    console.error('[MistakeStore] Error loading deleted mistakes:', err);
  }
}

function saveDeletedToDisk() {
  try {
    fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(deletedQuestionsSet)), 'utf8');
  } catch (err) {
    console.error('[MistakeStore] Error saving deleted mistakes:', err);
  }
}

loadDeletedFromDisk();

export function isQuestionDeleted(questionId: string, questionText?: string): boolean {
  if (deletedQuestionsSet.has(questionId)) return true;
  if (questionText && deletedQuestionsSet.has(questionText.trim().toLowerCase())) return true;
  return false;
}

export function syncDeletedQuestions(ids: string[]) {
  let changed = false;
  for (const id of ids) {
    if (id && !deletedQuestionsSet.has(id)) {
      deletedQuestionsSet.add(id);
      changed = true;
    }
  }
  if (changed) saveDeletedToDisk();
}

export function getDeletedQuestionIds(): string[] {
  return Array.from(deletedQuestionsSet);
}

// ----------------------------------------------------
// TOPIC CLASSIFIER FOR USER QUIZ QUESTIONS
// ----------------------------------------------------

export function classifySubjectAndTopic(q: TelegramQuizQuestion): {
  subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness';
  topic: string;
  topicSlug: string;
} {
  const text = `${q.question} ${q.explanation || ''} ${q.subject || ''} ${q.topic || ''} ${q.source || ''}`.toLowerCase();

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
    text.includes('circumference')
  ) {
    subject = 'mathematics';
  } else if (
    subStr.includes('reason') ||
    text.includes('syllogism') ||
    text.includes('analogy') ||
    text.includes('blood relation') ||
    text.includes('coding-decoding')
  ) {
    subject = 'reasoning';
  }

  let topic = 'General Practice';
  let topicSlug = 'gen';

  if (subject === 'english') {
    if (text.includes('synonym')) { topic = 'Synonyms'; topicSlug = 'syn'; }
    else if (text.includes('antonym')) { topic = 'Antonyms'; topicSlug = 'ant'; }
    else if (text.includes('one word') || text.includes('ows')) { topic = 'One Word Substitution'; topicSlug = 'ows'; }
    else if (text.includes('idiom') || text.includes('phrase')) { topic = 'Idioms & Phrases'; topicSlug = 'idiom'; }
    else if (text.includes('spelling') || text.includes('misspelt')) { topic = 'Spelling Errors'; topicSlug = 'spell'; }
    else if (text.includes('spotting') || text.includes('grammatical error')) { topic = 'Spotting Errors'; topicSlug = 'error'; }
    else if (text.includes('voice')) { topic = 'Active & Passive Voice'; topicSlug = 'voice'; }
    else if (text.includes('narration') || text.includes('direct')) { topic = 'Direct & Indirect Speech'; topicSlug = 'narration'; }
    else if (text.includes('pqrs') || text.includes('jumble')) { topic = 'Para Jumbles'; topicSlug = 'pqrs'; }
    else if (text.includes('cloze') || text.includes('comprehension')) { topic = 'Cloze & Comprehension'; topicSlug = 'cloze'; }
    else { topic = 'Vocabulary & Grammar'; topicSlug = 'vocab'; }
  } else if (subject === 'mathematics') {
    if (text.includes('algebra')) { topic = 'Algebra'; topicSlug = 'algebra'; }
    else if (text.includes('trig')) { topic = 'Trigonometry'; topicSlug = 'trigo'; }
    else if (text.includes('geom') || text.includes('circle')) { topic = 'Geometry'; topicSlug = 'geom'; }
    else if (text.includes('mensur')) { topic = 'Mensuration'; topicSlug = 'mens'; }
    else if (text.includes('number') || text.includes('remainder')) { topic = 'Number System'; topicSlug = 'num'; }
    else if (text.includes('profit') || text.includes('loss')) { topic = 'Profit & Loss'; topicSlug = 'pnl'; }
    else if (text.includes('percent')) { topic = 'Percentages'; topicSlug = 'pct'; }
    else if (text.includes('ratio')) { topic = 'Ratio & Proportion'; topicSlug = 'ratio'; }
    else if (text.includes('interest')) { topic = 'SI & CI'; topicSlug = 'si_ci'; }
    else if (text.includes('work') || text.includes('pipe')) { topic = 'Time & Work'; topicSlug = 'work'; }
    else if (text.includes('speed') || text.includes('train')) { topic = 'Speed, Time & Distance'; topicSlug = 'speed'; }
    else { topic = 'Arithmetic'; topicSlug = 'arith'; }
  } else if (subject === 'reasoning') {
    if (text.includes('syllogism')) { topic = 'Syllogism'; topicSlug = 'syl'; }
    else if (text.includes('analogy')) { topic = 'Analogy'; topicSlug = 'analogy'; }
    else if (text.includes('coding')) { topic = 'Coding & Decoding'; topicSlug = 'coding'; }
    else if (text.includes('series')) { topic = 'Series'; topicSlug = 'series'; }
    else if (text.includes('blood')) { topic = 'Blood Relations'; topicSlug = 'blood'; }
    else if (text.includes('direction')) { topic = 'Direction Sense'; topicSlug = 'direction'; }
    else if (text.includes('venn')) { topic = 'Venn Diagrams'; topicSlug = 'venn'; }
    else { topic = 'General Reasoning'; topicSlug = 'reason_gen'; }
  } else {
    if (text.includes('polity') || text.includes('article') || text.includes('constitution')) { topic = 'Polity & Constitution'; topicSlug = 'polity'; }
    else if (text.includes('history')) { topic = 'Indian History'; topicSlug = 'history'; }
    else if (text.includes('geo') || text.includes('river')) { topic = 'Geography'; topicSlug = 'geo'; }
    else if (text.includes('eco') || text.includes('budget')) { topic = 'Economics'; topicSlug = 'eco'; }
    else if (text.includes('bio') || text.includes('disease')) { topic = 'Biology'; topicSlug = 'bio'; }
    else if (text.includes('phys')) { topic = 'Physics'; topicSlug = 'phys'; }
    else if (text.includes('chem')) { topic = 'Chemistry'; topicSlug = 'chem'; }
    else { topic = 'General Awareness & Static GK'; topicSlug = 'gk_static'; }
  }

  return { subject, topic, topicSlug };
}

// ----------------------------------------------------
// LIVE MISTAKE RECORDING & MASTERY
// ----------------------------------------------------

export function recordMistake(
  userId: number,
  q: TelegramQuizQuestion,
  source: MistakeSource = 'telegram_quiz',
  isCorrect = false
) {
  if (isQuestionDeleted(q.id, q.question)) return;

  let userMap = userMistakesMap.get(userId);
  if (!userMap) {
    userMap = new Map<string, RecordedMistake>();
    userMistakesMap.set(userId, userMap);
  }

  const existing = userMap.get(q.id);

  if (isCorrect) {
    if (existing) {
      existing.mastered = true;
      saveToDisk();
    }
    return;
  }

  // Answer was incorrect
  const { subject, topic, topicSlug } = classifySubjectAndTopic(q);
  const correctIdx = typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0;

  if (existing) {
    existing.wrongCount = (existing.wrongCount || 1) + 1;
    existing.mastered = false;
    existing.timestamp = Date.now();
  } else {
    const mistake: RecordedMistake = {
      id: q.id,
      userId,
      question: q.question,
      options: q.options,
      correctOptionIndex: correctIdx,
      explanation: q.fullSolution || q.explanation || '',
      subject,
      topic,
      topicSlug,
      source,
      timestamp: Date.now(),
      wrongCount: 1,
      mastered: false,
    };
    userMap.set(q.id, mistake);
  }

  saveToDisk();
}

export function markMistakeMastered(userId: number, questionId: string, questionText: string = '') {
  const userMap = userMistakesMap.get(userId);
  if (!userMap) return;

  if (userMap.has(questionId)) {
    const m = userMap.get(questionId)!;
    m.mastered = true;
    saveToDisk();
    return;
  }

  if (questionText) {
    const cleanText = questionText.trim().toLowerCase();
    for (const m of userMap.values()) {
      if (m.question.trim().toLowerCase() === cleanText) {
        m.mastered = true;
        saveToDisk();
        return;
      }
    }
  }
}

export function deleteMistake(userId: number | undefined, questionId: string, questionText?: string) {
  if (questionId) deletedQuestionsSet.add(questionId);
  if (questionText) deletedQuestionsSet.add(questionText.trim().toLowerCase());
  saveDeletedToDisk();

  for (const map of userMistakesMap.values()) {
    map.delete(questionId);
    if (questionText) {
      const clean = questionText.trim().toLowerCase();
      for (const [key, val] of map.entries()) {
        if (val.question.trim().toLowerCase() === clean) {
          map.delete(key);
        }
      }
    }
  }

  saveToDisk();
}

// ----------------------------------------------------
// READERS & STATS
// ----------------------------------------------------

export function getUserMistakes(
  userId: number,
  filter: MistakeFilter = 'all',
  subject?: 'english' | 'mathematics' | 'reasoning' | 'general_awareness',
  topicSlug: string = ''
): TelegramQuizQuestion[] {
  const results: TelegramQuizQuestion[] = [];
  const seenQIds = new Set<string>();

  const checkAndPush = (item: RecordedMistake) => {
    if (item.mastered) return;
    if (isQuestionDeleted(item.id, item.question)) return;
    if (filter !== 'all' && item.source !== filter) return;
    if (subject && item.subject !== subject) return;
    if (topicSlug && topicSlug !== '_' && item.topicSlug !== topicSlug) return;

    if (seenQIds.has(item.id)) return;

    seenQIds.add(item.id);

    results.push({
      id: item.id,
      question: item.question,
      options: item.options,
      correctOptionIndex: item.correctOptionIndex,
      explanation: item.explanation,
      subject: item.subject,
      topic: item.topic,
      source: item.source === 'telegram_quiz' ? '📱 Telegram Quiz Mistake' : '💻 Website Quiz Mistake',
    });
  };

  const userMap = userMistakesMap.get(userId);
  if (userMap) {
    for (const item of userMap.values()) {
      checkAndPush(item);
    }
  }

  // Also include guest mistakes (userId 0)
  if (userId !== 0) {
    const guestMap = userMistakesMap.get(0);
    if (guestMap) {
      for (const item of guestMap.values()) {
        checkAndPush(item);
      }
    }
  }

  return results;
}

export function getAllRecordedMistakes(
  filter: MistakeFilter = 'all',
  subject?: 'english' | 'mathematics' | 'reasoning' | 'general_awareness',
  topicSlug?: string
): RecordedMistake[] {
  const results: RecordedMistake[] = [];
  const seenIds = new Set<string>();

  for (const map of userMistakesMap.values()) {
    for (const item of map.values()) {
      if (item.mastered) continue;
      if (isQuestionDeleted(item.id, item.question)) continue;
      if (filter !== 'all' && item.source !== filter) continue;
      if (subject && item.subject !== subject) continue;
      if (topicSlug && topicSlug !== '_' && item.topicSlug !== topicSlug) continue;
      if (seenIds.has(item.id)) continue;

      seenIds.add(item.id);
      results.push(item);
    }
  }

  return results.sort((a, b) => b.timestamp - a.timestamp);
}

export function getMistakeStats(
  userId: number,
  filter: MistakeFilter = 'all'
): {
  subjectId: 'english' | 'mathematics' | 'reasoning' | 'general_awareness';
  shortCode: 'eng' | 'math' | 'reas' | 'ga';
  title: string;
  total: number;
  topics: { topic: string; slug: string; count: number }[];
}[] {
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

    const processItem = (item: RecordedMistake) => {
      if (item.mastered) return;
      if (isQuestionDeleted(item.id, item.question)) return;
      if (filter !== 'all' && item.source !== filter) return;
      if (item.subject !== sub.id) return;
      if (seenQIds.has(item.id)) return;

      seenQIds.add(item.id);
      total++;
      const existing = topicMap.get(item.topicSlug) || {
        topic: item.topic,
        slug: item.topicSlug,
        count: 0,
      };
      existing.count++;
      topicMap.set(item.topicSlug, existing);
    };

    const userMap = userMistakesMap.get(userId);
    if (userMap) {
      for (const item of userMap.values()) {
        processItem(item);
      }
    }

    if (userId !== 0) {
      const guestMap = userMistakesMap.get(0);
      if (guestMap) {
        for (const item of guestMap.values()) {
          processItem(item);
        }
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
  telegram_quiz: number;
  website_quiz: number;
} {
  const allStats = getMistakeStats(userId, 'all');
  const tgStats = getMistakeStats(userId, 'telegram_quiz');
  const webStats = getMistakeStats(userId, 'website_quiz');

  return {
    all: allStats.reduce((acc, s) => acc + s.total, 0),
    telegram_quiz: tgStats.reduce((acc, s) => acc + s.total, 0),
    website_quiz: webStats.reduce((acc, s) => acc + s.total, 0),
  };
}
