import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Bot,
  User as UserIcon,
  X,
  Minimize2,
  Maximize2,
  Send,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Flame,
  Target,
  TrendingUp,
  Brain,
  ChevronDown,
  HelpCircle,
  ArrowRight,
  Play,
  Zap,
  Clock,
  GripVertical,
  Square,
  AlertTriangle,
  Lightbulb,
  Calculator,
  BookOpen,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Loader2
} from 'lucide-react';
import katex from 'katex';
import { sanitizeLatexForKatex } from '../utils/mathSanitizer';
import { MockScoreReport } from '../types/mockScore';
import { QuizResult } from '../types';
import { buildMockAiSummary } from '../utils/mockAiContext';
import { AiFocusedScope } from '../types/aiScope';
import { AI_SCOPE_EVENT } from '../utils/aiScopeHelper';
import { SrsCardConfirmModal } from './srs/SrsCardConfirmModal';
import { SRSCard } from '../types/srs';
import { addSRSCardsBatch } from '../utils/srsEngine';

export interface ChatAttachment {
  name: string;
  mimeType: string;
  data: string; // base64
  size?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  attachment?: ChatAttachment;
}

interface AiMentorChatProps {
  mockReports: MockScoreReport[];
  mockErrorsData?: Record<string, any[]>;
  activeMockReport?: MockScoreReport | null;
  activeReviewResult?: QuizResult | null;
  onStartWeakTopicDrill?: (topic: string, subject?: string) => void;
  focusedScope?: AiFocusedScope | null;
  onClearScope?: () => void;
}

// #6: Dynamic suggestions computed at runtime from real mock data or active focused scope
function useDynamicSuggestions(
  mockReports: MockScoreReport[],
  topWeakTopic: string,
  activeReviewResult?: QuizResult | null,
  focusedScope?: AiFocusedScope | null
) {
  return useMemo(() => {
    if (focusedScope) {
      const suggestions: { icon: any; label: string; text: string }[] = [];
      if (focusedScope.type === 'mock') {
        suggestions.push(
          {
            icon: Target,
            label: 'Why did I get Question 1 wrong?',
            text: `Analyze Question 1 from ${focusedScope.title}. Why is my chosen option incorrect and what is the exact conceptual shortcut?`
          },
          {
            icon: Flame,
            label: 'Diagnose all mistakes in this mock',
            text: `Analyze all my mistakes in ${focusedScope.title}. Where did I lose the most marks and what are my avoidable errors?`
          },
          {
            icon: TrendingUp,
            label: 'Marks recovery plan for this mock',
            text: `Based on the wrong and slow questions in ${focusedScope.title}, give me an exact marks recovery plan to score 20+ more marks.`
          },
          {
            icon: Brain,
            label: 'Shortcut tricks for time-trap questions',
            text: `Show me fast elimination methods and 30-second shortcut tricks for the questions I spent the most time on in ${focusedScope.title}.`
          }
        );
      } else if (focusedScope.type === 'topic') {
        suggestions.push(
          {
            icon: Brain,
            label: `Key formulas & shortcuts for ${focusedScope.title}`,
            text: `Explain all key rules, formulas, and 30-second shortcut tricks for ${focusedScope.title} in SSC CGL.`
          },
          {
            icon: Target,
            label: `Walk me through my hardest mistake`,
            text: `Take the most difficult question from my errors in ${focusedScope.title} and break it down step-by-step.`
          },
          {
            icon: Flame,
            label: `Common trap options to avoid`,
            text: `What are the most common trap options or misinterpretations students make in ${focusedScope.title}?`
          },
          {
            icon: Zap,
            label: `Give me 3 practice questions`,
            text: `Create 3 exam-level practice questions based on the exact concepts I got wrong in ${focusedScope.title}, with solutions.`
          }
        );
      } else if (focusedScope.type === 'subject') {
        suggestions.push(
          {
            icon: Target,
            label: `Strategy to score 45+ in ${focusedScope.title}`,
            text: `Give me an actionable, high-yield strategy to score 45+ in ${focusedScope.title} for SSC CGL Tier-1.`
          },
          {
            icon: Flame,
            label: `My top weak chapters in ${focusedScope.title}`,
            text: `Analyze my accuracy and mistake breakdown in ${focusedScope.title}. Which chapters should I prioritize first?`
          },
          {
            icon: Clock,
            label: `Time management in ${focusedScope.title}`,
            text: `What is the ideal time allotment per question in ${focusedScope.title} and which question types should I skip first?`
          }
        );
      }
      return suggestions;
    }
    const suggestions: { icon: any; label: string; text: string }[] = [];

    if (mockReports.length === 0) {
      // No data yet — onboarding suggestions
      suggestions.push(
        { icon: HelpCircle, label: 'How do I get started?', text: 'I have not taken any mock tests yet. How should I start my SSC CGL preparation and what should be my first steps?' },
        { icon: Brain, label: 'What is the CGL syllabus?', text: 'Give me a complete breakdown of the SSC CGL Tier-1 syllabus with topic weights and what to prioritize first.' },
        { icon: Target, label: 'How long to prepare for CGL?', text: 'How many months does it take to crack SSC CGL from scratch and what is the ideal study plan?' },
        { icon: TrendingUp, label: 'Best mock test strategy', text: 'What is the best strategy to attempt a CGL Tier-1 mock test and how should I analyze my results?' }
      );
      return suggestions;
    }

    const fullMocks = mockReports.filter(r => r.type === 'full');
    const sortedFull = [...fullMocks].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    const latestScore = sortedFull[0]?.totalScore ?? 0;
    const earliestScore = sortedFull[sortedFull.length - 1]?.totalScore ?? 0;
    const trendDelta = sortedFull.length >= 2 ? latestScore - earliestScore : 0;
    const isDeclining = sortedFull.length >= 2 && trendDelta < -5;
    const isStagnant = sortedFull.length >= 3 && Math.abs(trendDelta) <= 5;

    // Always: explain my biggest weak area
    if (topWeakTopic && topWeakTopic !== 'Active & Passive Voice') {
      suggestions.push({
        icon: Flame,
        label: `Fix my #1 weak topic: ${topWeakTopic}`,
        text: `Analyze my errors in ${topWeakTopic} and give me a step-by-step concept revision plan, shortcut tricks, and the most common question patterns I must master.`
      });
    } else {
      suggestions.push({
        icon: Flame,
        label: 'Explain my top weak areas',
        text: 'Analyze all my mocks and tell me my top 3 weakest topics and give me a targeted action plan for each.'
      });
    }

    // Trend-based suggestion
    if (isDeclining) {
      suggestions.push({
        icon: TrendingUp,
        label: `My score dropped ${Math.abs(trendDelta)} pts — why?`,
        text: `My full mock score has dropped by ${Math.abs(trendDelta)} marks. Analyze my section-wise trends and tell me exactly what changed and how to reverse this decline.`
      });
    } else if (isStagnant) {
      suggestions.push({
        icon: TrendingUp,
        label: 'My score is stuck — how to break the plateau?',
        text: 'My mock scores are stagnant and not improving. Identify the exact bottleneck from my data and give me a strategy shift to break the plateau and improve by 10+ marks.'
      });
    } else if (latestScore > 0 && latestScore < 140) {
      suggestions.push({
        icon: TrendingUp,
        label: `Gap to 145 cutoff: how to close it?`,
        text: `My latest score is ${latestScore}/200. What are the highest ROI actions to cross the 145-150 cutoff? Which section should I fix first?`
      });
    } else if (latestScore >= 140) {
      suggestions.push({
        icon: TrendingUp,
        label: `How to push from ${latestScore} to 155+?`,
        text: `My latest score is ${latestScore}/200. I want to push to 155+. What are the marginal gains I can make — which errors are easiest to convert and which section has most upside?`
      });
    }

    // If reviewing a quiz, add context-specific suggestion
    if (activeReviewResult) {
      suggestions.push({
        icon: Target,
        label: 'Explain my mistakes in this quiz',
        text: 'Review all my wrong questions in this test and explain the solutions step-by-step with the exact concept or rule I missed.'
      });
    } else {
      // Generic revision plan
      suggestions.push({
        icon: Brain,
        label: 'Create a 15-day revision roadmap',
        text: 'Based on my mock performance, create a focused 15-day revision and mock attempt schedule with daily targets and section-wise priorities.'
      });
    }

    // Always add marks recovery question
    suggestions.push({
      icon: ArrowRight,
      label: 'Where am I losing the most marks?',
      text: 'From all my mocks and error bank, identify where I lose the most marks and calculate my marks recovery opportunity if I fix my top 3 weak areas.'
    });

    return suggestions.slice(0, 4); // Cap at 4 chips
  }, [mockReports, topWeakTopic, activeReviewResult, focusedScope]);
}

