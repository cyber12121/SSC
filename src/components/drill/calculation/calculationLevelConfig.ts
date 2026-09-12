// Master level configurations for Arun Sharma Speed Calculation Drills

export interface AdditionLevelConfig {
  level: number;
  title: string;
  nodeCount: 5 | 10;
  minVal: number;
  maxVal: number;
  description: string;
  passingScore: number; // out of 10 questions
  targetBenchmarkSec: number;
}

export const ADDITION_LEVELS: AdditionLevelConfig[] = [
  {
    level: 1,
    title: 'Foundations Sprint (5 Nos)',
    nodeCount: 5,
    minVal: 11,
    maxVal: 30,
    description: 'Add 5 consecutive numbers (11–30) mentally in one go.',
    passingScore: 8,
    targetBenchmarkSec: 6
  },
  {
    level: 2,
    title: 'Foundations Stamina (10 Nos)',
    nodeCount: 10,
    minVal: 11,
    maxVal: 30,
    description: 'Add 10 consecutive numbers (11–30) mentally in one go.',
    passingScore: 8,
    targetBenchmarkSec: 12
  },
  {
    level: 3,
    title: 'Mid-Tier Sprint (5 Nos)',
    nodeCount: 5,
    minVal: 30,
    maxVal: 50,
    description: 'Add 5 consecutive numbers (30–50) crossing hundreds easily.',
    passingScore: 8,
    targetBenchmarkSec: 7
  },
  {
    level: 4,
    title: 'Mid-Tier Stamina (10 Nos)',
    nodeCount: 10,
    minVal: 30,
    maxVal: 50,
    description: 'Add 10 consecutive numbers (30–50) reaching totals ~350–450.',
    passingScore: 8,
    targetBenchmarkSec: 14
  },
  {
    level: 5,
    title: 'Upper-Tier Sprint (5 Nos)',
    nodeCount: 5,
    minVal: 50,
    maxVal: 70,
    description: 'Fast mental reflex on 5 numbers in the 50s and 60s.',
    passingScore: 8,
    targetBenchmarkSec: 8
  },
  {
    level: 6,
    title: 'Upper-Tier Stamina (10 Nos)',
    nodeCount: 10,
    minVal: 50,
    maxVal: 70,
    description: '10 consecutive additions of 50s–60s reaching ~550–650.',
    passingScore: 8,
    targetBenchmarkSec: 16
  },
  {
    level: 7,
    title: 'Heavyweight Sprint (5 Nos)',
    nodeCount: 5,
    minVal: 70,
    maxVal: 99,
    description: '5 high 2-digit numbers (70s, 80s, 90s) in continuous flow.',
    passingScore: 8,
    targetBenchmarkSec: 9
  },
  {
    level: 8,
    title: 'Heavyweight Stamina (10 Nos)',
    nodeCount: 10,
    minVal: 70,
    maxVal: 99,
    description: '10 high 2-digit numbers reaching totals ~800+.',
    passingScore: 8,
    targetBenchmarkSec: 18
  },
  {
    level: 9,
    title: 'Mixed Exam Sprint (5 Nos)',
    nodeCount: 5,
    minVal: 11,
    maxVal: 99,
    description: 'Mixed small and large numbers (11–99) exam simulation.',
    passingScore: 9,
    targetBenchmarkSec: 8
  },
  {
    level: 10,
    title: 'Arun Sharma Legend (10 Nos)',
    nodeCount: 10,
    minVal: 11,
    maxVal: 99,
    description: 'The ultimate CAT / SSC CGL 10-number benchmark (Page 2 of the book).',
    passingScore: 9,
    targetBenchmarkSec: 12
  }
];

export interface SubtractionLevelConfig {
  level: number;
  title: string;
  minVal: number;
  maxVal: number;
  description: string;
  type: 'same_decade' | 'unit_match' | 'century_bridge' | 'three_digit_match' | 'three_digit_complex';
  questionCount: number;
  passingScore: number;
  targetBenchmarkSec: number;
}

