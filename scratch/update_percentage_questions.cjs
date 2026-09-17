const fs = require('fs');

const q7_options_mock = {
  A: '$\\frac{21}{22}$',
  B: '$\\frac{16}{13}$',
  C: '$\\frac{13}{16}$',
  D: '$\\frac{22}{21}$',
  a: '$\\frac{21}{22}$',
  b: '$\\frac{16}{13}$',
  c: '$\\frac{13}{16}$',
  d: '$\\frac{22}{21}$'
};

const q7_options_math = {
  a: '$\\frac{21}{22}$',
  b: '$\\frac{16}{13}$',
  c: '$\\frac{13}{16}$',
  d: '$\\frac{22}{21}$'
};

const q8_options_mock = {
  A: '$30\\frac{10}{13}\\%$',
  B: '$32\\frac{10}{13}\\%$',
  C: '$20\\frac{10}{13}\\%$',
  D: '$25\\frac{10}{13}\\%$',
  a: '$30\\frac{10}{13}\\%$',
  b: '$32\\frac{10}{13}\\%$',
  c: '$20\\frac{10}{13}\\%$',
  d: '$25\\frac{10}{13}\\%$',
};

const q8_options_math = {
  a: '$30\\frac{10}{13}\\%$',
  b: '$32\\frac{10}{13}\\%$',
  c: '$20\\frac{10}{13}\\%$',
  d: '$25\\frac{10}{13}\\%$',
};

const q7_clean_text = 'Number "A" is increased by 20%, then decreased by 30%, and is finally increased by 50%. Now, the number "A" is decreased by 20%, then increased by 50%, and finally increased by 10%. Find the ratio of the second result to the first result for the number A.';

const q8_clean_text = 'A man increases his consumption of sugar by 44.44% because the price of sugar is reduced by P%. Find P. (Expenditure remains constant.)';

const q7_clean_solution = `Solution

Shortcut Trick
Let the initial number A be 100.
First result = 100 × 1.20 × 0.70 × 1.50 = 126
Second result = 100 × 0.80 × 1.50 × 1.10 = 132
Required ratio = Second result ÷ First result = 132 ÷ 126 = $\\frac{22}{21}$
∴ The correct answer is $\\frac{22}{21}$.

Alternate Method
Given:
Initial number = A
Process 1: Increased by 20%, decreased by 30%, increased by 50%
Process 2: Decreased by 20%, increased by 50%, increased by 10%

Calculations:
⇒ First Result = A × (1 + 20/100) × (1 - 30/100) × (1 + 50/100)
⇒ First Result = A × 1.20 × 0.70 × 1.50 = 1.26A
⇒ Second Result = A × (1 - 20/100) × (1 + 50/100) × (1 + 10/100)
⇒ Second Result = A × 0.80 × 1.50 × 1.10 = 1.32A
⇒ Required Ratio = Second Result ÷ First Result
⇒ Required Ratio = 1.32A ÷ 1.26A
⇒ Required Ratio = 132 ÷ 126 = $\\frac{22}{21}$
∴ The correct answer is $\\frac{22}{21}$.

Additional Information
Successive Percentage Change
When a value undergoes two successive percentage changes of x% and y%, the net equivalent percentage change is given by the formula: $(x + y + \\frac{xy}{100})\\%$.

Multiplying Factor Method
To calculate an increase of x%, multiply the base by $(1 + \\frac{x}{100})$. For a decrease of y%, multiply by $(1 - \\frac{y}{100})$. Successive changes can be efficiently calculated by continuously multiplying these factors together.

Base Value Update
In successive percentage problems, each percentage change is calculated on the most recently updated base value, not the initial starting value.`;

