import { TelegramQuizQuestion, sanitizeTelegramQuiz, shuffle } from './quizData';

// ----------------------------------------------------
// 1. CHAIN ADDITION (RUNNING LEFT-TO-RIGHT MENTAL SUM)
// ----------------------------------------------------

export function generateChainAdditionDrill(nodeCount: 5 | 10 = 5, count = 10): TelegramQuizQuestion[] {
  const questions: TelegramQuizQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const minVal = nodeCount === 5 ? 15 : 20;
    const maxVal = nodeCount === 5 ? 75 : 85;

    const nums: number[] = [];
    for (let j = 0; j < nodeCount; j++) {
      nums.push(Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal);
    }

    const total = nums.reduce((a, b) => a + b, 0);

    // Build step-by-step breakdown
    let running = nums[0];
    const steps: string[] = [`${nums[0]}`];
    for (let k = 1; k < nums.length; k++) {
      running += nums[k];
      steps.push(`+${nums[k]}=${running}`);
    }
    const breakdown = steps.slice(1, 4).join(' ➔ ') + (steps.length > 4 ? ' ➔ ...' : '');

    // Distractors
    const optionsSet = new Set<number>();
    optionsSet.add(total);
    optionsSet.add(total - 10);
    optionsSet.add(total + 10);
    optionsSet.add(total - 2);
    optionsSet.add(total + 2);
    optionsSet.add(total - 5);
    optionsSet.add(total + 5);

    const sortedOpts = shuffle(Array.from(optionsSet).slice(0, 4)).map(String);

    questions.push(
      sanitizeTelegramQuiz({
        id: `chain_add_${nodeCount}_${i + 1}`,
        question: `${nums.join(' + ')} = ?`,
        options: sortedOpts,
        correctOption: String(total),
        solution: `Total = ${total}.\nRunning sum: ${breakdown}\nTip: Hit nearest ten first, then leap tens.`,
        subject: 'Mental Math',
        topic: 'Chain Addition',
        source: 'Arun Sharma Speed Lab',
      })
    );
  }

  return questions;
}

// ----------------------------------------------------
// 2. SUBTRACTION (NUMBER LINE FORWARD HOPS)
// ----------------------------------------------------

export function generateSubtractionDrill(tier: '2digit' | '3digit' = '2digit', count = 10): TelegramQuizQuestion[] {
  const questions: TelegramQuizQuestion[] = [];

  for (let i = 0; i < count; i++) {
    let a: number;
    let b: number;

    if (tier === '2digit') {
      a = Math.floor(Math.random() * 55) + 45; // 45–99
      b = Math.floor(Math.random() * 35) + 15; // 15–49
      if (b >= a) b = a - 18;
    } else {
      a = Math.floor(Math.random() * 500) + 300; // 300–799
      b = Math.floor(Math.random() * 250) + 75;  // 75–324
      if (b >= a) b = a - 120;
    }

    const diff = a - b;

    // Number line hops
    const nearestTen = Math.ceil(b / 10) * 10;
    const hop1 = nearestTen - b;
    const hop2 = a - nearestTen;

    const optSet = new Set<number>();
    optSet.add(diff);
    optSet.add(diff - 10);
    optSet.add(diff + 10);
    optSet.add(diff - 2);
    optSet.add(diff + 2);

    const sortedOpts = shuffle(Array.from(optSet).slice(0, 4)).map(String);

    questions.push(
      sanitizeTelegramQuiz({
        id: `sub_${tier}_${i + 1}`,
        question: `${a} − ${b} = ?`,
        options: sortedOpts,
        correctOption: String(diff),
        solution: `Difference = ${diff}.\nHop: Jump ${b}➔${nearestTen} (+${hop1}), then ${nearestTen}➔${a} (+${hop2}). Sum hops: ${hop1}+${hop2} = ${diff}.`,
        subject: 'Mental Math',
        topic: 'Subtraction Hops',
        source: 'Arun Sharma Speed Lab',
      })
    );
  }

  return questions;
}

// ----------------------------------------------------
// 3. MULTIPLICATION (VEDIC & SHORTCUTS)
// ----------------------------------------------------

