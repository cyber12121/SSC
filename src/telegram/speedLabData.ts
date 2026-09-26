import {
  PRIMITIVE_TRIPLETS,
  TABLES_CONFIG,
  SQUARES_17_39,
  CUBES_11_25,
  POWERS_DATA,
  FACTORIALS_DATA,
  FRACTIONS_DATA,
  createTripletQuestion,
  createTableQuestion,
  createSquareQuestion,
  createCubeQuestion,
  createPowerQuestion,
  createFactorialQuestion,
  shuffleArray,
} from '../data/drills/calculationData';
import simplificationData from '../data/drills/simplificationDrills.json';
import { sanitizeTelegramQuiz, TelegramQuizQuestion, shuffle } from './quizData';

// Generates 3 intelligent numeric distractors around the correct answer
function generateNumericDistractors(correctVal: number, rangeSpread = 10): string[] {
  const distractors: number[] = [];
  const deltas = [-rangeSpread, rangeSpread, -rangeSpread * 2, rangeSpread * 2, -2, 2, -1, 1];
  for (const d of shuffle(deltas)) {
    const candidate = correctVal + d;
    if (candidate > 0 && candidate !== correctVal && !distractors.includes(candidate)) {
      distractors.push(candidate);
      if (distractors.length === 3) break;
    }
  }
  while (distractors.length < 3) {
    distractors.push(correctVal + distractors.length + 3);
  }
  return distractors.map(String);
}

// ----------------------------------------------------
// 1. STEP-BY-STEP CALCULATION STUDIO DRILLS
// ----------------------------------------------------

export function getTripletsStepDrill(mode: 'all' | '10' = 'all'): TelegramQuizQuestion[] {
  let items = [...PRIMITIVE_TRIPLETS];
  if (mode === '10') items = shuffle(items).slice(0, 10);

  return items.map((item, idx) => {
    const q = createTripletQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, 2);
    const options = shuffle([String(ansNum), ...distractors]);

    return sanitizeTelegramQuiz({
      id: `calc_triplet_${idx}_${Date.now()}`,
      question: `📐 [Triplets Step 1]\n${q.prompt} — ${q.subPrompt || 'Find the missing value'}`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation || `Pythagorean Triplet: ${item.a}² + ${item.b}² = ${item.c}²`,
      subject: 'Calculation Studio',
      topic: 'Primitive Triplets',
      source: 'Step 1: Triplets',
    });
  });
}

export function getTablesStepDrill(mode: 'all' | '10' = 'all'): TelegramQuizQuestion[] {
  // All 13 tables from 12 through 24
  let tables = Array.from({ length: TABLES_CONFIG.maxTable - TABLES_CONFIG.minTable + 1 }, (_, i) => TABLES_CONFIG.minTable + i);
  if (mode === '10') tables = shuffle(tables).slice(0, 10);

  return tables.map((tbl, idx) => {
    const q = createTableQuestion(tbl);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, tbl);
    const options = shuffle([String(ansNum), ...distractors]);

    return sanitizeTelegramQuiz({
      id: `calc_table_${idx}_${Date.now()}`,
      question: `✖️ [Tables Step 2]\nWhat is ${q.prompt}?`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation,
      subject: 'Calculation Studio',
      topic: 'Tables 12–24',
      source: 'Step 2: Tables',
    });
  });
}

export function getSquaresStepDrill(mode: 'all' | '10' = 'all'): TelegramQuizQuestion[] {
  let squares = [...SQUARES_17_39];
  if (mode === '10') squares = shuffle(squares).slice(0, 10);

  return squares.map((item, idx) => {
    const q = createSquareQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, ansNum > 100 ? 20 : 2);
    const options = shuffle([String(ansNum), ...distractors]);

    return sanitizeTelegramQuiz({
      id: `calc_square_${idx}_${Date.now()}`,
      question: `🔢 [Squares Step 3]\nCalculate: ${q.prompt}`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation,
      subject: 'Calculation Studio',
      topic: 'Squares 17–39',
      source: 'Step 3: Squares',
    });
  });
}

export function getCubesStepDrill(mode: 'all' | '10' = 'all'): TelegramQuizQuestion[] {
  let cubes = [...CUBES_11_25];
  if (mode === '10') cubes = shuffle(cubes).slice(0, 10);

  return cubes.map((item, idx) => {
    const q = createCubeQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, ansNum > 1000 ? 50 : 1);
    const options = shuffle([String(ansNum), ...distractors]);

    return sanitizeTelegramQuiz({
      id: `calc_cube_${idx}_${Date.now()}`,
      question: `🧊 [Cubes Step 4]\nCalculate: ${q.prompt}`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation,
      subject: 'Calculation Studio',
      topic: 'Cubes 11–25',
      source: 'Step 4: Cubes',
    });
  });
}

