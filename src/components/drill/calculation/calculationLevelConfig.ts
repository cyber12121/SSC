// Master level configurations for Arun Sharma Speed Calculation Drills

export interface AdditionLevelConfig {
  level: number;
  title: string;
  nodeCount: 5 | 10;
  minVal: number;
  maxVal: number;
  description: string;
  centuryCrossing: 'low' | 'moderate' | 'high' | 'heavy' | 'full';
  targetBenchmarkSec: number;
}

export const ADDITION_LEVELS: AdditionLevelConfig[] = [
  {
    level: 1,
    title: 'Foundations Sprint',
    nodeCount: 5,
    minVal: 11,
    maxVal: 30,
    description: 'Decompose small 2-digit numbers into tens & units.',
    centuryCrossing: 'low',
    targetBenchmarkSec: 6
  },
  {
    level: 2,
    title: 'Foundations Stamina',
    nodeCount: 10,
    minVal: 11,
    maxVal: 30,
    description: 'Full 10-node chain with small numbers to build mental flow.',
    centuryCrossing: 'low',
    targetBenchmarkSec: 12
  },
  {
    level: 3,
    title: 'Mid-Tier Sprint',
    nodeCount: 5,
    minVal: 30,
    maxVal: 50,
    description: 'Jump through the 30–50 range and bridge hundreds easily.',
    centuryCrossing: 'moderate',
    targetBenchmarkSec: 7
  },
  {
    level: 4,
    title: 'Mid-Tier Stamina',
    nodeCount: 10,
    minVal: 30,
    maxVal: 50,
    description: '10 consecutive additions reaching totals ~350–450.',
    centuryCrossing: 'moderate',
    targetBenchmarkSec: 14
  },
  {
    level: 5,
    title: 'Upper-Tier Sprint',
    nodeCount: 5,
    minVal: 50,
    maxVal: 70,
    description: 'Fast reflex on numbers in the 50s and 60s.',
    centuryCrossing: 'high',
    targetBenchmarkSec: 8
  },
  {
    level: 6,
    title: 'Upper-Tier Stamina',
    nodeCount: 10,
    minVal: 50,
    maxVal: 70,
    description: 'Consecutive century crossings reaching ~550–650.',
    centuryCrossing: 'high',
    targetBenchmarkSec: 16
  },
  {
    level: 7,
    title: 'Heavyweight Sprint',
    nodeCount: 5,
    minVal: 70,
    maxVal: 99,
    description: 'Master highest 2-digit combinations (70s, 80s, 90s).',
    centuryCrossing: 'heavy',
    targetBenchmarkSec: 9
  },
  {
    level: 8,
    title: 'Heavyweight Stamina',
    nodeCount: 10,
    minVal: 70,
    maxVal: 99,
    description: 'Intense running working-memory challenge reaching ~800+.',
    centuryCrossing: 'heavy',
    targetBenchmarkSec: 18
  },
  {
    level: 9,
    title: 'Mixed Exam Sprint',
    nodeCount: 5,
    minVal: 11,
    maxVal: 99,
    description: 'Unpredictable mix of small and large 2-digit numbers.',
    centuryCrossing: 'full',
    targetBenchmarkSec: 8
  },
  {
    level: 10,
    title: 'Arun Sharma Legend',
    nodeCount: 10,
    minVal: 11,
    maxVal: 99,
    description: 'The ultimate CAT / SSC CGL speed benchmark (Page 2 of the book).',
    centuryCrossing: 'full',
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
}

export const SUBTRACTION_LEVELS: SubtractionLevelConfig[] = [
  {
    level: 1,
    title: 'Friendly Decade Hop',
    minVal: 11,
    maxVal: 50,
    description: 'Single hop forward with no unit borrowing needed.',
    type: 'same_decade'
  },
  {
    level: 2,
    title: 'Unit-Match Hop (20–70)',
    minVal: 20,
    maxVal: 70,
    description: 'Hop to align unit digit first, then leap the tens.',
    type: 'unit_match'
  },
  {
    level: 3,
    title: 'Decade Bridge Hop (50–100)',
    minVal: 50,
    maxVal: 100,
    description: 'Bridge through nearest multiple of 10 or 50.',
    type: 'century_bridge'
  },
  {
    level: 4,
    title: 'Century Crossing (80–180)',
    minVal: 80,
    maxVal: 180,
    description: 'Forward jump across 100 on the number line.',
    type: 'century_bridge'
  },
  {
    level: 5,
    title: '3-Digit Matching Milestone (200–999)',
    minVal: 200,
    maxVal: 999,
    description: 'Arun Sharma method: jump to match end digits, then leap hundreds.',
    type: 'three_digit_match'
  },
  {
    level: 6,
    title: '3-Digit Complex Leap (300–999)',
    minVal: 300,
    maxVal: 999,
    description: 'High-speed exam subtraction without borrowing.',
    type: 'three_digit_complex'
  }
];

const LOCAL_STORAGE_ADDITION_KEY = 'cgl_calc_addition_progress_v1';
const LOCAL_STORAGE_SUBTRACTION_KEY = 'cgl_calc_subtraction_progress_v1';

export interface ModuleProgress {
  unlockedLevel: number;
  streakCount: Record<number, number>; // level -> consecutive 100% runs (need 3 to unlock next)
  bestTimes: Record<number, number>; // level -> best completion time in seconds
}

export const loadAdditionProgress = (): ModuleProgress => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ADDITION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { unlockedLevel: 1, streakCount: {}, bestTimes: {} };
};

export const saveAdditionProgress = (p: ModuleProgress) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_ADDITION_KEY, JSON.stringify(p));
  } catch {}
};

export const loadSubtractionProgress = (): ModuleProgress => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUBTRACTION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { unlockedLevel: 1, streakCount: {}, bestTimes: {} };
};

export const saveSubtractionProgress = (p: ModuleProgress) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_SUBTRACTION_KEY, JSON.stringify(p));
  } catch {}
};
