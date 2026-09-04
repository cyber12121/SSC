export interface TripletItem {
  a: number;
  b: number;
  c: number;
  type: 'primitive' | 'scaled';
  base?: string;
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
  metadata?: Record<string, any>;
}

// 1. Triplets (Pythagorean Triplets)
export const TRIPLETS_DATA: TripletItem[] = [
  // Primitives
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
  // High Frequency Scaled
  { a: 6, b: 8, c: 10, type: 'scaled', base: '3, 4, 5 (×2)' },
  { a: 9, b: 12, c: 15, type: 'scaled', base: '3, 4, 5 (×3)' },
  { a: 12, b: 16, c: 20, type: 'scaled', base: '3, 4, 5 (×4)' },
  { a: 15, b: 20, c: 25, type: 'scaled', base: '3, 4, 5 (×5)' },
  { a: 18, b: 24, c: 30, type: 'scaled', base: '3, 4, 5 (×6)' },
  { a: 10, b: 24, c: 26, type: 'scaled', base: '5, 12, 13 (×2)' },
  { a: 15, b: 36, c: 39, type: 'scaled', base: '5, 12, 13 (×3)' },
  { a: 14, b: 48, c: 50, type: 'scaled', base: '7, 24, 25 (×2)' },
  { a: 16, b: 30, c: 34, type: 'scaled', base: '8, 15, 17 (×2)' },
  { a: 24, b: 70, c: 74, type: 'scaled', base: '12, 35, 37 (×2)' },
  { a: 40, b: 42, c: 58, type: 'scaled', base: '20, 21, 29 (×2)' },
];

// 2. Tables: 12 to 24
// Multipliers 2 through 12, plus 13-20 for high-frequency banking/SSC speed
export const TABLES_CONFIG = {
  minTable: 12,
  maxTable: 24,
  multipliers: [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19],
};

// 3. Squares: 17 to 39
export const SQUARES_17_39 = Array.from({ length: 39 - 17 + 1 }, (_, i) => {
  const n = 17 + i;
  return { n, val: n * n };
});

// 4. Cubes: 11 to 25
export const CUBES_11_25 = Array.from({ length: 25 - 11 + 1 }, (_, i) => {
  const n = 11 + i;
  return { n, val: n * n * n };
});

// 5. Powers:
// - Powers up to 6 of 2, 3, 4
// - Powers up to 4 of 5, 6, 7, 8, 9
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

// 6. Factorials up to 8
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
    title: 'Pythagorean Triplets',
    shortTitle: 'Triplets',
    badge: 'Step 1',
    description: 'Find the missing leg or hypotenuse in standard SSC right triangles',
    color: 'from-blue-600 to-indigo-600',
    lightBg: 'bg-blue-50 text-blue-700 border-blue-200',
    accentColor: 'blue',
  },
  {
    id: 'tables',
    title: 'Tables (12 to 24)',
    shortTitle: 'Tables 12–24',
    badge: 'Step 2',
    description: 'High-speed multiplication recall for tables 12 through 24',
    color: 'from-emerald-600 to-teal-600',
    lightBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentColor: 'emerald',
  },
  {
    id: 'squares',
    title: 'Squares (17 to 39)',
    shortTitle: 'Squares 17–39',
    badge: 'Step 3',
    description: 'Instant square calculation from 17² to 39²',
    color: 'from-amber-500 to-orange-600',
    lightBg: 'bg-amber-50 text-amber-700 border-amber-200',
    accentColor: 'amber',
  },
  {
    id: 'cubes',
    title: 'Cubes (11 to 25)',
    shortTitle: 'Cubes 11–25',
    badge: 'Step 4',
    description: 'Instant cube calculation from 11³ to 25³',
    color: 'from-purple-600 to-violet-600',
    lightBg: 'bg-purple-50 text-purple-700 border-purple-200',
    accentColor: 'purple',
  },
  {
    id: 'powers',
    title: 'Powers (2–4 to ^6 & 5–9 to ^4)',
    shortTitle: 'Powers',
    badge: 'Step 5',
    description: 'Powers of 2, 3, 4 up to 6th power & 5, 6, 7, 8, 9 up to 4th power',
    color: 'from-rose-500 to-pink-600',
    lightBg: 'bg-rose-50 text-rose-700 border-rose-200',
    accentColor: 'rose',
  },
  {
    id: 'factorials',
    title: 'Factorials (1! to 8!)',
    shortTitle: 'Factorials 1–8',
    badge: 'Step 6',
    description: 'Quick factorial recall from 1! to 8!',
    color: 'from-cyan-600 to-blue-600',
    lightBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    accentColor: 'cyan',
  },
] as const;

