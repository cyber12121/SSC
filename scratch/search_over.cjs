const fs = require('fs');
const path = require('path');

const dir = 'src/data/mock_questions';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let foundFiles = new Set();
for (const f of files) {
  const p = path.join(dir, f);
  const str = fs.readFileSync(p, 'utf8');
  if (/\\+over\b/.test(str)) {
    const data = JSON.parse(str);
    const list = Array.isArray(data) ? data : (data.questions || []);
    list.forEach((q, i) => {
      const qs = JSON.stringify(q);
      if (/\\+over\b/.test(qs)) {
        console.log(f, 'Q index:', i);
        const matches = qs.match(/.{0,20}\\+over.{0,20}/g);
        console.log('  matches:', matches);
        foundFiles.add(f);
      }
    });
  }
}
console.log('Total files with \\over:', foundFiles.size);
