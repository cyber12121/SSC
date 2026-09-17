const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      search(full);
    } else if (f.endsWith('.json')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('consumption of sugar by 44.44%')) {
        console.log('Found question in file:', full);
      }
    }
  }
}

search('src');