export const SUBTRACTION_LEVELS: SubtractionLevelConfig[] = [
  {
    level: 1,
    title: 'Friendly Decade Hop (11–50)',
    minVal: 11,
    maxVal: 50,
    description: 'Single hop forward with no unit borrowing needed (e.g. 48 − 23).',
    type: 'same_decade',
    questionCount: 10,
    passingScore: 8,
    targetBenchmarkSec: 3
  },
  {
    level: 2,
    title: 'Unit-Match Hop (20–75)',
    minVal: 20,
    maxVal: 75,
    description: 'Hop forward to align unit digit first, then leap tens (e.g. 72 − 38).',
    type: 'unit_match',
    questionCount: 10,
    passingScore: 8,
    targetBenchmarkSec: 4
  },
  {
    level: 3,
    title: 'Decade Bridge Hop (40–100)',
    minVal: 40,
    maxVal: 100,
    description: 'Forward jump across multiples of 10 or 50 milestone (e.g. 83 − 37).',
    type: 'century_bridge',
    questionCount: 10,
    passingScore: 8,
    targetBenchmarkSec: 4
  },
  {
    level: 4,
    title: 'Century Crossing (70–190)',
    minVal: 70,
    maxVal: 190,
    description: 'Arun Sharma benchmark: leap across 100 on the number line (e.g. 134 − 78).',
    type: 'century_bridge',
    questionCount: 10,
    passingScore: 8,
    targetBenchmarkSec: 5
  },
  {
    level: 5,
    title: '3-Digit Matching Milestone (200–999)',
    minVal: 200,
    maxVal: 999,
    description: 'Jump to match end digits, then leap the hundreds (e.g. 738 − 211).',
    type: 'three_digit_match',
    questionCount: 10,
    passingScore: 8,
    targetBenchmarkSec: 6
  },
  {
    level: 6,
    title: '3-Digit Complex Leap (300–999)',
    minVal: 300,
    maxVal: 999,
    description: 'Exam speed subtraction crossing century benchmarks (e.g. 813 − 478).',
    type: 'three_digit_complex',
    questionCount: 10,
    passingScore: 8,
    targetBenchmarkSec: 7
  }
];

const LOCAL_STORAGE_ADDITION_KEY = 'cgl_calc_addition_progress_v2';
const LOCAL_STORAGE_SUBTRACTION_KEY = 'cgl_calc_subtraction_progress_v1';

export interface ModuleProgress {
  unlockedLevel: number;
  bestScores: Record<number, number>; // level -> best score out of 10
  bestTimes: Record<number, number>;  // level -> completion time in seconds
  streakCount: Record<number, number>; // level -> streak count
}

export const loadAdditionProgress = (): ModuleProgress => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(LOCAL_STORAGE_ADDITION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          unlockedLevel: parsed.unlockedLevel || 1,
          bestScores: parsed.bestScores || {},
          bestTimes: parsed.bestTimes || {},
          streakCount: parsed.streakCount || {}
        };
      }
    }
  } catch {}
  return { unlockedLevel: 1, bestScores: {}, bestTimes: {}, streakCount: {} };
};

export const saveAdditionProgress = (p: ModuleProgress) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(LOCAL_STORAGE_ADDITION_KEY, JSON.stringify(p));
    }
  } catch {}
};

export const loadSubtractionProgress = (): ModuleProgress => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(LOCAL_STORAGE_SUBTRACTION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          unlockedLevel: parsed.unlockedLevel || 1,
          bestScores: parsed.bestScores || {},
          bestTimes: parsed.bestTimes || {},
          streakCount: parsed.streakCount || {}
        };
      }
    }
  } catch {}
  return { unlockedLevel: 1, bestScores: {}, bestTimes: {}, streakCount: {} };
};

export const saveSubtractionProgress = (p: ModuleProgress) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(LOCAL_STORAGE_SUBTRACTION_KEY, JSON.stringify(p));
    }
  } catch {}
};