export function generateBase100Multiplication(count = 10): TelegramQuizQuestion[] {
  const questions: TelegramQuizQuestion[] = [];
  const belowPairs = [
    [94, 96], [92, 97], [93, 95], [89, 98], [91, 94],
    [95, 95], [88, 97], [93, 97], [96, 98], [87, 96]
  ];
  const abovePairs = [
    [104, 107], [103, 106], [105, 108], [102, 109], [106, 107],
    [103, 108], [104, 105], [107, 108], [102, 112], [105, 109]
  ];

  const pool = shuffle([...belowPairs, ...abovePairs]).slice(0, count);

  pool.forEach(([n1, n2], idx) => {
    const prod = n1 * n2;
    const d1 = n1 - 100;
    const d2 = n2 - 100;
    const leftPart = n1 + d2;
    const rightPart = d1 * d2;

    const optSet = new Set<number>();
    optSet.add(prod);
    optSet.add(prod - 100);
    optSet.add(prod + 100);
    optSet.add(prod - 10);
    optSet.add(prod + 10);

    const sortedOpts = shuffle(Array.from(optSet).slice(0, 4)).map(String);

    questions.push(
      sanitizeTelegramQuiz({
        id: `mult_base100_${idx + 1}`,
        question: `${n1} × ${n2} = ?`,
        options: sortedOpts,
        correctOption: String(prod),
        solution: `${n1} × ${n2} = ${prod}.\nDeviations (${d1}, ${d2}): Left = ${n1}+(${d2}) = ${leftPart}, Right = ${d1}×${d2} = ${rightPart} ➔ ${prod}.`,
        subject: 'Mental Math',
        topic: 'Base 100 Multiplication',
        source: 'Arun Sharma Speed Lab',
      })
    );
  });

  return questions;
}

export function generateSquareDiffMultiplication(count = 10): TelegramQuizQuestion[] {
  const anchors = [
    { anchor: 20, diff: 2 }, // 18 x 22
    { anchor: 30, diff: 3 }, // 27 x 33
    { anchor: 40, diff: 4 }, // 36 x 44
    { anchor: 50, diff: 3 }, // 47 x 53
    { anchor: 50, diff: 5 }, // 45 x 55
    { anchor: 60, diff: 2 }, // 58 x 62
    { anchor: 70, diff: 4 }, // 66 x 74
    { anchor: 80, diff: 3 }, // 77 x 83
    { anchor: 90, diff: 5 }, // 85 x 95
    { anchor: 100, diff: 4 }, // 96 x 104
  ];

  const pool = shuffle(anchors).slice(0, count);

  return pool.map((item, idx) => {
    const a = item.anchor - item.diff;
    const b = item.anchor + item.diff;
    const prod = a * b; // anchor^2 - diff^2
    const sq = item.anchor * item.anchor;
    const dSq = item.diff * item.diff;

    const optSet = new Set<number>();
    optSet.add(prod);
    optSet.add(prod - 10);
    optSet.add(prod + 10);
    optSet.add(sq);

    const sortedOpts = shuffle(Array.from(optSet).slice(0, 4)).map(String);

    return sanitizeTelegramQuiz({
      id: `mult_sqdiff_${idx + 1}`,
      question: `${a} × ${b} = ?`,
      options: sortedOpts,
      correctOption: String(prod),
      solution: `${a} × ${b} = ${prod}.\nAnchor = ${item.anchor}, Diff = ${item.diff}.\nShortcut: ${item.anchor}² − ${item.diff}² = ${sq} − ${dSq} = ${prod}.`,
      subject: 'Mental Math',
      topic: 'Difference of Squares',
      source: 'Arun Sharma Speed Lab',
    });
  });
}

// ----------------------------------------------------
// 4. DIVISION & PERCENTAGES (10% LADDER & RATIOS)
// ----------------------------------------------------