// KaTeX HTML rendering cache for high performance
const chatKatexCache = new Map<string, string>();
function renderKatexMath(latex: string, displayMode: boolean): string {
  const trimmed = latex.trim();
  if (!trimmed) return '';
  const cacheKey = `${displayMode ? 'D:' : 'I:'}${trimmed}`;
  const cached = chatKatexCache.get(cacheKey);
  if (cached) return cached;

  const sanitized = sanitizeLatexForKatex(trimmed);
  try {
    const html = katex.renderToString(sanitized, {
      throwOnError: false,
      displayMode,
    });
    if (chatKatexCache.size > 1500) {
      const first = chatKatexCache.keys().next().value;
      if (first) chatKatexCache.delete(first);
    }
    chatKatexCache.set(cacheKey, html);
    return html;
  } catch {
    return '';
  }
}

// Clean latex for plain-text clipboard copy
function cleanLatexForClipboard(text: string): string {
  if (!text) return '';
  return text
    .replace(/\$\$/g, '')
    .replace(/\$([^\$]+)\$/g, '$1')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
}

// Interactive Code / Solution Block with 1-click Copy
const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl bg-slate-900 text-slate-100 overflow-hidden border border-slate-800 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-slate-300">
          <Brain className="w-3.5 h-3.5 text-indigo-400" /> Solution Step / Code
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 py-0.5 px-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer text-[10px]"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied</span>
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
  key?: React.Key;
  type: 'shortcut' | 'trap' | 'concept' | 'formula' | 'general';
  lines: string[];
  formatInline: (t: string) => React.ReactNode;
}

