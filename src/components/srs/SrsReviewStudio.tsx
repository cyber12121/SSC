import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCw, CheckCircle2, ChevronRight, PenTool,
  Trophy, Trash2, Eye, EyeOff, X, Sparkles, BookOpen,
  ArrowLeft, Lightbulb, Zap, AlertTriangle, Flame, Filter
} from 'lucide-react';
import { SRSCard, SRSGrade } from '../../types/srs';
import { SrsScratchpad } from './SrsScratchpad';
import { calculateNextReview, addDaysToDate, formatDayString, matchesSubject } from '../../utils/srsEngine';

interface SrsReviewStudioProps {
  cards: SRSCard[];
  onFinishSession: (updatedCards: SRSCard[]) => void;
  onExit: () => void;
  onDeleteCurrentCard: (cardId: string) => void;
}

export const SrsReviewStudio: React.FC<SrsReviewStudioProps> = ({
  cards: initialReviewCards,
  onFinishSession,
  onExit,
  onDeleteCurrentCard
}) => {
  const [queue, setQueue] = useState<SRSCard[]>(initialReviewCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewMode, setReviewMode] = useState<'flashcard' | 'quiz'>('flashcard');
  const [selectedQuizOption, setSelectedQuizOption] = useState<string | null>(null);
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());
  const [sessionResults, setSessionResults] = useState<SRSCard[]>([]);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string>('all');

  // Extract distinct subtopics from review cards
  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    initialReviewCards.forEach(c => {
      if (c.topic && c.topic !== 'General' && c.topic !== 'All Topics') set.add(c.topic.trim());
      if (c.subtopic && c.subtopic !== 'General') set.add(c.subtopic.trim());
    });
    return Array.from(set).sort();
  }, [initialReviewCards]);

  const handleTopicChange = (newTopic: string) => {
    setTopicFilter(newTopic);
    if (newTopic === 'all') {
      setQueue(initialReviewCards);
    } else {
      const filtered = initialReviewCards.filter(c => 
        (c.topic && c.topic.trim() === newTopic) || (c.subtopic && c.subtopic.trim() === newTopic)
      );
      setQueue(filtered.length > 0 ? filtered : initialReviewCards);
    }
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
  };

  const currentCard = queue[currentIndex];

  // Reset timer on card change
  useEffect(() => {
    setIsFlipped(false);
    setSelectedQuizOption(null);
    setCardStartTime(Date.now());
  }, [currentIndex, queue]);

  // Handle self-grading response
  const handleRateCard = useCallback((grade: SRSGrade) => {
    if (!currentCard) return;

    const timeSpent = Math.max(1, Math.round((Date.now() - cardStartTime) / 1000));
    const updatedCard = calculateNextReview(currentCard, grade, timeSpent);

    setSessionResults(prev => [...prev, updatedCard]);

    if (grade === 'again') {
      // Re-insert card at end of queue so user encounters it again until retained
      setQueue(prev => [...prev, currentCard]);
    }

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  }, [currentCard, cardStartTime, currentIndex, queue.length]);

  // Desktop Keyboard navigation shortcuts: [Space]/[Enter] to flip, [1-4] to rate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or select
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped) {
        if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          handleRateCard('again');
        } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          handleRateCard('hard');
        } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          handleRateCard('good');
        } else if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') {
          e.preventDefault();
          handleRateCard('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, handleRateCard]);

  // Handle single card deletion
  const handleDeleteCard = () => {
    if (!currentCard) return;
    onDeleteCurrentCard(currentCard.id);
    setDeleteConfirmOpen(false);

    const remaining = queue.filter((_, idx) => idx !== currentIndex);
    if (remaining.length === 0) {
      setIsCompleted(true);
    } else {
      setQueue(remaining);
      if (currentIndex >= remaining.length) {
        setCurrentIndex(remaining.length - 1);
      }
    }
  };

  const getSubjectTheme = (subject: string = '') => {
    if (matchesSubject(subject, 'english')) return { name: 'English Vocab', color: 'emerald', border: 'border-emerald-200', bg: 'bg-emerald-50 text-emerald-800' };
    if (matchesSubject(subject, 'gk')) return { name: 'General Knowledge', color: 'sky', border: 'border-sky-200', bg: 'bg-sky-50 text-sky-800' };
    if (matchesSubject(subject, 'mathematics')) return { name: 'Mathematics', color: 'amber', border: 'border-amber-200', bg: 'bg-amber-50 text-amber-800' };
    if (matchesSubject(subject, 'reasoning')) return { name: 'Reasoning', color: 'purple', border: 'border-purple-200', bg: 'bg-purple-50 text-purple-800' };
    return { name: 'General', color: 'slate', border: 'border-slate-200', bg: 'bg-slate-50 text-slate-800' };
  };

  // ── Session Complete View ──
  if (isCompleted || !currentCard) {
    const totalReviewed = sessionResults.length;
    const goodOrEasyCount = sessionResults.filter(c => {
      const last = c.history?.[c.history.length - 1];
      return last?.grade === 'good' || last?.grade === 'easy';
    }).length;
    const accuracy = totalReviewed > 0 ? Math.round((goodOrEasyCount / totalReviewed) * 100) : 100;

    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 max-w-md w-full text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-200">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">Review Session Complete!</h2>
            <p className="text-xs text-slate-500 mt-1">Excellent job staying on top of your daily spaced repetition queue.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Cards Reviewed</span>
              <span className="text-2xl font-black text-slate-900">{totalReviewed}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-600 block uppercase">Retention Score</span>
              <span className="text-2xl font-black text-emerald-700">{accuracy}%</span>
            </div>
          </div>

          <button
            onClick={() => onFinishSession(sessionResults)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all"
          >
            Return to SRS Hub
          </button>
        </motion.div>
      </div>
    );
  }

  const theme = getSubjectTheme(currentCard.subject);
  const progressPercent = Math.round(((currentIndex) / queue.length) * 100);
  const isMathOrReasoning = currentCard.subject === 'Mathematics' || currentCard.subject === 'Reasoning';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Scratchpad overlay */}
      <SrsScratchpad isOpen={scratchpadOpen} onClose={() => setScratchpadOpen(false)} />

      {/* Top Header Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onExit}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-2xs transition-colors"
            title="Exit Review"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${theme.bg} ${theme.border}`}>
                {theme.name}
              </span>
              {availableTopics.length > 1 ? (
                <div className="flex items-center space-x-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={topicFilter}
                    onChange={e => handleTopicChange(e.target.value)}
                    className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 shadow-2xs hover:border-indigo-300 transition-colors cursor-pointer"
                  >
                    <option value="all">🎯 All Topics ({initialReviewCards.length})</option>
                    {availableTopics.map(t => {
                      const count = initialReviewCards.filter(c => (c.topic && c.topic.trim() === t) || (c.subtopic && c.subtopic.trim() === t)).length;
                      return (
                        <option key={t} value={t}>
                          {t} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                currentCard.topic && (
                  <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]">
                    • {currentCard.topic}
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        {/* Progress & Tools */}
        <div className="flex items-center space-x-2">
          {/* Scratchpad toggle */}
          <button
            onClick={() => setScratchpadOpen(!scratchpadOpen)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs ${
              scratchpadOpen
                ? 'bg-amber-500 text-white border-amber-500 shadow-amber-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Open Rough Canvas for calculations"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scratchpad</span>
          </button>

          {/* Delete card */}
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-400 shadow-2xs transition-colors"
            title="Delete this card"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Line */}
      <div className="max-w-4xl w-full mx-auto my-3">
        <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 mb-1.5 px-1">
          <span>Card {currentIndex + 1} of {queue.length}</span>
          <span>{queue.length - currentIndex - 1} remaining</span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3D Flipping Flashcard */}
      <div className="max-w-3xl w-full mx-auto my-auto py-2 [perspective:1200px]">
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
          className="relative w-full min-h-[420px] [transform-style:preserve-3d] cursor-pointer select-none"
          onClick={() => setIsFlipped(prev => !prev)}
        >
          {/* FRONT FACE (0deg) */}
          <div
            className="absolute inset-0 w-full h-full bg-white rounded-3xl border border-slate-200 shadow-xl hover:shadow-2xl transition-shadow flex flex-col justify-between overflow-hidden [backface-visibility:hidden]"
          >
            {/* Top strip */}
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1.5 text-indigo-700">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{currentCard.conceptTested || currentCard.topic || 'Anki Active Recall'}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-bold">
                Front Prompt
              </span>
            </div>

            {/* Front Body */}
            <div className="p-8 sm:p-10 flex-1 flex flex-col justify-center space-y-5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Question / Prompt:
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-relaxed font-sans">
                {currentCard.front}
              </h2>

              {currentCard.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
                  {Object.entries(currentCard.options).map(([optKey, optVal]) => (
                    <div
                      key={optKey}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedQuizOption(optKey);
                        setIsFlipped(true);
                      }}
                      className="p-3 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/40 text-left font-medium text-xs text-slate-800 transition-colors flex items-start space-x-2 cursor-pointer"
                    >
                      <span className="font-bold text-indigo-600 uppercase">({optKey})</span>
                      <span>{optVal}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Flip Callout */}
            <div className="py-3.5 px-6 border-t border-slate-100 text-center bg-slate-50/70 text-slate-500 text-xs font-bold flex items-center justify-center gap-2">
              <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
              <span>Click card or press <strong>Space</strong> to Flip</span>
            </div>
          </div>

          {/* BACK FACE (180deg) */}
          <div
            className="absolute inset-0 w-full h-full bg-white rounded-3xl border-2 border-indigo-200/80 shadow-2xl flex flex-col justify-between overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            {/* Top strip */}
            <div className="px-6 py-3.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between text-xs font-bold text-indigo-900">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Solution & Recall Answer</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black">
                Back Answer
              </span>
            </div>

            {/* Back Body */}
            <div className="p-8 sm:p-10 flex-1 overflow-y-auto space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block mb-1">
                  Correct Answer & Explanation:
                </span>
                <p className="text-sm font-medium text-slate-800 whitespace-pre-line leading-relaxed">
                  {currentCard.back}
                </p>
              </div>

              {/* Golden Mnemonic Hook or Speed Formula Callout */}
              {(currentCard.mnemonic || currentCard.shortcutFormula) && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-semibold flex items-start space-x-3 shadow-2xs">
                  <span className="text-xl shrink-0 mt-0.5">
                    {currentCard.shortcutFormula ? '⚡' : '💡'}
                  </span>
                  <div>
                    <strong className="block text-amber-950 font-black text-xs mb-0.5">
                      {currentCard.shortcutFormula ? 'Speed Trick / Shortcut Rule:' : 'Mnemonic Memory Hook:'}
                    </strong>
                    <span className="text-amber-900 font-medium leading-relaxed">
                      {currentCard.shortcutFormula || currentCard.mnemonic}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Trap Alert */}
              {currentCard.trapAlert && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200/80 text-red-800 text-[11px] font-medium flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{currentCard.trapAlert}</span>
                </div>
              )}
            </div>

            {/* Bottom Flip Back Callout */}
            <div className="py-3 px-6 border-t border-slate-100 text-center bg-slate-50 text-slate-400 text-xs font-medium flex items-center justify-between">
              <span>Grade your recall below: <strong className="text-slate-700">Keys [1, 2, 3, 4]</strong></span>
              <span className="text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer" onClick={() => setIsFlipped(false)}>
                Click card or Space to flip back
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Rating Controls (Anki 4-Button System with Keyboard Shortcuts) */}
      <div className="max-w-3xl w-full mx-auto pt-4">
        {isFlipped ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1 - Again */}
            <button
              onClick={() => handleRateCard('again')}
              className="py-3 px-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-2xl font-black text-xs flex flex-col items-center justify-center space-y-1 transition-all shadow-2xs hover:scale-102 cursor-pointer"
            >
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-black">Again</span>
                <kbd className="px-1.5 py-0.2 bg-white border border-red-200 rounded text-[10px] font-mono shadow-2xs">1</kbd>
              </div>
              <span className="text-[10px] font-bold opacity-75">1 Day Reset</span>
            </button>

            {/* 2 - Hard */}
            <button
              onClick={() => handleRateCard('hard')}
              className="py-3 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-2xl font-black text-xs flex flex-col items-center justify-center space-y-1 transition-all shadow-2xs hover:scale-102 cursor-pointer"
            >
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-black">Hard</span>
                <kbd className="px-1.5 py-0.2 bg-white border border-amber-200 rounded text-[10px] font-mono shadow-2xs">2</kbd>
              </div>
              <span className="text-[10px] font-bold opacity-75">+2 Days</span>
            </button>

            {/* 3 - Good */}
            <button
              onClick={() => handleRateCard('good')}
              className="py-3 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl font-black text-xs flex flex-col items-center justify-center space-y-1 transition-all shadow-2xs hover:scale-102 cursor-pointer"
            >
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-black">Good</span>
                <kbd className="px-1.5 py-0.2 bg-white border border-emerald-200 rounded text-[10px] font-mono shadow-2xs">3</kbd>
              </div>
              <span className="text-[10px] font-bold opacity-75">+5 Days</span>
            </button>

            {/* 4 - Easy */}
            <button
              onClick={() => handleRateCard('easy')}
              className="py-3 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl font-black text-xs flex flex-col items-center justify-center space-y-1 transition-all shadow-2xs hover:scale-102 cursor-pointer"
            >
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-black">Easy</span>
                <kbd className="px-1.5 py-0.2 bg-white border border-indigo-200 rounded text-[10px] font-mono shadow-2xs">4</kbd>
              </div>
              <span className="text-[10px] font-bold opacity-75">+12 Days</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <button
              onClick={() => setIsFlipped(true)}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-200 flex items-center space-x-2 transition-all cursor-pointer hover:scale-102"
            >
              <Eye className="w-4 h-4" />
              <span>Show Answer & Reveal</span>
              <kbd className="px-2 py-0.5 bg-indigo-700/80 rounded text-[10px] font-mono">Space / Enter</kbd>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Delete this Card?</h4>
              <p className="text-xs text-slate-500 mt-1">This card will be removed from your active review queue.</p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCard}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
