// src/telegram/mistakeStore.ts
import fs2 from "fs";
import path2 from "path";
import os from "os";

// src/telegram/quizData.ts
import fs from "fs";
import path from "path";

// src/utils/mathSanitizer.ts
function normalizeUnicodeMath(text = "") {
  if (!text) return "";
  const supMap = [
    ["\u2070", "\uE000"],
    ["\xB9", "\uE001"],
    ["\xB2", "\uE002"],
    ["\xB3", "\uE003"],
    ["\u2074", "\uE004"],
    ["\u2075", "\uE005"],
    ["\u2076", "\uE006"],
    ["\u2077", "\uE007"],
    ["\u2078", "\uE008"],
    ["\u2079", "\uE009"],
    ["\u207F", "\uE00A"],
    ["\u2071", "\uE00B"],
    ["\u2080", "\uE010"],
    ["\u2081", "\uE011"],
    ["\u2082", "\uE012"],
    ["\u2083", "\uE013"],
    ["\u2084", "\uE014"],
    ["\u2085", "\uE015"],
    ["\u2086", "\uE016"],
    ["\u2087", "\uE017"],
    ["\u2088", "\uE018"],
    ["\u2089", "\uE019"]
  ];
  let s = text;
  for (const [sup, ph] of supMap) s = s.split(sup).join(ph);
  s = s.normalize("NFKD");
  for (const [sup, ph] of supMap) s = s.split(ph).join(sup);
  const specialMap = {
    "\u{1D73D}": "\u03B8",
    "\u{1D6C9}": "\u03B8",
    "\u{1D703}": "\u03B8",
    "\u{1D767}": "\u03B8",
    "\u{1D7A1}": "\u03B8",
    "\u{1D745}": "\u03C0",
    "\u{1D70B}": "\u03C0",
    "\u{1D77F}": "\u03C0",
    "\u{1D7B9}": "\u03C0",
    "\u2212": "-",
    // U+2212 minus sign to ASCII hyphen-minus
    "\u2013": "-",
    // en-dash to hyphen
    "\u2014": "-"
    // em-dash to hyphen
  };
  s = s.replace(/[\u{1D400}-\u{1D7FF}−–—]/gu, (ch) => specialMap[ch] || ch);
  s = s.replace(/[\x0c\u000c]+(?:f?rac)\b/g, "\\frac");
  s = s.replace(/\\f\s*frac\b/g, "\\frac");
  s = s.replace(/\\f\s*rac\b/g, "\\frac");
  s = s.replace(/[\x0c\u000c]+/g, " ");
  return s;
}
function extractBalanced(str, startIndex) {
  if (str[startIndex] !== "{") return null;
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === "{") {
      depth++;
    } else if (str[i] === "}") {
      depth--;
      if (depth === 0) {
        return { content: str.slice(startIndex + 1, i), endIndex: i };
      }
    }
  }
  return null;
}
function parseFraction(str, startIndex) {
  const fracPrefix = str.slice(startIndex);
  const match = /^\\frac\s*/.exec(fracPrefix);
  if (!match) return null;
  const numStart = startIndex + match[0].length;
  const numBalanced = extractBalanced(str, numStart);
  if (!numBalanced) return null;
  let denStart = numBalanced.endIndex + 1;
  while (denStart < str.length && /\s/.test(str[denStart])) {
    denStart++;
  }
  const denBalanced = extractBalanced(str, denStart);
  if (!denBalanced) return null;
  const fullMatch = str.slice(startIndex, denBalanced.endIndex + 1);
  return {
    fullMatch,
    num: numBalanced.content,
    den: denBalanced.content,
    endIndex: denBalanced.endIndex
  };
}
function wrapUnwrappedFractions(rawText = "") {
  if (!rawText) return "";
  let s = rawText;
  if (/\\*over/i.test(s)) {
    s = s.replace(/(\b\d+)\s*\\+\(\s*(\d+)\s*\\+over(?![a-zA-Z])\s*(\d+)\s*\\+\)\s*(%?)/g, (_, w, n, d, pct) => {
      return `$${w}\\frac{${n}}{${d}}${pct ? "\\%" : ""}$`;
    });
    s = s.replace(/\\+\(\s*([0-9a-zA-Z]+)\s*\\+over(?![a-zA-Z])\s*([0-9a-zA-Z]+)\s*\\+\)/g, (_, n, d) => {
      return `$\\frac{${n}}{${d}}$`;
    });
    s = s.replace(/(\b\d+)\s+(\d+)\s*\\+over(?![a-zA-Z])\s*(\d+)\s*(%?)/g, (_, w, n, d, pct) => {
      return `$${w}\\frac{${n}}{${d}}${pct ? "\\%" : ""}$`;
    });
    s = s.replace(/\{([^{}]+?)\s*\\+over(?![a-zA-Z])\s*([^{}]+?)\}/g, "\\frac{$1}{$2}");
    s = s.replace(/(?<![0-9a-zA-Z])([0-9a-zA-Z]+)\s*\\+over(?![a-zA-Z])\s*([0-9a-zA-Z]+)/g, "\\frac{$1}{$2}");
  }
  if (!s.includes("\\frac")) return s;
  const mathPlaceholders = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `___MATH_BLOCK_${mathPlaceholders.length}___`;
    mathPlaceholders.push(m);
    return placeholder;
  });
  let result = "";
  let i = 0;
  while (i < s.length) {
    const fracIdx = s.indexOf("\\frac", i);
    if (fracIdx === -1) {
      result += s.slice(i);
      break;
    }
    result += s.slice(i, fracIdx);
    const isSuperscript = /\^\{?$/.test(result);
    const mixedMatch = !isSuperscript ? /(\b\d+)\s*$/.exec(result) : null;
    const parsed = parseFraction(s, fracIdx);
    if (parsed) {
      let endIndex = parsed.endIndex;
      let suffix = "";
      if (s[endIndex + 1] === "%") {
        suffix = "\\%";
        endIndex++;
      }
      if (isSuperscript) {
        result += `${parsed.fullMatch}${suffix}`;
      } else if (mixedMatch) {
        result = result.slice(0, result.length - mixedMatch[0].length);
        result += `$${mixedMatch[1]} ${parsed.fullMatch}${suffix}$`;
      } else {
        result += `$${parsed.fullMatch}${suffix}$`;
      }
      i = endIndex + 1;
    } else {
      result += "\\frac";
      i = fracIdx + 5;
    }
  }
  mathPlaceholders.forEach((math, idx) => {
    result = result.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });
  return result;
}
function reconstructScrapedMath(rawText = "") {
  if (!rawText) return "";
  let s = normalizeUnicodeMath(rawText);
  const mathPlaceholders = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `___MATH_BLOCK_${mathPlaceholders.length}___`;
    mathPlaceholders.push(m);
    return placeholder;
  });
  s = s.replace(/R\s*\n+\s*s\s*\n+\s*\.\s*\n*/gi, "Rs. ");
  s = s.replace(/R\s*\n+\s*s\s*\n*/gi, "Rs. ");
  s = s.replace(/(Rs\.?|₹)\s*(\d+)\s*\n+\s*,\s*\n+\s*(\d+)\s*\n+\s*,\s*\n+\s*(\d+)/gi, "$1 $2,$3,$4");
  s = s.replace(/(Rs\.?|₹)\s*(\d+)\s*\n+\s*,\s*\n+\s*(\d+)/gi, "$1 $2,$3");
  s = s.replace(/(Rs\.?|₹)\s*\n+\s*(\d+)/gi, "$1 $2");
  s = s.replace(/(\b\d{1,3})\s*\n+\s*,\s*\n+\s*(\d{2,3})\s*\n+\s*,\s*\n+\s*(\d{3}\b)/g, "$1,$2,$3");
  s = s.replace(/(\b\d{1,3})\s*\n+\s*,\s*\n+\s*(\d{2,3}\b)/g, "$1,$2");
  s = s.replace(/c\s*\n+\s*o\s*\n+\s*s\s*\n+\s*(θ|[a-zA-Z])/gi, "cos $1");
  s = s.replace(/s\s*\n+\s*i\s*\n+\s*n\s*\n+\s*(θ|[a-zA-Z])/gi, "sin $1");
  s = s.replace(/t\s*\n+\s*a\s*\n+\s*n\s*\n+\s*(θ|[a-zA-Z])/gi, "tan $1");
  s = s.replace(/c\s*\n+\s*o\s*\n+\s*t\s*\n+\s*(θ|[a-zA-Z])/gi, "cot $1");
  s = s.replace(/co\s*\n+\s*t\s*\n+\s*2\s*\n+\s*(θ|[a-zA-Z])/gi, "cot\xB2 $1");
  s = s.replace(/si\s*\n+\s*n\s*\n+\s*2\s*\n+\s*(θ|[a-zA-Z])/gi, "sin\xB2 $1");
  s = s.replace(/co\s*\n+\s*s\s*\n+\s*2\s*\n+\s*(θ|[a-zA-Z])/gi, "cos\xB2 $1");
  s = s.replace(/\bC\s*\n+\s*I\b/g, "CI");
  s = s.replace(/\bS\s*\n+\s*I\b/g, "SI");
  s = s.replace(/(\b\d+)\s*\n+\s*(\d+)\s*\n+\s*(\d+)\s*\n+\s*%/g, "$1 $2/$3%");
  s = s.replace(/(\b\d+)\s*\n+\s*(\d+)\s*\n+\s*%/g, "$1/$2%");
  s = s.replace(/(\d+(?:\.\d+)?)\s*\n+\s*(\d+(?:\.\d+)?)\s*\n+\s*=\s*\n+\s*(\d+(?:\.\d+)?)/g, "$1 / $2 = $3");
  s = s.replace(/(\d+(?:\.\d+)?)\s*\n+\s*(\d+(?:\.\d+)?)\s*\n+\s*([×÷\+\-\*=])\s*\n+\s*(\d+(?:\.\d+)?)\s*\n+\s*(\d+(?:\.\d+)?)/g, "$1 / $2 $3 $4 / $5");
  s = s.replace(/(\d+(?:\.\d+)?)\s*\n+\s*(\d+(?:\.\d+)?)\s*\n+\s*([×÷\+\-\*=])\s*\n+\s*(\d+(?:\.\d+)?)/g, "$1 / $2 $3 $4");
  const powerMap = {
    "2": "\xB2",
    "3": "\xB3",
    "4": "\u2074",
    "5": "\u2075",
    "n": "^n",
    "t": "^t"
  };
  s = s.replace(/\(\s*\n+\s*(\d+)\s*\n+\s*(\d+)\s*\n+\s*\)\s*\n+\s*([2345nt])/g, (_, n1, n2, p) => `(${n1} / ${n2})${powerMap[p] || `^${p}`}`);
  s = s.replace(/\(\s*\n+\s*([^\n\(\)]+?)\s*\n+\s*\)\s*\n+\s*([2345nt])/g, (_, inner, p) => `(${inner})${powerMap[p] || `^${p}`}`);
  s = s.replace(/\(\s*([^\(\)]+?)\s*\)\s*\n+\s*([2345nt])/g, (_, inner, p) => `(${inner})${powerMap[p] || `^${p}`}`);
  s = s.replace(/\b(cm|mm|km|sq\.?|cu\.?)\s*\n+\s*([23])\b/gi, (_, u, p) => `${u}${powerMap[p] || `^${p}`}`);
  s = s.replace(/\b(m)\s*\n+\s*([23])\b/g, (_, u, p) => `${u}${powerMap[p] || `^${p}`}`);
  s = s.replace(/\b(cm|mm|km)\s*([23])\b(?!\d)/gi, (_, u, p) => `${u}${powerMap[p] || `^${p}`}`);
  s = s.replace(/\b(m)\s*([23])\b(?!\d)/g, (_, u, p) => `${u}${powerMap[p] || `^${p}`}`);
  s = s.replace(/\(\s*\n+\s*1\s*\n+\s*([+\-])\s*\n+\s*([a-zA-Z])\s*\n+\s*(\d+)\s*\n+\s*\)\s*\n+\s*([a-zA-Z0-9])/g, "(1 $1 $2 / $3)^$4");
  s = s.replace(/(\([0-9\.]+\))\s*([23])(?!\d)/g, (_, base, p) => `${base}${powerMap[p] || `^${p}`}`);
  s = s.replace(/(\([a-zA-Z0-9\s\/+\-]+\))\s*([23])(?!\d)/g, (_, base, p) => `${base}${powerMap[p] || `^${p}`}`);
  s = s.replace(/\b(sin|cos|tan|cot|sec|cosec)\s*2\s*(θ|[a-zA-Z])/gi, "$1\xB2$2");
  s = s.replace(/([a-zA-Z0-9\)]+)\s*\n+\s*=\s*\n+\s*/g, "$1 = ");
  s = s.replace(/\s*\n+\s*=\s*\n+\s*([a-zA-Z0-9\(\$])/g, " = $1");
  s = s.replace(/\b\d{3,4}%\s*(\$\s*\\frac\{[^}]+\}\{[^}]+\}\s*\%?\s*\$)/gi, "$1");
  s = s.replace(/\b(\d+)\d\d\s*(\$\s*\\frac\{1\}\{2\}\s*\$)/gi, "$1 $2");
  s = s.replace(/\\Delta\s*([A-Za-z]+)/g, (_, p) => `\u0394${p}`);
  s = s.replace(/\\Delta\b/g, "\u0394");
  s = s.replace(/\\angle\s*([A-Za-z]+)/g, (_, p) => `\u2220${p}`);
  s = s.replace(/\\angle\b/g, "\u2220");
  s = s.replace(/(\d+(?:\.\d+)?)\s*\^\s*(?:\\circ|\{\s*\\circ\s*\}|\\degree|°)/g, "$1\xB0");
  s = s.replace(/\^\s*(?:\\circ|\{\s*\\circ\s*\}|\\degree)/g, "\xB0");
  s = s.replace(/\\degree\b/g, "\xB0");
  s = s.replace(/\\circ\b/g, "\xB0");
  s = s.replace(/\\cong\b/g, "\u2245");
  s = s.replace(/\\ncong\b/g, "\u2247");
  s = s.replace(/\\sim\b/g, "\u223C");
  s = s.replace(/\\approx\b|\\approxeq\b/g, "\u2248");
  s = s.replace(/\\neq\b|\\ne\b/g, "\u2260");
  s = s.replace(/\\perp\b|\\bot\b/g, "\u22A5");
  s = s.replace(/\\parallel\b/g, "\u2225");
  s = s.replace(/\\le\b(?!ft)/g, "\u2264");
  s = s.replace(/\\ge\b/g, "\u2265");
  s = s.replace(/\\pm\b/g, "\xB1");
  s = s.replace(/\\mp\b/g, "\u2213");
  s = s.replace(/\\times\b/g, "\xD7");
  s = s.replace(/\\div\b/g, "\xF7");
  s = s.replace(/\\cdot\b/g, "\xB7");
  s = s.replace(/\\theta\b/g, "\u03B8");
  s = s.replace(/\\pi\b/g, "\u03C0");
  s = s.replace(/\\alpha\b/g, "\u03B1");
  s = s.replace(/\\beta\b/g, "\u03B2");
  s = s.replace(/\\gamma\b/g, "\u03B3");
  s = cleanAlgebraPowers(s);
  s = normalizeListCommas(s);
  mathPlaceholders.forEach((math, idx) => {
    s = s.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });
  return s;
}
function reconstructScrapedSolutionMath(rawText = "") {
  if (!rawText) return "";
  let s = reconstructScrapedMath(rawText);
  const mathPlaceholders = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `___MATH_BLOCK_${mathPlaceholders.length}___`;
    mathPlaceholders.push(m);
    return placeholder;
  });
  s = s.replace(/\b(\d+)\s*\n\s*(\d+)\s*\n\s*\1\s*\/\s*\2\b/g, "$1 / $2");
  s = s.replace(/([a-zA-Z0-9+\-]+)\s*\n\s*([a-zA-Z0-9+\-]+)\s*\n\s*\1\s*\/\s*\2\b/g, "$1 / $2");
  s = s.replace(/\b([a-zA-Z])\s*\n\s*([a-zA-Z])\s*\n\s*\1\s*\n\s*\2\s*(?=\n|$)/g, "$1 / $2");
  s = s.replace(/\(\s*\n\s*([0-9.]+)\s*\n\s*\)\s*\n\s*(\d+)\s*\n\s*\/\s*\n\s*(\d+)/g, "($1)^($2/$3)");
  s = s.replace(/([0-9a-zA-Z]*\.[0-9a-zA-Z]*)\s*\n+\s*[\u0304\u0305\u00AF̄¯]\s*\n+\s*([a-zA-Z0-9]+)/g, (_, prefix, barPart) => `${prefix}${barPart}\u0304`);
  s = s.replace(/([a-zA-Z0-9\.]+)\s*\n+\s*[\u0304\u0305\u00AF̄¯]\s*\n*/g, (_, b) => `${b}\u0304`);
  s = s.replace(/(\d+\s*\/\s*\d+)\s*\n+\s*(\d+\s*\/\s*\d+)/g, "($1) / ($2)");
  s = s.replace(/(\b\d+)\s*\/\s*(\d+)\s*\n+\s*([1-9]\d*\b)(?!\s*[\/\.])/g, "$1 $2/$3");
  s = s.replace(/(\b\d+)\s*\n+\s*(\d+)\s*\/\s*([1-9]\d*\b)(?!\s*[\/\.])/g, "$1 $2/$3");
  s = s.replace(/(=|is)\s*([a-zA-Z0-9_\-]+)\s*\n+\s*([1-9]\d*)\s*(?=\n|$)/g, (_, eq, num, den) => {
    if (num.includes("-") || num.includes("+")) {
      return `${eq} (${num}) / ${den}`;
    }
    return `${eq} ${num} / ${den}`;
  });
  const rawLines = s.split("\n").map((l) => l.trim()).filter(Boolean);
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i];
    const next = rawLines[i + 1];
    const isNum = (str) => /^(\d{1,4}|[a-zA-Z]{1,4}|[a-zA-Z0-9]+-[a-zA-Z0-9]+|\(\d+\s*\/\s*\d+\))$/.test(str);
    const isDenom = (str) => /^([1-9]\d{0,3}|[a-zA-Z]{1,4}|\(\d+\s*\/\s*\d+\))$/.test(str);
    if (next && isNum(cur) && isDenom(next)) {
      let merged = "";
      if (cur.includes("/") || next.includes("/")) {
        merged = `${cur} / ${next}`;
      } else if (cur.includes("-") || cur.includes("+")) {
        merged = `(${cur}) / ${next}`;
      } else {
        merged = `${cur} / ${next}`;
      }
      lines.push(merged);
      i++;
      continue;
    }
    lines.push(cur);
  }
  const isSectionHeader = (str) => /^(solution|given|formula used|calculations?|numerator|denominator|value|final value|shortcut trick|alternate method|note|case\s*\d+|step\s*\d+):?$/i.test(str);
  const endsWithOperator = (str) => /([+\-×*÷/=~:,]|\bof\b|\(|\-\(|\+\(|\÷\(|×\(|\/)$/i.test(str.trim());
  const startsWithOperator = (str) => /^([+\-×*÷/=:~,]|\bof\b|\)|\)\+|\)-\(|\)-|\)×|\)÷|\)=)/i.test(str.trim());
  const isOperatorOnly = (str) => /^([+\-×*÷/=:~,]|\bof\b|\(|\)|\)-\(|\)\+|\)-|\)×|\)÷|\)=|\(\-|\(\+|\(×|\(÷)$/i.test(str.trim());
  const stitched = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i];
    if (isSectionHeader(cur)) {
      stitched.push(cur);
      continue;
    }
    if (cur === "\u21D2" || cur === "=>") {
      if (i + 1 < lines.length && !isSectionHeader(lines[i + 1])) {
        cur = "\u21D2 " + lines[i + 1];
        i++;
      }
    }
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (isSectionHeader(next)) break;
      if (/^(⇒|=>|∴)/.test(next)) break;
      if (endsWithOperator(cur) || startsWithOperator(next) || isOperatorOnly(cur) || isOperatorOnly(next)) {
        let sep = " ";
        if (cur.endsWith("(") || next.startsWith(")")) {
          sep = "";
        } else if (next.startsWith(",")) {
          sep = "";
        }
        cur = cur + sep + next;
        i++;
      } else {
        break;
      }
    }
    cur = cur.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\)\s*-\s*\(/g, ") - (").replace(/\)\s*\+\s*\(/g, ") + (").replace(/\)\s*([+\-×*÷])\s*/g, ") $1 ").replace(/([0-9a-zA-Z])\s*-\s*([0-9a-zA-Z])/g, "$1 - $2").replace(/([0-9a-zA-Z])\s*\+\s*([0-9a-zA-Z])/g, "$1 + $2").replace(/⇒\s*/g, "\u21D2 ").replace(/\s*=\s*/g, " = ").replace(/\s*÷\s*/g, " \xF7 ").replace(/\s*×\s*/g, " \xD7 ").replace(/,\s*/g, ", ").trim();
    stitched.push(cur);
  }
  s = stitched.join("\n\n");
  s = cleanAlgebraPowers(s);
  mathPlaceholders.forEach((math, idx) => {
    s = s.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });
  return s;
}
function normalizeListCommas(text = "") {
  if (!text) return "";
  let s = text;
  s = s.replace(/([a-zA-Z]),(?!\s)/g, "$1, ");
  s = s.replace(/,(?=[a-zA-Z√\(\[\$])/g, ", ");
  s = s.replace(/(?<!\d,)(\b\d{1,2}),(\d{1,2}\b)(?![,\d])/g, "$1, $2");
  s = s.replace(/(\d),(?=[a-zA-Z])/g, "$1, ");
  return s;
}
function cleanAlgebraPowers(text = "") {
  if (!text) return "";
  let s = text;
  s = s.replace(/\b(cm|m|mm|km|ft|in)3\b/g, "$1\xB3");
  s = s.replace(/\b(cm|m|mm|km|ft|in)2\b/g, "$1\xB2");
  const fractionPowerMap = {
    "1/2": "\xBD",
    "1/3": "\u2153",
    "1/4": "\xBC",
    "2/3": "\u2154",
    "3/4": "\xBE",
    "1/5": "\u2155",
    "2/5": "\u2156",
    "3/5": "\u2157",
    "4/5": "\u2158",
    "1/6": "\u2159",
    "5/6": "\u215A",
    "1/8": "\u215B",
    "3/8": "\u215C",
    "5/8": "\u215D",
    "7/8": "\u215E"
  };
  s = s.replace(/([a-zA-Z0-9\)])\s*\^\s*\(\s*(1\/[2-8]|2\/[35]|3\/[458]|4\/5|5\/[68]|7\/8)\s*\)/g, (_, base, frac) => {
    return `${base}${fractionPowerMap[frac] || `^(${frac})`}`;
  });
  s = s.replace(/([a-zA-Z]|\))\s*1\/3\b/g, "$1^(1/3)");
  const supDigits = {
    "0": "\u2070",
    "1": "\xB9",
    "2": "\xB2",
    "3": "\xB3",
    "4": "\u2074",
    "5": "\u2075",
    "6": "\u2076",
    "7": "\u2077",
    "8": "\u2078",
    "9": "\u2079",
    "+": "\u207A",
    "-": "\u207B",
    "=": "\u207C",
    "(": "\u207D",
    ")": "\u207E",
    "a": "\u1D43",
    "b": "\u1D47",
    "c": "\u1D9C",
    "d": "\u1D48",
    "e": "\u1D49",
    "f": "\u1DA0",
    "g": "\u1D4D",
    "h": "\u02B0",
    "i": "\u2071",
    "j": "\u02B2",
    "k": "\u1D4F",
    "l": "\u02E1",
    "m": "\u1D50",
    "n": "\u207F",
    "o": "\u1D52",
    "p": "\u1D56",
    "r": "\u02B3",
    "s": "\u02E2",
    "t": "\u1D57",
    "u": "\u1D58",
    "v": "\u1D5B",
    "w": "\u02B7",
    "x": "\u02E3",
    "y": "\u02B8",
    "z": "\u1DBB",
    "A": "\u1D2C",
    "B": "\u1D2E",
    "D": "\u1D30",
    "E": "\u1D31",
    "G": "\u1D33",
    "H": "\u1D34",
    "I": "\u1D35",
    "J": "\u1D36",
    "K": "\u1D37",
    "L": "\u1D38",
    "M": "\u1D39",
    "N": "\u1D3A",
    "O": "\u1D3C",
    "P": "\u1D3E",
    "R": "\u1D3F",
    "T": "\u1D40",
    "U": "\u1D41",
    "V": "\u2C7D",
    "W": "\u1D42"
  };
  const toSup = (str) => str.split("").map((c) => supDigits[c] || c).join("");
  s = s.replace(/([a-zA-Z0-9\)])\s*\^\s*\(([0-9a-zA-Z\+\-\s]+)\)/g, (_, base, inner) => {
    const chars = inner.replace(/\s+/g, "").split("");
    const allSup = chars.every((c) => supDigits[c] !== void 0);
    if (allSup) {
      return `${base}${chars.map((c) => supDigits[c]).join("")}`;
    }
    return `${base}^(${inner})`;
  });
  s = s.replace(/([a-zA-Z0-9\)])\s*\^\s*([+\-]?[0-9a-zA-Z]+)\b/g, (_, base, p) => {
    const chars = p.split("");
    const allSup = chars.every((c) => supDigits[c] !== void 0);
    if (allSup) {
      return `${base}${chars.map((c) => supDigits[c]).join("")}`;
    }
    return `${base}^${p}`;
  });
  s = s.replace(/\^\s*([+\-]?[0-9a-zA-Z]+)\b/g, (_, p) => {
    const chars = p.split("");
    const allSup = chars.every((c) => supDigits[c] !== void 0);
    return allSup ? chars.map((c) => supDigits[c]).join("") : `^${p}`;
  });
  s = s.replace(/([a-zA-Z])([234])(?=[a-zA-Z+\-×*÷/=\s,)\.]|$)/g, (_, v, p) => {
    return v + (p === "2" ? "\xB2" : p === "3" ? "\xB3" : "\u2074");
  });
  s = s.replace(/(\d+)\s*[\u030a\u02da]/g, "$1\xB0");
  s = s.replace(/\b(\d{1,3})o(?=\s*[+\-\*\/=]|\s*[A-Za-z]|\)|\]|,|$)/g, "$1\xB0");
  s = s.replace(/\b(sin|cos|tan|cot|sec|cosec)\s*\^\s*([0-9]+)\s*(?=[A-Za-z0-9°θφ\(])/g, (_, fn, p) => {
    return `${fn}${toSup(p)} `;
  });
  s = s.replace(/\b(sin|cos|tan|cot|sec|cosec)2(?=\s*\d+°|\s*[A-Za-zθφ\(]|\b)/g, "$1\xB2 ");
  s = s.replace(/\b(sin|cos|tan|cot|sec|cosec)3(?=\s*\d+°|\s*[A-Za-zθφ\(]|\b)/g, "$1\xB3 ");
  s = s.replace(/\b(sin|cos|tan|cot|sec|cosec)4(?=\s*\d+°|\s*[A-Za-zθφ\(]|\b)/g, "$1\u2074 ");
  s = s.replace(/([²³⁴])\s+/g, "$1 ");
  s = s.replace(/(\b\d{1,2})2\s*([+\-])\s*(\b\d{1,2})2/g, "$1\xB2 $2 $3\xB2");
  s = s.replace(/\[\s*(\d{1,2})2\s*([+\-])/g, "[$1\xB2 $2");
  s = s.replace(/\(\s*(\d{1,2})2\s*([+\-×*÷])/g, "($1\xB2 $2");
  return s;
}

// src/utils/cleanSolution.ts
function cleanSolutionText(sol = "") {
  if (!sol) return "";
  let s = String(sol).replace(/<br\s*\/?>/gi, "\n").replace(/<[a-zA-Z][^>]*>/g, "").replace(/<\/[a-zA-Z]+>/g, "").replace(/\bp>/gi, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
  s = wrapUnwrappedFractions(s);
  const mathPlaceholders = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `___MATH_BLOCK_${mathPlaceholders.length}___`;
    mathPlaceholders.push(m);
    return placeholder;
  });
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return _;
    }
  });
  s = s.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u00a0/g, " ");
  s = reconstructScrapedSolutionMath(s);
  s = s.replace(/\b(cm|mm|km|sq\.?|cu\.?)\s*\n+\s*([23])\b/gi, (_, u, p) => `${u}${p === "2" ? "\xB2" : "\xB3"}`).replace(/\b(m)\s*\n+\s*([23])\b/g, (_, u, p) => `${u}${p === "2" ? "\xB2" : "\xB3"}`).replace(/\b(cm|mm|km|sq\.?|cu\.?)\^2\b/g, "$1\xB2").replace(/\b(cm|mm|km|sq\.?|cu\.?)\^3\b/g, "$1\xB3").replace(/\b(cm|mm|km)\s*([23])\b(?!\d)/gi, (_, u, p) => `${u}${p === "2" ? "\xB2" : "\xB3"}`).replace(/\b(m)\^2\b(?!\w)/g, "m\xB2").replace(/\b(m)\^3\b(?!\w)/g, "m\xB3").replace(/\b(m)\s*([23])\b(?!\d)/g, (_, u, p) => `${u}${p === "2" ? "\xB2" : "\xB3"}`);
  s = purgeScrapedDiagramArtifacts(s);
  s = purgeScrapedWatermarks(s);
  const lines = s.split("\n").map((l) => l.trim());
  const collapsed = [];
  let prevEmpty = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (!prevEmpty && collapsed.length > 0) {
        collapsed.push("");
        prevEmpty = true;
      }
    } else {
      collapsed.push(line);
      prevEmpty = false;
    }
  }
  const resultLines = [];
  for (let i = 0; i < collapsed.length; i++) {
    const line = collapsed[i];
    if (line === "") {
      const prev = resultLines[resultLines.length - 1] || "";
      const next = collapsed[i + 1] || "";
      const isCalcOrStep = (str) => {
        if (!str) return false;
        if (/^([⇒=>∴\*\-•–—]|\d+[\.\)]|[a-zA-Z][\.\)]|step\s*\d+|case\s*\d+|statement\s*[ivx\d]+)/i.test(str)) return true;
        if (/^[^.!?\n]{1,60}\s*[=:≈]\s*.+/i.test(str)) return true;
        if (/^(total|initial|new|remaining|cost|selling|profit|loss|let|where|now|hence|therefore|since|side|height|radius|speed|distance|work|principal|rate|time|passing|difference|marks)\b/i.test(str) && str.length < 80) return true;
        return false;
      };
      const isHeaderOrLabel = (str) => {
        return /^(given|formula used|calculations?|numerator|denominator|value|final value|where|let|note|method|steps?|shortcut trick|alternate method|key points?|additional information|in news|why the other options are incorrect|further insights?):?$/i.test(str);
      };
      if (isHeaderOrLabel(prev)) {
        continue;
      }
      if (isCalcOrStep(prev) && isCalcOrStep(next)) {
        continue;
      }
      if (/^[∴\s]*(the\s+)?(correct\s+)?answer\s+(is|will be)/i.test(next) && isCalcOrStep(prev)) {
        continue;
      }
    }
    resultLines.push(line);
  }
  let finalResult = resultLines.join("\n").trim();
  mathPlaceholders.forEach((math, idx) => {
    finalResult = finalResult.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });
  return finalResult;
}
function purgeScrapedDiagramArtifacts(text = "") {
  if (!text) return "";
  const pattern1 = /(Formula\s+Used:?\s*\n(?:[^\n]+\n)+?)([\s\S]*?)(\n\s*(?:Calculations?|Calculation|Step|Steps):?)/gi;
  let res = text.replace(pattern1, (match, formulaPart, middlePart, calcPart) => {
    const lines = middlePart.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.every((l) => l.length < 40 && !l.startsWith("\u21D2") && !l.startsWith("Let ") && !l.startsWith("\u2234"))) {
      return formulaPart.trimEnd() + "\n\n" + calcPart.trimStart();
    }
    return match;
  });
  const diagramLinesPattern = /(?:^|\n)(?:[-+]\d+\n)+(?:Smallest|Largest|Middle|Average|\(Middle\)|Initial|Final|\d+\s*\/\s*\d+)/gi;
  res = res.replace(diagramLinesPattern, "");
  return res;
}
function purgeScrapedWatermarks(text = "") {
  if (!text) return "";
  return text.replace(/(?:^|\n)\s*simplicrack(?:\s+(?:Math|Maths))*\s*(?:\n\s*MRQ\s*SERIES\s*)?(?:\n\s*SSC\s*CGL\s*2026\s*)?/gi, "\n").replace(/(?:^|\n)\s*MRQ\s*SERIES\s*(?:\n\s*SSC\s*CGL\s*2026\s*)?/gi, "\n").replace(/\b(?:simplicrack(?:\s+(?:Math|Maths))*|MRQ\s*SERIES)\b/gi, "").replace(/\n{3,}/g, "\n\n").trim();
}

