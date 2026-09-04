export interface TripletItem {
  a: number;
  b: number;
  c: number;
  type: 'primitive';
  tags?: string[];
}

export interface CalculationQuestion {
  id: string;
  section: 'triplets' | 'tables' | 'squares' | 'cubes' | 'powers' | 'factorials';
  sectionTitle: string;
  prompt: string;
  subPrompt?: string;
  answer: number;
  explanation?: string;
  rawKey: string; // Unique key to track individual items (e.g. 'square-19', 'triplet-5-12-13', 'table-17')
  metadata?: Record<string, any>;
}

// 1. Primitive Triplets Only (All 16 must-know SSC primitive triplets)
export const PRIMITIVE_TRIPLETS: TripletItem[] = [
  { a: 3, b: 4, c: 5, type: 'primitive', tags: ['basic', 'must-know'] },
  { a: 5, b: 12, c: 13, type: 'primitive', tags: ['basic', 'must-know'] },
  { a: 7, b: 24, c: 25, type: 'primitive', tags: ['basic', 'must-know'] },
  { a: 8, b: 15, c: 17, type: 'primitive', tags: ['basic', 'must-know'] },
  { a: 9, b: 40, c: 41, type: 'primitive', tags: ['basic', 'must-know'] },
  { a: 11, b: 60, c: 61, type: 'primitive', tags: ['standard'] },
  { a: 12, b: 35, c: 37, type: 'primitive', tags: ['standard', 'high-frequency'] },
  { a: 13, b: 84, c: 85, type: 'primitive', tags: ['advanced'] },
  { a: 16, b: 63, c: 65, type: 'primitive', tags: ['standard'] },
  { a: 20, b: 21, c: 29, type: 'primitive', tags: ['high-frequency'] },
  { a: 28, b: 45, c: 53, type: 'primitive', tags: ['standard'] },
  { a: 33, b: 56, c: 65, type: 'primitive', tags: ['advanced'] },
  { a: 36, b: 77, c: 85, type: 'primitive', tags: ['advanced'] },
  { a: 39, b: 80, c: 89, type: 'primitive', tags: ['advanced'] },
  { a: 48, b: 55, c: 73, type: 'primitive', tags: ['advanced'] },
  { a: 65, b: 72, c: 97, type: 'primitive', tags: ['advanced'] },
];

export const TRIPLETS_DATA = PRIMITIVE_TRIPLETS;

// 2. Tables: 12 to 24 (all 13 numbers from 12 through 24)
export const TABLES_CONFIG = {
  minTable: 12,
  maxTable: 24,
  multipliers: [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19],
};

// 3. Squares: 17 to 39 (all 23 numbers from 17 through 39)
export const SQUARES_17_39 = Array.from({ length: 39 - 17 + 1 }, (_, i) => {
  const n = 17 + i;
  return { n, val: n * n };
});

// 4. Cubes: 11 to 25 (all 15 numbers from 11 through 25)
export const CUBES_11_25 = Array.from({ length: 25 - 11 + 1 }, (_, i) => {
  const n = 11 + i;
  return { n, val: n * n * n };
});

