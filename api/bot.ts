// src/telegram/bot.ts
import { Bot, InlineKeyboard } from "grammy";
import dotenv from "dotenv";

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
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
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
  let preamble = void 0;
  if (cleanQ.length > 295) {
    preamble = `\u{1F4DD} *Question Full Context:*
${cleanQ}`;
    cleanQ = cleanQ.slice(0, 292) + "...";
  }
  let cleanSol = cleanSolutionText(raw.solution || "");
  let shortExpl = cleanRawText(cleanSol);
  if (shortExpl.length > 195) {
    shortExpl = shortExpl.slice(0, 192) + "...";
  }
  return {
    id: raw.id,
    question: cleanQ,
    preamble,
    options: formattedOptions,
    correctOptionIndex: correctIndex,
    explanation: shortExpl,
    fullSolution: cleanSol || shortExpl,
    subject: raw.subject,
    topic: raw.topic,
    source: raw.source
  };
}
function generateTripletsDrill(count = 10) {
  let rawTriplets = [];
  try {
    const file = path.join(DRILLS_DIR, "triplets.json");
    if (fs.existsSync(file)) {
      rawTriplets = JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {
  }
  if (!rawTriplets || rawTriplets.length === 0) {
    rawTriplets = [
      { a: 3, b: 4, c: 5 },
      { a: 5, b: 12, c: 13 },
      { a: 7, b: 24, c: 25 },
      { a: 8, b: 15, c: 17 },
      { a: 9, b: 40, c: 41 },
      { a: 11, b: 60, c: 61 },
      { a: 12, b: 35, c: 37 },
      { a: 20, b: 21, c: 29 }
    ];
  }
  const selected = shuffle(rawTriplets).slice(0, count);
  return selected.map((t, idx) => {
    const isHypMissing = Math.random() > 0.45;
    let question = "";
    let correct = 0;
    let wrongOptions = [];
    if (isHypMissing) {
      question = `\u{1F4D0} Triplet: If base and perpendicular are ${t.a} & ${t.b}, what is the hypotenuse?`;
      correct = t.c;
      wrongOptions = [t.c + 1, t.c - 1, t.c + 2, t.c + (t.a % 2 === 0 ? 4 : -3)].filter(
        (x) => x !== correct && x > 0
      );
    } else {
      question = `\u{1F4D0} Triplet: Which side completes the Pythagorean triplet (${t.a}, ___, ${t.c})?`;
      correct = t.b;
      wrongOptions = [t.b + 1, t.b - 1, t.b + 2, t.b - 2].filter((x) => x !== correct && x > 0);
    }
    const uniqueWrong = Array.from(new Set(wrongOptions)).slice(0, 3);
    while (uniqueWrong.length < 3) {
      uniqueWrong.push(correct + uniqueWrong.length + 3);
    }
    const allOpts = shuffle([String(correct), ...uniqueWrong.map(String)]);
    return sanitizeTelegramQuiz({
      id: `triplet_${idx}_${Date.now()}`,
      question,
      options: allOpts,
      correctOption: allOpts.indexOf(String(correct)),
      solution: `Pythagorean Theorem: ${t.a}\xB2 + ${t.b}\xB2 = ${t.c}\xB2 (${t.a * t.a} + ${t.b * t.b} = ${t.c * t.c})`,
      subject: "Speed Math",
      topic: "Triplets",
      source: "Triplets Speed Lab"
    });
  });
}
function generateFractionsDrill(count = 10) {
  let rawFractions = [];
  try {
    const file = path.join(DRILLS_DIR, "fractions.json");
    if (fs.existsSync(file)) {
      rawFractions = JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {
  }
  if (!rawFractions || rawFractions.length === 0) {
    rawFractions = [
      { fraction: "1/6", percentage: "16.66%" },
      { fraction: "1/7", percentage: "14.28%" },
      { fraction: "3/8", percentage: "37.5%" },
      { fraction: "5/8", percentage: "62.5%" },
      { fraction: "1/12", percentage: "8.33%" },
      { fraction: "1/14", percentage: "7.14%" },
      { fraction: "4/7", percentage: "57.14%" }
    ];
  }
  const selected = shuffle(rawFractions).slice(0, count);
  return selected.map((item, idx) => {
    const toPercent = Math.random() > 0.45;
    let question = "";
    let correct = "";
    let pool = [];
    if (toPercent) {
      question = `\u{1F4AF} Percentage Conversion: What is ${item.fraction} as a percentage?`;
      correct = item.percentage;
      pool = rawFractions.map((f) => f.percentage).filter((p) => p !== correct);
    } else {
      question = `\u{1F4AF} Fraction Equivalent: What fraction corresponds to ${item.percentage}?`;
      correct = item.fraction;
      pool = rawFractions.map((f) => f.fraction).filter((f) => f !== correct);
    }
    const wrong = shuffle(Array.from(new Set(pool))).slice(0, 3);
    const allOpts = shuffle([correct, ...wrong]);
    return sanitizeTelegramQuiz({
      id: `fraction_${idx}_${Date.now()}`,
      question,
      options: allOpts,
      correctOption: allOpts.indexOf(correct),
      solution: `Fraction to Percentage:
${item.fraction} \xD7 100% = ${item.percentage} (Decimal: ${item.decimal || "N/A"})`,
      subject: "Speed Math",
      topic: "Fractions",
      source: "Fractions & Percentages Lab"
    });
  });
}
function generateSquaresDrill(count = 10) {
  const numbers = [];
  while (numbers.length < count) {
    const n = Math.floor(Math.random() * 38) + 12;
    if (!numbers.includes(n)) numbers.push(n);
  }
  return numbers.map((n, idx) => {
    const isSquare = Math.random() > 0.25;
    let question = "";
    let correct = "";
    let wrong = [];
    if (isSquare) {
      const sq = n * n;
      question = `\u{1F522} Mental Math: What is the square of ${n} (${n}\xB2)?`;
      correct = String(sq);
      wrong = [
        String(sq + 10),
        String(sq - 10),
        String(sq + (n % 2 === 0 ? 20 : -20)),
        String((n + 1) * (n + 1))
      ].filter((x) => x !== correct);
    } else {
      const c = Math.floor(Math.random() * 19) + 2;
      const cube = c * c * c;
      question = `\u{1F522} Mental Math: What is the cube of ${c} (${c}\xB3)?`;
      correct = String(cube);
      wrong = [
        String(cube + 10),
        String(cube - 10),
        String((c - 1) * (c - 1) * (c - 1))
      ].filter((x) => x !== correct);
    }
    const uniqueWrong = shuffle(Array.from(new Set(wrong))).slice(0, 3);
    const allOpts = shuffle([correct, ...uniqueWrong]);
    return sanitizeTelegramQuiz({
      id: `math_${idx}_${Date.now()}`,
      question,
      options: allOpts,
      correctOption: allOpts.indexOf(correct),
      solution: `Fast Calculation:
${n}\xB2 = ${n * n}`,
      subject: "Speed Math",
      topic: "Squares & Cubes",
      source: "Mental Speed Lab"
    });
  });
}
function generateMixedSpeedDrill(count = 10) {
  const t = generateTripletsDrill(4);
  const f = generateFractionsDrill(3);
  const s = generateSquaresDrill(3);
  return shuffle([...t, ...f, ...s]).slice(0, count);
}

// src/data/drills/fractions.json
var fractions_default = [
  { fraction: "1/2", percentage: "50%", decimal: "0.5" },
  { fraction: "1/3", percentage: "33.33%", decimal: "0.333" },
  { fraction: "2/3", percentage: "66.66%", decimal: "0.666" },
  { fraction: "1/4", percentage: "25%", decimal: "0.25" },
  { fraction: "3/4", percentage: "75%", decimal: "0.75" },
  { fraction: "1/5", percentage: "20%", decimal: "0.2" },
  { fraction: "2/5", percentage: "40%", decimal: "0.4" },
  { fraction: "3/5", percentage: "60%", decimal: "0.6" },
  { fraction: "4/5", percentage: "80%", decimal: "0.8" },
  { fraction: "1/6", percentage: "16.66%", decimal: "0.166" },
  { fraction: "5/6", percentage: "83.33%", decimal: "0.833" },
  { fraction: "1/7", percentage: "14.28%", decimal: "0.1428" },
  { fraction: "2/7", percentage: "28.57%", decimal: "0.2857" },
  { fraction: "3/7", percentage: "42.85%", decimal: "0.4285" },
  { fraction: "4/7", percentage: "57.14%", decimal: "0.5714" },
  { fraction: "5/7", percentage: "71.42%", decimal: "0.7142" },
  { fraction: "6/7", percentage: "85.71%", decimal: "0.8571" },
  { fraction: "1/8", percentage: "12.5%", decimal: "0.125" },
  { fraction: "3/8", percentage: "37.5%", decimal: "0.375" },
  { fraction: "5/8", percentage: "62.5%", decimal: "0.625" },
  { fraction: "7/8", percentage: "87.5%", decimal: "0.875" },
  { fraction: "1/9", percentage: "11.11%", decimal: "0.111" },
  { fraction: "2/9", percentage: "22.22%", decimal: "0.222" },
  { fraction: "4/9", percentage: "44.44%", decimal: "0.444" },
  { fraction: "5/9", percentage: "55.55%", decimal: "0.555" },
  { fraction: "7/9", percentage: "77.77%", decimal: "0.777" },
  { fraction: "8/9", percentage: "88.88%", decimal: "0.888" },
  { fraction: "1/10", percentage: "10%", decimal: "0.1" },
  { fraction: "1/11", percentage: "9.09%", decimal: "0.0909" },
  { fraction: "2/11", percentage: "18.18%", decimal: "0.1818" },
  { fraction: "3/11", percentage: "27.27%", decimal: "0.2727" },
  { fraction: "4/11", percentage: "36.36%", decimal: "0.3636" },
  { fraction: "5/11", percentage: "45.45%", decimal: "0.4545" },
  { fraction: "6/11", percentage: "54.54%", decimal: "0.5454" },
  { fraction: "7/11", percentage: "63.63%", decimal: "0.6363" },
  { fraction: "8/11", percentage: "72.72%", decimal: "0.7272" },
  { fraction: "9/11", percentage: "81.81%", decimal: "0.8181" },
  { fraction: "10/11", percentage: "90.90%", decimal: "0.909" },
  { fraction: "1/12", percentage: "8.33%", decimal: "0.0833" },
  { fraction: "5/12", percentage: "41.66%", decimal: "0.4166" },
  { fraction: "7/12", percentage: "58.33%", decimal: "0.5833" },
  { fraction: "11/12", percentage: "91.66%", decimal: "0.9166" },
  { fraction: "1/13", percentage: "7.69%", decimal: "0.0769" },
  { fraction: "1/14", percentage: "7.14%", decimal: "0.0714" },
  { fraction: "3/14", percentage: "21.42%", decimal: "0.2142" },
  { fraction: "5/14", percentage: "35.71%", decimal: "0.3571" },
  { fraction: "1/15", percentage: "6.66%", decimal: "0.0666" },
  { fraction: "2/15", percentage: "13.33%", decimal: "0.1333" },
  { fraction: "4/15", percentage: "26.66%", decimal: "0.2666" },
  { fraction: "7/15", percentage: "46.66%", decimal: "0.4666" },
  { fraction: "1/16", percentage: "6.25%", decimal: "0.0625" },
  { fraction: "3/16", percentage: "18.75%", decimal: "0.1875" },
  { fraction: "5/16", percentage: "31.25%", decimal: "0.3125" },
  { fraction: "7/16", percentage: "43.75%", decimal: "0.4375" },
  { fraction: "9/16", percentage: "56.25%", decimal: "0.5625" },
  { fraction: "11/16", percentage: "68.75%", decimal: "0.6875" },
  { fraction: "13/16", percentage: "81.25%", decimal: "0.8125" },
  { fraction: "15/16", percentage: "93.75%", decimal: "0.9375" },
  { fraction: "1/17", percentage: "5.88%", decimal: "0.0588" },
  { fraction: "1/18", percentage: "5.55%", decimal: "0.0555" },
  { fraction: "1/19", percentage: "5.26%", decimal: "0.0526" },
  { fraction: "1/20", percentage: "5%", decimal: "0.05" },
  { fraction: "1/21", percentage: "4.76%", decimal: "0.0476" },
  { fraction: "1/22", percentage: "4.54%", decimal: "0.0454" },
  { fraction: "1/23", percentage: "4.34%", decimal: "0.0434" },
  { fraction: "1/24", percentage: "4.16%", decimal: "0.0416" },
  { fraction: "1/25", percentage: "4%", decimal: "0.04" },
  { fraction: "1/30", percentage: "3.33%", decimal: "0.0333" },
  { fraction: "1/40", percentage: "2.5%", decimal: "0.025" },
  { fraction: "1/50", percentage: "2%", decimal: "0.02" }
];

// src/data/drills/calculationData.ts
var FRACTIONS_DATA = fractions_default;
var PRIMITIVE_TRIPLETS = [
  { a: 3, b: 4, c: 5, type: "primitive", tags: ["basic", "must-know"] },
  { a: 5, b: 12, c: 13, type: "primitive", tags: ["basic", "must-know"] },
  { a: 7, b: 24, c: 25, type: "primitive", tags: ["basic", "must-know"] },
  { a: 8, b: 15, c: 17, type: "primitive", tags: ["basic", "must-know"] },
  { a: 9, b: 40, c: 41, type: "primitive", tags: ["basic", "must-know"] },
  { a: 11, b: 60, c: 61, type: "primitive", tags: ["standard"] },
  { a: 12, b: 35, c: 37, type: "primitive", tags: ["standard", "high-frequency"] },
  { a: 13, b: 84, c: 85, type: "primitive", tags: ["advanced"] },
  { a: 16, b: 63, c: 65, type: "primitive", tags: ["standard"] },
  { a: 20, b: 21, c: 29, type: "primitive", tags: ["high-frequency"] },
  { a: 28, b: 45, c: 53, type: "primitive", tags: ["standard"] },
  { a: 33, b: 56, c: 65, type: "primitive", tags: ["advanced"] },
  { a: 36, b: 77, c: 85, type: "primitive", tags: ["advanced"] },
  { a: 39, b: 80, c: 89, type: "primitive", tags: ["advanced"] },
  { a: 48, b: 55, c: 73, type: "primitive", tags: ["advanced"] },
  { a: 65, b: 72, c: 97, type: "primitive", tags: ["advanced"] }
];
var TABLES_CONFIG = {
  minTable: 12,
  maxTable: 24,
  multipliers: [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19]
};
var SQUARES_17_39 = Array.from({ length: 39 - 17 + 1 }, (_, i) => {
  const n = 17 + i;
  return { n, val: n * n };
});
var CUBES_11_25 = Array.from({ length: 25 - 11 + 1 }, (_, i) => {
  const n = 11 + i;
  return { n, val: n * n * n };
});
var POWERS_DATA = [
  // 2^1 to 2^6
  { base: 2, exp: 1, val: 2 },
  { base: 2, exp: 2, val: 4 },
  { base: 2, exp: 3, val: 8 },
  { base: 2, exp: 4, val: 16 },
  { base: 2, exp: 5, val: 32 },
  { base: 2, exp: 6, val: 64 },
  // 3^1 to 3^6
  { base: 3, exp: 1, val: 3 },
  { base: 3, exp: 2, val: 9 },
  { base: 3, exp: 3, val: 27 },
  { base: 3, exp: 4, val: 81 },
  { base: 3, exp: 5, val: 243 },
  { base: 3, exp: 6, val: 729 },
  // 4^1 to 4^6
  { base: 4, exp: 1, val: 4 },
  { base: 4, exp: 2, val: 16 },
  { base: 4, exp: 3, val: 64 },
  { base: 4, exp: 4, val: 256 },
  { base: 4, exp: 5, val: 1024 },
  { base: 4, exp: 6, val: 4096 },
  // 5^1 to 5^4
  { base: 5, exp: 1, val: 5 },
  { base: 5, exp: 2, val: 25 },
  { base: 5, exp: 3, val: 125 },
  { base: 5, exp: 4, val: 625 },
  // 6^1 to 6^4
  { base: 6, exp: 1, val: 6 },
  { base: 6, exp: 2, val: 36 },
  { base: 6, exp: 3, val: 216 },
  { base: 6, exp: 4, val: 1296 },
  // 7^1 to 7^4
  { base: 7, exp: 1, val: 7 },
  { base: 7, exp: 2, val: 49 },
  { base: 7, exp: 3, val: 343 },
  { base: 7, exp: 4, val: 2401 },
  // 8^1 to 8^4
  { base: 8, exp: 1, val: 8 },
  { base: 8, exp: 2, val: 64 },
  { base: 8, exp: 3, val: 512 },
  { base: 8, exp: 4, val: 4096 },
  // 9^1 to 9^4
  { base: 9, exp: 1, val: 9 },
  { base: 9, exp: 2, val: 81 },
  { base: 9, exp: 3, val: 729 },
  { base: 9, exp: 4, val: 6561 }
];
var FACTORIALS_DATA = [
  { n: 1, val: 1, breakdown: "1" },
  { n: 2, val: 2, breakdown: "2 \xD7 1" },
  { n: 3, val: 6, breakdown: "3 \xD7 2 \xD7 1" },
  { n: 4, val: 24, breakdown: "4 \xD7 6" },
  { n: 5, val: 120, breakdown: "5 \xD7 24" },
  { n: 6, val: 720, breakdown: "6 \xD7 120" },
  { n: 7, val: 5040, breakdown: "7 \xD7 720" },
  { n: 8, val: 40320, breakdown: "8 \xD7 5040" }
];
var CALC_SECTIONS = [
  {
    id: "triplets",
    title: "Primitive Triplets",
    shortTitle: "Triplets (Primitives)",
    badge: "Step 1",
    description: "All 16 primitive Pythagorean triplets tested at least once",
    count: PRIMITIVE_TRIPLETS.length,
    color: "from-blue-600 to-indigo-600",
    lightBg: "bg-blue-50 text-blue-700 border-blue-200",
    accentColor: "blue"
  },
  {
    id: "tables",
    title: "Tables (12 to 24)",
    shortTitle: "Tables 12\u201324",
    badge: "Step 2",
    description: "Every table from 12 through 24 tested at least once",
    count: 24 - 12 + 1,
    color: "from-emerald-600 to-teal-600",
    lightBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    accentColor: "emerald"
  },
  {
    id: "squares",
    title: "Squares (17 to 39)",
    shortTitle: "Squares 17\u201339",
    badge: "Step 3",
    description: "Every square from 17\xB2 to 39\xB2 tested at least once",
    count: SQUARES_17_39.length,
    color: "from-amber-500 to-orange-600",
    lightBg: "bg-amber-50 text-amber-700 border-amber-200",
    accentColor: "amber"
  },
  {
    id: "cubes",
    title: "Cubes (11 to 25)",
    shortTitle: "Cubes 11\u201325",
    badge: "Step 4",
    description: "Every cube from 11\xB3 to 25\xB3 tested at least once",
    count: CUBES_11_25.length,
    color: "from-purple-600 to-violet-600",
    lightBg: "bg-purple-50 text-purple-700 border-purple-200",
    accentColor: "purple"
  },
  {
    id: "powers",
    title: "Powers (2\u20134 to ^6 & 5\u20139 to ^4)",
    shortTitle: "Powers",
    badge: "Step 5",
    description: "All 38 power values tested at least once",
    count: POWERS_DATA.length,
    color: "from-rose-500 to-pink-600",
    lightBg: "bg-rose-50 text-rose-700 border-rose-200",
    accentColor: "rose"
  },
  {
    id: "factorials",
    title: "Factorials (1! to 8!)",
    shortTitle: "Factorials 1\u20138",
    badge: "Step 6",
    description: "All 8 factorials from 1! to 8! tested at least once",
    count: FACTORIALS_DATA.length,
    color: "from-cyan-600 to-blue-600",
    lightBg: "bg-cyan-50 text-cyan-700 border-cyan-200",
    accentColor: "cyan"
  },
  {
    id: "fractions",
    title: "Fractions & Percentages (1/2 to 1/25)",
    shortTitle: "Fractions %",
    badge: "Step 7",
    description: "Master core percentage conversions from 1/2 to 1/25 with decimal equivalents",
    count: FRACTIONS_DATA.length,
    color: "from-indigo-600 to-violet-600",
    lightBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    accentColor: "indigo"
  }
];
function createTripletQuestion(item) {
  const missing = Math.random() < 0.5 ? "c" : Math.random() < 0.5 ? "a" : "b";
  let prompt = "";
  let subPrompt = "";
  let answer = 0;
  if (missing === "c") {
    prompt = `[ ${item.a} , ${item.b} , ? ]`;
    subPrompt = "Find the Hypotenuse (c)";
    answer = item.c;
  } else if (missing === "a") {
    prompt = `[ ? , ${item.b} , ${item.c} ]`;
    subPrompt = "Find missing Leg (a)";
    answer = item.a;
  } else {
    prompt = `[ ${item.a} , ? , ${item.c} ]`;
    subPrompt = "Find missing Leg (b)";
    answer = item.b;
  }
  return {
    id: `triplet-${item.a}-${item.b}-${item.c}-${Date.now()}-${Math.random()}`,
    section: "triplets",
    sectionTitle: "Primitive Triplets",
    prompt,
    subPrompt,
    answer,
    rawKey: `triplet-${item.a}-${item.b}-${item.c}`,
    explanation: `${item.a}\xB2 + ${item.b}\xB2 = ${item.a * item.a} + ${item.b * item.b} = ${item.c * item.c} = ${item.c}\xB2`,
    metadata: { item, missing }
  };
}
function createTableQuestion(table) {
  const multiplier = TABLES_CONFIG.multipliers[Math.floor(Math.random() * TABLES_CONFIG.multipliers.length)];
  return {
    id: `table-${table}-${multiplier}-${Date.now()}-${Math.random()}`,
    section: "tables",
    sectionTitle: "Tables 12\u201324",
    prompt: `${table} \xD7 ${multiplier}`,
    subPrompt: `Calculate product`,
    answer: table * multiplier,
    rawKey: `table-${table}`,
    explanation: `${table} \xD7 ${multiplier} = ${table * multiplier}`
  };
}
function createSquareQuestion(item) {
  const isRoot = Math.random() < 0.25;
  if (isRoot) {
    return {
      id: `square-root-${item.n}-${Date.now()}-${Math.random()}`,
      section: "squares",
      sectionTitle: "Squares 17\u201339",
      prompt: `\u221A${item.val}`,
      subPrompt: `Square root of ${item.val}`,
      answer: item.n,
      rawKey: `square-${item.n}`,
      explanation: `\u221A${item.val} = ${item.n} (since ${item.n}\xB2 = ${item.val})`
    };
  }
  return {
    id: `square-${item.n}-${Date.now()}-${Math.random()}`,
    section: "squares",
    sectionTitle: "Squares 17\u201339",
    prompt: `${item.n}\xB2`,
    subPrompt: `Square of ${item.n}`,
    answer: item.val,
    rawKey: `square-${item.n}`,
    explanation: `${item.n}\xB2 = ${item.val}`
  };
}
function createCubeQuestion(item) {
  const isRoot = Math.random() < 0.25;
  if (isRoot) {
    return {
      id: `cube-root-${item.n}-${Date.now()}-${Math.random()}`,
      section: "cubes",
      sectionTitle: "Cubes 11\u201325",
      prompt: `\u221B${item.val}`,
      subPrompt: `Cube root of ${item.val}`,
      answer: item.n,
      rawKey: `cube-${item.n}`,
      explanation: `\u221B${item.val} = ${item.n} (since ${item.n}\xB3 = ${item.val})`
    };
  }
  return {
    id: `cube-${item.n}-${Date.now()}-${Math.random()}`,
    section: "cubes",
    sectionTitle: "Cubes 11\u201325",
    prompt: `${item.n}\xB3`,
    subPrompt: `Cube of ${item.n}`,
    answer: item.val,
    rawKey: `cube-${item.n}`,
    explanation: `${item.n}\xB3 = ${item.val}`
  };
}
function createPowerQuestion(item) {
  return {
    id: `power-${item.base}-${item.exp}-${Date.now()}-${Math.random()}`,
    section: "powers",
    sectionTitle: "Powers (2\u20139)",
    prompt: `${item.base}^${item.exp}`,
    subPrompt: `${item.base} raised to power ${item.exp}`,
    answer: item.val,
    rawKey: `power-${item.base}^${item.exp}`,
    explanation: `${item.base}^${item.exp} = ${item.val}`
  };
}
function createFactorialQuestion(item) {
  return {
    id: `factorial-${item.n}-${Date.now()}-${Math.random()}`,
    section: "factorials",
    sectionTitle: "Factorials 1\u20138",
    prompt: `${item.n}!`,
    subPrompt: `Factorial of ${item.n}`,
    answer: item.val,
    rawKey: `factorial-${item.n}`,
    explanation: `${item.n}! = ${item.breakdown} = ${item.val}`
  };
}

// src/data/drills/simplificationDrills.json
var simplificationDrills_default = [
  {
    id: "set_1_easy",
    title: "Simplification Drill Set 1 (Easy)",
    setNumber: 1,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_1_easy_q1",
        q_num: 1,
        question: "15% of 4000 + 25% of 8000 =? * 13",
        options: {
          a: "100",
          b: "200",
          c: "300",
          d: "400",
          e: "None of these"
        },
        answer: "b",
        solution: "15% of 4000 + 25% of 8000 =? * 13\n=> 600 + 2000 =? * 13\n=> 200= ?"
      },
      {
        id: "set_1_easy_q2",
        q_num: 2,
        question: "8/3 of [17\xB2 - 3\xB2 - 6\xB3] = 4/3 of (?)",
        options: {
          a: "128",
          b: "256",
          c: "64",
          d: "512",
          e: "None of these"
        },
        answer: "a",
        solution: "8/3 x (289 \u2013 9 \u2013 216) = 4/3 x (?)\n(?) = 8/3 x 3/4 x 64\n(?) = 128"
      },
      {
        id: "set_1_easy_q3",
        q_num: 3,
        question: "27 x (390 \xF7 13) \u2013 40% of 760 + 4\xB3 = (?)",
        options: {
          a: "470",
          b: "530",
          c: "570",
          d: "430",
          e: "None of these"
        },
        answer: "c",
        solution: "(?) = 27 x 30 \u2013 304 + 64\n(?) = 810 \u2013 240\n(?) = 570\n\nSimplification Questions PDF - Set 1 (Easy)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_1_easy_q4",
        q_num: 4,
        question: "20 x 16 + 46 x 43 + (3566.25 \xF7 3.75) = (?)\xB2",
        options: {
          a: "57",
          b: "47",
          c: "53",
          d: "43",
          e: "None of these"
        },
        answer: "a",
        solution: "20 x 16 + 46 x 43 + (3566.25 \xF7 3.75) = (?)\xB2\n320 + 1978 + 951 = (?)\xB2\n(?)\xB2 = 3249\n(?) = 57"
      },
      {
        id: "set_1_easy_q5",
        q_num: 5,
        question: "4 2/3 + 8 1/3 = ? \u2013 3 1/3",
        options: {
          a: "7/3",
          b: "49/3",
          c: "40/3",
          d: "32/3",
          e: "None of these"
        },
        answer: "b",
        solution: "4 2/3 + 8 1/3 = ? \u2013 3 1/3\n=> 14/3 + 25/3 + 10/3= ?\n=> 49/3= ?"
      },
      {
        id: "set_1_easy_q6",
        q_num: 6,
        question: "18 * 23 + 12 * 41= ? + 43 * 21",
        options: {
          a: "4",
          b: "5",
          c: "2",
          d: "3",
          e: "0"
        },
        answer: "d",
        solution: "18 * 23 + 12 * 41 = ? + 43 * 21\n414 + 492 = ? + 903\n? = 3"
      },
      {
        id: "set_1_easy_q7",
        q_num: 7,
        question: "40 % of 400 + 65 % of 620 \u2013 91 * 4 = ?",
        options: {
          a: "196",
          b: "197",
          c: "198",
          d: "199",
          e: "200"
        },
        answer: "d",
        solution: "40 % of 400 + 65 % of 620 \u2013 91 * 4 = ?\n160 + 403 \u2013 364 = ?\n199 = ?"
      },
      {
        id: "set_1_easy_q8",
        q_num: 8,
        question: "45 % of 180 + \u221A144 * 8 = ? 2 + 70 % of 80",
        options: {
          a: "10",
          b: "11",
          c: "12",
          d: "13",
          e: "14"
        },
        answer: "b",
        solution: "45 % of 180 + \u221A144 * 8 = ?\n2\n + 70 % of 80\n81 + 96 = ?\n2\n + 56\n? = 11"
      },
      {
        id: "set_1_easy_q9",
        q_num: 9,
        question: "420 \xF7 7 + 20 % of 140 + ? * 13 = 61 * \u221A16",
        options: {
          a: "12",
          b: "10",
          c: "13",
          d: "11",
          e: "14"
        },
        answer: "a",
        solution: "420 \xF7 7 + 20 % of 140 + ? * 13 = 61 * \u221A16\n60 + 28 + ? * 13 = 244\n? * 13 = 156\n\nSimplification Questions PDF - Set 1 (Easy)\n? = 12"
      },
      {
        id: "set_1_easy_q10",
        q_num: 10,
        question: "\u221A529 * 5 \u2013 15% of 220 + ? = 120% of 160",
        options: {
          a: "100",
          b: "110",
          c: "120",
          d: "140",
          e: "130"
        },
        answer: "b",
        solution: "\u221A529 * 5 \u2013 15% of 220 + ? = 120% of 160\n23 * 5 \u2013 33 + ? = 192\n? = 110"
      }
    ]
  },
  {
    id: "set_2_easy",
    title: "Simplification Drill Set 2 (Easy)",
    setNumber: 2,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_2_easy_q1",
        q_num: 1,
        question: "34% of 550 \xF7 ? = 297 \xF7\u221A729",
        options: {
          a: "18",
          b: "12",
          c: "29",
          d: "17",
          e: "None of these"
        },
        answer: "d",
        solution: "34% of 550 \xF7 ? = 297 \xF7\u221A729   \n187/? = 297/27\n187/? = 11\n?= 17"
      },
      {
        id: "set_2_easy_q2",
        q_num: 2,
        question: "768 \xF7 12 * \u221A256 \u2013 58 = ?",
        options: {
          a: "982",
          b: "972",
          c: "966",
          d: "912",
          e: "None of these"
        },
        answer: "c",
        solution: "768 \xF7 12 * \u221A256 \u2013 58 = ?\n64 * 16 \u2013 58 = ?\n1024 \u2013 58 = ?\n966 = ?"
      },
      {
        id: "set_2_easy_q3",
        q_num: 3,
        question: "?% of 650 \u2013 9 = 56",
        options: {
          a: "100",
          b: "10",
          c: "40",
          d: "35",
          e: "None of these"
        },
        answer: "b",
        solution: "?% of 650 \u2013 9 = 56\n\nSimplification Questions PDF - Set 2 (Easy)\n?/100 * 650 = 56+9 = 65\n?= 65*100/650\n? = 10"
      },
      {
        id: "set_2_easy_q4",
        q_num: 4,
        question: "(?\xF710) * 12 = 20% of 1320",
        options: {
          a: "270",
          b: "220",
          c: "210",
          d: "218",
          e: "None of these"
        },
        answer: "b",
        solution: "(?\xF710) * 12 = 20% of 1320\n?/10 * 12 = 2*132\n? = (2*132*10)/12\n?= 220"
      },
      {
        id: "set_2_easy_q5",
        q_num: 5,
        question: "335 * 245 \xF7 35 + 1234 =?",
        options: {
          a: "3515",
          b: "3420",
          c: "3579",
          d: "3219",
          e: "None of these"
        },
        answer: "c",
        solution: "335 * 245 \xF7 35 + 1234 =?\n2345 +1234 = ?\n3579 = ?"
      },
      {
        id: "set_2_easy_q6",
        q_num: 6,
        question: "(216% of 1000 \xF79) + 42% of 600 = ?",
        options: {
          a: "410",
          b: "432",
          c: "441",
          d: "492",
          e: "None of these"
        },
        answer: "d",
        solution: "(216% of 1000 \xF79) + 42% of 600 =?\n240 +252 = 492"
      },
      {
        id: "set_2_easy_q7",
        q_num: 7,
        question: "? +190 \u2013 19*6 = 317*2",
        options: {
          a: "564",
          b: "558",
          c: "876",
          d: "543",
          e: "None of these"
        },
        answer: "b",
        solution: "? +190 \u2013 19*6 = 317*2\n?+190 \u2013 114 = 634\n? = 558"
      },
      {
        id: "set_2_easy_q8",
        q_num: 8,
        question: "137 * 111 \u2013 11214 = ?",
        options: {
          a: "4210",
          b: "3798",
          c: "3993",
          d: "4203",
          e: "None of these"
        },
        answer: "c",
        solution: "137 * 111 \u2013 11214 =?\n15207 \u2013 11214 =  ?\n3993 = ?"
      },
      {
        id: "set_2_easy_q9",
        q_num: 9,
        question: "39*15 \u2013 28*11 = 20% of ?",
        options: {
          a: "1711",
          b: "1385",
          c: "1330",
          d: "1320",
          e: "None of these"
        },
        answer: "b",
        solution: "39*15 \u2013 28*11 = 20% of ?\n\nSimplification Questions PDF - Set 2 (Easy)\n585 \u2013 308 = 20% of?\n277 = 20/100 * ?\n1385 = ?"
      },
      {
        id: "set_2_easy_q10",
        q_num: 10,
        question: "7365 + 25 +\u221A? = 7433",
        options: {
          a: "1687",
          b: "1849",
          c: "1786",
          d: "1835",
          e: "None of these"
        },
        answer: "b",
        solution: "7365 + 25 +\u221A? = 7433\n\u221A? = 7433 \u2013 7390\n? = 43\n2\n = 1849"
      }
    ]
  },
  {
    id: "set_3_easy",
    title: "Simplification Drill Set 3 (Easy)",
    setNumber: 3,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_3_easy_q1",
        q_num: 1,
        question: "4/5 of 6/7 of 8/9 of ? = 2880",
        options: {
          a: "3460",
          b: "4725",
          c: "3280",
          d: "3180",
          e: "2890"
        },
        answer: "b",
        solution: "4/5 of 6/7 of 8/9 of ? = 2880\n? = (2880*5*7*9)/(5*6*8)\n? = 4725"
      },
      {
        id: "set_3_easy_q2",
        q_num: 2,
        question: "(1073\xF729) * (1776/48) * (407/11) = (?)3",
        options: {
          a: "37",
          b: "39",
          c: "33",
          d: "42",
          e: "29"
        },
        answer: "a",
        solution: "(1073\xF729) * (1776/48) * (407/11) = (?)\n3\n37 * 37 * 37 = ?\n3\n? = 37"
      },
      {
        id: "set_3_easy_q3",
        q_num: 3,
        question: "32.56 + 45.24 + 36.89 + 52.67 = ? 2 \u2013 1.64",
        options: {
          a: "12",
          b: "11",
          c: "15",
          d: "14",
          e: "13"
        },
        answer: "e",
        solution: "32.56 + 45.24 + 36.89 + 52.67 = ?\n2\n \u2013 1.64\n167.36 + 1.64 =?\n2\n\nSimplification Questions PDF - Set 3 (Easy)\n169 = ?\n2\n13 =?"
      },
      {
        id: "set_3_easy_q4",
        q_num: 4,
        question: "96 \xF7 6 \u2013 12 * \u221A169 = ? \u2013 15 * 8",
        options: {
          a: "-12",
          b: "-18",
          c: "-20",
          d: "-24",
          e: "-16"
        },
        answer: "c",
        solution: "96 \xF7 6 \u2013 12 * \u221A169 = ? \u2013 15 * 8\n16 \u2013 156 = ? \u2013 120\n? = -20"
      },
      {
        id: "set_3_easy_q5",
        q_num: 5,
        question: "32 % of 250 + 14 * 8 \u2013952 \xF7 17 = ?",
        options: {
          a: "128",
          b: "132",
          c: "136",
          d: "142",
          e: "146"
        },
        answer: "c",
        solution: "32 % of 250 + 14 * 8 \u2013 952 \xF7 17 = ?\n80 + 112 \u2013 56 = ?\n136 = ?"
      },
      {
        id: "set_3_easy_q6",
        q_num: 6,
        question: "\u221A13689 \xF7 13 + ? % of 320 = 131 * \u221A9",
        options: {
          a: "120",
          b: "80",
          c: "90",
          d: "140",
          e: "100"
        },
        answer: "a",
        solution: "\u221A13689 \xF7 13 + ? % of 320 = 131 * \u221A9\n9 + ? % of 320=393\n?=120"
      },
      {
        id: "set_3_easy_q7",
        q_num: 7,
        question: "1/3 * 54 + 3 * 26 + 56 * 25 \xF7 5 =?",
        options: {
          a: "348",
          b: "366",
          c: "380",
          d: "378",
          e: "376"
        },
        answer: "e",
        solution: "1/3 * 54 + 3 * 26 + 56 * 25 \xF7 5 =?\n18 + 78 + 280 =?\n376 =?"
      },
      {
        id: "set_3_easy_q8",
        q_num: 8,
        question: "\u221A7569 * 11 + 12 * 15 + \u221A4489 * 5 =?",
        options: {
          a: "1427",
          b: "1372",
          c: "1472",
          d: "1567",
          e: "2175"
        },
        answer: "c",
        solution: "\u221A7569 * 11 + 12 * 15 + \u221A4489 * 5 =?\n87 * 11 + 12 * 15 + 67 * 5 =?\n957 + 180 + 335 = 1472"
      },
      {
        id: "set_3_easy_q9",
        q_num: 9,
        question: "135 \xF7 5 + 15 \xD7 18 + 12 % of 50 =? - 17",
        options: {
          a: "360",
          b: "280",
          c: "320",
          d: "450",
          e: "None of these"
        },
        answer: "c",
        solution: "135 \xF7 5 + 15 \xD7 18 + 12 % of 50 = x - 17\n(135 / 5) + (15 * 18) + (12 / 100) * 50 + 17 = x\n\nSimplification Questions PDF - Set 3 (Easy)\nx = 27 + 270 + 6 + 17 = 320"
      },
      {
        id: "set_3_easy_q10",
        q_num: 10,
        question: "380+620-190%of820=?-120*\u221A25",
        options: {
          a: "42",
          b: "45",
          c: "47",
          d: "48",
          e: "None of these"
        },
        answer: "a",
        solution: "380+620-190%of820=?-120*\u221A25\n380+620-1558=?-600\n42=?"
      }
    ]
  },
  {
    id: "set_5_easy",
    title: "Simplification Drill Set 5 (Easy)",
    setNumber: 5,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_5_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. 168 \xF7 3 \xF7 \u221A16 * ? = 1400 \xF7 4",
        options: {
          a: "42",
          b: "28",
          c: "16",
          d: "40",
          e: "25"
        },
        answer: "e",
        solution: "168 \xF7 3 \xF7 \u221A16 * ? = 1400 \xF7 4\n56 \xF7 4 * ? = 350\n? = 350 \xF7 14\n? = 25"
      },
      {
        id: "set_5_easy_q2",
        q_num: 2,
        question: "?\u2013 54= 24 \xF7 13 * 65 - 144",
        options: {
          a: "30",
          b: "72",
          c: "48",
          d: "54",
          e: "65"
        },
        answer: "a",
        solution: "? \u2013 54 = 24 \xF7 13 * 65 \u2013 144\n? \u2013 54 = 24 * 5 \u2013 144\n? = 120 \u2013 144 + 54\n? = 30"
      },
      {
        id: "set_5_easy_q3",
        q_num: 3,
        question: "35% of 400 = ? 2 \u2013 17% of 500",
        options: {
          a: "10",
          b: "18",
          c: "17",
          d: "15",
          e: "12"
        },
        answer: "d",
        solution: "35% of 400 = ?\n2\n \u2013 17% of 500\n\nSimplification Questions PDF - Set 5 (Easy)\n35 * 400/100 = ?\n2\n \u2013 17 * 500/100\n?\n2\n = 140 + 85\n? = \u221A225\n? = 15"
      },
      {
        id: "set_5_easy_q4",
        q_num: 4,
        question: "245 + 110 - 12 2 = ? + 163",
        options: {
          a: "91",
          b: "48",
          c: "52",
          d: "76",
          e: "84"
        },
        answer: "b",
        solution: "245 + 110 - 12\n2 \n= ? + 163\n? = 355 \u2013 144 \u2013 163\n? = 48"
      },
      {
        id: "set_5_easy_q5",
        q_num: 5,
        question: "165 \xF7 \u221A121 + 20 * 8 - \u221A? = 159",
        options: {
          a: "144",
          b: "256",
          c: "100",
          d: "81",
          e: "196"
        },
        answer: "b",
        solution: "165 \xF7 \u221A121 + 20 * 8 - \u221A? = 159\n165 \xF7 11 + 160 - \u221A? = 159\n\u221A? = 15 + 160 \u2013 159\n\u221A? = 16\n? = 256"
      },
      {
        id: "set_5_easy_q6",
        q_num: 6,
        question: "25% of 840 =? +300 \xF7 4 +25",
        options: {
          a: "150",
          b: "210",
          c: "170",
          d: "110",
          e: "250"
        },
        answer: "d",
        solution: "25% of 840 =? + 300 \xF7 4 + 25\n210 = ? + 75 + 25\n? = 210 \u2013 100\n? = 110"
      },
      {
        id: "set_5_easy_q7",
        q_num: 7,
        question: "\u221A(52 + \u221A(16 * 9)) * ? = 512",
        options: {
          a: "64",
          b: "36",
          c: "72",
          d: "56",
          e: "44"
        },
        answer: "a",
        solution: "\u221A(52 + \u221A(16 * 9)) * ? = 512\n\u221A(52 + 4 * 3) * ? = 512\n\u221A64 * ? = 512\n? = 512 \xF7 8\n? = 64"
      },
      {
        id: "set_5_easy_q8",
        q_num: 8,
        question: "\u221A81 + ? - \u221A361 = \u221A900 + \u221A100",
        options: {
          a: "20",
          b: "50",
          c: "10",
          d: "30",
          e: "40"
        },
        answer: "b",
        solution: "\u221A81 + ? - \u221A361 = \u221A900 + \u221A100\n9 + ? \u2013 19 = 30 + 10\n? = 40 + 19 \u2013 9\n? = 50"
      },
      {
        id: "set_5_easy_q9",
        q_num: 9,
        question: "(15 * 4 + 80 + 25) \xF7 11 = ?",
        options: {
          a: "12",
          b: "18",
          c: "11",
          d: "15",
          e: "10"
        },
        answer: "d",
        solution: "(15 * 4 + 80 + 25) \xF7 11 = ?\n(60 + 105) \xF7 11 = ?\n? = 165 \xF7 11\n? = 15"
      },
      {
        id: "set_5_easy_q10",
        q_num: 10,
        question: "37.5% of 480 + 45.5% of 400 = ?",
        options: {
          a: "174",
          b: "236",
          c: "362",
          d: "185",
          e: "208"
        },
        answer: "c",
        solution: "37.5% of 480 + 45.5% of 400 = ?\n37.5 * 480/100 + 45.5 * 400/100 = ?\n3/8 * 480 + 45.5 * 4 = ?\n? = 180 + 182\n? = 362"
      }
    ]
  },
  {
    id: "set_7_easy",
    title: "Simplification Drill Set 7 (Easy)",
    setNumber: 7,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_7_easy_q1",
        q_num: 1,
        question: "24 2 \u2013 19 2 = ? * 12 \u2013 17 2",
        options: {
          a: "49",
          b: "45",
          c: "41",
          d: "42",
          e: "44"
        },
        answer: "d",
        solution: "24\n2\n \u2013 19\n2\n = ? * 12 \u2013 17\n2\n576 \u2013 361 = ? * 12 \u2013 289\n? = 42"
      },
      {
        id: "set_7_easy_q2",
        q_num: 2,
        question: "78312 \u2013 5831 + 3814 \u2013 14321 +? = 66355",
        options: {
          a: "4831",
          b: "4183",
          c: "4138",
          d: "4318",
          e: "None of these"
        },
        answer: "e",
        solution: "78312 \u2013 5831 + 3814 \u2013 14321 +? = 66355\n? = 4381"
      },
      {
        id: "set_7_easy_q3",
        q_num: 3,
        question: "45% of 360 + 120% of 90 = ?",
        options: {
          a: "240",
          b: "250",
          c: "270",
          d: "230",
          e: "210"
        },
        answer: "c",
        solution: "45% of 360 + 120% of 90 = ?\n162 + 108 = ?\n? = 270"
      },
      {
        id: "set_7_easy_q4",
        q_num: 4,
        question: "\u221A4489 + \u221A169 +? = 19 * 24",
        options: {
          a: "328",
          b: "359",
          c: "364",
          d: "376",
          e: "386"
        },
        answer: "d",
        solution: "\u221A4489 + \u221A169 +? = 19 * 24\n67 + 13 +? = 456\n? = 376"
      },
      {
        id: "set_7_easy_q5",
        q_num: 5,
        question: "?% of (584.2 \u2013 244.2) = (9) 2 + 21",
        options: {
          a: "40",
          b: "45",
          c: "30",
          d: "60",
          e: "50"
        },
        answer: "c",
        solution: "? % of (584.2 \u2013 244.2) = 9\n2\n + 21\n(?x340)/100 =81+21=102\n? = (102\xD7100)/340 = 30"
      },
      {
        id: "set_7_easy_q6",
        q_num: 6,
        question: "58% of 850 + ?= 1224 \u2014603",
        options: {
          a: "128",
          b: "130",
          c: "138",
          d: "140",
          e: "None of these"
        },
        answer: "a",
        solution: "58% of 850 + ? = 1224 \u2013 603\n? = 1224 \u2013 603 \u2013 (58/100) \xD7 850 = 621 \u2013 493 = 128"
      },
      {
        id: "set_7_easy_q7",
        q_num: 7,
        question: "3/8 of 168 x 15 \xF7 5 + ? = 549 \xF7 9 + 235",
        options: {
          a: "189",
          b: "107",
          c: "174",
          d: "296",
          e: "326"
        },
        answer: "b",
        solution: "3/8 of 168 x 15 \xF7 5 + ? = 549 \xF7 9 + 235\n= 3/8 x 168 x15 x 1/5 + ? = 549 x 1/9 + 235\n= 3 x 21 x 3 + ? = 61 + 235\n= 296 \u2013 189 = 107"
      },
      {
        id: "set_7_easy_q8",
        q_num: 8,
        question: "767 \xF7 13 + 357 \xF7 \u221A289 =? * \u221A16",
        options: {
          a: "10",
          b: "15",
          c: "20",
          d: "25",
          e: "30"
        },
        answer: "c",
        solution: "767 \xF7 13 + 357 \xF7 \u221A289 =? * \u221A16\n59 + 21 =? * 4\n? = 20"
      },
      {
        id: "set_7_easy_q9",
        q_num: 9,
        question: "22 * 18 \u2013 23 * 13 = ? \xF7 4",
        options: {
          a: "388",
          b: "392",
          c: "396",
          d: "386",
          e: "384"
        },
        answer: "a",
        solution: "22 * 18 \u2013 23 * 13 = ? \xF7 4\n97 * 4 = ?\n? = 388"
      },
      {
        id: "set_7_easy_q10",
        q_num: 10,
        question: "12 * 21 \xF7 48 * 96 + 33 * 8 \xF7 22 =?",
        options: {
          a: "516",
          b: "512",
          c: "518",
          d: "561",
          e: "None of these"
        },
        answer: "a",
        solution: "Simplification Questions PDF - Set 7 (Easy)\n12 * 21 \xF7 48 * 96 + 33 * 8 \xF7 22 =?\n504 + 12 = 516"
      }
    ]
  },
  {
    id: "set_9_easy",
    title: "Simplification Drill Set 9 (Easy)",
    setNumber: 9,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_9_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. 181 + 359 - ? 2 = 20 * 7",
        options: {
          a: "11",
          b: "25",
          c: "17",
          d: "20",
          e: "13"
        },
        answer: "d",
        solution: "181 + 359 - ?\n2\n = 20 * 7\n181 + 359 - ?\n2\n = 140\n?\n2\n = 540 \u2013 140\n?\n2\n = 400\n?\n2\n = 20\n2\n? = 20"
      },
      {
        id: "set_9_easy_q2",
        q_num: 2,
        question: "\u221A1600 + \u221A625 - 3 \u221A? = 120 \xF7 2",
        options: {
          a: "125",
          b: "64",
          c: "216",
          d: "343",
          e: "27"
        },
        answer: "a",
        solution: "\u221A1600 + \u221A625 - \n3\n\u221A? = 120 \xF7 2\n40 + 25 - \n3\n\u221A? = 60\n3\n\u221A? = 65 \u2013 60\n\nSimplification Questions PDF - Set 9 (Easy)\n3\n\u221A? = 5\n? = 125"
      },
      {
        id: "set_9_easy_q3",
        q_num: 3,
        question: "25% of ? + 120 = 40% of 500",
        options: {
          a: "360",
          b: "400",
          c: "240",
          d: "140",
          e: "320"
        },
        answer: "e",
        solution: "25% of ? + 120 = 40% of 500\n25 * ?/100 + 120 = 40 * 500/100\n?/4 + 120 = 200\n?/4 = 200 \u2013 120\n? = 80 * 4\n? = 320"
      },
      {
        id: "set_9_easy_q4",
        q_num: 4,
        question: "\u221A(109 + ? + 76)= 75 \xF7 5",
        options: {
          a: "27",
          b: "33",
          c: "48",
          d: "21",
          e: "40"
        },
        answer: "e",
        solution: "\u221A(109 + ? + 76) = 75 \xF7 5\n\u221A(109 + ? + 76) = 15\n185 + ? = 225\n? = 225 \u2013 185\n? = 40"
      },
      {
        id: "set_9_easy_q5",
        q_num: 5,
        question: "216 \xF7 \u221A36 + 94+ ? = 170",
        options: {
          a: "40",
          b: "25",
          c: "70",
          d: "65",
          e: "90"
        },
        answer: "a",
        solution: "216 \xF7 \u221A36 + 94 + ? = 170\n216 \xF7 6 + 94 + ? = 170\n36 + 94 + ? = 170\n? = 170 \u2013 130\n? = 40"
      },
      {
        id: "set_9_easy_q6",
        q_num: 6,
        question: "14 * 11 + 16 2 = ? 2 + 310",
        options: {
          a: "25",
          b: "10",
          c: "30",
          d: "15",
          e: "20"
        },
        answer: "b",
        solution: "14 * 11 + 16\n2\n= ?\n2\n + 310\n154 + 256 = ?\n2\n + 310\n?\n2\n = 410 \u2013 310\n?\n2\n = 100\n\nSimplification Questions PDF - Set 9 (Easy)\n?\n2\n = 10\n2\n? = 10"
      },
      {
        id: "set_9_easy_q7",
        q_num: 7,
        question: "1400 \u2013 750 - ? =25 * 20",
        options: {
          a: "120",
          b: "170",
          c: "110",
          d: "100",
          e: "150"
        },
        answer: "e",
        solution: "1400 \u2013 750 - ? = 25 * 20\n650 - ? = 500\n? = 150"
      },
      {
        id: "set_9_easy_q8",
        q_num: 8,
        question: "220 \xF7 2 \xF7 11 * ? = 210 \xF7 7 * 5",
        options: {
          a: "11",
          b: "10",
          c: "20",
          d: "15",
          e: "11"
        },
        answer: "d",
        solution: "220 \xF7 2 \xF7 11 * ? = 210 \xF7 7 * 5\n10 * ? = 30 * 5\n? = 150/10\n? = 15"
      },
      {
        id: "set_9_easy_q9",
        q_num: 9,
        question: "15 * 4 \xF7 8 * 120 = ? * \u221A81",
        options: {
          a: "80",
          b: "90",
          c: "100",
          d: "120",
          e: "110"
        },
        answer: "c",
        solution: "15 * 4 \xF7 8 * 120 = ? * \u221A81\n60/8 * 120 = ? * 9\n? = 100"
      },
      {
        id: "set_9_easy_q10",
        q_num: 10,
        question: "(1452 \xF7 4 \xF7 3) \xF7 11 = ? \xF7 5",
        options: {
          a: "35",
          b: "45",
          c: "55",
          d: "60",
          e: "25"
        },
        answer: "c",
        solution: "(1452 \xF7 4 \xF7 3) \xF7 11 = ? \xF7 5\n121/11 = ? /5\n? = 55"
      }
    ]
  },
  {
    id: "set_10_easy",
    title: "Simplification Drill Set 10 (Easy)",
    setNumber: 10,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_10_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. 3(2/5) + 4(4/5) + 8(1/3) = ?",
        options: {
          a: "18(8/15)",
          b: "17(8/15)",
          c: "15(8/15)",
          d: "14(8/15)",
          e: "16(8/15)"
        },
        answer: "e",
        solution: "3(2/5) + 4(4/5) + 8(1/3) = ?\n(3 + 4 + 8)(2/5 + 4/5 + 1/3) = ?\n15(23/15) = ?\n16(8/15) = ?"
      },
      {
        id: "set_10_easy_q2",
        q_num: 2,
        question: "178 * 12 \xF7 \u221A576 - \u221A841 = ? * 3",
        options: {
          a: "10",
          b: "15",
          c: "20",
          d: "25",
          e: "30"
        },
        answer: "c",
        solution: "178 * 12 \xF7 \u221A576 - \u221A841 = ? * 3\n178 * 12/24 \u2013 29 = ? * 3\n? = 20"
      },
      {
        id: "set_10_easy_q3",
        q_num: 3,
        question: "(1/4) * 3040 \u2013 (2/5) * ? = 140 * 4",
        options: {
          a: "450",
          b: "480",
          c: "500",
          d: "520",
          e: "540"
        },
        answer: "c",
        solution: "(1/4) * 3040 \u2013 (2/5) * ? = 140 * 4\n760 \u2013 560 = ? * 2/5\n\nSimplification Questions PDF - Set 10 (Easy)\n? = 500"
      },
      {
        id: "set_10_easy_q4",
        q_num: 4,
        question: "4(3/7) of 126 \u2013 1(5/6) of 198 = ?",
        options: {
          a: "187",
          b: "195",
          c: "212",
          d: "178",
          e: "185"
        },
        answer: "b",
        solution: "4(3/7) of 126 \u2013 1(5/6) of 198 = ?\n31 * 18 \u2013 11 * 33 = ?\n? = 195"
      },
      {
        id: "set_10_easy_q5",
        q_num: 5,
        question: "(294 \u2013 55% of 180) \xF7 13 = ? - \u221A324",
        options: {
          a: "31",
          b: "33",
          c: "35",
          d: "37",
          e: "28"
        },
        answer: "b",
        solution: "(294 \u2013 55% of 180) \xF7 13 = ? - \u221A324\n294 \u2013 99/13 = ? \u2013 18\n? = 33"
      },
      {
        id: "set_10_easy_q6",
        q_num: 6,
        question: "74% of 250 \u2013 145 = ? + 13 * 3",
        options: {
          a: "0",
          b: "4",
          c: "5",
          d: "1",
          e: "3"
        },
        answer: "d",
        solution: "74% of 250 \u2013 145 = ? + 13 * 3\n185 \u2013 145 = ? + 39\n? = 1"
      },
      {
        id: "set_10_easy_q7",
        q_num: 7,
        question: "(28 2 \u2013 19 * 21) \xF7 11 = ? * 7",
        options: {
          a: "4",
          b: "10",
          c: "5",
          d: "8",
          e: "7"
        },
        answer: "c",
        solution: "(28\n2\n \u2013 19 * 21) \xF7 11 = ? * 7\n385/11 = ? * 7\n? = 5"
      },
      {
        id: "set_10_easy_q8",
        q_num: 8,
        question: "14 2 + 37 2 - \u221A4225 = ? * 25",
        options: {
          a: "40",
          b: "50",
          c: "80",
          d: "100",
          e: "60"
        },
        answer: "e",
        solution: "14\n2\n + 37\n2\n - \u221A4225 = ? * 25\n196 + 1369 \u2013 65 = ? * 25\n? = 60"
      },
      {
        id: "set_10_easy_q9",
        q_num: 9,
        question: "(38 * 23 + 19 * 38) \xF7 12 = ?",
        options: {
          a: "133",
          b: "128",
          c: "125",
          d: "138",
          e: "141"
        },
        answer: "a",
        solution: "(38 * 23 + 19 * 38) \xF7 12 = ?\n38 * (23 + 19)/12 = ?\n? = 133\n\nSimplification Questions PDF - Set 10 (Easy)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_10_easy_q10",
        q_num: 10,
        question: "(11 2 + (17 * 3)) * ? = 43 * 12",
        options: {
          a: "1",
          b: "4",
          c: "2",
          d: "3",
          e: "5"
        },
        answer: "d",
        solution: "(11\n2\n + (17 * 3)) * ? = 43 * 12\n172 * ? = 43 * 12\n? = 3"
      }
    ]
  },
  {
    id: "set_11_easy",
    title: "Simplification Drill Set 11 (Easy)",
    setNumber: 11,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_11_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. 120 * 6 \u221A(729) + \u221A484 * 12 = ? * 8",
        options: {
          a: "78",
          b: "82",
          c: "75",
          d: "88",
          e: "84"
        },
        answer: "a",
        solution: "120 * \n6\n\u221A(729) + \u221A484 * 12 = ? * 8\n624 = ? * 8\n? = 78"
      },
      {
        id: "set_11_easy_q2",
        q_num: 2,
        question: "\u221A1764 * \u221A676 \xF7 13 + \u221A2209 * 3 = ? 2",
        options: {
          a: "13",
          b: "15",
          c: "17",
          d: "9",
          e: "11"
        },
        answer: "b",
        solution: "\u221A1764 * \u221A676 \xF7 13 + \u221A2209 * 3 = ?\n2\n  \n42 * 26/13 + 141 = ?\n2\n  \n? = 15"
      },
      {
        id: "set_11_easy_q3",
        q_num: 3,
        question: "13 2 * 9 2 \xF7 \u221A1521 \u2013 15 2 = ?",
        options: {
          a: "118",
          b: "124",
          c: "120",
          d: "128",
          e: "126"
        },
        answer: "e",
        solution: "13\n2\n * 9\n2\n \xF7 \u221A1521 \u2013 15\n2\n = ?\n13 * 13 * 9 * 9/39 \u2013 225 = ?\n\nSimplification Questions PDF - Set 11 (Easy)\n? = 126"
      },
      {
        id: "set_11_easy_q4",
        q_num: 4,
        question: "12.5 * 10 + 225 * 4 \u2013 47 * 16 = ? * 7",
        options: {
          a: "39",
          b: "42",
          c: "45",
          d: "48",
          e: "51"
        },
        answer: "a",
        solution: "12.5 * 10 + 225 * 4 \u2013 47 * 16 = ? * 7\n125 + 900 \u2013 752 = ? * 7\n? = 39"
      },
      {
        id: "set_11_easy_q5",
        q_num: 5,
        question: "(93 \xF7 268) * (67 \xF7 465) * ? = \u221A25",
        options: {
          a: "120",
          b: "90",
          c: "80",
          d: "100",
          e: "110"
        },
        answer: "d",
        solution: "(93 \xF7 268) * (67 \xF7 465) * ? = \u221A25\n1/4 * 1/5 * ? = 5\n? = 100"
      },
      {
        id: "set_11_easy_q6",
        q_num: 6,
        question: "15 * \u221A676 \u2013 (\u221A900 * 76) \xF7 19 = ?",
        options: {
          a: "270",
          b: "250",
          c: "240",
          d: "280",
          e: "220"
        },
        answer: "a",
        solution: "15 * \u221A676 \u2013 (\u221A900 * 76) \xF7 19 = ?\n390 - 120 = ?\n? = 270"
      },
      {
        id: "set_11_easy_q7",
        q_num: 7,
        question: "18 * 23 + 12 * 41 = ? + 43 * 21",
        options: {
          a: "4",
          b: "5",
          c: "2",
          d: "3",
          e: "0"
        },
        answer: "d",
        solution: "18 * 23 + 12 * 41 = ? + 43 * 21\n414 + 492 = ? + 903\n? = 3"
      },
      {
        id: "set_11_easy_q8",
        q_num: 8,
        question: "4500 \xF7 9 \u2013 5837 \xF7 13 = ?",
        options: {
          a: "51",
          b: "59",
          c: "61",
          d: "67",
          e: "64"
        },
        answer: "a",
        solution: "4500 \xF7 9 \u2013 5837 \xF7 13 = ?\n500 \u2013 449 = ?\n? = 51"
      },
      {
        id: "set_11_easy_q9",
        q_num: 9,
        question: "\u221A529 + \u221A144 + \u221A1600 = ? * 15",
        options: {
          a: "6",
          b: "5",
          c: "4",
          d: "7",
          e: "3"
        },
        answer: "b",
        solution: "\u221A529 + \u221A144 + \u221A1600 = ? * 15\n23 + 12 + 40 = ? * 15\n? = 5\n\nSimplification Questions PDF - Set 11 (Easy)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_11_easy_q10",
        q_num: 10,
        question: "80% of 550 + 75% of 360 = ? * 5",
        options: {
          a: "156",
          b: "138",
          c: "186",
          d: "142",
          e: "172"
        },
        answer: "d",
        solution: "80% of 550 + 75% of 360 = ?\n \n* 5\n440 + 270 = ? * 5\n? = 142"
      }
    ]
  },
  {
    id: "set_12_easy",
    title: "Simplification Drill Set 12 (Easy)",
    setNumber: 12,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_12_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. \u221A289 * 15 \u2013 3876 \xF7 \u221A361 = ? * 3",
        options: {
          a: "17",
          b: "19",
          c: "23",
          d: "15",
          e: "12"
        },
        answer: "a",
        solution: "\u221A289 * 15 \u2013 3876 \xF7 \u221A361 = ? * 3\n17 * 15 \u2013 204 = ? * 3\n? = 17"
      },
      {
        id: "set_12_easy_q2",
        q_num: 2,
        question: "43 * 18 \u2013 21 * 23 = ? + 191",
        options: {
          a: "120",
          b: "100",
          c: "140",
          d: "150",
          e: "180"
        },
        answer: "b",
        solution: "43 * 18 \u2013 21 * 23 = ? + 191\n774 \u2013 483 = ? + 191\n? = 100"
      },
      {
        id: "set_12_easy_q3",
        q_num: 3,
        question: "75% of 280 \u2013 65% of 180 = ?",
        options: {
          a: "93",
          b: "96",
          c: "88",
          d: "80",
          e: "84"
        },
        answer: "a",
        solution: "75% of 280 \u2013 65% of 180 = ?\n? = 93"
      },
      {
        id: "set_12_easy_q4",
        q_num: 4,
        question: "1656 \xF7 \u221A529 \u2013 \u221A5041 = ? - \u221A576",
        options: {
          a: "29",
          b: "27",
          c: "26",
          d: "25",
          e: "28"
        },
        answer: "d",
        solution: "1656 \xF7 \u221A529 \u2013 \u221A5041 = ? - \u221A576\n? \u2013 24 = 72 \u2013 71\n? = 25"
      },
      {
        id: "set_12_easy_q5",
        q_num: 5,
        question: "5481 \xF7 \u221A729 + 589 \xF7 \u221A961 = ?",
        options: {
          a: "210",
          b: "212",
          c: "234",
          d: "222",
          e: "228"
        },
        answer: "d",
        solution: "5481 \xF7 \u221A729 + 589 \xF7 \u221A961 = ?\n203 + 19 = ?\n? = 222"
      },
      {
        id: "set_12_easy_q6",
        q_num: 6,
        question: "\u221A(45 + 5 3 - 70) \xF7 ? * 30 = 80 \xF7 4",
        options: {
          a: "20",
          b: "10",
          c: "30",
          d: "25",
          e: "15"
        },
        answer: "e",
        solution: "\u221A(45 + 5\n3\n - 70) \xF7 ? * 30 = 80 \xF7 4\n\u221A(45 + 125 - 70) \xF7 ? * 30 = 20\n\u221A100 * 30 \xF7 20 = ?\n? = 15"
      },
      {
        id: "set_12_easy_q7",
        q_num: 7,
        question: "3(1/4) + 1(1/8) + ? = 5(1/4) + 1(1/8)",
        options: {
          a: "5",
          b: "2",
          c: "3",
          d: "1",
          e: "4"
        },
        answer: "b",
        solution: "3(1/4) + 1(1/8) + ? = 5(1/4) + 1(1/8)\n13/4 + 9/8 + ? = 21/4 + 9/8\n? = 42/8 + 9/8 \u2013 26/8 \u2013 9/8\n? = 16/8\n? = 2"
      },
      {
        id: "set_12_easy_q8",
        q_num: 8,
        question: "22 2 + 32 2 \u2013 508 = ? * 5",
        options: {
          a: "200",
          b: "250",
          c: "220",
          d: "180",
          e: "210"
        },
        answer: "a",
        solution: "22\n2\n + 32\n2\n \u2013 508 = ? * 5\n484 + 1024 \u2013 508 = ? * 5\n1000 = ? * 5\n? = 200"
      },
      {
        id: "set_12_easy_q9",
        q_num: 9,
        question: "? \xF7 7 = \u221A(306 - \u221A100 + 280) \xF7 2",
        options: {
          a: "64",
          b: "45",
          c: "71",
          d: "84",
          e: "52"
        },
        answer: "d",
        solution: "? \xF7 7 = \u221A(306 - \u221A100 + 280) \xF7 2\n\nSimplification Questions PDF - Set 12 (Easy)\n? \xF7 7 = \u221A(306 \u2013 10 + 280) \xF7 2\n? \xF7 7 = \u221A576 \xF7 2\n? = 24 \xF7 2 * 7\n? = 12 * 7\n? = 84"
      },
      {
        id: "set_12_easy_q10",
        q_num: 10,
        question: "16 * 15 \xF7 8 \xF7 3 = ? \xF7 2",
        options: {
          a: "16",
          b: "40",
          c: "30",
          d: "20",
          e: "15"
        },
        answer: "d",
        solution: "16 * 15 \xF7 8 \xF7 3 = ? \xF7 2\n10 = ? \xF7 2\n? = 20"
      }
    ]
  },
  {
    id: "set_13_easy",
    title: "Simplification Drill Set 13 (Easy)",
    setNumber: 13,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_13_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. 980 \xF7 4.9 + 6000 \xF7 \u221A900 = ? 2",
        options: {
          a: "20",
          b: "30",
          c: "15",
          d: "18",
          e: "12"
        },
        answer: "a",
        solution: "980 \xF7 4.9 + 6000 \xF7 \u221A900 = ?\n2\n200 + 6000 \xF7 30 = ?\n2\n200 + 200 = ?\n2\n?\n2\n = 400\n? = 20"
      },
      {
        id: "set_13_easy_q2",
        q_num: 2,
        question: "4/9 of 198 + 5/7 of 140 = ? * 2",
        options: {
          a: "84",
          b: "99",
          c: "95",
          d: "90",
          e: "94"
        },
        answer: "e",
        solution: "4/9 * 198 + 5/7 * 140 = ? * 2\n88 + 100 = ? * 2\n188 = ? * 2\n? = 94"
      },
      {
        id: "set_13_easy_q3",
        q_num: 3,
        question: "12.05% of 400 + 120 \xF7 4 - ? = 50",
        options: {
          a: "28.2",
          b: "16.2",
          c: "20.2",
          d: "32.2",
          e: "15.2"
        },
        answer: "a",
        solution: "12.05% of 400 + 120 \xF7 4 - ? = 50\n12.05 * 400/100 + 30 - ? = 50\n? = 48.2 + 30 \u2013 50\n? = 28.2"
      },
      {
        id: "set_13_easy_q4",
        q_num: 4,
        question: "2(1/5) + 1(1/10) + ? = 3(1/5) + 4(1/5)",
        options: {
          a: "4(1/5)",
          b: "2(1/10)",
          c: "3(1/10)",
          d: "4(1/10)",
          e: "2(1/5)"
        },
        answer: "d",
        solution: "2(1/5) + 1(1/10) + ? = 3(1/5) + 4(1/5)\n2(2/10) + 1(1/10) + ? = 3(2/10) + 4(2/10)\n3(3/10) + ? = 7(4/10)\n? = 4(1/10)"
      },
      {
        id: "set_13_easy_q5",
        q_num: 5,
        question: "\u221A(70 + 20 2 + 155) \xF7 5 ? = 5",
        options: {
          a: "5",
          b: "4",
          c: "1",
          d: "3",
          e: "2"
        },
        answer: "c",
        solution: "\u221A(70 + 20\n2\n + 155) \xF7 5\n?\n = 5\n\u221A(70 + 400 + 155) \xF7 5\n?\n = 5\n\u221A625 \xF7 5\n?\n = 5\n5\n?\n = 5\n2-1\n5\n?\n = 5\n1"
      },
      {
        id: "set_13_easy_q6",
        q_num: 6,
        question: "15 * 12 + 75 \u2013 21 * 5 = ? - 330",
        options: {
          a: "370",
          b: "190",
          c: "480",
          d: "250",
          e: "310"
        },
        answer: "c",
        solution: "15 * 12 + 75 \u2013 21 * 5 = ?\u2013 330\n? = 180 + 75 \u2013 105 + 330\n? = 480"
      },
      {
        id: "set_13_easy_q7",
        q_num: 7,
        question: "350 \xF7\u221A49 + ? \u2013 110 = 750 \xF7 5",
        options: {
          a: "190",
          b: "210",
          c: "170",
          d: "310",
          e: "150"
        },
        answer: "b",
        solution: "350 \xF749 +? \u2013 110 = 750 \xF7 5\n350 \xF7 7 +? \u2013 110 = 150\n50 +? = 150 + 110\n? = 260 \u2013 50\n? = 210\n\nSimplification Questions PDF - Set 13 (Easy)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_13_easy_q8",
        q_num: 8,
        question: "(125 + 15 * 12 + 300 \xF7 4)\xF7 19= ?",
        options: {
          a: "60",
          b: "36",
          c: "20",
          d: "51",
          e: "42"
        },
        answer: "c",
        solution: "(125 + 15 * 12 + 300 \xF7 4) \xF7 19= ?\n(125 + 180 + 75) \xF7 19 = ?\n? = 380 \xF7 19\n? = 20"
      },
      {
        id: "set_13_easy_q9",
        q_num: 9,
        question: "? +\u221A(750 + 10 2 + \u221A2500) = 45",
        options: {
          a: "18",
          b: "32",
          c: "40",
          d: "15",
          e: "21"
        },
        answer: "d",
        solution: "? + \u221A(750 + 100 + 2500) = 45\n? + \u221A(850 + 50) = 45\n? + \u221A900 = 45\n? = 45 \u2013 30\n? = 15"
      },
      {
        id: "set_13_easy_q10",
        q_num: 10,
        question: "1/6 + 2/3 + 1/4 \u2013 5/12 = ?",
        options: {
          a: "1/12",
          b: "3/12",
          c: "2/3",
          d: "1/6",
          e: "1/4"
        },
        answer: "c",
        solution: "1/6 + 2/3 + 1/4 \u2013 5/12 = ?\n2/12 + 8/12 + 3/12 \u2013 5/12 = ?\n13/12 \u2013 5/12 = ?\n? = 8/12\n? = 2/3"
      }
    ]
  },
  {
    id: "set_14_easy",
    title: "Simplification Drill Set 14 (Easy)",
    setNumber: 14,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_14_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. 1300 \xF7 26 + 11 * 15 - \u221A1089 = ?",
        options: {
          a: "127",
          b: "138",
          c: "146",
          d: "115",
          e: "182"
        },
        answer: "e",
        solution: "1300 \xF7 26 + 11 * 15 - 1089 = ?\n50 + 165 \u2013 33 = ?\n? = 182"
      },
      {
        id: "set_14_easy_q2",
        q_num: 2,
        question: "720 - \u221B1000 = ? 3 - 209 \xF7 11",
        options: {
          a: "9",
          b: "7",
          c: "8",
          d: "5",
          e: "10"
        },
        answer: "a",
        solution: "720 - \u221B1000 = ?\n3\n - 209 \xF7 11\n720 \u2013 10 + 19 = ?\n3\n?\n3\n = 729\n?\n3\n = 9\n3\n? = 9"
      },
      {
        id: "set_14_easy_q3",
        q_num: 3,
        question: "12.5% of 480 + \u221A? = 630 \xF7 9",
        options: {
          a: "625",
          b: "100",
          c: "324",
          d: "225",
          e: "144"
        },
        answer: "b",
        solution: "Simplification Questions PDF - Set 14 (Easy)\n12.5% of 480 + \u221A? = 630 \xF7 9\n1/8 * 480 + \u221A? = 70\n60 + \u221A? = 70\n\u221A? = 10\n? = 100"
      },
      {
        id: "set_14_easy_q4",
        q_num: 4,
        question: "\u221A(180 \u201315 * 6 + 54) \xF7 3 = 2 ?",
        options: {
          a: "4",
          b: "1",
          c: "2",
          d: "3",
          e: "5"
        },
        answer: "c",
        solution: "\u221A(180 \u2013 15 * 6 + 54) \xF7 3 = 2\n?\n2\n?\n = \u221A(180 \u2013 90 + 54) \xF7 3\n2\n?\n = \u221A144 \xF7 3\n2\n?\n = 12 \xF7 3\n2\n?\n = 4\n2\n?\n = 2\n2\n? = 2"
      },
      {
        id: "set_14_easy_q5",
        q_num: 5,
        question: "1720 \u201332 * 25 - ? * 4 = \u221A1600",
        options: {
          a: "170",
          b: "200",
          c: "220",
          d: "100",
          e: "140"
        },
        answer: "c",
        solution: "1720 \u2013 32 * 25 - ? * 4 = \u221A1600\n1720 \u2013 800 - ? * 4 = 40\n? * 4 = 920 \u2013 40\n? = 880/4\n? = 220"
      },
      {
        id: "set_14_easy_q6",
        q_num: 6,
        question: "\u221A(13 2 + 604 + \u221B1331) \xF7 7 = 2 ?",
        options: {
          a: "2",
          b: "4",
          c: "1",
          d: "3",
          e: "5"
        },
        answer: "a",
        solution: "\u221A(13\n2\n + 604 + \u221B1331) \xF7 7 = 2\n?\n\u221A(169 + 604 + 11) \xF7 7 = 2\n?\n\u221A784 \xF7 7 = 2\n?\n28 \xF7 7 = 2\n?\n2\n?\n = 2\n2\n\nSimplification Questions PDF - Set 14 (Easy)\n? = 2"
      },
      {
        id: "set_14_easy_q7",
        q_num: 7,
        question: "1040 \xF7 65 * 1500 \xF7 12 = ? * 50 \xF7 2",
        options: {
          a: "25",
          b: "90",
          c: "65",
          d: "75",
          e: "80"
        },
        answer: "e",
        solution: "1040 \xF7 65 * 1500 \xF7 12 = ? * 50 \xF7 2\n16 * 500 \xF7 4 = ? * 25\n4 * 500 \xF7 25 = ?\n? = 80"
      },
      {
        id: "set_14_easy_q8",
        q_num: 8,
        question: "\u221A961 + ? + 11 2 = 205 + \u221A841 - 34",
        options: {
          a: "48",
          b: "71",
          c: "56",
          d: "92",
          e: "25"
        },
        answer: "a",
        solution: "\u221A961 + ? + 11\n2\n = 205 + \u221A841 \u2013 34\n31 + ? + 121 = 205 + 29 \u2013 34\n152 + ? = 200\n? = 200 \u2013 152\n? = 48"
      },
      {
        id: "set_14_easy_q9",
        q_num: 9,
        question: "250 \xF7 14 *28 \u20133600 \xF7 4 + 50 * 12 = ?",
        options: {
          a: "100",
          b: "200",
          c: "150",
          d: "400",
          e: "350"
        },
        answer: "b",
        solution: "250 \xF7 14 * 28 \u2013 3600 \xF7 4 + 50 * 12 = ?\n500 \u2013 900 + 600 = ?\n? = 200"
      },
      {
        id: "set_14_easy_q10",
        q_num: 10,
        question: "5(1/2) + 1/2 + ? = 1(1/2) + 5(1/6)",
        options: {
          a: "2/3",
          b: "1/6",
          c: "3/4",
          d: "7/12",
          e: "5/6"
        },
        answer: "a",
        solution: "5(1/2) + 1/2 + ? = 1(1/2) + 5(1/6)\n11/2 + 1/2 + ? = 3/2 + 31/6\n? = 31/6 \u2013 9/2 = 31/6 \u2013 27/6 = 4/6\n? = 2/3"
      }
    ]
  },
  {
    id: "set_15_easy",
    title: "Simplification Drill Set 15 (Easy)",
    setNumber: 15,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_15_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. ? * 25 = (7 \xF7 12 * 480) + (8 \xF7 18 * 270)",
        options: {
          a: "22",
          b: "34",
          c: "10",
          d: "16",
          e: "24"
        },
        answer: "d",
        solution: "? * 25 = (7 \xF7 12 * 480) + (8 \xF7 18 * 270)\n? * 25 = 280 + 120\n? = 400/25 = 16"
      },
      {
        id: "set_15_easy_q2",
        q_num: 2,
        question: "32.5 % of 80 + 70 % of 310 + 127 = ?",
        options: {
          a: "340",
          b: "370",
          c: "390",
          d: "410",
          e: "430"
        },
        answer: "b",
        solution: "32.5 % of 80 + 70 % of 310 + 127 = ?\n26 + 217 + 127 = ?\n370 = ?"
      },
      {
        id: "set_15_easy_q3",
        q_num: 3,
        question: "15 * \u221A324= 200% of \u221A22500 - ?",
        options: {
          a: "20",
          b: "30",
          c: "50",
          d: "10",
          e: "40"
        },
        answer: "b",
        solution: "15 * \u221A324= 200 * \u221A(22500)/100 - ?\n15 * 18 = 200 * 150/100 - ?\n\nSimplification Questions PDF - Set 15 (Easy)\n? = 300 \u2013 270 = 30"
      },
      {
        id: "set_15_easy_q4",
        q_num: 4,
        question: "\u221A784 + \u221A576 \xF7 3 + \u221B? = \u221A1600",
        options: {
          a: "16",
          b: "81",
          c: "25",
          d: "36",
          e: "64"
        },
        answer: "e",
        solution: "\u221A784 + \u221A576 \xF7 3 +\u221B? = \u221A1600\n28 + 24 \xF7 3 + \u221B? = 40\n\u221B? = 40 \u2013 28 \u2013 8\n\u221B? = 4\n? = 64"
      },
      {
        id: "set_15_easy_q5",
        q_num: 5,
        question: "91 \xF7 7 * 10 + 1350 \xF7 15 = ? - 110",
        options: {
          a: "300",
          b: "410",
          c: "170",
          d: "330",
          e: "250"
        },
        answer: "d",
        solution: "91 \xF7 7 * 10 + 1350 \xF7 15 = ?\u2013 110\n? = 130 + 90 + 110\n? = 330"
      },
      {
        id: "set_15_easy_q6",
        q_num: 6,
        question: "26 + 465 \xF7 \u221A225 = 3 \u221A? + 45",
        options: {
          a: "1728",
          b: "1331",
          c: "1000",
          d: "2197",
          e: "2744"
        },
        answer: "a",
        solution: "26 + 465 \xF7 \u221A225 = \n3\n\u221A? + 45\n26 + 465 \xF7 15 = \n3\n\u221A? + 45\n57 - 45 = \n3\n\u221A?\n12 = \n3\n\u221A?\n1728 = ?"
      },
      {
        id: "set_15_easy_q7",
        q_num: 7,
        question: "?% of (584.2 \u2013 244.2) = (9) 2 + 21",
        options: {
          a: "40",
          b: "45",
          c: "30",
          d: "60",
          e: "50"
        },
        answer: "c",
        solution: "? % of (584.2 \u2013 244.2) = 9\n2\n + 21\n(?x340)/100 =81+21=102\n? = (102\xD7100)/340 = 30"
      },
      {
        id: "set_15_easy_q8",
        q_num: 8,
        question: "(7/12 + 5/8 + 1/6) * (192/11) +? = 30",
        options: {
          a: "11",
          b: "8",
          c: "6",
          d: "9",
          e: "12"
        },
        answer: "c",
        solution: "(7/12 + 5/8 + 1/6) * (192/11) +? = 30\n[(14 + 15 + 4)/ 24] * (192/11) +? = 30\n(33/24) * (192/11) +? = 30\n\nSimplification Questions PDF - Set 15 (Easy)\n24 +? = 30\n? = 6"
      },
      {
        id: "set_15_easy_q9",
        q_num: 9,
        question: "\u221A484 * ? 2 = 3(3/5) * (20 * 99)",
        options: {
          a: "16",
          b: "18",
          c: "20",
          d: "22",
          e: "15"
        },
        answer: "b",
        solution: "\u221A484 * ?\n2\n = 3(3/5) * (20 * 99)\n22 * ?\n2\n = 18/5 * 20 * 99\n?\n2\n = 324\n? = 18"
      },
      {
        id: "set_15_easy_q10",
        q_num: 10,
        question: "\u221A(\u221A961 \u2013 15) * 350 = ? + \u221A(\u221A729 + 3 2 )",
        options: {
          a: "1792",
          b: "1282",
          c: "1394",
          d: "1572",
          e: "1390"
        },
        answer: "c",
        solution: "\u221A(\u221A961 \u2013 15) * 350 = ? + \u221A(\u221A729 + 3\n2 \n)\n\u221A(31 \u2013 15) * 350 = ? + \u221A(27+9)\n1400 = x + 6\nx = 1394"
      }
    ]
  },
  {
    id: "set_16_easy",
    title: "Simplification Drill Set 16 (Easy)",
    setNumber: 16,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_16_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. 4/11 of 121 + 3/8 of 96 + 5/6 of 54 = ? 3",
        options: {
          a: "5",
          b: "7",
          c: "3",
          d: "9",
          e: "11"
        },
        answer: "a",
        solution: "4/11 * 121 + 3/8 * 96 + 5/6 * 54 = ?\n3\n44 + 36 + 45 = ?\n3\n?\n3\n = 125\n? = 5"
      },
      {
        id: "set_16_easy_q2",
        q_num: 2,
        question: "4 (4/9) + 5 (7/3) \u2013 7 = ?",
        options: {
          a: "6 (1/3)",
          b: "5 (6/9)",
          c: "3 (2/3)",
          d: "4 (7/9)",
          e: "7(1/9)"
        },
        answer: "d",
        solution: "4 (4/9) + 5 (7/3) \u2013 7 = ?\n40/9 + 22/3 \u2013 7 = ?\n(40 + 66 \u2013 63)/9 = ?\n? = 43/9 = 4 (7/9)"
      },
      {
        id: "set_16_easy_q3",
        q_num: 3,
        question: "3240/18 * 1/5 of 75 \u2013 13 3 = ?",
        options: {
          a: "510",
          b: "503",
          c: "505",
          d: "508",
          e: "507"
        },
        answer: "b",
        solution: "Simplification Questions PDF - Set 16 (Easy)\n3240/18 * 1/5 of 75 \u2013 13\n3\n= ?\n=> (180) * 15 \u2013 13\n3\n=> 503"
      },
      {
        id: "set_16_easy_q4",
        q_num: 4,
        question: "\u221A3721 - \u221A289 - \u221A784 = ? * 4",
        options: {
          a: "2",
          b: "4",
          c: "6",
          d: "8",
          e: "5"
        },
        answer: "b",
        solution: "\u221A3721 - \u221A289 - \u221A784 = ? * 4\n61 \u2013 17 \u2013 28 = ? * 4\n? = 4"
      },
      {
        id: "set_16_easy_q5",
        q_num: 5,
        question: "[(725 \xF7 25) * 35] - 14 2 = ?",
        options: {
          a: "827",
          b: "878",
          c: "819",
          d: "852",
          e: "844"
        },
        answer: "c",
        solution: "[(725/25)*35]-14\n2\n=29*35-196=819"
      },
      {
        id: "set_16_easy_q6",
        q_num: 6,
        question: "1800 \xF7 9 * 2 + ? = (216) 1/3 * 100",
        options: {
          a: "300",
          b: "200",
          c: "250",
          d: "150",
          e: "350"
        },
        answer: "b",
        solution: "1800 \xF7 9 * 2 + ? = (216)\n1/3\n * 100\n400 + ? = 6 * 100\n? = 200"
      },
      {
        id: "set_16_easy_q7",
        q_num: 7,
        question: "13(3/7) \u2013 5(5/14) \u2013 3(1/21) = ?",
        options: {
          a: "5(1/42)",
          b: "6(1/42)",
          c: "3(1/42)",
          d: "7(1/42)",
          e: "8(1/42)"
        },
        answer: "a",
        solution: "13(3/7) \u2013 5(5/14) \u2013 3(1/21) = ?\n94/7 \u2013 75/14 \u2013 64/21 = ?\n564 \u2013 225 \u2013 128/42 = ?\n? = 211/42\n? = 5(1/42)"
      },
      {
        id: "set_16_easy_q8",
        q_num: 8,
        question: "(\u221A1296 + \u221A225) \xF7 \u221A? = 238 \xF7 \u221A196",
        options: {
          a: "7",
          b: "9",
          c: "5",
          d: "8",
          e: "6"
        },
        answer: "b",
        solution: "(\u221A1296 + \u221A225) \xF7 \u221A? = 238 \xF7 \u221A196\n(36 + 15)/\u221A? = 238/14\n\u221A? = 51/17 = 3\n? = 9\n\nSimplification Questions PDF - Set 16 (Easy)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_16_easy_q9",
        q_num: 9,
        question: "\u221A289 * \u221A676 \u2013 (45 * 11) \xF7 5 = ? 3",
        options: {
          a: "7",
          b: "6",
          c: "5",
          d: "9",
          e: "8"
        },
        answer: "a",
        solution: "\u221A289 * \u221A676 \u2013 (45 * 11) \xF7 5 = ?\n3\n17 * 26 \u2013 495 \xF7 5 = ?\n3\n442 \u2013 99 = ?\n3\n343 = ?\n3\n7 = ?"
      },
      {
        id: "set_16_easy_q10",
        q_num: 10,
        question: "(17 2 + 13 2 ) \u2013 41 * 3 \u221A512 = ? 2 + \u221A81",
        options: {
          a: "15",
          b: "14",
          c: "11",
          d: "17",
          e: "18"
        },
        answer: "c",
        solution: "(17\n2\n + 13\n2\n) \u2013 41 * \n3\n\u221A512 = ?\n2\n + \u221A81\n(289 + 169) \u2013 41 * 8 = ?\n2\n +9\n458 \u2013 328 =  ?\n2\n + 9\n130 - 9 = ?\n2\n121 = ?\n2\n11 = ?"
      }
    ]
  },
  {
    id: "set_17_easy",
    title: "Simplification Drill Set 17 (Easy)",
    setNumber: 17,
    difficulty: "Easy",
    totalQuestions: 10,
    questions: [
      {
        id: "set_17_easy_q1",
        q_num: 1,
        question: "What value should come in the place of (?) in the following questions. 3(3/13) of 91 \u2013 1(5/7) of 140 = ?",
        options: {
          a: "57",
          b: "65",
          c: "62",
          d: "68",
          e: "54"
        },
        answer: "e",
        solution: "3(3/13) of 91 \u2013 1(5/7) of 140 = ?\n294 \u2013 240 = ?\n? = 54"
      },
      {
        id: "set_17_easy_q2",
        q_num: 2,
        question: "? * 29 = 117 * \u221A169 + 51.5 * 2",
        options: {
          a: "49",
          b: "56",
          c: "47",
          d: "43",
          e: "61"
        },
        answer: "b",
        solution: "? * 29 = 117 * \u221A169 + 51.5 * 2\n? * 29 = 1521 + 103\n? = 56"
      },
      {
        id: "set_17_easy_q3",
        q_num: 3,
        question: "80% of 875 \u2013 200 = ? + 25 % of 1740",
        options: {
          a: "65",
          b: "55",
          c: "45",
          d: "70",
          e: "40"
        },
        answer: "a",
        solution: "80% of 875 \u2013 200 = ? + 25 % of 1740\n700 \u2013 200 = ? + 435\n? = 65\n\nSimplification Questions PDF - Set 17 (Easy)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_17_easy_q4",
        q_num: 4,
        question: "45% of 500 + 65% of 700 = ?",
        options: {
          a: "650",
          b: "660",
          c: "680",
          d: "720",
          e: "740"
        },
        answer: "c",
        solution: "45% of 500 + 65% of 700 = ?\n225 + 455 = ?\n? = 680"
      },
      {
        id: "set_17_easy_q5",
        q_num: 5,
        question: "\u221A(32 * 8 + 185) \xF7 3 * 49 = 7 ?",
        options: {
          a: "4",
          b: "2",
          c: "7",
          d: "3",
          e: "5"
        },
        answer: "d",
        solution: "\u221A(32 * 8 + 185) \xF7 3 * 49 = 7\n?\n\u221A(256 + 185) \xF7 3 * 7\n2\n = 7\n?\n7\n?\n = \u221A441 \xF7 3 * 7\n2\n7\n?\n = 21 \xF7 3 * 7\n2\n7\n?\n = 7\n3\n? = 3"
      },
      {
        id: "set_17_easy_q6",
        q_num: 6,
        question: "\u221A961 + ? + 11 2 = 205 + \u221A841 - 34",
        options: {
          a: "48",
          b: "71",
          c: "56",
          d: "92",
          e: "25"
        },
        answer: "a",
        solution: "\u221A961 + ? + 11\n2\n = 205 + \u221A841 \u2013 34\n31 + ? + 121 = 205 + 29 \u2013 34\n152 + ? = 200\n? = 200 \u2013 152\n? = 48"
      },
      {
        id: "set_17_easy_q7",
        q_num: 7,
        question: "5 (3/7) + 2 (5/14) \u2013 1(11/14) = ? * 3",
        options: {
          a: "2",
          b: "4",
          c: "1",
          d: "8",
          e: "9"
        },
        answer: "a",
        solution: "5 (3/7) + 2 (5/14) \u2013 1(11/14) = ? * 3\n38/7 + 33/14 \u2013 25/14 = ? * 3\n(76 + 33 \u2013 25)/14 = ? * 3\n84/14 = ? * 3\n? = 2"
      },
      {
        id: "set_17_easy_q8",
        q_num: 8,
        question: "? 3 =(30 \xF7 3) 3 + \u221A961+(20*15)",
        options: {
          a: "12",
          b: "14",
          c: "17",
          d: "11",
          e: "13"
        },
        answer: "d",
        solution: "Simplification Questions PDF - Set 17 (Easy)\n?\n3\n= 10\n3\n + 31 + 300 = 1000+331\n?\n3\n=1331 = 11\n3\n?=11"
      },
      {
        id: "set_17_easy_q9",
        q_num: 9,
        question: "2 6 * 4 \xF7 10 + 10.4 - ? 2 = \u221A121",
        options: {
          a: "6",
          b: "7",
          c: "5",
          d: "8",
          e: "9"
        },
        answer: "c",
        solution: "2\n6\n * 4 \xF7 10 + 10.4 - ?\n2\n = \u221A121\n64 * 4 \xF7 10 + 10.4 - ?\n2\n = 11\n25.6 + 10.4 \u2013 11 = ?\n2\n?\n2\n = 25\n? = 5"
      },
      {
        id: "set_17_easy_q10",
        q_num: 10,
        question: "336.64 + 224.36 = ? \u2013 80/100 * 320",
        options: {
          a: "1036",
          b: "1156",
          c: "1020",
          d: "1084",
          e: "817"
        },
        answer: "e",
        solution: "336.64 + 224.36 = ? \u2013 80/100 * 320\n561  = ? \u2013 256\n? = 817"
      }
    ]
  },
  {
    id: "set_2_moderate",
    title: "Simplification Drill Set 2 (Moderate)",
    setNumber: 2,
    difficulty: "Moderate",
    totalQuestions: 10,
    questions: [
      {
        id: "set_2_moderate_q1",
        q_num: 1,
        question: "\u221A729 * 4 + (39 + 166 \u2013 57) \xF7 37 = ?",
        options: {
          a: "111",
          b: "110",
          c: "113",
          d: "112",
          e: "114"
        },
        answer: "d",
        solution: "\u221A729 * 4 + (39 + 166 \u2013 57) \xF7 37 = ?\n108 + 4 = ?\n112 = ?"
      },
      {
        id: "set_2_moderate_q2",
        q_num: 2,
        question: "1280 \xF7 8 + 490 \xF7 \u221A49 + ? = 150 * 2",
        options: {
          a: "60",
          b: "70",
          c: "50",
          d: "80",
          e: "40"
        },
        answer: "b",
        solution: "1280 \xF7 8 + 490 \xF7 \u221A49 + ? = 150 * 2\n160 + 70 + ? = 300\n? = 70"
      },
      {
        id: "set_2_moderate_q3",
        q_num: 3,
        question: "7/13 of 676/15 of 3/7 of 895/52 = ?",
        options: {
          a: "212",
          b: "235",
          c: "179",
          d: "312",
          e: "None of these"
        },
        answer: "c",
        solution: "7/13 of 676/15 of 3/7 of 895/52 = ?\n=> 7/13 * 676/15 * 3/7 * 895/52= ?\n=> 179= ?\n\nSimplification Questions PDF - Set 2 (Moderate)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_2_moderate_q4",
        q_num: 4,
        question: "34 \u2013 34 2 + 34 * (34 + 34/ 0.34) = ?",
        options: {
          a: "2134",
          b: "2534",
          c: "2834",
          d: "3434",
          e: "None of these"
        },
        answer: "d",
        solution: "34 \u2013 34\n2\n + 34 * (34 + 34/ 0.34) =?\n=> 34 \u2013 1156 + 34 * (34 + 100) =?\n=> 3434= ?"
      },
      {
        id: "set_2_moderate_q5",
        q_num: 5,
        question: "(0.512) (2/5) * (0.8) 3 \xF7 (0.4096) = (0.8) (?/5)",
        options: {
          a: "1",
          b: "2",
          c: "3",
          d: "0",
          e: "4"
        },
        answer: "a",
        solution: "(0.512)\n(2/5)\n * (0.8)\n3\n \xF7 (0.4096) = (0.8)\n(?/5)\n   \n (0.8)\n6/5 \u2013 1\n = (0.8)\n(?/5)\n   \n1/5 = ?/5\n? = 1"
      },
      {
        id: "set_2_moderate_q6",
        q_num: 6,
        question: "49 * 3 + 70% of 60= ? + 10 2",
        options: {
          a: "89",
          b: "150",
          c: "172",
          d: "250",
          e: "314"
        },
        answer: "a",
        solution: "49* 3 + 70% of 60= ? + 10\n2\n=> 49 * 3 + 70/100 * 60 = ? + 100\n=> 189 \u2013 100= ?\n=> 89= ?"
      },
      {
        id: "set_2_moderate_q7",
        q_num: 7,
        question: "(80% of 6450) \xF7 40+ 36=?",
        options: {
          a: "90",
          b: "100",
          c: "165",
          d: "189",
          e: "210"
        },
        answer: "c",
        solution: "=> (80% of 6450)/40 + 36 = ?\n=> 165= ?"
      },
      {
        id: "set_2_moderate_q8",
        q_num: 8,
        question: "(31 \xF7 215) * (43 \xF7 248) * ? = 3",
        options: {
          a: "120",
          b: "110",
          c: "140",
          d: "150",
          e: "180"
        },
        answer: "a",
        solution: "(31 \xF7 215) * (43 \xF7 248) * ? = 3\n1/5 * 1/8 * ? = 3\n? = 120"
      },
      {
        id: "set_2_moderate_q9",
        q_num: 9,
        question: "240% of 5/6 of 51/17 *34 = ?",
        options: {
          a: "624",
          b: "852",
          c: "204",
          d: "512",
          e: "None of these"
        },
        answer: "c",
        solution: "240% of 5/6 of 51/17 *34 = ?\n2*51*2 =?\n\nSimplification Questions PDF - Set 2 (Moderate)\n? = 204"
      },
      {
        id: "set_2_moderate_q10",
        q_num: 10,
        question: "3126+ 2142 + 3241 -5224 =?",
        options: {
          a: "3685",
          b: "3285",
          c: "2585",
          d: "6535",
          e: "None of these"
        },
        answer: "b",
        solution: "3126+ 2142 + 3241 -5224 =?\n?=3285"
      }
    ]
  },
  {
    id: "set_3_moderate",
    title: "Simplification Drill Set 3 (Moderate)",
    setNumber: 3,
    difficulty: "Moderate",
    totalQuestions: 10,
    questions: [
      {
        id: "set_3_moderate_q1",
        q_num: 1,
        question: "15 * 16 + \u221A441 * 18 \u2013 180 % of 220 = ?",
        options: {
          a: "199",
          b: "210",
          c: "222",
          d: "231",
          e: "243"
        },
        answer: "c",
        solution: "15 * 16 + \u221A441 * 18 \u2013 180 % of 220 = ?\n240 + 378 \u2013 396 = ?\n222 = ?"
      },
      {
        id: "set_3_moderate_q2",
        q_num: 2,
        question: "2765 \xF7 79 + 5133 \xF7 87 = ? + 1209 \xF7 13",
        options: {
          a: "1",
          b: "0",
          c: "2",
          d: "5",
          e: "3"
        },
        answer: "a",
        solution: "2765 \xF7 79 + 5133 \xF7 87 = ? + 1209 \xF7 13\n35 + 59 = ? + 93\n? = 1"
      },
      {
        id: "set_3_moderate_q3",
        q_num: 3,
        question: "42 % of 300 + 912 \xF7 \u221A144 + \u221A225 * 25 = ?",
        options: {
          a: "548",
          b: "358",
          c: "456",
          d: "577",
          e: "650"
        },
        answer: "d",
        solution: "42 % of 300 + 912 \xF7 \u221A144 + \u221A225 * 25 = ?\n126 + 76 + 375 = ?\n577= ?\n\nSimplification Questions PDF - Set 3 (Moderate)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_3_moderate_q4",
        q_num: 4,
        question: "3510 \xF7 \u221A169 +1530\xF717 \u2013 50 * \u221A9 = ?",
        options: {
          a: "300",
          b: "210",
          c: "350",
          d: "270",
          e: "320"
        },
        answer: "b",
        solution: "3510 \xF7 \u221A169 + 1530 \xF7 17 \u2013 50 * \u221A9 = ?\n270 + 90 \u2013 150 = ?\n? = 210"
      },
      {
        id: "set_3_moderate_q5",
        q_num: 5,
        question: "43 2 \u2013 39 2 + 62 * \u221A16 = ? 2",
        options: {
          a: "22",
          b: "20",
          c: "24",
          d: "27",
          e: "26"
        },
        answer: "c",
        solution: "43\n2 \n\u2013 39\n2\n + 62 * \u221A16 = ?\n2\n \n328 + 248 = ?\n? = 24"
      },
      {
        id: "set_3_moderate_q6",
        q_num: 6,
        question: "(29 2 + 111 * 9) \xF7 \u221A529 + ? = 110 % of 210",
        options: {
          a: "151",
          b: "143",
          c: "148",
          d: "128",
          e: "138"
        },
        answer: "a",
        solution: "(29\n2\n + 111 * 9) \xF7 \u221A529 + ? = 110 % of 210\n1840/23 + ? = 231\n? = 151"
      },
      {
        id: "set_3_moderate_q7",
        q_num: 7,
        question: "\u221A625 = \u221A484 + (1728) 1/3 + \u221A729 \u2013 (3375) 1/3 - \u221A?",
        options: {
          a: "441",
          b: "21",
          c: "364",
          d: "31",
          e: "None of these"
        },
        answer: "a",
        solution: "25 = 22 + 12 + 27 \u2013 15 - \u221A?\n\u221A? = 46 \u2013 25\n? = 441"
      },
      {
        id: "set_3_moderate_q8",
        q_num: 8,
        question: "25% of (?)\xB2 \u2013 98 = 16% of 525 + 8% of 175",
        options: {
          a: "32",
          b: "38",
          c: "22",
          d: "18",
          e: "None of these"
        },
        answer: "e",
        solution: "1/4 x (?)\xB2 = 84 + 14 + 98\n(?)\xB2 = 2 x 98 x 4\n(?)\xB2 = 16 x 49\n(?) = 28"
      },
      {
        id: "set_3_moderate_q9",
        q_num: 9,
        question: "45% of 1600 + 30% of 450 \u2013 191 \xD7 ? = 91",
        options: {
          a: "4",
          b: "3",
          c: "2",
          d: "5",
          e: "8"
        },
        answer: "a",
        solution: "45% of 1600 + 30% of 450 \u2013 191 \xD7 (x) = 91\n720 + 135 \u2013 191 \xD7 (x) = 91\nx = (855-91)/191 = 4\n\nSimplification Questions PDF - Set 3 (Moderate)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_3_moderate_q10",
        q_num: 10,
        question: "125% of 160 + \u221A11664 = ? + 60% of 80",
        options: {
          a: "230",
          b: "240",
          c: "250",
          d: "260",
          e: "210"
        },
        answer: "d",
        solution: "125% of 160 + \u221A11664 = ? + 60% of 80\n200 + 108 = ? + 48\n? = 260"
      }
    ]
  },
  {
    id: "set_4_moderate",
    title: "Simplification Drill Set 4 (Moderate)",
    setNumber: 4,
    difficulty: "Moderate",
    totalQuestions: 10,
    questions: [
      {
        id: "set_4_moderate_q1",
        q_num: 1,
        question: "18 \xF7 72 * 288 \xF7 13 * 182 \xF7 56 * 19 =?",
        options: {
          a: "324",
          b: "342",
          c: "432",
          d: "434",
          e: "None of these"
        },
        answer: "b",
        solution: "18 \xF7 72 * 288 \xF7 13 * 182 \xF7 56 * 19 =?\n18/72 *288/13  *182/56 *19 =?\n18*19 = ?\n? = 342"
      },
      {
        id: "set_4_moderate_q2",
        q_num: 2,
        question: "(589 \xF7 31) * (456 \xF7 19) = ?",
        options: {
          a: "456",
          b: "458",
          c: "453",
          d: "450",
          e: "454"
        },
        answer: "a",
        solution: "(589 \xF7 31) * (456 \xF7 19) = ?\n? = 19 * 24\n? = 456"
      },
      {
        id: "set_4_moderate_q3",
        q_num: 3,
        question: "\u221A4489 + \u221A1849 - \u221A841 = ? 2",
        options: {
          a: "7",
          b: "5",
          c: "8",
          d: "6",
          e: "9"
        },
        answer: "e",
        solution: "\u221A4489 + \u221A1849 - \u221A841 = ?\n2\n \n\nSimplification Questions PDF - Set 4 (Moderate)\n67 + 43 \u2013 29 = ?\n2\n? = 9"
      },
      {
        id: "set_4_moderate_q4",
        q_num: 4,
        question: "16 * 35 + 4.5 * 72 \u2013 817 \xF7 19 = ? 2",
        options: {
          a: "24",
          b: "22",
          c: "26",
          d: "29",
          e: "20"
        },
        answer: "d",
        solution: "16 * 35 + 4.5 * 72 \u2013 817 \xF7 19 = ?\n2\n560 + 324 \u2013 43 = ?\n2\n \n? = 29"
      },
      {
        id: "set_4_moderate_q5",
        q_num: 5,
        question: "(6160 + 12320) \xF7 ? = 660",
        options: {
          a: "35",
          b: "22",
          c: "25.5",
          d: "32.4",
          e: "28"
        },
        answer: "e",
        solution: "(6160 + 12320) \xF7 ? = 660\n(6160 + 12320) / 660 = 18480/660 = 28"
      },
      {
        id: "set_4_moderate_q6",
        q_num: 6,
        question: "45% of 240 \u2013 24% of 550 = ? - \u221A1444",
        options: {
          a: "17",
          b: "14",
          c: "19",
          d: "15",
          e: "13"
        },
        answer: "b",
        solution: "45% of 240 \u2013 24% of 550 = ? - \u221A1444\n-24 + 38 = ?\n? = 14"
      },
      {
        id: "set_4_moderate_q7",
        q_num: 7,
        question: "16 * 5 + 28 * 4 \u2013 728 \xF7 13 =?",
        options: {
          a: "128",
          b: "132",
          c: "136",
          d: "142",
          e: "146"
        },
        answer: "c",
        solution: "16 * 5 + 28 * 4 \u2013 728 \xF7 13 =?\n80 + 112 \u2013 56 =?\n136 =?"
      },
      {
        id: "set_4_moderate_q8",
        q_num: 8,
        question: "60% of 130 + 20% of 120 + 125% of 64 =?",
        options: {
          a: "190",
          b: "193",
          c: "182",
          d: "176",
          e: "196"
        },
        answer: "c",
        solution: "60% of 130 + 20% of 120 + 125% of 64 =?\n78 + 24 + 80 =?\n182 =?"
      },
      {
        id: "set_4_moderate_q9",
        q_num: 9,
        question: "\u221A2025 + ? 2 = 276 \xF7 23 + 7 * 46",
        options: {
          a: "15",
          b: "17",
          c: "18",
          d: "21",
          e: "23"
        },
        answer: "b",
        solution: "\u221A2025 + ?\n2\n = 276 \xF7 23 + 7 * 46\n45 + ?\n2\n = 12 + 322\n\nSimplification Questions PDF - Set 4 (Moderate)\n?\n2\n = 289\n? = 17"
      },
      {
        id: "set_4_moderate_q10",
        q_num: 10,
        question: "48 % of 350 +? * 19 = 151 * \u221A9",
        options: {
          a: "12",
          b: "13",
          c: "15",
          d: "18",
          e: "17"
        },
        answer: "c",
        solution: "48 % of 350 +? * 19 = 151 * \u221A9\n168 +? * 19 = 453\n? * 19 = 285\n? = 15"
      }
    ]
  },
  {
    id: "set_5_moderate",
    title: "Simplification Drill Set 5 (Moderate)",
    setNumber: 5,
    difficulty: "Moderate",
    totalQuestions: 10,
    questions: [
      {
        id: "set_5_moderate_q1",
        q_num: 1,
        question: "(33 * 42 \u2013 26 * 11) \xF7 11 = 5 * ? \u2013 20 * 5",
        options: {
          a: "52",
          b: "20",
          c: "40",
          d: "38",
          e: "17"
        },
        answer: "c",
        solution: "(33 * 42 \u2013 26 * 11) \xF7 11 = 5 * ? \u2013 20 * 5\n(1386 \u2013 286)/11 = 5* ? - 100\n100 + 100 = 5 * ?\n200 = 5 * ?\n? = 40"
      },
      {
        id: "set_5_moderate_q2",
        q_num: 2,
        question: "60% of 750 + 17 * ? - 14 2 = 792 \u2013 45",
        options: {
          a: "17",
          b: "19",
          c: "25",
          d: "29",
          e: "11"
        },
        answer: "d",
        solution: "60% of 750 + 17 * ? - 14\n2 \n= 792 \u2013 45\n60/100 * 750 + 17 * ? \u2013 196 = 792 \u2013 45\n450 + 17 * ? \u2013 196 = 747\n17 * ? = 493\n\nSimplification Questions PDF - Set 5 (Moderate)\n? = 29"
      },
      {
        id: "set_5_moderate_q3",
        q_num: 3,
        question: "20% of (158 + 442) = 81 1/2 \u2013 22 * 7+ ?",
        options: {
          a: "335",
          b: "265",
          c: "329",
          d: "125",
          e: "129"
        },
        answer: "b",
        solution: "20% of (158 + 442) = 81\n1/2\n \u2013 22 * 7 + ?\n20/100 * 600 = 9 \u2013 154 + ?\n120 + 145 = ?\n? = 265"
      },
      {
        id: "set_5_moderate_q4",
        q_num: 4,
        question: "\u221A1849 + 2 3 \u2013 30% of 1450 = ? \xF7 3 + 4 2",
        options: {
          a: "-2200",
          b: "1340",
          c: "-1200",
          d: "-1450",
          e: "1270"
        },
        answer: "c",
        solution: "\u221A1849 + 2\n3\n \u2013 30% of 1450 = ? \xF7 3 + 4\n2\n43 + 8 \u2013 435 = ?/3 + 16\n-400 = ?/3\n? = -1200"
      },
      {
        id: "set_5_moderate_q5",
        q_num: 5,
        question: "25 2 - 97 + 72 + 10 * 20= ? + (5 2 ) 2",
        options: {
          a: "285",
          b: "175",
          c: "335",
          d: "225",
          e: "145"
        },
        answer: "b",
        solution: "25\n2\n - 97 + 72 + 10 * 20 = ? + (5\n2\n)\n2\n625 \u2013 97 + 72 + 200= ? + 625\n? = 175"
      },
      {
        id: "set_5_moderate_q6",
        q_num: 6,
        question: "20% of 1650 \u2013 50% of 440 - \u221A625 = ?",
        options: {
          a: "85",
          b: "45",
          c: "75",
          d: "65",
          e: "95"
        },
        answer: "a",
        solution: "20% of 1650 \u2013 50% of 440 - \u221A625 = ?\n20/100 * 1650 \u2013 50/100 * 440 \u2013 25 = ?\n330 \u2013 220 \u2013 25 = ?\n? = 85"
      },
      {
        id: "set_5_moderate_q7",
        q_num: 7,
        question: "360 \xF7 \u221A576+ ? * 13 = 29 * \u221A400 \xF7 4",
        options: {
          a: "25",
          b: "10",
          c: "30",
          d: "20",
          e: "15"
        },
        answer: "b",
        solution: "360 \xF7 \u221A576 + ? * 13 = 29 * \u221A400 \xF7 4\n360/24 + ? * 13 = 29 * 20/4\n15 + ? * 13 = 145\n? = 130/13 = 10\n\nSimplification Questions PDF - Set 5 (Moderate)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_5_moderate_q8",
        q_num: 8,
        question: "\u221A(31 2 \u2013 940 + \u221A?) + 94 = 117 - \u221A289",
        options: {
          a: "484",
          b: "625",
          c: "361",
          d: "225",
          e: "400"
        },
        answer: "d",
        solution: "\u221A(31\n2\n \u2013 940 + \u221A?) + 94 = 117 - \u221A289\n\u221A(961 \u2013 940 + \u221A?) + 94 = 117 \u2013 17\n\u221A(21 + \u221A?) = 100 \u2013 94\n21 + \u221A? = 6\n2\n\u221A? = 36 \u2013 21 = 15\n? = 225"
      },
      {
        id: "set_5_moderate_q9",
        q_num: 9,
        question: "(84 \xF7 \u221A225) * 75 - ? = 143 * 20 \xF7 11",
        options: {
          a: "160",
          b: "100",
          c: "120",
          d: "140",
          e: "180"
        },
        answer: "a",
        solution: "(84 \xF7 \u221A225) * 75 - ? = 143 * 20 \xF7 11\n(84 \xF7 15) * 75 - ? = 13 * 20\n84 * 5 - ? = 260\n? = 420 - 260 = 160"
      },
      {
        id: "set_5_moderate_q10",
        q_num: 10,
        question: "(5 * \u221A2500 \u2013 5 3 + 11 * 5) \xF7 9 = ? \xF7 \u221A121",
        options: {
          a: "132",
          b: "275",
          c: "400",
          d: "220",
          e: "110"
        },
        answer: "d",
        solution: "(5 * \u221A2500 \u2013 5\n3\n + 11 * 5) \xF7 9 = ? \xF7 \u221A121\n(5 * 50 \u2013 125 + 55)/9 = ?/11\n(250 \u2013 70) / 9 = ?/11\n180/9 = ?/11\n? = 20 * 11\n? = 220"
      }
    ]
  },
  {
    id: "set_6_moderate",
    title: "Simplification Drill Set 6 (Moderate)",
    setNumber: 6,
    difficulty: "Moderate",
    totalQuestions: 10,
    questions: [
      {
        id: "set_6_moderate_q1",
        q_num: 1,
        question: "12 * 6 +18 - 5 2 = ? - 10 2",
        options: {
          a: "100",
          b: "120",
          c: "165",
          d: "140",
          e: "90"
        },
        answer: "c",
        solution: "12 * 6 +18 - 5\n2\n =? - 10\n2\n72 + 18 \u2013 25=? -100\n90 \u2013 25 =? -100\n? =65 + 100\n? =165"
      },
      {
        id: "set_6_moderate_q2",
        q_num: 2,
        question: "34% of 500 + (690 \xF7 3) = ? + 150",
        options: {
          a: "280",
          b: "180",
          c: "200",
          d: "250",
          e: "160"
        },
        answer: "d",
        solution: "34% of 500 + (690 \xF7 3) =? + 150\n0.34 * 500 + 230 =? + 150\n170 + 230 =? + 150\n? = 400 \u2013 150\n\nSimplification Questions PDF - Set 6 (Moderate)\n? = 250"
      },
      {
        id: "set_6_moderate_q3",
        q_num: 3,
        question: "(3 2/5 + 2 7/15) * 30/4 = ?*4",
        options: {
          a: "11",
          b: "23",
          c: "18",
          d: "15",
          e: "21"
        },
        answer: "a",
        solution: "(3 2/5 + 2 7/15) * 30/4 =?*4\n(17/5 + 37/15) *30/4 =? * 4\n88/15 * 30/4 =? *4\n? =44/4\n? =11"
      },
      {
        id: "set_6_moderate_q4",
        q_num: 4,
        question: "256 (1/8) * 64 2 = 16 a",
        options: {
          a: "a = 13/4",
          b: "a = 12/5",
          c: "a = 11/3",
          d: "a = 13/3",
          e: "a = 11/4"
        },
        answer: "a",
        solution: "256\n(1/8)\n * 64\n2\n = 16\na\n4\n4/8\n * 4\n3 * 2 \n = 4\n2a\n1/2 + 6 = 2a\n13/4 = a"
      },
      {
        id: "set_6_moderate_q5",
        q_num: 5,
        question: "767 \xF7 13 + 357 \xF7 \u221A289 = ? * \u221A16",
        options: {
          a: "10",
          b: "15",
          c: "20",
          d: "25",
          e: "30"
        },
        answer: "c",
        solution: "767 \xF7 13 + 357 \xF7 \u221A289 = ? * \u221A16\n59 + 21 = ? * 4\n? = 20"
      },
      {
        id: "set_6_moderate_q6",
        q_num: 6,
        question: "(23 + 45)*18 = (6 3 \u2013 12 2 ) * ?",
        options: {
          a: "17",
          b: "20",
          c: "13",
          d: "21",
          e: "None of these"
        },
        answer: "a",
        solution: "(23 + 45)*18 = (6\n3\n \u2013 12\n2\n) * x\n68 * 18 = (216 \u2013 144) x\n1224 = 72 * x\nx = 17"
      },
      {
        id: "set_6_moderate_q7",
        q_num: 7,
        question: "\u221A6561 * 106 = ? * 3 3 * 2",
        options: {
          a: "149",
          b: "189",
          c: "159",
          d: "139",
          e: "None of these"
        },
        answer: "c",
        solution: "\u221A6561 * 106 = x * 3\n3\n * 2\n81 * 106 = x * 27 * 2\n3 * 53 = x\n\nSimplification Questions PDF - Set 6 (Moderate)\nx = 159"
      },
      {
        id: "set_6_moderate_q8",
        q_num: 8,
        question: "(204 * ?) \xF7 17 = (29 \xF7 49) * 588",
        options: {
          a: "55",
          b: "79",
          c: "29",
          d: "48",
          e: "None of these"
        },
        answer: "c",
        solution: "(204 * x) \xF7 17 = (29 \xF7 49) * 588\n(204 * x)/17 = 29/49 * 588\n12* x = 29 * 12\nx = 29"
      },
      {
        id: "set_6_moderate_q9",
        q_num: 9,
        question: "",
        options: {
          a: "312",
          b: "280",
          c: "250",
          d: "324",
          e: "296"
        },
        answer: "c",
        solution: "17 * 14 + 400 = 888 - ?\n? = 250"
      },
      {
        id: "set_6_moderate_q10",
        q_num: 10,
        question: "(21) 2 + (9) 3 + (35) 2 = (53) 2 - ?",
        options: {
          a: "374",
          b: "414",
          c: "384",
          d: "464",
          e: "484"
        },
        answer: "b",
        solution: "(21)\n2\n + (9)\n3\n + (35)\n2\n = (53)\n2\n - ?\n441 + 729 + 1225 = 2809 - ?\n? = 414"
      }
    ]
  },
  {
    id: "set_7_moderate",
    title: "Simplification Drill Set 7 (Moderate)",
    setNumber: 7,
    difficulty: "Moderate",
    totalQuestions: 15,
    questions: [
      {
        id: "set_7_moderate_q1",
        q_num: 1,
        question: "230 \xF7 20 + 108.5 - ? = 225 \xF7 9 + \u221A169 * 5",
        options: {
          a: "70",
          b: "30",
          c: "60",
          d: "45",
          e: "85"
        },
        answer: "b",
        solution: "230 \xF7 20 + 108.5 - ? = 225 \xF7 9 + \u221A169 * 5\n11.5 + 108.5 - ? = 25 + 13 * 5\n120 - ? = 25 + 65\n? = 120 \u2013 90\n? = 30"
      },
      {
        id: "set_7_moderate_q2",
        q_num: 2,
        question: "\u221A16 * 400 \u2013 360 + ? = 2600 \u2013 38 * \u221A625",
        options: {
          a: "370",
          b: "290",
          c: "410",
          d: "580",
          e: "350"
        },
        answer: "c",
        solution: "\u221A16 * 400 \u2013 360 + ? += 2600 \u2013 38 * \u221A625\n4 * 400 \u2013 360 + ? = 2600 \u2013 38 * 25\n1600 \u2013 360 + ? = 2600 \u2013 950\n1240 + ? = 1650\n? = 1650 \u2013 1240\n? = 410"
      },
      {
        id: "set_7_moderate_q3",
        q_num: 3,
        question: "15 \xF7 ? * 104 + 30 * 3 \u221A1331 = 20 2 + 50",
        options: {
          a: "11",
          b: "12",
          c: "15",
          d: "18",
          e: "13"
        },
        answer: "e",
        solution: "15 \xF7 ? * 104 + 30 * \n3\n\u221A1331 = 20\n2\n + 50\n15/? * 104 + 30 * 11 = 400 + 50\n15/? * 104 = 450 \u2013 330\n? = 15 * 104/120\n? = 13"
      },
      {
        id: "set_7_moderate_q4",
        q_num: 4,
        question: "62.5% of 240 \u2013 ? + 16 2 = 80 * 68 \xF7 17",
        options: {
          a: "86",
          b: "60",
          c: "55",
          d: "92",
          e: "74"
        },
        answer: "a",
        solution: "62.5% of 240 \u2013 ? + 16\n2\n = 80 * 68 \xF7 17\n5/8 * 240 - ? + 256 = 80 * 4\n150 - ? + 256 = 320\n406 - ? = 320\n? = 86"
      },
      {
        id: "set_7_moderate_q5",
        q_num: 5,
        question: "? + 1/12 = 5/18 + 11/36 \u2013 3/9",
        options: {
          a: "1/6",
          b: "5/36",
          c: "3/4",
          d: "1/12",
          e: "7/18"
        },
        answer: "a",
        solution: "? + 1/12 = 5/18 + 11/36 \u2013 3/9 \n? + 3/36 = 10/36 + 11/36 \u2013 12/36\n? + 3/36 = 9/36\n? = 9/36 \u2013 3/36 = 6/36\n? = 1/6"
      },
      {
        id: "set_7_moderate_q6",
        q_num: 6,
        question: "? 2 = (\u221A1296 + \u221A324)% of 1800 \u2013 (2 3 * 3 2 )",
        options: {
          a: "27",
          b: "25",
          c: "29",
          d: "30",
          e: "31"
        },
        answer: "d",
        solution: "Simplification Questions PDF - Set 7 (Moderate)\n?\n2\n = (\u221A1296 + \u221A324)% of 1800 \u2013 (2\n3\n * 3\n2\n)\n?\n2\n = (36 + 18)% of 1800 \u2013 (8 * 9)\n?\n2\n = 54 * 18 \u2013 72\n?\n2\n = 972 \u2013 72\n?\n2\n = 900\n? = 30\nHence, option D"
      },
      {
        id: "set_7_moderate_q7",
        q_num: 7,
        question: "(23 \u2013 9)*? \u2013 150 \xF7 6 + 48 = 8 * 18 + 19",
        options: {
          a: "5",
          b: "10",
          c: "30",
          d: "15",
          e: "8"
        },
        answer: "b",
        solution: "(23 \u2013 9)*? \u2013 150 \xF7 6 + 48 = 8 * 18 + 19\n14 *? \u2013 25 + 48 = 144 + 19\n14 *? + 23 = 163\n14 *? = 163 \u2013 23\n? = (140 \xF7 14)\n? = 10\nHence, option B"
      },
      {
        id: "set_7_moderate_q8",
        q_num: 8,
        question: "3(3/2) + 2(7/5) + 5(4/2) + 1(6/5) \u2013 3(7/2) = ? \xF7 5",
        options: {
          a: "53",
          b: "28",
          c: "50",
          d: "59",
          e: "43"
        },
        answer: "a",
        solution: "3(3/2) + 2(7/5) + 5(4/2) + 1(6/5) \u2013 3(7/2) = ? \xF7 5\n(9/2) + (17/5) + (14/2) + (11/5) \u2013 (13/2) = ?/5\n(9+ 14 \u2013 13)/2 + (17 + 11)/5 = ?/5\n(10/2) + (28/5) = ?/5\n53/5 = ?/5\n? = 53\nHence, option A"
      },
      {
        id: "set_7_moderate_q9",
        q_num: 9,
        question: "(7/12 + 5/8 + 1/6) * 192 \xF7 11+? = 30",
        options: {
          a: "11",
          b: "8",
          c: "6",
          d: "9",
          e: "12"
        },
        answer: "c",
        solution: "(7/12 + 5/8 + 1/6) * 192 \xF7 11 + ? = 30\n[(14 + 15 + 4)/24] * (192/11) +? = 30\n(33/24) * (192/11) +? = 30\n\nSimplification Questions PDF - Set 7 (Moderate)\n24 + ? = 30\n? = 6\nHence, option C"
      },
      {
        id: "set_7_moderate_q10",
        q_num: 10,
        question: "24 \xF7 \u221A64 + 30 * \u221A9 + 3 \u221A? = \u221A196 * 7",
        options: {
          a: "216",
          b: "36",
          c: "512",
          d: "64",
          e: "125"
        },
        answer: "e",
        solution: "24 \xF7 \u221A64 + 30 * \u221A9 + \n3\n\u221A? = \u221A196 * 7\n24/8 + 30 * 3 + \n3\n\u221A? = 14 * 7\n3 + 90 + \n3\n\u221A? = 98\n98 \u2013 93 = \n3\n\u221A?\n5 = \n3\n\u221A?\n? = 125\nHence, option E"
      },
      {
        id: "set_7_moderate_q11",
        q_num: 11,
        question: "1(9/16)% of 2560 + 50 of 4 = ? \xF7 3 \u221A27",
        options: {
          a: "360",
          b: "720",
          c: "480",
          d: "540",
          e: "624"
        },
        answer: "b",
        solution: "1(9/16)% of 2560 + 50 of 4 = ? \xF7 \n3\n\u221A27\n(25/16) * (1/100) * 2560 + (50 * 4) = ? \xF7 3\n(5/2) * 16 + 200 = ?/3\n40 + 200 = ?/3\n? = 240 * 3\n? = 720\nHence, option B"
      },
      {
        id: "set_7_moderate_q12",
        q_num: 12,
        question: "{\u221A[(167 + 157) \xF7 ?] * \u221A49} \xF7 6 = 3",
        options: {
          a: "49",
          b: "64",
          c: "36",
          d: "100",
          e: "25"
        },
        answer: "a",
        solution: "{\u221A[(167 + 157) \xF7 ?] * \u221A49} \xF7 6 = 3\n\u221A(324 \xF7 ?) * 7 = 18\n(18/\u221A?) * 7 = 18\n7 = \u221A?\n? = 49\nHence, option A"
      },
      {
        id: "set_7_moderate_q13",
        q_num: 13,
        question: "17(2/3) \xF7 (1/12) + \u221A2025 \u2013 1 = ? 4",
        options: {
          a: "5",
          b: "8",
          c: "4",
          d: "16",
          e: "6"
        },
        answer: "c",
        solution: "17(2/3) \xF7 (1/12) + \u221A2025 \u2013 1 = ?\n4\n(53/3) * 12 + 45 \u2013 1 = ?\n4\n?\n4\n = (53 * 4) + 44\n?\n4\n = 212 + 44\n?\n4\n = 256 = 4\n4\n? = 4\nHence, option C"
      },
      {
        id: "set_7_moderate_q14",
        q_num: 14,
        question: "52% of 36% of 810 = 72% of 18% of ?",
        options: {
          a: "960",
          b: "1520",
          c: "1870",
          d: "1170",
          e: "1360"
        },
        answer: "d",
        solution: "52% of 36% of 810 = 72% of 18% of ?\n52/100 * 36/100 * 810 = 72/100 * 18/100* ?\n52 * 90 = 2 * 2 * ?\n13 * 90 = ?\n? = 1170\nHence, option D"
      },
      {
        id: "set_7_moderate_q15",
        q_num: 15,
        question: "\u221A1568 * \u221A1728 \xF7 \u221A6 + 2197 2/3 = ? 2",
        options: {
          a: "31",
          b: "39",
          c: "41",
          d: "21",
          e: "29"
        },
        answer: "e",
        solution: "\u221A1568 * \u221A1728 \xF7 \u221A6 + 2197\n2/3\n= ?\n2\n\u221A784 * \u221A2 * \u221A576 * \u221A3 \xF7 (\u221A2 * \u221A3) + (13\n3\n)\n2/3\n= ?\n2\n28 * 24 + 169 = ?\n2\n672 + 169 = ?\n2\n?\n2\n = 841 = 29\n2\n? = 29\nHence, option E"
      }
    ]
  },
  {
    id: "set_2_hard",
    title: "Simplification Drill Set 2 (Hard)",
    setNumber: 2,
    difficulty: "Hard",
    totalQuestions: 10,
    questions: [
      {
        id: "set_2_hard_q1",
        q_num: 1,
        question: "What value should come at the place of question mark in the following questions? 4 8 \xF7 256 x 64 \xF7 4 3 x 4 = 16 x 4 ?",
        options: {
          a: "7",
          b: "3",
          c: "2",
          d: "5",
          e: "None of these"
        },
        answer: "b",
        solution: "4\n8\n\xF7 4\n4\n x 4\n3\n\xF7 4\n3\n x 4 = 4\n2\n x 4\n?\n=> 4\n(8 \u2013 4 + 3 \u2013 3 + 1)\n = 4\n(2 + ?)\n=> 4\n5\n = 4\n(2 + ?)\n=> 5 = 2 + ?\n=> ? = 5 \u2013 2\n=> ? = 3"
      },
      {
        id: "set_2_hard_q2",
        q_num: 2,
        question: "65% of 80 + \u221A3969 * \u221A144 + ? = 45 * \u221A324",
        options: {
          a: "3",
          b: "1",
          c: "2",
          d: "4",
          e: "5"
        },
        answer: "c",
        solution: "65% of 80 + \u221A3969 * \u221A144 + ? = 45 * \u221A324\n52 + 63 * 12 + ? =45 * 18\n808 + ?=810\n\nSimplification Questions PDF - Set 2 (Hard)\n?=2"
      },
      {
        id: "set_2_hard_q3",
        q_num: 3,
        question: "15% of 480 + \u221A7056 \xF7 21 + ? * 17=892",
        options: {
          a: "42",
          b: "44",
          c: "46",
          d: "48",
          e: "45"
        },
        answer: "d",
        solution: "15% of 480 + \u221A7056 \xF7 21 + ? * 17=892\n72 + 4 + ? * 17=892\n?=48"
      },
      {
        id: "set_2_hard_q4",
        q_num: 4,
        question: "? 2 - 405 = (\u221A1089 * 5)% of 2000 \u2013 1205",
        options: {
          a: "60",
          b: "55",
          c: "50",
          d: "65",
          e: "70"
        },
        answer: "c",
        solution: "X\n2\n = (\u221A1089 * 5)% of 2000 \u2013 1205 + 405\nX\n2\n = [(33 * 5)/100] * 2000 \u2013 1205 + 405\nX\n2\n = 3300 - 1205 + 405\nX\n2\n = 2500\nX = 50"
      },
      {
        id: "set_2_hard_q5",
        q_num: 5,
        question: "(6 (1/4) + 3 (5/8) + 4 (2/16)) \xD7 3 \u2013 20 \xF7 (4 \xD7 3) = ? 2 /3",
        options: {
          a: "11",
          b: "12",
          c: "11/3",
          d: "121/3",
          e: "4"
        },
        answer: "a",
        solution: "[(25/4) + (29/8) + (33/8)] * 3 \u2013 (20/12) = x\n2\n/3\n[(50 + 29 + 33)/8] * 3 \u2013 (5/3) = x\n2\n/3\n(112/8) * 3 \u2013 (5/3) = x\n2\n/3\n42 \u2013 5/3 = x\n2\n/3\n121/3 = x\n2\n/3\nx = 11"
      },
      {
        id: "set_2_hard_q6",
        q_num: 6,
        question: "\u221A(6+6*\u221A(22+\u221A(4+\u221A25))) = 432/?",
        options: {
          a: "108",
          b: "72",
          c: "86.4",
          d: "54",
          e: "80"
        },
        answer: "b",
        solution: "\u221A(6+6*\u221A(22+\u221A(4+\u221A25))) = 432/?\n\u221A(6+6*\u221A(22+\u221A(4+5))) = 432/?\n\u221A(6+6*\u221A(22+3)) = 432/?\n\u221A(6+6*5) = 432/?\n6 = 432/?\n? = 72\n\nSimplification Questions PDF - Set 2 (Hard)\nPDF Course Subscription | Mock Tests Subscription | All in One Subscription"
      },
      {
        id: "set_2_hard_q7",
        q_num: 7,
        question: "5.5 \xD7 4 + 1.25 \xD7 6 + 20(9\xF73\xD74 + 1.25 + 3.325) =? 2",
        options: {
          a: "17",
          b: "18",
          c: "20",
          d: "19",
          e: "15"
        },
        answer: "d",
        solution: "5.5 \xD7 4 + 1.25 \xD7 6 + 20(9\xF73\xD74 + 1.25 + 3.325) =?\n2\n22 + 7.5 + + 20(12 + 1.25 + 3.325) =?\n2\n22 + 7.5 + 331.5 =?\n2\n361 =?\n2\n19 =?"
      },
      {
        id: "set_2_hard_q8",
        q_num: 8,
        question: "What value should come in place of (?) in the following questions? (2 1/2% of 160) \xD7 (21/4% of 110) \xD7 9 = 16 \xD7 15 \u2013 1/10 - (2) ?",
        options: {
          a: "4",
          b: "3",
          c: "5",
          d: "6",
          e: "8"
        },
        answer: "c",
        solution: "(2 1/2% of 160) \xD7 (21/4% of 110) \xD7 9 = 16 \xD7 15 \u2013 1/10 - (2)\n?\n5/200 * 160 * 21/400 * 110 * 9 = 240 \u2013 1/10 \u2013 (2)\n?\n207.9 = 240 \u2013 0.1 - (2)\n?\n(2)\n?\n = 240 \u2013 0.1 \u2013 207.9\n(2)\n?\n = 32\n(2)\n?\n = 2\n5\nx = 5"
      },
      {
        id: "set_2_hard_q9",
        q_num: 9,
        question: "3 \u221A(32751+ 2 \u221A(223+ \u221A4356))= ? * 3 \u221A(512)",
        options: {
          a: "17",
          b: "1",
          c: "4",
          d: "13",
          e: "7"
        },
        answer: "c",
        solution: ""
      },
      {
        id: "set_2_hard_q10",
        q_num: 10,
        question: "56% of 1200 \u2013 (4 3 * 6)/\u221A144 \u2013 125% of (720/5) = ?",
        options: {
          a: "440",
          b: "460",
          c: "480",
          d: "490",
          e: "510"
        },
        answer: "b",
        solution: "56% of 1200 \u2013 (4\n3\n * 6)/\u221A144 \u2013 125% of (720/5) = ?\n\nSimplification Questions PDF - Set 2 (Hard)\n672 \u2013 32 \u2013 180 = ?\n? = 460"
      }
    ]
  }
];