export type SectionId = (typeof CALC_SECTIONS)[number]['id'];

// Generators for each section
export function generateQuestionForSection(section: SectionId): CalculationQuestion {
  switch (section) {
    case 'triplets': {
      const item = TRIPLETS_DATA[Math.floor(Math.random() * TRIPLETS_DATA.length)];
      // Choose missing side: 50% hypotenuse (c), 25% leg a, 25% leg b
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
        subPrompt = 'Find the missing Leg (a)';
        answer = item.a;
      } else {
        prompt = `[ ${item.a} , ? , ${item.c} ]`;
        subPrompt = 'Find the missing Leg (b)';
        answer = item.b;
      }

      return {
        id: `triplet-${Date.now()}-${Math.random()}`,
        section: 'triplets',
        sectionTitle: 'Pythagorean Triplets',
        prompt,
        subPrompt,
        answer,
        explanation: `${item.a}² + ${item.b}² = ${item.a * item.a} + ${item.b * item.b} = ${item.c * item.c} = ${item.c}² ${
          item.base ? `(${item.base})` : ''
        }`,
        metadata: { item, missing },
      };
    }

    case 'tables': {
      // Pick table from 12 to 24
      const table = Math.floor(Math.random() * (TABLES_CONFIG.maxTable - TABLES_CONFIG.minTable + 1)) + TABLES_CONFIG.minTable;
      const multiplier = TABLES_CONFIG.multipliers[Math.floor(Math.random() * TABLES_CONFIG.multipliers.length)];
      return {
        id: `table-${Date.now()}-${Math.random()}`,
        section: 'tables',
        sectionTitle: 'Tables 12–24',
        prompt: `${table} × ${multiplier}`,
        subPrompt: `Calculate product`,
        answer: table * multiplier,
        explanation: `${table} × ${multiplier} = ${table * multiplier}`,
      };
    }

    case 'squares': {
      const item = SQUARES_17_39[Math.floor(Math.random() * SQUARES_17_39.length)];
      // 80% direct square, 20% square root
      const isRoot = Math.random() < 0.2;
      if (isRoot) {
        return {
          id: `square-${Date.now()}-${Math.random()}`,
          section: 'squares',
          sectionTitle: 'Squares 17–39',
          prompt: `√${item.val}`,
          subPrompt: `Square root of ${item.val}`,
          answer: item.n,
          explanation: `√${item.val} = ${item.n} (since ${item.n}² = ${item.val})`,
        };
      }
      return {
        id: `square-${Date.now()}-${Math.random()}`,
        section: 'squares',
        sectionTitle: 'Squares 17–39',
        prompt: `${item.n}²`,
        subPrompt: `Square of ${item.n}`,
        answer: item.val,
        explanation: `${item.n}² = ${item.val}`,
      };
    }

    case 'cubes': {
      const item = CUBES_11_25[Math.floor(Math.random() * CUBES_11_25.length)];
      // 80% direct cube, 20% cube root
      const isRoot = Math.random() < 0.2;
      if (isRoot) {
        return {
          id: `cube-${Date.now()}-${Math.random()}`,
          section: 'cubes',
          sectionTitle: 'Cubes 11–25',
          prompt: `∛${item.val}`,
          subPrompt: `Cube root of ${item.val}`,
          answer: item.n,
          explanation: `∛${item.val} = ${item.n} (since ${item.n}³ = ${item.val})`,
        };
      }
      return {
        id: `cube-${Date.now()}-${Math.random()}`,
        section: 'cubes',
        sectionTitle: 'Cubes 11–25',
        prompt: `${item.n}³`,
        subPrompt: `Cube of ${item.n}`,
        answer: item.val,
        explanation: `${item.n}³ = ${item.val}`,
      };
    }

    case 'powers': {
      const item = POWERS_DATA[Math.floor(Math.random() * POWERS_DATA.length)];
      return {
        id: `power-${Date.now()}-${Math.random()}`,
        section: 'powers',
        sectionTitle: 'Powers (2–9)',
        prompt: `${item.base}^${item.exp}`,
        subPrompt: `${item.base} raised to power ${item.exp}`,
        answer: item.val,
        explanation: `${item.base}^${item.exp} = ${item.val}`,
      };
    }

    case 'factorials': {
      const item = FACTORIALS_DATA[Math.floor(Math.random() * FACTORIALS_DATA.length)];
      return {
        id: `factorial-${Date.now()}-${Math.random()}`,
        section: 'factorials',
        sectionTitle: 'Factorials 1–8',
        prompt: `${item.n}!`,
        subPrompt: `Factorial of ${item.n}`,
        answer: item.val,
        explanation: `${item.n}! = ${item.breakdown} = ${item.val}`,
      };
    }
  }
}
