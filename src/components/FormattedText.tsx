import React, { useMemo } from 'react';
import katex from 'katex';
import { getLanguageText, tokenizeTextWithMath, splitInstructionAndQuestion, MathToken } from '../utils/formatQuestionText';
import { sanitizeLatexForKatex } from '../utils/mathSanitizer';

interface FormattedTextProps {
  text?: string;
  language?: 'English' | 'Hindi' | 'Bilingual' | string;
  className?: string;
  as?: 'span' | 'p' | 'div';
  isQuestion?: boolean;
  subject?: string;
  breakOnSentences?: boolean;
}

function formatInlineMarkdown(text: string): React.ReactNode {
  if (!text) return text;
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={i} className="text-slate-800 italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-xs border border-slate-200">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderTableBlock(tableLines: string[], keyPrefix: string | number) {
  if (tableLines.length === 0) return null;
  const rows = tableLines.map(line =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(cell => cell.trim())
  );

  const headerRow = rows[0];
  const isSeparator = (row: string[]) => row.every(c => /^[-:\s]+$/.test(c));
  const bodyRows = rows.slice(1).filter(r => !isSeparator(r));

  return (
    <div key={`table-${keyPrefix}`} className="my-2.5 overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
      <table className="min-w-full text-xs sm:text-sm divide-y divide-slate-200">
        <thead className="bg-slate-50/90 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
          <tr>
            {headerRow.map((h, i) => (
              <th key={i} className="px-3.5 py-2 text-left border-r border-slate-200 last:border-r-0">
                {formatInlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {bodyRows.map((row, ri) => (
            <tr key={ri} className="hover:bg-slate-50/80 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3.5 py-2 border-r border-slate-100 last:border-r-0 font-normal">
                  {formatInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderTextWithTables(text: string, tokenIdx: number, breakOnSentences = false) {
  // When breakOnSentences is true, replace ". " with ".\n" so each sentence
  // starts on its own line (used in solution view).
  let processedText = breakOnSentences
    ? text.replace(/\.\s+(?=[A-Z\u0900-\u097F"'([])/g, '.\n')
    : text;

  // Split steps on ⇒ and ∴ so each mathematical step and conclusion is on its own line
  processedText = processedText
    .replace(/([^\n])\s*([⇒∴])/g, '$1\n$2')
    .replace(/([^\n])\s*\b(Formula\s*:)/gi, '$1\n$2');

  // Enforce line breaks for Para Jumble segments (P:, Q:, R:, S:, S1:, S6:, Given:)
  processedText = processedText
    .replace(/([^\n])\s*([PQRS]\s*:|\([PQRS]\)\s*|\[[PQRS]\]\s*)/g, '$1\n$2')
    .replace(/([^\n])\s*(S[1-6]\s*:)/g, '$1\n$2')
    .replace(/([^\n])\s*(Given\s*:)/gi, '$1\n$2');

  const lines = processedText.split('\n');
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      elements.push(renderTableBlock(tableBuffer, `${tokenIdx}-${elements.length}`));
      tableBuffer = [];
    }
  };

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    const isTableLine = line.startsWith('|') && line.endsWith('|');

    if (isTableLine) {
      tableBuffer.push(rawLine);
      return;
    }

    if (tableBuffer.length > 0) {
      flushTable();
    }

    // Empty line
    if (!line) {
      elements.push(<div key={`br-${tokenIdx}-${i}`} className="h-2" />);
      return;
    }

    // Purge Hindi explanation headers or standalone Devanagari lines completely (must contain actual Devanagari characters)
    if (/^(?:📖|📌|💡|🔍)?\s*हिंदी\s*स्पष्टीकरण/i.test(line) || (/[\u0900-\u097F]/.test(line) && /^[\u0900-\u097F\s:.\-0-9()]+$/.test(line))) {
      return;
    }

    // Explanation / Section Headers (e.g. 📖 English Explanation:, Key Formula:)
    if (/^(?:📖|📌|💡|🔍)?\s*(?:English\s+Explanation|Key\s+Formula|Important\s+Formula|Note):/i.test(line)) {
      elements.push(
        <div
          key={`header-${tokenIdx}-${i}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 my-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold text-xs shadow-2xs"
        >
          {line}
        </div>
      );
      return;
    }

    // Mathematical derivation step (⇒ or =>)
    if (/^[⇒=>]/.test(line)) {
      elements.push(
        <div key={`step-${tokenIdx}-${i}`} className="flex items-start gap-2 my-1.5 text-slate-800 leading-relaxed font-mono text-[13.5px]">
          <span className="text-indigo-600 font-bold shrink-0 mt-0.5">⇒</span>
          <span className="flex-1 font-sans">{formatInlineMarkdown(line.replace(/^[⇒=>]+\s*/, ''))}</span>
        </div>
      );
      return;
    }

    // Mathematical conclusion (∴)
    if (/^∴/.test(line)) {
      elements.push(
        <div key={`concl-${tokenIdx}-${i}`} className="flex items-start gap-2 my-2 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 font-semibold text-xs sm:text-sm">
          <span className="text-emerald-700 font-bold shrink-0 mt-0.5">∴</span>
          <span className="flex-1">{formatInlineMarkdown(line.replace(/^∴\s*/, ''))}</span>
        </div>
      );
      return;
    }

    // Bullet points (·, •, -, *)
    const bulletMatch = line.match(/^([·•\-\*])\s*(.*)/);
    if (bulletMatch) {
      const bulletContent = bulletMatch[2] || '';
      // Check if this bullet discusses a statement correctness (e.g. Statement I is incorrect/correct)
      const statementMatch = bulletContent.match(/^(Statement\s+[I|V|X|0-9]+)\s+is\s+(correct|incorrect)(.*)/i);
      if (statementMatch) {
        const isCorrect = statementMatch[2].toLowerCase() === 'correct';
        elements.push(
          <div key={`stmt-${tokenIdx}-${i}`} className="flex items-start gap-2 my-1 text-slate-800 leading-relaxed text-xs sm:text-sm">
            <span
              className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider shrink-0 mt-0.5 ${
                isCorrect
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {statementMatch[1]}: {isCorrect ? 'Correct' : 'Incorrect'}
            </span>
            <span>{formatInlineMarkdown(statementMatch[3]?.replace(/^[:\s-]+/, ''))}</span>
          </div>
        );
        return;
      }

      elements.push(
        <div key={`bullet-${tokenIdx}-${i}`} className="flex items-start gap-2 my-1 text-slate-800 leading-relaxed text-xs sm:text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0 ring-2 ring-indigo-100" />
          <span>{formatInlineMarkdown(bulletContent)}</span>
        </div>
      );
      return;
    }

    // Para Jumbles (Given:, P:, Q:, R:, S:, S1:, S6:, (P), [P])
    const pjMatch = line.match(/^(?:(Given:)|([PQRS]\s*:|\([PQRS]\)|\[[PQRS]\]|S[1-6]\s*:))\s*(.*)/i);
    if (pjMatch) {
      const label = pjMatch[1] || pjMatch[2] || '';
      const rest = pjMatch[3] || '';
      elements.push(
        <div
          key={`pj-${tokenIdx}-${i}`}
          className="my-1.5 pl-3 border-l-2 border-indigo-400 bg-slate-50/70 rounded-r-md py-1 text-slate-800 leading-relaxed font-normal flex items-baseline gap-2"
        >
          <span className="font-bold text-indigo-700 font-mono shrink-0">{label}</span>
          <span className="flex-1">{formatInlineMarkdown(rest)}</span>
        </div>
      );
      return;
    }

    // Statements and Conclusions
    const stmtMatch = line.match(/^((?:Statement|Conclusion)\s+[I|V|X|\d]+:?)\s*(.*)/i);
    if (stmtMatch) {
      elements.push(
        <div
          key={`stmt-${tokenIdx}-${i}`}
          className="my-1.5 pl-3 border-l-2 border-slate-300 bg-slate-50/50 rounded-r-md py-1 text-slate-800 leading-relaxed font-normal flex items-baseline gap-2"
        >
          <span className="font-bold text-slate-700 shrink-0">{stmtMatch[1]}</span>
          <span className="flex-1">{formatInlineMarkdown(stmtMatch[2])}</span>
        </div>
      );
      return;
    }

    // Standard sentence or paragraph
    if (breakOnSentences || lines.length > 1) {
      elements.push(
        <div key={`text-${tokenIdx}-${i}`} className="text-slate-800 leading-relaxed my-1">
          {formatInlineMarkdown(rawLine)}
        </div>
      );
    } else {
      elements.push(
        <span key={`text-${tokenIdx}-${i}`} className="inline text-slate-800 leading-relaxed">
          {formatInlineMarkdown(rawLine)}{' '}
        </span>
      );
    }
  });

  if (tableBuffer.length > 0) {
    flushTable();
  }

  return elements;
}

const katexHtmlCache = new Map<string, string>();

function getCachedKatexHtml(latex: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? 'D:' : 'I:'}${latex}`;
  const cached = katexHtmlCache.get(cacheKey);
  if (cached) return cached;

  const sanitized = sanitizeLatexForKatex(latex);
  try {
    const html = katex.renderToString(sanitized, {
      throwOnError: false,
      displayMode,
    });
    if (katexHtmlCache.size > 2000) {
      const firstKey = katexHtmlCache.keys().next().value;
      if (firstKey) katexHtmlCache.delete(firstKey);
    }
    katexHtmlCache.set(cacheKey, html);
    return html;
  } catch {
    return '';
  }
}

function renderTokenList(tokens: MathToken[], breakOnSentences = false) {
  return tokens.map((token, idx) => {
    if (token.type === 'math') {
      const html = getCachedKatexHtml(token.value, Boolean(token.display));

      // If KaTeX produced an error span or failed, recover with a clean pill
      if (!html || html.includes('class="katex-error"')) {
        return (
          <span
            key={idx}
            className="font-mono text-xs px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 inline-block align-baseline"
          >
            {token.value}
          </span>
        );
      }

      return (
        <span
          key={idx}
          className={token.display ? 'block my-2 overflow-x-auto text-center' : 'inline-block px-0.5 align-baseline'}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    return (
      <React.Fragment key={idx}>
        {renderTextWithTables(token.value, idx, breakOnSentences)}
      </React.Fragment>
    );
  });
}

export const FormattedText: React.FC<FormattedTextProps> = React.memo(({
  text = '',
  language = 'English',
  className = '',
  as: Component = 'span',
  isQuestion = false,
  subject,
  breakOnSentences = false,
}) => {
  const localized = useMemo(() => {
    if (!text) return '';
    return getLanguageText(text, (language as any) || 'English');
  }, [text, language]);

  const parsedQuestion = useMemo(() => {
    if (!isQuestion || !localized) return null;
    return splitInstructionAndQuestion(localized, subject);
  }, [isQuestion, localized, subject]);

  const tokens = useMemo(() => {
    if (!localized) return [];
    return tokenizeTextWithMath(localized);
  }, [localized]);

  const renderedContent = useMemo(() => {
    if (!localized) return null;

    if (parsedQuestion && parsedQuestion.instruction) {
      const instTokens = tokenizeTextWithMath(parsedQuestion.instruction);
      const contentTokens = tokenizeTextWithMath(parsedQuestion.content);

      return (
        <>
          <div className="font-bold text-slate-900 mb-2 leading-relaxed">
            {renderTokenList(instTokens, breakOnSentences)}
          </div>
          <div className="text-slate-800 leading-relaxed font-normal">
            {renderTokenList(contentTokens, breakOnSentences)}
          </div>
        </>
      );
    }

    return renderTokenList(tokens, breakOnSentences);
  }, [localized, parsedQuestion, tokens, breakOnSentences]);

  if (!localized) return null;

  return (
    <Component className={className}>
      {renderedContent}
    </Component>
  );
});

export default FormattedText;