// src/telegram/speedLabData.ts
function generateNumericDistractors(correctVal, rangeSpread = 10) {
  const distractors = [];
  const deltas = [-rangeSpread, rangeSpread, -rangeSpread * 2, rangeSpread * 2, -2, 2, -1, 1];
  for (const d of shuffle(deltas)) {
    const candidate = correctVal + d;
    if (candidate > 0 && candidate !== correctVal && !distractors.includes(candidate)) {
      distractors.push(candidate);
      if (distractors.length === 3) break;
    }
  }
  while (distractors.length < 3) {
    distractors.push(correctVal + distractors.length + 3);
  }
  return distractors.map(String);
}
function getTripletsStepDrill(mode = "all") {
  let items = [...PRIMITIVE_TRIPLETS];
  if (mode === "10") items = shuffle(items).slice(0, 10);
  return items.map((item, idx) => {
    const q = createTripletQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, 2);
    const options = shuffle([String(ansNum), ...distractors]);
    return sanitizeTelegramQuiz({
      id: `calc_triplet_${idx}_${Date.now()}`,
      question: `\u{1F4D0} [Triplets Step 1]
${q.prompt} \u2014 ${q.subPrompt || "Find the missing value"}`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation || `Pythagorean Triplet: ${item.a}\xB2 + ${item.b}\xB2 = ${item.c}\xB2`,
      subject: "Calculation Studio",
      topic: "Primitive Triplets",
      source: "Step 1: Triplets"
    });
  });
}
function getTablesStepDrill(mode = "all") {
  let tables = Array.from({ length: TABLES_CONFIG.maxTable - TABLES_CONFIG.minTable + 1 }, (_, i) => TABLES_CONFIG.minTable + i);
  if (mode === "10") tables = shuffle(tables).slice(0, 10);
  return tables.map((tbl, idx) => {
    const q = createTableQuestion(tbl);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, tbl);
    const options = shuffle([String(ansNum), ...distractors]);
    return sanitizeTelegramQuiz({
      id: `calc_table_${idx}_${Date.now()}`,
      question: `\u2716\uFE0F [Tables Step 2]
What is ${q.prompt}?`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation,
      subject: "Calculation Studio",
      topic: "Tables 12\u201324",
      source: "Step 2: Tables"
    });
  });
}
function getSquaresStepDrill(mode = "all") {
  let squares = [...SQUARES_17_39];
  if (mode === "10") squares = shuffle(squares).slice(0, 10);
  return squares.map((item, idx) => {
    const q = createSquareQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, ansNum > 100 ? 20 : 2);
    const options = shuffle([String(ansNum), ...distractors]);
    return sanitizeTelegramQuiz({
      id: `calc_square_${idx}_${Date.now()}`,
      question: `\u{1F522} [Squares Step 3]
Calculate: ${q.prompt}`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation,
      subject: "Calculation Studio",
      topic: "Squares 17\u201339",
      source: "Step 3: Squares"
    });
  });
}
function getCubesStepDrill(mode = "all") {
  let cubes = [...CUBES_11_25];
  if (mode === "10") cubes = shuffle(cubes).slice(0, 10);
  return cubes.map((item, idx) => {
    const q = createCubeQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, ansNum > 1e3 ? 50 : 1);
    const options = shuffle([String(ansNum), ...distractors]);
    return sanitizeTelegramQuiz({
      id: `calc_cube_${idx}_${Date.now()}`,
      question: `\u{1F9CA} [Cubes Step 4]
Calculate: ${q.prompt}`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation,
      subject: "Calculation Studio",
      topic: "Cubes 11\u201325",
      source: "Step 4: Cubes"
    });
  });
}
function getPowersStepDrill(mode = "all") {
  let powers = [...POWERS_DATA];
  if (mode === "10") powers = shuffle(powers).slice(0, 10);
  return powers.map((item, idx) => {
    const q = createPowerQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, ansNum > 200 ? 30 : 5);
    const options = shuffle([String(ansNum), ...distractors]);
    return sanitizeTelegramQuiz({
      id: `calc_power_${idx}_${Date.now()}`,
      question: `\u26A1 [Powers Step 5]
Calculate value of: ${q.prompt}`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: q.explanation,
      subject: "Calculation Studio",
      topic: "Powers (2\u20139)",
      source: "Step 5: Powers"
    });
  });
}
function getFactorialsStepDrill(mode = "all") {
  let factorials = [...FACTORIALS_DATA];
  if (mode === "10") factorials = factorials.slice(0, 8);
  return factorials.map((item, idx) => {
    const q = createFactorialQuestion(item);
    const ansNum = Number(q.answer);
    const distractors = generateNumericDistractors(ansNum, ansNum > 500 ? 100 : 4);
    const options = shuffle([String(ansNum), ...distractors]);
    return sanitizeTelegramQuiz({
      id: `calc_factorial_${idx}_${Date.now()}`,
      question: `\u2757 [Factorials Step 6]
Calculate value of: ${item.n}!`,
      options,
      correctOption: options.indexOf(String(ansNum)),
      solution: `${item.n}! = ${item.breakdown} = ${item.val}`,
      subject: "Calculation Studio",
      topic: "Factorials 1\u20138",
      source: "Step 6: Factorials"
    });
  });
}
function getFractionsStepDrill(mode = "all") {
  let fractions = [...FRACTIONS_DATA];
  if (mode === "10") fractions = shuffle(fractions).slice(0, 10);
  return fractions.map((item, idx) => {
    const toPercent = Math.random() > 0.5;
    let question = "";
    let correct = "";
    let pool = [];
    if (toPercent) {
      question = `\u{1F4AF} [Fractions Step 7]
What is ${item.fraction} expressed as a percentage?`;
      correct = item.percentage;
      pool = FRACTIONS_DATA.map((f) => f.percentage).filter((p) => p !== correct);
    } else {
      question = `\u{1F4AF} [Fractions Step 7]
What fraction corresponds to ${item.percentage}?`;
      correct = item.fraction;
      pool = FRACTIONS_DATA.map((f) => f.fraction).filter((f) => f !== correct);
    }
    const distractors = shuffle(Array.from(new Set(pool))).slice(0, 3);
    const options = shuffle([correct, ...distractors]);
    return sanitizeTelegramQuiz({
      id: `calc_fraction_${idx}_${Date.now()}`,
      question,
      options,
      correctOption: options.indexOf(correct),
      solution: `${item.fraction} = ${item.percentage} (Decimal: ${item.decimal})`,
      subject: "Calculation Studio",
      topic: "Fractions & Percentages",
      source: "Step 7: Fractions"
    });
  });
}
function getDailyRoutineWorkout() {
  const q1 = getTripletsStepDrill("10").slice(0, 4);
  const q2 = getTablesStepDrill("10").slice(0, 4);
  const q3 = getSquaresStepDrill("10").slice(0, 4);
  const q4 = getCubesStepDrill("10").slice(0, 3);
  const q5 = getPowersStepDrill("10").slice(0, 4);
  const q6 = getFactorialsStepDrill("all").slice(0, 2);
  const q7 = getFractionsStepDrill("10").slice(0, 4);
  return [...q1, ...q2, ...q3, ...q4, ...q5, ...q6, ...q7];
}
function getSimplificationCatalog() {
  const sets = simplificationDrills_default;
  const categories = {
    Easy: [],
    Moderate: [],
    Hard: []
  };
  for (const s of sets) {
    const diff = s.difficulty || "Easy";
    if (categories[diff]) {
      categories[diff].push({
        id: s.id,
        title: s.title,
        totalQuestions: (s.questions || []).length,
        questions: s.questions || []
      });
    }
  }
  return [
    { difficulty: "Easy", title: `\u{1F7E2} Easy Sets (${categories.Easy.length} Sets)`, sets: categories.Easy },
    { difficulty: "Moderate", title: `\u{1F7E1} Moderate Sets (${categories.Moderate.length} Sets)`, sets: categories.Moderate },
    { difficulty: "Hard", title: `\u{1F534} Hard Sets (${categories.Hard.length} Sets)`, sets: categories.Hard }
  ];
}