// 5. Powers:
// - Powers up to 6 of 2, 3, 4 (18 items)
// - Powers up to 4 of 5, 6, 7, 8, 9 (20 items)
// Total = 38 distinct power combinations
export const POWERS_DATA = [
  // 2^1 to 2^6
  { base: 2, exp: 1, val: 2 },
  { base: 2, exp: 2, val: 4 },
  { base: 2, exp: 3, val: 8 },
  { base: 2, exp: 4, val: 16 },
  { base: 2, exp: 5, val: 32 },
  { base: 2, exp: 6, val: 64 },

  // 3^1 to 3^6
  { base: 3, exp: 1, val: 3 },
  { base: 3, exp: 2, val: 9 },
  { base: 3, exp: 3, val: 27 },
  { base: 3, exp: 4, val: 81 },
  { base: 3, exp: 5, val: 243 },
  { base: 3, exp: 6, val: 729 },

  // 4^1 to 4^6
  { base: 4, exp: 1, val: 4 },
  { base: 4, exp: 2, val: 16 },
  { base: 4, exp: 3, val: 64 },
  { base: 4, exp: 4, val: 256 },
  { base: 4, exp: 5, val: 1024 },
  { base: 4, exp: 6, val: 4096 },

  // 5^1 to 5^4
  { base: 5, exp: 1, val: 5 },
  { base: 5, exp: 2, val: 25 },
  { base: 5, exp: 3, val: 125 },
  { base: 5, exp: 4, val: 625 },

  // 6^1 to 6^4
  { base: 6, exp: 1, val: 6 },
  { base: 6, exp: 2, val: 36 },
  { base: 6, exp: 3, val: 216 },
  { base: 6, exp: 4, val: 1296 },

  // 7^1 to 7^4
  { base: 7, exp: 1, val: 7 },
  { base: 7, exp: 2, val: 49 },
  { base: 7, exp: 3, val: 343 },
  { base: 7, exp: 4, val: 2401 },

  // 8^1 to 8^4
  { base: 8, exp: 1, val: 8 },
  { base: 8, exp: 2, val: 64 },
  { base: 8, exp: 3, val: 512 },
  { base: 8, exp: 4, val: 4096 },

  // 9^1 to 9^4
  { base: 9, exp: 1, val: 9 },
  { base: 9, exp: 2, val: 81 },
  { base: 9, exp: 3, val: 729 },
  { base: 9, exp: 4, val: 6561 },
];

// 6. Factorials up to 8 (all 8 numbers from 1! to 8!)
export const FACTORIALS_DATA = [
  { n: 1, val: 1, breakdown: '1' },
  { n: 2, val: 2, breakdown: '2 × 1' },
  { n: 3, val: 6, breakdown: '3 × 2 × 1' },
  { n: 4, val: 24, breakdown: '4 × 6' },
  { n: 5, val: 120, breakdown: '5 × 24' },
  { n: 6, val: 720, breakdown: '6 × 120' },
  { n: 7, val: 5040, breakdown: '7 × 720' },
  { n: 8, val: 40320, breakdown: '8 × 5040' },
];

// Section definitions in order
export const CALC_SECTIONS = [
  {
    id: 'triplets',
    title: 'Primitive Triplets',
    shortTitle: 'Triplets (Primitives)',
    badge: 'Step 1',
    description: 'All 16 primitive Pythagorean triplets tested at least once',
    count: PRIMITIVE_TRIPLETS.length,
    color: 'from-blue-600 to-indigo-600',
    lightBg: 'bg-blue-50 text-blue-700 border-blue-200',
    accentColor: 'blue',
  },
  {
    id: 'tables',
    title: 'Tables (12 to 24)',
    shortTitle: 'Tables 12–24',
    badge: 'Step 2',
    description: 'Every table from 12 through 24 tested at least once',
    count: 24 - 12 + 1,
    color: 'from-emerald-600 to-teal-600',
    lightBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentColor: 'emerald',
  },
  {
    id: 'squares',
    title: 'Squares (17 to 39)',
    shortTitle: 'Squares 17–39',
    badge: 'Step 3',
    description: 'Every square from 17² to 39² tested at least once',
    count: SQUARES_17_39.length,
    color: 'from-amber-500 to-orange-600',
    lightBg: 'bg-amber-50 text-amber-700 border-amber-200',
    accentColor: 'amber',
  },
  {
    id: 'cubes',
    title: 'Cubes (11 to 25)',
    shortTitle: 'Cubes 11–25',
    badge: 'Step 4',
    description: 'Every cube from 11³ to 25³ tested at least once',
    count: CUBES_11_25.length,
    color: 'from-purple-600 to-violet-600',
    lightBg: 'bg-purple-50 text-purple-700 border-purple-200',
    accentColor: 'purple',
  },
  {
    id: 'powers',
    title: 'Powers (2–4 to ^6 & 5–9 to ^4)',
    shortTitle: 'Powers',
    badge: 'Step 5',
    description: 'All 38 power values tested at least once',
    count: POWERS_DATA.length,
    color: 'from-rose-500 to-pink-600',
    lightBg: 'bg-rose-50 text-rose-700 border-rose-200',
    accentColor: 'rose',
  },
  {
    id: 'factorials',
    title: 'Factorials (1! to 8!)',
    shortTitle: 'Factorials 1–8',
    badge: 'Step 6',
    description: 'All 8 factorials from 1! to 8! tested at least once',
    count: FACTORIALS_DATA.length,
    color: 'from-cyan-600 to-blue-600',
    lightBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    accentColor: 'cyan',
  },
] as const;