export function getPowersStepDrill(mode: 'all' | '10' = 'all'): TelegramQuizQuestion[] {
  let powers = [...POWERS_DATA];
  if (mode === '10') powers = shuffle(powers).slice(0, 10);

  return powers.map((item, idx) => {
    const q = createPowerQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, ansNum > 200 ? 30 : 5);
    const options = shuffle([String(ansNum), ...distractors]);

    return sanitizeTelegramQuiz({
      id: `calc_power_${idx}_${Date.now()}`,
      question: `⚡ [Powers Step 5]\nCalculate value of: ${q.prompt}`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation,
      subject: 'Calculation Studio',
      topic: 'Powers (2–9)',
      source: 'Step 5: Powers',
    });
  });
}

export function getFactorialsStepDrill(mode: 'all' | '10' = 'all'): TelegramQuizQuestion[] {
  let factorials = [...FACTORIALS_DATA];
  if (mode === '10') factorials = factorials.slice(0, 8);

  return factorials.map((item, idx) => {
    const q = createFactorialQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, ansNum > 500 ? 100 : 4);
    const options = shuffle([String(ansNum), ...distractors]);

    return sanitizeTelegramQuiz({
      id: `calc_factorial_${idx}_${Date.now()}`,
      question: `❗ [Factorials Step 6]\nCalculate value of: ${item.n}!`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: `${item.n}! = ${item.breakdown} = ${item.val}`,
      subject: 'Calculation Studio',
      topic: 'Factorials 1–8',
      source: 'Step 6: Factorials',
    });
  });
}

export function getFractionsStepDrill(mode: 'all' | '10' = 'all'): TelegramQuizQuestion[] {
  let fractions = [...FRACTIONS_DATA];
  if (mode === '10') fractions = shuffle(fractions).slice(0, 10);

  return fractions.map((item, idx) => {
    const toPercent = Math.random() > 0.5;
    let question = '';
    let correct = '';
    let pool: string[] = [];

    if (toPercent) {
      question = `💯 [Fractions Step 7]\nWhat is ${item.fraction} expressed as a percentage?`;
      correct = item.percentage;
      pool = FRACTIONS_DATA.map((f) => f.percentage).filter((p) => p !== correct);
    } else {
      question = `💯 [Fractions Step 7]\nWhat fraction corresponds to ${item.percentage}?`;
      correct = item.fraction;
      pool = FRACTIONS_DATA.map((f) => f.fraction).filter((f) => f !== correct);
    }

    const distractors = shuffle(Array.from(new Set(pool))).slice(0, 3);
    const options = shuffle([correct, ...distractors]);

    return sanitizeTelegramQuiz({
      id: `calc_fraction_${idx}_${Date.now()}`,
      question,
      options,
      correctOption: options.indexOf(correct),
      solution: `${item.fraction} = ${item.percentage} (Decimal: ${item.decimal})`,
      subject: 'Calculation Studio',
      topic: 'Fractions & Percentages',
      source: 'Step 7: Fractions',
    });
  });
}

// ----------------------------------------------------
// 2. 25-QUESTION DAILY ROUTINE WORKOUT
// ----------------------------------------------------

export function getDailyRoutineWorkout(): TelegramQuizQuestion[] {
  // 4 Triplets, 4 Tables, 4 Squares, 3 Cubes, 4 Powers, 2 Factorials, 4 Fractions = 25 Questions
  const q1 = getTripletsStepDrill('10').slice(0, 4);
  const q2 = getTablesStepDrill('10').slice(0, 4);
  const q3 = getSquaresStepDrill('10').slice(0, 4);
  const q4 = getCubesStepDrill('10').slice(0, 3);
  const q5 = getPowersStepDrill('10').slice(0, 4);
  const q6 = getFactorialsStepDrill('all').slice(0, 2);
  const q7 = getFractionsStepDrill('10').slice(0, 4);

  return [...q1, ...q2, ...q3, ...q4, ...q5, ...q6, ...q7];
}

// ----------------------------------------------------
// 3. SIMPLIFICATION DRILL CATALOG (Easy, Moderate, Hard)
// ----------------------------------------------------

export interface SimplificationCategory {
  difficulty: 'Easy' | 'Moderate' | 'Hard';
  title: string;
  sets: {
    id: string;
    title: string;
    totalQuestions: number;
    questions: any[];
  }[];
}

export function getSimplificationCatalog(): SimplificationCategory[] {
  const sets = simplificationData as any[];
  const categories: Record<'Easy' | 'Moderate' | 'Hard', any[]> = {
    Easy: [],
    Moderate: [],
    Hard: [],
  };

  for (const s of sets) {
    const diff = (s.difficulty || 'Easy') as 'Easy' | 'Moderate' | 'Hard';
    if (categories[diff]) {
      categories[diff].push({
        id: s.id,
        title: s.title,
        totalQuestions: (s.questions || []).length,
        questions: s.questions || [],
      });
    }
  }

  return [
    { difficulty: 'Easy', title: `🟢 Easy Sets (${categories.Easy.length} Sets)`, sets: categories.Easy },
    { difficulty: 'Moderate', title: `🟡 Moderate Sets (${categories.Moderate.length} Sets)`, sets: categories.Moderate },
    { difficulty: 'Hard', title: `🔴 Hard Sets (${categories.Hard.length} Sets)`, sets: categories.Hard },
  ];
}
