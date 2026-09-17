const katex = require('katex');

// Let's test the current pipeline
const str1 = '30\\\\(10\\\\over13\\\\) %';
const str2 = '\\\\(21\\\\over 22\\\\)';
const str3 = 'Number \\"A\\" is increased by 20%, then decreased by 30%, and is finally increased by 50%.';

console.log('--- Current Raw Strings ---');
console.log('str1:', str1);
console.log('str2:', str2);
console.log('str3:', str3);

// Let's see what tokenizeTextWithMath does to str1:
// In formatQuestionText.ts:
// let text = rawText
//   .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `$$${eq}$$`)
//   .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq}$`);
// Notice that in str1, rawText is '30\\(10\\over13\\) %'.
// If rawText has double backslash `\\(`, the regex `\\\(([\s\S]*?)\\\)` matches `\(` with a preceding backslash!
// Wait! Let's check regex: /\\\(([\s\S]*?)\\\)/
// In JS, /\\\( ... \\\)/ matches literal '\(' and '\)'.
// If string is '30\\(10\\over13\\) %', the characters are:
// '3', '0', '\', '\', '(', '1', '0', '\', '\', 'o', 'v', 'e', 'r', '1', '3', '\', '\', ')', ' ', '%'
// The first '\' is matched, but the second '\' is NOT matched, or it matches '\(' and leaves the leading '\' !
