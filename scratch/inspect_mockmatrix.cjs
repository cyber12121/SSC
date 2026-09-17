const fs = require('fs');
const file = 'src/data/mock_questions/mock_1789652448592_r1bzp.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log('Total questions in mock:', data.length);
data.forEach((q, i) => {
  const qText = q.questionText || q.question || '';
  const sol = q.solution?.text || q.solution || '';
  console.log(`\n--- Q${i+1} [${q.topic || 'No topic'}] ---`);
  console.log('Q:', qText);
  console.log('Options:', q.options);
  console.log('Solution:\n', sol);
});