export type SectionId = (typeof CALC_SECTIONS)[number]['id'];

// Fisher-Yates Shuffler
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate question for a specific primitive triplet
export function createTripletQuestion(item: TripletItem): CalculationQuestion {
  // 50% missing hypotenuse, 25% missing leg a, 25% missing leg b
  const missing = Math.random() < 0.5 ? 'c' : Math.random() < 0.5 ? 'a' : 'b';
  let prompt = '';
  let subPrompt = '';
  let answer = 0;

  if (missing === 'c') {
    prompt = `[ ${item.a} , ${item.b} , ? ]`;
    subPrompt = 'Find the Hypotenuse (c)';
    answer = item.c;
  } else if (missing === 'a') {
    prompt = `[ ? , ${item.b} , ${item.c} ]`;
    subPrompt = 'Find missing Leg (a)';
    answer = item.a;
  } else {
    prompt = `[ ${item.a} , ? , ${item.c} ]`;
    subPrompt = 'Find missing Leg (b)';
    answer = item.b;
  }

  return {
    id: `triplet-${item.a}-${item.b}-${item.c}-${Date.now()}-${Math.random()}`,
    section: 'triplets',
    sectionTitle: 'Primitive Triplets',
    prompt,
    subPrompt,
    answer,
    rawKey: `triplet-${item.a}-${item.b}-${item.c}`,
    explanation: `${item.a}² + ${item.b}² = ${item.a * item.a} + ${item.b * item.b} = ${item.c * item.c} = ${item.c}²`,
    metadata: { item, missing },
  };
}

// Generate question for a table number
export function createTableQuestion(table: number): CalculationQuestion {
  const multiplier = TABLES_CONFIG.multipliers[Math.floor(Math.random() * TABLES_CONFIG.multipliers.length)];
  return {
    id: `table-${table}-${multiplier}-${Date.now()}-${Math.random()}`,
    section: 'tables',
    sectionTitle: 'Tables 12–24',
    prompt: `${table} × ${multiplier}`,
    subPrompt: `Calculate product`,
    answer: table * multiplier,
    rawKey: `table-${table}`,
    explanation: `${table} × ${multiplier} = ${table * multiplier}`,
  };
}

// Generate question for square
export function createSquareQuestion(item: { n: number; val: number }): CalculationQuestion {
  const isRoot = Math.random() < 0.25;
  if (isRoot) {
    return {
      id: `square-root-${item.n}-${Date.now()}-${Math.random()}`,
      section: 'squares',
      sectionTitle: 'Squares 17–39',
      prompt: `√${item.val}`,
      subPrompt: `Square root of ${item.val}`,
      answer: item.n,
      rawKey: `square-${item.n}`,
      explanation: `√${item.val} = ${item.n} (since ${item.n}² = ${item.val})`,
    };
  }
  return {
    id: `square-${item.n}-${Date.now()}-${Math.random()}`,
    section: 'squares',
    sectionTitle: 'Squares 17–39',
    prompt: `${item.n}²`,
    subPrompt: `Square of ${item.n}`,
    answer: item.val,
    rawKey: `square-${item.n}`,
    explanation: `${item.n}² = ${item.val}`,
  };
}

