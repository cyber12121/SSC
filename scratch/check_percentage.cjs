const fs = require('fs');

const mathFile = 'src/data/mock_errors/mathematics.json';
const mathData = JSON.parse(fs.readFileSync(mathFile, 'utf8'));

console.log('--- MATH ERRORS FILE ---');
mathData.forEach((ch, cIdx) => {
  (ch.questions || []).forEach((q, qIdx) => {
    const text = q.question || q.questionText || '';
    if (text.includes('consumption of sugar') || text.includes('increased by 20%')) {
      console.log('Chapter:', ch.chapter_title, 'cIdx:', cIdx, 'qIdx:', qIdx, 'id:', q.id);
      console.log('Q:', text);
      console.log('Options:', q.options);
      console.log('Solution preview:', (q.solution?.text || q.solution || '').slice(0, 150));
      console.log('------------------------------------');
    }
  });
});