// src/telegram/quizData.ts
import { fileURLToPath } from "url";
var moduleDir = process.cwd();
try {
  moduleDir = path.dirname(fileURLToPath(import.meta.url));
} catch {
}
function resolveDataDir(subPath) {
  const candidates = [
    path.join(process.cwd(), "src", "data", subPath),
    path.join(process.cwd(), "data", subPath),
    path.join(moduleDir, "src", "data", subPath),
    path.join(moduleDir, "..", "src", "data", subPath),
    path.join(moduleDir, "data", subPath)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}
var DRILLS_DIR = resolveDataDir("drills");
var CHAPTER_BANK_DIR = resolveDataDir("chapter_bank");
var MOCK_ERRORS_DIR = resolveDataDir("mock_errors");
var MOCK_QUESTIONS_DIR = resolveDataDir("mock_questions");
function letterToIndex(letter) {
  if (typeof letter === "number") return letter;
  const clean = String(letter || "").trim().toLowerCase();
  if (clean === "a" || clean === "1") return 0;
  if (clean === "b" || clean === "2") return 1;
  if (clean === "c" || clean === "3") return 2;
  if (clean === "d" || clean === "4") return 3;
  if (clean === "e" || clean === "5") return 4;
  return 0;
}
function cleanRawText(str) {
  if (!str) return "";
  return str.replace(/<[^>]+>/g, " ").replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return _;
    }
  }).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
}
function sanitizeTelegramQuiz(raw) {
  let optArray = [];
  if (Array.isArray(raw.options)) {
    optArray = raw.options.map(cleanRawText);
  } else if (raw.options && typeof raw.options === "object") {
    optArray = ["a", "b", "c", "d"].map((key) => {
      const v = raw.options[key] || raw.options[key.toUpperCase()] || "";
      return cleanRawText(String(v));
    });
    if (raw.options["e"] || raw.options["E"]) {
      optArray.push(cleanRawText(String(raw.options["e"] || raw.options["E"])));
    }
  }
  if (optArray.length < 2 || optArray.every((o) => !o)) {
    optArray = ["Option A", "Option B", "Option C", "Option D"];
  }
  const seenOptions = /* @__PURE__ */ new Set();
  let formattedOptions = optArray.slice(0, 10).map((opt, idx) => {
    let t = opt.trim();
    if (t.length > 95) t = t.slice(0, 92) + "...";
    if (!t) t = `Choice ${String.fromCharCode(65 + idx)}`;
    let uniqueT = t;
    let count = 1;
    while (seenOptions.has(uniqueT.toLowerCase())) {
      uniqueT = `${t} (${count++})`;
    }
    seenOptions.add(uniqueT.toLowerCase());
    return uniqueT;
  });
  while (formattedOptions.length < 2) {
    const fallbackOpt = `Choice ${String.fromCharCode(65 + formattedOptions.length)}`;
    formattedOptions.push(fallbackOpt);
    seenOptions.add(fallbackOpt.toLowerCase());
  }
  const correctIndex = Math.max(
    0,
    Math.min(letterToIndex(raw.correctOption), formattedOptions.length - 1)
  );
  let cleanQ = cleanRawText(raw.question);
  cleanQ = cleanQ.replace(/^(\s*[\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\s]*\[[^\]]+\]\s*)+/g, "").trim();
  cleanQ = cleanQ.replace(/^(?:Question|Q\.?)\s*\d+[\s:.-]+/i, "").trim();
  if (cleanQ.length > 298) {
    cleanQ = cleanQ.slice(0, 295) + "...";
  }
  let cleanSol = cleanSolutionText(raw.solution || "");
  let shortExpl = cleanRawText(cleanSol);
  if (shortExpl.length > 195) {
    shortExpl = shortExpl.slice(0, 192) + "...";
  }
  return {
    id: raw.id,
    question: cleanQ,
    preamble: "",
    options: formattedOptions,
    correctOptionIndex: correctIndex,
    explanation: shortExpl,
    fullSolution: cleanSol || shortExpl,
    subject: raw.subject,
    topic: raw.topic,
    source: raw.source
  };
}

