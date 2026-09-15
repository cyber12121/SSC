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
  GripVertical
} from 'lucide-react';
import { MockScoreReport } from '../types/mockScore';
import { QuizResult } from '../types';
import { buildMockAiSummary } from '../utils/mockAiContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AiMentorChatProps {
  mockReports: MockScoreReport[];
  mockErrorsData?: Record<string, any[]>;
  activeMockReport?: MockScoreReport | null;
  activeReviewResult?: QuizResult | null;
  onStartWeakTopicDrill?: (topic: string, subject?: string) => void;
}

// #6: Dynamic suggestions computed at runtime from real mock data
function useDynamicSuggestions(
  mockReports: MockScoreReport[],
  topWeakTopic: string,
  activeReviewResult?: QuizResult | null
) {
  return useMemo(() => {
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
    const isDeclinig = sortedFull.length >= 2 && trendDelta < -5;
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
    if (isDeclinig) {
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
  }, [mockReports, topWeakTopic, activeReviewResult]);
}

// Clean residual or malformed LaTeX formulas into clean, readable math & unicode
function cleanLatexMath(text: string): string {
  if (!text) return '';
  let s = text;

  // 1. Fix broken '≤ft' artifact created by bad \le replacement on \left
  s = s.replace(/≤ft\s*\(/g, '(').replace(/≤ft\s*\[/g, '[');

  // 2. Remove LaTeX delimiter wrappers \left and \right
  s = s.replace(/\\left\s*([(\[{|])/g, '$1');
  s = s.replace(/\\right\s*([)\]}|])/g, '$1');
  s = s.replace(/\\left|\\right/g, '');

  // 3. Convert mixed numbers: e.g. 16\frac{2}{3} -> 16 2/3
  s = s.replace(/(\d+)\s*\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1 $2/$3');

  // 4. Convert remaining fractions: \frac{a}{b} -> (a / b) or a/b
  let prev = '';
  do {
    prev = s;
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1 / $2)');
  } while (s !== prev);

  // Clean up simple fractions like (1 / 9) to 1/9 (preserve if followed by power/exponent)
  s = s.replace(/\((\d+)\s*\/\s*(\d+)\)(?!\^|[²³])/g, '$1/$2');
  s = s.replace(/\(([a-zA-Z0-9]+)\s*\/\s*([a-zA-Z0-9]+)\)(?!\^|[²³])/g, '$1/$2');

  // Collapse redundant double parentheses like ((x / 10)) to (x / 10)
  s = s.replace(/\(\(([^\(\)]+)\)\)/g, '($1)');

  // Common superscripts
  s = s.replace(/\^2\b|\^\{2\}/g, '²');
  s = s.replace(/\^3\b|\^\{3\}/g, '³');

  // 5. Convert \text{...} to plain text
  s = s.replace(/\\text\{([^{}]+)\}/g, '$1');

  // 6. Clean LaTeX spacing and special symbols
  s = s.replace(/\\(quad|qquad|;|!|,)/g, ' ');
  s = s.replace(/\\(to|rightarrow)/g, ' → ');
  s = s.replace(/\\times/g, ' × ');
  s = s.replace(/\\div/g, ' ÷ ');
  s = s.replace(/\\pm/g, ' ± ');
  s = s.replace(/\\le(?!ft)/g, ' ≤ ');
  s = s.replace(/\\ge/g, ' ≥ ');
  s = s.replace(/\\Delta/g, 'Δ');
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  s = s.replace(/\\sqrt/g, '√');
  s = s.replace(/\\%/g, '%');

  // 7. Strip remaining standalone backslashes before words e.g. \approx
  s = s.replace(/\\(approx|approxeq)/g, '≈');
  s = s.replace(/\\(neq|ne)/g, '≠');
  s = s.replace(/\\(infty)/g, '∞');

  // 8. Strip standalone LaTeX math dollar wrappers $
  s = s.replace(/\$/g, '');

  // 9. Clean redundant multiple spaces
  s = s.replace(/[ \t]{2,}/g, ' ');

  return s;
}

// Lightweight Markdown Renderer for clean formatted responses
function FormattedMessage({ content }: { content: string }) {
  // Pre-clean any LaTeX formulas into clean, readable notation
  const sanitizedContent = cleanLatexMath(content);

  // Parse lines for headers, bullet points, horizontal rules, and tables
  const lines = sanitizedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let tableBuffer: string[] = [];

  const formatInline = (text: string) => {
    // Bold: **...**, italic: *...*, code: `...`
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return <em key={i} className="text-slate-800 italic">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-xs border border-indigo-100/60">
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
      <div key={`table-${elements.length}`} className="my-2.5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          {headerRow && (
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
              <tr>
                {headerRow.map((cell, idx) => (
                  <th key={idx} className="px-3 py-1.5 font-bold">{formatInline(cell)}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100 bg-white">
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/60">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-1.5 text-slate-700">{formatInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  lines.forEach((line, idx) => {
    // Code block detection
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${idx}`} className="my-2 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        if (tableBuffer.length > 0) flushTable();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Table line
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableBuffer.push(line);
      return;
    } else if (tableBuffer.length > 0) {
      flushTable();
    }

    // Targeted Drill Card trigger: [DRILL: Topic Name]
    const drillMatch = line.trim().match(/\[DRILL:\s*([^\]]+)\]/i);
    if (drillMatch) {
      const drillTopic = drillMatch[1].trim();
      elements.push(
        <div key={`drill-${idx}`} className="my-2.5 p-3 rounded-xl bg-gradient-to-r from-indigo-50/90 via-purple-50/90 to-amber-50/90 border border-indigo-200/80 flex items-center justify-between gap-3 shadow-xs">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500 fill-current" />
              Targeted Practice Drill
            </span>
            <h5 className="text-xs font-black text-slate-900 truncate">{drillTopic}</h5>
          </div>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('cgl_launch_drill', { detail: { topic: drillTopic } }));
            }}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
          >
            <Play className="w-3 h-3 fill-current" />
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
        <h4 key={idx} className="text-xs font-bold text-indigo-900 uppercase tracking-wide mt-3 mb-1">
          {formatInline(line.slice(4))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={idx} className="text-sm font-extrabold text-slate-900 mt-3 mb-1">
          {formatInline(line.slice(3))}
        </h3>
      );
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={idx} className="text-base font-black text-slate-900 mt-3 mb-1">
          {formatInline(line.slice(2))}
        </h2>
      );
      return;
    }

    // Unordered list
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      const itemText = line.trim().replace(/^[\*\-]\s+/, '');
      elements.push(
        <div key={idx} className="flex items-start gap-2 my-1 text-xs text-slate-700 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
          <span>{formatInline(itemText)}</span>
        </div>
      );
      return;
    }

    // Numbered list
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={idx} className="flex items-start gap-2 my-1 text-xs text-slate-700 leading-relaxed">
          <span className="font-bold text-indigo-600 text-xs shrink-0 w-4">{numMatch[1]}.</span>
          <span>{formatInline(numMatch[2])}</span>
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
      <p key={idx} className="text-xs text-slate-700 leading-relaxed my-1">
        {formatInline(line)}
      </p>
    );
  });

  if (tableBuffer.length > 0) flushTable();

  return <div className="space-y-0.5">{elements}</div>;
}

export function AiMentorChat({
  mockReports,
  mockErrorsData,
  activeMockReport,
  activeReviewResult,
  onStartWeakTopicDrill
}: AiMentorChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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
        text: `**Namaste!** 🙏 I am **Tommy**, your personal study assistant and problem solver.\n\nI have complete visibility into your **${mockReports.length} Mock Tests**, practice sessions, and error patterns. Ask me anything about:\n* Step-by-step solutions & shortcut tricks for any question\n* Your weak topics & score trends across mocks\n* Targeted strategy in Mathematics, Reasoning, English, or GK\n* Concept doubts, grammar rules, or revision plans\n\nHow can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isDraggingRef = useRef(false);

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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

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
  const dynamicSuggestions = useDynamicSuggestions(mockReports, topWeakTopic, activeReviewResult);

  const handleSendMessage = async (textToSend?: string, specificQuestion?: any) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // #10: Pin first message (welcome/context) + last 9 — so session context is never lost
      const allMsgs = [...messages, userMessage];
      let conversationPayload: { role: string; text: string }[];
      if (allMsgs.length <= 10) {
        conversationPayload = allMsgs.map(m => ({ role: m.role, text: m.text }));
      } else {
        // Always keep the first message (welcome + context) + the most recent 9
        const [first, ...rest] = allMsgs;
        conversationPayload = [
          { role: first.role, text: first.text },
          ...rest.slice(-9).map(m => ({ role: m.role, text: m.text }))
        ];
      }

      // Token optimization: Send active question if available, or at most 5 wrong questions
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationPayload,
          mockSummary: mockContextString,
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
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      const botMessage: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'I could not generate a response. Please try asking again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        text: `⚠️ **Connection Notice**: ${err.message || 'Unable to connect to Gemini API'}.\n\nPlease ensure your \`GEMINI_API_KEY\` is configured in \`.env\` or Vercel Environment Variables.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
      const prompt = `Please explain Question #${detail.questionNumber} (${detail.topic || 'General'}):\n\nQuestion:\n${detail.questionText}\n\nMy Chosen Option: ${detail.userAnswer ? detail.userAnswer.toUpperCase() : 'Unattempted / Left'}\nCorrect Answer: ${detail.correctAnswer ? detail.correctAnswer.toUpperCase() : 'Refer to solution'}\n\nPlease explain why my answer was wrong, break down the core concept/grammar rule step-by-step, and give me a fast shortcut trick to solve this in under 30 seconds.`;
      
      const qContext = {
        qNum: detail.questionNumber,
        question: detail.questionText,
        options: detail.options,
        userAnswer: detail.userAnswer,
        correctAnswer: detail.correctAnswer,
        solution: detail.solution,
        topic: detail.topic
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
    navigator.clipboard.writeText(cleanLatexMath(text));
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
                          <FormattedMessage content={msg.text} />
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.text}</p>
                        )}
                      </div>
                      <div
                        className={`flex items-center gap-2 mt-1 text-[9px] text-slate-400 px-1 ${
                          isBot ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <span>{msg.timestamp}</span>
                        {isBot && (
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

              {/* Typing / Thinking Loader */}
              {isLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] shrink-0 shadow-xs">
                    <Bot className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-medium text-slate-600">Tommy is analyzing...</span>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}

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
              <div className="relative flex items-end gap-1.5 rounded-xl border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 bg-white p-1.5 transition-all shadow-xs">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Tommy about this question, your mocks, or strategy..."
                  rows={1}
                  className="w-full resize-none bg-transparent px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden max-h-24 min-h-[32px] leading-relaxed"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  className={`p-2 rounded-lg transition-all shrink-0 cursor-pointer ${
                    inputText.trim() && !isLoading
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                  title="Send Message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1 text-[9px] text-slate-400">
                <span>Press <strong>Enter</strong> to send • <strong>Shift+Enter</strong> for newline</span>
                <span>Powered by Gemini AI</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
