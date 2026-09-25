import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Award,
  ChevronDown,
  Layers,
  HelpCircle,
  Play,
  Pause,
  Zap,
  BookOpen
} from 'lucide-react';
import simplificationData from '../../data/drills/simplificationDrills.json';

export interface SimplificationQuestion {
  id: string;
  q_num: number;
  question: string;
  options: Record<string, string>;
  answer: string;
  solution: string;
}

export interface SimplificationDrillSet {
  id: string;
  title: string;
  setNumber: number;
  difficulty: 'Easy' | 'Moderate' | 'Hard';
  totalQuestions: number;
  questions: SimplificationQuestion[];
}

export const SimplificationDrill: React.FC = () => {
  const sets = simplificationData as SimplificationDrillSet[];
  const [selectedSetId, setSelectedSetId] = useState<string>(sets[0]?.id || 'set_1_easy');
  const currentSet = useMemo(() => sets.find(s => s.id === selectedSetId) || sets[0], [selectedSetId, sets]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<'practice' | 'sprint'>('practice');
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Timer for sprint mode (300 seconds = 5 mins for 10 questions)
  const SPRINT_SECONDS = 300;
  const [timeLeft, setTimeLeft] = useState<number>(SPRINT_SECONDS);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Reset state on set switch
  useEffect(() => {
    setCurrentIndex(0);
    setUserAnswers({});
    setShowSolution(false);
    setIsFinished(false);
    setTimeLeft(SPRINT_SECONDS);
    setElapsedTime(0);
    setIsTimerRunning(mode === 'sprint');
  }, [selectedSetId, mode]);

  // Timer tick
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && !isFinished) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        if (mode === 'sprint') {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              setIsFinished(true);
              setIsTimerRunning(false);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, isFinished, mode]);

  const currentQ = currentSet?.questions[currentIndex];
  const totalQuestions = currentSet?.questions.length || 10;

  // Handle answering
  const handleSelectOption = (optKey: string) => {
    if (isFinished) return;
    setUserAnswers(prev => ({
      ...prev,
      [currentIndex]: optKey.toLowerCase()
    }));
  };

  // Keyboard navigation & option selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName || '')) return;
      const key = e.key.toLowerCase();
      if (['a', 'b', 'c', 'd', 'e'].includes(key)) {
        if (currentQ?.options[key]) {
          e.preventDefault();
          handleSelectOption(key);
        }
      } else if (e.key === 'ArrowRight' || key === 'j') {
        if (currentIndex < totalQuestions - 1) {
          e.preventDefault();
          setCurrentIndex(prev => prev + 1);
          setShowSolution(false);
        }
      } else if (e.key === 'ArrowLeft' || key === 'k') {
        if (currentIndex > 0) {
          e.preventDefault();
          setCurrentIndex(prev => prev - 1);
          setShowSolution(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentQ, totalQuestions, isFinished]);

  // Calculations for score & stats
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = useMemo(() => {
    return Object.entries(userAnswers).filter(([idx, ans]) => {
      const q = currentSet?.questions[Number(idx)];
      return q && q.answer.toLowerCase() === ans.toLowerCase();
    }).length;
  }, [userAnswers, currentSet]);

  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Set Selector */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <select
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 font-bold text-xs sm:text-sm text-slate-800 py-2 pl-3.5 pr-8 rounded-xl border border-slate-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {sets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.totalQuestions} Qs)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
            currentSet.difficulty === 'Easy'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : currentSet.difficulty === 'Moderate'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {currentSet.difficulty}
          </span>
        </div>

        {/* Mode Selector & Timer */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Practice vs Sprint Mode */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('practice')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                mode === 'practice'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Practice
            </button>
            <button
              type="button"
              onClick={() => setMode('sprint')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                mode === 'sprint'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Sprint (5m)</span>
            </button>
          </div>

          {/* Timer Display */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-700">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>{mode === 'sprint' ? formatTime(timeLeft) : formatTime(elapsedTime)}</span>
            {mode === 'sprint' && !isFinished && (
              <button
                type="button"
                onClick={() => setIsTimerRunning(p => !p)}
                className="text-slate-400 hover:text-slate-700 ml-1 p-0.5"
                title={isTimerRunning ? 'Pause timer' : 'Resume timer'}
              >
                {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Question Number Palette */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {currentSet.questions.map((q, idx) => {
            const isAnswered = userAnswers[idx] !== undefined;
            const isCurrent = idx === currentIndex;
            const isCorrect = isFinished && isAnswered && userAnswers[idx] === q.answer.toLowerCase();
            const isWrong = isFinished && isAnswered && userAnswers[idx] !== q.answer.toLowerCase();

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  setShowSolution(false);
                }}
                className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  isCurrent
                    ? 'ring-2 ring-indigo-600 ring-offset-1 font-black scale-105'
                    : ''
                } ${
                  isFinished
                    ? isCorrect
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : isWrong
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500'
                    : isAnswered
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-100 text-xs font-medium text-slate-500 shrink-0">
          <span>{answeredCount}/{totalQuestions} Answered</span>
          {!isFinished ? (
            <button
              type="button"
              onClick={() => setIsFinished(true)}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              Finish Drill
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setUserAnswers({});
                setIsFinished(false);
                setShowSolution(false);
                setTimeLeft(SPRINT_SECONDS);
                setElapsedTime(0);
                setIsTimerRunning(true);
              }}
              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Question Card */}
      {currentQ && (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
          {/* Question Title & Tag */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Press keys <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px]">A</kbd>-<kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px]">E</kbd> or click
            </span>
          </div>

          {/* Question Expression */}
          <div className="py-3 px-4 bg-slate-50/70 rounded-2xl border border-slate-200/60">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed font-sans select-text">
              {currentQ.question}
            </h2>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.entries(currentQ.options).map(([optKey, optVal]) => {
              const isSelected = userAnswers[currentIndex] === optKey.toLowerCase();
              const isCorrectAnswer = currentQ.answer.toLowerCase() === optKey.toLowerCase();
              const showResultColors = isFinished || (mode === 'practice' && isSelected);

              let optionStyle = 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800';
              let badgeStyle = 'bg-slate-100 text-slate-600 border-slate-200';

              if (showResultColors) {
                if (isCorrectAnswer) {
                  optionStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-1 ring-emerald-400';
                  badgeStyle = 'bg-emerald-600 text-white border-emerald-600';
                } else if (isSelected && !isCorrectAnswer) {
                  optionStyle = 'bg-rose-50 border-rose-400 text-rose-950 ring-1 ring-rose-400';
                  badgeStyle = 'bg-rose-600 text-white border-rose-600';
                }
              } else if (isSelected) {
                optionStyle = 'bg-indigo-50 border-indigo-400 text-indigo-950 ring-2 ring-indigo-400/40';
                badgeStyle = 'bg-indigo-600 text-white border-indigo-600';
              }

              return (
                <button
                  key={optKey}
                  type="button"
                  onClick={() => handleSelectOption(optKey)}
                  className={`p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-2xs active:scale-[0.99] ${optionStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg text-xs font-black uppercase flex items-center justify-center border shrink-0 ${badgeStyle}`}>
                      {optKey}
                    </span>
                    <span className="font-semibold text-sm leading-snug">
                      {optVal}
                    </span>
                  </div>
                  {showResultColors && isCorrectAnswer && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {showResultColors && isSelected && !isCorrectAnswer && (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Navigation & Solution Toggle */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => {
                setCurrentIndex(prev => Math.max(0, prev - 1));
                setShowSolution(false);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSolution(p => !p)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{showSolution ? 'Hide Solution' : 'View Solution'}</span>
              </button>

              <button
                type="button"
                disabled={currentIndex === totalQuestions - 1}
                onClick={() => {
                  setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1));
                  setShowSolution(false);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Step-by-Step Explanation Accordion */}
          <AnimatePresence>
            {showSolution && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs space-y-2">
                  <div className="flex items-center justify-between text-indigo-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Detailed Step-by-Step Solution
                    </span>
                    <span className="uppercase text-[11px] bg-indigo-100 px-2 py-0.5 rounded-md font-mono">
                      Correct Answer: Option {currentQ.answer.toUpperCase()}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-slate-800 text-xs leading-relaxed bg-white/70 p-3 rounded-xl border border-indigo-100/70">
                    {currentQ.solution || 'Detailed calculation solution not provided for this question.'}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 4. Score Summary Card (When finished) */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-5"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <span className="text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  Drill Completed • {currentSet.title}
                </span>
                <h3 className="text-2xl sm:text-3xl font-black mt-1">
                  Score: {correctCount} / {totalQuestions} ({scorePercentage}%)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Go to next set if available
                    const currentIdx = sets.findIndex(s => s.id === selectedSetId);
                    if (currentIdx < sets.length - 1) {
                      setSelectedSetId(sets[currentIdx + 1].id);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-white text-indigo-950 font-bold text-xs hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
                >
                  Next Drill Set &rarr;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-white/70 block">Correct Answers</span>
                <span className="text-xl font-black text-emerald-400">{correctCount}</span>
              </div>
              <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-white/70 block">Wrong Answers</span>
                <span className="text-xl font-black text-rose-400">{answeredCount - correctCount}</span>
              </div>
              <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-white/70 block">Time Spent</span>
                <span className="text-xl font-black text-amber-300">{formatTime(elapsedTime)}</span>
              </div>
              <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-white/70 block">Avg Pace</span>
                <span className="text-xl font-black text-indigo-300">
                  {answeredCount > 0 ? Math.round(elapsedTime / answeredCount) : 0}s / Q
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
