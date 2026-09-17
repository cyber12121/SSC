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
    <div key={`table-${keyPrefix}`} className="my-2.5 overflow-x-auto">
      <table className="min-w-full text-xs sm:text-sm border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
        <thead className="bg-slate-50 font-semibold text-slate-800">
          <tr>
            {headerRow.map((h, i) => (
              <th key={i} className="px-3 py-1.5 text-left border-r border-slate-200 last:border-r-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {bodyRows.map((row, ri) => (
            <tr key={ri} className="hover:bg-slate-50/60">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 border-r border-slate-100 last:border-r-0 font-medium">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderTextWithTables(text: string, tokenIdx: number) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let textBuffer: string[] = [];

  const flushText = () => {
    if (textBuffer.length > 0) {
      elements.push(
        <span key={`text-${tokenIdx}-${elements.length}`} className="whitespace-pre-line">
          {textBuffer.join('\n')}
        </span>
      );
      textBuffer = [];
    }
  };

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      elements.push(renderTableBlock(tableBuffer, `${tokenIdx}-${elements.length}`));
      tableBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');

    if (isTableLine) {
      flushText();
      tableBuffer.push(line);
    } else {
      flushTable();
      textBuffer.push(line);
    }
  }

  flushTable();
  flushText();

  return elements;
}

function renderTokenList(tokens: MathToken[]) {
  return tokens.map((token, idx) => {
    if (token.type === 'math') {
      const sanitized = sanitizeLatexForKatex(token.value);
      try {
        const html = katex.renderToString(sanitized, {
          throwOnError: false,
          displayMode: Boolean(token.display),
        });

        // If KaTeX produced an error span, recover with a clean pill
        if (html.includes('class="katex-error"')) {
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
      } catch {
        return (
          <span
            key={idx}
            className="font-mono text-xs px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 inline-block align-baseline"
          >
            {token.value}
          </span>
        );
      }
    }

    return (
      <React.Fragment key={idx}>
        {renderTextWithTables(token.value, idx)}
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

  if (!localized) return null;

  // If instruction was found in an English or Reasoning question:
  if (parsedQuestion && parsedQuestion.instruction) {
    const instTokens = tokenizeTextWithMath(parsedQuestion.instruction);
    const contentTokens = tokenizeTextWithMath(parsedQuestion.content);

    return (
      <Component className={className}>
        <div className="font-bold text-slate-900 mb-2 leading-relaxed">
          {renderTokenList(instTokens)}
        </div>
        <div className="text-slate-800 leading-relaxed font-normal">
          {renderTokenList(contentTokens)}
        </div>
      </Component>
    );
  }

  return (
    <Component className={className}>
      {renderTokenList(tokens)}
    </Component>
  );
});

export default FormattedText;


