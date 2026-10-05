import React, { useState } from 'react';
import katex from 'katex';
import {
  Zap,
  AlertTriangle,
  Lightbulb,
  Calculator,
  Check,
  Copy,
  Brain,
  Quote
} from 'lucide-react';
import { sanitizeLatexForKatex, normalizeChatLatex } from '../utils/mathSanitizer';

// KaTeX HTML rendering cache for high performance
const katexHtmlCache = new Map<string, string>();

function renderKatexMath(latex: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? 'D:' : 'I:'}${latex}`;
  const cached = katexHtmlCache.get(cacheKey);
  if (cached) return cached;

  const trimmed = (latex || '').trim();
  const sanitized = sanitizeLatexForKatex(trimmed);
  try {
    let html = katex.renderToString(sanitized, {
      throwOnError: false,
      displayMode,
    });

    // If KaTeX rendered an error span, attempt recovery or text fallback
    if (html.includes('class="katex-error"') || html.includes('katex-error') || html.includes('color:#cc0000')) {
      const fallbackClean = sanitized
        .replace(/\\times\s*$/, '')
        .replace(/[+\-*/=]\s*$/, '')
        .trim();
      if (fallbackClean && fallbackClean !== sanitized) {
        const retryHtml = katex.renderToString(fallbackClean, { throwOnError: false, displayMode });
        if (!retryHtml.includes('katex-error') && !retryHtml.includes('color:#cc0000')) {
          html = retryHtml;
        }
      }

      if (html.includes('katex-error') || html.includes('color:#cc0000')) {
        const specialFixed = sanitized
          .replace(/(?<!\\)#/g, '\\#')
          .replace(/(?<!\\)%/g, '\\%')
          .replace(/(?<!\\)&/g, '\\&')
          .replace(/\\text\{([^}]*)\}/g, (_, inner) => `\\text{${inner.replace(/(?<!\\)([#%&_])/g, '\\$1')}}`);
        const lCount = (specialFixed.match(/\\left\b/g) || []).length;
        const rCount = (specialFixed.match(/\\right\b/g) || []).length;
        const closed = lCount > rCount ? specialFixed + ' \\right.'.repeat(lCount - rCount) : specialFixed;

        if (closed !== sanitized) {
          const retrySpecialHtml = katex.renderToString(closed, { throwOnError: false, displayMode });
          if (!retrySpecialHtml.includes('katex-error') && !retrySpecialHtml.includes('color:#cc0000')) {
            html = retrySpecialHtml;
          }
        }
      }
    }

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

// Code / Solution Block with 1-click Copy
const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl bg-slate-900 text-slate-100 overflow-hidden border border-slate-800 shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-slate-300">
          <Brain className="w-3.5 h-3.5 text-indigo-400" /> Solution Step / Code
        </span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1 py-0.5 px-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer text-[10px]"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-bold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 font-mono text-xs overflow-x-auto leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Rich Visual Callout Cards
interface CalloutProps {
  type: 'shortcut' | 'trap' | 'concept' | 'formula' | 'general';
  lines: string[];
  formatInline: (t: string) => React.ReactNode;
}

const CalloutCard: React.FC<CalloutProps> = ({ type, lines, formatInline }) => {
  const renderCalloutLines = (rawLines: string[], titleRegex: RegExp) => {
    return rawLines.map((l, i) => {
      const cleanLine = l.replace(titleRegex, '').trim();
      if (!cleanLine) return null;

      // Bullet item inside callout
      if (/^[\*\-•]\s+/.test(cleanLine)) {
        const itemText = cleanLine.replace(/^[\*\-•]\s+/, '');
        return (
          <div key={i} className="flex items-start gap-2 my-1">
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 mt-1.5 shrink-0" />
            <span className="leading-relaxed flex-1">{formatInline(itemText)}</span>
          </div>
        );
      }

      // Numbered item inside callout
      const numMatch = cleanLine.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={i} className="flex items-start gap-2 my-1">
            <span className="w-4 h-4 rounded-full bg-black/5 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
              {numMatch[1]}
            </span>
            <span className="leading-relaxed flex-1">{formatInline(numMatch[2])}</span>
          </div>
        );
      }

      return (
        <p key={i} className="my-1 leading-relaxed">
          {formatInline(cleanLine)}
        </p>
      );
    });
  };

  if (type === 'shortcut') {
    return (
      <div className="my-3 rounded-xl border border-amber-300/80 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-orange-500/5 p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-amber-200/60 font-extrabold text-amber-900 text-xs uppercase tracking-wider">
          <div className="p-1 rounded-md bg-amber-500 text-white shadow-2xs">
            <Zap className="w-3.5 h-3.5 fill-current" />
          </div>
          <span>30-Second Shortcut Trick</span>
        </div>
        <div className="text-xs text-amber-950 leading-relaxed font-medium">
          {renderCalloutLines(lines, /^[>⚡\s\*]*(?:30-Second\s*Shortcut(?::)?|\*\*30-Second\s*Shortcut:\*\*)/i)}
        </div>
      </div>
    );
  }

  if (type === 'trap') {
    return (
      <div className="my-3 rounded-xl border border-rose-300/80 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-pink-500/5 p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-rose-200/60 font-extrabold text-rose-900 text-xs uppercase tracking-wider">
          <div className="p-1 rounded-md bg-rose-500 text-white shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <span>Trap Alert & Common Mistake</span>
        </div>
        <div className="text-xs text-rose-950 leading-relaxed font-medium">
          {renderCalloutLines(lines, /^[>⚠️\s\*]*(?:Trap\s*Alert(?::)?|\*\*Trap\s*Alert:\*\*)/i)}
        </div>
      </div>
    );
  }

  if (type === 'concept') {
    return (
      <div className="my-3 rounded-xl border border-indigo-300/80 bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-blue-500/5 p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-indigo-200/60 font-extrabold text-indigo-900 text-xs uppercase tracking-wider">
          <div className="p-1 rounded-md bg-indigo-600 text-white shadow-2xs">
            <Lightbulb className="w-3.5 h-3.5" />
          </div>
          <span>Core Concept & Rule</span>
        </div>
        <div className="text-xs text-indigo-950 leading-relaxed font-medium">
          {renderCalloutLines(lines, /^[>💡\s\*]*(?:Core\s*Concept(?::)?|\*\*Core\s*Concept:\*\*)/i)}
        </div>
      </div>
    );
  }

  if (type === 'formula') {
    return (
      <div className="my-3 rounded-xl border border-emerald-300/80 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-teal-500/5 p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-emerald-200/60 font-extrabold text-emerald-900 text-xs uppercase tracking-wider">
          <div className="p-1 rounded-md bg-emerald-600 text-white shadow-2xs">
            <Calculator className="w-3.5 h-3.5" />
          </div>
          <span>Key Formula Vault</span>
        </div>
        <div className="text-xs text-emerald-950 leading-relaxed font-medium">
          {renderCalloutLines(lines, /^[>📐\s\*]*(?:Key\s*Formula(?::)?|\*\*Key\s*Formula:\*\*)/i)}
        </div>
      </div>
    );
  }

  return (
    <div className="my-2.5 pl-3.5 pr-3 py-2.5 rounded-r-xl border-l-4 border-amber-400 bg-stone-100/80 text-xs text-stone-800 italic">
      <div className="flex items-center gap-1.5 text-stone-500 not-italic text-[10px] font-bold uppercase tracking-wider mb-1">
        <Quote className="w-3 h-3 text-amber-500" /> Note Highlight
      </div>
      <div className="not-italic font-normal">
        {lines.map((l, i) => (
          <p key={i} className="my-0.5">{formatInline(l)}</p>
        ))}
      </div>
    </div>
  );
};

export interface FormattedAiNoteProps {
  content: string;
  className?: string;
  variant?: 'notebook' | 'chat';
  isStreaming?: boolean;
}

/**
 * Universal Markdown & KaTeX Note Renderer:
 * Renders notes saved by Tommy AI, revision notes, and chat answers with:
 * 1. KaTeX Math ($...$ inline and $$...$$ display)
 * 2. Responsive Markdown Tables with clean header/body styling
 * 3. Color-coded Callouts (Core Concept, Trap Alert, 30-Sec Shortcut, Formula)
 * 4. Headings (###, ##, #)
 * 5. Ordered & unordered lists
 * 6. Code blocks with copy buttons
 * 7. Horizontal dividers
 */
export const FormattedAiNote: React.FC<FormattedAiNoteProps> = React.memo(({
  content,
  className = '',
  variant = 'notebook',
  isStreaming = false
}) => {
  if (!content) return null;

  const normalized = normalizeChatLatex(content);
  const lines = (normalized || '').split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let tableBuffer: string[] = [];
  let quoteBuffer: string[] = [];

  const formatInline = (text: string): React.ReactNode => {
    if (!text) return null;
    // Regex splits for display math $$...$$, inline math $...$, bold, italic, code, strikethrough
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|~~[^~]+?~~)/g);
    return parts.map((part, i) => {
      if (!part) return null;

      // Display math $$...$$
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
        const math = part.slice(2, -2);
        const html = renderKatexMath(math, true);
        if (html) {
          return (
            <span
              key={i}
              className="block my-2 overflow-x-auto text-center font-serif text-stone-900"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={i} className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1 rounded">{math}</span>;
      }

      // Inline math $...$
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const math = part.slice(1, -1);
        const trimmedMath = math.trim();
        // If it's a plain scalar number, render cleanly without KaTeX overhead or dollar noise
        if (/^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/.test(trimmedMath)) {
          return <span key={i}>{trimmedMath}</span>;
        }
        const html = renderKatexMath(trimmedMath, false);
        if (html) {
          return (
            <span
              key={i}
              className="inline-block px-0.5 align-baseline font-serif"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={i} className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1 rounded">{trimmedMath}</span>;
      }

      // Bold: **...** (recursively formats inner content so math inside bold is rendered)
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} className="font-bold text-stone-900">
            {formatInline(part.slice(2, -2))}
          </strong>
        );
      }

      // Italic: *...* (recursively formats inner content so math inside italic is rendered)
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2 && !part.startsWith('**')) {
        return (
          <em key={i} className="text-stone-800 italic">
            {formatInline(part.slice(1, -1))}
          </em>
        );
      }

      // Strikethrough: ~~...~~
      if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
        return (
          <del key={i} className="text-stone-500 line-through">
            {formatInline(part.slice(2, -2))}
          </del>
        );
      }

      // Code: `...`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-stone-200/70 text-indigo-700 font-mono text-xs border border-stone-300/60 font-medium">
            {part.slice(1, -1)}
          </code>
        );
      }

      // Fallback: If any dollar signs remain in plain text chunks, render or strip them so raw '$' never leaks
      if (part.includes('$')) {
        const cleaned = part.replace(/\$([^\$\n]+?)\$/g, (_, innerMath) => {
          const trimmedMath = innerMath.trim();
          if (/^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/.test(trimmedMath)) return trimmedMath;
          const html = renderKatexMath(trimmedMath, false);
          return html || trimmedMath;
        });
        if (cleaned !== part) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: cleaned }} />;
        }
      }

      // Clean plain text fallback from any stray raw \text{} or ext-prefixed words
      return part
        .replace(/\\text\{([^}]*)\}/g, '$1')
        .replace(/\\textbf\{([^}]*)\}/g, '$1')
        .replace(/(?<![a-zA-Z\\])ext([A-Z][a-zA-Z]*)/g, '$1');
    });
  };

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer.map(r =>
      r
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(c => c.trim())
    );

    const isSeparatorRow = (row: string[]) =>
      row.length > 0 && row.every(cell => /^[-:\s]+$/.test(cell) && cell.includes('-'));

    const hasHeader = rows.length > 1 && isSeparatorRow(rows[1]);
    const headerRow = hasHeader ? rows[0] : null;
    const bodyRows = hasHeader ? rows.slice(2) : rows;

    elements.push(
      <div
        key={`table-${elements.length}`}
        className="my-3 overflow-x-auto rounded-xl border border-stone-300/80 bg-white shadow-2xs"
      >
        <table className="min-w-full text-left text-xs divide-y divide-stone-200 border-collapse">
          {headerRow && (
            <thead className="bg-stone-100/90 text-stone-900 border-b border-stone-200 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                {headerRow.map((cell, idx) => (
                  <th key={idx} className="px-3.5 py-2 font-bold border-r border-stone-200 last:border-r-0">
                    {formatInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-stone-100 bg-white">
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-amber-50/40 transition-colors">
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-3.5 py-2 text-stone-800 leading-relaxed font-normal border-r border-stone-100 last:border-r-0"
                  >
                    {formatInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  const flushQuote = () => {
    if (quoteBuffer.length === 0) return;
    const rawText = quoteBuffer.join(' ');
    let type: 'shortcut' | 'trap' | 'concept' | 'formula' | 'general' = 'general';
    if (/⚡|shortcut|speed trick|30-second/i.test(rawText)) type = 'shortcut';
    else if (/⚠️|trap|avoid|mistake alert|pitfall/i.test(rawText)) type = 'trap';
    else if (/💡|concept|core rule|fundamental/i.test(rawText)) type = 'concept';
    else if (/📐|formula|equation/i.test(rawText)) type = 'formula';

    elements.push(
      <CalloutCard
        key={`callout-${elements.length}`}
        type={type}
        lines={quoteBuffer}
        formatInline={formatInline}
      />
    );
    quoteBuffer = [];
  };

  lines.forEach((line, idx) => {
    // Code block detection
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <CodeBlock key={`code-${idx}`} code={codeBuffer.join('\n')} />
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        if (tableBuffer.length > 0) flushTable();
        if (quoteBuffer.length > 0) flushQuote();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Blockquote line
    if (line.trim().startsWith('>')) {
      if (tableBuffer.length > 0) flushTable();
      const contentLine = line.trim().replace(/^>\s*/, '');
      quoteBuffer.push(contentLine);
      return;
    } else if (quoteBuffer.length > 0) {
      flushQuote();
    }

    // Table line: must contain pipe '|' and look like a table row
    if (line.trim().startsWith('|') && (line.trim().endsWith('|') || line.includes('|'))) {
      tableBuffer.push(line);
      return;
    } else if (tableBuffer.length > 0) {
      flushTable();
    }

    // Step-by-Step Badge: **Step 1:** or Step 1: or **Step 1: Title**
    const stepMatch = line.trim().match(/^(?:\*\*\s*Step\s*(\d+)\s*(?::)?\s*\*\*\s*(.*)|Step\s*(\d+)\s*:\s*(.*)|\*\*\s*Step\s*(\d+)\s*:\s*(.*?)\*\*)$/i);
    if (stepMatch) {
      const stepNum = stepMatch[1] || stepMatch[3] || stepMatch[5];
      const stepContent = stepMatch[2] || stepMatch[4] || stepMatch[6];
      elements.push(
        <div key={`step-${idx}`} className="flex items-start gap-2.5 my-2.5">
          <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-extrabold text-[10px] tracking-wider uppercase shrink-0 shadow-2xs mt-0.5">
            Step {stepNum}
          </span>
          <div className="text-xs text-stone-800 leading-relaxed font-semibold">
            {formatInline(stepContent)}
          </div>
        </div>
      );
      return;
    }

    // Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={idx} className="my-3 border-t border-stone-200/90" />);
      return;
    }

    // Headings
    if (line.trim().startsWith('##### ')) {
      elements.push(
        <h6 key={idx} className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider mt-2.5 mb-1">
          {formatInline(line.trim().slice(6))}
        </h6>
      );
      return;
    }
    if (line.trim().startsWith('#### ')) {
      elements.push(
        <h5 key={idx} className="text-xs font-extrabold text-stone-900 mt-2.5 mb-1 flex items-center gap-1.5">
          <span className="w-1 h-2.5 bg-violet-500 rounded-full inline-block" />
          {formatInline(line.trim().slice(5))}
        </h5>
      );
      return;
    }
    if (line.trim().startsWith('### ')) {
      elements.push(
        <h4 key={idx} className="text-xs font-bold text-indigo-950 uppercase tracking-wide mt-3 mb-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-3 bg-indigo-600 rounded-full inline-block" />
          {formatInline(line.trim().slice(4))}
        </h4>
      );
      return;
    }
    if (line.trim().startsWith('## ')) {
      elements.push(
        <h3 key={idx} className="text-sm font-extrabold text-stone-900 mt-3.5 mb-1.5 pb-0.5 border-b border-stone-200">
          {formatInline(line.trim().slice(3))}
        </h3>
      );
      return;
    }
    if (line.trim().startsWith('# ')) {
      elements.push(
        <h2 key={idx} className="text-base font-black text-stone-900 mt-3.5 mb-1.5 pb-1 border-b border-stone-300">
          {formatInline(line.trim().slice(2))}
        </h2>
      );
      return;
    }

    // Indented sub-bullets (starts with 2+ spaces or tabs followed by bullet)
    const subBulletMatch = line.match(/^(\s{2,}|\t+)[\*\-•]\s+(.*)/);
    if (subBulletMatch) {
      elements.push(
        <div key={idx} className="flex items-start gap-2 ml-5 my-1 text-xs text-stone-700 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full border border-stone-400 bg-stone-200 mt-1.5 shrink-0" />
          <span className="text-stone-800">{formatInline(subBulletMatch[2])}</span>
        </div>
      );
      return;
    }

    // Standard Unordered list (*, -, or unicode bullet •)
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('•')) {
      const itemText = line.trim().replace(/^[\*\-•]\s*/, '');
      return elements.push(
        <div key={idx} className="flex items-start gap-2.5 my-1 text-xs text-stone-700 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0 ring-2 ring-indigo-100" />
          <span className="text-stone-800 flex-1">{formatInline(itemText)}</span>
        </div>
      );
    }

    // Numbered list (e.g. "1. Subject + used to...")
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={idx} className="flex items-start gap-2.5 my-1 text-xs text-stone-700 leading-relaxed">
          <span className="w-4 h-4 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
            {numMatch[1]}
          </span>
          <span className="text-stone-800 flex-1">{formatInline(numMatch[2])}</span>
        </div>
      );
      return;
    }

    // Standalone Display Math Block $$...$$
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('$$') && trimmedLine.endsWith('$$') && trimmedLine.length > 4) {
      const math = trimmedLine.slice(2, -2).trim();
      const html = renderKatexMath(math, true);
      if (html) {
        elements.push(
          <div
            key={`math-${idx}`}
            className="my-3 overflow-x-auto py-2 px-3 rounded-xl bg-stone-50 border border-stone-200/80 text-center font-serif text-stone-900 shadow-2xs"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else {
        elements.push(
          <div key={`math-${idx}`} className="my-2 p-2 bg-indigo-50/50 rounded font-mono text-xs text-indigo-800 text-center">
            {math}
          </div>
        );
      }
      return;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={idx} className="h-1.5" />);
      return;
    }

    // Standard paragraph
    elements.push(
      <p key={idx} className="text-xs text-stone-800 leading-relaxed my-1 font-normal">
        {formatInline(line)}
      </p>
    );
  });

  // Flush any lingering buffers
  if (tableBuffer.length > 0) flushTable();
  if (quoteBuffer.length > 0) flushQuote();

  return (
    <div className={`formatted-ai-note text-xs text-stone-800 leading-relaxed ${className}`}>
      {elements}
    </div>
  );
});

export default FormattedAiNote;
