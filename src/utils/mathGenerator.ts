export type OperationType = 'add' | 'sub' | 'mul' | 'div' | 'mixed';

export interface MathProblem {
  id: string;
  num1: number;
  num2: number;
  operator: '+' | '-' | '×' | '÷';
  answer: number;
  expression: string;
  category: '2/3-digit' | '1-digit' | 'vedic';
  hint?: string;
}

const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateAddition = (): MathProblem => {
  const isMultiDigit = Math.random() < 0.8; // 80% weight on 2-digit & 3-digit
  let num1: number;
  let num2: number;
  let category: '2/3-digit' | '1-digit' = '2/3-digit';

  if (isMultiDigit) {
    const subtype = Math.random();
    if (subtype < 0.45) {
      // 2-digit + 2-digit (e.g. 38 + 79)
      num1 = getRandomInt(15, 99);
      num2 = getRandomInt(15, 99);
    } else if (subtype < 0.80) {
      // 3-digit + 2-digit (e.g. 347 + 68)
      num1 = getRandomInt(105, 899);
      num2 = getRandomInt(18, 98);
    } else {
      // 3-digit + 3-digit (e.g. 235 + 478)
      num1 = getRandomInt(105, 599);
      num2 = getRandomInt(105, 499);
    }
  } else {
    // 20% single/smaller digit pairs
    category = '1-digit';
    num1 = getRandomInt(6, 15);
    num2 = getRandomInt(4, 9);
  }

  const answer = num1 + num2;
  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2,
    operator: '+',
    answer,
    expression: `${num1} + ${num2}`,
    category,
  };
};

export const generateSubtraction = (): MathProblem => {
  const isMultiDigit = Math.random() < 0.8; // 80% weight on 2-digit & 3-digit
  let num1: number;
  let num2: number;
  let category: '2/3-digit' | '1-digit' = '2/3-digit';

  if (isMultiDigit) {
    const subtype = Math.random();
    if (subtype < 0.45) {
      // 2-digit - 2-digit
      num1 = getRandomInt(30, 99);
      num2 = getRandomInt(12, num1 - 1);
    } else if (subtype < 0.80) {
      // 3-digit - 2-digit
      num1 = getRandomInt(110, 899);
      num2 = getRandomInt(15, 98);
    } else {
      // 3-digit - 3-digit
      num1 = getRandomInt(350, 999);
      num2 = getRandomInt(110, num1 - 10);
    }
  } else {
    // 20% single / simple
    category = '1-digit';
    num1 = getRandomInt(11, 25);
    num2 = getRandomInt(4, 9);
  }

  const answer = num1 - num2;
  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2,
    operator: '-',
    answer,
    expression: `${num1} - ${num2}`,
    category,
  };
};

export const generateMultiplication = (): MathProblem => {
  const isMultiDigit = Math.random() < 0.8; // 80% focus on 2/3-digit
  let num1: number;
  let num2: number;
  let category: '2/3-digit' | '1-digit' | 'vedic' = '2/3-digit';
  let hint: string | undefined = undefined;

  if (isMultiDigit) {
    const subtype = Math.random();
    if (subtype < 0.40) {
      // 2-digit x 1-digit (e.g. 74 x 7)
      num1 = getRandomInt(23, 98);
      num2 = getRandomInt(4, 9);
    } else if (subtype < 0.70) {
      // 2-digit x 2-digit (e.g. 34 x 18 or 46 x 23)
      num1 = getRandomInt(14, 65);
      num2 = getRandomInt(12, 35);
    } else if (subtype < 0.85) {
      // 3-digit x 1-digit (e.g. 145 x 6)
      num1 = getRandomInt(110, 450);
      num2 = getRandomInt(3, 9);
    } else {
      // Vedic multiplication shortcuts (x11, x25, x50, x15)
      category = 'vedic';
      const vedicMultiplier = [11, 25, 50, 15, 12][getRandomInt(0, 4)];
      num1 = getRandomInt(16, 96);
      num2 = vedicMultiplier;
      hint = `Speed trick: × ${vedicMultiplier}`;
    }
  } else {
    // 20% base tables (e.g. 7x8, 8x9, 12x6)
    category = '1-digit';
    num1 = getRandomInt(6, 12);
    num2 = getRandomInt(6, 9);
  }

  const answer = num1 * num2;
  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2,
    operator: '×',
    answer,
    expression: `${num1} × ${num2}`,
    category,
    hint,
  };
};

export const generateDivision = (): MathProblem => {
  const isMultiDigit = Math.random() < 0.8; // 80% focus on 2/3-digit
  let quotient: number;
  let divisor: number;
  let category: '2/3-digit' | '1-digit' = '2/3-digit';

  if (isMultiDigit) {
    const subtype = Math.random();
    if (subtype < 0.50) {
      // 3-digit / 1-digit (e.g. 546 / 7)
      divisor = getRandomInt(4, 9);
      quotient = getRandomInt(23, 115);
    } else {
      // 3-digit / 2-digit (e.g. 528 / 16)
      divisor = getRandomInt(12, 28);
      quotient = getRandomInt(12, 45);
    }
  } else {
    // 20% simple division
    category = '1-digit';
    divisor = getRandomInt(4, 9);
    quotient = getRandomInt(6, 12);
  }

  const dividend = divisor * quotient;
  return {
    id: Math.random().toString(36).substring(2, 9),
    num1: dividend,
    num2: divisor,
    operator: '÷',
    answer: quotient,
    expression: `${dividend} ÷ ${divisor}`,
    category,
  };
};

export const generateMathProblem = (op: OperationType): MathProblem => {
  if (op === 'add') return generateAddition();
  if (op === 'sub') return generateSubtraction();
  if (op === 'mul') return generateMultiplication();
  if (op === 'div') return generateDivision();

  // Mixed: pick random operation
  const ops: OperationType[] = ['add', 'sub', 'mul', 'div'];
  const chosen = ops[getRandomInt(0, ops.length - 1)];
  return generateMathProblem(chosen);
};