export function generateDecimalPercentageDrill(count = 8): TelegramQuizQuestion[] {
  const problems = [
    { num: 53, den: 81, bracket: '60%–70%', reason: '10% of 81 = 8.1 ➔ 60% = 48.6, 70% = 56.7' },
    { num: 37, den: 48, bracket: '70%–80%', reason: '10% of 48 = 4.8 ➔ 70% = 33.6, 80% = 38.4' },
    { num: 23, den: 72, bracket: '30%–40%', reason: '10% of 72 = 7.2 ➔ 30% = 21.6, 40% = 28.8' },
    { num: 68, den: 92, bracket: '70%–80%', reason: '10% of 92 = 9.2 ➔ 70% = 64.4, 80% = 73.6' },
    { num: 41, den: 85, bracket: '40%–50%', reason: '10% of 85 = 8.5 ➔ 40% = 34.0, 50% = 42.5' },
    { num: 19, den: 36, bracket: '50%–60%', reason: '10% of 36 = 3.6 ➔ 50% = 18.0, 60% = 21.6' },
    { num: 76, den: 88, bracket: '80%–90%', reason: '10% of 88 = 8.8 ➔ 80% = 70.4, 90% = 79.2' },
    { num: 29, den: 64, bracket: '40%–50%', reason: '10% of 64 = 6.4 ➔ 40% = 25.6, 50% = 32.0' },
  ];

  const pool = shuffle(problems).slice(0, count);

  return pool.map((p, idx) => {
    const brackets = ['30%–40%', '40%–50%', '50%–60%', '60%–70%', '70%–80%', '80%–90%'];
    const otherBrackets = brackets.filter((b) => b !== p.bracket);
    const chosenOthers = shuffle(otherBrackets).slice(0, 3);
    const options = shuffle([p.bracket, ...chosenOthers]);

    return sanitizeTelegramQuiz({
      id: `div_pct_${idx + 1}`,
      question: `Estimate percentage: ${p.num} / ${p.den} ≈ ?`,
      options,
      correctOption: p.bracket,
      solution: `Bracket: ${p.bracket}.\n${p.reason}.\nSince ${p.num} falls inside this range, bracket is ${p.bracket}.`,
      subject: 'Mental Math',
      topic: 'Decimal % Estimation',
      source: 'Arun Sharma Speed Lab',
    });
  });
}

export function generateRatioFaceOffDrill(count = 6): TelegramQuizQuestion[] {
  const problems = [
    {
      r1: '173 / 212',
      r2: '181 / 241',
      correct: 'Ratio A (173 / 212)',
      reason: 'Num grows by 4.6%, but Denom grows by 13.6%. Denominator grew much faster ➔ Ratio A is larger!'
    },
    {
      r1: '245 / 310',
      r2: '290 / 330',
      correct: 'Ratio B (290 / 330)',
      reason: 'Num grows by 18.3%, while Denom grows by only 6.4%. Numerator grew faster ➔ Ratio B is larger!'
    },
    {
      r1: '315 / 420',
      r2: '340 / 480',
      correct: 'Ratio A (315 / 420)',
      reason: '315/420 = 75%. 340/480 = 70.8%. Ratio A is strictly larger!'
    },
    {
      r1: '124 / 165',
      r2: '148 / 185',
      correct: 'Ratio B (148 / 185)',
      reason: '148/185 = 80%. 124/165 = 75.15%. Ratio B is larger!'
    },
  ];

  const pool = shuffle(problems).slice(0, count);

  return pool.map((p, idx) => {
    return sanitizeTelegramQuiz({
      id: `ratio_comp_${idx + 1}`,
      question: `Which fraction is larger?\nA: ${p.r1}  or  B: ${p.r2}`,
      options: ['Ratio A (' + p.r1 + ')', 'Ratio B (' + p.r2 + ')', 'Both are equal', 'Cannot determine'],
      correctOption: p.correct,
      solution: `${p.correct} is larger!\n${p.reason}`,
      subject: 'Mental Math',
      topic: 'Ratio Comparison',
      source: 'Arun Sharma Speed Lab',
    });
  });
}

// ----------------------------------------------------
// 5. COMPREHENSIVE MENTAL MATH BLITZ (MIXED)
// ----------------------------------------------------

export function generateMentalMathBlitz(count = 12): TelegramQuizQuestion[] {
  const addQs = generateChainAdditionDrill(5, 3);
  const subQs = generateSubtractionDrill('2digit', 3);
  const multQs = generateBase100Multiplication(3);
  const divQs = generateDecimalPercentageDrill(3);

  return shuffle([...addQs, ...subQs, ...multQs, ...divQs]).slice(0, count);
}
