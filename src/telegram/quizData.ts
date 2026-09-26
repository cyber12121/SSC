import fs from 'fs';
import path from 'path';
import { cleanSolutionText } from '../utils/cleanSolution';

export interface TelegramQuizQuestion {
  id: string;
  question: string;
  preamble?: string; // Optional context message if question is very long
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  fullSolution?: string;
  subject?: string;
  topic?: string;
  source?: string;
}

import { fileURLToPath } from 'url';

let moduleDir = process.cwd();
try {
  moduleDir = path.dirname(fileURLToPath(import.meta.url));
} catch {}

function resolveDataDir(subPath: string): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'data', subPath),
    path.join(process.cwd(), 'data', subPath),
    path.join(moduleDir, 'src', 'data', subPath),
    path.join(moduleDir, '..', 'src', 'data', subPath),
    path.join(moduleDir, 'data', subPath),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const DRILLS_DIR = resolveDataDir('drills');
const CHAPTER_BANK_DIR = resolveDataDir('chapter_bank');
const MOCK_ERRORS_DIR = resolveDataDir('mock_errors');
const MOCK_QUESTIONS_DIR = resolveDataDir('mock_questions');

// In-memory cache for parsed questions by key to make subsequent loads instant (<1ms)
const questionsCache = new Map<string, any[]>();

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function letterToIndex(letter: string | number): number {
  if (typeof letter === 'number') return letter;
  const clean = String(letter || '').trim().toLowerCase();
  if (clean === 'a' || clean === '1') return 0;
  if (clean === 'b' || clean === '2') return 1;
  if (clean === 'c' || clean === '3') return 2;
  if (clean === 'd' || clean === '4') return 3;
  if (clean === 'e' || clean === '5') return 4;
  return 0;
}

// Strips markdown, math artifacts and HTML tags for compact Telegram display
export function cleanRawText(str: string): string {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    })
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeTelegramQuiz(raw: {
  id: string;
  question: string;
  options: string[] | Record<string, string>;
  correctOption: string | number;
  solution?: string;
  subject?: string;
  topic?: string;
  source?: string;
}): TelegramQuizQuestion {
  // Extract and normalize options
  let optArray: string[] = [];
  if (Array.isArray(raw.options)) {
    optArray = raw.options.map(cleanRawText);
  } else if (raw.options && typeof raw.options === 'object') {
    optArray = ['a', 'b', 'c', 'd'].map((key) => {
      const v = raw.options[key] || (raw.options as any)[key.toUpperCase()] || '';
      return cleanRawText(String(v));
    });
    // Check if there is an option e
    if ((raw.options as any)['e'] || (raw.options as any)['E']) {
      optArray.push(cleanRawText(String((raw.options as any)['e'] || (raw.options as any)['E'])));
    }
  }

  // Ensure at least 2 non-empty options
  if (optArray.length < 2 || optArray.every((o) => !o)) {
    optArray = ['Option A', 'Option B', 'Option C', 'Option D'];
  }

  // Format options: cap at 98 characters per Telegram Poll limits and ensure unique options
  const seenOptions = new Set<string>();
  let formattedOptions = optArray.slice(0, 10).map((opt, idx) => {
    let t = opt.trim();
    if (t.length > 95) t = t.slice(0, 92) + '...';
    if (!t) t = `Choice ${String.fromCharCode(65 + idx)}`;

    let uniqueT = t;
    let count = 1;
    while (seenOptions.has(uniqueT.toLowerCase())) {
      uniqueT = `${t} (${count++})`;
    }
    seenOptions.add(uniqueT.toLowerCase());
    return uniqueT;
  });

  while (formattedOptions.length < 2) {
    const fallbackOpt = `Choice ${String.fromCharCode(65 + formattedOptions.length)}`;
    formattedOptions.push(fallbackOpt);
    seenOptions.add(fallbackOpt.toLowerCase());
  }

  const correctIndex = Math.max(
    0,
    Math.min(letterToIndex(raw.correctOption), formattedOptions.length - 1)
  );

  let cleanQ = cleanRawText(raw.question);
  let preamble: string | undefined = undefined;

  // Telegram Poll question limit is 300 characters
  if (cleanQ.length > 295) {
    // If the question is long, provide the full question as preamble and a concise prompt in poll
    preamble = `📝 *Question Full Context:*\n${cleanQ}`;
    cleanQ = cleanQ.slice(0, 292) + '...';
  }

  // Telegram Poll explanation limit is 200 characters
  let cleanSol = cleanSolutionText(raw.solution || '');
  let shortExpl = cleanRawText(cleanSol);
  if (shortExpl.length > 195) {
    shortExpl = shortExpl.slice(0, 192) + '...';
  }

  return {
    id: raw.id,
    question: cleanQ,
    preamble,
    options: formattedOptions,
    correctOptionIndex: correctIndex,
    explanation: shortExpl,
    fullSolution: cleanSol || shortExpl,
    subject: raw.subject,
    topic: raw.topic,
    source: raw.source,
  };
}

