const fs = require('fs');

const mathFile = 'src/data/mock_errors/mathematics.json';
const mathData = JSON.parse(fs.readFileSync(mathFile, 'utf8'));

mathData.forEach((ch, cIdx) => {
  (ch.questions || []).forEach((q, qIdx) => {
    const s = JSON.stringify(q);
    if (/\\+over\b/.test(s)) {
      console.log('Chapter:', ch.chapter_title, 'qIdx:', qIdx, 'id:', q.id);
      const matches = s.match(/.{0,20}\\+over.{0,20}/g);
      console.log('  matches:', matches);
    }
  });
});