// src/telegram/catalog.ts
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
var moduleDir2 = process.cwd();
try {
  moduleDir2 = path2.dirname(fileURLToPath2(import.meta.url));
} catch {
}
function resolveDataDir2(subPath) {
  const candidates = [
    path2.join(process.cwd(), "src", "data", subPath),
    path2.join(process.cwd(), "data", subPath),
    path2.join(moduleDir2, "src", "data", subPath),
    path2.join(moduleDir2, "..", "src", "data", subPath),
    path2.join(moduleDir2, "data", subPath)
  ];
  for (const c of candidates) {
    if (fs2.existsSync(c)) return c;
  }
  return candidates[0];
}
var CHAPTER_BANK_DIR2 = resolveDataDir2("chapter_bank");
var MOCK_ERRORS_DIR2 = resolveDataDir2("mock_errors");
function getEnglishCatalog() {
  const sections = [];
  const bbDir = path2.join(CHAPTER_BANK_DIR2, "english", "black_book");
  if (fs2.existsSync(bbDir)) {
    const bbTopics = [];
    const topicDefs = [
      { folder: "synonyms", code: "syn", label: "\u{1F524} Synonyms" },
      { folder: "one_word_substitution", code: "ows", label: "\u{1F4DD} One Word Substitution" },
      { folder: "phrasal_verbs", code: "phr", label: "\u{1F504} Phrasal Verbs" }
    ];
    for (const t of topicDefs) {
      const folderPath = path2.join(bbDir, t.folder);
      if (fs2.existsSync(folderPath)) {
        const files = fs2.readdirSync(folderPath).filter((f) => f.endsWith(".json")).sort((a, b) => {
          const numA = parseInt(a.replace(/[^0-9]/g, "") || "0", 10);
          const numB = parseInt(b.replace(/[^0-9]/g, "") || "0", 10);
          return numA - numB;
        });
        const sets = [];
        for (const file of files) {
          try {
            const filePath = path2.join(folderPath, file);
            const content = JSON.parse(fs2.readFileSync(filePath, "utf8"));
            const qs = content.questions || [];
            const setNum = file.replace(/[^0-9]/g, "") || "1";
            sets.push({
              id: `${t.code}_${setNum}`,
              code: setNum,
              title: content.chapter_title || `Set ${setNum}`,
              filePath,
              totalQuestions: qs.length
            });
          } catch {
          }
        }
        bbTopics.push({
          id: t.folder,
          code: t.code,
          title: t.label,
          sets
        });
      }
    }
    sections.push({
      id: "black_book",
      code: "bb",
      title: "\u{1F4DA} Black Book (Vocabulary)",
      topics: bbTopics
    });
  }
  const ayushDir = path2.join(CHAPTER_BANK_DIR2, "english", "ayush_vocab");
  if (fs2.existsSync(ayushDir)) {
    const ayushTopics = [];
    const topicDefs = [
      { folder: "idioms_and_phrases", code: "idiom", label: "\u{1F4AC} Idioms & Phrases" },
      { folder: "antonyms", code: "ant", label: "\u{1F521} Antonyms" },
      { folder: "spellings", code: "spell", label: "\u270D\uFE0F Spellings" }
    ];
    for (const t of topicDefs) {
      const folderPath = path2.join(ayushDir, t.folder);
      if (fs2.existsSync(folderPath)) {
        const files = fs2.readdirSync(folderPath).filter((f) => f.endsWith(".json")).sort((a, b) => {
          const numA = parseInt(a.replace(/[^0-9]/g, "") || "0", 10);
          const numB = parseInt(b.replace(/[^0-9]/g, "") || "0", 10);
          return numA - numB;
        });
        const sets = [];
        for (const file of files) {
          try {
            const filePath = path2.join(folderPath, file);
            const content = JSON.parse(fs2.readFileSync(filePath, "utf8"));
            const qs = content.questions || [];
            const setNum = file.replace(/[^0-9]/g, "") || "1";
            sets.push({
              id: `${t.code}_${setNum}`,
              code: setNum,
              title: content.chapter_title || `Set ${setNum}`,
              filePath,
              totalQuestions: qs.length
            });
          } catch {
          }
        }
        ayushTopics.push({
          id: t.folder,
          code: t.code,
          title: t.label,
          sets
        });
      }
    }
    sections.push({
      id: "ayush_vocab",
      code: "ayush",
      title: "\u{1F4D6} Ayush Vocab (Idioms & Antonyms)",
      topics: ayushTopics
    });
  }
  return sections;
}
function getMathCatalog() {
  const sections = [];
  const top500Dir = path2.join(CHAPTER_BANK_DIR2, "mathematics", "top500");
  if (fs2.existsSync(top500Dir)) {
    const topicFolders = fs2.readdirSync(top500Dir).filter((d) => fs2.statSync(path2.join(top500Dir, d)).isDirectory());
    const topics = [];
    for (const folder of topicFolders) {
      const folderPath = path2.join(top500Dir, folder);
      const files = fs2.readdirSync(folderPath).filter((f) => f.endsWith(".json")).sort();
      const sets = [];
      for (const file of files) {
        try {
          const filePath = path2.join(folderPath, file);
          const content = JSON.parse(fs2.readFileSync(filePath, "utf8"));
          const qs = content.questions || [];
          const setNum = file.replace(/[^0-9]/g, "") || "1";
          sets.push({
            id: `t500_${folder}_${setNum}`,
            code: setNum,
            title: `${folder} - Set ${setNum}`,
            filePath,
            totalQuestions: qs.length
          });
        } catch {
        }
      }
      topics.push({
        id: folder,
        code: folder.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase(),
        title: `\u{1F4CA} ${folder}`,
        sets
      });
    }
    sections.push({
      id: "top500",
      code: "t500",
      title: "\u{1F3C6} Top 500 Arithmetic & Advance",
      topics
    });
  }
  return sections;
}
function getGeneralAwarenessCatalog() {
  const gaDir = path2.join(CHAPTER_BANK_DIR2, "general_awareness");
  if (!fs2.existsSync(gaDir)) return [];
  const topicDefs = [
    { folder: "polity", code: "pol", title: "\u{1F3DB}\uFE0F Indian Polity & Constitution" },
    { folder: "history_modern", code: "hmod", title: "\u{1F4DC} Modern Indian History" },
    { folder: "history_ancient", code: "hanc", title: "\u{1F3F0} Ancient History" },
    { folder: "history_medieval", code: "hmed", title: "\u2694\uFE0F Medieval History" },
    { folder: "geography", code: "geo", title: "\u{1F30D} Geography" },
    { folder: "biology", code: "bio", title: "\u{1F9EC} Biology & Life Sciences" },
    { folder: "chemistry", code: "chem", title: "\u2697\uFE0F Chemistry" },
    { folder: "physics", code: "phy", title: "\u269B\uFE0F Physics" },
    { folder: "economics", code: "eco", title: "\u{1F4C8} Economics" },
    { folder: "static_gk", code: "stat", title: "\u{1F3AD} Static GK & Culture" }
  ];
  const topics = [];
  for (const t of topicDefs) {
    const folderPath = path2.join(gaDir, t.folder);
    if (fs2.existsSync(folderPath)) {
      const files = fs2.readdirSync(folderPath).filter((f) => f.endsWith(".json")).sort();
      const sets = [];
      for (const file of files) {
        try {
          const filePath = path2.join(folderPath, file);
          const content = JSON.parse(fs2.readFileSync(filePath, "utf8"));
          const qs = content.questions || [];
          const baseName = file.replace(".json", "");
          sets.push({
            id: `ga_${t.code}_${baseName.slice(0, 15)}`,
            code: baseName,
            title: content.chapter_title || baseName.replace(/_/g, " "),
            filePath,
            totalQuestions: qs.length
          });
        } catch {
        }
      }
      topics.push({
        id: t.folder,
        code: t.code,
        title: t.title,
        sets
      });
    }
  }
  return topics;
}
function getMockErrorsCatalog() {
  const subjects = [
    { id: "mathematics", code: "math", title: "\u{1F4D0} Mathematics Mistakes" },
    { id: "reasoning", code: "reason", title: "\u{1F9E0} Reasoning Mistakes" },
    { id: "english", code: "eng", title: "\u{1F4D6} English Mistakes" },
    { id: "general_awareness", code: "ga", title: "\u{1F3DB}\uFE0F General Awareness Mistakes" }
  ];
  const result = [];
  for (const s of subjects) {
    const filePath = path2.join(MOCK_ERRORS_DIR2, `${s.id}.json`);
    let totalQuestions = 0;
    const chapters = [];
    if (fs2.existsSync(filePath)) {
      try {
        const content = JSON.parse(fs2.readFileSync(filePath, "utf8"));
        if (Array.isArray(content)) {
          for (const item of content) {
            const count = item.questions && item.questions.length || 0;
            totalQuestions += count;
            chapters.push({
              title: item.chapter_title || item.title || "Error Group",
              count,
              chapterNum: item.chapter_num
            });
          }
        }
      } catch {
      }
    }
    result.push({
      subjectId: s.id,
      code: s.code,
      title: s.title,
      totalQuestions,
      chapters
    });
  }
  return result;
}
function resolveEnglishSetFile(secCode, topicCode, setCode) {
  const catalog = getEnglishCatalog();
  const sec = catalog.find((s) => s.code === secCode);
  const topic = sec?.topics.find((t) => t.code === topicCode);
  const set = topic?.sets.find((s) => s.code === setCode);
  if (!set) return null;
  return { filePath: set.filePath, title: set.title, total: set.totalQuestions };
}
function resolveMathSetFile(topicCode, setCode) {
  const catalog = getMathCatalog();
  for (const sec of catalog) {
    const topic = sec.topics.find((t) => t.code === topicCode || t.id.toLowerCase() === topicCode.toLowerCase());
    if (topic) {
      const set = topic.sets.find((s) => s.code === setCode);
      if (set) return { filePath: set.filePath, title: set.title, total: set.totalQuestions };
    }
  }
  return null;
}
function resolveGASetFile(topicCode, setCode) {
  const catalog = getGeneralAwarenessCatalog();
  const topic = catalog.find((t) => t.code === topicCode || t.id === topicCode);
  const set = topic?.sets.find((s) => s.code === setCode);
  if (!set) return null;
  return { filePath: set.filePath, title: set.title, total: set.totalQuestions };
}
function loadQuestionsFromSet(filePath, mode = "all") {
  try {
    if (!fs2.existsSync(filePath)) return [];
    const content = JSON.parse(fs2.readFileSync(filePath, "utf8"));
    const rawQs = content.questions || [];
    if (rawQs.length === 0) return [];
    let chosen = rawQs;
    if (mode === "10" && rawQs.length > 10) {
      chosen = shuffle(rawQs).slice(0, 10);
    }
    return chosen.map(
      (q, idx) => sanitizeTelegramQuiz({
        id: q.id || `set_q_${idx}_${Date.now()}`,
        question: q.question || q.questionText,
        options: q.options,
        correctOption: q.answer || q.correctOption || q.correct_answer,
        solution: q.solution,
        subject: content.subject,
        topic: content.topic_name || content.chapter_title,
        source: content.chapter_title || path2.basename(filePath, ".json")
      })
    );
  } catch (e) {
    console.error(`Error loading questions from ${filePath}:`, e);
    return [];
  }
}
function loadMockErrorsForSubject(subjectId, chapterNum, mode = "all") {
  try {
    const filePath = path2.join(MOCK_ERRORS_DIR2, `${subjectId}.json`);
    if (!fs2.existsSync(filePath)) return [];
    const content = JSON.parse(fs2.readFileSync(filePath, "utf8"));
    let matchedQs = [];
    if (Array.isArray(content)) {
      for (const item of content) {
        if (chapterNum !== void 0) {
          if (item.chapter_num === chapterNum && item.questions) {
            matchedQs.push(...item.questions);
          }
        } else if (item.questions) {
          matchedQs.push(...item.questions);
        }
      }
    }
    if (matchedQs.length === 0) return [];
    let chosen = matchedQs;
    if (mode === "10" && matchedQs.length > 10) {
      chosen = shuffle(matchedQs).slice(0, 10);
    }
    const subTitle = subjectId.charAt(0).toUpperCase() + subjectId.slice(1).replace("_", " ");
    return chosen.map(
      (q, idx) => sanitizeTelegramQuiz({
        id: `mock_err_${subjectId}_${idx}_${Date.now()}`,
        question: `\u{1F3AF} [${subTitle} Mistake]
${q.question || q.questionText}`,
        options: q.options,
        correctOption: q.answer || q.correctOption || q.correct_answer,
        solution: q.solution,
        subject: subTitle,
        topic: q.topic || q.conceptTested || "Error Bank",
        source: q.testName || "Mock Error Bank"
      })
    );
  } catch (e) {
    console.error(`Error loading mock errors for ${subjectId}:`, e);
    return [];
  }
}