// ----------------------------------------------------
// 1. SPEED DRILLS & CALCULATION LAB
// ----------------------------------------------------

export function generateTripletsDrill(count = 10): TelegramQuizQuestion[] {
  let rawTriplets: any[] = [];
  try {
    const file = path.join(DRILLS_DIR, 'triplets.json');
    if (fs.existsSync(file)) {
      rawTriplets = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {}

  if (!rawTriplets || rawTriplets.length === 0) {
    rawTriplets = [
      { a: 3, b: 4, c: 5 },
      { a: 5, b: 12, c: 13 },
      { a: 7, b: 24, c: 25 },
      { a: 8, b: 15, c: 17 },
      { a: 9, b: 40, c: 41 },
      { a: 11, b: 60, c: 61 },
      { a: 12, b: 35, c: 37 },
      { a: 20, b: 21, c: 29 },
    ];
  }

  const selected = shuffle(rawTriplets).slice(0, count);
  return selected.map((t, idx) => {
    const isHypMissing = Math.random() > 0.45;
    let question = '';
    let correct = 0;
    let wrongOptions: number[] = [];

    if (isHypMissing) {
      question = `📐 Triplet: If base and perpendicular are ${t.a} & ${t.b}, what is the hypotenuse?`;
      correct = t.c;
      wrongOptions = [t.c + 1, t.c - 1, t.c + 2, t.c + (t.a % 2 === 0 ? 4 : -3)].filter(
        (x) => x !== correct && x > 0
      );
    } else {
      question = `📐 Triplet: Which side completes the Pythagorean triplet (${t.a}, ___, ${t.c})?`;
      correct = t.b;
      wrongOptions = [t.b + 1, t.b - 1, t.b + 2, t.b - 2].filter((x) => x !== correct && x > 0);
    }

    const uniqueWrong = Array.from(new Set(wrongOptions)).slice(0, 3);
    while (uniqueWrong.length < 3) {
      uniqueWrong.push(correct + uniqueWrong.length + 3);
    }

    const allOpts = shuffle([String(correct), ...uniqueWrong.map(String)]);
    return sanitizeTelegramQuiz({
      id: `triplet_${idx}_${Date.now()}`,
      question,
      options: allOpts,
      correctOption: allOpts.indexOf(String(correct)),
      solution: `Pythagorean Theorem: ${t.a}² + ${t.b}² = ${t.c}² (${t.a * t.a} + ${t.b * t.b} = ${
        t.c * t.c
      })`,
      subject: 'Speed Math',
      topic: 'Triplets',
      source: 'Triplets Speed Lab',
    });
  });
}

export function generateFractionsDrill(count = 10): TelegramQuizQuestion[] {
  let rawFractions: any[] = [];
  try {
    const file = path.join(DRILLS_DIR, 'fractions.json');
    if (fs.existsSync(file)) {
      rawFractions = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {}

  if (!rawFractions || rawFractions.length === 0) {
    rawFractions = [
      { fraction: '1/6', percentage: '16.66%' },
      { fraction: '1/7', percentage: '14.28%' },
      { fraction: '3/8', percentage: '37.5%' },
      { fraction: '5/8', percentage: '62.5%' },
      { fraction: '1/12', percentage: '8.33%' },
      { fraction: '1/14', percentage: '7.14%' },
      { fraction: '4/7', percentage: '57.14%' },
    ];
  }

  const selected = shuffle(rawFractions).slice(0, count);
  return selected.map((item, idx) => {
    const toPercent = Math.random() > 0.45;
    let question = '';
    let correct = '';
    let pool: string[] = [];

    if (toPercent) {
      question = `💯 Percentage Conversion: What is ${item.fraction} as a percentage?`;
      correct = item.percentage;
      pool = rawFractions.map((f) => f.percentage).filter((p) => p !== correct);
    } else {
      question = `💯 Fraction Equivalent: What fraction corresponds to ${item.percentage}?`;
      correct = item.fraction;
      pool = rawFractions.map((f) => f.fraction).filter((f) => f !== correct);
    }

    const wrong = shuffle(Array.from(new Set(pool))).slice(0, 3);
    const allOpts = shuffle([correct, ...wrong]);

    return sanitizeTelegramQuiz({
      id: `fraction_${idx}_${Date.now()}`,
      question,
      options: allOpts,
      correctOption: allOpts.indexOf(correct),
      solution: `Fraction to Percentage:\n${item.fraction} × 100% = ${item.percentage} (Decimal: ${
        item.decimal || 'N/A'
      })`,
      subject: 'Speed Math',
      topic: 'Fractions',
      source: 'Fractions & Percentages Lab',
    });
  });
}

export function generateSquaresDrill(count = 10): TelegramQuizQuestion[] {
  const numbers: number[] = [];
  while (numbers.length < count) {
    const n = Math.floor(Math.random() * 38) + 12; // 12 to 49
    if (!numbers.includes(n)) numbers.push(n);
  }

  return numbers.map((n, idx) => {
    const isSquare = Math.random() > 0.25;
    let question = '';
    let correct = '';
    let wrong: string[] = [];

    if (isSquare) {
      const sq = n * n;
      question = `🔢 Mental Math: What is the square of ${n} (${n}²)?`;
      correct = String(sq);
      wrong = [
        String(sq + 10),
        String(sq - 10),
        String(sq + (n % 2 === 0 ? 20 : -20)),
        String((n + 1) * (n + 1)),
      ].filter((x) => x !== correct);
    } else {
      const c = Math.floor(Math.random() * 19) + 2;
      const cube = c * c * c;
      question = `🔢 Mental Math: What is the cube of ${c} (${c}³)?`;
      correct = String(cube);
      wrong = [
        String(cube + 10),
        String(cube - 10),
        String((c - 1) * (c - 1) * (c - 1)),
      ].filter((x) => x !== correct);
    }

    const uniqueWrong = shuffle(Array.from(new Set(wrong))).slice(0, 3);
    const allOpts = shuffle([correct, ...uniqueWrong]);

    return sanitizeTelegramQuiz({
      id: `math_${idx}_${Date.now()}`,
      question,
      options: allOpts,
      correctOption: allOpts.indexOf(correct),
      solution: `Fast Calculation:\n${n}² = ${n * n}`,
      subject: 'Speed Math',
      topic: 'Squares & Cubes',
      source: 'Mental Speed Lab',
    });
  });
}

export function generateMixedSpeedDrill(count = 10): TelegramQuizQuestion[] {
  const t = generateTripletsDrill(4);
  const f = generateFractionsDrill(3);
  const s = generateSquaresDrill(3);
  return shuffle([...t, ...f, ...s]).slice(0, count);
}

export function getSimplificationDrill(setNumber?: number, count = 10): TelegramQuizQuestion[] {
  try {
    const file = path.join(DRILLS_DIR, 'simplificationDrills.json');
    if (!fs.existsSync(file)) return [];
    const sets = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(sets) || sets.length === 0) return [];

    let targetSet = sets[0];
    if (setNumber && setNumber > 0 && setNumber <= sets.length) {
      targetSet = sets[setNumber - 1];
    } else {
      targetSet = sets[Math.floor(Math.random() * sets.length)];
    }

    const questions: any[] = targetSet.questions || [];
    return questions.slice(0, count).map((q: any) =>
      sanitizeTelegramQuiz({
        id: q.id || `simp_${q.q_num}`,
        question: `📐 [${targetSet.title || 'Simplification'}]\n${q.question}`,
        options: q.options,
        correctOption: q.answer || q.correctOption,
        solution: q.solution,
        subject: 'Mathematics',
        topic: 'Simplification',
        source: targetSet.title,
      })
    );
  } catch (e) {
    console.error('Error loading simplification drill:', e);
    return [];
  }
}

// ----------------------------------------------------
// 2. MOCK ERRORS (Math, Reasoning, English, GA)
// ----------------------------------------------------

export function getMockErrorsBySubject(
  subject: 'mathematics' | 'reasoning' | 'english' | 'general_awareness' | 'all',
  count = 10
): TelegramQuizQuestion[] {
  try {
    const cacheKey = `mock_errors_${subject}`;
    let allQs: any[] = questionsCache.get(cacheKey) || [];

    if (allQs.length === 0) {
      const filesToRead =
        subject === 'all'
          ? ['mathematics.json', 'reasoning.json', 'english.json', 'general_awareness.json']
          : [`${subject}.json`];

      for (const fileName of filesToRead) {
        const filePath = path.join(MOCK_ERRORS_DIR, fileName);
        if (fs.existsSync(filePath)) {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (Array.isArray(content)) {
            // Either array of chapters or array of questions
            for (const item of content) {
              if (item.questions && Array.isArray(item.questions)) {
                allQs.push(...item.questions);
              } else if (item.question || item.questionText) {
                allQs.push(item);
              }
            }
          }
        }
      }
      questionsCache.set(cacheKey, allQs);
    }

    if (allQs.length === 0) return [];
    const selected = shuffle(allQs).slice(0, count);

    return selected.map((q, idx) => {
      const subTitle =
        subject === 'all'
          ? 'Mock Mistakes'
          : subject.charAt(0).toUpperCase() + subject.slice(1).replace('_', ' ');

      return sanitizeTelegramQuiz({
        id: `mock_err_${subject}_${idx}_${Date.now()}`,
        question: `🎯 [${subTitle} Mistake Review]\n${q.question || q.questionText}`,
        options: q.options,
        correctOption: q.answer || q.correctOption || q.correct_answer,
        solution: q.solution,
        subject: q.subject || subTitle,
        topic: q.topic || q.conceptTested || 'Error Bank',
        source: q.testName || 'Mock Error Bank',
      });
    });
  } catch (err) {
    console.error(`Error loading mock errors for ${subject}:`, err);
    return [];
  }
}

// ----------------------------------------------------
// 3. MATHEMATICS CHAPTER BANK (Top500 Topics, Pinnacle)
// ----------------------------------------------------

export function getMathChapterQuestions(topicName?: string, count = 10): TelegramQuizQuestion[] {
  try {
    const top500Dir = path.join(CHAPTER_BANK_DIR, 'mathematics', 'top500');
    if (!fs.existsSync(top500Dir)) return [];

    const availableTopics = fs.readdirSync(top500Dir).filter((d) => {
      return fs.statSync(path.join(top500Dir, d)).isDirectory();
    });

    let chosenTopic = topicName;
    if (!chosenTopic || !availableTopics.includes(chosenTopic)) {
      chosenTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];
    }

    const topicPath = path.join(top500Dir, chosenTopic);
    const setFiles = fs.readdirSync(topicPath).filter((f) => f.endsWith('.json'));
    if (setFiles.length === 0) return [];

    const chosenFile = setFiles[Math.floor(Math.random() * setFiles.length)];
    const content = JSON.parse(fs.readFileSync(path.join(topicPath, chosenFile), 'utf8'));
    const rawQs: any[] = content.questions || [];

    return shuffle(rawQs)
      .slice(0, count)
      .map((q) =>
        sanitizeTelegramQuiz({
          id: `math_ch_${chosenTopic}_${q.q_num}_${Date.now()}`,
          question: `📐 [Math: ${chosenTopic}]\n${q.question}`,
          options: q.options,
          correctOption: q.answer || q.correctOption,
          solution: q.solution,
          subject: 'Mathematics',
          topic: chosenTopic,
          source: content.chapter_title || chosenTopic,
        })
      );
  } catch (e) {
    console.error('Error loading math chapter questions:', e);
    return [];
  }
}

// ----------------------------------------------------
// 4. ENGLISH CHAPTER BANK (Black Book & Ayush Vocab)
// ----------------------------------------------------

export function getEnglishChapterQuestions(
  category: 'synonyms' | 'one_word_substitution' | 'phrasal_verbs' | 'idioms' | 'antonyms',
  setNumber?: number,
  count = 10
): TelegramQuizQuestion[] {
  try {
    let targetDir = '';
    let isAyush = false;

    if (category === 'synonyms' || category === 'one_word_substitution' || category === 'phrasal_verbs') {
      targetDir = path.join(CHAPTER_BANK_DIR, 'english', 'black_book', category);
    } else if (category === 'idioms') {
      targetDir = path.join(CHAPTER_BANK_DIR, 'english', 'ayush_vocab', 'idioms_and_phrases');
      isAyush = true;
    } else if (category === 'antonyms') {
      targetDir = path.join(CHAPTER_BANK_DIR, 'english', 'ayush_vocab', 'antonyms');
      isAyush = true;
    }

    if (!fs.existsSync(targetDir)) return [];
    const files = fs.readdirSync(targetDir).filter((f) => f.endsWith('.json'));
    if (files.length === 0) return [];

    let selectedFile = files[0];
    if (setNumber && setNumber > 0 && setNumber <= files.length) {
      selectedFile = `set_${setNumber}.json`;
      if (!files.includes(selectedFile)) selectedFile = files[0];
    } else {
      selectedFile = files[Math.floor(Math.random() * files.length)];
    }

    const content = JSON.parse(fs.readFileSync(path.join(targetDir, selectedFile), 'utf8'));
    const rawQs: any[] = content.questions || [];

    const label = isAyush
      ? category === 'idioms'
        ? 'Idioms & Phrases'
        : 'Antonyms'
      : category === 'synonyms'
      ? 'Synonyms (Black Book)'
      : category === 'one_word_substitution'
      ? 'One Word Substitution'
      : 'Phrasal Verbs';

    return shuffle(rawQs)
      .slice(0, count)
      .map((q) =>
        sanitizeTelegramQuiz({
          id: `eng_${category}_${q.q_num}_${Date.now()}`,
          question: `📖 [${content.chapter_title || label}]\n${q.question}`,
          options: q.options,
          correctOption: q.answer || q.correctOption,
          solution: q.solution,
          subject: 'English',
          topic: label,
          source: content.chapter_title || 'Black Book English',
        })
      );
  } catch (e) {
    console.error('Error loading English chapter questions:', e);
    return [];
  }
}

// ----------------------------------------------------
// 5. GENERAL AWARENESS CHAPTER BANK (All 10 Subjects)
// ----------------------------------------------------

export function getGKChapterQuestions(
  topicFolder:
    | 'polity'
    | 'history_modern'
    | 'history_ancient'
    | 'history_medieval'
    | 'geography'
    | 'biology'
    | 'chemistry'
    | 'physics'
    | 'economics'
    | 'static_gk'
    | 'random',
  count = 10
): TelegramQuizQuestion[] {
  try {
    const gaDir = path.join(CHAPTER_BANK_DIR, 'general_awareness');
    if (!fs.existsSync(gaDir)) return [];

    const allTopics = [
      'polity',
      'history_modern',
      'history_ancient',
      'history_medieval',
      'geography',
      'biology',
      'chemistry',
      'physics',
      'economics',
      'static_gk',
    ];

    let chosenTopic = topicFolder;
    if (chosenTopic === 'random' || !allTopics.includes(chosenTopic)) {
      chosenTopic = allTopics[Math.floor(Math.random() * allTopics.length)] as any;
    }

    const topicPath = path.join(gaDir, chosenTopic);
    if (!fs.existsSync(topicPath)) return [];

    const files = fs.readdirSync(topicPath).filter((f) => f.endsWith('.json'));
    if (files.length === 0) return [];

    const randomFile = files[Math.floor(Math.random() * files.length)];
    const content = JSON.parse(fs.readFileSync(path.join(topicPath, randomFile), 'utf8'));
    const rawQs: any[] = content.questions || [];

    const displayTopic = chosenTopic
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return shuffle(rawQs)
      .slice(0, count)
      .map((q) =>
        sanitizeTelegramQuiz({
          id: `ga_${chosenTopic}_${q.q_num}_${Date.now()}`,
          question: `🏛️ [GK: ${content.chapter_title || displayTopic}]\n${q.question}`,
          options: q.options,
          correctOption: q.answer || q.correctOption,
          solution: q.solution,
          subject: 'General Awareness',
          topic: displayTopic,
          source: content.chapter_title || 'General Awareness Bank',
        })
      );
  } catch (e) {
    console.error('Error loading GK questions:', e);
    return [];
  }
}

// ----------------------------------------------------
// 6. FULL MOCK TEST QUESTIONS (Pulls from 34 Real Mocks)
// ----------------------------------------------------

export function getFullMockBlitzQuestions(count = 10): TelegramQuizQuestion[] {
  try {
    if (!fs.existsSync(MOCK_QUESTIONS_DIR)) return [];
    const files = fs.readdirSync(MOCK_QUESTIONS_DIR).filter((f) => f.endsWith('.json'));
    if (files.length === 0) return [];

    const randomFile = files[Math.floor(Math.random() * files.length)];
    const content = JSON.parse(fs.readFileSync(path.join(MOCK_QUESTIONS_DIR, randomFile), 'utf8'));

    let allQs: any[] = [];
    if (Array.isArray(content)) {
      allQs = content;
    } else if (content.questions && Array.isArray(content.questions)) {
      allQs = content.questions;
    } else if (content.sections && typeof content.sections === 'object') {
      for (const secKey of Object.keys(content.sections)) {
        if (Array.isArray(content.sections[secKey])) {
          allQs.push(...content.sections[secKey]);
        }
      }
    }

    if (allQs.length === 0) return [];
    return shuffle(allQs)
      .slice(0, count)
      .map((q, idx) =>
        sanitizeTelegramQuiz({
          id: `mock_blitz_${idx}_${Date.now()}`,
          question: `🏆 [Full Mock Blitz: ${content.test_name || 'Tier 1 Test'}]\n${
            q.question || q.questionText
          }`,
          options: q.options,
          correctOption: q.answer || q.correctOption || q.correct_answer,
          solution: q.solution,
          subject: q.subject || 'All-India Mock',
          topic: q.topic || 'Full Mock Test',
          source: content.test_name || 'Full Mock Exam',
        })
      );
  } catch (e) {
    console.error('Error loading full mock blitz:', e);
    return [];
  }
}
