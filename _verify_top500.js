const fs = require('fs');
const path = require('path');
const base = 'src/data';
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}
const allFiles = walk(base).map(p => './' + p.split(path.sep).join('/'));
const rawBankData = {};
allFiles.forEach(pathKey => {
  const data = JSON.parse(fs.readFileSync(pathKey.replace(/^\.\//, ''), 'utf8'));
  const isBank = pathKey.includes('/chapter_bank/');
  const chapters = Array.isArray(data) ? data : (data.questions ? [data] : []);
  let section, topic_name, set_name;
  if (isBank) {
    if (pathKey.includes('/mathematics/spartan/')) section = 'spartan';
    else if (pathKey.includes('/mathematics/pinnacle/')) section = 'pinnacle';
    else if (pathKey.includes('/mathematics/qrb/')) section = 'qrb';
    else if (pathKey.includes('/mathematics/top500/')) section = 'top500';
    if (section) {
      const parts = pathKey.split('/' + section + '/');
      if (parts.length > 1) {
        const subParts = parts[1].split('/');
        if (subParts.length >= 2) { topic_name = subParts[0]; set_name = subParts[1].replace('.json', ''); }
      }
    }
  }
  chapters.forEach(ch => {
    if (section) ch.section = section;
    if (topic_name) ch.topic_name = topic_name;
    if (set_name) ch.set_name = set_name;
    if (!rawBankData[ch.subject]) rawBankData[ch.subject] = [];
    rawBankData[ch.subject].push(ch);
  });
});
function processData(data) {
  const filtered = {};
  Object.entries(data).forEach(([subject, chapters]) => {
    const merged = {};
    chapters.forEach(chapter => {
      const lower = chapter.chapter_title.trim().toLowerCase();
      const key = lower + '|' + (chapter.section || '') + '|' + (chapter.set_name || '');
      if (!merged[key]) { merged[key] = { ...chapter, questions: [] }; }
      chapter.questions.forEach(q => {
        const qc = q.question.trim().toLowerCase();
        if (!merged[key].questions.some(e => e.question.trim().toLowerCase() === qc)) merged[key].questions.push(q);
      });
    });
    filtered[subject] = Object.values(merged).filter(ch => ch.questions.length > 0);
  });
  return filtered;
}
const bankData = processData(rawBankData);
const top500 = bankData['Mathematics'].filter(ch => ch.section === 'top500');
console.log('total top500 chapter objects:', top500.length);
const topics = Array.from(new Set(top500.map(ch => ch.topic_name).filter(Boolean)));
console.log('unique topics:', topics.length);
topics.sort();
topics.forEach(t => console.log(' -', t));