// src/telegram/quizSession.ts
import fs3 from "fs";
import path3 from "path";
import os from "os";
var sessions = /* @__PURE__ */ new Map();
var pollToUserMap = /* @__PURE__ */ new Map();
var TMP_FILE = path3.join(os.tmpdir(), "cgl_bot_sessions.json");
function saveToDisk() {
  try {
    const data = {
      sessions: Array.from(sessions.entries()),
      pollMap: Array.from(pollToUserMap.entries())
    };
    fs3.writeFileSync(TMP_FILE, JSON.stringify(data), "utf8");
  } catch {
  }
}
function loadFromDisk() {
  try {
    if (fs3.existsSync(TMP_FILE)) {
      const parsed = JSON.parse(fs3.readFileSync(TMP_FILE, "utf8"));
      if (parsed.sessions) {
        for (const [k, v] of parsed.sessions) sessions.set(Number(k), v);
      }
      if (parsed.pollMap) {
        for (const [k, v] of parsed.pollMap) pollToUserMap.set(String(k), Number(v));
      }
    }
  } catch {
  }
}
loadFromDisk();
function startSession(userId, chatId, drillTitle, questions) {
  const session = {
    userId,
    chatId,
    drillTitle,
    questions,
    currentIndex: 0,
    score: 0,
    startTime: Date.now(),
    answeredCount: 0
  };
  sessions.set(userId, session);
  saveToDisk();
  return session;
}
function getSession(userId) {
  if (!sessions.has(userId)) loadFromDisk();
  return sessions.get(userId);
}
function registerActivePoll(pollId, userId) {
  pollToUserMap.set(pollId, userId);
  const session = sessions.get(userId);
  if (session) {
    session.activePollId = pollId;
  }
  saveToDisk();
}
function getSessionByPollId(pollId) {
  let userId = pollToUserMap.get(pollId);
  if (!userId) {
    loadFromDisk();
    userId = pollToUserMap.get(pollId);
  }
  if (!userId) return void 0;
  return sessions.get(userId);
}
function saveSession(session) {
  sessions.set(session.userId, session);
  saveToDisk();
}
function clearSession(userId) {
  const session = sessions.get(userId);
  if (session?.activePollId) {
    pollToUserMap.delete(session.activePollId);
  }
  sessions.delete(userId);
  saveToDisk();
}