const q8_clean_solution = `Solution

Shortcut Trick
Fraction value of 44.44% = $\\frac{4}{9}$.

If consumption increases by $\\frac{a}{b}$, price must decrease by $\\frac{a}{a + b}$ to keep expenditure constant.

Here, a = 4, b = 9, so decrease in price = $\\frac{4}{4 + 9} = \\frac{4}{13}$.
Percentage decrease (P) = $(\\frac{4}{13}) \\times 100\\% = \\frac{400}{13}\\% = 30\\frac{10}{13}\\%$.
∴ The correct answer is $30\\frac{10}{13}\\%$.

Alternate Method
Given:
Increase in consumption = 44.44%
Expenditure remains constant.

Formula Used:
Expenditure = Price × Consumption

Calculations:
⇒ 44.44% = 4 × 11.11% = $\\frac{4}{9}$
⇒ Let the initial consumption be 9 units.
⇒ Final consumption = 9 + 4 = 13 units.
⇒ Since Expenditure is constant, Price is inversely proportional to Consumption.
⇒ Ratio of initial to final consumption = 9 : 13
⇒ Ratio of initial to final price = 13 : 9
⇒ Reduction in price = 13 - 9 = 4 ratio units.
⇒ Percentage reduction (P) = $(\\frac{4}{13}) \\times 100\\% = \\frac{400}{13}\\%$
⇒ P = $30\\frac{10}{13}\\%$
∴ The correct answer is $30\\frac{10}{13}\\%$.

Additional Information
Constant Product Rule
If A × B = Constant, an increase in A by $\\frac{x}{y}$ leads to a decrease in B by $\\frac{x}{x + y}$.

Important Percentage Fractions
11.11% = $\\frac{1}{9}$, 22.22% = $\\frac{2}{9}$, 33.33% = $\\frac{1}{3}$, 44.44% = $\\frac{4}{9}$.

Price - Consumption Relation
If the price of a commodity increases by R%, reduction in consumption to keep expenditure constant is $[\\frac{R}{100 + R}] \\times 100\\%$.`;

// 1. Update mock_1789628610492_0h079.json
const mockFile = 'src/data/mock_questions/mock_1789628610492_0h079.json';
const mockData = JSON.parse(fs.readFileSync(mockFile, 'utf8'));

let mockQ7Found = false;
let mockQ8Found = false;

mockData.forEach((q, idx) => {
  const text = q.questionText || '';
  if (text.includes('increased by 20%') && text.includes('Process 1')) {
    // This is Q7
    q.questionText = q7_clean_text;
    q.options = q7_options_mock;
    q.solution = q7_clean_solution;
    mockQ7Found = true;
    console.log(`Updated Q7 in mock file at index ${idx}`);
  } else if (text.includes('increased by 20%') && (text.includes('number \\"A\\"') || text.includes('number "A"'))) {
    q.questionText = q7_clean_text;
    q.options = q7_options_mock;
    q.solution = q7_clean_solution;
    mockQ7Found = true;
    console.log(`Updated Q7 in mock file at index ${idx}`);
  }

  if (text.includes('consumption of sugar by 44.44%')) {
    q.questionText = q8_clean_text;
    q.options = q8_options_mock;
    q.solution = q8_clean_solution;
    mockQ8Found = true;
    console.log(`Updated Q8 in mock file at index ${idx}`);
  }
});

fs.writeFileSync(mockFile, JSON.stringify(mockData, null, 2), 'utf8');
console.log('Saved mock file:', { mockQ7Found, mockQ8Found });

// 2. Update mathematics.json
const mathFile = 'src/data/mock_errors/mathematics.json';
const mathData = JSON.parse(fs.readFileSync(mathFile, 'utf8'));

let mathQ7Found = false;
let mathQ8Found = false;

mathData.forEach((ch) => {
  (ch.questions || []).forEach((q) => {
    if (q.id === 'math_bf90242f35' || ((q.question || '').includes('increased by 20%') && (q.question || '').includes('"A"'))) {
      q.question = q7_clean_text;
      q.questionText = q7_clean_text;
      q.options = q7_options_math;
      q.solution = q7_clean_solution;
      mathQ7Found = true;
      console.log(`Updated Q7 in mathematics.json (${q.id})`);
    }

    if (q.id === 'math_9f2da87d9a' || (q.question || '').includes('consumption of sugar by 44.44%')) {
      q.question = q8_clean_text;
      q.questionText = q8_clean_text;
      q.options = q8_options_math;
      q.solution = q8_clean_solution;
      mathQ8Found = true;
      console.log(`Updated Q8 in mathematics.json (${q.id})`);
    }
  });
});

fs.writeFileSync(mathFile, JSON.stringify(mathData, null, 2), 'utf8');
console.log('Saved mathematics file:', { mathQ7Found, mathQ8Found });