const CalloutCard: React.FC<CalloutProps> = ({ type, lines, formatInline }) => {
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
          {lines.map((l, i) => (
            <p key={i} className="my-0.5">{formatInline(l.replace(/^[>⚡\s\*]*(?:30-Second\s*Shortcut(?::)?|\*\*30-Second\s*Shortcut:\*\*)/i, ''))}</p>
          ))}
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
          {lines.map((l, i) => (
            <p key={i} className="my-0.5">{formatInline(l.replace(/^[>⚠️\s\*]*(?:Trap\s*Alert(?::)?|\*\*Trap\s*Alert:\*\*)/i, ''))}</p>
          ))}
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
          {lines.map((l, i) => (
            <p key={i} className="my-0.5">{formatInline(l.replace(/^[>💡\s\*]*(?:Core\s*Concept(?::)?|\*\*Core\s*Concept:\*\*)/i, ''))}</p>
          ))}
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
          {lines.map((l, i) => (
            <p key={i} className="my-0.5">{formatInline(l.replace(/^[>📐\s\*]*(?:Key\s*Formula(?::)?|\*\*Key\s*Formula:\*\*)/i, ''))}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="my-2.5 pl-3.5 pr-2 py-2 rounded-r-lg border-l-4 border-indigo-400 bg-slate-50/90 text-xs text-slate-700 italic">
      {lines.map((l, i) => (
        <p key={i} className="my-0.5">{formatInline(l)}</p>
      ))}
    </div>
  );
}

// Elevated Markdown & KaTeX Renderer for beautiful AI responses
function FormattedMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const lines = (content || '').split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let tableBuffer: string[] = [];
  let quoteBuffer: string[] = [];

  const formatInline = (text: string) => {
    // Regex splits for display math $$...$$, inline math $...$, bold, italic, code
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
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
              className="block my-2 overflow-x-auto text-center font-serif text-slate-900"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={i} className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1 rounded">{math}</span>;
      }

      // Inline math $...$
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const math = part.slice(1, -1);
        const html = renderKatexMath(math, false);
        if (html) {
          return (
            <span
              key={i}
              className="inline-block px-0.5 align-baseline font-serif"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={i} className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1 rounded">{math}</span>;
      }

      // Bold: **...**
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }

      // Italic: *...*
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return <em key={i} className="text-slate-800 italic">{part.slice(1, -1)}</em>;
      }

      // Code: `...`
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-xs border border-indigo-200/60 font-medium">
            {part.slice(1, -1)}
          </code>
        );
      }

      return part;
    });
  };

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer.map(r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    const hasHeader = rows.length > 1 && tableBuffer[1].includes('---');
    const headerRow = hasHeader ? rows[0] : null;
    const bodyRows = hasHeader ? rows.slice(2) : rows;

    elements.push(
      <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
        <table className="w-full text-left text-xs">
          {headerRow && (
            <thead className="bg-slate-100/90 text-slate-800 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                {headerRow.map((cell, idx) => (
                  <th key={idx} className="px-3.5 py-2 font-bold">{formatInline(cell)}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100 bg-white">
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-indigo-50/30 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3.5 py-2 text-slate-700 leading-relaxed">{formatInline(cell)}</td>
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
      <CalloutCard key={`callout-${elements.length}`} type={type} lines={quoteBuffer} formatInline={formatInline} />
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

    // Table line
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableBuffer.push(line);
      return;
    } else if (tableBuffer.length > 0) {
      flushTable();
    }

    // Step-by-Step Badge: **Step 1:** or Step 1:
    const stepMatch = line.trim().match(/^(?:\*\*Step\s*(\d+)(?::)?\*\*|Step\s*(\d+):)\s*(.*)/i);
    if (stepMatch) {
      const stepNum = stepMatch[1] || stepMatch[2];
      const stepContent = stepMatch[3];
      elements.push(
        <div key={`step-${idx}`} className="flex items-start gap-2.5 my-2.5">
          <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-extrabold text-[10px] tracking-wider uppercase shrink-0 shadow-2xs mt-0.5">
            Step {stepNum}
          </span>
          <div className="text-xs text-slate-800 leading-relaxed font-medium">
            {formatInline(stepContent)}
          </div>
        </div>
      );
      return;
    }

    // Targeted Drill Card trigger: [DRILL: Topic Name]
    const drillMatch = line.trim().match(/\[DRILL:\s*([^\]]+)\]/i);
    if (drillMatch) {
      const drillTopic = drillMatch[1].trim();
      elements.push(
        <div key={`drill-${idx}`} className="my-3 p-3.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-amber-500/10 border border-indigo-200/90 flex items-center justify-between gap-3 shadow-xs hover:border-indigo-300 transition-all">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5 mb-0.5">
              <Zap className="w-3 h-3 text-amber-500 fill-current animate-pulse" />
              Targeted Rapid Drill
            </span>
            <h5 className="text-xs font-black text-slate-900 truncate">{drillTopic}</h5>
          </div>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('cgl_launch_drill', { detail: { topic: drillTopic } }));
            }}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 group"
          >
            <Play className="w-3 h-3 fill-current group-hover:translate-x-0.5 transition-transform" />
            <span>Start Test</span>
          </button>
        </div>
      );
      return;
    }

    // Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={idx} className="my-3 border-t border-slate-200" />);
      return;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={idx} className="text-xs font-bold text-indigo-900 uppercase tracking-wide mt-3 mb-1 flex items-center gap-1.5">
          <span className="w-1.5 h-3 bg-indigo-500 rounded-full inline-block" />
          {formatInline(line.slice(4))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={idx} className="text-sm font-extrabold text-slate-900 mt-3.5 mb-1 pb-0.5 border-b border-slate-100">
          {formatInline(line.slice(3))}
        </h3>
      );
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={idx} className="text-base font-black text-slate-900 mt-3.5 mb-1 pb-1 border-b border-slate-200">
          {formatInline(line.slice(2))}
        </h2>
      );
      return;
    }

    // Unordered list
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      const itemText = line.trim().replace(/^[\*\-]\s+/, '');
      elements.push(
        <div key={idx} className="flex items-start gap-2.5 my-1 text-xs text-slate-700 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0 ring-2 ring-indigo-100" />
          <span className="text-slate-800">{formatInline(itemText)}</span>
        </div>
      );
      return;
    }

    // Numbered list
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={idx} className="flex items-start gap-2.5 my-1 text-xs text-slate-700 leading-relaxed">
          <span className="w-4 h-4 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
            {numMatch[1]}
          </span>
          <span className="text-slate-800">{formatInline(numMatch[2])}</span>
        </div>
      );
      return;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={idx} className="h-1.5" />);
      return;
    }

    // Standard paragraph
    elements.push(
      <p key={idx} className="text-xs text-slate-800 leading-relaxed my-1.5 font-normal">
        {formatInline(line)}
      </p>
    );
  });

  if (tableBuffer.length > 0) flushTable();
  if (quoteBuffer.length > 0) flushQuote();

  if (isStreaming) {
    const cursorElement = (
      <span
        key="live-typing-cursor"
        aria-hidden="true"
        className="inline-block w-1.5 h-3.5 ml-1 bg-indigo-600 rounded-xs align-middle animate-[pulse_0.75s_ease-in-out_infinite] shadow-[0_0_8px_rgba(79,70,229,0.5)]"
      />
    );

    if (elements.length > 0) {
      const lastIdx = elements.length - 1;
      const lastEl = elements[lastIdx];
      if (React.isValidElement(lastEl)) {
        const elType = lastEl.type;
        if (elType === 'p' || elType === 'h2' || elType === 'h3' || elType === 'h4') {
          const origChildren = (lastEl.props as any).children;
          elements[lastIdx] = React.cloneElement(lastEl as React.ReactElement<any>, {
            children: Array.isArray(origChildren)
              ? [...origChildren, cursorElement]
              : [origChildren, cursorElement]
          });
        } else {
          elements.push(
            <div key="live-cursor-wrap" className="inline-flex items-center">
              {cursorElement}
            </div>
          );
        }
      } else {
        elements.push(cursorElement);
      }
    } else {
      elements.push(cursorElement);
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// In-memory cache for instant 0ms responses on repeated question reviews
const aiResponseCache = new Map<string, string>();

export function AiMentorChat({
  mockReports,
  mockErrorsData,
  activeMockReport,
  activeReviewResult,
  onStartWeakTopicDrill,
  focusedScope: propsFocusedScope,
  onClearScope
}: AiMentorChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [internalScope, setInternalScope] = useState<AiFocusedScope | null>(null);
  const activeScope = propsFocusedScope || internalScope;

  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // High-performance smooth typewriter queue
  const targetTextRef = useRef<string>('');
  const displayedTextRef = useRef<string>('');
  const activeBotMsgIdRef = useRef<string | null>(null);
  const typingTimerRef = useRef<any>(null);
  const isNetworkDoneRef = useRef<boolean>(false);

  const startTypewriter = (botMsgId: string) => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    activeBotMsgIdRef.current = botMsgId;
    targetTextRef.current = '';
    displayedTextRef.current = '';
    isNetworkDoneRef.current = false;

    typingTimerRef.current = setInterval(() => {
      const target = targetTextRef.current;
      const current = displayedTextRef.current;

      if (current.length < target.length) {
        const remaining = target.length - current.length;
        // Adaptive typewriter cadence: smooth for live streaming, fast for large buffers
        let step = 1;
        if (remaining > 180) step = 18;
        else if (remaining > 80) step = 10;
        else if (remaining > 30) step = 5;
        else if (remaining > 10) step = 3;
        else step = 2;

        const nextLen = Math.min(target.length, current.length + step);
        const nextText = target.slice(0, nextLen);
        displayedTextRef.current = nextText;

        setMessages(prev =>
          prev.map(m => (m.id === botMsgId ? { ...m, text: nextText } : m))
        );
      } else if (isNetworkDoneRef.current) {
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        setIsStreaming(false);
        setIsLoading(false);
      }
    }, 18);
  };

  const flushTypewriter = () => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (activeBotMsgIdRef.current && targetTextRef.current) {
      const finalBotId = activeBotMsgIdRef.current;
      const finalText = targetTextRef.current;
      displayedTextRef.current = finalText;
      setMessages(prev =>
        prev.map(m => (m.id === finalBotId ? { ...m, text: finalText } : m))
      );
    }
    setIsStreaming(false);
    setIsLoading(false);
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    flushTypewriter();
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage?.getItem('cgl_ai_chat_history');
        if (saved) {
          return JSON.parse(saved);
        }
      }
    } catch (e) {
      // ignore storage disallow error
    }
    return [
      {
        id: 'welcome_1',
        role: 'assistant',
        text: `**Hello!** 👋 I am **Tommy**, your personal study assistant and problem solver.\n\nI have complete visibility into your **${mockReports.length} Mock Tests**, practice sessions, and error patterns. Ask me anything about:\n* Step-by-step solutions & shortcut tricks for any question\n* Your weak topics & score trends across mocks\n* Targeted strategy in Quantitative Aptitude, Reasoning, English, or General Awareness\n* Concept doubts, grammar rules, or revision plans\n\nHow can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Attachment & Anki State
  const [selectedAttachment, setSelectedAttachment] = useState<ChatAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isConvertingToAnki, setIsConvertingToAnki] = useState(false);
  const [ankiConfirmCards, setAnkiConfirmCards] = useState<Array<Partial<SRSCard>>>([]);
  const [ankiConfirmOpen, setAnkiConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachmentError(null);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setAttachmentError('Please upload an image (JPG, PNG, WebP) or PDF document.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setAttachmentError('File is too large. Max allowed size is 8MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedAttachment({
        name: file.name,
        mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        data: base64,
        size: file.size
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setAttachmentError('Failed to read file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAnkiFromMessage = async (assistantText: string) => {
    setIsConvertingToAnki(true);
    try {
      const res = await fetch('/api/srs/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textNotes: assistantText,
          prompt: 'Extract 1 to 3 high-yield Anki flashcards with core concepts, shortcuts, and mnemonics from this explanation.',
          count: 2
        })
      });
      const data = await res.json();
      if (data?.cards && data.cards.length > 0) {
        setAnkiConfirmCards(data.cards);
        setAnkiConfirmOpen(true);
      } else {
        const singleCard: Partial<SRSCard> = {
          subject: activeScope?.subject || 'General',
          type: 'general',
          front: assistantText.slice(0, 120).split('\n')[0] || 'Key Concept',
          back: assistantText,
          source: 'ai_generated',
          sourceTitle: 'Tommy AI Chat'
        };
        setAnkiConfirmCards([singleCard]);
        setAnkiConfirmOpen(true);
      }
    } catch {
      const singleCard: Partial<SRSCard> = {
        subject: activeScope?.subject || 'General',
        type: 'general',
        front: 'Concept from Tommy Chat',
        back: assistantText,
        source: 'ai_generated',
        sourceTitle: 'Tommy AI Chat'
      };
      setAnkiConfirmCards([singleCard]);
      setAnkiConfirmOpen(true);
    } finally {
      setIsConvertingToAnki(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isDraggingRef = useRef(false);

  // Listen to AI scope events from chips across subjects, topics, and mocks
  useEffect(() => {
    const handleScopeEvent = (e: any) => {
      const scope = e?.detail as AiFocusedScope;
      if (scope) {
        setInternalScope(scope);
        setIsOpen(true);
        const originLabel = scope.sourceScopeLabel || (
          scope.sourceScope === 'full_mock' ? 'Full Mock Test' :
          scope.sourceScope === 'sectional' ? 'Sectional Test' :
          scope.sourceScope === 'subject_wise' ? 'Subject-Wise Error Bank' :
          scope.sourceScope === 'mixed' ? 'Full Mock & Subject Errors' :
          `${scope.type.toUpperCase()} Focus`
        );
        const countText = scope.questions?.length ? ` (${scope.questions.length} mistake questions loaded)` : '';
        const welcomeText = `🎯 **Focused Scope Active: [${originLabel}] ${scope.title}**${countText}\n\nI'm ready! Ask me anything about these questions — step-by-step question breakdowns, shortcut tricks, core rules, or your mistake patterns.`;
        setMessages(prev => [
          ...prev,
          {
            id: `scope_${Date.now()}`,
            role: 'assistant',
            text: welcomeText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    };
    window.addEventListener(AI_SCOPE_EVENT, handleScopeEvent);
    return () => window.removeEventListener(AI_SCOPE_EVENT, handleScopeEvent);
  }, []);

  // Viewport bounds for free dragging anywhere on screen
  const [dragBounds, setDragBounds] = useState({ top: -800, left: -1200, right: 10, bottom: 10 });

  useEffect(() => {
    const updateBounds = () => {
      if (typeof window === 'undefined') return;
      setDragBounds({
        top: -(window.innerHeight - 80),
        left: -(window.innerWidth - 180),
        right: 10,
        bottom: 10
      });
    };
    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, []);

  // Sync chat history to localStorage safely
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem('cgl_ai_chat_history', JSON.stringify(messages));
      }
    } catch (e) {
      // storage not allowed or quota exceeded
    }
  }, [messages]);

  // Scroll to bottom whenever new message arrives
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
    }
  }, [messages, isOpen, isStreaming]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Identify top weak topic from error data
  const topWeakTopic = useMemo(() => {
    const errorCounts: Record<string, number> = {};
    if (mockErrorsData) {
      Object.values(mockErrorsData).forEach(chapters => {
        if (Array.isArray(chapters)) {
          chapters.forEach(ch => {
            (ch.questions || []).forEach((q: any) => {
              const raw = q.tags?.topic || q.topic;
              if (raw && raw !== 'General') {
                errorCounts[raw] = (errorCounts[raw] || 0) + 1;
              }
            });
          });
        }
      });
    }
    const sorted = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'Active & Passive Voice';
  }, [mockErrorsData]);

  // Pre-aggregate mock statistics briefing for Gemini
  const mockContextString = useMemo(() => {
    return buildMockAiSummary(mockReports, mockErrorsData, activeMockReport);
  }, [mockReports, mockErrorsData, activeMockReport]);

  // #6: Compute personalized dynamic suggestions
  const dynamicSuggestions = useDynamicSuggestions(mockReports, topWeakTopic, activeReviewResult, activeScope);

  const handleSendMessage = async (textToSend?: string, specificQuestion?: any) => {
    const query = (textToSend || inputText).trim();
    const currentAttachment = selectedAttachment;
    if ((!query && !currentAttachment) || isLoading) return;

    const actualQuery = query || (currentAttachment
      ? (currentAttachment.mimeType === 'application/pdf'
          ? `Please inspect this PDF document: "${currentAttachment.name}". Extract and solve questions step-by-step, explaining rules, formulas, and shortcuts.`
          : 'Please inspect this photo of the question. Extract the problem statement, provide the complete step-by-step solution, and point out shortcut tricks and option elimination.')
      : '');

    // Fast Cache Lookup for Question Explanations & Repeated Queries (only when no attachment)
    const cacheKey = `${actualQuery.toLowerCase()}::${activeScope?.title || ''}::${activeMockReport?.id || ''}::${specificQuestion?.question ? specificQuestion.question.slice(0, 60) : ''}`;
    if (!currentAttachment && aiResponseCache.has(cacheKey)) {
      const cachedReply = aiResponseCache.get(cacheKey)!;
      const userMessage: ChatMessage = {
        id: `usr_${Date.now()}`,
        role: 'user',
        text: actualQuery,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const botMessageId = `bot_${Date.now()}`;
      const initialBotMessage: ChatMessage = {
        id: botMessageId,
        role: 'assistant',
        text: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, userMessage, initialBotMessage]);
      setInputText('');
      setIsLoading(true);
      setIsStreaming(true);
      startTypewriter(botMessageId);
      targetTextRef.current = cachedReply;
      isNetworkDoneRef.current = true;
      return;
    }

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: actualQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: currentAttachment || undefined
    };

    const botMessageId = `bot_${Date.now()}`;
    const initialBotMessage: ChatMessage = {
      id: botMessageId,
      role: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage, initialBotMessage]);
    setInputText('');
    setSelectedAttachment(null);
    setAttachmentError(null);
    setIsLoading(true);

    // Abort previous in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsStreaming(true);
    startTypewriter(botMessageId);

    try {
      // Pin first message (welcome/context) + last 9 — so session context is never lost
      const allMsgs = [...messages, userMessage];
      let conversationPayload: { role: string; text: string; attachment?: ChatAttachment }[];
      if (allMsgs.length <= 10) {
        conversationPayload = allMsgs.map(m => ({ role: m.role, text: m.text, attachment: m.attachment }));
      } else {
        const [first, ...rest] = allMsgs;
        conversationPayload = [
          { role: first.role, text: first.text, attachment: first.attachment },
          ...rest.slice(-9).map(m => ({ role: m.role, text: m.text, attachment: m.attachment }))
        ];
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          stream: true,
          messages: conversationPayload,
          attachment: currentAttachment ? {
            data: currentAttachment.data,
            mimeType: currentAttachment.mimeType,
            name: currentAttachment.name
          } : undefined,
          mockSummary: mockContextString,
          focusedScope: activeScope || undefined,
          activeMockId: activeMockReport?.id,
          activeMockTitle: activeMockReport?.title,
          activeMockContext: activeMockReport
            ? `Active Mock Title: ${activeMockReport.title}\nScore: ${activeMockReport.totalScore}/${activeMockReport.maxMarks || 200}\nCorrect: ${activeMockReport.totalCorrect}, Wrong: ${activeMockReport.totalWrong}, Skipped: ${activeMockReport.totalUnattempted}`
            : undefined,
          activeQuestion: specificQuestion,
          activeReviewQuestions: !specificQuestion && activeReviewResult?.questionDetails
            ? activeReviewResult.questionDetails
                .filter(qd => !qd.isCorrect)
                .slice(0, 5)
                .map((qd, idx) => ({
                  qNum: idx + 1,
                  question: qd.question?.question || '',
                  options: qd.question?.options || {},
                  correctAnswer: qd.question?.answer || '',
                  userAnswer: qd.selectedAnswer || (qd as any).userAnswer || '',
                  isCorrect: qd.isCorrect,
                  solution: qd.question?.solution || '',
                  topic: qd.question?.tags?.topic || (qd.question as any)?.topic || 'General'
                }))
            : undefined
        })
      });

      if (!res.ok) {
        let errorMsg = '';
        try {
          const rawText = await res.text();
          try {
            const parsed = JSON.parse(rawText);
            errorMsg = parsed.error || parsed.message || parsed.details || rawText;
          } catch {
            errorMsg = rawText.length < 200 ? rawText : `Server responded with status ${res.status}`;
          }
        } catch {
          errorMsg = `Server responded with status ${res.status}`;
        }
        throw new Error(errorMsg || `Server responded with status ${res.status}`);
      }

      // Check if response is Server-Sent Events stream
      const isEventStream = res.headers.get('content-type')?.includes('text/event-stream');

      if (isEventStream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const sseLines = buffer.split('\n');
          buffer = sseLines.pop() || '';

          for (const sseLine of sseLines) {
            if (sseLine.startsWith('data: ')) {
              const payload = sseLine.slice(6).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                if (parsed.text) {
                  fullText += parsed.text;
                  targetTextRef.current = fullText;
                }
              } catch (parseErr: any) {
                if (parseErr.message && !parseErr.message.includes('Unexpected end of JSON')) {
                  throw parseErr;
                }
              }
            }
          }
        }

        if (fullText.trim()) {
          aiResponseCache.set(cacheKey, fullText);
          isNetworkDoneRef.current = true;
        } else {
          flushTypewriter();
          setMessages(prev =>
            prev.map(m => (m.id === botMessageId ? { ...m, text: 'I could not generate a response. Please try asking again.' } : m))
          );
        }
      } else {
        // Standard JSON fallback
        const data = await res.json();
        const reply = data.reply || 'I could not generate a response. Please try asking again.';
        targetTextRef.current = reply;
        isNetworkDoneRef.current = true;
        aiResponseCache.set(cacheKey, reply);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Generation was intentionally stopped by user
        return;
      }
      flushTypewriter();
      const errorMessage = `⚠️ **Connection Notice**: ${err.message || 'Unable to connect to Gemini API'}.\n\nPlease ensure your \`GEMINI_API_KEY\` is configured in \`.env\` or Vercel Environment Variables.`;
      setMessages(prev =>
        prev.map(m => (m.id === botMessageId ? { ...m, text: errorMessage } : m))
      );
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Handle Ask AI from Review button & Launch Drill from Bot
  const handleSendMessageRef = useRef(handleSendMessage);
  handleSendMessageRef.current = handleSendMessage;

  useEffect(() => {
    const handleAskAi = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      setIsOpen(true);
      const originTag = detail.sourceLabel || (
        detail.sourceType === 'full_mock' ? 'Full Mock Test' :
        detail.sourceType === 'sectional' ? 'Sectional Test' :
        detail.sourceType === 'subject_wise' ? 'Subject-Wise Error Bank' : ''
      );
      const prompt = `Please explain Question #${detail.questionNumber} (${originTag ? `[${originTag}] ` : ''}${detail.topic || 'General'}):\n\nQuestion:\n${detail.questionText}\n\nMy Chosen Option: ${detail.userAnswer ? detail.userAnswer.toUpperCase() : 'Unattempted / Left'}\nCorrect Answer: ${detail.correctAnswer ? detail.correctAnswer.toUpperCase() : 'Refer to solution'}\n\nPlease explain why my answer was wrong, break down the core concept/grammar rule step-by-step, and give me a fast shortcut trick to solve this in under 30 seconds.`;
      
      const qContext = {
        qNum: detail.questionNumber,
        question: detail.questionText,
        options: detail.options,
        userAnswer: detail.userAnswer,
        correctAnswer: detail.correctAnswer,
        solution: detail.solution,
        topic: detail.topic,
        sourceType: detail.sourceType,
        sourceLabel: detail.sourceLabel,
        testName: detail.testName
      };
      
      handleSendMessageRef.current(prompt, qContext);
    };

    const handleLaunchDrill = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.topic && onStartWeakTopicDrill) {
        setIsOpen(false);
        onStartWeakTopicDrill(detail.topic);
      }
    };

    window.addEventListener('cgl_ask_ai_question', handleAskAi);
    window.addEventListener('cgl_launch_drill', handleLaunchDrill);
    return () => {
      window.removeEventListener('cgl_ask_ai_question', handleAskAi);
      window.removeEventListener('cgl_launch_drill', handleLaunchDrill);
    };
  }, [onStartWeakTopicDrill]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear entire conversation history with Tommy?')) {
      const reset = [
        {
          id: 'welcome_reset',
          role: 'assistant' as const,
          text: `Chat history cleared. I'm Tommy, ready for your next question! Ask me about your questions, solutions, or preparation strategy.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ];
      setMessages(reset);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage?.removeItem('cgl_ai_chat_history');
        }
      } catch (e) {}
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(cleanLatexForClipboard(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Floating Draggable Action Trigger Button - Moveable anywhere across screen */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.08}
        dragConstraints={dragBounds}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={() => {
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 150);
        }}
        animate={{
          opacity: isOpen ? 0 : 1,
          scale: isOpen ? 0.75 : 1,
          pointerEvents: isOpen ? 'none' : 'auto'
        }}
        transition={{ duration: 0.18 }}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 touch-none select-none"
      >
        <button
          onClick={(e) => {
            if (isDraggingRef.current) {
              e.preventDefault();
              return;
            }
            setIsOpen(true);
          }}
          className="group relative flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-xl hover:shadow-2xl hover:shadow-indigo-500/30 transition-shadow duration-300 cursor-grab active:cursor-grabbing border border-white/20"
          title="Ask Tommy (Drag anywhere on screen to reposition)"
        >
          <GripVertical className="w-3.5 h-3.5 text-white/40 group-hover:text-white/80 shrink-0" />
          <div className="relative shrink-0">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="flex flex-col text-left pr-1">
            <span className="text-xs font-bold tracking-wide flex items-center gap-1 leading-tight">
              Tommy
            </span>
            <span className="text-[9px] text-indigo-200/90 font-medium leading-tight">
              Ask AI
            </span>
          </div>
        </button>
      </motion.div>

      {/* Main Chat Modal Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed z-50 flex flex-col bg-white shadow-2xl border border-slate-200/90 rounded-2xl overflow-hidden transition-all duration-200 ${
              isExpanded
                ? 'inset-4 md:inset-8 w-auto h-auto'
                : 'bottom-4 right-4 w-[92vw] sm:w-[440px] h-[580px] max-h-[85vh]'
            }`}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shadow-md select-none">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Bot className="w-4 h-4 text-amber-300" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-white truncate">Tommy</h3>
                  </div>
                  <p className="text-[10px] text-slate-300 truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Synced with {mockReports.length} Mocks
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowContextDrawer(prev => !prev)}
                  className={`p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors ${
                    showContextDrawer ? 'bg-white/15 text-white' : ''
                  }`}
                  title="View Synced Mock Context"
                >
                  <Brain className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-white/10 transition-colors"
                  title="Clear Chat History"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsExpanded(prev => !prev)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors hidden sm:inline-flex"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Scope Focus Banner */}
            {activeScope && (
              <div className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border-b border-indigo-700/60 text-indigo-100 flex items-center justify-between text-xs font-semibold select-none shadow-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider shrink-0 border border-amber-400/30">
                    {activeScope.sourceScopeLabel || (
                      activeScope.sourceScope === 'full_mock' ? 'Full Mock' :
                      activeScope.sourceScope === 'sectional' ? 'Sectional' :
                      activeScope.sourceScope === 'subject_wise' ? 'Subject-Wise' :
                      `${activeScope.type} Focus`
                    )}
                  </span>
                  <span className="truncate text-white font-bold" title={activeScope.title}>
                    {activeScope.title}
                  </span>
                  {activeScope.questions?.length ? (
                    <span className="text-[10px] text-indigo-300 shrink-0">
                      ({activeScope.questions.length} Qs)
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={() => {
                    setInternalScope(null);
                    if (onClearScope) onClearScope();
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
                  title="Clear focus and return to general assistant"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            )}

            {/* Context Details Drawer (Collapsible) */}
            <AnimatePresence>
              {showContextDrawer && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-indigo-50/90 border-b border-indigo-100 px-3.5 py-2.5 text-[11px] text-slate-700 overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-indigo-900 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      Live Mock Profile Synced with AI:
                    </span>
                    <button
                      onClick={() => setShowContextDrawer(false)}
                      className="text-[10px] text-indigo-600 hover:underline font-semibold"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2 rounded-lg border border-indigo-100">
                    <div>
                      <span className="text-slate-500">Total Mocks:</span>{' '}
                      <strong className="text-slate-800">{mockReports.length}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Highest Score:</span>{' '}
                      <strong className="text-emerald-700">
                        {mockReports.length > 0 ? Math.max(...mockReports.map(r => r.totalScore || 0)) : 0}
                      </strong>
                    </div>
                    {activeMockReport && (
                      <div className="col-span-2 pt-1 border-t border-slate-100 text-slate-600 truncate">
                        Active Review: <strong>{activeMockReport.title}</strong> ({activeMockReport.totalScore} pts)
                      </div>
                    )}
                    {activeReviewResult && (
                      <div className="col-span-2 pt-1 border-t border-slate-100 text-indigo-800 bg-indigo-50/50 p-1.5 rounded-md font-medium text-[10px]">
                        📝 Active Quiz Review: <strong>{activeReviewResult.chapter_title}</strong> ({activeReviewResult.score}/{activeReviewResult.totalQuestions} • {activeReviewResult.questionDetails?.length || 0} Qs with Solutions Loaded)
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages Scroll Container */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-50/50">
              {messages.map(msg => {
                const isBot = msg.role === 'assistant';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
                  >
                    {isBot && (
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5 shadow-xs">
                        <Bot className="w-3.5 h-3.5 text-amber-300" />
                      </div>
                    )}
                    <div className={`relative group max-w-[85%] ${isBot ? 'text-left' : 'text-right'}`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-xs shadow-xs ${
                          isBot
                            ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                            : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-sm'
                        }`}
                      >
                        {isBot ? (
                          !msg.text && isLoading ? (
                            <div className="flex items-center gap-2.5 py-1 px-1">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/90 border border-indigo-100 shadow-2xs">
                                <Sparkles className="w-3 h-3 text-indigo-600 animate-spin" style={{ animationDuration: '3s' }} />
                                <span className="text-[11px] font-semibold text-indigo-900 tracking-wide">
                                  Tommy is typing
                                </span>
                              </div>
                              <div className="flex items-center gap-1 py-1">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce shadow-xs" style={{ animationDelay: '0ms', animationDuration: '0.8s' }} />
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce shadow-xs" style={{ animationDelay: '180ms', animationDuration: '0.8s' }} />
                                <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce shadow-xs" style={{ animationDelay: '360ms', animationDuration: '0.8s' }} />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <FormattedMessage
                                content={msg.text}
                                isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id}
                              />
                            </div>
                          )
                        ) : (
                          <div>
                            {msg.attachment && (
                              <div className="mb-2">
                                {msg.attachment.mimeType.startsWith('image/') ? (
                                  <div className="rounded-xl overflow-hidden border border-indigo-400/40 bg-black/20 max-w-[240px] shadow-xs">
                                    <img
                                      src={msg.attachment.data}
                                      alt={msg.attachment.name}
                                      className="w-full max-h-48 object-contain bg-slate-900/40"
                                    />
                                    <div className="px-2 py-1 text-[10px] text-indigo-100 truncate text-left">
                                      📷 {msg.attachment.name}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/40 border border-indigo-400/30 text-white text-xs text-left">
                                    <FileText className="w-4 h-4 text-rose-300 shrink-0" />
                                    <span className="truncate max-w-[180px] font-semibold text-white">{msg.attachment.name}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 text-[9px] font-black uppercase">PDF</span>
                                  </div>
                                )}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.text}</p>
                          </div>
                        )}
                      </div>
                      <div
                        className={`flex items-center gap-2 mt-1 text-[9px] text-slate-400 px-1 ${
                          isBot ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <span>{msg.timestamp}</span>
                        {isBot && msg.text && (
                          <>
                            <button
                              onClick={() => handleCreateAnkiFromMessage(msg.text)}
                              disabled={isConvertingToAnki}
                              className="opacity-0 group-hover:opacity-100 hover:text-purple-600 transition-all flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:bg-purple-50 px-1.5 py-0.5 rounded cursor-pointer"
                              title="Extract Anki flashcards from this explanation"
                            >
                              {isConvertingToAnki ? (
                                <Loader2 className="w-2.5 h-2.5 text-purple-600 animate-spin" />
                              ) : (
                                <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                              )}
                              <span>+ Anki Card</span>
                            </button>
                            <button
                              onClick={() => copyToClipboard(msg.text, msg.id)}
                              className="opacity-0 group-hover:opacity-100 hover:text-indigo-600 transition-all flex items-center gap-0.5"
                              title="Copy reply"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  <span className="text-emerald-600 font-semibold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {!isBot && (
                      <div className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5 shadow-xs">
                        <UserIcon className="w-3.5 h-3.5 text-indigo-300" />
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips */}
            {messages.length <= 2 && !isLoading && (
              <div className="px-3 pt-2 pb-1 bg-white border-t border-slate-100 flex flex-nowrap overflow-x-auto gap-1.5 scrollbar-none">
                {onStartWeakTopicDrill && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onStartWeakTopicDrill(topWeakTopic);
                    }}
                    className="px-2.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    title={`Start a 15-question targeted drill on ${topWeakTopic}`}
                  >
                    <Zap className="w-3 h-3 text-amber-200 shrink-0 fill-current" />
                    <span>⚡ Drill: {topWeakTopic} (15 Qs)</span>
                  </button>
                )}

                {activeReviewResult && (
                  <button
                    onClick={() => handleSendMessage('Review all my wrong questions in this test and explain the solutions step-by-step.')}
                    className="px-2.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Target className="w-3 h-3 text-indigo-600 shrink-0" />
                    <span>Explain My Mistakes in this Test</span>
                  </button>
                )}

                {dynamicSuggestions.map((s, idx) => {
                  const Icon = s.icon || Target;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(s.text)}
                      className="px-2.5 py-1.5 rounded-full bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-[10px] font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Icon className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-slate-200">
              {/* Attachment Preview Chip */}
              {selectedAttachment && (
                <div className="mb-2 p-2 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedAttachment.mimeType.startsWith('image/') ? (
                      <img
                        src={selectedAttachment.data}
                        alt={selectedAttachment.name}
                        className="w-9 h-9 object-cover rounded-lg border border-indigo-200 shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-indigo-950 truncate max-w-[200px] sm:max-w-[280px]">
                        {selectedAttachment.name}
                      </p>
                      <span className="text-[9px] text-slate-500 font-medium">
                        {selectedAttachment.size ? `${Math.round(selectedAttachment.size / 1024)} KB` : 'Ready to analyze'} • {selectedAttachment.mimeType.startsWith('image/') ? 'Photo Attachment' : 'PDF Document'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAttachment(null)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-white transition-colors shrink-0 cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Attachment Error Notice */}
              {attachmentError && (
                <div className="mb-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center justify-between">
                  <span>{attachmentError}</span>
                  <button onClick={() => setAttachmentError(null)}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="relative flex items-end gap-1.5 rounded-xl border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 bg-white p-1.5 transition-all shadow-xs">
                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                  title="Upload question photo, screenshot, or PDF document"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedAttachment ? "Add question instructions or press send to analyze..." : "Ask Tommy, or attach a question photo / PDF..."}
                  rows={1}
                  className="w-full resize-none bg-transparent px-1.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden max-h-24 min-h-[32px] leading-relaxed"
                />

                {isLoading ? (
                  <button
                    onClick={handleStopGenerating}
                    className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1 text-[11px] font-semibold active:scale-95"
                    title="Stop generating response"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-rose-600" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={(!inputText.trim() && !selectedAttachment) || isLoading}
                    className={`p-2 rounded-lg transition-all shrink-0 cursor-pointer ${
                      (inputText.trim() || selectedAttachment) && !isLoading
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                    title="Send Message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1 text-[9px] text-slate-400">
                <span>Press <strong>Enter</strong> to send • Attach <strong>Photos/PDFs</strong></span>
                <span>Powered by Gemini AI</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Cards Generated from Tommy Chat */}
      <SrsCardConfirmModal
        isOpen={ankiConfirmOpen}
        cards={ankiConfirmCards}
        title="Review & Confirm Anki Cards from Tommy"
        sourceLabel="Tommy AI Conversation"
        onConfirm={(confirmed) => {
          if (confirmed.length > 0) {
            addSRSCardsBatch(confirmed);
          }
          setAnkiConfirmOpen(false);
          setAnkiConfirmCards([]);
        }}
        onCancel={() => {
          setAnkiConfirmOpen(false);
          setAnkiConfirmCards([]);
        }}
      />
    </>
  );
}