// Generate question for cube
export function createCubeQuestion(item: { n: number; val: number }): CalculationQuestion {
  const isRoot = Math.random() < 0.25;
  if (isRoot) {
    return {
      id: `cube-root-${item.n}-${Date.now()}-${Math.random()}`,
      section: 'cubes',
      sectionTitle: 'Cubes 11–25',
      prompt: `∛${item.val}`,
      subPrompt: `Cube root of ${item.val}`,
      answer: item.n,
      rawKey: `cube-${item.n}`,
      explanation: `∛${item.val} = ${item.n} (since ${item.n}³ = ${item.val})`,
    };
  }
  return {
    id: `cube-${item.n}-${Date.now()}-${Math.random()}`,
    section: 'cubes',
    sectionTitle: 'Cubes 11–25',
    prompt: `${item.n}³`,
    subPrompt: `Cube of ${item.n}`,
    answer: item.val,
    rawKey: `cube-${item.n}`,
    explanation: `${item.n}³ = ${item.val}`,
  };
}

// Generate question for power
export function createPowerQuestion(item: { base: number; exp: number; val: number }): CalculationQuestion {
  return {
    id: `power-${item.base}-${item.exp}-${Date.now()}-${Math.random()}`,
    section: 'powers',
    sectionTitle: 'Powers (2–9)',
    prompt: `${item.base}^${item.exp}`,
    subPrompt: `${item.base} raised to power ${item.exp}`,
    answer: item.val,
    rawKey: `power-${item.base}^${item.exp}`,
    explanation: `${item.base}^${item.exp} = ${item.val}`,
  };
}

// Generate question for factorial
export function createFactorialQuestion(item: { n: number; val: number; breakdown: string }): CalculationQuestion {
  return {
    id: `factorial-${item.n}-${Date.now()}-${Math.random()}`,
    section: 'factorials',
    sectionTitle: 'Factorials 1–8',
    prompt: `${item.n}!`,
    subPrompt: `Factorial of ${item.n}`,
    answer: item.val,
    rawKey: `factorial-${item.n}`,
    explanation: `${item.n}! = ${item.breakdown} = ${item.val}`,
  };
}

/**
 * Generates an EXHAUSTIVE, shuffled deck for a section guaranteeing that
 * EVERY single number in the required range appears at least once!
 */
export function generateExhaustiveDeckForSection(section: SectionId): CalculationQuestion[] {
  switch (section) {
    case 'triplets': {
      // All 16 primitive triplets
      const deck = PRIMITIVE_TRIPLETS.map((t) => createTripletQuestion(t));
      return shuffleArray(deck);
    }

    case 'tables': {
      // All tables from 12 through 24
      const tablesList = Array.from(
        { length: TABLES_CONFIG.maxTable - TABLES_CONFIG.minTable + 1 },
        (_, i) => TABLES_CONFIG.minTable + i
      );
      const deck = tablesList.map((tbl) => createTableQuestion(tbl));
      return shuffleArray(deck);
    }

    case 'squares': {
      // All numbers from 17 through 39
      const deck = SQUARES_17_39.map((item) => createSquareQuestion(item));
      return shuffleArray(deck);
    }

    case 'cubes': {
      // All numbers from 11 through 25
      const deck = CUBES_11_25.map((item) => createCubeQuestion(item));
      return shuffleArray(deck);
    }

    case 'powers': {
      // All 38 power items (2,3,4 to 6 & 5,6,7,8,9 to 4)
      const deck = POWERS_DATA.map((item) => createPowerQuestion(item));
      return shuffleArray(deck);
    }

    case 'factorials': {
      // All 8 factorials (1! to 8!)
      const deck = FACTORIALS_DATA.map((item) => createFactorialQuestion(item));
      return shuffleArray(deck);
    }
  }
}

// Fallback single question generator
export function generateQuestionForSection(section: SectionId): CalculationQuestion {
  const deck = generateExhaustiveDeckForSection(section);
  return deck[0];
}