// src/telegram/bot.ts
dotenv.config();
var token = process.env.TELEGRAM_BOT_TOKEN || "8573783956:AAF7SGdPHbfpJs2zH8tmQfXsUsVPBORAsHM";
var bot = new Bot(token);
bot.catch((err) => {
  console.error("[TelegramBot] Uncaught error during update handling:", err);
});
function getRootMenuKeyboard() {
  return new InlineKeyboard().text("\u{1F4C1} Chapter Bank", "nav_chapter_bank").row().text("\u{1F3AF} Mock Errors", "nav_mock_errors").row().text("\u26A1 Speed Lab", "nav_speed_lab").row().text("\u{1F4A1} Help & Guide", "nav_help");
}
function getChapterBankSubjectsKeyboard() {
  return new InlineKeyboard().text("\u{1F4D0} Mathematics", "cb_sub_math").text("\u{1F9E0} Reasoning", "cb_sub_reasoning").row().text("\u{1F4D6} English", "cb_sub_english").text("\u{1F3DB}\uFE0F General Awareness", "cb_sub_ga").row().text("\u2B05\uFE0F Back to Main Menu", "nav_root");
}
async function sendCurrentQuestion(botInstance, session) {
  if (session.currentIndex >= session.questions.length) {
    await sendCompletionSummary(botInstance, session);
    return;
  }
  const q = session.questions[session.currentIndex];
  const qNum = session.currentIndex + 1;
  const total = session.questions.length;
  if (q.preamble) {
    try {
      await botInstance.api.sendMessage(session.chatId, q.preamble, { parse_mode: "Markdown" });
    } catch {
    }
  }
  const header = `[Q ${qNum}/${total}]`;
  const formattedQuestion = `${header} ${q.question}`;
  try {
    const pollMsg = await botInstance.api.sendPoll(
      session.chatId,
      formattedQuestion.slice(0, 298),
      q.options,
      {
        type: "quiz",
        correct_option_ids: [q.correctOptionIndex],
        correct_option_id: q.correctOptionIndex,
        explanation: q.explanation || void 0,
        is_anonymous: false
      }
    );
    registerActivePoll(pollMsg.poll.id, session.userId);
  } catch (err) {
    console.error(`[TelegramBot] Error sending quiz poll (Q${qNum}):`, err?.message || err);
    await botInstance.api.sendMessage(
      session.chatId,
      `\u26A0\uFE0F Could not display in quiz poll format:

${q.question}

*Moving to next question...*`,
      { parse_mode: "Markdown" }
    );
    session.currentIndex++;
    await sendCurrentQuestion(botInstance, session);
  }
}
async function sendCompletionSummary(botInstance, session) {
  const durationSec = Math.max(1, Math.round((Date.now() - session.startTime) / 1e3));
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const timeFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  const total = session.questions.length;
  const score = session.score;
  const percentage = Math.round(score / total * 100);
  const speedPerQ = (durationSec / total).toFixed(1);
  let medal = "\u{1F3AF}";
  let comment = "";
  if (percentage >= 90) {
    medal = "\u{1F3C6} OUTSTANDING PERFORMANCE!";
    comment = "Top tier accuracy! Your concepts in this set are rock solid!";
  } else if (percentage >= 70) {
    medal = "\u{1F525} WELL DONE!";
    comment = "Great score! Review the couple of questions you missed.";
  } else if (percentage >= 50) {
    medal = "\u{1F44D} GOOD PROGRESS!";
    comment = "Solid foundation, practice this set once more for mastery.";
  } else {
    medal = "\u{1F4AA} KEEP WORKING!";
    comment = "Revisit the solutions and repeat the set to build confidence.";
  }
  const report = `${medal}

*${session.drillTitle}*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F3AF} *Total Score:* ${score} / ${total} (${percentage}%)
\u23F1\uFE0F *Time Taken:* ${timeFormatted}
\u26A1 *Average Pace:* ${speedPerQ}s / question
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
_${comment}_

*Where to next?*`;
  const afterQuizKeyboard = new InlineKeyboard().text("\u{1F4C1} Chapter Bank", "nav_chapter_bank").text("\u{1F3AF} Mock Errors", "nav_mock_errors").row().text("\u26A1 Speed Lab", "nav_speed_lab").text("\u{1F3E0} Main Menu", "nav_root");
  clearSession(session.userId);
  await botInstance.api.sendMessage(session.chatId, report, {
    parse_mode: "Markdown",
    reply_markup: afterQuizKeyboard
  });
}
async function startQuizForUser(userId, chatId, title, questions) {
  if (!questions || questions.length === 0) {
    await bot.api.sendMessage(
      chatId,
      `\u26A0\uFE0F No questions found for *${title}*. Please choose another section.`,
      {
        parse_mode: "Markdown",
        reply_markup: getRootMenuKeyboard()
      }
    );
    return;
  }
  const session = startSession(userId, chatId, title, questions);
  await bot.api.sendMessage(
    chatId,
    `\u{1F680} *${title}*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4DD} *Questions:* ${questions.length} Questions
\u{1F4A1} _Tap an answer on each quiz card below._
\u{1F6D1} _Type /stop anytime to end early and see your score._`,
    { parse_mode: "Markdown" }
  );
  await sendCurrentQuestion(bot, session);
}
bot.command(["start", "menu"], async (ctx) => {
  const name = ctx.from?.first_name || "Aspirant";
  const text = `\u{1F44B} *Welcome ${name} to your CGL Preparation Cockpit!*

Everything is structured just like the website:
\u2022 \u{1F4C1} *Chapter Bank:* Math, Reasoning, English (Black Book & Ayush), GA
\u2022 \u{1F3AF} *Mock Errors:* Revise mistakes by subject & chapter
\u2022 \u26A1 *Speed Lab:* Triplets, Fractions, Squares, Simplification

\u{1F449} *Select an area to explore:*`;
  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: getRootMenuKeyboard()
  });
});
bot.command("stop", async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session) {
    await ctx.reply("No active quiz is currently running. Send /menu to start one!");
    return;
  }
  await sendCompletionSummary(bot, session);
});
bot.command("help", async (ctx) => {
  const helpText = `\u{1F4A1} *CGL Bot Guide*

\u2022 /start or /menu \u2014 Open the main category menu
\u2022 /stop \u2014 Finish active test and generate score card

*How it works:*
1. Select Chapter Bank, Mock Errors, or Speed Lab
2. Pick your subject and topic
3. Choose a Set \u2014 then pick **Attempt ALL Questions** (full set) or **Quick 10**!
4. Instant feedback and solutions appear automatically as you tap.`;
  await ctx.reply(helpText, {
    parse_mode: "Markdown",
    reply_markup: getRootMenuKeyboard()
  });
});
bot.callbackQuery("nav_root", async (ctx) => {
  await ctx.editMessageText("\u{1F449} *Select an area to explore:*", {
    parse_mode: "Markdown",
    reply_markup: getRootMenuKeyboard()
  });
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("nav_chapter_bank", async (ctx) => {
  await ctx.editMessageText("\u{1F4C1} *Chapter Bank:* Select a subject:", {
    parse_mode: "Markdown",
    reply_markup: getChapterBankSubjectsKeyboard()
  });
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("cb_sub_english", async (ctx) => {
  const sections = getEnglishCatalog();
  const kb = new InlineKeyboard();
  for (const sec of sections) {
    kb.text(sec.title, `eng_sec:${sec.code}`).row();
  }
  kb.text("\u2B05\uFE0F Back to Subjects", "nav_chapter_bank");
  await ctx.editMessageText("\u{1F4D6} *English Chapter Bank:* Choose a book/source:", {
    parse_mode: "Markdown",
    reply_markup: kb
  });
  await ctx.answerCallbackQuery();
});
bot.callbackQuery(/^eng_sec:(bb|ayush)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const secCode = ctx.match[1];
  const sections = getEnglishCatalog();
  const sec = sections.find((s) => s.code === secCode);
  if (!sec) return;
  const kb = new InlineKeyboard();
  for (const topic of sec.topics) {
    kb.text(`${topic.title} (${topic.sets.length} Sets)`, `eng_top:${secCode}:${topic.code}`).row();
  }
  kb.text("\u2B05\uFE0F Back to Books", "cb_sub_english");
  await ctx.editMessageText(`\u{1F4D6} *${sec.title}:*
Choose a vocabulary topic:`, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^eng_top:(bb|ayush):([a-z_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const secCode = ctx.match[1];
  const topicCode = ctx.match[2];
  const sections = getEnglishCatalog();
  const sec = sections.find((s) => s.code === secCode);
  const topic = sec?.topics.find((t) => t.code === topicCode);
  if (!topic) return;
  const kb = new InlineKeyboard();
  for (let i = 0; i < topic.sets.length; i += 2) {
    const s1 = topic.sets[i];
    const s2 = topic.sets[i + 1];
    kb.text(`${s1.title} (${s1.totalQuestions} Qs)`, `eng_set:${secCode}:${topicCode}:${s1.code}`);
    if (s2) {
      kb.text(`${s2.title} (${s2.totalQuestions} Qs)`, `eng_set:${secCode}:${topicCode}:${s2.code}`);
    }
    kb.row();
  }
  kb.text("\u2B05\uFE0F Back to Topics", `eng_sec:${secCode}`);
  await ctx.editMessageText(`\u{1F524} *${topic.title}* (${topic.sets.length} Sets Available):
Select a set to practice:`, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^eng_set:(bb|ayush):([a-z_]+):([a-zA-Z0-9_\-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, secCode, topicCode, setCode] = ctx.match;
  const setInfo = resolveEnglishSetFile(secCode, topicCode, setCode);
  if (!setInfo) return;
  const kb = new InlineKeyboard().text(`\u{1F680} Practice ALL (${setInfo.total} Questions)`, `run_eng:${secCode}:${topicCode}:${setCode}:all`).row().text("\u26A1 Quick 10 Questions", `run_eng:${secCode}:${topicCode}:${setCode}:10`).row().text("\u2B05\uFE0F Back to Sets", `eng_top:${secCode}:${topicCode}`);
  const msg = `\u{1F4D6} *${setInfo.title}*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4DD} *Total Questions:* ${setInfo.total}

\u{1F449} *How would you like to practice?*`;
  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^run_eng:(bb|ayush):([a-z_]+):([a-zA-Z0-9_\-]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, secCode, topicCode, setCode, mode] = ctx.match;
  const setInfo = resolveEnglishSetFile(secCode, topicCode, setCode);
  if (!setInfo) return;
  const qs = loadQuestionsFromSet(setInfo.filePath, mode);
  const modeLabel = mode === "all" ? `All ${qs.length} Questions` : "Quick 10";
  await startQuizForUser(ctx.from.id, ctx.chat.id, `${setInfo.title} (${modeLabel})`, qs);
});
bot.callbackQuery("cb_sub_math", async (ctx) => {
  const mathSections = getMathCatalog();
  const kb = new InlineKeyboard();
  for (const sec of mathSections) {
    kb.text(sec.title, `math_sec:${sec.code}`).row();
  }
  kb.text("\u2B05\uFE0F Back to Subjects", "nav_chapter_bank");
  await ctx.editMessageText("\u{1F4D0} *Mathematics Chapter Bank:* Select module:", {
    parse_mode: "Markdown",
    reply_markup: kb
  });
  await ctx.answerCallbackQuery();
});
bot.callbackQuery(/^math_sec:(t500|pinnacle)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const secCode = ctx.match[1];
  const mathSections = getMathCatalog();
  const sec = mathSections.find((s) => s.code === secCode);
  if (!sec) return;
  const kb = new InlineKeyboard();
  for (let i = 0; i < sec.topics.length; i += 2) {
    const t1 = sec.topics[i];
    const t2 = sec.topics[i + 1];
    kb.text(t1.title, `math_top:${t1.code}`);
    if (t2) {
      kb.text(t2.title, `math_top:${t2.code}`);
    }
    kb.row();
  }
  kb.text("\u2B05\uFE0F Back to Modules", "cb_sub_math");
  await ctx.editMessageText(`\u{1F4D0} *${sec.title}:*
Choose a chapter to drill:`, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^math_top:([a-z0-9_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const topicCode = ctx.match[1];
  const catalog = getMathCatalog();
  let topicFound = null;
  for (const sec of catalog) {
    const t = sec.topics.find((x) => x.code === topicCode || x.id.toLowerCase() === topicCode.toLowerCase());
    if (t) {
      topicFound = t;
      break;
    }
  }
  if (!topicFound) return;
  const kb = new InlineKeyboard();
  for (const s of topicFound.sets) {
    kb.text(`\u25B6\uFE0F ${s.title} (${s.totalQuestions} Qs)`, `math_set:${topicCode}:${s.code}`).row();
  }
  kb.text("\u2B05\uFE0F Back to Math Chapters", "cb_sub_math");
  await ctx.editMessageText(`\u{1F4CA} *${topicFound.title}:*
Select set to practice:`, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^math_set:([a-zA-Z0-9_\-]+):([a-zA-Z0-9_\-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, topicCode, setCode] = ctx.match;
  const setInfo = resolveMathSetFile(topicCode, setCode);
  if (!setInfo) return;
  const kb = new InlineKeyboard().text(`\u{1F680} Practice ALL (${setInfo.total} Questions)`, `run_math:${topicCode}:${setCode}:all`).row().text("\u26A1 Quick 10 Questions", `run_math:${topicCode}:${setCode}:10`).row().text("\u2B05\uFE0F Back to Sets", `math_top:${topicCode}`);
  const msg = `\u{1F4CA} *${setInfo.title}*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4DD} *Total Questions in Set:* ${setInfo.total}

\u{1F449} *How would you like to practice?*`;
  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^run_math:([a-zA-Z0-9_\-]+):([a-zA-Z0-9_\-]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, topicCode, setCode, mode] = ctx.match;
  const setInfo = resolveMathSetFile(topicCode, setCode);
  if (!setInfo) return;
  const qs = loadQuestionsFromSet(setInfo.filePath, mode);
  const modeLabel = mode === "all" ? `All ${qs.length} Questions` : "Quick 10";
  await startQuizForUser(ctx.from.id, ctx.chat.id, `${setInfo.title} (${modeLabel})`, qs);
});
bot.callbackQuery("cb_sub_ga", async (ctx) => {
  const topics = getGeneralAwarenessCatalog();
  const kb = new InlineKeyboard();
  for (let i = 0; i < topics.length; i += 2) {
    const t1 = topics[i];
    const t2 = topics[i + 1];
    kb.text(t1.title, `ga_top:${t1.code}`);
    if (t2) {
      kb.text(t2.title, `ga_top:${t2.code}`);
    }
    kb.row();
  }
  kb.text("\u2B05\uFE0F Back to Subjects", "nav_chapter_bank");
  await ctx.editMessageText("\u{1F3DB}\uFE0F *General Awareness:* Select a subject:", {
    parse_mode: "Markdown",
    reply_markup: kb
  });
  await ctx.answerCallbackQuery();
});
bot.callbackQuery(/^ga_top:([a-z0-9_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const topicCode = ctx.match[1];
  const topics = getGeneralAwarenessCatalog();
  const topic = topics.find((t) => t.code === topicCode || t.id === topicCode);
  if (!topic) return;
  const kb = new InlineKeyboard();
  for (const s of topic.sets) {
    kb.text(`${s.title} (${s.totalQuestions} Qs)`, `ga_set:${topicCode}:${s.code}`).row();
  }
  kb.text("\u2B05\uFE0F Back to GA Subjects", "cb_sub_ga");
  await ctx.editMessageText(`\u{1F3DB}\uFE0F *${topic.title}* (${topic.sets.length} Chapters):
Choose a chapter to practice:`, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^ga_set:([a-z0-9_]+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, topicCode, setCode] = ctx.match;
  const setInfo = resolveGASetFile(topicCode, setCode);
  if (!setInfo) return;
  const kb = new InlineKeyboard().text(`\u{1F680} Practice ALL (${setInfo.total} Questions)`, `run_ga:${topicCode}:${setCode}:all`).row().text("\u26A1 Quick 10 Questions", `run_ga:${topicCode}:${setCode}:10`).row().text("\u2B05\uFE0F Back to Chapters", `ga_top:${topicCode}`);
  const msg = `\u{1F3DB}\uFE0F *${setInfo.title}*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4DD} *Total Questions in Chapter:* ${setInfo.total}

\u{1F449} *How would you like to practice?*`;
  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^run_ga:([a-zA-Z0-9_\-]+):(.+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, topicCode, setCode, mode] = ctx.match;
  const setInfo = resolveGASetFile(topicCode, setCode);
  if (!setInfo) return;
  const qs = loadQuestionsFromSet(setInfo.filePath, mode);
  const modeLabel = mode === "all" ? `All ${qs.length} Questions` : "Quick 10";
  await startQuizForUser(ctx.from.id, ctx.chat.id, `${setInfo.title} (${modeLabel})`, qs);
});
bot.callbackQuery("cb_sub_reasoning", async (ctx) => {
  const kb = new InlineKeyboard().text("\u{1F3AF} Practice ALL Reasoning Mock Mistakes", "run_mock:reasoning:all").row().text("\u26A1 Quick 10 Reasoning Mistakes", "run_mock:reasoning:10").row().text("\u2B05\uFE0F Back to Subjects", "nav_chapter_bank");
  await ctx.editMessageText("\u{1F9E0} *Reasoning Bank:*\nSelect practice mode below:", {
    parse_mode: "Markdown",
    reply_markup: kb
  });
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("nav_mock_errors", async (ctx) => {
  const catalog = getMockErrorsCatalog();
  const kb = new InlineKeyboard();
  for (const item of catalog) {
    kb.text(`${item.title} (${item.totalQuestions} Qs)`, `mock_sub:${item.subjectId}`).row();
  }
  kb.text("\u2B05\uFE0F Back to Main Menu", "nav_root");
  await ctx.editMessageText(
    "\u{1F3AF} *Mock Errors Bank:*\nReview all mistakes you made in full test series.\n\nSelect a subject:",
    {
      parse_mode: "Markdown",
      reply_markup: kb
    }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery(/^mock_sub:(mathematics|reasoning|english|general_awareness)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const subId = ctx.match[1];
  const catalog = getMockErrorsCatalog();
  const item = catalog.find((c) => c.subjectId === subId);
  if (!item) return;
  const kb = new InlineKeyboard().text(`\u{1F525} Practice ALL ${item.totalQuestions} Mistakes`, `run_mock:${subId}:all`).row().text(`\u26A1 Quick 10 Mistakes`, `run_mock:${subId}:10`).row();
  for (const ch of item.chapters) {
    if (ch.count > 0 && ch.chapterNum !== void 0) {
      kb.text(`\u{1F4C1} ${ch.title} (${ch.count} Qs)`, `run_mock_ch:${subId}:${ch.chapterNum}:all`).row();
    }
  }
  kb.text("\u2B05\uFE0F Back to Mock Subjects", "nav_mock_errors");
  const msg = `\u{1F3AF} *${item.title}*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Total Mistakes Logged: *${item.totalQuestions} Questions*

Select a practice option below:`;
  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^run_mock:([a-z_]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subId, mode] = ctx.match;
  const qs = loadMockErrorsForSubject(subId, void 0, mode);
  const subTitle = subId.charAt(0).toUpperCase() + subId.slice(1).replace("_", " ");
  const modeLabel = mode === "all" ? `All ${qs.length} Questions` : "Quick 10";
  await startQuizForUser(ctx.from.id, ctx.chat.id, `\u{1F3AF} ${subTitle} Mistakes (${modeLabel})`, qs);
});
bot.callbackQuery(/^run_mock_ch:([a-z_]+):([0-9]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subId, chNum, mode] = ctx.match;
  const qs = loadMockErrorsForSubject(subId, parseInt(chNum, 10), mode);
  const subTitle = subId.charAt(0).toUpperCase() + subId.slice(1).replace("_", " ");
  await startQuizForUser(ctx.from.id, ctx.chat.id, `\u{1F3AF} ${subTitle} Chapter ${chNum} Mistakes (${qs.length} Qs)`, qs);
});
bot.callbackQuery("nav_speed_lab", async (ctx) => {
  const kb = new InlineKeyboard().text("\u{1F9EE} Calculation Studio (7 Steps)", "speed_calc_studio").row().text("\u{1F4D0} Simplification Drills", "speed_simp_menu").row().text("\u{1F3C6} Daily 25-Q Routine Workout", "speed_routine").row().text("\u26A1 Rapid 10-Q Speed Blitz", "speed_mixed").row().text("\u2B05\uFE0F Back to Main Menu", "nav_root");
  await ctx.editMessageText(
    "\u26A1 *Speed Lab (Same as Website):*\n\n\u2022 *Calculation Studio:* Master all 7 building blocks\n\u2022 *Simplification Drills:* Easy, Moderate, & Hard sets\n\u2022 *Daily Workout:* 25 questions testing all 7 steps\n\n\u{1F449} *Choose your speed training mode:*",
    {
      parse_mode: "Markdown",
      reply_markup: kb
    }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("speed_calc_studio", async (ctx) => {
  const kb = new InlineKeyboard().text("Step 1: \u{1F4D0} Triplets (16 Qs)", "calc_step_triplets").row().text("Step 2: \u2716\uFE0F Tables 12\u201324 (13 Qs)", "calc_step_tables").row().text("Step 3: \u{1F522} Squares 17\u201339 (23 Qs)", "calc_step_squares").row().text("Step 4: \u{1F9CA} Cubes 11\u201325 (15 Qs)", "calc_step_cubes").row().text("Step 5: \u26A1 Powers 2\u20139 (38 Qs)", "calc_step_powers").row().text("Step 6: \u2757 Factorials 1\u20138 (8 Qs)", "calc_step_factorials").row().text("Step 7: \u{1F4AF} Fractions % (73 Qs)", "calc_step_fractions").row().text("\u2B05\uFE0F Back to Speed Lab", "nav_speed_lab");
  await ctx.editMessageText(
    "\u{1F9EE} *Calculation Studio (7 Steps)*\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\nSelect a step to master:",
    {
      parse_mode: "Markdown",
      reply_markup: kb
    }
  );
  await ctx.answerCallbackQuery();
});
function renderStepOptions(title, total, stepCode) {
  return new InlineKeyboard().text(`\u{1F680} Practice ALL (${total} Questions)`, `run_calc:${stepCode}:all`).row().text("\u26A1 Quick 10 Questions", `run_calc:${stepCode}:10`).row().text("\u2B05\uFE0F Back to Steps", "speed_calc_studio");
}
bot.callbackQuery("calc_step_triplets", async (ctx) => {
  await ctx.editMessageText(
    "\u{1F4D0} *Step 1: Primitive Triplets*\nTotal Questions: *16 Triplets*\n\nSelect practice mode:",
    { parse_mode: "Markdown", reply_markup: renderStepOptions("Triplets", 16, "triplets") }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("calc_step_tables", async (ctx) => {
  await ctx.editMessageText(
    "\u2716\uFE0F *Step 2: Multiplication Tables (12 to 24)*\nTotal Questions: *13 Tables*\n\nSelect practice mode:",
    { parse_mode: "Markdown", reply_markup: renderStepOptions("Tables", 13, "tables") }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("calc_step_squares", async (ctx) => {
  await ctx.editMessageText(
    "\u{1F522} *Step 3: Squares (17\xB2 to 39\xB2)*\nTotal Questions: *23 Squares*\n\nSelect practice mode:",
    { parse_mode: "Markdown", reply_markup: renderStepOptions("Squares", 23, "squares") }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("calc_step_cubes", async (ctx) => {
  await ctx.editMessageText(
    "\u{1F9CA} *Step 4: Cubes (11\xB3 to 25\xB3)*\nTotal Questions: *15 Cubes*\n\nSelect practice mode:",
    { parse_mode: "Markdown", reply_markup: renderStepOptions("Cubes", 15, "cubes") }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("calc_step_powers", async (ctx) => {
  await ctx.editMessageText(
    "\u26A1 *Step 5: Powers (2\u20139)*\nTotal Questions: *38 Powers*\n\nSelect practice mode:",
    { parse_mode: "Markdown", reply_markup: renderStepOptions("Powers", 38, "powers") }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("calc_step_factorials", async (ctx) => {
  await ctx.editMessageText(
    "\u2757 *Step 6: Factorials (1! to 8!)*\nTotal Questions: *8 Factorials*\n\nSelect practice mode:",
    { parse_mode: "Markdown", reply_markup: renderStepOptions("Factorials", 8, "factorials") }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery("calc_step_fractions", async (ctx) => {
  await ctx.editMessageText(
    "\u{1F4AF} *Step 7: Fractions \u2194 Percentages*\nTotal Questions: *73 Values*\n\nSelect practice mode:",
    { parse_mode: "Markdown", reply_markup: renderStepOptions("Fractions", 73, "fractions") }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery(/^run_calc:([a-z0-9_]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, step, mode] = ctx.match;
  let qs = [];
  let title = "";
  if (step === "triplets") {
    qs = getTripletsStepDrill(mode);
    title = `\u{1F4D0} Step 1: Triplets (${mode === "all" ? "All 16" : "10 Qs"})`;
  } else if (step === "tables") {
    qs = getTablesStepDrill(mode);
    title = `\u2716\uFE0F Step 2: Tables 12\u201324 (${mode === "all" ? "All 13" : "10 Qs"})`;
  } else if (step === "squares") {
    qs = getSquaresStepDrill(mode);
    title = `\u{1F522} Step 3: Squares 17\u201339 (${mode === "all" ? "All 23" : "10 Qs"})`;
  } else if (step === "cubes") {
    qs = getCubesStepDrill(mode);
    title = `\u{1F9CA} Step 4: Cubes 11\u201325 (${mode === "all" ? "All 15" : "10 Qs"})`;
  } else if (step === "powers") {
    qs = getPowersStepDrill(mode);
    title = `\u26A1 Step 5: Powers 2\u20139 (${mode === "all" ? "All 38" : "10 Qs"})`;
  } else if (step === "factorials") {
    qs = getFactorialsStepDrill(mode);
    title = `\u2757 Step 6: Factorials 1\u20138 (${mode === "all" ? "All 8" : "10 Qs"})`;
  } else if (step === "fractions") {
    qs = getFractionsStepDrill(mode);
    title = `\u{1F4AF} Step 7: Fractions \u2194 % (${mode === "all" ? "All 73" : "10 Qs"})`;
  }
  await startQuizForUser(ctx.from.id, ctx.chat.id, title, qs);
});
bot.callbackQuery("speed_simp_menu", async (ctx) => {
  const cat = getSimplificationCatalog();
  const kb = new InlineKeyboard();
  for (const c of cat) {
    kb.text(c.title, `simp_cat:${c.difficulty.toLowerCase()}`).row();
  }
  kb.text("\u2B05\uFE0F Back to Speed Lab", "nav_speed_lab");
  await ctx.editMessageText("\u{1F4D0} *Simplification Drills*\nChoose difficulty level:", {
    parse_mode: "Markdown",
    reply_markup: kb
  });
  await ctx.answerCallbackQuery();
});
bot.callbackQuery(/^simp_cat:([a-z]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const diffKey = ctx.match[1];
  const cat = getSimplificationCatalog();
  const chosen = cat.find((c) => c.difficulty.toLowerCase() === diffKey);
  if (!chosen) return;
  const kb = new InlineKeyboard();
  for (let i = 0; i < chosen.sets.length; i += 2) {
    const s1 = chosen.sets[i];
    const s2 = chosen.sets[i + 1];
    kb.text(`${s1.title} (10 Qs)`, `run_simp:${s1.id}`);
    if (s2) {
      kb.text(`${s2.title} (10 Qs)`, `run_simp:${s2.id}`);
    }
    kb.row();
  }
  kb.text("\u2B05\uFE0F Back to Difficulties", "speed_simp_menu");
  await ctx.editMessageText(`\u{1F4D0} *${chosen.title}*
Select a set to practice:`, {
    parse_mode: "Markdown",
    reply_markup: kb
  });
});
bot.callbackQuery(/^run_simp:([a-zA-Z0-9_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const setId = ctx.match[1];
  const allSets = getSimplificationCatalog().flatMap((c) => c.sets);
  const target = allSets.find((s) => s.id === setId);
  if (!target) return;
  const questions = target.questions.map(
    (q) => sanitizeTelegramQuiz({
      id: q.id || `simp_${q.q_num}`,
      question: `\u{1F4D0} [${target.title}]
${q.question}`,
      options: q.options,
      correctOption: q.answer || q.correctOption,
      solution: q.solution,
      subject: "Simplification",
      topic: target.title,
      source: target.title
    })
  );
  await startQuizForUser(ctx.from.id, ctx.chat.id, `\u{1F4D0} ${target.title} (All ${questions.length} Qs)`, questions);
});
bot.callbackQuery("speed_routine", async (ctx) => {
  await ctx.answerCallbackQuery();
  const qs = getDailyRoutineWorkout();
  await startQuizForUser(ctx.from.id, ctx.chat.id, "\u{1F3C6} Daily 25-Question Routine Workout", qs);
});
bot.callbackQuery("speed_mixed", async (ctx) => {
  await ctx.answerCallbackQuery();
  await startQuizForUser(ctx.from.id, ctx.chat.id, "\u26A1 Mixed Speed Blitz", generateMixedSpeedDrill(10));
});
bot.callbackQuery("nav_help", async (ctx) => {
  const helpText = `\u{1F4A1} *CGL Bot Navigation Guide*

1. *Chapter Bank* \u2014 All chapters in Math, English, GK & Reasoning.
2. *Mock Errors* \u2014 Directly attempt questions you missed in mocks.
3. *Full Set vs Quick 10* \u2014 Whenever you choose a set, you can practice **ALL questions** in that set or do a quick 10!
4. Type /stop anytime to finish early and see your score.`;
  await ctx.editMessageText(helpText, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard().text("\u2B05\uFE0F Back to Main Menu", "nav_root")
  });
  await ctx.answerCallbackQuery();
});
bot.on("poll_answer", async (ctx) => {
  const answer = ctx.pollAnswer;
  const pollId = answer.poll_id;
  const session = getSessionByPollId(pollId);
  if (!session) return;
  const currentQ = session.questions[session.currentIndex];
  if (!currentQ) return;
  const chosenOptionIndex = answer.option_ids[0];
  if (chosenOptionIndex === currentQ.correctOptionIndex) {
    session.score++;
  }
  session.answeredCount++;
  session.currentIndex++;
  saveSession(session);
  try {
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    await sendCurrentQuestion(bot, session);
  } catch (err) {
    console.error("[TelegramBot] Error sending next question:", err);
  }
});
async function launchBot() {
  if (!token) {
    console.warn("[TelegramBot] Bot token missing, skipping startup.");
    return;
  }
  console.log("[TelegramBot] Starting full website-mirrored Telegram bot via Long Polling...");
  bot.catch((err) => {
    console.error("[TelegramBot] Error encountered:", err);
  });
  bot.start({
    onStart: (botInfo) => {
      console.log(`[TelegramBot] Connected! Bot is running as @${botInfo.username}`);
    }
  });
}
var isDirectRun = Boolean(process.argv[1]?.replace(/\\/g, "/").endsWith("src/telegram/bot.ts"));
if (isDirectRun && !process.env.VERCEL) {
  launchBot();
}
var isInitialized = false;
async function ensureInit() {
  if (!isInitialized) {
    try {
      await bot.init();
      isInitialized = true;
    } catch (err) {
      console.error("[TelegramBot] bot.init() error:", err);
    }
  }
}
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method === "GET") {
    await ensureInit();
    return res.status(200).json({
      status: "online",
      message: "Telegram Webhook is live 24/7 on Vercel!",
      bot: bot.botInfo ? `@${bot.botInfo.username}` : "@my_cgl_bot",
      initialized: isInitialized,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  if (req.method === "POST") {
    try {
      await ensureInit();
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
        }
      }
      if (body) {
        await bot.handleUpdate(body);
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[VercelWebhook Error]", err);
      return res.status(200).json({ ok: true });
    }
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}
export {
  bot,
  handler as default,
  launchBot
};