// src/telegram/mistakeStore.ts
var TMP_FILE = path2.join(os.tmpdir(), "cgl_user_mistakes.json");
var userMistakesMap = /* @__PURE__ */ new Map();
function saveToDisk() {
  try {
    const serialized = {};
    for (const [userId, map] of userMistakesMap.entries()) {
      serialized[String(userId)] = Array.from(map.values());
    }
    fs2.writeFileSync(TMP_FILE, JSON.stringify(serialized), "utf8");
  } catch (err) {
    console.error("[MistakeStore] Error saving to disk:", err);
  }
}
function loadFromDisk() {
  try {
    if (fs2.existsSync(TMP_FILE)) {
      const parsed = JSON.parse(fs2.readFileSync(TMP_FILE, "utf8"));
      for (const [userIdStr, list] of Object.entries(parsed)) {
        const userId = Number(userIdStr);
        if (!userMistakesMap.has(userId)) {
          userMistakesMap.set(userId, /* @__PURE__ */ new Map());
        }
        const userMap = userMistakesMap.get(userId);
        if (Array.isArray(list)) {
          for (const item of list) {
            userMap.set(item.id, item);
          }
        }
      }
    }
  } catch (err) {
    console.error("[MistakeStore] Error loading from disk:", err);
  }
}
loadFromDisk();
var mockErrorsCache = /* @__PURE__ */ new Map();
function getMockErrorsDir() {
  const candidates = [
    path2.join(process.cwd(), "src", "data", "mock_errors"),
    path2.join(process.cwd(), "data", "mock_errors"),
    path2.join(path2.dirname(__dirname), "data", "mock_errors"),
    path2.join(path2.dirname(__dirname), "src", "data", "mock_errors")
  ];
  for (const c of candidates) {
    if (fs2.existsSync(c)) return c;
  }
  return candidates[0];
}
function loadCachedMockErrors(subject) {
  if (mockErrorsCache.has(subject)) {
    return mockErrorsCache.get(subject);
  }
  const results = [];
  try {
    const mockDir = getMockErrorsDir();
    const filePath = path2.join(mockDir, `${subject}.json`);
    if (fs2.existsSync(filePath)) {
      const content = JSON.parse(fs2.readFileSync(filePath, "utf8"));
      if (Array.isArray(content)) {
        for (const item of content) {
          if (Array.isArray(item.questions)) {
            for (let idx = 0; idx < item.questions.length; idx++) {
              const q = item.questions[idx];
              const qText = (q.question || q.questionText || "").replace(/^\s*\[.*?\]\s*/g, "").trim();
              if (!qText) continue;
              const sanitized = sanitizeTelegramQuiz({
                id: q.id || `mock_${subject}_${idx}`,
                question: qText,
                options: q.options,
                correctOption: q.answer || q.correctOption || q.correct_answer,
                solution: q.solution,
                subject: subject === "english" ? "English" : subject === "mathematics" ? "Mathematics" : subject === "reasoning" ? "Reasoning" : "General Awareness",
                topic: q.subtopic || q.topic || q.conceptTested || "Error Bank",
                source: q.testName || "\u{1F4BB} Website Mock Error"
              });
              results.push(sanitized);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[MistakeStore] Error loading mock errors for ${subject}:`, err);
  }
  mockErrorsCache.set(subject, results);
  return results;
}
function classifySubjectAndTopic(q) {
  const text = `${q.question} ${q.explanation || ""} ${q.subject || ""} ${q.topic || ""} ${q.source || ""}`.toLowerCase();
  let subject = "general_awareness";
  const subStr = (q.subject || "").toLowerCase();
  if (subStr.includes("eng") || text.includes("synonym") || text.includes("antonym") || text.includes("idiom") || text.includes("one word") || text.includes("sentence") || text.includes("misspelt")) {
    subject = "english";
  } else if (subStr.includes("math") || subStr.includes("calc") || subStr.includes("quant") || text.includes("calculate") || text.includes("triplet") || text.includes("ratio") || text.includes("circumference") || text.includes("hypotenuse")) {
    subject = "mathematics";
  } else if (subStr.includes("reason") || text.includes("syllogism") || text.includes("analogy") || text.includes("blood relation") || text.includes("coding-decoding") || text.includes("letter series")) {
    subject = "reasoning";
  }
  let topic = "General Practice";
  let topicSlug = "gen";
  if (subject === "english") {
    if (text.includes("synonym") || text.includes("similar meaning")) {
      topic = "Synonyms";
      topicSlug = "syn";
    } else if (text.includes("antonym") || text.includes("opposite")) {
      topic = "Antonyms";
      topicSlug = "ant";
    } else if (text.includes("one word") || text.includes("ows") || text.includes("substituted")) {
      topic = "One Word Substitution";
      topicSlug = "ows";
    } else if (text.includes("idiom") || text.includes("phrase")) {
      topic = "Idioms & Phrases";
      topicSlug = "idioms";
    } else if (text.includes("spelling") || text.includes("misspelt") || text.includes("correctly spelt")) {
      topic = "Spelling Errors";
      topicSlug = "spell";
    } else if (text.includes("spotting") || text.includes("grammatical error") || text.includes("error spotting")) {
      topic = "Spotting Errors";
      topicSlug = "error";
    } else if (text.includes("improvement") || text.includes("filler") || text.includes("blank")) {
      topic = "Sentence Improvement & Fillers";
      topicSlug = "improve";
    } else if (text.includes("voice") || text.includes("passive")) {
      topic = "Active & Passive Voice";
      topicSlug = "voice";
    } else if (text.includes("narration") || text.includes("direct") || text.includes("indirect")) {
      topic = "Direct & Indirect Speech";
      topicSlug = "narration";
    } else if (text.includes("jumble") || text.includes("pqrs") || text.includes("rearrangement")) {
      topic = "Para Jumbles (PQRS)";
      topicSlug = "pqrs";
    } else if (text.includes("cloze") || text.includes("comprehension")) {
      topic = "Cloze & Comprehension";
      topicSlug = "cloze";
    } else {
      topic = "Vocabulary & Grammar";
      topicSlug = "vocab";
    }
  } else if (subject === "general_awareness") {
    if (text.includes("polity") || text.includes("article") || text.includes("constitution") || text.includes("amendment") || text.includes("parliament") || text.includes("president") || text.includes("fundamental") || text.includes("schedule") || text.includes("court")) {
      topic = "Polity & Constitution";
      topicSlug = "polity";
    } else if (text.includes("history") || text.includes("sultanate") || text.includes("mughal") || text.includes("harappan") || text.includes("mauryan") || text.includes("british") || text.includes("gandhi") || text.includes("revolt") || text.includes("vedic") || text.includes("freedom movement")) {
      topic = "History (Ancient, Med, Mod)";
      topicSlug = "history";
    } else if (text.includes("geography") || text.includes("river") || text.includes("mountain") || text.includes("climate") || text.includes("soil") || text.includes("ocean") || text.includes("ramsar") || text.includes("national park")) {
      topic = "Geography & Environment";
      topicSlug = "geo";
    } else if (text.includes("econom") || text.includes("gdp") || text.includes("inflation") || text.includes("rbi") || text.includes("budget") || text.includes("fiscal") || text.includes("monetary")) {
      topic = "Economics & Budget";
      topicSlug = "eco";
    } else if (text.includes("physics") || text.includes("chemistry") || text.includes("biology") || text.includes("cell") || text.includes("vitamin") || text.includes("disease") || text.includes("acid") || text.includes("energy")) {
      topic = "General Science";
      topicSlug = "science";
    } else if (text.includes("dance") || text.includes("festival") || text.includes("temple") || text.includes("music") || text.includes("instrument") || text.includes("painting") || text.includes("heritage")) {
      topic = "Art, Culture & Dance";
      topicSlug = "culture";
    } else if (text.includes("sport") || text.includes("trophy") || text.includes("cup") || text.includes("olympic") || text.includes("award")) {
      topic = "Sports & Awards";
      topicSlug = "sports";
    } else {
      topic = "Static GK & Current Affairs";
      topicSlug = "static";
    }
  } else if (subject === "mathematics") {
    if (text.includes("percent")) {
      topic = "Percentage";
      topicSlug = "percent";
    } else if (text.includes("profit") || text.includes("loss") || text.includes("discount")) {
      topic = "Profit, Loss & Discount";
      topicSlug = "profit";
    } else if (text.includes("ratio") || text.includes("proportion") || text.includes("mixture") || text.includes("alligation") || text.includes("coin")) {
      topic = "Ratio, Proportion & Mixture";
      topicSlug = "ratio";
    } else if (text.includes("speed") || text.includes("distance") || text.includes("train") || text.includes("boat") || text.includes("stream")) {
      topic = "Speed, Distance & Boats";
      topicSlug = "tsd";
    } else if (text.includes("work") || text.includes("pipe") || text.includes("cistern") || text.includes("efficiency")) {
      topic = "Time & Work / Pipes";
      topicSlug = "work";
    } else if (text.includes("interest") || text.includes("ci") || text.includes("si") || text.includes("compound") || text.includes("simple interest")) {
      topic = "Simple & Compound Interest";
      topicSlug = "interest";
    } else if (text.includes("geometry") || text.includes("triangle") || text.includes("circle") || text.includes("triplet") || text.includes("chord")) {
      topic = "Geometry & Triplets";
      topicSlug = "geom";
    } else if (text.includes("mensuration") || text.includes("cylinder") || text.includes("sphere") || text.includes("cone") || text.includes("cuboid")) {
      topic = "Mensuration 2D & 3D";
      topicSlug = "mens";
    } else if (text.includes("algebra") || text.includes("polynomial") || text.includes("quadratic")) {
      topic = "Algebra";
      topicSlug = "algebra";
    } else if (text.includes("trigonometr") || text.includes("sin") || text.includes("cos") || text.includes("tan") || text.includes("height")) {
      topic = "Trigonometry & Heights";
      topicSlug = "trig";
    } else if (text.includes("number system") || text.includes("divisib") || text.includes("remainder") || text.includes("unit digit") || text.includes("lcm") || text.includes("hcf")) {
      topic = "Number System, LCM & HCF";
      topicSlug = "number";
    } else if (text.includes("table") || text.includes("square") || text.includes("cube") || text.includes("power") || text.includes("simplification")) {
      topic = "Calculation Studio";
      topicSlug = "calc";
    } else {
      topic = "General Arithmetic";
      topicSlug = "arith";
    }
  } else if (subject === "reasoning") {
    if (text.includes("coding") || text.includes("decoding") || text.includes("letter code")) {
      topic = "Coding-Decoding";
      topicSlug = "coding";
    } else if (text.includes("syllogism") || text.includes("venn")) {
      topic = "Syllogism & Venn";
      topicSlug = "syllogism";
    } else if (text.includes("blood relation")) {
      topic = "Blood Relations";
      topicSlug = "blood";
    } else if (text.includes("series") || text.includes("pattern") || text.includes("missing number")) {
      topic = "Series & Pattern";
      topicSlug = "series";
    } else if (text.includes("analogy") || text.includes("classification") || text.includes("odd one")) {
      topic = "Analogy & Classification";
      topicSlug = "analogy";
    } else if (text.includes("direction")) {
      topic = "Direction Sense";
      topicSlug = "direction";
    } else if (text.includes("mirror") || text.includes("water image") || text.includes("paper folding") || text.includes("embedded")) {
      topic = "Non-Verbal Reasoning";
      topicSlug = "nonverbal";
    } else if (text.includes("dictionary") || text.includes("order") || text.includes("ranking") || text.includes("bodmas")) {
      topic = "BODMAS & Ranking";
      topicSlug = "bodmas";
    } else {
      topic = "General Intelligence";
      topicSlug = "logic";
    }
  }
  return { subject, topic, topicSlug };
}
var DELETED_FILE = path2.join(os.tmpdir(), "cgl_deleted_mistakes.json");
var deletedQuestionsSet = /* @__PURE__ */ new Set();
function saveDeletedToDisk() {
  try {
    fs2.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(deletedQuestionsSet)), "utf8");
  } catch (err) {
    console.error("[MistakeStore] Error saving deleted questions to disk:", err);
  }
}
function loadDeletedFromDisk() {
  try {
    if (fs2.existsSync(DELETED_FILE)) {
      const list = JSON.parse(fs2.readFileSync(DELETED_FILE, "utf8"));
      if (Array.isArray(list)) {
        for (const id of list) {
          if (id) deletedQuestionsSet.add(String(id).trim().toLowerCase());
        }
      }
    }
  } catch (err) {
    console.error("[MistakeStore] Error loading deleted questions from disk:", err);
  }
}
loadDeletedFromDisk();
function isQuestionDeleted(id, text) {
  loadDeletedFromDisk();
  if (id && deletedQuestionsSet.has(id.trim().toLowerCase())) return true;
  if (text) {
    const clean = text.trim().toLowerCase();
    if (deletedQuestionsSet.has(clean)) return true;
  }
  return false;
}
function deleteMistake(userId, qId, qText) {
  loadFromDisk();
  loadDeletedFromDisk();
  if (qId) deletedQuestionsSet.add(qId.trim().toLowerCase());
  if (qText) deletedQuestionsSet.add(qText.trim().toLowerCase());
  saveDeletedToDisk();
  if (userId && userMistakesMap.has(userId)) {
    userMistakesMap.get(userId).delete(qId);
  } else {
    for (const map of userMistakesMap.values()) {
      map.delete(qId);
      for (const [k, v] of map.entries()) {
        if (v.question === qText || v.id === qId) {
          map.delete(k);
        }
      }
    }
  }
  saveToDisk();
}
function syncDeletedQuestions(ids) {
  loadDeletedFromDisk();
  for (const id of ids) {
    if (id) deletedQuestionsSet.add(String(id).trim().toLowerCase());
  }
  saveDeletedToDisk();
}
function getDeletedQuestionIds() {
  loadDeletedFromDisk();
  return Array.from(deletedQuestionsSet);
}
function getAllRecordedMistakes(filter = "all", subject, topicSlug) {
  loadFromDisk();
  loadDeletedFromDisk();
  const results = [];
  const seenIds = /* @__PURE__ */ new Set();
  if (filter === "all" || filter === "telegram_drill") {
    for (const map of userMistakesMap.values()) {
      for (const item of map.values()) {
        if (item.mastered) continue;
        if (isQuestionDeleted(item.id, item.question)) continue;
        if (subject && item.subject !== subject) continue;
        if (topicSlug && topicSlug !== "_" && item.topicSlug !== topicSlug) continue;
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    }
  }
  if (filter === "all" || filter === "website_mock") {
    const subjectsToLoad = subject ? [subject] : ["english", "mathematics", "reasoning", "general_awareness"];
    for (const sub of subjectsToLoad) {
      const mockList = loadCachedMockErrors(sub);
      for (const mq of mockList) {
        if (seenIds.has(mq.id)) continue;
        if (isQuestionDeleted(mq.id, mq.question)) continue;
        const classified = classifySubjectAndTopic(mq);
        if (topicSlug && topicSlug !== "_" && classified.topicSlug !== topicSlug) continue;
        seenIds.add(mq.id);
        results.push({
          id: mq.id,
          userId: 0,
          question: mq.question,
          options: mq.options,
          correctOptionIndex: mq.correctOptionIndex,
          explanation: mq.explanation || "",
          subject: classified.subject,
          topic: classified.topic,
          topicSlug: classified.topicSlug,
          source: "website_mock",
          timestamp: Date.now(),
          wrongCount: 1,
          mastered: false
        });
      }
    }
  }
  return results;
}
function getMistakeStats(userId, filter = "all") {
  loadFromDisk();
  loadDeletedFromDisk();
  const subjects = [
    { id: "english", shortCode: "eng", title: "\u{1F4D6} English" },
    { id: "mathematics", shortCode: "math", title: "\u{1F4D0} Mathematics" },
    { id: "reasoning", shortCode: "reas", title: "\u{1F9E0} Reasoning" },
    { id: "general_awareness", shortCode: "ga", title: "\u{1F3DB}\uFE0F General Awareness" }
  ];
  return subjects.map((sub) => {
    const topicMap = /* @__PURE__ */ new Map();
    let total = 0;
    const seenQIds = /* @__PURE__ */ new Set();
    if (filter === "all" || filter === "telegram_drill") {
      const userMap = userMistakesMap.get(userId);
      if (userMap) {
        for (const item of userMap.values()) {
          if (item.mastered) continue;
          if (isQuestionDeleted(item.id, item.question)) continue;
          if (filter !== "all" && item.source !== filter) continue;
          if (item.subject === sub.id) {
            seenQIds.add(item.id);
            total++;
            const existing = topicMap.get(item.topicSlug) || {
              topic: item.topic,
              slug: item.topicSlug,
              count: 0
            };
            existing.count++;
            topicMap.set(item.topicSlug, existing);
          }
        }
      }
    }
    if (filter === "all" || filter === "website_mock") {
      const mockList = loadCachedMockErrors(sub.id);
      for (const mq of mockList) {
        if (seenQIds.has(mq.id)) continue;
        if (isQuestionDeleted(mq.id, mq.question)) continue;
        const classified = classifySubjectAndTopic(mq);
        seenQIds.add(mq.id);
        total++;
        const existing = topicMap.get(classified.topicSlug) || {
          topic: classified.topic,
          slug: classified.topicSlug,
          count: 0
        };
        existing.count++;
        topicMap.set(classified.topicSlug, existing);
      }
    }
    const topics = Array.from(topicMap.values()).sort((a, b) => b.count - a.count);
    return {
      subjectId: sub.id,
      shortCode: sub.shortCode,
      title: sub.title,
      total,
      topics
    };
  });
}
function getTotalMistakesSummary(userId) {
  const allStats = getMistakeStats(userId, "all");
  const tgStats = getMistakeStats(userId, "telegram_drill");
  const webStats = getMistakeStats(userId, "website_mock");
  return {
    all: allStats.reduce((acc, s) => acc + s.total, 0),
    telegram_drill: tgStats.reduce((acc, s) => acc + s.total, 0),
    website_mock: webStats.reduce((acc, s) => acc + s.total, 0)
  };
}

// api/mistakes.ts
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method === "GET") {
    try {
      const { filter = "all", subject, topicSlug, userId } = req.query;
      const numUserId = userId ? Number(userId) : void 0;
      const mistakes = getAllRecordedMistakes(filter, subject, topicSlug);
      const stats = getMistakeStats(numUserId || 0, filter);
      const summary = getTotalMistakesSummary(numUserId || 0);
      const deletedIds = getDeletedQuestionIds();
      return res.status(200).json({
        success: true,
        summary,
        stats,
        mistakes,
        deletedIds,
        total: mistakes.length
      });
    } catch (err) {
      console.error("[api/mistakes GET] Error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { action, questionId, questionText, userId, ids } = body || {};
      if (action === "delete") {
        if (!questionId && !questionText) {
          return res.status(400).json({ error: "questionId or questionText is required" });
        }
        deleteMistake(userId ? Number(userId) : void 0, questionId, questionText);
        return res.status(200).json({
          success: true,
          message: "Question deleted from mistake bank and synced across all devices.",
          deletedQuestionId: questionId
        });
      }
      if (action === "sync_deleted") {
        if (Array.isArray(ids)) {
          syncDeletedQuestions(ids);
          return res.status(200).json({
            success: true,
            syncedCount: ids.length
          });
        }
        return res.status(400).json({ error: "ids array required for sync_deleted" });
      }
      return res.status(400).json({ error: "Unknown action" });
    } catch (err) {
      console.error("[api/mistakes POST] Error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}
export {
  handler as default
};
