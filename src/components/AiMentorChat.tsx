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
  Clock,
  ArrowRight
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
}

const DEFAULT_SUGGESTIONS = [
  { icon: Target, label: 'Analyze my weak topics across all mocks', text: 'Analyze all my mocks and tell me my top 3 weakest topics and what I should do.' },
  { icon: TrendingUp, label: 'How to boost my score to 150+?', text: 'Looking at my current mock scores, what is my gap to reach 150+ in Tier-1 and which section gives the highest ROI?' },
  { icon: Flame, label: 'Why am I losing marks in English?', text: 'Analyze my English performance across my mocks and give me a fix for my errors.' },
  { icon: Clock, label: 'Create a 15-day mock revision plan', text: 'Create a focused 15-day revision and mock attempt schedule tailored to my current strengths and weaknesses.' }
];

// Lightweight Markdown Renderer for clean formatted responses
function FormattedMessage({ content }: { content: string }) {
  // Parse lines for headers, bullet points, horizontal rules, and tables
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let tableBuffer: string[] = [];

  const formatInline = (text: string) => {
    // Math formulas: $...$, bold: **...**, italic: *...*, code: `...`
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\$[^\$]+?\$)/g);
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
      if (part.startsWith('$') && part.endsWith('$')) {
        const mathClean = part.slice(1, -1)
          .replace(/\\text\{([^}]+)\}/g, '$1')
          .replace(/\\rightarrow|\\to/g, '→')
          .replace(/\\times/g, '×')
          .replace(/\\Delta/g, 'Δ')
          .replace(/\\le/g, '≤')
          .replace(/\\ge/g, '≥');
        return (
          <span key={i} className="px-1.5 py-0.2 mx-0.5 rounded bg-amber-50 text-amber-900 font-medium font-mono text-[11px] border border-amber-200/70 inline-block shadow-2xs">
            {mathClean}
          </span>
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

export function AiMentorChat({ mockReports, mockErrorsData, activeMockReport, activeReviewResult }: AiMentorChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('cgl_ai_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [
      {
        id: 'welcome_1',
        role: 'assistant',
        text: `**Namaste Aspirant!** 🙏 I am **Sankalp AI**, your personalized SSC CGL Mentor.\n\nI have complete visibility into your **${mockReports.length} Mock Tests** and error patterns. Ask me anything about:\n* Your weak topics & score trends across mocks\n* Targeted 45+ strategy in Mathematics or English\n* Concept doubts, grammar rules, or shortcut tricks\n* Personalized revision & mock attempt roadmaps\n\nHow can I help you crack SSC CGL today?`,
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

  // Sync chat history to localStorage
  useEffect(() => {
    localStorage.setItem('cgl_ai_chat_history', JSON.stringify(messages));
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

  // Aggregate current mock profile context string
  const mockContextString = useMemo(() => {
    return buildMockAiSummary(mockReports, mockErrorsData, activeMockReport);
  }, [mockReports, mockErrorsData, activeMockReport]);

  const handleSendMessage = async (textToSend?: string) => {
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
      // Prepare multi-turn messages for API
      const conversationPayload = [...messages, userMessage].slice(-10).map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationPayload,
          mockSummary: mockContextString,
          activeMockContext: activeMockReport
            ? `Active Mock Title: ${activeMockReport.title}\nScore: ${activeMockReport.totalScore}/${activeMockReport.maxMarks || 200}\nCorrect: ${activeMockReport.totalCorrect}, Wrong: ${activeMockReport.totalWrong}, Skipped: ${activeMockReport.totalUnattempted}`
            : undefined,
          activeReviewQuestions: activeReviewResult?.questionDetails?.map((qd, idx) => ({
            qNum: idx + 1,
            question: qd.question.question,
            options: qd.question.options,
            correctAnswer: qd.question.answer,
            userAnswer: qd.userAnswer,
            isCorrect: qd.isCorrect,
            solution: qd.question.solution,
            topic: qd.question.tags?.topic || (qd.question as any).topic
          }))
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear entire conversation history with Sankalp AI?')) {
      const reset = [
        {
          id: 'welcome_reset',
          role: 'assistant' as const,
          text: `Chat history cleared. I'm ready for your next question! Ask me about your mocks, SSC CGL concepts, or preparation strategy.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ];
      setMessages(reset);
      localStorage.removeItem('cgl_ai_chat_history');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-xl hover:shadow-2xl hover:shadow-indigo-500/30 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer border border-white/20"
              title="Open SSC CGL AI Mentor Chat"
            >
              <div className="relative">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold tracking-wide flex items-center gap-1.5">
                  Ask Sankalp AI
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-white/20 text-white uppercase tracking-wider">
                    Mentor
                  </span>
                </span>
                <span className="text-[10px] text-indigo-100 font-medium">
                  {mockReports.length} Mocks Synced
                </span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <h3 className="text-xs font-bold text-white truncate">Sankalp AI</h3>
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      CGL Mentor
                    </span>
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
                    <span className="text-[11px] font-medium text-slate-600">Sankalp AI is analyzing...</span>
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
                {DEFAULT_SUGGESTIONS.map((s, idx) => {
                  const Icon = s.icon;
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
                  placeholder="Ask Sankalp AI about your mocks, weak areas, or CGL strategy..."
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
