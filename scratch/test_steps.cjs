const fs = require('fs');

// Load formatQuestionText and mathSanitizer (compiled via ts-node or transpiled)
// Let's inspect directly how the current code in formatQuestionText.ts handles it
const data = JSON.parse(fs.readFileSync('src/data/mock_questions/mock_1789628610492_0h079.json', 'utf8'));

const optA_10 = data[10].options.A; // '\\\\(21\\\\over 22\\\\)'
const optA_14 = data[14].options.A; // '30\\\\(10\\\\over13\\\\) %'

console.log('optA_10:', JSON.stringify(optA_10));
console.log('optA_14:', JSON.stringify(optA_14));

function step1(rawText) {
  let text = rawText
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `$$${eq}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq}$`);
  return text;
}

console.log('After step1 optA_10:', JSON.stringify(step1(optA_10)));
console.log('After step1 optA_14:', JSON.stringify(step1(optA_14)));
